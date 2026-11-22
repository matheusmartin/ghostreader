# Styles

The app's main job is to help a reader **go back to a book after a long pause**: remember what
happened or what was argued, remember the concepts, and continue with the same line of thought. A
style is a way to summarise for that job. The type (Story guide, Reading guide, Book summary) says
what the book is; the style says how the guide summarises it. Every style keeps the same rules:
book content only, the book's own parts and chapters only (no overview or other guide-made
chapter), anchors, the concept inventory, the limits of `src/model/lint.ts`, and the checks.

**Every guide is written in all four styles**, one file each, so the reader can choose and switch:
`src/books/<guide>-map.json`, `-recap.json`, `-recall.json`, `-layers.json`, each with
`"guide": "<guide>"` and its `"style"`. The library shows one tile per guide with a button for
each style (the choice is kept on the device); the reader's menu switches style at the same
chapter; the cover and the PDF name show the style ("Book summary · Recap"). `npm test` fails when
a guide lacks a style, or when the styles differ in title, author or chapters.

How to write them: the Map file first (the recipes in `references/guides.md`, which end with the
resume screens below), then a styles file with the texts only the other styles need, then
`scripts/build_styles.py`, which builds the Recap, Recall and Layers files from both (see "The
styles file" below).

## The resume rule: open the last chapter you read

After a pause, the reader opens **the last chapter they read**, in any style, and swipes through
it: first they try to remember (Recall) or see the frame (Recap, Layers), then the chapter's
summary and diagrams correct what they remember, and **the chapter ends with the state of play**
just before they go back to the book. Every screen of a chapter holds only that chapter and the
chapters before it, so nothing tells the reader about a chapter they have not read.

Every written chapter, in every style, ends with these two screens (the Map file has them;
`build_styles.py` copies them to the other styles; `npm run validate` checks them):

| Screen | Content |
|---|---|
| `points` "Where it stands" | Exactly four items, with these titles in this order (the validator checks them). Fiction: **When and where** (story time and place at the chapter's end) · **Who is there** (the people present at the end, each with a role: "Mr Collins, the cousin who will inherit Longbourn") · **What they want** (goals the book states, as known now) · **What just happened** (the chapter's last turn, as cause and effect). Non-fiction: **The question** (the book's question, in the same words in every chapter) · **Established so far** (one short clause per earlier part, then the earlier chapters of this part) · **This chapter adds** (the chapter's claim, with its because or so) · **Where it stops** (the chapter's last step, or the bridge the author gives to what comes next). Each text ≤ 25 words |
| `list` "Still open" | 1–3 rows: questions the book itself has raised by the end of this chapter and not yet answered. `name` ≤ 5 words, `text` the question ≤ 16 words. Fiction: the stakes the characters face ("Will Jane see Bingley again?"), never a hint of what happens. Non-fiction: open questions, and what the author says a later chapter will show ("Can computer networks correct their own errors?"). Leave the screen out only when nothing is open (often the last chapter) |

Both screens show in the app and in the PDF (no `only`) and stand after the PDF-only blocks, so
they are the chapter's last block in the PDF too. They come from the ledger (`SKILL.md` step 5):
the state of each person or of the argument at the chapter's end, with anchors.

## Must carry in every style

Each style shows only some of the Map chapter's screens: Recall and Layers show its main chart,
not its other charts. So every must-carry item (`SKILL.md` step 5) must be on a screen **each**
style shows, or in each style's own texts:

| Screen | Map | Recap | Recall | Layers |
|---|---|---|---|---|
| "In short" | yes | | yes | |
| "Key points" | yes | | yes | yes ("In three points") |
| "The logic" | yes | | | yes ("In detail") |
| the main chart (`main`) | yes | yes | yes | yes |
| "Where it stands", "Still open" | yes | yes | yes | yes |
| own texts in styles.json | | before, recap, moments, remember | questions 1–2 and answers | line |

A fact kept only in a second Map chart, an example box or a PDF-only block is missing from
Recall and Layers. Put it in "Key points" (shown by three styles) first; then in "In short" or a
Recall answer, and in "The logic" for Layers; then in the Recap texts. The blind recall test
(`references/verify.md`) checks each style.

## Research basis

| Style or screen | In one line | Best when | Research it rests on |
|---|---|---|---|
| **Map** | Diagrams first: each idea as a chart | You remember best what you see; complex arguments, many links | Words with pictures beat words alone, in short lessons tested soon after (Mayer, multimedia principle); studying concept maps helps a little more than studying text (Nesbit and Adesope 2006, g ≈ 0.37, mostly science content) |
| **Recap** | The story so far, in short prose | You want to be back in the book in two minutes | Reading a summary of the main points kept them as well as reading the full text, at tests from 20 minutes to 6–12 months (Reder and Anderson 1980); spoiler-free recaps to the reading position (Kindle "Story So Far", 2026) |
| **Recall** | Questions first, answers on a tap | You want it to stick, and accept a little effort | Retrieval practice beats rereading after a day or more (Roediger and Karpicke 2006; Rowland 2014, g ≈ 0.69 at delays of a day or more), but only with feedback: always show the answer (without feedback and with low success, g ≈ 0.03). Cued questions work better than free recall (g 0.61 v 0.29). One spaced repeat of an earlier question per chapter |
| **Layers** | One line, then three points, then the detail | You want to choose how deep to go | Readers preferred a hierarchy of summaries to a flat one and learned about as much (Christensen et al. 2014: a preference, not a memory gain); headings and summaries help readers keep the structure of a text the author signals (Lorch and Lorch) |
| **Where it stands** | The state of play at the chapter's end | Every style: the screen to read before you go back to the book | Readers link events by time, place, protagonist, cause and goal (event-indexing model: Zwaan et al. 1995, Zwaan and Radvansky 1998); after an interruption, restating the last lines read (Glanzer et al. 1984) or the topic (Lorch 1993) speeds reading again, so give both the frame and the last step; names fade before roles (Stanhope et al. 1993), so every name has a role; events on the causal chain are remembered best (Trabasso and van den Broek 1985) |
| **Still open** | The questions the book has raised and not answered yet | Every style: the pull back into the book | An unfinished task draws people back to it (Ovsiankina effect, supported; the Zeigarnik memory effect is not: Ghibellini and Meier 2025, meta-analysis); after an interruption, a preview of what comes next helped comprehension more than a review (Srivastava et al. 2021) |

No study has tested book recaps after a pause of days or months: the evidence comes from short
interruptions, studies of how memory for texts fades, and learning science. Fresh evidence goes
here only after the source is checked.

## No overview chapter

No style adds a chapter of its own: every file has exactly the book's parts and chapters. What
helps a reader resume sits inside the chapters: "Where it stands" and "Still open" at the end of
each, Recap's "Before this chapter", Recall's "Try to remember", Layers' "The argument so far".
With a limit (`upTo`), nothing in any chapter looks past the limit.

## Map

The recipes in `references/guides.md`: summary, the chapter's diagrams, key points, the logic,
examples, then the PDF-only blocks, then the resume screens.

## Recap

| Screen | Limit |
|---|---|
| `summary` "Before this chapter" | everything before this chapter, ≤ 50 words, no takeaway; not in the first chapter. First the frame: the book's question or the story's main situation, in the same words each time, then one clause per earlier part; then one or two sentences on the chapter just before. Written from the fact sheets and the ledger, never from earlier "before" texts (errors grow when summaries are made from summaries) |
| `text` "Recap" | the chapter retold as causes ("because", "so"), two short paragraphs, ≤ 120 words, at most six names, each with a role at its first mention |
| `list` "Key moments" | 4–6 rows: examples, scenes or claims in book order, ≤ 18 words, taken from the whole chapter (the start and the middle too, not only the end) |
| the chapter's diagram | one chart (fiction: the scenes chart) |
| `points` "Remember" | 2–3 concepts or people introduced, ≤ 25 words |
| PDF: `text` "The chapter in full", `list` "Terms" | as in the Map recipes |
| "Where it stands", "Still open" | copied from the Map chapter |

## Recall

| Screen | Limit |
|---|---|
| `quiz` "Try to remember" | first. The script takes the chapter's first two questions and, from the second written chapter on, the third question of the chapter two before, as "From Chapter 3: …" (in the first chapter, all three). Answers ≤ 30 words |
| `summary` "In short" + takeaway | the check: 2 sentences ≤ 40 words |
| the chapter's diagram | one chart |
| `points` "Key points" | 3 |
| PDF: `text` "The chapter in full", `list` "Terms" | as in the Map recipes |
| "Where it stands", "Still open" | copied from the Map chapter |

**Questions.** Cued and specific: one fact, cause or distinction the reader can retrieve, with a
cue from the chapter (a name, an example, a term): "Why did Cher Ami's message save the
battalion?", not "What is the chapter about?". Ask about causes and states more than lists. Each
answer comes from the chapter and its anchor. Question 3 is asked again two chapters later with
the prefix "From Chapter N:", so keep it ≤ 20 words and make it the chapter's core point.

## Layers

| Screen | Limit |
|---|---|
| `summary` "In one line" | one sentence, ≤ 20 words, no takeaway |
| `points` "In three points" | exactly 3, ≤ 25 words |
| `chart` "The argument so far" | `flow`, built by the script: `start` = the book's question; items = one point per finished part, then the points of the current part's earlier chapters, four at most (the frame is kept, older chapters of the part drop out first); `key` = this chapter's point |
| the chapter's diagram | one chart |
| `steps` "In detail" | 5 steps; the last is the conclusion |
| PDF: `text` "The chapter in full", `list` "Terms" | as in the Map recipes |
| "Where it stands", "Still open" | copied from the Map chapter |

## The styles file

`work/<guide>/styles.json`, written from the fact sheets and the ledger like the Map file (book
content only, no quotations, the same limits). `scripts/build_styles.py` reads it with the Map
file:

```json
{
  "question": "Why is a wise species so self-destructive?",
  "first_items": ["Sapiens gained power through networks", "Networks bind members with fictions"],
  "parts": { "part-1": "Networks need stories and lists" },
  "chapters": {
    "ch2": {
      "main": "Three kinds of reality",
      "before": "Harari asks why a wise species is so self-destructive. Chapter 1: information …",
      "line": "Shared stories let strangers cooperate and create realities between minds.",
      "point": "Stories create shared realities",
      "key": "Order built on fiction often clashes with truth",
      "recap": ["First paragraph …", "Second paragraph …"],
      "moments": [{ "name": "Bitcoin pizza", "text": "Two pizzas for 10,000 bitcoins in 2010 …" }],
      "remember": [{ "title": "Intersubjective reality", "text": "Laws, gods, nations and money …" }],
      "questions": [
        { "q": "Is a pizza's price objective, subjective or intersubjective?", "a": "Intersubjective …" },
        { "q": "…", "a": "…" },
        { "q": "Why can shared stories make strangers cooperate?", "a": "…" }
      ]
    }
  }
}
```

| Field | Used by | Content |
|---|---|---|
| `question` | Layers | `start` of every "argument so far" chart: the book's question (≤ 12 words). The same words as "The question" in "Where it stands" |
| `first_items` | Layers | items of the first chapter's "argument so far" chart (≤ 7 words each) |
| `parts` | Layers | the point of each part with two or more chapters (≤ 7 words), by part id; a one-chapter part (a prologue) uses its chapter's `point`. Or `part_point` in the part's last chapter entry |
| `first_items` in the first chapter entry | Layers | the same as the top-level `first_items`, when a model writes one chapter entry at a time (`prompts/write-styles.md`) |
| `chapters.<id>` | all three | one entry per written chapter (the script stops when one is missing) |
| `main` | all three | label of the chapter's main diagram in the Map file (default: its first chart or scenes) |
| `before` | Recap | "Before this chapter", ≤ 50 words: frame, then the chapter before; leave out in the first chapter |
| `line` | Layers | the chapter in one sentence ("In one line"), ≤ 20 words |
| `point`, `key` | Layers | the point the chapter adds (≤ 7 words, an item of later charts) and its conclusion (≤ 10 words) |
| `recap`, `moments`, `remember` | Recap | as in the Recap recipe |
| `questions` | Recall | exactly three, as in the Recall recipe; the third is asked again two chapters later |

The script copies the Map file's parts and chapters as they are and adds nothing: it stops when
the Map file has a guide-made chapter (number `S`, `B`, `K`, `W`, `T` or `M`) or a chapter without
"Where it stands". Fix a diagram, a key point, PDF detail or a resume screen in the Map file and
run the script again: the other files are generated and never edited by hand.
