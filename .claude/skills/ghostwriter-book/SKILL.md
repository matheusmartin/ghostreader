---
name: ghostwriter-book
description: Writes or updates a book guide for the Ghostwriter app in this repository - one file, src/books/<id>.json, that makes both the swipe screens and the downloadable A4 PDF. Three types, chosen by the user - Story guide (fiction - cast map, scene charts of who is where, story threads), Reading guide (non-fiction, to follow the argument while reading) and Book summary (non-fiction, a finished book). Reads the book from an EPUB, PDF, text, Markdown or HTML file, or from summaries when no file is given. Diagrams first - networks, flows, cycles, timelines - text only where a picture cannot carry the idea. Use when the user asks to add, write, summarise, update or regenerate a book, story guide, reading guide, book summary, infographic or PDF for the app, even if they only name the book. Do not use for a short summary in chat, book recommendations, reviews, or changes to the app's code.
metadata:
  version: "1.1.0"
compatibility: Node 22 with `npm install` done (Vitest; Playwright with Chromium for the screen check and the PDF). Python 3.9+ for the book extractor and maps; PDF books also need poppler-utils (pdftotext) or the pypdf package.
---

# Ghostwriter book

## Overview

A guide is one JSON file, `src/books/<id>.json`. The app shows it as screens (one idea per swipe);
the build prints the same file as an A4 PDF, with the extra detail marked `"only": "pdf"`.

Principles:
- **Book content only.** Everything comes from the book. Nothing from outside it
  (`references/content-rules.md`).
- **Show, then tell.** Each idea gets the diagram that shows its links: who is with whom, what
  causes what, what feeds back. Text carries what a picture cannot (`references/visuals.md`).
- **Every claim is traceable.** Facts come from the extracted text with an anchor (section and
  paragraph), and every chapter is checked against its anchors before it ships.
- **Checked by scripts.** `npm run validate` (format and writing rules), `npm run check:screens`
  (every screen fits a phone), `npm run build` (the PDF).

| Term | Meaning |
|---|---|
| type | `fiction` (Story guide), `reading` (Reading guide) or `done` (Book summary), chosen by the user |
| screen / block | one item of a chapter's `screens`: one swipe in the app, one block in the PDF |
| app screen | a screen without `only`, or with `only: "app"`: must fit a phone screen |
| PDF-only block | `only: "pdf"`: detail for the PDF, with looser limits |
| limit | the "Up to" input: the last chapter covered (`upTo`) |
| anchor | where a fact is in the extracted text: `005 p12` = file 005, paragraph 12 |

## Inputs

**Type** and **title** are required. Never guess the type. If it is missing, or two books match
the title, ask with this block (also when the user asks how to use the skill):

```
Ghostwriter book
Type:     Fiction | Non-fiction reading | Non-fiction done   (required)
Title:    Pride and Prejudice                (required)
Author:   Jane Austen                        (recommended)
Up to:    Chapter 6                          (optional; Fiction and Non-fiction reading only)
Edition:  Penguin Classics, 2003             (optional: shown on the cover)
+ the book file: EPUB, PDF, TXT, MD or HTML  (strongly recommended)
```

- The limit takes a chapter or part name. For a page number or a percentage, ask which chapter.
- A limit with Non-fiction done: say in one line that it does not apply, then continue.
- Highlights or notes: the app holds the book's content only, no personal data. Say so in one
  line and continue without them.
- An existing guide ("update", "regenerate", "add chapters 7–12"): read its file first and keep
  its ids, so links to screens keep working.

## Workflow

Copy this checklist into the task list and tick it off:

```
- [ ] 1 Inputs: type, title, author, limit, edition, book file
- [ ] 2 Read docs/content-format.md, references/guides.md (the type), references/visuals.md,
        references/concepts.md, references/content-rules.md, references/writing-style.md
- [ ] 3 Text: extract the book file into work/<id>/source (or gather summaries)
- [ ] 4 Plan: id, parts, chapters (real titles and word counts), overview chapters, cast and threads
- [ ] 5 Fact sheets: work/<id>/facts/<chapter-id>.md, every fact with its anchor, and the
        concepts and distinctions the chapter introduces (references/concepts.md)
- [ ] 6 Write src/books/<id>.json chapter by chapter: app screens, then PDF-only detail;
        a visual for every distinction, and the K · Key concepts overview
- [ ] 7 Verify every chapter against its anchors and the concept inventory; fix what does not hold
- [ ] 8 Check: npm run validate · npm run check:screens · npm run build, look at the PDF
- [ ] 9 Deliver: commit src/books/<id>.json only; final message
```

