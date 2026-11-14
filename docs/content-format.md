# Book format

A book is one JSON file in `src/books/`. The file name is the book id: `src/books/nexus-reading.json`
has `"id": "nexus-reading"`. Add a file, run `npm run validate`, and the book is in the library after
the next build.

The types in `src/model/types.ts` are the exact definition. This page explains them.

## Hierarchy

```
Book
└── Part        a part or volume ("Part I · Human Networks"); a book without parts has one part
    └── Chapter any unit of the contents: prologue, chapter, epilogue, appendix,
        │       and overview pages (Who's who, The book in one page)
        └── Section (optional) a group of screens in a chapter ("Key concepts", "Test yourself")
            └── Screen   one piece of information: what one swipe shows
```

The reader moves through the screens in this order:

| Gesture | Keyboard | Move |
|---|---|---|
| Swipe up / down | ↓ ↑, Space, Page Down / Up | Next / previous screen. Continues into the next chapter. |
| Swipe left / right | → ← | Start of the next / previous chapter. |
| Tap | Enter, Esc | Menu: contents, library, full screen. |

The app adds three screens that you do not write:

- **Cover**: first screen. Title, subtitle, author, edition, lead and the book map.
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
  "lead": "Information connects people more than it informs them. …",
  "parts": [ … ]
}
```

| Field | Required | Meaning |
|---|---|---|
| `format` | yes | Always `1`. |
| `id` | yes | Letters, digits and hyphens. Same as the file name. |
| `type` | yes | `fiction` (story guide), `reading` (reading guide) or `done` (book summary). |
| `title`, `author` | yes | |
| `lead` | yes | The central situation (fiction) or the whole argument (non-fiction), 35 words or fewer. |
| `subtitle` | no | Series, the book's own subtitle, or the English title. |
| `year` | no | Year of first publication. |
| `edition` | no | Only when it matters. |
| `upTo` | no | Last chapter covered, for guides written while reading. |
| `sample` | no | `true` marks demo content in the library. |

## Part

```json
{ "id": "part-1", "label": "Part I", "title": "Human Networks", "theme": "p1", "chapters": [ … ] }
```

- `label` and `title` are optional. Together they make the kicker: "Part I · Human Networks".
  Front and back matter use `"label": "Opening"` and `"label": "Closing"`.
- `theme` is the colour: `front` for overviews and front or back matter, `p1` … `p5` for the parts
  in order. Without a theme, parts take `p1` … `p5` in order.

## Chapter

```json
{ "id": "ch5", "number": "05", "title": "Decisions: A Brief History of Democracy and Totalitarianism",
  "length": 9200, "sections": [ … ] }
```

- `number`: "01", "02" … for chapters; `P` prologue or preface, `I` introduction, `E` epilogue,
  `C` conclusion, `A1` appendix; `B`, `H`, `W`, `T` for overview pages.
- `title`: the real title. An untitled chapter is "Chapter 7". Never invent a title.
- `length`: the real length (words or pages). The book map sizes chips by length only when every
  chapter has one; never estimate.
- Use `screens` (a list of screens) or `sections` (a list of `{ "title", "screens" }`), not both.

## Screens

One screen holds one piece of information. If a screen is too full, the app makes its type up to
28 % smaller; in development, a screen that still does not fit gets a red line at the bottom.
Split it into two screens instead.

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
{ "type": "list", "label": "Who's who",
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

### chart — charts drawn from data

Every chart takes an optional `label` and `caption` (one line under data charts: what the marks mean).

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
groups make an argument map. Groups can take a `theme`.

```json
{ "type": "chart", "chart": "flow", "start": "Opening question",
  "groups": [{ "label": "Part I", "theme": "p1", "items": ["Point", "Point"] }],
  "key": "Conclusion" }
```

### figure — a hand-made SVG diagram

```json
{ "type": "figure", "alt": "Text for screen readers", "caption": "Optional",
  "svg": "<svg viewBox=\"0 0 340 512\" xmlns=\"http://www.w3.org/2000/svg\">…</svg>" }
```

- Draw for a phone: `viewBox` about 340 wide. The figure fills the free height of the screen.
- Use the diagram classes of the book-infographic skill: shapes `bx` (white box), `bt` (tint box),
  `bn` (grey, negative), `bi` (ink), `k` (the one key element), lines `ln`, `la`, arrows `ar`, `ara`;
  text `t1`, `t2`, `t3`, `tn`, `ta`, `tb`, `tw` (white), `c` (centred), `e` (right-aligned).
- Scripts, event attributes, `style`, external links and images are removed.

## Content rules

The rules of the book-infographic skill still apply: book content only, confirmed details only,
no quotations, no opinions, no spoilers past `upTo`, sentence case, British spelling.

The app represents the book and nothing else. A book file never holds the reader's highlights,
notes, ratings or other personal data, so the skill's "Your highlights" page and fields have no
place here. For a `done` guide (book summary) without highlights, the skill's own rule applies:
each section page uses The logic and Examples in the book instead.
