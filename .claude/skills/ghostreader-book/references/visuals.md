# Visuals

Seeing is faster than reading. Every chapter has at least one chart, and at least half of a
chapter's app screens are charts, scenes or figures. Text screens carry what a picture cannot: the
point of the chapter in two sentences, the meaning of a term, a test question.

The fields of every type are in `docs/content-format.md`. This page says which visual to use and
how to make it read well. The app draws every chart from data, in the theme the reader
chose, on a phone and (wider, with more room) in the PDF; there is nothing to lay out by hand.

## Which visual for which idea

| The content is… | Use | Key element (accent) |
|---|---|---|
| who is in which scene, who meets whom (fiction chapter) | `scenes` | the turning-point scene |
| who is who and how people relate (fiction chapter: "Relations now") | `chart: "network"` (relations) | the main character (centre) |
| where each plotline moves across chapters | `chart: "threads"` (not in the recipes: a guide has no overview chapter to hold it) | none: a data chart |
| how concepts connect; what supports or weakens what | `chart: "network"` (concept map), `arrow: true` for direction | the central idea (centre) |
| kinds the book defines (three kinds of reality), each with a definition | `chart: "flow"`, one group per kind | the `key`: what the set means |
| kinds told apart by examples or features | `chart: "matrix"` (kinds as columns or rows) | the `focus` row, the `key` |
| rival views or uses of the same thing (naive and populist views) | `chart: "branches"` | the book's own view (`key`) |
| a chain of causes or steps; an argument from a question to a conclusion | `chart: "flow"` | the conclusion (`key`) |
| a process that feeds itself (vicious or virtuous circle) | `chart: "cycle"` | the node that drives the loop |
| two things contrasted point by point (X vs Y, before vs after) | `chart: "compare"` | the verdict (`key`) |
| 3–6 items compared on 2–4 features | `chart: "matrix"` | the verdict (`key`), a `focus` row |
| events or stages in order, with times the book gives | `chart: "timeline"` | the turning point |
| one situation, 2–4 possible outcomes or scenarios | `chart: "branches"` | the outcome the author argues for |
| nested levels or scopes (person in family in society) | `chart: "layers"` | the centre ring |
| real numbers the book gives | `chart: "bars"` | the `focus` bar |
| real places | `figure` from `scripts/map.py` + a `list` of places | the key place (section maps) |
| anything else that needs a drawing | `figure` (hand-made SVG, see below) | one `k` shape |

Every concept or distinction the book introduces gets one of these charts in the chapter that
introduces it (`references/concepts.md`). Vary the diagrams: the same chart kind on at most two chapters in a row (fiction scenes excepted).
Never put a chart in for decoration: if the chapter's idea has no structure to show, a short
`steps` or `points` screen is the honest choice, and the next chapter gets the chart.

## Rules for every chart

- **One key element** in the accent colour: the conclusion, the centre, the turning point. Data
  charts (bars, threads) have no key element; a bar chart may tint one bar with `focus`. Colour
  shows focus, never decoration.
- **Labels inside or on their shape**, short and in sentence case. No legends: a data chart gets a
  one-line `caption` saying what the marks mean (the app adds one to `threads` and `scenes`).
- **No numbers the book does not give**, no invented axes.
- **Real names**, as the book uses them, short form ("Mr Darcy", not "Fitzwilliam Darcy, Esq.").

## Fiction charts

### Scenes (`scenes`)

One block per chapter. The app shows it as a storyline chart: the scenes from top to bottom, one
line per person, and the lines meet in a band when people share a scene. A line starts when the
person enters the chapter and ends with a dot when they leave; dotted when they are there only at
a distance, faint when they are away for a scene. On a phone a number marks each band and the
scenes follow as a numbered list (the numbers match the bands); in the PDF the scene text is next
to its band.

```json
{ "type": "scenes",
  "people": [ { "name": "Mr Bennet" }, { "name": "Mrs Bennet" }, { "name": "Elizabeth" },
              { "name": "Mr Darcy", "tag": "New" }, { "name": "Mr Bingley", "tag": "New" } ],
  "focus": ["Elizabeth", "Mr Darcy"],
  "scenes": [
    { "text": "{Before the ball} Mr Bennet will not describe Bingley at [Longbourn]; the women hear of him from Lady Lucas.",
      "with": ["Mr Bennet", "Mrs Bennet", "Elizabeth"] },
    { "text": "{Later that night}, sitting out two dances at [the assembly], Elizabeth overhears Darcy refuse to dance with her.",
      "with": ["Elizabeth", "Mr Darcy", "Mr Bingley"], "key": true } ] }
```