**3 · Text.** Put the book file in `work/<id>/` (the folder is in `.gitignore`: book text must
never be committed, the repository is public). Then run, from the repository root:

```bash
python3 -I .claude/skills/ghostwriter-book/scripts/extract_book.py work/<id>/book.epub --out work/<id>/source
```

It writes one numbered text file per section of the book's table of contents, `toc.json` (title,
level, words, kind) and `meta.json`, and prints the list. Read `toc.json` first: check the kinds
(front, part, body, back), merge or skip what is not the author's own text (a later editor's
preface, the licence, illustration lists), and note each chapter's word count for `length`.
PDF without bookmarks: find the heading pattern (`grep -n "CHAPTER" work/<id>/source/*.txt`), then
run again with `--split '^CHAPTER [0-9IVXLC]+'`. A DRM-protected EPUB or a scanned PDF stops with a
message: ask for another copy, or continue from summaries.

No book file: confirm the table of contents (names, order, parts) from a reliable source, then use
chapter-by-chapter summaries for the content, under the stricter rules of
`references/content-rules.md` (Summaries). Set `"source": {"kind": "summaries"}`. Tell the user
in the final message, and for fiction, tell them before you start: summaries miss and misplace
scenes.

**4 · Plan.** Decide before writing:
- **id**: title and type in lower case with hyphens: `pride-and-prejudice-story`, `nexus-reading`,
  `nexus-summary`.
- **Parts and chapters** from `toc.json`: every chapter of the book, in order, with its real
  title (untitled: "Chapter 7"), number and `length` (its word count; all chapters or none). Part
  titles are kickers, not pages. Chapters after the limit are listed without screens.
- **Only the book's own sections.** A prologue, preface, introduction, epilogue, conclusion or
  appendix is in the guide only if the book's contents list has it, under the book's name for it.
  Never add one, and never turn the first chapter into an "Introduction". The overview chapters
  below are the guide's own and always sit in the Overview part, never among the book's parts.
- **Overview chapters** for the type (`references/guides.md`), in a first part labelled
  "Overview". There is no colour field: the whole book uses one colour scheme.
- **Concept inventory** (`references/concepts.md`): every concept the book defines and every
  distinction it draws, directly or indirectly, with the chapter that introduces it.
- Fiction: the cast (who is main, groups), 3–8 thread names, and whether real places matter
  (a map). Non-fiction: the book's own terms, and which diagram fits each chapter.

**5 · Fact sheets.** Read each chapter's text file in full and write
`work/<id>/facts/<chapter-id>.md`: only what the text says, each line with its anchor.

```
# 03 · Chapter 3 · source 005 · 1,722 words
## Scenes (in order; new scene = new place or time)
- S1 {Before the ball} [Longbourn] Mr Bennet will not describe Bingley; the women hear of him from Lady Lucas. With: Mr Bennet, Mrs Bennet, daughters. 005 p2
## People
- Mr Darcy · first appearance · Bingley's friend · admired, then judged proud. 005 p5–p6
## Relations
- Darcy → Elizabeth: will not dance with her; she overhears. 005 p11
## Claims, terms, examples (non-fiction)
## Concepts and distinctions (references/concepts.md)
- {Three kinds of reality} typology · explicit · objective (exists whatever people think: stones) /
  subjective (in one mind: pain) / intersubjective (between many minds: money, nations) · 011 p22–p25
```

**6 · Write.** Work chapter by chapter from the fact sheets, never from memory: first the app
screens of the type's recipe, then the PDF-only blocks. Write each chapter into the book file as
soon as it is done, and run `npm run validate` after every few chapters. For more than 30
chapters, send a short progress note after each part.

**7 · Verify.** For each chapter, check every name, scene, relation, claim and number against its
anchor in the text. Then go through the concept inventory: every concept and distinction must
appear on a screen (a chart for each distinction, in the chapter that introduces it, and a row in
K · Key concepts); add what is missing. If you can start a subagent, give it the chapter's text file and the
chapter's JSON and ask for a claim-by-claim check (fresh eyes find more: research found that
summarisers err most on what characters feel, want or know, on relations, and on the order of
events). Fix or remove each claim that does not hold; never "improve" one from memory.

