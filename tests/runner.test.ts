// tools/gr.py: any AI model, or a person, does one step by hand. `prompt` prints the step's
// prompt with its inputs and the reply's schema; `save` checks the reply, saves it and records
// it. The tests need python3; without it they are skipped.

import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const FIX = join(root, 'fixtures/sample');
const json = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const python = spawnSync('python3', ['--version']).status === 0;

function work(files: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'gr-'));
  for (const f of files) cpSync(join(FIX, 'working', f), join(dir, 'work', f), { recursive: true });
  return { work: join(dir, 'work'), books: join(dir, 'books'), dir };
}
const gr = (args: string[], w: { work: string; books: string }) =>
  spawnSync('python3', ['-I', join(root, 'tools/gr.py'), ...args, '--guide', 'sample-story', '--work', w.work, '--books', w.books], { encoding: 'utf8' });

describe.skipIf(!python)('tools/gr.py', () => {
  it('prints every step\'s prompt with its inputs and the reply schema', () => {
    const w = work(['source', 'intake.json', 'plan.json', 'facts', 'ledger', 'concepts.json', 'styles.json', 'verdicts', 'recall-test']);
    cpSync(join(FIX, 'books'), w.books, { recursive: true });
    for (const [step, extra] of [['plan', []], ['read', ['--chapter', 'ch2']], ['ledger', ['--chapter', 'ch2']], ['write-map', ['--chapter', 'ch2']],
      ['write-styles', ['--chapter', 'ch2']], ['verify', ['--chapter', 'ch2']], ['recall-reader', ['--chapter', 'ch2', '--style', 'map']],
      ['recall-scorer', ['--chapter', 'ch2', '--style', 'map']]] as [string, string[]][]) {
      const r = gr(['prompt', step, ...extra], w);
      expect(r.status, `${step}: ${r.stderr}`).toBe(0);
      expect(r.stdout, step).not.toMatch(/\{\{\w+\}\}/);
      expect(r.stdout, step).toContain('# The JSON Schema of your reply');
    }
  });

  it('saves a reply that passes, and records a failed attempt and its fix as one entry', () => {
    const w = work(['source', 'intake.json', 'plan.json']);
    const bad = json(join(FIX, 'working/facts/ch1.json'));
    bad.facts[0].anchor.quote = 'words that are not in the book';
    bad.facts[1].off = null; // an optional field left empty: removed before the checks
    writeFileSync(join(w.dir, 'bad.json'), JSON.stringify(bad));
    const fail = gr(['save', 'read', '--chapter', 'ch1', '--reply', join(w.dir, 'bad.json'), '--family', 'gemini', '--model', 'any'], w);
    expect(fail.status).toBe(1);
    expect(fail.stdout).toContain('GR-A05');
    const ok = gr(['save', 'read', '--chapter', 'ch1', '--reply', join(FIX, 'working/facts/ch1.json'), '--family', 'gemini', '--model', 'any'], w);
    expect(ok.status, ok.stdout).toBe(0);
    expect(json(join(w.work, 'facts/ch1.json'))).toEqual(json(join(FIX, 'working/facts/ch1.json')));
    const runs = json(join(w.work, 'run.json')).stages;
    expect(runs.map((s: any) => [s.stage, s.attempts, s.gate, s.model.family])).toEqual([['read', 2, 'pass', 'gemini']]);
  });

  it('will not print a scorer prompt without the reader\'s answers', () => {
    const w = work(['source', 'intake.json', 'plan.json', 'facts', 'ledger']);
    cpSync(join(FIX, 'books'), w.books, { recursive: true });
    spawnSync('python3', ['-I', join(root, '.claude/skills/ghostreader-book/scripts/check_guide.py'), 'test', 'sample-story', '--style', 'map', '--upto', 'ch2', '--work', w.work, '--books', w.books]);
    const r = gr(['prompt', 'recall-scorer', '--chapter', 'ch2', '--style', 'map'], w);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("the scorer needs the key and the reader's answers");
  });

  it('removes the nulls of empty optional fields and keeps the nulls a schema allows', () => {
    const ledger = json(join(FIX, 'working/ledger/ch1.json'));
    const chapter = json(join(FIX, 'books/sample-story-map.json')).parts[0].chapters[0];
    const withNulls = {
      ledger: { ...ledger, entries: ledger.entries.map((e: any) => ({ entity: null, about: null, cause: null, status: null, text: null, ...e })) },
      chapter: { ...chapter, opener: null, sections: null, screens: chapter.screens.map((s: any) => ({ only: null, ...s })) },
    };
    const r = spawnSync('python3', ['-I', '-c', [
      'import json, sys', `sys.path.insert(0, ${JSON.stringify(join(root, 'tools'))})`, 'import gr', 'd = json.load(sys.stdin)',
      'out = {n: gr.strip_nulls(d[n], gr.storage(s, x), gr.storage(s, x)) for n, (s, x) in {"ledger": ("ledger", None), "chapter": ("book", "Chapter")}.items()}',
      'print(json.dumps(out))'].join('\n')], { input: JSON.stringify(withNulls), encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.ledger).toEqual(ledger);
    expect(out.ledger.entries.some((e: any) => e.before === null)).toBe(true);
    expect(out.chapter).toEqual(chapter);
  });
});
