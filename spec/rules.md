# Rule catalogue

Every rule of a Ghostreader guide, once, with an ID. The checks print the ID at the start of each
line, so the same mistake reads the same whatever model or agent made it:

```
GR-W03 parts[1].chapters[2].screens[3].steps[0]: "then" orders events without a cause: say why ("because", "so"), or cut it
```

**Checked by** names the check that finds a break of the rule:

| Check | What it is |
|---|---|
| `validate` | `npm run validate`: `src/model/validate.ts` (format) and `src/model/lint.ts` (writing rules); for one file, as text or JSON: `node scripts/validate-book.mjs <file> [--json]` |
| `test` | `npm test` (`tests/books.test.ts`) |
| `schema`, `plan`, `facts`, `names`, `concepts`, `verdicts`, `score` | `python3 -I .claude/skills/ghostreader-book/scripts/check_guide.py <command> <guide>`: the working files in `work/<guide>/` (`references/working-files.md`) |
| `screens` | `npm run check:screens` |
| `judge` | an isolated run that checks claims, must carry and the resume screens (`references/verify.md`, checks 3 and 4) |
| `recall` | the blind recall test (`references/verify.md`, check 5) |
| `review` | the writer, against the skill's references; no script checks it yet |

The rules themselves are in the skill (`.claude/skills/ghostreader-book/`). This page names
them; the reference file in the last column explains them. When a rule changes, change the
reference file, the check and this page together. `tests/rules.test.ts` fails when a check prints
an ID that is not on this page.

## F · Format

| ID | Rule | Checked by | Reference |
|---|---|---|---|
| GR-F01 | The file matches the book format: `src/model/types.ts`, also as `schemas/book.schema.json` | `validate`, `test` | `docs/content-format.md` |
| GR-F02 | The file name is the book id: `src/books/<id>.json` | `test` | `docs/content-format.md` |
| GR-F03 | A guide has all four styles, one file each, with the same title, author, type, limit, parts and chapters | `test` | `references/styles.md` |
| GR-F04 | Every working file is JSON and matches its schema in `schemas/` | `schema` and every check that reads the file | `references/working-files.md` |

## S · Structure

| ID | Rule | Checked by | Reference |
|---|---|---|---|
| GR-S01 | Only the book's own parts and chapters, in the book's order, under the book's names; no guide-made chapter, part or label | `validate` (old overview numbers), `plan` (the plan against `toc.json` and the Map file), `judge` | `references/guides.md` |
| GR-S02 | Every chapter has at least one chart, and at least half of its app screens are charts, scenes or figures | `review` | `references/visuals.md` |
| GR-S03 | One idea per app screen; more detail goes in PDF-only blocks | `screens`, `review` | `references/guides.md` |

## R · Resume screens

| ID | Rule | Checked by | Reference |
|---|---|---|---|
| GR-R01 | Every written chapter of a guide ends with "Where it stands", then optionally "Still open"; neither comes earlier in the chapter | `validate` | `references/styles.md` |
| GR-R02 | "Where it stands" is a points screen in the app and the PDF, with the four titles of the type, in order | `validate` | `references/styles.md` |
| GR-R03 | "Still open" is a list screen in the app and the PDF, with 1–3 rows | `validate` | `references/styles.md` |
| GR-R04 | The resume screens agree with the ledger, hold nothing from later chapters, and give no hint of an answer | `judge`, then `verdicts` | `references/styles.md` |

## L · Limits

| ID | Rule | Checked by | Reference |
|---|---|---|---|
| GR-L01 | Every field is within its word limit: strict on app screens, looser in PDF-only blocks | `validate` | `references/guides.md`, `src/model/lint.ts` |
| GR-L02 | Every block is within its item limit | `validate` | `references/guides.md`, `src/model/lint.ts` |
| GR-L03 | Names of people, nodes and link labels are 22 characters at most | `validate` | `references/visuals.md` |

## W · Writing

