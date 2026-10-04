// Turns an operation's OpenAPI parameters and JSON request body into form fields,
// checks what the user typed against the same schema, and builds the request.

export interface JsonSchema {
  $ref?: string;
  type?: string;
  format?: string;
  description?: string;
  example?: unknown;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
}

export interface Parameter {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: JsonSchema;
}

export interface RequestBody {
  required?: boolean;
  content?: Record<string, { schema?: JsonSchema }>;
}

export interface Components {
  schemas?: Record<string, JsonSchema>;
}

export type FieldKind = 'integer' | 'number' | 'boolean' | 'enum' | 'text' | 'textarea' | 'json';

export interface Field {
  name: string;
  required: boolean;
  description?: string;
  kind: FieldKind;
  schema: JsonSchema;
}

export type SectionKey = 'path' | 'query' | 'body';

export interface Section {
  key: SectionKey;
  fields: Field[];
  /** True when the whole body is one JSON value rather than an object with named fields. */
  rawBody: boolean;
}

/** Strings longer than this get a multi-line editor instead of a single-line input. */
const LONG_TEXT = 120;

export function resolveSchema(schema: JsonSchema | undefined, components: Components | undefined): JsonSchema | undefined {
  if (!schema?.$ref) return schema;
  const name = schema.$ref.replace('#/components/schemas/', '');
  return components?.schemas?.[name] ?? schema;
}

function kindOf(schema: JsonSchema): FieldKind {
  if (schema.enum) return 'enum';
  if (schema.type === 'integer') return 'integer';
  if (schema.type === 'number') return 'number';
  if (schema.type === 'boolean') return 'boolean';
  if (schema.type === 'string') return (schema.maxLength ?? 0) > LONG_TEXT ? 'textarea' : 'text';
  return 'json';
}

function fieldOf(name: string, required: boolean, prop: JsonSchema | undefined, components: Components | undefined): Field {
  const schema = resolveSchema(prop, components) ?? {};
  return { name, required, description: schema.description ?? prop?.description, kind: kindOf(schema), schema };
}

/** Builds the sections a "Try it" form shows: path params, query params, then the body. */
export function buildSections(
  parameters: Parameter[],
  requestBody: RequestBody | undefined,
  components: Components | undefined,
): Section[] {
  const sections: Section[] = [];
  for (const key of ['path', 'query'] as const) {
    const fields = parameters
      .filter((p) => p.in === key)
      .map((p) => fieldOf(p.name, key === 'path' || p.required === true, p.schema, components));
    if (fields.length > 0) sections.push({ key, fields, rawBody: false });
  }

  const bodySchema = resolveSchema(requestBody?.content?.['application/json']?.schema, components);
  if (bodySchema?.type === 'object' && bodySchema.properties) {
    const required = new Set(bodySchema.required ?? []);
    const fields = Object.entries(bodySchema.properties).map(([name, prop]) =>
      fieldOf(name, required.has(name), prop, components),
    );
    sections.push({ key: 'body', fields, rawBody: false });
  } else if (bodySchema) {
    const field = fieldOf('body', requestBody?.required === true, bodySchema, components);
    sections.push({ key: 'body', fields: [field], rawBody: true });
  }
  return sections;
}

export function fieldId(section: SectionKey, name: string): string {
  return `${section}:${name}`;
}

/** Initial text for a field: the schema default or example, else empty. */
function initialText(field: Field): string {
  const value = field.schema.default ?? field.schema.example;
  if (value === undefined || value === null) return '';
  return field.kind === 'json' ? JSON.stringify(value, null, 2) : String(value);
}

export function initialValues(sections: Section[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const section of sections) {
    for (const field of section.fields) values[fieldId(section.key, field.name)] = initialText(field);
  }
  return values;
}

