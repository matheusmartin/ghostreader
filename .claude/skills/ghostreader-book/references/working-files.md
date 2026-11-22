# Working files

Every step of the workflow writes JSON files in `work/<guide>/`. Each file has a schema in
`schemas/` at the repository root, so any model can be asked for output in that exact form, and
`check_guide.py` checks each file before it uses it (rule GR-F04). `work/` is never committed.

The examples come from `fixtures/sample/`: a short story written for the tests, not a real book.
Its files are complete and pass every check: read them when in doubt.

| File | Step | Schema | Written by | Checked by |
|---|---|---|---|---|
| `intake.json` | 1 | `intake` | you, from the user's message | `schema` |
| `source/` | 3 | (extract_book.py) | `extract_book.py` | |
| `plan.json` | 4 | `plan` | you, from `source/toc.json` | `plan` |
| `facts/<chapter-id>.json` | 5 | `facts` | you, from the chapter's text | `facts`, `names` |
| `ledger/<chapter-id>.json` | 5 | `ledger` | you, from the fact sheets, in chapter order | `facts` |
| `concepts.json` | 5 | `concepts` | `check_guide.py concepts`; you mark `core` | `concepts` |
| `styles.json` | 6b | `styles` | you | `build_styles.py` |
| `verdicts/<chapter-id>.json` | 7 | `verdict` | an isolated judge | `verdicts` |
| `recall-test/<style>-<chapter>-key.json` | 8 | `recall-key` | `check_guide.py test` | |
| `recall-test/<style>-<chapter>-answers.json` | 8 | `recall-answers` | an isolated reader | `score` |
| `recall-test/<style>-<chapter>-score.json` | 8 | `recall-score` | an isolated scorer | `score` |

Run any check as `python3 -I .claude/skills/ghostreader-book/scripts/check_guide.py <command>
<guide>`; add `--json` for the result as JSON. `check_guide.py render <guide>` writes a Markdown
view of the fact sheets and the ledger in `work/<guide>/view/`, for people.

## Anchors

Every fact and every ledger entry has an anchor: the text file, the paragraphs, and a short quote.

```json
{ "file": "001", "p": [7, 7], "quote": "Tomas looked at the floor and said nothing" }
```

- `file`: the three-digit number of the text file in `toc.json` (`001-chapter-1.txt` is `"001"`).
- `p`: the first and the last paragraph, the `[pN]` marks in that file: `[7, 7]`, or `[1, 7]` for
  a scene that runs over seven paragraphs.
- `quote`: 3 to 12 words copied exactly from one of those paragraphs. `check_guide.py facts`
  finds it there (it ignores case, curly quotes and spaces), so a wrong anchor fails (GR-A05).
  Copy the words; never write them from memory.

The quote is the only book text in the working files, and it stays in `work/`. A guide never
quotes the book (`references/content-rules.md`).

## The plan (`plan.json`)

The book's own parts and chapters, from `toc.json`, before anything is written:

```json
{ "guide": "sample-story", "type": "fiction", "title": "The Salt Clock", "author": "Ghostreader fixtures",
  "question": "Who stopped the lighthouse clock at Kessel, and why?",
  "parts": [ { "id": "part-1", "chapters": [
    { "id": "ch1", "number": "01", "title": "Chapter 1", "sources": ["001"], "words": 508 },
    { "id": "ch2", "number": "02", "title": "Chapter 2", "sources": ["002"], "words": 312 } ] } ],
  "skipped": [],
  "cast": [ { "name": "Ines", "role": "the keeper's daughter", "main": true } ] }
```

- Every `toc.json` entry of kind `body` is in one chapter's `sources`, or in `skipped` with the
  reason ("an editor's preface"). A text file is in one chapter only.
- The Map file must have exactly these parts and chapters, in this order, with these ids,
  numbers and titles (`check_guide.py plan`, GR-S01). Chapters after a limit are in the plan too.
- `question`: non-fiction, the book's question in its own terms (12 words at most); "The
  question" in every "Where it stands" uses the same words (GR-W07). Fiction: the story's main
  situation, used by Layers.

## Fact sheets (`facts/<chapter-id>.json`)

One per written chapter: only what the text says, each fact with its anchor.

```json
{ "chapter": "ch1", "sources": ["001"], "words": 508,
  "facts": [
    { "id": "F1", "type": "scene", "basis": "stated",
      "text": "Ines finds the lighthouse clock stopped, so the lamp does not turn; Tomas follows her up",
      "when": "The first cold morning of the year", "where": "the lighthouse", "with": ["Ines", "Tomas"],
      "anchor": { "file": "001", "p": [1, 7], "quote": "the hands stood at ten minutes to six" } },
    { "id": "F7", "type": "person", "basis": "stated", "text": "Mr Hale is the harbour master",
      "who": "Mr Hale", "role": "the harbour master", "first": true,
      "anchor": { "file": "001", "p": [8, 8], "quote": "Mr Hale, the harbour master, was already angry" } },
    { "id": "F2", "type": "concept", "basis": "stated",
      "text": "The keeper's rule: the lamp turns when the clock strikes the hour, and a keeper who breaks it loses the tower",
      "anchor": { "file": "001", "p": [2, 3], "quote": "People in Kessel called it the keeper's rule" },
      "concept": { "name": "The keeper's rule", "kind": "fiction", "mode": "explicit", "members": [
        { "name": "The keeper's rule", "definition": "The lamp turns when the clock strikes the hour; a keeper who breaks it loses the tower" } ] } } ],
  "must_carry": [
    { "id": "M1", "kind": "state", "facts": ["F1"],
      "text": "The lighthouse clock has stopped, so the lamp does not turn",
      "question": "Why does the lighthouse lamp not turn on the first cold morning?" } ] }
```

