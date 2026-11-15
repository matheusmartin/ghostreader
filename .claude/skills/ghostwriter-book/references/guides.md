# Guide types

These are the recipes of the Map style, the file every guide starts with. Recap, Recall and Layers
are built from it (`references/styles.md`); everything else here applies to every style.

Every guide has the same frame: the book's own parts and chapters, in the book's order, under the
book's names, and nothing else. A book without parts has one part without a label; a prologue or
epilogue outside the book's parts sits in a part without a label. Never add a chapter, part,
section or label of the guide's own: no overview, key concepts, who's who, story threads, map or
"the book in one page" chapter, no prologue, introduction or epilogue the book does not have, no
part labels such as "Overview", "Opening" or "Closing". Each chapter's screens summarise that
chapter. The whole book uses one colour scheme, so there is no colour field. The app adds the
cover, the chapter openers and the end screen; the PDF adds a cover with contents and an answers
page.

Each recipe lists the **app screens** in order, then the **PDF-only blocks**. App screens must
fit a phone (`npm run check:screens`); PDF-only blocks carry the detail. When the app and the PDF
need two sizes of the same block, write both: the short one `"only": "app"`, the full one
`"only": "pdf"`.

Chapter numbers: `"01"`, `"02"`…; `P` prologue or preface, `I` introduction, `E` epilogue, `C`
conclusion, `A1` appendix, each only when the book has that section. The letters `S`, `B`, `K`,
`W`, `T` and `M` marked the guide-made overview chapters of earlier versions; `npm run validate`
reports them.

## Fiction — Story guide

**Purpose:** follow the story while reading: who is who, who is where, what happens, chapter by
chapter. Charts first, little text. Lead: the central situation, ≤ 35 words, never the ending.

### Across the chapters

There is no cast map, thread tracker or map chapter. What a reader needs to keep sits in the
chapter where the book gives it:
- **Who is who**: `points` "Who they are" in every chapter (new people first), and a `network`
  "Relations now" in the first chapter that brings the main cast together and in each chapter that
  changes many relations: as known at the end of that chapter.
- **Real places**: when the story moves between real places that matter, a `figure` with the SVG
  from `scripts/map.py` (`--width 340`) in the chapter that moves, with only that chapter's places,
  alt text and the caption "Today's borders; places from outside the book". Invented places, or a
  story that stays in one town, get no map.
- **The story's own concepts** (ranks, laws, codes, invented words, a magic system;
  `references/concepts.md`): a chart in the chapter that introduces each.

### Chapter recipe

```json
{ "id": "ch3", "number": "03", "title": "Chapter 3", "length": 1719, "screens": [
  { "type": "summary", "label": "In short", "text": "…", "takeaway": { "label": "Why it matters", "text": "…" } },
  { "type": "scenes", "people": [ … ], "scenes": [ … ] },
  { "type": "points", "label": "Who they are", "items": [ { "title": "Mr Darcy", "text": "…", "tag": "New" } ] },
  { "type": "text", "label": "What happens in full", "paragraphs": [ "…" ], "only": "pdf" },
  { "type": "list", "label": "Everyone in this chapter", "rows": [ … ], "only": "pdf" }
] }
```

| Screen | Limit |
|---|---|
| In short | 1–2 sentences, ≤ 35 words; Why it matters: 1 sentence ≤ 20 words, nothing from later chapters |
| Scenes | 3–8 scenes in book order, one `key` (the turning point), ≤ 8 people; scene text one or two sentences ≤ 35 words with the time `{when}` and the place `[where]` woven in, as far as the book gives them (one of each, at least one) |
| Who they are | 2–4 people: new people first (`tag: "New"` on a first appearance in the book; none in the first chapter), then people whose role or relation changes here; ≤ 25 words each |
| Relations now | `network`: in the first chapter that brings the main cast together and when the chapter changes many relations (see above); centre the main character, up to 10 others in ring order, link labels ≤ 4 words |
| Optional | a `figure` map (see above); a `timeline` when it jumps in time; a `quiz` "Test yourself" (1–2 questions) last |
| PDF: What happens in full | 150–300 words, events in order, your own words |
| PDF: Everyone in this chapter | every named person who appears: who they are and what they do here (≤ 20 words) |

