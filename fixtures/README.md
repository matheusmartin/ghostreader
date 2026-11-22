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

## A fixture for a real book

A real book's text never goes in the repository (decision D2). Its fixture is a folder with a
`gold.json` only; you give the book file when you run the suite, and its SHA-256 must match, so
every run reads the same edition and gets the same paragraph numbers:

```bash
python3 -I tools/gr.py eval --fixture fixtures/<name> --book path/to/book.epub
```

`gold.json` holds no text of the book: questions and answers in your own words, concept names in
the book's words, and claims that are false.

| Field | Holds |
|---|---|
| `guide` | the guide id the run writes, for example `pride-and-prejudice-story` |
| `intake` | the inputs, as `work/<guide>/intake.json` holds them (type, title, author, `upTo`, the file's name, format and SHA-256) |
| `book.sha256` | the SHA-256 of the book file (`sha256sum book.epub`) |
| `book.split` | optional: the `--split` pattern `extract_book.py` needs for this file |
| `book.after_limit` | optional: the text files (three-digit numbers) to move out before anyone reads, with a limit |
| `must_carry` | per chapter, what a returning reader must get back: `chapter`, `kind`, `question`, `answer` |
| `concepts` | the book's concepts and distinctions: `chapter`, `name` |
| `planted` | false claims to put in a correct guide for the judge to catch: `style`, `chapter`, `screen` (1-based, as in `ch3.s2`), `path` inside the screen (`items[1].text`), the false `text`, and the `claim` in short |

`planted` needs a correct guide of the book in the fixture's `books/` folder. Without one, leave
`planted` out, and the suite reports that part as not run.
