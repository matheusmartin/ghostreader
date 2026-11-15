# Book format

A book is one JSON file in `src/books/`. The file name is the book id: `src/books/nexus-reading.json`
has `"id": "nexus-reading"`. Add a file, run `npm run validate`, and the book is in the library after
the next build. The same file makes the app's screens and the book's A4 PDF.

The types in `src/model/types.ts` are the exact definition. This page explains them. The
ghostreader-book skill (`.claude/skills/ghostreader-book/`) writes these files: it says which
screens each guide type uses and how to choose a chart.

## Hierarchy

```
Book
└── Part        a part or volume ("Part I · Human Networks"); a book without parts has one part
    └── Chapter any unit of the book's contents: prologue, chapter, epilogue, appendix
        │       (only the book's own: no overview pages)
        └── Section (optional) a group of screens in a chapter ("Key concepts", "Test yourself")
            └── Screen   one piece of information: what one swipe shows
```

The reader moves through the screens in this order:

| Gesture | Keyboard | Move |
|---|---|---|
| Swipe up / down | ↓ ↑, Space, Page Down / Up | Next / previous screen. Continues into the next chapter. |
| Swipe left / right | → ← | Start of the next / previous chapter. |
| Hold anywhere (0.6 s) | Enter, Esc | Menu: style, theme, contents, library, full screen. |

The app adds three screens that you do not write:

- **Cover**: first screen. Title, subtitle, author, edition and the book map.
- **Chapter opener**: first screen of each chapter. Number, part, title and the list of sections.
  Set `"opener": false` on a chapter to leave it out.
- **End**: last screen.

A chapter with no screens is shown in the book map and the contents as "not in this guide yet",
with its number only (titles can spoil). Use this for guides written while reading (`upTo`).

## Book

```json
{
  "format": 1,
  "id": "nexus-reading",
  "type": "reading",
  "title": "Nexus",
  "subtitle": "A Brief History of Information Networks from the Stone Age to AI",
  "author": "Yuval Noah Harari",
  "year": 2024,
  "edition": "Portuguese translation, 2025",
  "upTo": "Chapter 5",
  "parts": [ … ]
}
```

| Field | Required | Meaning |
|---|---|---|
| `format` | yes | Always `1`. |
| `id` | yes | Letters, digits and hyphens. Same as the file name. |
| `type` | yes | `fiction` (story guide), `reading` (reading guide) or `done` (book summary). |
| `title`, `author` | yes | |
| `subtitle` | no | Series, the book's own subtitle, or the English title. |
| `year` | no | Year of first publication. |
| `edition` | no | Only when it matters. |
| `upTo` | no | Last chapter covered, for guides written while reading. |
| `style` | no | How the file summarises: `map` (diagrams first), `recap` (the story so far, in words), `recall` (questions first) or `layers` (one line, three points, detail). Shown on the cover, in the menu and in the PDF name. The ghostreader-book skill has the recipe of each (`references/styles.md`). |
| `guide` | no | The guide the file belongs to. A guide has all four styles, one file each, with the id `<guide>-<style>` (`nexus-summary-recap`); the library shows them as one tile with a button per style, and the menu switches style at the same chapter. `npm test` checks that every guide has all four. An old link to `#/read/<guide>/…` opens the Map file. |
| `sample` | no | `true` marks demo content in the library. |
| `source` | no | Where the content comes from, not shown to readers: `{ "kind": "book-file" \| "summaries", "file": "EPUB", "written": "2026-11-14", "skill": "1.0.0" }`. |

## Part

```json
{ "id": "part-1", "label": "Part I", "title": "Human Networks", "chapters": [ … ] }
```

- `label` and `title` are optional. Together they make the kicker: "Part I · Human Networks".
  Use the book's own labels and titles. Front and back matter outside the book's parts (a
  prologue, an epilogue) go in a part without `label` and `title`; its kicker is the book's title.
- There is no colour field. The whole book uses one colour scheme; chapters are told apart only by
  the breaks in the progress strip (docs/design.md).

## Chapter

```json
{ "id": "ch5", "number": "05", "title": "Decisions: A Brief History of Democracy and Totalitarianism",
  "length": 9200, "sections": [ … ] }
```

- `number`: "01", "02" … for chapters; `P` prologue or preface, `I` introduction, `E` epilogue,
  `C` conclusion, `A1` appendix, each only when the book has that section. A guide has only the
  book's own chapters: `npm run validate` reports the numbers `S`, `B`, `K`, `W`, `T` and `M`,
  which marked the guide-made overview pages of earlier versions.