**8 · Check.** Run, and fix until all are clean:

```bash
npm run validate
```

```bash
npm run check:screens -- <id>
```

```bash
npm run build
```

- `validate`: the format (`src/model/validate.ts`) and the writing rules (`src/model/lint.ts`):
  word and item limits, sentence case, British spelling, Mr without a point, no quotations, no
  spoiler words, scene marks, ring links. Every line names the field to fix.
- `check:screens`: renders every app screen at 360, 390 and 820 px wide. `FIX too full`: shorten
  or split the screen; `FIX chart too small` or `chart overlap`: fewer nodes, rows or links, or
  reorder them (`references/visuals.md`).
- `build`: writes `dist/pdf/<id>.pdf`. Look at it: `pdftoppm -r 60 -png dist/pdf/<id>.pdf
  work/<id>/pdf` and open the images. No Chromium: `npx playwright install chromium`.
- To see the app: `npm run dev`, then `http://localhost:5173/#/read/<id>` (and `#/print/<id>`).

**9 · Deliver.** Commit only `src/books/<id>.json` (and app changes the user asked for); never
`work/`. Then write:
1. One line: the guide, its type, what it covers, how many chapters and screens.
2. Based on the book file (its format) or on summaries; chapters skipped and why; maps.
3. Checks: validate, screen check and PDF results.
4. Sources: "the book file", or the pages used to learn the book's content.

## Rules in short

- Book content only; confirmed details only; when in doubt, leave it out
  (`references/content-rules.md`).
- No quotations from the book: paraphrase. No opinions, ratings or outside facts.
- With a limit: nothing from after it, on any screen, in any name or label.
- The Economist style: sentence case, British -ise spelling, Mr without a point, words for one to
  ten (`references/writing-style.md`).
- Diagrams first: every chapter has at least one chart; at least half of a chapter's app screens
  are charts, scenes or figures (`references/visuals.md`).
- Concepts and distinctions the book introduces are shown, not just named: a chart for each in
  the chapter that introduces it, and every one in K · Key concepts (`references/concepts.md`).
- Tests are welcome but come last: at most one quiz per chapter, after the visuals.
- One idea per app screen, within the limits; more detail goes in PDF-only blocks.
- One colour scheme for the whole book; only the guide's overview chapters and the book's own
  sections, never an invented prologue or introduction.

## Common mistakes

- A concept the book defines, or a contrast it builds across chapters, only mentioned in a text
  block → give it a chart (`references/concepts.md`) and a row in K · Key concepts.
- A "Prologue" or "Introduction" chapter that the book's contents list does not have → remove it.

- Writing from memory or a study guide when the book file is there → write from the fact sheet.
- A wall of points and steps with one chart → find the diagram: who connects to whom, what leads
  to what, what loops back.
- A cast map whose linked nodes sit on opposite sides of the ring → list linked nodes next to
  each other in `nodes`, or link them to the centre.
- Scene text without `{when}` or `[where]`, or a "when · where" heading in front of it → weave
  them into the sentence: "{That night} Maude waits in [the kitchen]." Mark only what the book
  gives: never invent a time or a place to fill a mark.
- A person in a scene's `with` who is only talked about → leave them out, or use `off` only when
  they are there at a distance (letter, phone, overheard).
- The same block in the app and in the PDF twice → an app version `only: "app"` and a fuller
  `only: "pdf"` version.
- Inventing a chapter title, a year, a place or a number → leave it out.
- A thread name or cast role that gives away the ending, or "eventually" with a limit.
- Committing `work/` or quoting the book: the repository and the site are public.

## Reference files

| File | Read when |
|---|---|
| `docs/content-format.md` | step 2: every screen and chart type, with its JSON fields |
| `references/guides.md` | step 2: the type's overview chapters, chapter recipe, PDF detail and limits |
| `references/visuals.md` | steps 4–6: which diagram for which idea; layout rules for each chart |
| `references/concepts.md` | steps 4–7: find, record and show the book's concepts and distinctions |
| `references/content-rules.md` | step 2: book content only, accuracy, spoilers, summaries mode, copyright |
| `references/writing-style.md` | step 6: The Economist style, short form |
| `scripts/extract_book.py` | step 3 (`--help`) |
| `scripts/map.py` | a map of real places (`--help`; data in `assets/geo/`, Natural Earth, public domain) |
| `src/model/lint.ts` | the exact limits the validator applies |