- Order `people` so that people who meet sit next to each other: fewer lines cross.
- `focus`: the 1–2 people the chapter follows. The first (the main character) is drawn in ink, the
  second in the accent colour, the others grey. Set it on every chapter; without it, the first
  two people are the focus.
- Main characters first; at most 8 people on a phone (PDF-only: 12).
- 3–8 scenes; exactly one `key`. Weave in the time `{when}` and the place `[where]` the book gives
  (one of each, at least one); never invent one to fill a mark.

### Cast map and concept map (`chart: "network"`)

`centre` (1–2 names) sits in the middle. `nodes` sit on a ring around it, clockwise from the
top left: the first half across the top, the second half back along the bottom. So:

- **Put linked nodes next to each other** in `nodes`. A link between two ring nodes that are not
  neighbours crosses the middle; the validator reports it. Link such a person to the centre
  instead, or reorder.
- Keep a group together (family, household, school of thought) and give each node its group as
  `note`.
- Up to 10 ring nodes and 10 links on a phone; links labelled (≤ 4 words) where the relation is not
  obvious. `arrow: true` for a direction ("Causes", "Admires her").
- `check:screens` reports `chart overlap` when labels or nodes collide: shorten labels, drop the
  least important link, or move a node.

### Story threads (`chart: "threads"`)

`columns` are chapter numbers as strings ("1"… or "P", "E"); each thread lists the columns where
it `appears` and its `major` developments (also in `appears`). Names ≤ 3 words that never say how
a thread ends. Give each a `text`: the app adds the thread list after the chart.

## Non-fiction charts

- **Flow**: one group is a chain (3–4 items); two or three groups side by side make an argument
  map (`start` = the question, groups = the parts, `key` = the answer). Items ≤ 7 words.
- **Cycle**: 3–6 nodes; the last leads back to the first. `centre`: a short note ("The loop feeds
  itself"). Mark the node that drives the loop `key`.
- **Compare**: the same rows on both sides; `negative` greys the side the author rejects.
- **Matrix**: features as columns (one or two words each), items as rows; `focus` tints the row
  the chapter is about.
- **Timeline**: only times the book gives; without dates, use the book's order words ("First",
  "Then"). One `key`.
- **Branches**: `start` = the situation; options with a short `text`; `negative` for outcomes the
  author warns against, `key` for the one argued for.
- **Layers**: outer ring first; the last ring is the centre (key).
- **Bars**: real numbers from the book only; `caption` says where they come from.

## Hand-made figures (`figure`)

Only when no chart kind fits. Draw for a phone: `viewBox="0 0 340 H"`, H up to about 500; one
figure per screen; text ≥ 12 units. Use the app's classes only (no `style`, no colours):

| Shapes and marks | Use | Text | Use |
|---|---|---|---|
| `bx` | neutral box | `t1` | box titles (14 px bold) |
| `bt` | tinted box, pill | `t2` | labels, notes (12 px) |
| `k` | the key element (one only) | `t4` | small notes (10 px, grey) |
| `bn` | negative, cost, failure | `tn` | side note (italic, grey) |
| `bi` | dark box (central power) | `ta` | accent bold |
| `bg` | dashed: unknown, future | `tw` | text on `k` and `bi` |
| `ln` / `la` | plain line / accent line | `tb` | bold |
| `ar` / `ara` | grey / accent arrow | `c` / `e` | centred / right-aligned |

Boxes `rx="12"`, pills fully round. Arrows: `<line class="ar" …/>` (the arrow head is built in).
The app removes scripts, event attributes, `style`, links and images.

## Maps (real places only)

1. Write `work/<id>/map1.json`:
   `{"id": "m1", "mode": "overview", "places": [{"n": 1, "name": "Bath", "country": "United Kingdom"}, {"n": 2, "label": "The Peak District", "lat": 53.3, "lon": -1.8}]}`
   (`name` + `country` looks the place up in `assets/geo/places.csv`; a region or a place not
   found takes `label`, `lat`, `lon`). `"mode": "section"` with one `"key": true` for a chapter map.
2. `python3 -I .claude/skills/ghostreader-book/scripts/map.py work/<id>/map1.json --out work/<id>/map1.svg`
   (`--width 640` for a PDF-only map). Check the coordinates it prints.
3. Put the SVG text in a `figure` (`"svg"`), with `alt` and the caption "Today's borders; places
   from outside the book", then a `list` "Places" (number, the book's name for the place, what
   happens there, `meta` "Ch 3").

Only places the book names; numbers in order of first appearance; at most 12 places per map.