- `title`: the real title. An untitled chapter is "Chapter 7". Never invent a title.
- `length`: the real length (words or pages). The book map sizes chips by length only when every
  chapter has one; never estimate.
- Use `screens` (a list of screens) or `sections` (a list of `{ "title", "screens" }`), not both.

## App and PDF: `only`

Every screen is also a block of the PDF. Add `"only": "pdf"` to a screen (or a section) for detail
that only the PDF shows: a longer synopsis, the full cast, every key concept. Add `"only": "app"`
to a screen the PDF leaves out, usually the short twin of a fuller PDF block. Without `only`, a
screen shows in both. A chapter whose screens are all `only: "pdf"` counts as not written in the app.

```json
{ "type": "text", "label": "What happens in full", "paragraphs": ["…", "…"], "only": "pdf" }
```

The PDF is built with the app (`npm run build` writes `dist/pdf/<id>.pdf`; see the README).

## Screens

One screen holds one piece of information. If a screen is too full, the app makes its type up to
28 % smaller; in development, a screen that still does not fit gets a red line at the bottom.
Split it into two screens instead. `npm run check:screens` checks every screen at three phone and
tablet sizes, and `npm run validate` checks word and item limits (`src/model/lint.ts`).
PDF-only blocks have looser limits.

Text fields accept `**bold**`. Straight quotes become typographic quotes.

### summary — the point first

```json
{ "type": "summary", "label": "Core idea", "text": "Democracy spreads information …",
  "takeaway": { "label": "Takeaway", "text": "A healthy democracy is noisy on purpose …" } }
```

Labels: In short, Core idea, Thesis, Story so far, Your reading. Takeaway labels: Why it matters,
Takeaway, One thing.

### points — named items

```json
{ "type": "points", "label": "Key concepts", "style": "bar",
  "items": [{ "title": "Populism", "text": "Claims that one leader alone …", "tag": "New" }] }
```

`style`: `bar` (default, for concepts and key points) or `box` (for examples). `tag` is a small pill
after the title, such as "New" for a character's first appearance.

### steps — numbered steps

```json
{ "type": "steps", "label": "The logic", "steps": ["…", "…", "Conclusion"] }
```

The last step is the conclusion and is set in bold.

### list — rows of name and text

```json
{ "type": "list", "label": "Everyone in this chapter",
  "rows": [{ "name": "Elizabeth Bennet", "text": "Second daughter; quick and witty", "meta": "Bennets" }] }
```

### quiz — test yourself

```json
{ "type": "quiz", "label": "Test yourself",
  "questions": [{ "q": "Why does bad news travel badly …?", "a": "Every message must pass …" }] }
```

The reader taps a question to see its answer. There is no separate answers page.

### text — short prose

```json
{ "type": "text", "label": "Background in the book", "paragraphs": ["…", "…"] }
```

### scenes — who is where (fiction)

The scenes of a chapter and who is in each one. The app shows a chart — one row per person, one
column per scene, a dot when the person is there, a ring when they are there only at a distance
(letter, phone, overheard), a line joining the people of each scene, the key scene in the accent
colour — and then the scenes as a numbered list, two to four per screen. The PDF shows both, with
the names under each scene.

```json
{ "type": "scenes",
  "people": [{ "name": "Mr Bennet" }, { "name": "Elizabeth" }, { "name": "Mr Darcy", "tag": "New" }],
  "scenes": [
    { "text": "{Before the ball} Mr Bennet will not describe Bingley at [Longbourn].", "with": ["Mr Bennet", "Elizabeth"] },
    { "text": "{During the ball}, at [the assembly], Elizabeth overhears Darcy refuse to dance with her.",
      "with": ["Elizabeth", "Mr Darcy"], "key": true }
  ] }
```

- `people`: the rows, top to bottom; put people who meet next to each other. `tag`: "New" on a
  first appearance in the book.
- `text`: one or two sentences with the time in `{…}` (drawn bold in the accent colour) and the
  place in `[…]` (bold), as far as the book gives them.
- `with`: people in the scene; `off`: people there only at a distance. Exactly one scene is `key`.

### chart — charts drawn from data

Every chart takes an optional `label` and `caption` (one line under data charts: what the marks mean).
`bars`, `compare`, `flow`, `timeline`, `matrix` and `branches` are HTML and reflow to any width;
`network`, `threads`, `cycle` and `layers` are SVG, laid out for a phone (and wider in the PDF).

**bars** — real numbers only. `focus` draws a bar in the accent colour.

