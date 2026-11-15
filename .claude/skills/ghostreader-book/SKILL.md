---
name: ghostreader-book
description: Writes or updates a book guide for the Ghostreader app in this repository - four files, one per style (Map, Recap, Recall, Layers), src/books/<guide>-<style>.json, each making both the swipe screens and a downloadable A4 PDF; the library shows them as one tile with a style choice. The guide holds only the book's own parts and chapters, in the book's order - no overview, key concepts or other guide-made chapter. Three types, chosen by the user - Story guide (fiction - scene charts of who is where, who is who, relations), Reading guide (non-fiction, to follow the argument while reading) and Book summary (non-fiction, a finished book). Reads the book from an EPUB, PDF, text, Markdown or HTML file, or from summaries when no file is given. Diagrams first - networks, flows, cycles, timelines - text only where a picture cannot carry the idea. Use when the user asks to add, write, summarise, update or regenerate a book, story guide, reading guide, book summary, infographic or PDF for the app, even if they only name the book. Do not use for a short summary in chat, book recommendations, reviews, or changes to the app's code.
metadata:
  version: "1.4.0"
compatibility: Node 22 with `npm install` done (Vitest; Playwright with Chromium for the screen check and the PDF). Python 3.9+ for the book extractor and maps; PDF books also need poppler-utils (pdftotext) or the pypdf package.
---

# Ghostreader book

## Overview

A guide is four JSON files, one per style: `src/books/<guide>-map.json`, `-recap.json`,
`-recall.json` and `-layers.json` (`references/styles.md`). Every guide is always written in all
four; the library shows them as one tile with a style choice. The app shows each file as screens
(one idea per swipe); the build prints each as an A4 PDF, with the extra detail marked
`"only": "pdf"`.

Principles:
- **Book content only.** Everything comes from the book. Nothing from outside it
  (`references/content-rules.md`).
- **The book's structure only.** The guide's contents list is the book's contents list: the same
  parts and chapters, in the same order, under the book's names. The guide adds no chapter, part,
  section or label of its own: no overview, key concepts, who's who, story threads, map, "the book
  in one page" or "where you stopped" chapter. Each chapter's screens summarise that chapter.
- **Show, then tell.** Each idea gets the diagram that shows its links: who is with whom, what
  causes what, what feeds back. Text carries what a picture cannot (`references/visuals.md`).
- **Every claim is traceable.** Facts come from the extracted text with an anchor (section and
  paragraph), and every chapter is checked against its anchors before it ships.
- **Checked by scripts.** `npm run validate` (format and writing rules), `npm run check:screens`
  (every screen fits a phone), `npm run build` (the PDF).

| Term | Meaning |
|---|---|
| type | `fiction` (Story guide), `reading` (Reading guide) or `done` (Book summary), chosen by the user |
| style | how a file summarises: `map`, `recap`, `recall` or `layers`. Every guide has all four (`references/styles.md`) |
| guide | the id the four files share; each file's id is `<guide>-<style>` |
| screen / block | one item of a chapter's `screens`: one swipe in the app, one block in the PDF |
| app screen | a screen without `only`, or with `only: "app"`: must fit a phone screen |
| PDF-only block | `only: "pdf"`: detail for the PDF, with looser limits |
| limit | the "Up to" input: the last chapter covered (`upTo`) |
| anchor | where a fact is in the extracted text: `005 p12` = file 005, paragraph 12 |

## Inputs

**Type** and **title** are required. Never guess the type. If it is missing, or two books match
the title, ask with this block (also when the user asks how to use the skill):

```
Ghostreader book
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
- [ ] 1 Inputs: type, title, author, limit, edition, book file (all four styles, always)
- [ ] 2 Read docs/content-format.md, references/guides.md (the type), references/styles.md (the
        style), references/visuals.md, references/concepts.md, references/content-rules.md, references/writing-style.md
- [ ] 3 Text: extract the book file into work/<id>/source (or gather summaries)
- [ ] 4 Plan: id, the book's own parts and chapters (real titles and word counts), concept
        inventory; fiction: the cast
- [ ] 5 Fact sheets: work/<id>/facts/<chapter-id>.md, every fact with its anchor, and the
        concepts and distinctions the chapter introduces (references/concepts.md)
- [ ] 6 Write the Map file src/books/<guide>-map.json chapter by chapter: app screens, then
        PDF-only detail; a visual for every distinction, in the chapter that introduces it
- [ ] 6b Write work/<guide>/styles.json and run scripts/build_styles.py: the Recap, Recall and
        Layers files (references/styles.md)
- [ ] 7 Verify every chapter against its anchors and the concept inventory; fix what does not hold
- [ ] 8 Check: npm run validate · npm run check:screens · npm run build, look at the PDF
- [ ] 9 Deliver: commit the four src/books/<guide>-*.json files only; final message
```

**3 · Text.** Put the book file in `work/<id>/` (the folder is in `.gitignore`: book text must
never be committed, the repository is public). Then run, from the repository root:

