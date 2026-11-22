// Writes the LLM profile of the schemas: schemas/llm/<name>.llm.json, a strict copy of each schema
// a model writes to (docs/proposal-model-neutral-guides.md, section 5.6). Providers accept
// different parts of JSON Schema for constrained output; the profile keeps the common ground:
//
//   - every object has "additionalProperties": false, and every property is in "required";
//     an optional property becomes {"anyOf": [<its schema>, {"type": "null"}]}, and the runner
//     (tools/gr.py) removes the nulls after the call;
//   - "const" becomes a one-value "enum"; a list of types becomes "anyOf";
//   - no length, number, pattern or item-count keywords: the checks after the call apply them;
//   - "$defs" in place of "definitions", with only the definitions the root uses.
//
// Run by `npm run schema`; tests/llm-profile.test.ts fails when a file is out of date.
//
//   node scripts/llm-profile.mjs           write the files
//   node scripts/llm-profile.mjs --check   exit 1 when a file is out of date

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const load = (name) => JSON.parse(readFileSync(join(root, 'schemas', `${name}.schema.json`), 'utf8'));

/** Profile name → [source schema, definition used as the root (or none)]. */
export const PROFILES = {
  plan: ['plan'],
  facts: ['facts'],
  ledger: ['ledger'],
  verdict: ['verdict'],
  'recall-answers': ['recall-answers'],
  'recall-score': ['recall-score'],
  'styles-chapter': ['styles', 'Chapter'],
  chapter: ['book', 'Chapter'],
};

const DROP = new Set(['$schema', '$id', 'title', 'definitions', 'pattern', 'minLength', 'maxLength', 'minimum', 'maximum',
  'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minItems', 'maxItems', 'format', 'default', 'examples']);

const nullable = (s) => (s.anyOf?.some((b) => b.type === 'null') ? s : { anyOf: [s, { type: 'null' }] });

function strict(node, used) {
  if (Array.isArray(node)) return node.map((n) => strict(n, used));
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node.type)) {
    const { type, description, ...rest } = node;
    const out = { anyOf: type.map((t) => strict({ ...rest, type: t }, used)) };
    return description ? { description, ...out } : out;
  }
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (DROP.has(k) || k === 'properties' || k === 'required' || k === 'additionalProperties') continue;
    if (k === '$ref') {
      const name = v.replace(/^#\/definitions\//, '');
      used.add(name);
      out.$ref = `#/$defs/${name}`;
    } else if (k === 'const') out.enum = [v];
    else if (k === 'items' || k === 'anyOf') out[k] = strict(v, used);
    else out[k] = v;
  }
  if (node.type === 'object' || node.properties) {
    if (node.additionalProperties && typeof node.additionalProperties === 'object') {
      throw new Error('an object whose keys are free (a map) cannot be strict: choose a root without one');
    }
    const required = new Set(node.required ?? []);
    out.properties = {};
    for (const [name, sub] of Object.entries(node.properties ?? {})) {
      const s = strict(sub, used);
      out.properties[name] = required.has(name) ? s : nullable(s);
    }
    out.required = Object.keys(node.properties ?? {});
    out.additionalProperties = false;
  }
  return out;
}

export function profile(name) {
  const [source, def] = PROFILES[name];
  const schema = load(source);
  const defs = schema.definitions ?? {};
  const used = new Set();
  const rootNode = def ? defs[def] : schema;
  const out = { title: `${name} (LLM profile of schemas/${source}.schema.json${def ? `#/definitions/${def}` : ''})`, ...strict(rootNode, used) };
  // Follow the references until no new definition is used.
  const $defs = {};
  for (let added = true; added;) {
    added = false;
    for (const d of [...used]) {
      if (!$defs[d]) {
        $defs[d] = strict(defs[d], used);
        added = true;
      }
    }
  }
  if (Object.keys($defs).length) out.$defs = Object.fromEntries(Object.keys($defs).sort().map((k) => [k, $defs[k]]));
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const check = process.argv.includes('--check');
  const dir = join(root, 'schemas', 'llm');
  mkdirSync(dir, { recursive: true });
  let stale = 0;
  for (const name of Object.keys(PROFILES)) {
    const path = join(dir, `${name}.llm.json`);
    const text = `${JSON.stringify(profile(name), null, 2)}\n`;
    if (check) {
      let old = '';
      try { old = readFileSync(path, 'utf8'); } catch { /* missing */ }
      if (old !== text) { console.error(`out of date: schemas/llm/${name}.llm.json (run npm run schema)`); stale++; }
    } else writeFileSync(path, text);
  }
  if (!check) console.log(`wrote ${Object.keys(PROFILES).length} files in schemas/llm/`);
  process.exit(stale ? 1 : 0);
}
