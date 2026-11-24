---
stage: write-map
version: 1.1.0
role: writer
isolation: none
inputs:
  plan: work/{{guide}}/plan.json
  facts: work/{{guide}}/facts/{{chapter}}.json
  ledger: work/{{guide}}/ledger/<every chapter up to and including {{chapter}}>.json
  concepts: work/{{guide}}/concepts.json
  earlier_chapters: the Map file's chapters before {{chapter}} (for the same names and roles)
include:
  - ../../../docs/content-format.md
  - references/guides.md
  - references/styles.md
  - references/visuals.md
  - references/concepts.md
  - references/content-rules.md
  - references/writing-style.md
output:
  file: the chapter "{{chapter}}" in src/books/{{guide}}-map.json
  schema: schemas/book.schema.json#/definitions/Chapter
check: node scripts/validate-book.mjs src/books/{{guide}}-map.json --json
---

# Write one chapter of the Map file

You write chapter `{{chapter}}` of the Map style of a Ghostreader guide: the screens a reader
swipes through, diagrams first, ending with "Where it stands" and "Still open". You write from
the fact sheet and the ledger only, never from memory.

## Inputs

The plan (type, title, the book's question, the cast):

{{plan}}

The chapter's fact sheet:

{{facts}}

The ledger up to this chapter:

{{ledger}}

The concept inventory:

{{concepts}}

The chapters before this one, as written:

{{earlier_chapters}}

## Task

1. Follow the chapter recipe of the guide's type (`references/guides.md`): the app screens in
   order, then the PDF-only blocks, then the two resume screens.
2. Choose each chart by the shape of the idea (`references/visuals.md`). Give each concept this
   chapter introduces its chart, a key point or a "Terms" row, under its inventory name (GR-V05).
3. Put every must-carry item on an app screen each style shows (GR-M03): non-fiction, "Key
   points" or "Key concepts" first, then "In short" or "Core idea", "The logic", the main chart or
   the resume screens; fiction, "Who they are", the scenes chart, "In short" or "Where it stands".
   A PDF-only block does not count: a reader in the app never sees it.
4. Write "Where it stands" and "Still open" from the ledger at this chapter's end (GR-R01–GR-R04).
5. Use the id, number, title and length of the chapter in the plan.

## Rules

- Causes, not sequences: "because", "so"; never "and then" (GR-W03).
- A role with every name at its first mention on a text screen (GR-W06); the same name for the
  same thing as in the earlier chapters (GR-W07).
- Nothing from a later chapter, and no hint of an answer in "Still open" (GR-R04).
- Only feelings, motives and relations the fact sheet marks `stated` (GR-C01).
- No quotation from the book (GR-C04). Within the limits of each field and block: the last table
  of references/guides.md has all of them (GR-L01, GR-L02).
- A label is in sentence case, even when it names a term the book coins in capitals: put the term
  in the screen's text, and give the label plain words (GR-W01).

## Output

Reply with the JSON of the chapter only, in the form of `Chapter` in `schemas/book.schema.json`:
`{"id", "number", "title", "length", "screens": [...]}`.

## Example

Right (from `fixtures/sample/books/sample-story-map.json`, chapter 2):

```json
{ "type": "list", "label": "Still open", "rows": [
  { "name": "Mr Hale's aim", "text": "Why does the harbour master want the keeper out of the tower?" },
  { "name": "The salt", "text": "Who put the salt in the clock?" } ] }
```

Wrong:

```json
{ "type": "list", "label": "Still open", "rows": [
  { "name": "The guilty man", "text": "Will Ines prove that Mr Hale salted the clock?" } ] }
```

The row hints at the answer: the book has not shown who put the salt in the clock (GR-R04).
