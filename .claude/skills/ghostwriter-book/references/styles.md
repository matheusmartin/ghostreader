# Styles

The app's main job is to help a reader **go back to a book after a long pause**: remember what
happened or what was argued, remember the concepts, and know where they stopped. A style is a way
to summarise for that job. The type (Story guide, Reading guide, Book summary) says what the book
is; the style says how the guide summarises it. Every style keeps the same rules: book content
only, anchors, concept inventory and K · Key concepts (or W · Who's who for fiction), the limits
of `src/model/lint.ts`, and the checks.

Set it in the book file: `"style": "recap"`. Without `style` the guide is a Map. The library, the
cover and the PDF name show the style ("Reading guide · Recap · to Chapter 3").

| Style | In one line | Best when | Research it rests on |
|---|---|---|---|
| **Map** (default) | Diagrams first: each idea as a chart | You remember best what you see; complex arguments, many links | Words with graphics beat words alone (Mayer, multimedia principle); studying concept maps helps (Nesbit and Adesope 2006, g ≈ 0.37) |
| **Recap** | The story so far, in short prose, up to where you stopped | You want to be back in the book in two minutes | Spoiler-free recaps to the reading position (Kindle "Story So Far", 2026); restating the last part read helps resumption more than the general theme (LeDoux and Gordon 2006); summaries keep main points better than full texts (Reder and Anderson 1980) |
| **Recall** | Questions first, answers on a tap | You want it to stick, and accept a little effort | Retrieval beats rereading on delayed tests (Roediger and Karpicke 2006); questions before review improve memory of what they ask, even when answered wrongly (pretesting research) |
| **Layers** | One line, then three points, then the detail | You want to choose how deep to go | Readers prefer a hierarchy of summaries to a flat one and learn as much (Christensen et al. 2014: 92% preferred it); readers scan overviews, then section summaries, then detail |

## Where you stopped: overview chapter `S`

Recap, Recall and Layers open with an overview chapter numbered `S`, before `K`. It covers
everything up to the limit (`upTo`), or the whole book for a Book summary, and never anything
after it.

## Map

The recipes in `references/guides.md`, unchanged. Overview: the type's chapters (B, K; W, T, M
for fiction). Chapters: summary, the chapter's diagrams, key points, the logic, examples.

## Recap

**S · Where you stopped**
1. `summary` "The story so far": the book up to the limit in ≤ 50 words (fiction: what has
   happened; non-fiction: the argument so far). Takeaway "Keep in mind": the one idea to carry on
   with.
2. `list` "Chapter by chapter": one row per chapter covered, name "03 · Short title", ≤ 18 words.
   More than eight chapters: split the list, or group by part.
3. `summary` "Where you stopped": the end of the last chapter covered, in more detail (≤ 50
   words). Takeaway "Next in the book" only when the text itself says what comes next.
4. `chart` "The argument so far" (`flow`) or, for fiction, "Characters so far" (`network`).
5. `list` "Open questions": questions or threads the book has raised and not yet answered, as
   the text raises them (`meta`: the chapter). Never guess at answers.

**Chapters**
| Screen | Limit |
|---|---|
| `text` "Recap" | the chapter retold in order, two short paragraphs, ≤ 120 words |
| `list` "Key moments" | 4–6 rows: examples, scenes or claims in book order, ≤ 18 words |
| the chapter's diagram | one chart (fiction: the scenes chart) |
| `points` "Remember" | 2–3 concepts or people introduced, ≤ 25 words |
| PDF: `text` "The chapter in full", `list` "Terms" | as in the Map recipes |

## Recall

**S · Warm-up**
1. `quiz` "Warm-up" screens, three questions each: at least one per chapter covered and two or
   three on the last chapter. Questions about the main points, not trivia.
2. `summary` "Where you stopped", as in Recap, after the questions.

**K · Key concepts** (fiction: W · Who's who): the core charts, then `quiz` "Concept cards"
(question "What is …?", answer = the definition) in screens of three. The full list stays as a
PDF-only `list`.

**Chapters**
| Screen | Limit |
|---|---|
| `quiz` "Try to remember" | first: 3 questions on the chapter's main points; answers ≤ 30 words |
| `summary` "In short" + takeaway | the check: 2 sentences ≤ 40 words |
| the chapter's diagram | one chart |
| `points` "Key points" | 3 |
| PDF: `text` "The chapter in full", `list` "Terms" | as in the Map recipes |

## Layers

**S · The book so far**
1. `list` "In one line each": one row per chapter, ≤ 12 words.
2. `summary` "In one paragraph": the book up to the limit, ≤ 50 words.
3. `chart` "The argument so far" (`flow`, groups by part).

**Chapters**
| Screen | Limit |
|---|---|
| `summary` "In one line" | one sentence, ≤ 20 words, no takeaway |
| `points` "In three points" | exactly 3, ≤ 25 words |
| `chart` "The argument so far" | `flow`: `start` = the book's question; items = earlier chapters' points (the last three or four); `key` = this chapter's point |
| the chapter's diagram | one chart |
| `steps` "In detail" | 5 steps; the last is the conclusion |
| PDF: `text` "The chapter in full", `list` "Terms" | as in the Map recipes |

## Choosing

Ask for the style with the other inputs; without an answer, write a Map. To compare styles, write
the same chapters in several styles as separate books (`<id>-map`, `<id>-recap` …) and let the
reader try them; then keep the one they choose.
