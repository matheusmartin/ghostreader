# Concepts and distinctions

A book's own concepts are the part of it a reader most needs to keep: the terms it defines, the
kinds it sorts things into, and the contrasts it builds its argument on. A guide must find every
one of them, record it with its anchor, and show it as a picture, not only name it in a sentence.

## What counts

| Kind | What it looks like in the text | Nexus |
|---|---|---|
| **Defined concept** | A term the author names and explains: "I call this…", "by X I mean…", a word in italics followed by a definition | Self-correcting mechanism; the alignment problem |
| **Typology** | A set of kinds: "three levels", "two types", "first… second… third…" | Objective, subjective and intersubjective reality |
| **Contrast** | Two things set against each other: "X, not Y", "unlike", "whereas", "on the one hand" | Information as representation versus information as connection |
| **Views or uses** | Rival ways to see or use the same thing, often each with a name | The naive and the populist views of information; information to find truth or to make order |
| **Indirect distinction** | A contrast the author builds across a chapter or the whole book without one sentence that names it: paired examples, the same two terms set against each other again and again | Distributed versus centralised networks, shown through democracy and dictatorship in many chapters |
| **Fiction: the story's own concepts** | Invented words, ranks, rules of a world, factions, a magic system, social codes the plot depends on | (Pride and Prejudice: the entail that passes Longbourn to Mr Collins) |

Leave out ordinary words used in their ordinary sense, and concepts the author only mentions in
passing. When unsure whether the author defines something or only uses it, check whether the
book explains it or builds on it later: if yes, it counts.

**Indirect distinctions** need the most care. Read for: two terms that keep coming back as a pair;
examples always given in twos (Chernobyl and Three Mile Island); a chapter structured as "the old
way, then the new way"; a conclusion that only makes sense if two things differ. Record the
distinction in the author's own terms; never name it with a term the book does not use or imply.

## Record it (step 5)

Each concept or distinction is a fact of type `concept` in the fact sheet of the chapter that
introduces it (`references/working-files.md`):

```json
{ "id": "F14", "type": "concept", "basis": "stated",
  "text": "Reality comes in three kinds: objective, subjective and intersubjective",
  "anchor": { "file": "011", "p": [22, 25], "quote": "…" },
  "concept": { "name": "Three kinds of reality", "kind": "typology", "mode": "explicit", "members": [
    { "name": "Objective", "definition": "Exists whatever people think", "example": "Stones" },
    { "name": "Subjective", "definition": "Exists in one mind", "example": "Pain" },
    { "name": "Intersubjective", "definition": "Exists between many minds", "example": "Money, nations" } ] } }
```

`name` in the book's words · `kind` (concept, typology, contrast, views, fiction) · `mode`
(explicit or indirect) · the members with a definition and an example each, in your own words ·
the anchor. A contrast has two members ("Distributed networks", "Centralised networks"), indirect
when the author builds it across a chapter without one sentence that names it.

Then `check_guide.py concepts <guide>` gathers every concept of every fact sheet into one
**concept inventory**, `work/<guide>/concepts.json`, in book order, with the chapter that
introduces each. Mark a concept that later chapters build on `"core": true`: it always gets a
chart in the chapter that introduces it, and later chapters may name it again in their points.
The script keeps the marks when it runs again.

## Show it (step 6)

Every distinction (contrast, typology, views) gets a chart in the chapter that introduces it: the
chapter's diagram, or one more chart in that chapter. A defined concept gets a chart when it has a
shape to show (kinds, parts, causes, links); otherwise a key point names it. A minor item, met in
one or two paragraphs and never built on, needs only a key point or its row in "Terms". Choose the chart
by the shape of the idea:

| Shape | Chart | How |
|---|---|---|
| Two things contrasted | `compare` | One column each; rows are the points of difference; `key` is what the difference means |
| Three to six kinds, each with a definition | `flow` with one group per kind (up to three) | Group label = the kind; items = definition, then examples; `start` names the set |
| Kinds told apart by examples | `matrix` | Columns = the kinds (one or two words each); rows = examples; one dot per row shows its kind; `focus` on the telling example |
| Kinds told apart by features | `matrix` | Rows = the kinds; columns = the features |
| Rival views or uses | `branches` | `start` = the question they answer; one option per view; `key` = the book's own view, `negative` = the views it rejects |
| Nested levels | `layers` | Outer to inner |
| A concept defined by its links to others | `network` | The concept in the centre |
| A sequence of stages the book names | `timeline` or `flow` | One item per stage, with the time the book gives |

Then:

- **No key concepts chapter.** The guide has only the book's own chapters
  (`references/guides.md`), so each concept lives in the chapter that introduces it: its chart,
  and its row in that chapter's PDF-only `list` "Terms" (name in the book's words, a definition
  ≤ 18 words). A minor item needs only the key point or the Terms row.
- **Points and terms** may name a concept again, but a concept that appears only in text has not
  been shown: it still needs its chart.
- **Stable cues.** A core concept keeps its inventory name, in the book's words, on every screen
  of every chapter and style; a later chart that shows it again uses the same chart kind and the
  same labels for its members (the three kinds of reality are always "Objective", "Subjective" and
  "Intersubjective", in the same order). A cue the reader learned must work again.
- With a limit (`upTo`): only concepts introduced up to the limit.

## Check it (step 7)

Run `check_guide.py concepts <guide>`: it reports each concept whose name (or the names of all
its members) is on no screen of the chapter that introduces it (GR-V05). Then go through the
inventory line by line and confirm the right kind of screen: its chart (minor items excepted), a
key point or its row in "Terms". Add what is missing. Then read the chapter's
text once more for a distinction you did not record: a pair of terms set against each other more
than once is the most common miss.
