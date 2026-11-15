# Verify

A guide is right when two things hold: **every claim is in the book** (no error added), and **a
returning reader gets back what they need** (nothing important left out). AI checks catch added
errors well but find omissions at close to chance, so each needs its own check. Run these after
the Map file and the styles file are written (`SKILL.md` steps 7 and 8), and again after big
fixes. Every check works on the files in `work/<guide>/`; none of them is committed.

| Check | Finds | How |
|---|---|---|
| 1 Fact sheets and ledger | invented or wrong anchors; a must-carry list missing, too short or bunched at the chapter's end | `check_guide.py facts <guide>` |
| 2 Names and numbers | outside facts, wrong forms of names, spoilers (a name the book has not given yet) | `check_guide.py names <guide>` |
| 3 Claims | wrong claims: feelings, motives, relations, order of events, causes | a fresh subagent per chapter, claim by claim |
| 4 Must carry | what a returning reader needs, left out | the same subagent, item by item |
| 5 Blind recall | whether the guide alone gets a reader back into the book | `check_guide.py test`, then a fresh subagent |

## 1 · Fact sheets and ledger

```bash
python3 -I .claude/skills/ghostreader-book/scripts/check_guide.py facts <guide>
```

Every anchor in a fact sheet and the ledger must exist in that chapter's own text files (the
`source` line of the sheet). Each chapter has 5–8 must-carry items, each with a kind and a
question, at least one from the first and one from the middle third of the chapter, and at most
half from its last third (summaries skip the middle and lean on the end). Fix the sheet, not the
check.

## 2 · Names and numbers

```bash
python3 -I .claude/skills/ghostreader-book/scripts/check_guide.py names <guide>
```

Every capitalised word and every figure from 11 up on a chapter's screens, in all four styles,
must be in the book's text up to and including that chapter. For each line it reports:

- an outside fact (a name, place or number the book does not give) → remove it;
- another form of a name (the guide writes "US", the book "America") → use the book's form;
- a name the book gives only later → remove it (a spoiler with a limit; a wrong chapter without);
- a number written in words in the book ("ten thousand") → confirm it, then add the figure to
  `work/<guide>/names-ok.txt` (one per line). Add a word there only after you confirm it.

## 3 and 4 · Claims and must carry (fresh eyes)

For each chapter, start a subagent with only these: the chapter's text files, its fact sheet,
the ledger up to it, and the guide's text for the chapter in every style:

```bash
python3 -I .claude/skills/ghostreader-book/scripts/check_guide.py text <guide> --style map --upto <chapter-id> --pdf
```

(Give it the last chapter of that output; do the same for recap, recall and layers.) Ask it to:

1. Split every sentence, item, chart label and quiz answer into single claims, and mark each
   **supported** (give the paragraph), **inferred** (a feeling, motive, cause or judgement the
   text does not state: give the paragraph that comes closest) or **unsupported**. Claims about
   the whole book ("the first time", "never again") are checked against the ledger.
2. For each must-carry item, quote where the guide carries it (style, screen), or say "missing".
3. Check "Where it stands" and "Still open" against the ledger: the state at the chapter's end,
   nothing from later chapters, every name with a role.

Fix each unsupported claim or remove it; soften or remove an inferred one unless the text states
it; add each missing must-carry item where it belongs (a key point, a key moment, "Where it
stands"). Never "improve" a claim from memory. Research on AI summaries of books found most false
statements are about what characters feel, want or know, about relations, and about the order of
events; give those the closest look.

## 5 · Blind recall

The direct test of the app's goal: can a reader who has only the guide answer what a returning
reader needs? For the Map file at the last chapter of each part, and for every other style at the
last written chapter:

```bash
python3 -I .claude/skills/ghostreader-book/scripts/check_guide.py test <guide> --style map --upto <chapter-id>
```

It writes `work/<guide>/recall-test/<style>-<chapter>.md` (the guide's app screens up to the
chapter, then the must-carry questions of those chapters) and a `-key.md` with the answers. Give
a fresh subagent the test file only, never the key or the book, and ask it to answer from the
guide alone ("Not in the guide" when it cannot). Then score its answers against the key, yourself
or with a second subagent: correct, partly correct (half), wrong or not in the guide.

- **Pass: 80% or more** of the points, and no chapter under 60%.
- Each miss: carry that fact in the guide (where a reader coming back will see it: "Where it
  stands", key points, the recap), or, when the key itself is wrong, fix the fact sheet.
- A model may know a famous book already, so a right answer the guide does not support counts as
  wrong: ask the subagent to cite the screen for every answer.

Report the scores in the final message.
