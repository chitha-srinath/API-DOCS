import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  bodyEditorText,
  buildRequest,
  buildSections,
  checkAll,
  fieldId,
  hintFor,
  initialValues,
  valuesFromBodyText,
  type Components,
  type Field,
  type JsonSchema,
  type Parameter,
  type RequestBody,
  type Section,
} from '@/lib/schema-form';

interface MediaType {
  schema?: JsonSchema;
}

interface SpecOperation {
  method: string;
  path: string;
  summary?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, { description?: string; content?: Record<string, MediaType> }>;
}

/** Builds a sample value from a JSON schema: the declared example when present, otherwise a typed placeholder. */
function sampleFrom(schema: JsonSchema | undefined): unknown {
  if (!schema) return null;
  if (schema.example !== undefined) return schema.example;
  if (schema.type === 'object' && schema.properties) {
    return Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, sampleFrom(v)]));
  }
  if (schema.type === 'integer' || schema.type === 'number') return 0;
  if (schema.type === 'boolean') return false;
  if (schema.type === 'array') return [];
  return '';
}

interface Spec {
  info: { title: string; version: string };
  openapi: string;
  paths: Record<string, Record<string, Omit<SpecOperation, 'method' | 'path'>>>;
  components?: Components;
}

const METHOD_CLASS: Record<string, string> = {
  get: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  post: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  put: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  patch: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  delete: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
};

function statusClass(code: string): string {
  if (code.startsWith('2')) return 'text-emerald-600 dark:text-emerald-400';
  if (code.startsWith('4')) return 'text-amber-600 dark:text-amber-400';
  if (code.startsWith('5')) return 'text-rose-600 dark:text-rose-400';
  return 'text-muted-foreground';
}

function flatten(spec: Spec): SpecOperation[] {
  return Object.entries(spec.paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, op]) => ({ method, path, ...op })),
  );
}

type AuthMode = 'none' | 'bearer' | 'apikey';

/** Credentials typed into the page. Kept in memory only, never written to localStorage. */
interface Auth {
  mode: AuthMode;
  token: string;
  apiKeyHeader: string;
  apiKeyValue: string;
}

const NO_AUTH: Auth = { mode: 'none', token: '', apiKeyHeader: 'X-API-Key', apiKeyValue: '' };

function authHeaders(auth: Auth): Record<string, string> {
  if (auth.mode === 'bearer' && auth.token) return { Authorization: `Bearer ${auth.token}` };
  if (auth.mode === 'apikey' && auth.apiKeyValue) return { [auth.apiKeyHeader || 'X-API-Key']: auth.apiKeyValue };
  return {};
}

