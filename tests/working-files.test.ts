// The working files of the model-neutral standard (docs/proposal-model-neutral-guides.md, phase 2):
// every schema in schemas/ is valid, the fixture (fixtures/sample: an original two-chapter story
// written for these tests, not a real book) matches its schemas, and check_guide.py finds each
// kind of problem with its rule ID. The Python checks need python3; without it they are skipped.

import { cpSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Ajv } from 'ajv';
import { describe, expect, it } from 'vitest';
import { validateBook } from '../src/model/validate.ts';
import { lintBook } from '../src/model/lint.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const at = (...p: string[]) => join(root, ...p);
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const SCRIPTS = at('.claude/skills/ghostreader-book/scripts');
const FIXTURE = at('fixtures/sample');
const WORK = join(FIXTURE, 'working');
const BOOKS = join(FIXTURE, 'books');
const python = spawnSync('python3', ['--version']).status === 0;

const schemaNames = readdirSync(at('schemas')).filter((f) => f.endsWith('.schema.json')).map((f) => f.replace('.schema.json', ''));
const schemas = Object.fromEntries(schemaNames.map((n) => [n, json(at('schemas', `${n}.schema.json`))]));

/** Fixture working files and the schema each must match (as check_guide.py's FILES). */
const workingFiles: [string, string][] = [
  ['intake.json', 'intake'], ['plan.json', 'plan'], ['concepts.json', 'concepts'], ['styles.json', 'styles'],
  ['facts/ch1.json', 'facts'], ['facts/ch2.json', 'facts'], ['ledger/ch1.json', 'ledger'], ['ledger/ch2.json', 'ledger'],
  ['verdicts/ch1.json', 'verdict'], ['verdicts/ch2.json', 'verdict'],
  ['recall-test/map-ch2-key.json', 'recall-key'], ['recall-test/map-ch2-answers.json', 'recall-answers'],
  ['recall-test/map-ch2-score.json', 'recall-score'],
];

describe('working-file schemas', () => {
  const ajv = new Ajv({ allErrors: true, strict: true });

  it('has a schema for every working file, and each compiles in strict mode', () => {
    expect(schemaNames.sort()).toEqual(['book', 'concepts', 'facts', 'intake', 'ledger', 'plan', 'recall-answers', 'recall-key', 'recall-score', 'run', 'styles', 'verdict']);
    for (const n of schemaNames) if (n !== 'book') expect(() => ajv.compile(schemas[n]), n).not.toThrow();
  });

  it('uses one anchor definition', () => {
    expect(schemas.ledger.definitions.Anchor).toEqual(schemas.facts.definitions.Anchor);
  });

  for (const [file, name] of workingFiles) {
    it(`fixture ${file} matches ${name}.schema.json`, () => {
      const check = ajv.compile(schemas[name]);
      expect(check(json(join(WORK, file))), ajv.errorsText(check.errors)).toBe(true);
    });
  }
});

describe('fixture guide', () => {
  const check = new Ajv({ allErrors: true }).compile(schemas.book);
  for (const style of ['map', 'recap', 'recall', 'layers']) {
    it(`sample-story-${style} is a valid guide file`, () => {
      const raw = json(join(BOOKS, `sample-story-${style}.json`));
      const { book, errors } = validateBook(raw);
      expect(errors).toEqual([]);
      expect(lintBook(book!)).toEqual([]);
      expect(check(raw)).toBe(true);
    });
  }
});

// ------------------------------------------------------------------ check_guide.py

type Result = { status: number | null; out: { clean: boolean; problems: { rule: string; where: string; message: string }[]; scores?: { score: number } } };

function run(command: string, work = WORK, extra: string[] = []): Result {
  const r = spawnSync('python3', ['-I', join(SCRIPTS, 'check_guide.py'), command, 'sample-story', '--work', work, '--books', BOOKS, '--json', ...extra], { encoding: 'utf8' });
  if (r.status === 2) throw new Error(r.stderr);
  return { status: r.status, out: JSON.parse(r.stdout) };
}

