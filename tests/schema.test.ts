// schemas/book.schema.json is the book format as JSON Schema, for tools and models that do not
// run TypeScript (rule GR-F01, spec/rules.md). It is generated from src/model/types.ts
// (`npm run schema`); these tests fail when it is out of date or when a book does not match it.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Ajv } from 'ajv';
import { createGenerator } from 'ts-json-schema-generator';
import { describe, expect, it } from 'vitest';
import { validateBook } from '../src/model/validate.ts';

const path = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const committed = JSON.parse(readFileSync(path('schemas/book.schema.json'), 'utf8'));
const files = import.meta.glob<unknown>('../src/books/*.json', { eager: true, import: 'default' });
const ajv = new Ajv({ allErrors: true });
const check = ajv.compile(committed);

describe('book JSON Schema', () => {
  it('is up to date with src/model/types.ts (run npm run schema)', () => {
    const fresh = createGenerator({ path: path('src/model/types.ts'), type: 'Book' }).createSchema('Book');
    expect(JSON.parse(JSON.stringify(fresh))).toEqual(committed);
  }, 30_000);

  for (const [file, raw] of Object.entries(files)) {
    it(`accepts ${file.replace(/^.*\//, '')}`, () => {
      const ok = check(raw);
      expect(ok, ajv.errorsText(check.errors, { separator: '\n' })).toBe(true);
    });
  }

  it('rejects what the validator rejects', () => {
    const base = { format: 1, id: 'x', type: 'done', title: 'X', author: 'Y' };
    const bad = [
      { ...base, parts: [{ id: 'p', chapters: [{ id: 'c', number: '1', title: 'One', screens: [{ type: 'highlights', items: [] }] }] }] },
      { ...base, type: 'novel', parts: [] },
      { ...base, style: 'fancy', parts: [] },
      { ...base, format: 2, parts: [] },
      { ...base, parts: [], source: { kind: 'book-file', checks: { recall: { fancy: 0.5 } } } },
      { ...base, parts: [], source: { kind: 'book-file', checks: { unsupported_claims: 'none' } } },
    ];
    for (const b of bad) {
      expect(validateBook(b).errors.length, JSON.stringify(b)).toBeGreaterThan(0);
      expect(check(b), JSON.stringify(b)).toBe(false);
    }
  });
});
