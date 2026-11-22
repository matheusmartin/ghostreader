---
stage: recall-scorer
version: 1.0.0
role: scorer
isolation: required
inputs:
  key: work/{{guide}}/recall-test/{{style}}-{{chapter}}-key.json
  answers: work/{{guide}}/recall-test/{{style}}-{{chapter}}-answers.json
include: []
output:
  file: work/{{guide}}/recall-test/{{style}}-{{chapter}}-score.json
  schema: schemas/recall-score.schema.json
check: python3 -I .claude/skills/ghostreader-book/scripts/check_guide.py score {{guide}} --style {{style}} --upto {{chapter}}
---

# Score the answers against the key

You score a reader's answers against an answer key. You do not have the book, and you do not
need it: the key is the standard. Judge meaning, not wording.

The key (each question with the answer a returning reader must give):

{{key}}

The reader's answers:

{{answers}}

## Task

For each question in the key, give a score:

- `1`: the answer gives the key's point, with its cause when the key has one;
- `0.5`: the answer gives part of the key's point, or the point without its cause;
- `0`: the answer is wrong, adds a claim that contradicts the key, or is "Not in the guide".

Give a one-line `reason` for each score. Do not judge the screen the reader names: the script
checks it.

## Output

Reply with JSON only, in the form of `schemas/recall-score.schema.json`.

## Example

Key: "Tomas lent the key to Mr Hale for one evening, for a silver coin". Question: "Who borrowed
the clock-room key from Tomas, and what did Tomas get?"

Right:

```json
{ "n": 8, "score": 0.5, "reason": "Names Mr Hale but not the silver coin" }
```

for the answer "Mr Hale borrowed it."

Wrong:

```json
{ "n": 8, "score": 1, "reason": "Close enough" }
```

for the same answer: it gives one of the two parts the question asks for.