/** A copy of the fixture's working files, changed by `edit`. */
function copy(edit: (dir: string) => void): string {
  const dir = mkdtempSync(join(tmpdir(), 'gr-work-'));
  cpSync(WORK, dir, { recursive: true });
  edit(dir);
  return dir;
}
const change = (dir: string, file: string, f: (o: any) => void) => {
  const o = json(join(dir, file));
  f(o);
  writeFileSync(join(dir, file), JSON.stringify(o));
};
const rules = (r: Result) => r.out.problems.map((p) => p.rule);

describe.skipIf(!python)('check_guide.py on the fixture', () => {
  for (const command of ['schema', 'plan', 'facts', 'names', 'verdicts']) {
    it(`${command} is clean`, () => {
      const r = run(command);
      expect(r.out.problems).toEqual([]);
      expect(r.status).toBe(0);
    });
  }

  it('score adds up the marks: 11.5 of 12', () => {
    const r = run('score', WORK, ['--style', 'map', '--upto', 'ch2']);
    expect(r.status).toBe(0);
    expect(r.out.scores!.score).toBe(0.958);
  });

  it('concepts rebuilds concepts.json and keeps the core marks', () => {
    const dir = copy(() => {});
    expect(run('concepts', dir).status).toBe(0);
    expect(json(join(dir, 'concepts.json'))).toEqual(json(join(WORK, 'concepts.json')));
  });

  it('build_styles.py makes the committed Recap, Recall and Layers files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gr-books-'));
    cpSync(join(BOOKS, 'sample-story-map.json'), join(dir, 'sample-story-map.json'));
    const r = spawnSync('python3', ['-I', join(SCRIPTS, 'build_styles.py'), join(dir, 'sample-story-map.json'), join(WORK, 'styles.json')], { encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    for (const style of ['recap', 'recall', 'layers']) {
      expect(json(join(dir, `sample-story-${style}.json`)), style).toEqual(json(join(BOOKS, `sample-story-${style}.json`)));
    }
  });
});

describe.skipIf(!python)('check_guide.py finds each problem', () => {
  it('GR-A05: a quote that is not in the anchored paragraph', () => {
    const dir = copy((d) => change(d, 'facts/ch1.json', (o) => { o.facts[0].anchor.quote = 'the lamp was blue and very bright'; }));
    expect(rules(run('facts', dir))).toEqual(['GR-A05']);
  });

  it('GR-A02: an anchor past the last paragraph', () => {
    const dir = copy((d) => change(d, 'facts/ch2.json', (o) => { o.facts[1].anchor.p = [30, 30]; }));
    expect(rules(run('facts', dir))).toEqual(['GR-A02']);
  });

  it('GR-A06: a scene without the people in it', () => {
    const dir = copy((d) => change(d, 'facts/ch1.json', (o) => { delete o.facts[0].with; }));
    expect(rules(run('facts', dir))).toEqual(['GR-A06']);
  });

  it('GR-M01: too few must-carry items', () => {
    const dir = copy((d) => change(d, 'facts/ch2.json', (o) => { o.must_carry = o.must_carry.slice(0, 4); }));
    expect(rules(run('facts', dir))).toEqual(['GR-M01']);
  });

  it('GR-M02: must-carry items bunched at the end of the chapter', () => {
    const dir = copy((d) => change(d, 'facts/ch1.json', (o) => {
      for (const m of o.must_carry) m.facts = ['F13'];
    }));
    expect(rules(run('facts', dir))).toContain('GR-M02');
  });

  it('GR-A04: a fiction ledger entry written as non-fiction', () => {
    const dir = copy((d) => change(d, 'ledger/ch1.json', (o) => { o.entries[0] = { status: 'open', text: 'Who stopped the clock?', anchor: o.entries[0].anchor }; }));
    expect(rules(run('facts', dir))).toEqual(['GR-A04']);
  });

  it('GR-A01: a Markdown fact sheet', () => {
    const dir = copy((d) => {
      writeFileSync(join(d, 'facts/ch2.md'), '# 02 · source 002\n');
      spawnSync('rm', [join(d, 'facts/ch2.json')]);
    });
    expect(rules(run('facts', dir))).toContain('GR-A01');
  });

  it('GR-F04: a field the schema does not have', () => {
    const dir = copy((d) => change(d, 'facts/ch1.json', (o) => { o.facts[0].mood = 'tense'; }));
    expect(rules(run('schema', dir))).toEqual(['GR-F04']);
  });

  it('GR-S01: a plan that leaves out a chapter of the book', () => {
    const dir = copy((d) => change(d, 'plan.json', (o) => { o.parts[0].chapters.pop(); }));
    expect(rules(run('plan', dir))).toEqual(expect.arrayContaining(['GR-S01']));
  });

  it('GR-C01 and GR-M03: an unsupported claim and a must-carry item missing in a style', () => {
    const dir = copy((d) => change(d, 'verdicts/ch1.json', (o) => {
      o.claims[0].verdict = 'unsupported';
      o.must_carry[0].layers = 'missing';
    }));
    expect(rules(run('verdicts', dir)).sort()).toEqual(['GR-C01', 'GR-M03']);
  });

  it('GR-M04: answers without a screen score zero', () => {
    const dir = copy((d) => change(d, 'recall-test/map-ch2-answers.json', (o) => {
      for (const a of o.answers.slice(0, 4)) a.screen = null;
    }));
    const r = run('score', dir, ['--style', 'map', '--upto', 'ch2']);
    expect(r.out.scores!.score).toBe(0.625);
    expect(rules(r)).toEqual(['GR-M04', 'GR-M04']);
  });
});

