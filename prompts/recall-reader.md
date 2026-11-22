---
stage: recall-reader
version: 1.0.0
role: reader
isolation: required
inputs:
  test: work/{{guide}}/recall-test/{{style}}-{{chapter}}.md (from check_guide.py test)
include: []
output:
  file: work/{{guide}}/recall-test/{{style}}-{{chapter}}-answers.json
  schema: schemas/recall-answers.schema.json
check: python3 -I .claude/skills/ghostreader-book/scripts/check_guide.py schema {{guide}}
---

# Answer from the guide alone

You are a reader who has not read the book. You have only the guide below. Answer each question
from the guide, and say which screen the answer comes from. Do not use anything you know about
the book: an answer the guide does not give counts as wrong, even when it is true.

{{test}}

## Output

Reply with JSON only, in the form of `schemas/recall-answers.schema.json`: one answer per
question, one or two sentences, with the id of the screen it comes from ("ch1.s2"). When the
guide does not give the answer, the answer is "Not in the guide" and the screen is `null`.

## Example

Right:

```json
{ "n": 8, "answer": "Mr Hale, for a silver coin.", "screen": "ch2.s3" }
```

Wrong:

```json
{ "n": 8, "answer": "Mr Hale, because he wanted the tower for himself.", "screen": null }
```

The answer adds a motive the guide does not give, and names no screen: it scores zero.
