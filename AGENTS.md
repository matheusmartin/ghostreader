# Ghostreader: instructions for coding agents

This file is for any coding agent (Claude Code, Codex, Copilot, Cursor, Gemini CLI and others).
Claude Code reads it through `CLAUDE.md`.

## The repository

A progressive web app that shows book guides as swipe screens and as A4 PDFs. A guide is four
JSON files in `src/books/`, one per style: `<guide>-map.json`, `-recap.json`, `-recall.json`,
`-layers.json`. The format is `src/model/types.ts`, as JSON Schema in `schemas/book.schema.json`,
explained in `docs/content-format.md`.

## Commands

Node 22.18 or later. Python 3.9 or later for the book scripts.

| Command | Does |
|---|---|
| `npm install` | Install the dependencies |
| `npm test` | All unit tests, including the content checks of every book |
| `npm run validate` | Check every book file: format and writing rules. Each line starts with a rule ID (`spec/rules.md`) |
| `node scripts/validate-book.mjs <file>... [--json]` | The same checks for any book file, as text or JSON |
| `npm run schema` | Write `schemas/book.schema.json` again after a change to `src/model/types.ts` |
| `npm run check:screens` | Render every screen at three widths; report screens that do not fit (needs Chromium) |
| `npm run build` | Type check, build the app and one PDF per book (needs Chromium) |

## Add or change a book guide

Follow the skill `.claude/skills/ghostreader-book/SKILL.md` (also at
`.agents/skills/ghostreader-book/`). It is in the open Agent Skills format. Read it in full
before you start. Its `references/` files are the rules; its `scripts/` are the checks.

- Every step writes JSON working files in `work/<guide>/`, one schema each in `schemas/`
  (`references/working-files.md`).
- `prompts/` has one prompt per model step: inputs, output schema, check, and a right and a
  wrong example. `fixtures/sample/` is a complete example that passes every check.
- The user gives the book file (EPUB, PDF, TXT, Markdown or HTML). Ask for it if it is missing.
- Write from the extracted text and the fact sheets, never from memory.
- An **isolated run** is a new model context that gets only the files a step lists, and nothing
  from the writer's context. The verify and recall steps need isolated runs. Use a sub-agent,
  a separate model call or another model, whichever your tool has. Use a judge from another
  model family when you can.
- Keep the step checklist in `work/<guide>/progress.md` and tick it off.

## Rules that protect the repository

- The repository and the site are public. Never commit `work/` (the book file, its text, the
  working files). Never paste book text into a book file, a commit message or a pull request.
- Guides never quote the book: paraphrase.
- Commit only the four `src/books/<guide>-*.json` files of a guide, and app changes the user
  asked for.

## The standard

`docs/proposal-model-neutral-guides.md` describes the model-neutral standard for this process
and the plan to reach it.
