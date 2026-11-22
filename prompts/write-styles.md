---
stage: write-styles
version: 1.1.0
role: writer
isolation: none
inputs:
  plan: work/{{guide}}/plan.json
  facts: work/{{guide}}/facts/<every chapter up to and including {{chapter}}>.json
  ledger: work/{{guide}}/ledger/<every chapter up to and including {{chapter}}>.json
  map_chapter: the chapter "{{chapter}}" in src/books/{{guide}}-map.json
include:
  - references/styles.md
  - references/content-rules.md
  - references/writing-style.md
output:
  file: the entry "{{chapter}}" of "chapters" in work/{{guide}}/styles.json
  schema: schemas/styles.schema.json#/definitions/Chapter
check: python3 -I .claude/skills/ghostreader-book/scripts/build_styles.py src/books/{{guide}}-map.json work/{{guide}}/styles.json
---

# Write the style texts of one chapter

You write the texts that the Recap, Recall and Layers styles need for chapter `{{chapter}}`. A
script builds those styles from these texts and the Map chapter.

## Inputs

The plan (the book's question):

{{plan}}

The fact sheets up to this chapter:

{{facts}}

The ledger up to this chapter:

{{ledger}}

The Map chapter, as written:

{{map_chapter}}

## Task

Write one entry with these fields (`references/styles.md`, "The styles file"):

- `before`: everything before this chapter, 50 words at most: first the book's question or the
  story's main situation, in the same words each time, then one clause per earlier part, then the
  chapter before. Leave it out in the first chapter.
- `line`: the chapter in one sentence, 20 words at most.
- `point`: the point the chapter adds, 7 words at most; `key`: its conclusion, 10 words at most.
- `recap`: the chapter as causes, two short paragraphs, 120 words at most in all.
- `moments`: 4–6 key moments in book order, from the start and the middle too.
- `remember`: 2–3 concepts or people the chapter introduces.
- `questions`: exactly three cued questions with short answers; the third is asked again two
  chapters later, so make it the chapter's core point.
- `first_items`, in the first chapter only: 2–4 items for its "argument so far" chart, 7 words
  each at most: what the chapter sets up (the chart already starts with the book's question).
- `part_point`, in the last written chapter of a part with two or more chapters: the part's point,
  7 words at most.

## Rules

- Write `before` from the fact sheets and the ledger, never from earlier `before` texts: errors
  grow when summaries are made from summaries.
- The same rules as the Map file: causes, roles, the same names, nothing from later chapters,
  no quotation (GR-W03, GR-W06, GR-W07, GR-R04, GR-C04).

## Output

Reply with the JSON of the entry only, in the form of `Chapter` in
`schemas/styles.schema.json`.

## Example

Right (from `fixtures/sample/working/styles.json`, chapter 2):

```json
{ "line": "Salt in the wheel shows somebody used a key, and Mr Hale borrowed one.",
  "point": "Mr Hale borrowed the key", "key": "Ines keeps the key from Mr Hale" }
```

Wrong:

```json
{ "line": "Then Ada finds salt, and then Tomas confesses, and then Ines hides the key from the villain." }
```

The line orders events without causes (GR-W03), calls Mr Hale a villain, which the book has not
shown (GR-C01), and has more than 20 words.
