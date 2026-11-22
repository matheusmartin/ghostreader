"""A small JSON Schema validator for the Ghostreader working files (schemas/*.schema.json).

Python's standard library has no JSON Schema validator, and the book scripts use only the
standard library. This one covers the draft-07 subset the schemas use, and it refuses any other
keyword, so a schema cannot rely on a check this validator does not make. The tests run Ajv on
the same schemas and fixtures (tests/working-files.test.ts).

    errors = validate(instance, schema)   # [] when valid; else ["<path>: <message>", ...]
"""
import re

ANNOTATIONS = {'$schema', '$id', 'title', 'description', 'definitions', 'default', 'examples'}
CHECKS = {'type', 'enum', 'const', 'properties', 'required', 'additionalProperties', 'items',
          'minItems', 'maxItems', 'pattern', 'minimum', 'maximum', 'anyOf', '$ref'}
TYPES = {
    'object': lambda v: isinstance(v, dict),
    'array': lambda v: isinstance(v, list),
    'string': lambda v: isinstance(v, str),
    'integer': lambda v: isinstance(v, int) and not isinstance(v, bool),
    'number': lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
    'boolean': lambda v: isinstance(v, bool),
    'null': lambda v: v is None,
}


class SchemaError(Exception):
    """The schema uses a keyword this validator does not check."""


def validate(instance, schema):
    errors = []
    _check(instance, schema, schema, '', errors)
    return errors


def _resolve(ref, root):
    if not ref.startswith('#/'):
        raise SchemaError(f'only local references are supported: {ref}')
    node = root
    for part in ref[2:].split('/'):
        node = node[part]
    return node


def _check(v, s, root, path, errors):
    unknown = set(s) - ANNOTATIONS - CHECKS
    if unknown:
        raise SchemaError(f'unsupported keyword(s) {", ".join(sorted(unknown))} at {path or "/"}')
    where = path or '(root)'
    if '$ref' in s:
        _check(v, _resolve(s['$ref'], root), root, path, errors)
    if 'anyOf' in s:
        if not any(not _sub(v, alt, root, path) for alt in s['anyOf']):
            errors.append(f'{where}: matches none of the allowed forms')
    if 'type' in s:
        types = s['type'] if isinstance(s['type'], list) else [s['type']]
        if not any(TYPES[t](v) for t in types):
            errors.append(f'{where}: must be {" or ".join(types)}')
            return
    if 'enum' in s and v not in s['enum']:
        errors.append(f'{where}: must be one of {", ".join(json_str(x) for x in s["enum"])}')
    if 'const' in s and v != s['const']:
        errors.append(f'{where}: must be {json_str(s["const"])}')
    if isinstance(v, str) and 'pattern' in s and not re.search(s['pattern'], v):
        errors.append(f'{where}: "{v}" does not match {s["pattern"]}')
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        if 'minimum' in s and v < s['minimum']:
            errors.append(f'{where}: must be {s["minimum"]} or more')
        if 'maximum' in s and v > s['maximum']:
            errors.append(f'{where}: must be {s["maximum"]} or less')
    if isinstance(v, list):
        if 'minItems' in s and len(v) < s['minItems']:
            errors.append(f'{where}: needs {s["minItems"]} item(s) or more (has {len(v)})')
        if 'maxItems' in s and len(v) > s['maxItems']:
            errors.append(f'{where}: {s["maxItems"]} item(s) at most (has {len(v)})')
        if 'items' in s:
            for i, x in enumerate(v):
                _check(x, s['items'], root, f'{path}[{i}]', errors)
    if isinstance(v, dict):
        props = s.get('properties', {})
        for k in s.get('required', []):
            if k not in v:
                errors.append(f'{where}: needs "{k}"')
        extra = s.get('additionalProperties', True)
        for k, x in v.items():
            sub = f'{path}.{k}' if path else k
            if k in props:
                _check(x, props[k], root, sub, errors)
            elif extra is False:
                errors.append(f'{where}: unknown field "{k}"')
            elif isinstance(extra, dict):
                _check(x, extra, root, sub, errors)


def _sub(v, s, root, path):
    errors = []
    _check(v, s, root, path, errors)
    return errors


def json_str(x):
    return f'"{x}"' if isinstance(x, str) else str(x)
