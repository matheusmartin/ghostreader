# Fixtures

`sample/` is a complete example of the working files and the guide of one book, for the tests
and for the examples in `prompts/` and `references/working-files.md`. Its book, "The Salt Clock",
is a two-chapter story written for these tests: it is not a real book, so its text can be in the
repository. No text of a real book is ever committed (decision D2 in
`docs/proposal-model-neutral-guides.md`).

| Folder | Holds |
|---|---|
| `sample/working/` | what `work/<guide>/` holds for a real book: `source/` (as `extract_book.py` writes it), `intake.json`, `plan.json`, `facts/`, `ledger/`, `concepts.json`, `styles.json`, `verdicts/`, `recall-test/` |
| `sample/books/` | the guide's four files, as `src/books/` holds them; Recap, Recall and Layers are built by `build_styles.py` |

`sample/gold.json` is the sample book's gold set for the conformance suite (`tools/gr.py eval`):
the questions a returning reader must answer, the concepts, and three false claims to plant in
the guide for the judge to catch.

Every file passes every check (`tests/working-files.test.ts`). To run a check by hand:

```bash
python3 -I .claude/skills/ghostreader-book/scripts/check_guide.py facts sample-story --work fixtures/sample/working --books fixtures/sample/books
```

When a schema or a check changes, change the fixture with it, and rebuild the styles:

```bash
python3 -I .claude/skills/ghostreader-book/scripts/build_styles.py fixtures/sample/books/sample-story-map.json fixtures/sample/working/styles.json
```
