// tools/gr.py, the runner for models without tools, against a mock of the OpenAI-compatible chat
// API. The mock answers each step with the sample book's own files (fixtures/sample), so the run
// must rebuild that guide, pass every gate and record every call in run.json. The tests need
// python3; without it they are skipped.

import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const FIX = join(root, 'fixtures/sample');
const json = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const python = spawnSync('python3', ['--version']).status === 0;

type Reply = { status?: number; body?: unknown; content?: unknown };
type Handler = (step: string, chapter: string, mode: 'schema' | 'json', call: number) => Reply;

/** The step a request is for, from the schema name or, in JSON mode, from the prompt's title. */
function stepOf(body: any): [string, string] {
  const text: string = body.messages.map((m: any) => m.content).join('\n');
  const chapter = text.match(/chapter `([a-z0-9-]+)`/)?.[1] ?? text.match(/\[(ch\d+)\]/)?.[1] ?? '';
  const name = body.response_format?.json_schema?.name;
  if (name) return [name, chapter];
  const titles: [RegExp, string][] = [[/^# Write one chapter of the Map file/m, 'chapter'], [/^# Read one chapter/m, 'facts'],
    [/^# Record the state/m, 'ledger'], [/^# Write the style texts/m, 'styles_chapter'], [/^# Check one chapter/m, 'verdict'],
    [/^# Answer from the guide alone/m, 'recall_answers'], [/^# Score the answers/m, 'recall_score'], [/^# Plan the guide/m, 'plan']];
  return [titles.find(([re]) => re.test(text))?.[1] ?? 'unknown', chapter];
}

/** The sample book's file for a step: what a perfect model would write. */
function sample(step: string, chapter: string, text: string): unknown {
  const w = join(FIX, 'working');
  if (step === 'plan') return json(join(w, 'plan.json'));
  if (step === 'facts') return json(join(w, 'facts', `${chapter}.json`));
  if (step === 'ledger') return json(join(w, 'ledger', `${chapter}.json`));
  if (step === 'chapter') return json(join(FIX, 'books/sample-story-map.json')).parts[0].chapters.find((c: any) => c.id === chapter);
  if (step === 'styles_chapter') return json(join(w, 'styles.json')).chapters[chapter];
  if (step === 'verdict') return json(join(w, 'verdicts', `${chapter}.json`));
  // The test's questions: numbered lines for the reader, entries of the key for the scorer.
  const n = step === 'recall_score' ? (text.match(/"must": "M\d+"/g) ?? []).length : (text.match(/^\d+\. \(/gm) ?? []).length;
  if (step === 'recall_answers') return { answers: Array.from({ length: n }, (_, i) => ({ n: i + 1, answer: 'From the guide.', screen: 'ch1.s1' })) };
  if (step === 'recall_score') return { scores: Array.from({ length: n }, (_, i) => ({ n: i + 1, score: 1, reason: 'Matches the key' })) };
  return {};
}

let server: ReturnType<typeof createServer>;
let base = '';
let handler: Handler = () => ({});
const calls: { step: string; chapter: string; mode: string }[] = [];

beforeAll(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const body = JSON.parse(raw || '{}');
      const [step, chapter] = stepOf(body);
      const mode = body.response_format?.type === 'json_schema' ? 'schema' : 'json';
      calls.push({ step, chapter, mode });
      const n = calls.filter((c) => c.step === step && c.chapter === chapter).length;
      const r = handler(step, chapter, mode, n);
      const text = body.messages.map((m: any) => m.content).join('\n');
      const content = r.content ?? sample(step, chapter, text);
      res.writeHead(r.status ?? 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(r.body ?? {
        model: 'mock-1', usage: { prompt_tokens: 100, completion_tokens: 50 },
        choices: [{ message: { role: 'assistant', content: typeof content === 'string' ? content : JSON.stringify(content) } }],
      }));
    });
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', () => ok()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});
afterAll(() => { server.close(); });

/** A fresh work folder with the sample book's text and intake, and a config for the mock. */
function setup(extra: string[] = ['source', 'intake.json']) {
  calls.length = 0;
  const dir = mkdtempSync(join(tmpdir(), 'gr-run-'));
  for (const f of extra) cpSync(join(FIX, 'working', f), join(dir, 'work', f), { recursive: true });
  const config = join(dir, 'gr.json');
  const role = { provider: 'mock', model: 'mock-1' };
  writeFileSync(config, JSON.stringify({ providers: { mock: { base_url: base, key_env: null, family: 'mock' } },
    roles: { writer: role, judge: role, reader: role, scorer: role }, repairs: 2, retries: 0, timeout: 30 }));
  return { work: join(dir, 'work'), books: join(dir, 'books'), config };
}

function gr(args: string[], s: ReturnType<typeof setup>): Promise<{ code: number; err: string }> {
  return new Promise((done) => {
    const p = spawn('python3', ['-I', join(root, 'tools/gr.py'), ...args, '--guide', 'sample-story', '--work', s.work, '--books', s.books, '--config', s.config]);
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => done({ code: code ?? -1, err }));
  });
}

describe.skipIf(!python)('tools/gr.py with a mock model', () => {
  it('writes and checks the sample guide: every gate passes, every call is in run.json', async () => {
    handler = () => ({});
    const s = setup();
    const w = await gr(['write'], s);
    expect(w.code, w.err).toBe(0);
    const c = await gr(['check'], s);
    expect(c.code, c.err).toBe(0);
    const map = json(join(s.books, 'sample-story-map.json'));
    const want = json(join(FIX, 'books/sample-story-map.json'));
    expect(map.parts).toEqual(want.parts);
    expect(map.source.spec).toBe('1.0.0');
    for (const style of ['recap', 'recall', 'layers']) {
      expect(json(join(s.books, `sample-story-${style}.json`)).parts, style).toEqual(json(join(FIX, `books/sample-story-${style}.json`)).parts);
    }
    const run = json(join(s.work, 'run.json'));
    const steps = run.stages.map((x: any) => `${x.stage} ${x.chapter ?? ''} ${x.style ?? ''}`.trim());
    expect(steps.slice(0, 9)).toEqual(['plan', 'read ch1', 'ledger ch1', 'read ch2', 'ledger ch2', 'write-map ch1', 'write-map ch2', 'write-styles ch1', 'write-styles ch2']);
    expect(steps).toContain('verify ch2');
    expect(steps).toContain('recall-scorer ch2 layers');
    expect(run.stages.every((x: any) => x.gate === 'pass' && x.model.family === 'mock')).toBe(true);
    expect(json(join(s.work, 'checks.json'))).toEqual({ recall: { map: 1, recap: 1, recall: 1, layers: 1 }, unsupported_claims: 0, judge_independent: false });
    const schemaCheck = spawnSync('python3', ['-I', join(root, '.claude/skills/ghostreader-book/scripts/check_guide.py'), 'schema', 'sample-story', '--work', s.work, '--books', s.books], { encoding: 'utf8' });
    expect(schemaCheck.status, schemaCheck.stdout).toBe(0);
  }, 120_000);

  it('falls back to JSON mode when the provider refuses a schema', async () => {
    handler = (step, _c, mode) => (step === 'chapter' && mode === 'schema'
      ? { status: 400, body: [{ error: { code: 400, message: 'The specified schema produces a constraint that has too many states' } }] } : {});
    const s = setup(['source', 'intake.json', 'plan.json', 'facts', 'ledger', 'concepts.json']);
    const r = await gr(['stage', 'write-map', '--chapter', 'ch1'], s);
    expect(r.code, r.err).toBe(0);
    const last = json(join(s.work, 'run.json')).stages.at(-1);
    expect([last.mode, last.attempts, last.gate]).toEqual(['json', 1, 'pass']);
  }, 60_000);

  it('sends the gate problems back, and records the repair', async () => {
    handler = (step, chapter, _m, n) => {
      if (step !== 'facts' || n > 1) return {};
      const bad = json(join(FIX, 'working/facts', `${chapter}.json`));
      bad.facts[0].anchor.quote = 'words that are not in the book';
      bad.facts[1].off = null;  // an optional field left empty: the runner removes it
      return { content: bad };
    };
    const s = setup(['source', 'intake.json', 'plan.json']);
    const r = await gr(['stage', 'read', '--chapter', 'ch1'], s);
    expect(r.code, r.err).toBe(0);
    const last = json(join(s.work, 'run.json')).stages.at(-1);
    expect([last.attempts, last.gate, last.tokens]).toEqual([2, 'pass', { prompt: 200, completion: 100 }]);
    expect(json(join(s.work, 'facts/ch1.json'))).toEqual(json(join(FIX, 'working/facts/ch1.json')));
  }, 60_000);

  it('repairs a saved output that a new check rejects', async () => {
    handler = () => ({});  // the mock answers with the sample's plan, whose question is short
    const s = setup(['source', 'intake.json', 'plan.json']);
    const plan = json(join(s.work, 'plan.json'));
    plan.question = 'Who stopped the lighthouse clock at Kessel, and why did they do it in the night?';
    writeFileSync(join(s.work, 'plan.json'), JSON.stringify(plan));
    const r = await gr(['repair', 'plan'], s);
    expect(r.code, r.err).toBe(0);
    expect(json(join(s.work, 'plan.json')).question).toBe(json(join(FIX, 'working/plan.json')).question);
    const last = json(join(s.work, 'run.json')).stages.at(-1);
    expect([last.stage, last.attempts, last.gate]).toEqual(['plan', 1, 'pass']);
    const again = await gr(['repair', 'plan'], s);
    expect(again.err).toContain('nothing to repair');
  }, 60_000);

  it('fails the step when the repairs do not help', async () => {
    handler = (step) => (step === 'facts' ? { content: { chapter: 'ch1' } } : {});
    const s = setup(['source', 'intake.json', 'plan.json']);
    const r = await gr(['stage', 'read', '--chapter', 'ch1'], s);
    expect(r.code).toBe(1);
    const last = json(join(s.work, 'run.json')).stages.at(-1);
    expect([last.attempts, last.gate]).toEqual([3, 'fail']);
    expect(last.problems.join('\n')).toContain('GR-F04');
  }, 60_000);

  it('stops at once when the daily quota is used up', async () => {
    handler = () => ({ status: 429, body: [{ error: { code: 429, message: 'Quota exceeded for metric: free_tier_requests, limit: 20, model: mock-1, description: Generate content requests per day limit exceeded. Please retry in 13h12m6.8s.' } }] });
    const s = setup(['source', 'intake.json', 'plan.json']);
    const r = await gr(['stage', 'read', '--chapter', 'ch1'], s);
    expect(r.code).toBe(2);
    expect(r.err).toContain('daily quota is used up; it resets in 13h12m6.8s');
  }, 60_000);

  it('stops at once when the key has no quota for the model', async () => {
    handler = () => ({ status: 429, body: [{ error: { code: 429, message: 'Quota exceeded for metric: requests, limit: 0, model: mock-1' } }] });
    const s = setup(['source', 'intake.json', 'plan.json']);
    const r = await gr(['stage', 'read', '--chapter', 'ch1'], s);
    expect(r.code).toBe(2);
    expect(r.err).toContain('no quota');
  }, 60_000);
});

describe.skipIf(!python)('the runner and the prompts', () => {
  it('fills in every input each prompt names, for every step', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gr-in-'));
    cpSync(join(FIX, 'working'), join(dir, 'work'), { recursive: true });
    const r = spawnSync('python3', ['-I', '-c', [
      'import json, sys',
      `sys.path.insert(0, ${JSON.stringify(join(root, 'tools'))})`,
      'import gr',
      `g = gr.Guide('sample-story', ${JSON.stringify(join(dir, 'work'))}, ${JSON.stringify(join(FIX, 'books'))})`,
      'out = {}',
      'for step, (prompt, *_rest) in gr.STEPS.items():',
      '    head, _ = gr.parse_prompt(gr.REPO / "prompts" / prompt)',
      '    values = gr.inputs(step, g, "ch2", "map")',
      '    out[step] = [k for k in head["inputs"] if not str(values.get(k, "")).strip()]',
      'print(json.dumps(out))',
    ].join('\n')], { encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    const empty = JSON.parse(r.stdout);
    for (const step of Object.keys(empty)) expect(empty[step], step).toEqual([]);
  });
});

describe.skipIf(!python)('strip_nulls', () => {
  it('removes the nulls of empty optional fields and keeps the nulls a schema allows', () => {
    const facts = json(join(FIX, 'working/facts/ch1.json'));
    const ledger = json(join(FIX, 'working/ledger/ch1.json'));
    const chapter = json(join(FIX, 'books/sample-story-map.json')).parts[0].chapters[0];
    const withNulls = {
      facts: { ...facts, words: facts.words, facts: facts.facts.map((f: any) => ({ who: null, to: null, off: null, concept: null, ...f })) },
      ledger: { ...ledger, entries: ledger.entries.map((e: any) => ({ entity: null, about: null, cause: null, status: null, text: null, ...e })) },
      chapter: { ...chapter, opener: null, sections: null, screens: chapter.screens.map((s: any) => ({ only: null, ...s })) },
    };
    const r = spawnSync('python3', ['-I', '-c', [
      'import json, sys',
      `sys.path.insert(0, ${JSON.stringify(join(root, 'tools'))})`,
      'import gr',
      'd = json.load(sys.stdin)',
      'out = {}',
      'for name, (store, definition) in {"facts": ("facts", None), "ledger": ("ledger", None), "chapter": ("book", "Chapter")}.items():',
      '    s = gr.storage(store, definition)',
      '    out[name] = gr.strip_nulls(d[name], s, s)',
      'print(json.dumps(out))',
    ].join('\n')], { input: JSON.stringify(withNulls), encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.facts).toEqual(facts);
    expect(out.ledger).toEqual(ledger);
    expect(out.ledger.entries.some((e: any) => e.before === null)).toBe(true);
    expect(out.chapter).toEqual(chapter);
  });
});