describe.skipIf(!python)('schema_lite.py agrees with Ajv', () => {
  const ajv = new Ajv({ allErrors: true });
  const facts = json(join(WORK, 'facts/ch1.json'));
  const variants: unknown[] = [
    facts,
    { ...facts, chapter: 'Chapter 1' },
    { ...facts, sources: [] },
    { ...facts, facts: [{ ...facts.facts[0], basis: 'guessed' }] },
    { ...facts, facts: [{ ...facts.facts[0], anchor: { file: '1', p: [1, 1], quote: 'x' } }] },
    { ...facts, facts: [{ ...facts.facts[0], anchor: { file: '001', p: [1], quote: 'x y z' } }] },
    { ...facts, must_carry: [{ id: 'M1', kind: 'state', facts: [], text: 't', question: 'q' }] },
    { ...facts, extra: true },
    { chapter: 'ch1' },
  ];

  it('accepts and rejects the same fact sheets', () => {
    const check = ajv.compile(schemas.facts);
    const expected = variants.map((v) => check(v));
    const r = spawnSync('python3', ['-I', '-c', [
      'import json, sys',
      `sys.path.insert(0, ${JSON.stringify(SCRIPTS)})`,
      'from schema_lite import validate',
      'data = json.load(sys.stdin)',
      'print(json.dumps([not validate(v, data["schema"]) for v in data["variants"]]))',
    ].join('\n')], { input: JSON.stringify({ schema: schemas.facts, variants }), encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual(expected);
    expect(expected.filter(Boolean)).toHaveLength(1);
  });

  it('refuses a keyword it does not check', () => {
    const r = spawnSync('python3', ['-I', '-c', [
      'import sys',
      `sys.path.insert(0, ${JSON.stringify(SCRIPTS)})`,
      'from schema_lite import validate, SchemaError',
      'try:\n    validate("x", {"type": "string", "maxLength": 3})\nexcept SchemaError:\n    print("refused")',
    ].join('\n')], { encoding: 'utf8' });
    expect(r.stdout.trim()).toBe('refused');
  });
});

it('keeps the fixture free of real book text: its story is written for the tests', () => {
  expect(json(join(WORK, 'intake.json')).author).toBe('Ghostreader fixtures');
  expect(existsSync(join(WORK, 'source', 'toc.json'))).toBe(true);
});
