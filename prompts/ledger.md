---
stage: ledger
version: 1.0.0
role: writer
isolation: none
inputs:
  facts: work/{{guide}}/facts/{{chapter}}.json
  earlier_ledger: work/{{guide}}/ledger/<every chapter before {{chapter}}>.json
  chapter_text: work/{{guide}}/source/<the chapter's sources in plan.json>
include:
  - references/styles.md
  - references/working-files.md
output:
  file: work/{{guide}}/ledger/{{chapter}}.json
  schema: schemas/ledger.schema.json
check: python3 -I .claude/skills/ghostreader-book/scripts/check_guide.py facts {{guide}}
---

# Record the state at the chapter's end

You record how chapter `{{chapter}}` changes the state of the story or the argument, so that a
reader who stops here can be told exactly where things stand.

## Inputs

The chapter's fact sheet:

{{facts}}

The ledger of the earlier chapters (the state before this chapter):

{{earlier_ledger}}

The chapter's text, for the anchors:

{{chapter_text}}

## Task

Fiction: write one entry for each change on these dimensions, as the chapter ends: `time` and
`place` of the story; `present` (who is there at the end); and for each person who changes,
`goal`, `relation`, `knowledge`, `possession`, `view` or `state`. Give `before` (from the earlier
ledger; `null` when nothing was known), `after`, and the `cause` as the book shows it.

Non-fiction: write one entry for each step of the argument: `established` (what the chapter
shows), `open` (a question raised and not answered), `answered` (an earlier open question this
chapter settles), `promised` (what the author says a later chapter will show).

Every entry has an anchor with a 3–12-word quote copied from the text.

## Rules

- Only what the book shows by the end of this chapter: nothing from later chapters (GR-R04).
- A change of feeling, knowledge or relation only when the text states it (GR-C01).

## Output

Reply with the JSON of the ledger file only, in the form of `schemas/ledger.schema.json`.

## Example

Right (from `fixtures/sample/working/ledger/ch2.json`):

```json
{ "dimension": "view", "entity": "Ines", "about": "Mr Hale", "before": null,
  "after": "wonders why he wants her father out of the tower",
  "anchor": { "file": "002", "p": [14, 14], "quote": "wondering why the harbour master wanted her father out of the tower" } }
```

Wrong:

```json
{ "dimension": "knowledge", "entity": "Ines", "about": "Mr Hale", "before": null,
  "after": "knows Mr Hale salted the clock", "anchor": { "file": "002", "p": [5, 5], "quote": "…" } }
```

The text says that Mr Hale borrowed the key, not that he put the salt in the clock: the entry
claims more than the book shows (GR-C01).