function rangeError(n: number, schema: JsonSchema): string | null {
  if (schema.minimum !== undefined && n < schema.minimum) return `Must be at least ${schema.minimum}`;
  if (schema.maximum !== undefined && n > schema.maximum) return `Must be at most ${schema.maximum}`;
  if (schema.exclusiveMinimum !== undefined && n <= schema.exclusiveMinimum) return `Must be greater than ${schema.exclusiveMinimum}`;
  if (schema.exclusiveMaximum !== undefined && n >= schema.exclusiveMaximum) return `Must be less than ${schema.exclusiveMaximum}`;
  return null;
}

/** Client-side checks for OpenAPI string formats. Zod also emits a `pattern` for these; the format check gives the clearer message. */
const FORMAT_CHECKS: Record<string, { label: string; test: (s: string) => boolean }> = {
  uuid: {
    label: 'a UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)',
    test: (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s),
  },
  date: {
    label: 'a date (YYYY-MM-DD)',
    // Round-tripping through Date rejects impossible dates such as 2025-02-30.
    test: (s) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
      const d = new Date(`${s}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
    },
  },
  'date-time': {
    label: 'an ISO 8601 date-time',
    test: (s) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && !Number.isNaN(Date.parse(s)),
  },
  email: {
    label: 'an email address',
    test: (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s),
  },
};

function textError(raw: string, schema: JsonSchema): string | null {
  if (schema.minLength !== undefined && raw.length < schema.minLength) return `At least ${schema.minLength} characters`;
  if (schema.maxLength !== undefined && raw.length > schema.maxLength) {
    return `At most ${schema.maxLength} characters (now ${raw.length})`;
  }
  const check = schema.format ? FORMAT_CHECKS[schema.format] : undefined;
  if (check && !check.test(raw)) return `Must be ${check.label}`;
  if (schema.pattern) {
    try {
      if (!new RegExp(schema.pattern, 'u').test(raw)) return `Must match ${schema.pattern}`;
    } catch {
      // A pattern this browser cannot compile is left to the server to check.
    }
  }
  return null;
}

function jsonError(raw: string, schema: JsonSchema): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return `Invalid JSON: ${(err as Error).message}`;
  }
  if (schema.type === 'array' && !Array.isArray(parsed)) return 'Must be a JSON array';
  if (schema.type === 'object' && (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))) {
    return 'Must be a JSON object';
  }
  return null;
}

/** Returns a message when `raw` cannot be sent for this field, or null when it is acceptable. */
export function checkField(field: Field, raw: string): string | null {
  if (raw.trim() === '') return field.required ? 'Required' : null;
  const { schema } = field;
  switch (field.kind) {
    case 'integer':
    case 'number': {
      const n = Number(raw);
      if (!Number.isFinite(n)) return 'Enter a number';
      if (field.kind === 'integer' && !Number.isInteger(n)) return 'Must be a whole number';
      return rangeError(n, schema);
    }
    case 'enum': {
      const options = (schema.enum ?? []).map(String);
      return options.includes(raw) ? null : `Choose one of: ${options.join(', ')}`;
    }
    case 'boolean':
      return raw === 'true' || raw === 'false' ? null : 'Choose true or false';
    case 'text':
    case 'textarea':
      return textError(raw, schema);
    case 'json':
      return jsonError(raw, schema);
  }
}

export function checkAll(sections: Section[], values: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const section of sections) {
    for (const field of section.fields) {
      const id = fieldId(section.key, field.name);
      const error = checkField(field, values[id] ?? '');
      if (error) errors[id] = error;
    }
  }
  return errors;
}

function toValue(field: Field, raw: string): unknown {
  switch (field.kind) {
    case 'integer':
    case 'number':
      return Number(raw);
    case 'boolean':
      return raw === 'true';
    case 'json':
      return JSON.parse(raw);
    default:
      return raw;
  }
}

/** Short constraint summary shown next to a field's name. */
export function hintFor(field: Field): string {
  const s = field.schema;
  if (field.kind === 'enum') return `one of ${(s.enum ?? []).map(String).join(' | ')}`;
  if (field.kind === 'boolean') return 'true or false';
  if (field.kind === 'json') return s.type === 'array' ? 'JSON array' : s.type === 'object' ? 'JSON object' : 'JSON value';
  if (field.kind === 'integer' || field.kind === 'number') {
    const kind = field.kind === 'integer' ? 'integer' : 'number';
    const min = s.minimum ?? s.exclusiveMinimum;
    // zod writes Number.MAX_SAFE_INTEGER for an unbounded integer; that is not a useful bound to show.
    const rawMax = s.maximum ?? s.exclusiveMaximum;
    const max = rawMax === Number.MAX_SAFE_INTEGER ? undefined : rawMax;
    if (min !== undefined && max !== undefined) return `${kind} from ${min} to ${max}`;
    if (min !== undefined) return `${kind} ≥ ${min}`;
    if (max !== undefined) return `${kind} ≤ ${max}`;
    return kind;
  }
  const parts: string[] = [];
  if (s.format) parts.push(s.format);
  if (s.minLength !== undefined && s.maxLength !== undefined) parts.push(`${s.minLength}–${s.maxLength} characters`);
  else if (s.maxLength !== undefined) parts.push(`up to ${s.maxLength} characters`);
  else if (s.minLength !== undefined) parts.push(`at least ${s.minLength} characters`);
  return parts.join(' · ') || 'text';
}

export interface BuiltRequest {
  url: string;
  /** JSON text for the body, or undefined when the operation has no body. */
  body?: string;
}

/** Builds the URL (path and query) and JSON body from the form values. Assumes `checkAll` returned no errors. */
export function buildRequest(path: string, sections: Section[], values: Record<string, string>): BuiltRequest {
  let url = path;
  const query = new URLSearchParams();
  const body: Record<string, unknown> = {};
  let rawValue: unknown;
  let bodySection: Section | undefined;

  for (const section of sections) {
    if (section.key === 'body') bodySection = section;
    for (const field of section.fields) {
      const raw = values[fieldId(section.key, field.name)] ?? '';
      if (raw.trim() === '') continue;
      const value = toValue(field, raw);
      if (section.key === 'path') {
        url = url.replace(`{${field.name}}`, encodeURIComponent(String(value)));
      } else if (section.key === 'query') {
        query.set(field.name, typeof value === 'string' ? value : JSON.stringify(value));
      } else if (section.rawBody) {
        rawValue = value;
      } else {
        body[field.name] = value;
      }
    }
  }

  const qs = query.toString();
  let bodyText: string | undefined;
  if (bodySection) {
    if (bodySection.rawBody) bodyText = rawValue === undefined ? undefined : JSON.stringify(rawValue);
    else bodyText = JSON.stringify(body);
  }
  return { url: qs ? `${url}?${qs}` : url, body: bodyText };
}

function textOf(field: Field, value: unknown): string {
  if (value === undefined || value === null) return '';
  return field.kind === 'json' ? JSON.stringify(value, null, 2) : String(value);
}

/** Pretty-printed JSON for the body editor, derived from the form values. */
export function bodyEditorText(path: string, sections: Section[], values: Record<string, string>): string {
  const { body } = buildRequest(path, sections, values);
  return body === undefined ? '' : JSON.stringify(JSON.parse(body), null, 2);
}

/** Maps JSON body text onto the body form fields. Returns the message when the text is not a usable body. */
export function valuesFromBodyText(sections: Section[], text: string): { values: Record<string, string> } | { error: string } {
  const body = sections.find((s) => s.key === 'body');
  if (!body) return { values: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { error: `Invalid JSON: ${(err as Error).message}` };
  }
  if (body.rawBody) {
    const [field] = body.fields;
    return { values: { [fieldId('body', field.name)]: textOf(field, parsed) } };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: 'Body must be a JSON object' };
  }
  const object = parsed as Record<string, unknown>;
  const values: Record<string, string> = {};
  for (const field of body.fields) values[fieldId('body', field.name)] = textOf(field, object[field.name]);
  return { values };
}