| ID | Rule | Checked by | Reference |
|---|---|---|---|
| GR-W01 | Labels start with a capital and are in sentence case | `validate` | `references/writing-style.md` |
| GR-W02 | Labels have no full stop | `validate` | `references/writing-style.md` |
| GR-W03 | Causes, not sequences: no "and then", and no sentence or item that starts with "Then" | `validate` | `references/writing-style.md` |
| GR-W04 | Mr, Mrs, Ms, Dr and St have no full stop | `validate` | `references/writing-style.md` |
| GR-W05 | British spelling, with -ise forms | `validate` | `references/writing-style.md` |
| GR-W06 | A name on a text screen has a short role at its first mention | `judge`, then `verdicts` | `references/guides.md` |
| GR-W07 | The same name for the same thing in every chapter and style | `plan` ("The question"), `judge` | `references/concepts.md` |

## C · Content

| ID | Rule | Checked by | Reference |
|---|---|---|---|
| GR-C01 | Every claim is in the book; a feeling, motive, relation or cause the text does not state is softened or removed | `judge`, then `verdicts` | `references/content-rules.md` |
| GR-C02 | Every name and every number from 11 up is in the book, up to and including that chapter | `names` | `references/verify.md` |
| GR-C03 | With a limit, no word that looks past it ("eventually", "in the end") | `validate` | `references/content-rules.md` |
| GR-C04 | No quotation from the book: no quoted passage of six words or more | `validate` | `references/content-rules.md` |
| GR-C05 | Nothing from outside the book, except the year of first publication and map outlines | `names`, `judge` | `references/content-rules.md` |
| GR-C06 | A claim check covers every screen with text, in every style: a judge that skips a screen can miss its errors | `verdicts` | `references/verify.md` |

## V · Visuals

| ID | Rule | Checked by | Reference |
|---|---|---|---|
| GR-V01 | Scene text has the time `{when}` and the place `[where]` the book gives: one of each at most, at least one | `validate` | `references/visuals.md` |
| GR-V02 | A scene chart has at least two scenes | `validate` | `references/visuals.md` |
| GR-V03 | Linked nodes on a network ring are next to each other | `validate` | `references/visuals.md` |
| GR-V04 | Every app screen fits a phone at 360, 390 and 820 px; no chart overlap | `screens` | `references/visuals.md` |
| GR-V05 | Every concept and distinction the book introduces has a chart, a key point or a "Terms" row in the chapter that introduces it, under its inventory name | `concepts` (the name is on a screen), `review` (the right chart) | `references/concepts.md` |

## A · Anchors and working files

| ID | Rule | Checked by | Reference |
|---|---|---|---|
| GR-A01 | Every written chapter has a fact sheet `facts/<chapter-id>.json` for that chapter, whose `sources` are in `toc.json` | `facts` | `references/working-files.md` |
| GR-A02 | Every anchor points to paragraphs that exist in the chapter's own text files | `facts` | `references/working-files.md` |
| GR-A03 | Every written chapter has a ledger file `ledger/<chapter-id>.json` for that chapter | `facts` | `references/working-files.md` |
| GR-A04 | Every ledger entry has its form: fiction, a change (`dimension`, `after`, and the `entity` except for time and place); non-fiction, a `status` and a `text` | `facts` | `references/working-files.md` |
| GR-A05 | Every anchor's quote has 3–12 words, copied exactly from the anchored paragraphs | `facts` | `references/working-files.md` |
| GR-A06 | Fact ids are unique, and each fact has the fields its type needs (a scene: `with`, and `when` or `where`) | `facts` | `references/working-files.md` |

## M · Must carry

| ID | Rule | Checked by | Reference |
|---|---|---|---|
| GR-M01 | Each chapter has 5–8 must-carry items, each with a kind, a question and the facts it rests on | `facts` | `references/working-files.md` |
| GR-M02 | Must-carry items are spread over the chapter: one from the first third, one from the middle third, at most half from the last third | `facts` | `references/verify.md` |
| GR-M03 | Every must-carry item is on a screen that each style shows | `judge`, then `verdicts`; `recall` | `references/styles.md` |
| GR-M04 | Blind recall: 80% or more of the points in every style tested, and no chapter under 60%; an answer without a screen of the test scores zero | `recall`, then `score` | `references/verify.md` |
