// The stage prompts (prompts/*.md): each header names real inputs, a real schema, real reference
// files and a real check, and each "Right" example is exactly what the fixture holds, so the
// examples a model learns from pass every check.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const SKILL = join(root, '.claude/skills/ghostreader-book');
const files = readdirSync(join(root, 'prompts')).filter((f) => f.endsWith('.md') && f !== 'README.md');

type Header = Record<string, unknown>;

/** The small YAML subset the headers use: "key: value", nested maps by two spaces, "- item" lists, "[]". */
function header(text: string): Header {
  const body = text.match(/^---\n([\s\S]*?)\n---\n/)?.[1];
  if (!body) throw new Error('no header');
  const out: Header = {};
  let key = '';
  for (const line of body.split('\n')) {
    const top = line.match(/^(\w+):\s*(.*)$/);
    if (top) {
      key = top[1];
      out[key] = top[2] === '[]' ? [] : top[2] || undefined;
      continue;
    }
    const item = line.match(/^ {2}- (.*)$/);
    if (item) {
      out[key] = [...((out[key] as string[]) ?? []), item[1]];
      continue;
    }
    const sub = line.match(/^ {2}(\w+):\s*(.*)$/);
    if (sub) out[key] = { ...((out[key] as Record<string, string>) ?? {}), [sub[1]]: sub[2] };
  }
  return out;
}

/** True when `part` is inside `whole`: every field of an object equal, lists equal, at any depth. */
function inside(part: unknown, whole: unknown): boolean {
  const sub = (a: unknown, b: unknown): boolean => {
    if (a && typeof a === 'object' && !Array.isArray(a)) {
      return !!b && typeof b === 'object' && !Array.isArray(b)
        && Object.entries(a).every(([k, v]) => sub(v, (b as Record<string, unknown>)[k]));
    }
    return JSON.stringify(a) === JSON.stringify(b);
  };
  if (sub(part, whole)) return true;
  if (whole && typeof whole === 'object') return Object.values(whole).some((v) => inside(part, v));
  return false;
}

it('has a prompt for every model stage', () => {
  expect(files.sort()).toEqual(['ledger.md', 'plan.md', 'read-chapter.md', 'recall-reader.md', 'recall-scorer.md', 'verify.md', 'write-map.md', 'write-styles.md']);
});

for (const file of files) {
  describe(`prompts/${file}`, () => {
    const text = readFileSync(join(root, 'prompts', file), 'utf8');
    const h = header(text);

    it('has a complete header', () => {
      for (const k of ['stage', 'version', 'role', 'isolation', 'inputs', 'include', 'output', 'check']) expect(h[k], k).toBeDefined();
      expect(h.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(['writer', 'judge', 'reader', 'scorer']).toContain(h.role);
      expect(['required', 'none']).toContain(h.isolation);
      if (h.role !== 'writer') expect(h.isolation, 'judges, readers and scorers run isolated').toBe('required');
    });

    it('uses every input it lists, and lists every input it uses', () => {
      const inputs = Object.keys(h.inputs as Record<string, string>);
      const used = [...text.slice(text.indexOf('\n---\n', 4)).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
      const known = new Set([...inputs, 'guide', 'chapter', 'style']);
      for (const name of inputs) expect(used, `{{${name}}} in the text`).toContain(name);
      for (const name of used) expect(known.has(name), `{{${name}}} in the header`).toBe(true);
    });

    it('names a schema, reference files and a check that exist', () => {
      const [schemaFile, fragment] = (h.output as Record<string, string>).schema.split('#');
      const schema = JSON.parse(readFileSync(join(root, schemaFile), 'utf8'));
      if (fragment) expect(fragment.split('/').filter(Boolean).reduce((n: any, k) => n?.[k], schema), fragment).toBeDefined();
      for (const ref of h.include as string[]) expect(existsSync(join(SKILL, ref)), ref).toBe(true);
      const script = (h.check as string).split(' ').find((w) => /\.(py|mjs)$/.test(w))!;
      expect(existsSync(join(root, script)), script).toBe(true);
    });

    it('gives a right and a wrong example, and the right one is what the fixture holds', () => {
      const right = text.match(/Right(?: \(from `([^`]+)`[^)]*\))?:\n\n```json\n([\s\S]*?)\n```/);
      expect(right, 'a "Right" example').toBeTruthy();
      expect(text).toMatch(/Wrong:\n\n```json\n/);
      const example = JSON.parse(right![2]);
      if (right![1]) expect(inside(example, JSON.parse(readFileSync(join(root, right![1]), 'utf8')))).toBe(true);
    });
  });
}
