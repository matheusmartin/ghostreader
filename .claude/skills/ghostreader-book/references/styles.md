# Styles

The app's main job is to help a reader **go back to a book after a long pause**: remember what
happened or what was argued, remember the concepts, and know where they stopped. A style is a way
to summarise for that job. The type (Story guide, Reading guide, Book summary) says what the book
is; the style says how the guide summarises it. Every style keeps the same rules: book content
only, the book's own parts and chapters only (no overview or other guide-made chapter), anchors,
the concept inventory, the limits of `src/model/lint.ts`, and the checks.

**Every guide is written in all four styles**, one file each, so the reader can choose and switch:
`src/books/<guide>-map.json`, `-recap.json`, `-recall.json`, `-layers.json`, each with
`"guide": "<guide>"` and its `"style"`. The library shows one tile per guide with a button for
each style (the choice is kept on the device); the reader's menu switches style at the same
chapter; the cover and the PDF name show the style ("Book summary · Recap"). `npm test` fails when
a guide lacks a style, or when the styles differ in title, author or chapters.

How to write them: the Map file first (the recipes in `references/guides.md`), then a styles file
with the texts only the other styles need, then `scripts/build_styles.py`, which builds the Recap,
Recall and Layers files from both (see "The styles file" below).

| Style | In one line | Best when | Research it rests on |
|---|---|---|---|
| **Map** | Diagrams first: each idea as a chart | You remember best what you see; complex arguments, many links | Words with graphics beat words alone (Mayer, multimedia principle); studying concept maps helps (Nesbit and Adesope 2006, g ≈ 0.37) |
| **Recap** | The story so far, in short prose, up to where you stopped | You want to be back in the book in two minutes | Spoiler-free recaps to the reading position (Kindle "Story So Far", 2026); restating the last part read helps resumption more than the general theme (LeDoux and Gordon 2006); summaries keep main points better than full texts (Reder and Anderson 1980) |
| **Recall** | Questions first, answers on a tap | You want it to stick, and accept a little effort | Retrieval beats rereading on delayed tests (Roediger and Karpicke 2006); questions before review improve memory of what they ask, even when answered wrongly (pretesting research) |
| **Layers** | One line, then three points, then the detail | You want to choose how deep to go | Readers prefer a hierarchy of summaries to a flat one and learn as much (Christensen et al. 2014: 92% preferred it); readers scan overviews, then section summaries, then detail |

## No overview chapter

No style adds a chapter of its own: every file has exactly the book's parts and chapters. What
helps a reader resume sits inside the chapters: Recap's "Before this chapter" (everything before
it), Recall's "Try to remember" questions, Layers' "The argument so far" chart. With a limit
(`upTo`), nothing in any chapter looks past the limit.

## Map

The recipes in `references/guides.md`, unchanged: summary, the chapter's diagrams, key points,
the logic, examples.

## Recap

**Chapters**
| Screen | Limit |
|---|---|
| `summary` "Before this chapter" | everything before this chapter, ≤ 50 words, no takeaway; not in the first chapter. The screen to read when you resume here |
| `text` "Recap" | the chapter retold in order, two short paragraphs, ≤ 120 words |
| `list` "Key moments" | 4–6 rows: examples, scenes or claims in book order, ≤ 18 words |
| the chapter's diagram | one chart (fiction: the scenes chart) |
| `points` "Remember" | 2–3 concepts or people introduced, ≤ 25 words |
| PDF: `text` "The chapter in full", `list` "Terms" | as in the Map recipes |

## Recall

**Chapters**
| Screen | Limit |
|---|---|
| `quiz` "Try to remember" | first: 3 questions on the chapter's main points; answers ≤ 30 words |
| `summary` "In short" + takeaway | the check: 2 sentences ≤ 40 words |
| the chapter's diagram | one chart |
| `points` "Key points" | 3 |
| PDF: `text` "The chapter in full", `list` "Terms" | as in the Map recipes |

## Layers

**Chapters**
| Screen | Limit |
|---|---|
| `summary` "In one line" | one sentence, ≤ 20 words, no takeaway |
| `points` "In three points" | exactly 3, ≤ 25 words |
| `chart` "The argument so far" | `flow`: `start` = the book's question; items = earlier chapters' points (the last three or four); `key` = this chapter's point |
| the chapter's diagram | one chart |
| `steps` "In detail" | 5 steps; the last is the conclusion |
| PDF: `text` "The chapter in full", `list` "Terms" | as in the Map recipes |

## The styles file

`work/<guide>/styles.json`, written from the fact sheets like the Map file (book content only, no
quotations, the same limits). `scripts/build_styles.py` reads it with the Map file:

```json
{
  "question": "Why is a wise species so self-destructive?",
  "first_items": ["Sapiens gained power through networks", "Networks bind members with fictions"],
  "chapters": {
    "ch2": {
      "main": "Three kinds of reality",
      "before": "So far: networks give power faster than wisdom, and information …",
      "line": "Shared stories let strangers cooperate and create realities between minds.",
      "point": "Stories create shared realities",
      "key": "Order built on fiction often clashes with truth",
      "recap": ["First paragraph …", "Second paragraph …"],
      "moments": [{ "name": "Bitcoin pizza", "text": "Two pizzas for 10,000 bitcoins in 2010 …" }],
      "remember": [{ "title": "Intersubjective reality", "text": "Laws, gods, nations and money …" }],
      "questions": [{ "q": "Is a pizza's price objective, subjective or intersubjective?", "a": "Intersubjective …" }]
    }
  }
}
```

| Field | Used by | Content |
|---|---|---|
| `question` | Layers | `start` of every "argument so far" chart: the book's question (≤ 12 words) |
| `first_items` | Layers | items of the first chapter's "argument so far" chart (≤ 7 words each) |
| `chapters.<id>` | all three | one entry per written chapter (the script stops when one is missing) |
| `main` | all three | label of the chapter's main diagram in the Map file (default: its first chart or scenes) |
| `before` | Recap | "Before this chapter", ≤ 50 words; leave out in the first chapter |
| `line` | Layers | the chapter in one sentence ("In one line"), ≤ 20 words |
| `point`, `key` | Layers | the point the chapter adds (≤ 7 words, an item of later charts) and its conclusion (≤ 10 words) |
| `recap`, `moments`, `remember` | Recap | as in the Recap recipe |
| `questions` | Recall | three, as in the Recall recipe |

The script copies the Map file's parts and chapters as they are and adds nothing: it stops when
the Map file has a guide-made chapter (number `S`, `B`, `K`, `W`, `T` or `M`). Fix a diagram, a
key point or PDF detail in the Map file and run the script again: the other files are generated
and never edited by hand.
