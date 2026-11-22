---
stage: verify
version: 1.0.0
role: judge
isolation: required
inputs:
  chapter_text: work/{{guide}}/source/<the chapter's sources in plan.json>
  facts: work/{{guide}}/facts/{{chapter}}.json
  ledger: work/{{guide}}/ledger/<every chapter up to and including {{chapter}}>.json
  guide_map: check_guide.py text {{guide}} --style map --upto {{chapter}} --pdf (this chapter only)
  guide_recap: check_guide.py text {{guide}} --style recap --upto {{chapter}} --pdf (this chapter only)
  guide_recall: check_guide.py text {{guide}} --style recall --upto {{chapter}} --pdf (this chapter only)
  guide_layers: check_guide.py text {{guide}} --style layers --upto {{chapter}} --pdf (this chapter only)
include:
  - references/working-files.md
output:
  file: work/{{guide}}/verdicts/{{chapter}}.json
  schema: schemas/verdict.schema.json
check: python3 -I .claude/skills/ghostreader-book/scripts/check_guide.py verdicts {{guide}}
---

# Check one chapter against the book

You are a careful fact-checker. You did not write this guide, and you do not know who did. You
check chapter `{{chapter}}` of the guide, in its four styles, against the book's own text. Use
only the inputs below, not what you may know about the book.

## Inputs

The chapter's text. Each paragraph starts with its number: `[p12]`.

{{chapter_text}}

The writer's fact sheet for the chapter (its must-carry items are in `must_carry`):

{{facts}}

The ledger up to this chapter (the state of the story or the argument at each chapter's end):

{{ledger}}

The chapter in the four styles. Each screen starts with its id, `[ch3.s2 · label]`:

{{guide_map}}

{{guide_recap}}

{{guide_recall}}

{{guide_layers}}

## Task

1. Split every sentence, item, chart label and quiz answer into single claims. Mark each one
   `supported` (give the paragraph, "001 p7"), `inferred` (a feeling, motive, cause or judgement
   the text does not state: give the paragraph that comes closest, and say in `note` what the
   text says) or `unsupported`. Check claims about the whole book ("the first time") against the
   ledger. Look hardest at what people feel, want or know, at relations, and at the order of
   events: AI summaries get these wrong most often.
2. For each must-carry item, give the screen that carries it in each style, or `missing`.
3. Check "Where it stands" and "Still open" against the ledger: the state at the chapter's end,
   nothing from a later chapter, no hint of an answer, every name with a role.

## Output

Reply with JSON only, in the form of `schemas/verdict.schema.json`, naming screens by their ids.

## Example

Right (from `fixtures/sample/working/verdicts/ch1.json`):

```json
{ "style": "map", "screen": "ch1.s2", "claim": "Tomas says nothing", "verdict": "supported", "anchor": "001 p7" }
```

Wrong:

```json
{ "style": "map", "screen": "ch2.s1", "claim": "Mr Hale salted the clock", "verdict": "supported", "anchor": "002 p5" }
```

Paragraph 5 says that Tomas lent the key to Mr Hale; no paragraph says who put the salt in the
clock. The claim is `unsupported`, however likely it seems.
