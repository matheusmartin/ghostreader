// The model-neutral standard (docs/proposal-model-neutral-guides.md): every rule ID a check prints
// is in the rule catalogue, and the skill follows the open Agent Skills format, so agents other
// than Claude Code can find and load it.

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const SKILL = '.claude/skills/ghostreader-book';

describe('rule catalogue (spec/rules.md)', () => {
  const catalogue = read('spec/rules.md');
  const listed = new Set([...catalogue.matchAll(/^\| (GR-[A-Z]\d{2}) \|/gm)].map((m) => m[1]));

  it('lists each rule once', () => {
    const rows = [...catalogue.matchAll(/^\| (GR-[A-Z]\d{2}) \|/gm)].map((m) => m[1]);
    expect(rows.length).toBe(listed.size);
    expect(listed.size).toBeGreaterThan(20);
  });

  for (const file of ['src/model/lint.ts', 'tests/books.test.ts', 'scripts/validate-book.mjs', `${SKILL}/scripts/check_guide.py`]) {
    it(`has every rule ID that ${file} prints`, () => {
      const used = new Set([...read(file).matchAll(/GR-[A-Z]\d{2}/g)].map((m) => m[0]));
      expect(used.size).toBeGreaterThan(0);
      expect([...used].filter((id) => !listed.has(id))).toEqual([]);
    });
  }
});

describe('Agent Skills format (agentskills.io)', () => {
  const text = read(`${SKILL}/SKILL.md`);
  const front = text.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? '';
  const field = (name: string) => front.match(new RegExp(`^${name}: (.*)$`, 'm'))?.[1] ?? '';

  it('has a valid name that matches its folder', () => {
    const name = field('name');
    expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(name.length).toBeLessThanOrEqual(64);
    expect(name).toBe(SKILL.split('/').pop());
  });

  it('keeps description and compatibility within their limits', () => {
    expect(field('description').length).toBeGreaterThan(0);
    expect(field('description').length).toBeLessThanOrEqual(1024);
    expect(field('compatibility').length).toBeLessThanOrEqual(500);
  });

  it('keeps SKILL.md under 500 lines', () => {
    expect(text.split('\n').length).toBeLessThan(500);
  });

  it('is also at the cross-client path .agents/skills/', () => {
    const link = new URL('../.agents/skills/ghostreader-book', import.meta.url);
    expect(existsSync(link)).toBe(true);
    expect(realpathSync(link)).toBe(realpathSync(new URL(`../${SKILL}`, import.meta.url)));
  });
});

describe('agent entry points', () => {
  it('has AGENTS.md, and CLAUDE.md imports it', () => {
    expect(read('AGENTS.md')).toContain(`${SKILL}/SKILL.md`);
    expect(read('CLAUDE.md').trim()).toBe('@AGENTS.md');
  });
});
