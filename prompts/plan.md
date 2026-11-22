---
stage: plan
version: 1.0.0
role: writer
isolation: none
inputs:
  intake: work/{{guide}}/intake.json
  toc: work/{{guide}}/source/toc.json
include:
  - references/guides.md
  - references/working-files.md
output:
  file: work/{{guide}}/plan.json
  schema: schemas/plan.schema.json
check: python3 -I .claude/skills/ghostreader-book/scripts/check_guide.py plan {{guide}}
---

# Plan the guide

You plan a Ghostreader guide of a book: the book's own parts and chapters, in the book's order,
under the book's names. You do not write any summary yet.

## Inputs

What the user asked for:

{{intake}}

The book's table of contents, as extracted (one entry per text file, with its kind and length):

{{toc}}

## Task

1. Choose the guide id: the title and the type in lower case with hyphens (`nexus-summary`,
   `pride-and-prejudice-story`).
2. Make one chapter for each chapter of the book, in order, with its real title ("Chapter 7"
   when it has none) and the number the book gives it ("01"; `P` prologue, `I` introduction, `E`
   epilogue, `C` conclusion, `A1` appendix, only when the book has them). List its text files in
   `sources` and its word count in `words`.
3. Group the chapters in the book's own parts, with the book's labels and titles. A prologue or
   epilogue outside the parts goes in a part with no `label` and no `title`. A book without
   parts has one part with no label.
4. Put every text file of kind `body` that no chapter uses in `skipped`, with the reason (an
   editor's preface, a licence, a list of illustrations).
5. Non-fiction: write the book's question, in the book's terms, 12 words at most. Fiction: the
   story's main situation, as a question. Fiction: list the main cast, one role each in the
   book's words.

## Rules

- Only the book's own parts and chapters (GR-S01). Never add an overview, key concepts, who's
  who or "the book in one page" chapter, and never invent a part label.
- Never invent a title, a number or a length.

## Output

Reply with the JSON of `plan.json` only, in the form of `schemas/plan.schema.json`.

## Example

Right (from `fixtures/sample/working/plan.json`):

```json
{ "guide": "sample-story", "type": "fiction", "title": "The Salt Clock",
  "question": "Who stopped the lighthouse clock at Kessel, and why?",
  "parts": [ { "id": "part-1", "chapters": [
    { "id": "ch1", "number": "01", "title": "Chapter 1", "sources": ["001"], "words": 508 },
    { "id": "ch2", "number": "02", "title": "Chapter 2", "sources": ["002"], "words": 312 } ] } ] }
```

Wrong:

```json
{ "parts": [ { "id": "overview", "label": "Overview", "chapters": [
    { "id": "intro", "number": "I", "title": "Introduction", "sources": ["001"] } ] } ] }
```

The book has no overview part and no introduction: the first chapter is "Chapter 1" (GR-S01).