```json
{ "type": "chart", "chart": "bars", "caption": "Numbers from the table in the chapter",
  "data": [{ "label": "First item", "value": 12, "focus": true }, { "label": "Second item", "value": 7 }] }
```

**compare** — two columns, row by row; `key` is the conclusion; `negative` greys one column.

```json
{ "type": "chart", "chart": "compare", "columns": ["Democracy", "Totalitarianism"], "negative": 1,
  "rows": [["Press and courts expose errors", "Bad news blocked on its way up"]],
  "key": "Judge a democracy by its free conversation" }
```

**flow** — a start, groups of points, and a key conclusion. One group is a simple flow; two or three
groups make an argument map.

```json
{ "type": "chart", "chart": "flow", "start": "Opening question",
  "groups": [{ "label": "Part I", "items": ["Point", "Point"] }],
  "key": "Conclusion" }
```

**timeline** — events in order with the time the book gives; one `key` turning point.

```json
{ "type": "chart", "chart": "timeline",
  "items": [{ "when": "1450s", "text": "Print spreads texts" }, { "when": "1789", "title": "Revolution", "text": "…", "key": true }] }
```

**network** — a cast map (fiction) or a concept map. `centre` (one or two names; the first is the
key element) sits in the middle; `nodes` sit on a ring around it, clockwise from the top left (first
half across the top, second half back along the bottom). Put linked nodes next to each other. `note`
is a small line under a name (a group, a household); `tag` a small pill ("New"); a link takes an
optional `label` (≤ 4 words) and `arrow: true`.

```json
{ "type": "chart", "chart": "network", "label": "Characters", "centre": ["Elizabeth"],
  "nodes": [{ "name": "Jane", "note": "Longbourn" }, { "name": "Mr Bingley", "note": "Netherfield" }],
  "links": [{ "from": "Elizabeth", "to": "Jane", "label": "Sisters" },
            { "from": "Mr Bingley", "to": "Jane", "label": "Admires her", "arrow": true }] }
```

**threads** — story threads by chapter (fiction). `columns` are chapter labels; each thread has the
columns where it `appears` and its `major` developments (large dots). The app splits a tracker of
more than 18 chapters into several screens and, when threads have a `text`, adds the thread list.

```json
{ "type": "chart", "chart": "threads", "columns": ["1", "2", "3"],
  "threads": [{ "name": "Bingley and Jane", "text": "Bingley's open admiration for Jane.", "appears": ["1", "3"], "major": ["3"] }] }
```

**cycle** — a loop that feeds itself: 3–6 `nodes` (`title`, optional `text`), the last leads back to
the first; one `key` node; optional `centre` note.

**matrix** — items compared on features: `columns` (features), `rows` with `label` and one
`true`/`false` per column in `cells`; `focus` tints a row; `key` is the verdict.

**branches** — one situation (`start`) and 2–4 `options` (`title`, `text`); `key` for the outcome
the book argues for, `negative` for outcomes it warns against.

**layers** — nested levels: `rings` from the outside in (`title`, optional `text`); the innermost
ring is the key element.

```json
{ "type": "chart", "chart": "cycle", "centre": "The loop feeds itself",
  "nodes": [{ "title": "Algorithm", "text": "Optimises clicks" }, { "title": "Outrage wins", "key": true }, { "title": "Feeds" }] }
```

### figure — a hand-made SVG diagram

```json
{ "type": "figure", "alt": "Text for screen readers", "caption": "Optional",
  "svg": "<svg viewBox=\"0 0 340 512\" xmlns=\"http://www.w3.org/2000/svg\">…</svg>" }
```

- Draw for a phone: `viewBox` about 340 wide. The figure fills the free height of the screen.
- Use the app's diagram classes (`src/styles/figures.css`): shapes `bx` (white box), `bt` (tint
  box), `bn` (grey, negative), `bi` (ink), `k` (the one key element), lines `ln`, `la`, arrows `ar`,
  `ara`; text `t1`, `t2`, `t3`, `t4` (small grey), `tn`, `ta`, `tb`, `tw` (white), `c` (centred),
  `e` (right-aligned). Maps from the skill's `map.py` use `sea`, `land` and `pin`.
- Scripts, event attributes, `style`, external links and images are removed.

## Content rules

The rules of the ghostreader-book skill apply (`.claude/skills/ghostreader-book/references/`):
book content only, confirmed details only, no quotations, no opinions, no spoilers past `upTo`,
sentence case, British spelling. `npm run validate` checks the ones a program can check.

The app represents the book and nothing else. A book file never holds the reader's highlights,
notes, ratings or other personal data. The repository and the site are public: a guide summarises
in its own words and never reproduces the book's text.
