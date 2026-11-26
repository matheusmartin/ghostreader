# Visuals

Seeing is faster than reading when the picture shows how ideas fit. A diagram earns its place by
showing relations (by arrows, places and groups) that text can only list one after another. Text
carries what a picture cannot: the point of the chapter in two sentences, the meaning of a term, a
test question.

The fields of every type are in `docs/content-format.md`. This page says how to turn the book's
relations into diagrams, which chart fits which shape, and how to make it read well. The app draws
every chart from data, in the theme the reader chose, on a phone and (wider, with more room) in
the PDF; there is nothing to lay out by hand.

## From relations to diagrams

A student who studies a chapter writes its outline, then draws the parts that are hard to hold in
words. The guide does the same, from the fact sheet's outline, examples and relations
(`references/concepts.md`):

1. **The outline.** The chapter's claims in its own order, with the concepts and examples under
   the claim each serves. In a Book summary it is the mind map "The chapter at a glance" (Key
   moments, below).
2. **Group the relations.** Relations that share items, and answer one question the chapter asks,
   form a group: how stories build networks; why order often wins over truth. Each group is a
   candidate diagram.
3. **The shape of the group picks the chart**, not the kind of concept: a chain, a web, a loop, a
   tree, two sides (the table below).
4. **Examples go with their claim**, in the same diagram: evidence under the claim it supports, a
   counter-example next to the view it refutes, an illustration with its concept (a mind map leaf,
   a node's `note`, a matrix row).
5. **The author's stance is part of the picture**: `key` for what the book argues for, `negative`
   for what it rejects, and the book's reason where the chart has room (a row, a link label, an
   option's text).
6. **Each relation once per chapter**, in the diagram where it fits best. The mind map may name a
   concept that a later diagram draws in full, but no two diagrams show the same links.
7. **The chapter's order.** Diagrams follow the order in which the chapter takes up their
   questions, so a reader who remembers "first it was about X" finds X first.
8. **A map that grows.** When a chapter extends or revises an earlier concept, draw the earlier
   diagram again, with the same chart kind and labels, and mark the new part as the key element. A
   concept from an earlier chapter that a diagram needs as context carries `note: "Ch 2"`.

### The usefulness test

Keep a diagram only when all four hold:

- It shows at least one relation, by an arrow, a place or a group, that the Recap can only state.
- A student who read the chapter would know it as the chapter's own structure, not one the guide
  imposed on it.
- Every box is the book's concept, claim or example, in the book's words.
- No other diagram of the chapter shows the same links.

A group that fails goes into words: the Recap, In short or a key point. No number of diagrams, and
no number of any chart kind, is set: a chapter gets one diagram for each group of relations that
passes. (A Book summary's Key moments always open with the mind map and the argument; the
validator asks for those two.) Diagrams that do not serve the point cost the reader attention and
lower learning (Mayer, coherence principle).

## Which chart for which shape

| The relations form… | Chart | Key element (accent) |
|---|---|---|
| a chain: each step leads to the next (causes; an argument from a question to a conclusion) | `chart: "flow"` | the conclusion (`key`) |
| two or three chains side by side (two ways, two mechanisms, the parts of an argument) | `chart: "flow"`, one group each | the `key` |
| a web: one item with three or more links, or links that cross; what supports or weakens what | `chart: "network"` (concept map), `arrow: true`, link labels | the central item (centre) |
| a loop: the last step feeds the first (vicious or virtuous circle) | `chart: "cycle"` | the node that drives the loop |
| a tree: a topic, its parts or kinds, and their examples | `chart: "mindmap"` | the main branch (`key`) |
| kinds, each with a definition and examples (three kinds of reality) | `chart: "flow"`, one group per kind | the `key`: what the set means |
| kinds told apart by examples or features | `chart: "matrix"` (kinds as columns or rows) | the `focus` row, the `key` |
| nesting: levels inside levels (person in family in society) | `chart: "layers"` | the centre ring |
| two things or positions, point against point, with the book's reason | `chart: "compare"`, the reason as a row | the verdict (`key`) |
| one situation and its possible outcomes, or rival answers to one question | `chart: "branches"` | the book's own answer (`key`) |
| items placed on two dimensions the book names (centralised to distributed, weak to strong) | `chart: "xy"`, scale mode | the item the chapter is about (`key`) |
| stages in time, with the times the book gives | `chart: "timeline"` | the turning point |
| real numbers the book gives | `chart: "bars"`; two kinds of number for the same items: `chart: "xy"`, `"mode": "data"` | the `focus` bar, the `key` point |
| fiction: who is in which scene, who meets whom | `scenes` | the turning-point scene |
| fiction: who is who and how people relate ("Relations now") | `chart: "network"` (relations) | the main character (centre) |
| fiction: where each plotline moves across chapters | `chart: "threads"` (not in the recipes: a guide has no overview chapter to hold it) | none: a data chart |
| real places | `figure` from `scripts/map.py` + a `list` of places | the key place (section maps) |
| any other shape | `figure` (hand-made SVG, see below) | one `k` shape |

When a group fits two shapes, choose the one that shows its main relation. A contrast whose two
sides each lead somewhere is two chains (`flow`, two groups), not a table; a contrast of features
with no links between them is a `compare`. A web drawn as a list of boxes loses its links: draw it
as a `network`.

## Key moments (Book summary)

The section where the chapter's structure is drawn. Diagrams only: no text, points, list or quiz
screen.

1. **The chapter at a glance**: a `mindmap`, the chapter's outline. `centre` = the chapter's
   question or topic (≤ 8 words). `branches` = its main claims or concepts, in the order the
   chapter takes them, in the book's words, each with a short `note` (≤ 5 words: the definition or
   the point). `leaves` = what serves each branch (≤ 5 words): the book's examples, and a concept
   that is a means, a kind or a part of the branch, with its example after a colon ("Brands:
   Stalin, Cher Ami"). A concept that serves another goes under it, never beside it. One `key`
   branch: the chapter's main concept.
2. **The argument**: a `flow` from `start` = the chapter's question, through the steps the book
   takes, to `key` = its conclusion. Each step follows from the one before, or answers it. Test:
   say the link between two steps ("so", "because", "but stories lift that limit"); when only
   "and" fits, the flow is a list of topics, not an argument. A chapter with two lines of argument
   gets two groups side by side.
3. **Then one diagram for each group of relations** that passes the usefulness test, in the
   chapter's order ("From relations to diagrams", above). PDF-only diagrams may draw a group in
   more detail.
4. **x/y charts** place items only on dimensions the book itself names, at positions the book
   describes (0–4: none, little, some, much, most; never a measurement it does not give), with a
   `caption` saying so. `arrows` show a change the book describes ("mass media"). A point's `side`
   moves its label when the screen check reports an overlap.

Example (Nexus, Chapter 2). Weak: the mind map sets "Brands" and "Fake memories" beside
"Intersubjective reality", though both are ways stories link strangers; "The argument" runs
"Stories link strangers → Stories create realities between minds → Fiction keeps order more
easily", three topics joined only by "and"; "Truth and order" comes back in five diagrams. Better:
"Brands: Stalin, Cher Ami" and "Fake memories: Passover" as leaves under "Human-to-story chains";
the argument as a chain ("Personal bonds stop at a few hundred" → "Stories link strangers who
share them" → "Strangers cooperate in unlimited numbers"); truth and order in one diagram; the
chimpanzees as the book's reason, a row of "Stories or interests?", next to the Marxist view it
refutes.

## Rules for every chart

- **One key element** in the accent colour: the conclusion, the centre, the turning point. Data
  charts (bars, threads) have none. Colour shows focus, never decoration.
- **Labels inside or on their shape**, short and in sentence case. No legends: a data chart gets a
  one-line `caption` saying what the marks mean (the app adds one to `threads` and `scenes`).
- **No numbers the book does not give**, no invented axes.
- **Real names**, as the book uses them, short form ("Mr Darcy", not "Fitzwilliam Darcy, Esq.").
- **Links from the fact sheet.** Every arrow, link label and grouping is a relation or an example
  line of the fact sheet (`references/concepts.md`); draw no link the sheet does not hold.

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

- **Network (concept map)**: link labels are the link words of the fact sheet's relations;
  `arrow: true` on every relation with a direction (causes, needs, limits, corrects); a node from an
  earlier chapter carries `note: "Ch 2"`.
- **Flow**: one group is a chain (3–4 items); two or three groups side by side make an argument
  map (`start` = the question, groups = the parts, `key` = the answer). Items ≤ 7 words.
- **Cycle**: 3–6 nodes; the last leads back to the first. `centre`: a short note ("The loop feeds
  itself"). Mark the node that drives the loop `key`.
- **Compare**: the same rows on both sides; `negative` greys the side the author rejects; when the
  book gives a reason for its verdict (evidence, a counter-example), it gets a row.
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