```bash
python3 -I .claude/skills/ghostreader-book/scripts/extract_book.py work/<id>/book.epub --out work/<id>/source
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
- **guide id**: title and type in lower case with hyphens: `pride-and-prejudice-story`,
  `nexus-reading`, `nexus-summary`. The four files are `<guide>-map.json`, `<guide>-recap.json`,
  `<guide>-recall.json` and `<guide>-layers.json`, each with `"guide"` and `"style"`.
- **Parts and chapters** from `toc.json`: every chapter of the book, in order, with its real
  title (untitled: "Chapter 7"), number and `length` (its word count; all chapters or none). Part
  titles are kickers, not pages. Chapters after the limit are listed without screens.
- **Only the book's own parts, chapters and sections.** A prologue, preface, introduction,
  epilogue, conclusion or appendix is in the guide only if the book's contents list has it, under
  the book's name for it. Never add one, never turn the first chapter into an "Introduction", and
  never add a chapter of the guide's own (overview, key concepts, who's who, story threads, map,
  the book in one page, where you stopped).
- **Part labels from the book.** Use the book's own part labels and titles ("Part I", "Human
  Networks"). A prologue or epilogue outside the book's parts goes in a part with no `label` and
  no `title` (the app shows the book's title as its kicker). Never invent a label such as
  "Overview", "Opening" or "Closing". There is no colour field: the whole book uses one colour
  scheme.
- **Concept inventory** (`references/concepts.md`): every concept the book defines and every
  distinction it draws, directly or indirectly, with the chapter that introduces it.
- Fiction: the cast (who is main, groups), and whether real places matter (a map in the
  chapters where the story moves between them). Non-fiction: the book's own terms, and which
  diagram fits each chapter.

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
screens of the type's recipe, then the PDF-only blocks. Write each chapter into the Map file as
soon as it is done, and run `npm run validate` after every few chapters. For more than 30
chapters, send a short progress note after each part.

**6b · The other styles.** From the same fact sheets, write `work/<guide>/styles.json`: per chapter
one line, the point it adds, a recap, key moments, the concepts to remember, three questions, and
"before this chapter". The format is in `references/styles.md`. Then build the three files:

```bash
python3 -I .claude/skills/ghostreader-book/scripts/build_styles.py src/books/<guide>-map.json work/<guide>/styles.json
```

The script copies diagrams, key points, logic and PDF detail from the Map file, so fix those in
the Map file and run it again; never edit the generated files by hand.

**7 · Verify.** For each chapter, check every name, scene, relation, claim and number against its
anchor in the text. Then go through the concept inventory: every concept and distinction must
appear on a screen of the chapter that introduces it (a chart for each distinction; a chart, a key
point or a row in the PDF-only "Terms" list for each concept); add what is missing. Last, compare
the guide's contents with the book's contents list: remove any chapter, part or label the book
does not have. If you can start a subagent, give it the chapter's text file and the
chapter's JSON and ask for a claim-by-claim check (fresh eyes find more: research found that
summarisers err most on what characters feel, want or know, on relations, and on the order of
events). Fix or remove each claim that does not hold; never "improve" one from memory.

**8 · Check.** Run, and fix until all are clean:

```bash
npm run validate
```

```bash
npm run check:screens -- <guide>-map <guide>-recap <guide>-recall <guide>-layers
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

**9 · Deliver.** Commit only the four `src/books/<guide>-*.json` files (and app changes the user
asked for); never `work/`. Then write:
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
  the chapter that introduces it (`references/concepts.md`).
- Tests are welcome but come last: at most one quiz per chapter, after the visuals.
- One idea per app screen, within the limits; more detail goes in PDF-only blocks.
- One colour scheme for the whole book. Only the book's own parts, chapters and sections: no
  overview or key concepts chapter, no invented prologue, introduction or part label.

## Common mistakes

- Writing only one style → every guide has all four files; the library shows one tile per guide.

- A concept the book defines, or a contrast it builds across chapters, only mentioned in a text
  block → give it a chart in the chapter that introduces it (`references/concepts.md`).
- A chapter, part or label the book's contents list does not have ("Key concepts", "The book in
  one page", "Who's who", "Warm-up", "Overview", "Opening", an invented "Prologue" or
  "Introduction") → remove it. The guide's contents are the book's contents; `npm run validate`
  reports the old overview chapter numbers (S, B, K, W, T, M).

- Writing from memory or a study guide when the book file is there → write from the fact sheet.
- A wall of points and steps with one chart → find the diagram: who connects to whom, what leads
  to what, what loops back.
- A relations network whose linked nodes sit on opposite sides of the ring → list linked nodes next to
  each other in `nodes`, or link them to the centre.
- Scene text without `{when}` or `[where]`, or a "when · where" heading in front of it → weave
  them into the sentence: "{That night} Maude waits in [the kitchen]." Mark only what the book
  gives: never invent a time or a place to fill a mark.
- A person in a scene's `with` who is only talked about → leave them out, or use `off` only when
  they are there at a distance (letter, phone, overheard).
- The same block in the app and in the PDF twice → an app version `only: "app"` and a fuller
  `only: "pdf"` version.
- Inventing a chapter title, a year, a place or a number → leave it out.
- A cast role or relation label that gives away the ending, or "eventually" with a limit.
- Committing `work/` or quoting the book: the repository and the site are public.

## Reference files

| File | Read when |
|---|---|
| `docs/content-format.md` | step 2: every screen and chart type, with its JSON fields |
| `references/guides.md` | step 2: the frame, the type's chapter recipe, PDF detail and limits |
| `references/visuals.md` | steps 4–6: which diagram for which idea; layout rules for each chart |
| `references/concepts.md` | steps 4–7: find, record and show the book's concepts and distinctions |
| `references/styles.md` | steps 6 and 6b: the four styles (Map, Recap, Recall, Layers), their research basis, recipes and the styles.json format |
| `scripts/build_styles.py` | step 6b: builds the Recap, Recall and Layers files from the Map file and styles.json |
| `references/content-rules.md` | step 2: book content only, accuracy, spoilers, summaries mode, copyright |
| `references/writing-style.md` | step 6: The Economist style, short form |
| `scripts/extract_book.py` | step 3 (`--help`) |
| `scripts/map.py` | a map of real places (`--help`; data in `assets/geo/`, Natural Earth, public domain) |
| `src/model/lint.ts` | the exact limits the validator applies |
