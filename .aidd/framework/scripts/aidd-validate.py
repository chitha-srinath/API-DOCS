#!/usr/bin/env python3
"""aidd-validate: zero-dependency validator for AIDD Delta state artifacts.

Validates YAML (strict AIDD subset) or JSON documents against a JSON Schema
subset (draft-07 keywords: type, enum, pattern, required, properties,
additionalProperties, items, minimum, maximum, oneOf).

The AIDD YAML subset is deliberately small so this parser stays tiny and every
runtime (Claude Code, Codex CLI, CI) can validate state without installing
anything: block-style maps and lists, 2-space indentation, scalar values
(string, int, float, bool, null), inline empty collections ({} and []),
comments with '#'. No anchors, aliases, multiline strings, or flow style.

Usage:
  aidd-validate.py SCHEMA FILE [FILE...]
  aidd-validate.py --frontmatter SCHEMA FILE.md [FILE.md...]

Exit codes: 0 all valid, 1 validation failure, 2 usage or parse error.
"""

import json
import re
import sys


class ParseError(Exception):
    pass


def strip_comment(line):
    out = []
    quote = None
    for ch in line:
        if quote:
            out.append(ch)
            if ch == quote:
                quote = None
        elif ch in ('"', "'"):
            quote = ch
            out.append(ch)
        elif ch == '#':
            break
        else:
            out.append(ch)
    return ''.join(out).rstrip()


def parse_scalar(text):
    s = text.strip()
    if s == '' or s in ('null', '~'):
        return None
    if s == 'true':
        return True
    if s == 'false':
        return False
    if s == '{}':
        return {}
    if s == '[]':
        return []
    if len(s) >= 2 and s[0] == s[-1] and s[0] in ('"', "'"):
        return s[1:-1]
    try:
        return int(s)
    except ValueError:
        pass
    try:
        return float(s)
    except ValueError:
        pass
    return s


KEY_RE = re.compile(r'^([A-Za-z0-9_.\-]+):(?:\s+(.*))?$')


def parse_yaml(text):
    lines = []
    for raw in text.splitlines():
        stripped = strip_comment(raw)
        if stripped.strip() == '':
            continue
        indent = len(stripped) - len(stripped.lstrip(' '))
        if stripped.lstrip(' ').startswith('\t'):
            raise ParseError('tabs are not allowed for indentation')
        lines.append((indent, stripped.strip()))
    value, next_index = parse_block(lines, 0, 0)
    if next_index != len(lines):
        raise ParseError(f'unparsed content at line entry {next_index}: {lines[next_index]}')
    return value


def parse_block(lines, index, indent):
    if index >= len(lines):
        return None, index
    line_indent, content = lines[index]
    if line_indent < indent:
        return None, index
    if content.startswith('- ') or content == '-':
        return parse_list(lines, index, line_indent)
    return parse_map(lines, index, line_indent)


def parse_map(lines, index, indent):
    result = {}
    while index < len(lines):
        line_indent, content = lines[index]
        if line_indent < indent:
            break
        if line_indent > indent:
            raise ParseError(f'unexpected indent at: {content}')
        if content.startswith('- ') or content == '-':
            break
        match = KEY_RE.match(content)
        if not match:
            raise ParseError(f'expected "key:" or "key: value", got: {content}')
        key, inline = match.group(1), match.group(2)
        if key in result:
            raise ParseError(f'duplicate key: {key}')
        if inline is not None and inline != '':
            result[key] = parse_scalar(inline)
            index += 1
        else:
            index += 1
            if index < len(lines) and lines[index][0] > indent:
                value, index = parse_block(lines, index, lines[index][0])
                result[key] = value
            else:
                result[key] = None
    return result, index


def parse_list(lines, index, indent):
    result = []
    while index < len(lines):
        line_indent, content = lines[index]
        if line_indent != indent or not (content.startswith('- ') or content == '-'):
            break
        item_text = content[2:] if content.startswith('- ') else ''
        if item_text == '':
            index += 1
            value, index = parse_block(lines, index, indent + 2)
            result.append(value)
            continue
        match = KEY_RE.match(item_text)
        if match:
            # List item that opens a map: rewrite '- key: v' as a map whose
            # continuation lines sit at indent + 2.
            synthetic = [(indent + 2, item_text)]
            index += 1
            while index < len(lines) and lines[index][0] >= indent + 2:
                synthetic.append(lines[index])
                index += 1
            value, consumed = parse_map(synthetic, 0, indent + 2)
            if consumed != len(synthetic):
                raise ParseError(f'bad list-item map near: {item_text}')
            result.append(value)
        else:
            result.append(parse_scalar(item_text))
            index += 1
    return result, index