**Fact types** and the fields each needs (GR-A06):

| Type | Use for | Needs |
|---|---|---|
| `scene` | fiction: a new place or a new time starts a new scene | `with` (people present), and `when` or `where` as the book gives them; `off` for people there at a distance |
| `person` | a person's first appearance, or a change of role | `who`, `role` (the book's words); `first: true` on a first appearance |
| `relation` | how two people stand to each other | `who`, `to` |
| `state` | what a person feels, wants, knows or has | `who` |
| `cause` | why one thing leads to another | |
| `claim`, `evidence`, `term`, `bridge` | non-fiction: an assertion; an example, study or number; a term; the author pointing to a later part | |
| `concept` | a concept or distinction (`references/concepts.md`) | `concept`: name in the book's words, kind, `explicit` or `indirect`, members with a definition each |

**Stated or inferred.** `basis` is `stated` when the text says it, `inferred` when the text
supports it but does not say it. A feeling, motive, knowledge or relation goes on a screen only
when it is stated: these are the claims AI summaries most often get wrong.

**Must carry.** 5–8 items (GR-M01), chosen by the tests in `SKILL.md` step 5. `facts` lists the
facts the item rests on; the first one places it in the chapter, and the items must spread over
the chapter: one from the first third, one from the middle third, at most half from the last
third (GR-M02; `open` items do not count). `text` says what the reader must get back, with its
cause; it is also the answer key of the blind recall test. `question` is cued and has one clear
answer.

## Ledger (`ledger/<chapter-id>.json`)

One per written chapter, written in chapter order: how the chapter changes the state. It is the
source of "Where it stands" and "Still open", and the judge checks those screens against it.

Fiction: each entry is a change on one dimension (`time`, `place`, `present`, `goal`, `relation`,
`knowledge`, `possession`, `view`, `state`). `entity` is the person or thing that changes (not
needed for `time` and `place`), `before` is `null` when nothing was known, `cause` is why.

```json
{ "chapter": "ch1", "entries": [
  { "dimension": "time", "after": "the night of the day the clock stopped",
    "anchor": { "file": "001", "p": [20, 20], "quote": "That night Ines gave Ada the key" } },
  { "dimension": "possession", "entity": "Ines", "about": "her mother's compass",
    "before": "owns it", "after": "has given it to Ada", "cause": "she could not pay Ada's price",
    "anchor": { "file": "001", "p": [15, 16], "quote": "Ines offered her mother's brass compass instead" } } ] }
```

Non-fiction: each entry has a `status` (`established`, `open`, `answered`, `promised`) and a `text`.

```json
{ "status": "promised", "text": "The next part turns to computer networks",
  "anchor": { "file": "014", "p": [230, 230], "quote": "…" } }
```

## Concept inventory (`concepts.json`)

`check_guide.py concepts <guide>` gathers every `concept` fact of every fact sheet, in book
order, into `concepts.json`. Mark `"core": true` on each concept later chapters build on; the
script keeps those marks when it runs again. It also checks that each concept's name, or the
names of all its members, is on a screen of the chapter that introduces it (GR-V05).

## Styles file (`styles.json`)

The texts only Recap, Recall and Layers need (`references/styles.md`, "The styles file").
`build_styles.py` checks it against `schemas/styles.schema.json` before it builds anything.

## Verdicts (`verdicts/<chapter-id>.json`)

The isolated judge's result for one chapter (`references/verify.md`, checks 3 and 4). Screens
are named by the ids `check_guide.py text` prints: `ch1.s2` is screen 2 of chapter `ch1` in that
style's file.

```json
{ "chapter": "ch1",
  "claims": [ { "style": "map", "screen": "ch1.s2", "claim": "Tomas says nothing", "verdict": "supported", "anchor": "001 p7" } ],
  "must_carry": [ { "id": "M1", "map": "ch1.s2", "recap": "ch1.s3", "recall": "ch1.s3", "layers": "ch1.s4" } ],
  "resume": { "matches_ledger": true, "later_facts": [], "names_without_role": [] } }
```

`check_guide.py verdicts <guide>` reports every claim that is not `supported` (GR-C01), every
must-carry item that is `missing` in a style or not checked (GR-M03), and every resume problem
(GR-R04, GR-W06). Fix the guide, then ask a new isolated judge for a new verdict.

## Recall test (`recall-test/`)

`check_guide.py test <guide> --style <style> --upto <chapter-id>` writes the test
(`<style>-<chapter>.md`: the questions, then the guide's app screens with their ids) and the key
(`-key.json`). The isolated reader gets the test file only and replies in the form of
`recall-answers`; the isolated scorer gets the answers and the key, never the book, and replies
in the form of `recall-score` (1, 0.5 or 0 per question). `check_guide.py score` adds them up: an
answer without a screen of the test scores zero, and the pass is 80% overall with no chapter
under 60% (GR-M04).