function AuthPanel({ auth, onChange }: { auth: Auth; onChange: (next: Auth) => void }) {
  const modes: Array<{ value: AuthMode; label: string }> = [
    { value: 'none', label: 'None' },
    { value: 'bearer', label: 'Bearer token' },
    { value: 'apikey', label: 'API key' },
  ];
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-2 text-sm font-medium">Authorization</span>
        {modes.map((m) => (
          <Button
            key={m.value}
            size="sm"
            variant={auth.mode === m.value ? 'default' : 'outline'}
            onClick={() => onChange({ ...auth, mode: m.value })}
          >
            {m.label}
          </Button>
        ))}
      </div>
      {auth.mode === 'bearer' && (
        <Input
          placeholder="Token, e.g. demo-token"
          value={auth.token}
          onChange={(e) => onChange({ ...auth, token: e.target.value })}
          aria-label="Bearer token"
        />
      )}
      {auth.mode === 'apikey' && (
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
          <Input
            placeholder="Header name"
            value={auth.apiKeyHeader}
            onChange={(e) => onChange({ ...auth, apiKeyHeader: e.target.value })}
            aria-label="API key header name"
          />
          <Input
            placeholder="API key value"
            value={auth.apiKeyValue}
            onChange={(e) => onChange({ ...auth, apiKeyValue: e.target.value })}
            aria-label="API key value"
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground">Sent with "Try it" requests only. Not saved.</p>
    </div>
  );
}

type UploadOutcome =
  | { kind: 'success'; body: string }
  | { kind: 'http'; status: number; body: string }
  | { kind: 'network' }
  | { kind: 'cancelled' };

const OUTCOME_LABEL: Record<UploadOutcome['kind'], string> = {
  success: 'Upload complete',
  http: 'Server rejected the upload',
  network: 'Network error',
  cancelled: 'Upload cancelled',
};

interface QueuedFile {
  id: number;
  file: File;
  state: 'queued' | 'uploading' | 'done';
  progress: number;
  outcome?: UploadOutcome;
}

/** Uploads a queue of files, one request per file, with XHR so progress, network failure and cancel are observable. */
function UploadPanel({ auth }: { auth: Auth }) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [failMode, setFailMode] = useState(false);
  const [running, setRunning] = useState(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const cancelledRef = useRef(false);
  const nextId = useRef(1);

  function update(id: number, patch: Partial<QueuedFile>) {
    setQueue((q) => q.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const added = Array.from(list, (file) => ({ id: nextId.current++, file, state: 'queued' as const, progress: 0 }));
    setQueue((q) => [...q, ...added]);
  }

  function sendOne(item: QueuedFile, simulateFailure: boolean): Promise<UploadOutcome> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open('POST', simulateFailure ? '/uploads?fail=1' : '/uploads');
      xhr.setRequestHeader('Content-Type', item.file.type || 'application/octet-stream');
      xhr.setRequestHeader('X-File-Name', item.file.name);
      for (const [k, v] of Object.entries(authHeaders(auth))) xhr.setRequestHeader(k, v);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) update(item.id, { progress: Math.round((e.loaded / e.total) * 100) });
      };
      xhr.onload = () => {
        // A gateway error means the dev proxy could not reach the API: treat it as a network failure.
        if ([502, 503, 504].includes(xhr.status)) return resolve({ kind: 'network' });
        resolve(
          xhr.status >= 200 && xhr.status < 300
            ? { kind: 'success', body: xhr.responseText }
            : { kind: 'http', status: xhr.status, body: xhr.responseText },
        );
      };
      xhr.onerror = () => resolve({ kind: 'network' });
      xhr.onabort = () => resolve({ kind: 'cancelled' });
      xhr.send(item.file);
    });
  }

  async function uploadAll() {
    cancelledRef.current = false;
    setRunning(true);
    const pending = queue.filter((item) => item.state === 'queued');
    for (const item of pending) {
      if (cancelledRef.current) break;
      update(item.id, { state: 'uploading', progress: 0 });
      const outcome = await sendOne(item, failMode);
      update(item.id, { state: 'done', progress: 100, outcome });
    }
    setRunning(false);
  }

  function cancel() {
    cancelledRef.current = true;
    xhrRef.current?.abort();
  }

  const queued = queue.filter((item) => item.state === 'queued').length;
  const succeeded = queue.filter((item) => item.outcome?.kind === 'success').length;
  const failed = queue.filter((item) => item.outcome && item.outcome.kind !== 'success').length;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border p-4">
        <Input
          type="file"
          multiple
          aria-label="Files to upload"
          disabled={running}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={failMode ? 'destructive' : 'outline'}
            disabled={running}
            onClick={() => setFailMode((v) => !v)}
          >
            {failMode ? 'Simulating storage failure (500)' : 'Simulate storage failure'}
          </Button>
          <Button onClick={uploadAll} disabled={running || queued === 0}>
            {queued > 0 ? `Upload ${queued} file${queued === 1 ? '' : 's'}` : 'Upload'}
          </Button>
          {running && (
            <Button variant="outline" onClick={cancel}>
              Cancel
            </Button>
          )}
          {!running && queue.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setQueue([])}>
              Clear
            </Button>
          )}
        </div>
        {queue.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {queue.length} selected · {succeeded} uploaded · {failed} failed
          </p>
        )}
      </div>

      {queue.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {queue.map((item) => (
            <li key={item.id} className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium">{item.file.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {item.file.size} bytes · {item.file.type || 'unknown type'}
                </span>
              </div>
              {item.state === 'uploading' && (
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={item.progress}>
                  <div className="h-full bg-primary transition-[width]" style={{ width: `${item.progress}%` }} />
                </div>
              )}
              {item.state === 'queued' && <p className="text-xs text-muted-foreground">Waiting</p>}
              {item.outcome && (
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span>{OUTCOME_LABEL[item.outcome.kind]}</span>
                    <span
                      className={`font-mono font-semibold ${
                        item.outcome.kind === 'success'
                          ? statusClass('200')
                          : statusClass(item.outcome.kind === 'http' ? String(item.outcome.status) : '0')
                      }`}
                    >
                      {item.outcome.kind === 'success' && '201'}
                      {item.outcome.kind === 'http' && item.outcome.status}
                      {item.outcome.kind === 'network' && 'no response'}
                      {item.outcome.kind === 'cancelled' && 'aborted'}
                    </span>
                  </div>
                  {(item.outcome.kind === 'success' || item.outcome.kind === 'http') && (
                    <pre className="overflow-x-auto rounded bg-muted/40 p-2 font-mono text-xs">{item.outcome.body}</pre>
                  )}
                  {item.outcome.kind === 'network' && (
                    <p className="text-xs text-muted-foreground">The server could not be reached. Check the connection or that the API is running, then retry.</p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const SECTION_TITLE: Record<Section['key'], string> = {
  path: 'Path parameters',
  query: 'Query parameters',
  body: 'Request body',
};

/** One form control per schema field: number, text, long text, enum/boolean select, or a JSON editor. */
function FieldControl({
  id,
  field,
  value,
  error,
  onChange,
}: {
  id: string;
  field: Field;
  value: string;
  error?: string;
  onChange: (next: string) => void;
}) {
  const s = field.schema;
  const invalid = error !== undefined;
  const options = field.kind === 'enum' ? (s.enum ?? []).map(String) : ['true', 'false'];
  const json = field.kind === 'json';

  let control: ReactNode;
  if (field.kind === 'integer' || field.kind === 'number') {
    control = (
      <Input
        id={id}
        type="number"
        step={field.kind === 'integer' ? 1 : 'any'}
        min={s.minimum}
        max={s.maximum}
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  } else if (field.kind === 'text') {
    control = (
      <Input
        id={id}
        type={s.format === 'date' ? 'date' : 'text'}
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  } else if (field.kind === 'textarea') {
    control = (
      <Textarea
        id={id}
        rows={4}
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  } else if (json) {
    control = (
      <Textarea
        id={id}
        rows={6}
        spellCheck={false}
        className="font-mono text-xs"
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  } else {
    control = (
      <select
        id={id}
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
      >
        <option value="">{field.required ? 'Choose…' : 'Not set'}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className={`space-y-2 ${json || field.kind === 'textarea' ? 'sm:col-span-2' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="font-mono text-sm font-medium">
          {field.name}
        </label>
        <Badge variant={field.required ? 'default' : 'outline'}>{field.required ? 'required' : 'optional'}</Badge>
        <span className="text-xs text-muted-foreground">{hintFor(field)}</span>
      </div>
      {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
      {control}
      {(field.kind === 'text' || field.kind === 'textarea') && (s.minLength !== undefined || s.maxLength !== undefined) && (
        <p
          className={`text-right text-xs tabular-nums ${
            s.maxLength !== undefined && value.length > s.maxLength ? 'text-destructive' : 'text-muted-foreground'
          }`}
        >
          {value.length}
          {s.maxLength !== undefined && ` / ${s.maxLength}`}
          {s.minLength !== undefined && ` · min ${s.minLength}`}
        </p>
      )}
      {json && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className={!invalid && value.trim() !== '' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
            {!invalid && value.trim() !== '' ? 'Valid JSON' : 'JSON editor'}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={invalid || value.trim() === ''}
            onClick={() => onChange(JSON.stringify(JSON.parse(value), null, 2))}
          >
            Format
          </Button>
        </div>
      )}
      {invalid && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function TryIt({ op, auth, components }: { op: SpecOperation; auth: Auth; components?: Components }) {
  const sections = useMemo(
    () => buildSections(op.parameters ?? [], op.requestBody, components),
    [op, components],
  );
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(sections));
  const [bodyText, setBodyText] = useState(() => bodyEditorText(op.path, sections, initialValues(sections)));
  const [attempted, setAttempted] = useState(false);
  const [result, setResult] = useState<{ status: number; body: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const hasBody = sections.some((s) => s.key === 'body');
  const bodySections = sections.filter((s) => s.key === 'body');
  const errors = checkAll(sections, values);
  // The JSON editor only adds an error when its text cannot be read as a body; field errors come from the form.
  const parsed = hasBody && bodyText.trim() !== '' ? valuesFromBodyText(bodySections, bodyText) : null;
  const parseError = parsed && 'error' in parsed ? parsed.error : null;
  const errorCount = Object.keys(errors).length + (parseError ? 1 : 0);
  const preview = buildRequest(op.path, sections, values).url;
  const method = op.method.toUpperCase();

  // Form edits regenerate the JSON; JSON edits that parse flow back into the form fields.
  function setValue(id: string, next: string) {
    const nextValues = { ...values, [id]: next };
    setValues(nextValues);
    setBodyText(bodyEditorText(op.path, sections, nextValues));
  }

  function onBodyTextChange(text: string) {
    setBodyText(text);
    const next = valuesFromBodyText(bodySections, text);
    if (text.trim() !== '' && 'values' in next) setValues((prev) => ({ ...prev, ...next.values }));
  }

  async function send() {
    setAttempted(true);
    if (errorCount > 0) return;
    setLoading(true);
    try {
      const { url, body: formBody } = buildRequest(op.path, sections, values);
      // With a body section, the JSON editor is the source of truth so keys the form does not show are still sent.
      const body = hasBody ? (bodyText.trim() === '' ? undefined : JSON.stringify(JSON.parse(bodyText))) : formBody;
      const sendsBody = body !== undefined && method !== 'GET' && method !== 'HEAD';
      const headers: Record<string, string> = { ...authHeaders(auth) };
      if (sendsBody) headers['content-type'] = 'application/json';
      const res = await fetch(url, { method, headers, body: sendsBody ? body : undefined });
      setResult({ status: res.status, body: await res.text() });
    } catch (err) {
      setResult({ status: 0, body: String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => {
        const fieldset = (
          <fieldset key={section.key} className="space-y-4 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">{SECTION_TITLE[section.key]}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {section.fields.map((field) => {
                const id = fieldId(section.key, field.name);
                const raw = values[id] ?? '';
                // Required-but-empty is only flagged after a send attempt; anything typed is checked live.
                const error = errors[id] && (attempted || raw.trim() !== '') ? errors[id] : undefined;
                return (
                  <FieldControl
                    key={id}
                    id={id}
                    field={field}
                    value={raw}
                    error={error}
                    onChange={(next) => setValue(id, next)}
                  />
                );
              })}
            </div>
          </fieldset>
        );
        if (section.key !== 'body') return fieldset;
        return (
          <div key="body" className="grid gap-4 xl:grid-cols-2">
            {fieldset}
            <div className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">JSON body</span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={parseError !== null || bodyText.trim() === ''}
                  onClick={() => onBodyTextChange(JSON.stringify(JSON.parse(bodyText), null, 2))}
                >
                  Format
                </Button>
              </div>
              <Textarea
                rows={14}
                spellCheck={false}
                className="font-mono text-xs"
                aria-label="JSON request body"
                aria-invalid={parseError !== null || undefined}
                value={bodyText}
                onChange={(e) => onBodyTextChange(e.target.value)}
              />
              <p className={`text-xs ${parseError ? 'text-destructive' : 'text-muted-foreground'}`} role={parseError ? 'alert' : undefined}>
                {parseError ?? (bodyText.trim() === '' ? 'Empty body' : 'Valid JSON. Edits sync to the form fields.')}
              </p>
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={send} disabled={loading}>
          {loading ? 'Sending…' : `Send ${method}`}
        </Button>
        <code className="break-all text-sm text-muted-foreground">{preview}</code>
      </div>
      {attempted && errorCount > 0 && (
        <p className="text-sm text-destructive">
          Fix {errorCount} {errorCount === 1 ? 'field' : 'fields'} before sending.
        </p>
      )}
      {result && (
        <div className="rounded-lg border bg-muted/40">
          <div className="flex items-center justify-between border-b px-4 py-2 text-sm">
            <span className="font-medium">Response</span>
            <span className={`font-mono font-semibold ${statusClass(String(result.status))}`}>
              {result.status === 0 ? 'Network error' : result.status}
            </span>
          </div>
          <ScrollArea className="max-h-64">
            <pre className="p-4 font-mono text-xs leading-relaxed">{result.body}</pre>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

type Theme = 'light' | 'dark';

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem('docs-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Storage can be unavailable (private mode, blocked site data); fall back to the OS setting.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function App() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [spec, setSpec] = useState<Spec | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('docs-theme', theme);
    } catch {
      // Not persisted; the choice still applies for this page view.
    }
  }, [theme]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [auth, setAuth] = useState<Auth>(NO_AUTH);

  useEffect(() => {
    fetch('/openapi.json')
      .then((r) => {
        if (!r.ok) throw new Error(`Spec request failed: ${r.status}`);
        return r.json() as Promise<Spec>;
      })
      .then(setSpec)
      .catch((e: Error) => setError(e.message));
  }, []);

  const ops = useMemo(() => (spec ? flatten(spec) : []), [spec]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ops;
    return ops.filter((o) => `${o.method} ${o.path} ${o.summary ?? ''}`.toLowerCase().includes(q));
  }, [ops, query]);
  // Group filtered operations by their first tag; untagged operations land in "default".
  const groups = useMemo(() => {
    const byTag = new Map<string, SpecOperation[]>();
    for (const op of visible) {
      const tag = op.tags?.[0] ?? 'default';
      byTag.set(tag, [...(byTag.get(tag) ?? []), op]);
    }
    return [...byTag.entries()];
  }, [visible]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  function toggleGroup(tag: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }
  const current = ops.find((o) => `${o.method} ${o.path}` === selected) ?? ops[0];

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6 md:p-10">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">API reference</p>
          <h1 className="text-3xl font-semibold tracking-tight">{spec?.info.title ?? 'Loading…'}</h1>
        </div>
        <div className="flex items-center gap-2">
          {spec && (
            <>
              <Badge variant="secondary">v{spec.info.version}</Badge>
              <Badge variant="outline">OpenAPI {spec.openapi}</Badge>
            </>
          )}
          <Button
            variant="outline"
            size="icon"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </header>

      {error && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle>Could not load the spec</CardTitle>
            <CardDescription>{error}. Is the example server running on port 3111?</CardDescription>
          </CardHeader>
        </Card>
      )}

      {spec && current && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Endpoints</CardTitle>
              <CardDescription>
                {visible.length === ops.length ? `${ops.length} operations` : `${visible.length} of ${ops.length} match`}
              </CardDescription>
              <Input
                placeholder="Filter by method, path or summary"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="mt-2"
              />
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[60vh] pr-3">
                <div className="space-y-3">
                  {groups.map(([tag, groupOps]) => {
                    const isOpen = !collapsed.has(tag);
                    return (
                      <section key={tag}>
                        <button
                          onClick={() => toggleGroup(tag)}
                          className="sticky top-0 z-10 flex w-full items-center justify-between rounded-md bg-card px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted"
                          aria-expanded={isOpen}
                        >
                          <span>{isOpen ? '▾' : '▸'} {tag}</span>
                          <Badge variant="outline">{groupOps.length}</Badge>
                        </button>
                        {isOpen && (
                          <div className="mt-1 space-y-1">
                            {groupOps.map((op) => {
                              const key = `${op.method} ${op.path}`;
                              const active = key === `${current.method} ${current.path}`;
                              return (
                                <button
                                  key={key}
                                  onClick={() => setSelected(key)}
                                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${active ? 'bg-muted' : ''}`}
                                >
                                  <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase ${METHOD_CLASS[op.method] ?? ''}`}>
                                    {op.method}
                                  </span>
                                  <span className="truncate font-mono">{op.path}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className={`rounded px-2 py-1 font-mono text-xs font-semibold uppercase ${METHOD_CLASS[current.method] ?? ''}`}>
                  {current.method}
                </span>
                <code className="font-mono text-base">{current.path}</code>
              </div>
              <CardTitle className="pt-2 text-xl">{current.summary ?? 'Untitled operation'}</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
              <Tabs defaultValue="responses">
                <TabsList>
                  <TabsTrigger value="responses">Responses</TabsTrigger>
                  <TabsTrigger value="try">Try it</TabsTrigger>
                </TabsList>
                <TabsContent value="responses" className="pt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Status</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(current.responses).map(([code, res]) => (
                        <TableRow key={code}>
                          <TableCell className={`font-mono font-semibold ${statusClass(code)}`}>{code}</TableCell>
                          <TableCell>{res.description ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-6 space-y-4">
                    {Object.entries(current.responses).map(([code, res]) => {
                      const [mediaType, media] = Object.entries(res.content ?? {})[0] ?? [];
                      return (
                        <div key={code} className="rounded-lg border">
                          <div className="flex items-center justify-between border-b px-4 py-2 text-sm">
                            <span className={`font-mono font-semibold ${statusClass(code)}`}>{code}</span>
                            <span className="text-muted-foreground">{mediaType ?? 'no body documented'}</span>
                          </div>
                          {media && (
                            <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">
                              {JSON.stringify(sampleFrom(media.schema), null, 2)}
                            </pre>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
                <TabsContent value="try" className="space-y-4 pt-4">
                  <AuthPanel auth={auth} onChange={setAuth} />
                  {current.path === '/uploads' ? (
                    <UploadPanel auth={auth} />
                  ) : (
                    <TryIt
                      key={`${current.method} ${current.path}`}
                      op={current}
                      auth={auth}
                      components={spec.components}
                    />
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