TYPE_CHECKS = {
    'object': lambda v: isinstance(v, dict),
    'array': lambda v: isinstance(v, list),
    'string': lambda v: isinstance(v, str),
    'integer': lambda v: isinstance(v, int) and not isinstance(v, bool),
    'number': lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
    'boolean': lambda v: isinstance(v, bool),
    'null': lambda v: v is None,
}


def validate(instance, schema, path, errors):
    stype = schema.get('type')
    if stype is not None:
        types = stype if isinstance(stype, list) else [stype]
        if not any(TYPE_CHECKS[t](instance) for t in types):
            errors.append(f'{path}: expected type {types}, got {type(instance).__name__}')
            return
    if 'oneOf' in schema:
        matched, branch_errors = [], []
        for index, branch in enumerate(schema['oneOf']):
            sub = []
            validate(instance, branch, path, sub)
            if sub:
                # Sub-errors already carry the path; keep only the explanation.
                trimmed = [e[len(path) + 2:] if e.startswith(f'{path}: ') else e for e in sub]
                branch_errors.append(f'form {index + 1}: ' + '; '.join(trimmed))
            else:
                matched.append(index)
        if not matched:
            errors.append(f'{path}: matches none of the {len(schema["oneOf"])} allowed forms '
                          f'({" | ".join(branch_errors)})')
        elif len(matched) > 1:
            forms = ', '.join(str(i + 1) for i in matched)
            errors.append(f'{path}: matches {len(matched)} allowed forms ({forms}), '
                          'expected exactly one')
    if 'enum' in schema and instance not in schema['enum']:
        errors.append(f'{path}: value {instance!r} not in enum {schema["enum"]}')
    if 'pattern' in schema and isinstance(instance, str):
        if not re.search(schema['pattern'], instance):
            errors.append(f'{path}: {instance!r} does not match pattern {schema["pattern"]!r}')
    if isinstance(instance, (int, float)) and not isinstance(instance, bool):
        if 'minimum' in schema and instance < schema['minimum']:
            errors.append(f'{path}: {instance} below minimum {schema["minimum"]}')
        if 'maximum' in schema and instance > schema['maximum']:
            errors.append(f'{path}: {instance} above maximum {schema["maximum"]}')
    if isinstance(instance, dict):
        for req in schema.get('required', []):
            if req not in instance:
                errors.append(f'{path}: missing required property {req!r}')
        props = schema.get('properties', {})
        extra = schema.get('additionalProperties', True)
        for key, value in instance.items():
            child = f'{path}.{key}'
            if key in props:
                validate(value, props[key], child, errors)
            elif isinstance(extra, dict):
                validate(value, extra, child, errors)
            elif extra is False:
                errors.append(f'{path}: unexpected property {key!r}')
    if isinstance(instance, list) and 'items' in schema:
        for i, item in enumerate(instance):
            validate(item, schema['items'], f'{path}[{i}]', errors)


def extract_frontmatter(text):
    lines = text.splitlines()
    if not lines or lines[0].strip() != '---':
        raise ParseError('no frontmatter: file must start with ---')
    for i in range(1, len(lines)):
        if lines[i].strip() == '---':
            return '\n'.join(lines[1:i])
    raise ParseError('unterminated frontmatter')


def main(argv):
    args = list(argv[1:])
    if args and args[0] == '--to-json':
        for fp in args[1:]:
            with open(fp, encoding='utf-8') as fh:
                print(json.dumps(parse_yaml(fh.read())))
        return 0
    frontmatter = False
    if args and args[0] == '--frontmatter':
        frontmatter = True
        args = args[1:]
    if len(args) < 2:
        print(__doc__)
        return 2
    schema_path, files = args[0], args[1:]
    with open(schema_path, encoding='utf-8') as fh:
        schema = json.load(fh)
    exit_code = 0
    for file_path in files:
        with open(file_path, encoding='utf-8') as fh:
            text = fh.read()
        try:
            if frontmatter:
                instance = parse_yaml(extract_frontmatter(text))
            elif file_path.endswith('.json'):
                instance = json.loads(text)
            else:
                instance = parse_yaml(text)
        except (ParseError, json.JSONDecodeError) as exc:
            print(f'PARSE ERROR {file_path}: {exc}')
            exit_code = 2
            continue
        errors = []
        validate(instance, schema, '$', errors)
        if errors:
            exit_code = max(exit_code, 1)
            print(f'INVALID {file_path}')
            for err in errors:
                print(f'  - {err}')
        else:
            print(f'VALID {file_path}')
    return exit_code


if __name__ == '__main__':
    sys.exit(main(sys.argv))
