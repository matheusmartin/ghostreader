# Content rules

## Book content only

Everything in a guide comes from the book: its text, its table of contents, its copyright page.
Its structure too: the guide has the book's parts and chapters, in the book's order, under the
book's names, and no chapter, part, section or label of its own (no overview, key concepts,
who's who, story threads, "the book in one page" or "where you stopped").

- Never add, mention or rely on information from outside the book, even when it is true:
  background, history, dates, numbers, people or places the book does not mention, the author's
  life, reviews, reception, sales, adaptations, comparisons with other books.
- Summaries and study guides may be used only to learn what the book says (summaries mode, below).
  Ignore their background, context and analysis sections.
- Takeaways and "why it matters" lines rest on what the book says or shows.
- Only exceptions: the year of first publication (`year`); map outlines and place positions (map
  captions say so).

## Accuracy

- **Confirmed details only.** Name a person, event, study, place, date or number only when the
  book file (with an anchor in the fact sheet), or a source describing the book's content,
  confirms it.
- **Book order and equal weight.** Every chapter gets the same screens and the same care; check
  middle and late chapters as carefully as the first ones. Never move an idea or event to a
  neighbouring chapter.
- **When in doubt, leave it out.** A detail with one weak source, from memory, or that interprets
  motives, feelings or causes beyond what the book shows does not go in the guide.

### Fiction needs extra care

Research on AI summaries of novels (FABLES, 2024) found that most false statements are about
**what characters feel, want or know**, about **relationships**, and about **events and their
order**; summaries also leave out key events and give too much weight to the end of the book. So:

- Confirm every scene, who is in it, every relation and every character state in the text.
- Keep events in story order and in their own chapter. A flashback or a story told by a character
  is its own scene, with the time saying so ("{Years before}, as Mara tells it, …").
- Feelings and motives: state only what the text shows. Leave out a reading such as "her pride is
  hurt" unless the book says it.
- `with` lists only people present in the scene; `off`, only people there at a distance (letter,
  phone, overheard, asleep, imagined by the one who is there). Never people who are only talked
  about.
- Give middle and late chapters the same number of scenes and the same care as the first ones.

## Restrictions

- **No quotations from the book**, not even short ones: paraphrase. A term the author coined may
  name a concept ("the commons trap"). The validator reports quoted passages of six words or more.
- No numbers the book does not give. A bar chart shows only numbers from the book.
- No opinions: no ratings, praise, criticism or critics' views, unless the chapter itself
  discusses them. When the author judges real people or groups, attribute it ("the author argues").
- No icons, emoji, photos, clip art, book covers or logos: only the app's shapes, lines and text.
- No personal data: no highlights, notes, ratings or reading progress. The book only.

## Limit ("Up to"; Fiction and Non-fiction reading)

- Screens only up to and including the limit (front matter before it included, back matter
  excluded). Later chapters are listed in the book file without screens: the app shows them as
  "not in this guide yet", with their number only.
- **The spoiler gate.** After extraction, move every text file after the limit out of `source/`
  into `work/<guide>/after-limit/`, so no writer or verifier can read it. `check_guide.py names`
  then reports any name or number the book has not given by that chapter. Delete every claim
  without an anchor: for a famous book, the model's own memory of the plot leaks in.
- With summaries, use only chapter-level sources for the included chapters. Ignore later events
  if a source mentions them.
- Cast roles and relations: as known at the limit.
- No words that hint at later events ("eventually", "will turn out", "in the end"). The validator
  reports the common ones; time marks inside a chapter ("{Later that night}") are fine.

## Spoilers in normal mode

Cast roles and relations never reveal twists, deaths, secret identities or the
ending, even for a whole-book guide: the reader may not have finished. Chapter screens may tell
what happens in that chapter, and in the chapters before it, never after it (the resume rule:
the reader opens the last chapter they read).

- Roles and relation labels say what the book has shown by the end of that chapter, and change
  in the chapter where the book changes them.
- "Still open" lists only questions the book itself has raised by then, phrased as the stakes
  ("Will Lydia's elopement ruin her sisters' chances?"), never as a hint of the answer. A question
  the book answers later stays open until that chapter.
- "Where it stops" and "Before this chapter" never say what the next chapter does, unless the
  book itself announces it (an author's bridge: "the next part looks at computers").

## Summaries mode (no book file)

- Confirm the table of contents (chapter names, order, parts) from a publisher page, library
  record or detailed chapter-by-chapter summary. Never invent a chapter title.
- Use chapter-by-chapter summaries for the content; send independent searches in one turn; keep
  the URLs for the final message.
- A detail that a source does not clearly attribute to the book (a year, a place, a study guide's
  own interpretation) is left out. A detail found in only one source is left out.
- `length`: only real lengths (page numbers from a table of contents: next start page minus this
  one). Otherwise leave `length` out for every chapter.
- Set `"source": { "kind": "summaries", "written": "<date>", "skill": "<version>" }`.

## Copyright and the public site

The repository and the GitHub Pages site are public. A guide is a summary in your own words, with
diagrams; it never reproduces the book's text.

- `work/` (the book file, its extracted text, the working files) is in `.gitignore`. Never commit
  it, never paste its text into a book file, a commit message or a pull request.
- The anchors in the working files hold 3–12-word quotes, so a script can confirm them. They stay
  in `work/`; a guide never shows them.
- Paraphrase; keep scene texts and synopses short and in your own words.
- The PDF holds more detail than the app, but the same rules: no quotations, no long close
  paraphrase of a passage.
