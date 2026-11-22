// Checks book files outside the test runner, for any agent or runner: the format (rule GR-F01)
// and the writing rules of src/model/lint.ts. Every problem has a rule ID from spec/rules.md.
// `npm test` also checks what spans the four files of a guide (GR-F02, GR-F03).
//
//   node scripts/validate-book.mjs src/books/nexus-summary-map.json [more files] [--json]
//
// Text output: one line per problem, "GR-W03 <file> <path>: <message>".
// --json: [{ "file", "clean", "problems": [{ "rule", "path", "message" }] }].
// Exit codes: 0 = clean, 1 = problems found, 2 = cannot run.
// Needs Node 22.18 or later, which runs the TypeScript sources directly.

import { readFileSync } from 'node:fs';
import { validateBook } from '../src/model/validate.ts';
import { lintProblems } from '../src/model/lint.ts';

const args = process.argv.slice(2);
const json = args.includes('--json');
const files = args.filter((a) => a !== '--json');
if (!files.length) {
  console.error('usage: node scripts/validate-book.mjs <book.json>... [--json]');
  process.exit(2);
}

const results = files.map((file) => {
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    return { file, clean: false, problems: [{ rule: 'GR-F01', path: '', message: `cannot read the file as JSON: ${e.message}` }] };
  }
  const { book, errors } = validateBook(raw);
  const problems = errors.map((e) => {
    const m = e.match(/^([\w.[\]]+): (.*)$/);
    return { rule: 'GR-F01', path: m ? m[1] : '', message: m ? m[2] : e };
  });
  if (book) problems.push(...lintProblems(book));
  return { file, clean: problems.length === 0, problems };
});

if (json) {
  console.log(JSON.stringify(results, null, 2));
} else {
  for (const r of results) {
    for (const p of r.problems) console.log(`${p.rule} ${r.file}${p.path ? ` ${p.path}` : ''}: ${p.message}`);
  }
  const n = results.reduce((k, r) => k + r.problems.length, 0);
  console.error(n ? `${n} problem(s)` : 'clean');
}
process.exit(results.every((r) => r.clean) ? 0 : 1);
