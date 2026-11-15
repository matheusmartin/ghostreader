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

Each chapter's fact sheet has a section `## Concepts and distinctions`, one line per item:

```
## Concepts and distinctions
- {Three kinds of reality} typology · explicit · objective (exists whatever people think: stones) /
  subjective (in one mind: pain) / intersubjective (between many minds: money, nations) · 011 p22–p25
- {Truth versus order} contrast · explicit · every network must both find truth and keep order;
  order is often easier with fiction · 011 p59–p62
- {Distributed versus centralised networks} contrast · indirect · democracy spreads information
  among independent nodes; dictatorship sends it to one hub · 014 p4–p9
```

`{name}` in the book's words · kind (concept, typology, contrast, views, fiction) · explicit or
indirect · the members with a definition and an example each, in your own words · anchor.

Then, in the plan (step 4, kept as a list in `work/<id>/concepts.md`), gather every item from every
fact sheet into one **concept inventory**, in book order, with the chapter that introduces each. A
concept that later chapters build on is marked **core**: it goes into the overview's charts.

## Show it (step 6)

Every distinction (contrast, typology, views) gets a chart in the chapter that introduces it: the
chapter's diagram, or one more chart in that chapter. A defined concept gets a chart when it has a
shape to show (kinds, parts, causes, links); otherwise a key point names it. A minor item, met in
one or two paragraphs and never built on, needs only its row in K · Key concepts. Choose the chart
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

- **K · Key concepts** (overview chapter, non-fiction; `references/guides.md`): the core items as
  charts, and every item as a row in a `list` "Key concepts" (name in the book's words, a
  definition ≤ 18 words, `meta` the chapter: "Ch 2"). The app list holds up to 8 rows; a fuller
  `only: "pdf"` list holds all of them.
- **Points and terms** may name a concept again, but a concept that appears only in text has not
  been shown: it still needs its chart.
- With a limit (`upTo`): only concepts introduced up to the limit, in the chapters and in K.

## Check it (step 7)

Go through the inventory line by line and find each item on a screen: its chart in the chapter
that introduces it (minor items excepted), and its row in K · Key concepts. Add what is missing. Then read the chapter's
text once more for a distinction you did not record: a pair of terms set against each other more
than once is the most common miss.
