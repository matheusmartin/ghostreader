---
stage: read
version: 1.1.0
role: writer
isolation: none
inputs:
  chapter_text: work/{{guide}}/source/<the chapter's sources in plan.json>
  plan: work/{{guide}}/plan.json
  earlier_concepts: work/{{guide}}/concepts.json (the concepts of earlier chapters; empty for the first)
  earlier_people: the people of the earlier chapters' fact sheets (empty for the first)
include:
  - references/content-rules.md
  - references/concepts.md
  - references/working-files.md
output:
  file: work/{{guide}}/facts/{{chapter}}.json
  schema: schemas/facts.schema.json
check: python3 -I .claude/skills/ghostreader-book/scripts/check_guide.py facts {{guide}}
---

# Read one chapter

You read chapter `{{chapter}}` of a book and record what its text says, fact by fact, each with
the place in the text where it is. You write nothing from memory: only this chapter's text counts.

## Inputs

The plan of the guide (the book's chapters, the cast, the book's question):

{{plan}}

Concepts introduced by earlier chapters:

{{earlier_concepts}}

People of the earlier chapters (a person not in this list appears for the first time here):

{{earlier_people}}

The chapter's text. Each paragraph starts with its number: `[p12]`.

{{chapter_text}}

## Task

1. Read the whole chapter.
2. Record each fact once, in book order, in your own words, with its `type`: fiction `scene`
   (a new place or a new time starts a new scene), `person` (`first: true` only when the person
   is not in the earlier people), `relation`, `state` (feels, wants, knows, has); non-fiction
   `claim`, `evidence`, `term`, `bridge`; both `cause` and `concept`. A scene lists in `with` the
   people in it, also one who stands apart in the same place; `off` is for people there only at
   a distance (a letter, a phone call, something overheard).
3. Give each fact its anchor: the text file, the first and the last paragraph, and 3 to 12
   words copied exactly from one of those paragraphs.
4. Mark `basis`: `stated` when the text says it, `inferred` when the text only supports it.
5. Record each concept or distinction the chapter introduces as a `concept` fact, with its
   members, in the book's own words (`references/concepts.md`).
6. Choose 5 to 8 must-carry items: what a reader who comes back after months needs most from
   this chapter (a change of state, a cause of later events, a concept the book builds on, the
   main claim, a question left open). Take at least one from the first third and one from the
   middle third of the chapter, counted in paragraphs (the `[pN]` marks). Give each a cued
   question with one clear answer.

## Rules

- Book content only; when in doubt, leave it out (GR-C01, GR-C05).
- A scene's `with` and `off` hold only people who are there: never someone only talked about.
- Copy each quote; never write it from memory (GR-A05).
- When the narrator or the author looks ahead in this chapter ("years later he would…"), that is
  part of this chapter: record it as stated, with its anchor.

## Output

Reply with the JSON of the fact sheet only, in the form of `schemas/facts.schema.json`.

## Example

Right (from `fixtures/sample/working/facts/ch1.json`):

```json
{ "id": "F4", "type": "state", "basis": "stated",
  "text": "Tomas says nothing when Ines says that somebody stopped the clock", "who": "Tomas",
  "anchor": { "file": "001", "p": [7, 7], "quote": "Tomas looked at the floor and said nothing" } }
```

Wrong:

```json
{ "id": "F4", "type": "state", "basis": "stated", "text": "Tomas feels guilty about the clock", "who": "Tomas",
  "anchor": { "file": "001", "p": [7, 7], "quote": "Tomas felt guilty and looked away" } }
```

The text does not say that Tomas feels guilty: that is a reading of his silence, so it is not
`stated` (GR-C01). The quote is not in paragraph 7 (GR-A05).