**Scenes.** A new scene starts when the place or the time changes; merge very short passages into
the nearest scene. Order `people` so that people who meet are next to each other (the chart joins
each scene's people with one line). One-scene extras stay in the scene text, not in `people`.
Short-story collections: one chapter per story. Plays: one chapter per act.

## Non-fiction reading — Reading guide

**Purpose:** understand the book and follow the argument while reading: what each chapter claims,
the terms it uses, how the reasoning moves. Lead: the argument of the chapters covered, ≤ 35 words.

No overview chapter: the book's concepts are shown in the chapters that introduce them
(`references/concepts.md`). A map of real places, as for fiction, goes in the chapter whose
argument moves across them.

### Chapter recipe

| Screen | Limit |
|---|---|
| `summary` "Core idea" + takeaway "Takeaway" | 2–3 sentences ≤ 45 words; takeaway 1 sentence ≤ 20 words |
| The chapter's diagram | the one chart that shows how the chapter's argument works (`references/visuals.md`) |
| Concept charts | one chart for each concept or distinction the chapter introduces (`references/concepts.md`); it can be the chapter's diagram |
| `points` "Key concepts" | up to 4: name ≤ 4 words, explanation ≤ 28 words |
| `steps` "The logic" | 5 steps ≤ 14 words; the last is the conclusion |
| `points` "Examples in the book", `style: "box"` | 2–3: name ≤ 6 words, ≤ 20 words |
| Optional second diagram | e.g. `network` "How the ideas connect" |
| `quiz` "Test yourself" | 2–3 questions ≤ 22 words that test understanding (why, how, apply), not trivia; answers ≤ 25 words, from this chapter |
| PDF: `text` "The chapter in full" | 200–400 words, the argument in order |
| PDF: `points` "All key concepts" | every concept the chapter introduces (the app shows 4: mark that one `only: "app"`) |
| PDF: `points` "More examples", `list` "Terms" | when the chapter has them |

## Non-fiction done — Book summary

**Purpose:** a summary of a finished book to keep and review: a short part per chapter of the
book, in the book's order. Always the whole book. Lead: the whole argument, ≤ 35 words.

No overview chapter: no "book in one page" and no key concepts chapter. The whole argument is
the cover's lead; each concept is shown in the chapter that introduces it
(`references/concepts.md`).

### Chapter recipe

| Screen | Limit |
|---|---|
| `summary` "In short" + "Takeaway" | 2 sentences ≤ 40 words; takeaway ≤ 20 words |
| The chapter's diagram | as in the reading guide |
| Concept charts | one chart for each concept or distinction the chapter introduces (`references/concepts.md`) |
| `points` "Key points" | exactly 3: name ≤ 4 words, ≤ 25 words |
| `steps` "The logic" | 5 steps; the last is the conclusion |
| `points` "Examples in the book", `style: "box"` | 2 |
| `quiz` "Recall" (optional) | 2 questions ≤ 22 words |
| PDF: `text` "The chapter in full" | 200–400 words |
| PDF: `points` "All key points", `list` "Terms" | when the chapter has more |

## Limits the validator applies

`npm run validate` reports any app screen over these limits (PDF-only blocks: the second number).
They come from `src/model/lint.ts`; a recipe above may be stricter.

| Block | App · PDF-only |
|---|---|
| Labels | ≤ 5 words, sentence case, no full stop |
| Book lead | ≤ 35 words |
| summary | text 50 · 80 words; takeaway 22 · 30 |
| points | 4 · 10 items; title 6 words; text 30 · 45 |
| steps | 6 · 10 steps; 18 · 28 words each |
| list | 8 · 30 rows; name 6 words; text 18 · 30 |
| quiz | 3 · 6 questions; question 24 · 30; answer 30 · 40 |
| text | 120 · 450 words in all |
| scenes | 8 · 12 people; 8 · 12 scenes; text 35 words, one {when} and one [where] at most, at least one |
| network | 10 · 16 ring nodes; 10 · 18 links; names 4 words and 22 characters; link labels 4 words |
| threads | 8 · 10 threads; names 3 words; text 15 words |
| timeline | 6 · 12 items; text 22 · 35 words |
| flow | 3 groups; 4 · 6 items of 7 words |
| compare | 5 · 8 rows; cells 10 words |
| matrix | 4 · 6 columns; 6 · 10 rows |
| cycle | 3–6 nodes; titles 4 words; notes 6 words |
| branches | 2–4 options; titles 5 words; notes 8 words |
| layers | 2–5 rings; titles 3 words; notes 5 words |
| bars | 8 · 16 bars; real numbers only |
