# Ghostwriter

A progressive web app that helps you read a book with charts, infographics and summaries.
A chapter is a series of screens, and you move through them with your finger. Every book also has
a downloadable A4 PDF with more detail, made from the same book file.

Three guide types: **Story guide** (fiction: cast map, a "who is where" chart of each chapter's
scenes, story threads), **Reading guide** (non-fiction, while you read) and **Book summary**
(non-fiction, a finished book).

Every guide comes in four styles, to help you go back to a book after a long pause: **Map**
(diagrams first), **Recap** (the story so far, in words), **Recall** (questions first, answers on a
tap) and **Layers** (one line, three points, then the detail). The library shows one tile per book
with a button for each style; it remembers your choice, and the menu in a book switches style at
the same chapter. Research and recipes: `.claude/skills/ghostwriter-book/references/styles.md`.

## How it works

- **Library**: the main screen shows every book.
- **Read mode**: tap a book. The app goes full screen and shows one screen at a time, from the cover.

| Gesture | Move |
|---|---|
| Swipe up / down | Next / previous screen (continues into the next chapter) |
| Swipe left / right | Start of the next / previous chapter |
| Hold anywhere (0.6 s) | Menu: style, page colour, contents, library, full screen |

Keyboard and mouse wheel do the same moves (arrows, Space, Page Up / Down, Enter, Esc).

**Where am I.** A chapter can take many screens, so the reader always shows its place:

- a strip at the top: one segment per chapter, filled up to the current screen;
- under it: number, part, chapter title and section, and screen *n* of *N* in the chapter.

The whole book uses one colour scheme. The only thing that changes between chapters is the small
break between segments in the strip.

**Links.** Every screen has its own address, `#/read/<book>/<chapter>/<n>`, and the address bar
follows the screen you are on. Bookmark it or send it: it opens on the same screen. In full
screen or in the installed app, where there is no address bar, the menu has **Share this screen**
(the phone's share sheet, or copy the link).

**PDF.** "Download PDF" on each book in the library and in the reader's menu. The PDF has the
book on A4 pages: a cover with the book map and contents, every chapter with all its charts
(larger, with the full scene lists and thread lists), the detail marked for the PDF only (longer
synopses, full casts), and an answers page for the test questions.

**Page colour.** Paper (off-white) by day and Dusk (soft dark) when the device is in dark mode.
The menu also offers Quiet, Warm and Night. Each has one accent colour for the whole book.
Colours, roles and contrast rules:
[docs/design.md](docs/design.md).

**Book only, no personal data.** The app shows the book's content and nothing else: no highlights,
notes or ratings, and it keeps no record of what or how far you read. It stores three settings on
the device: the page colour, the style chosen in the library and whether the gesture hint was shown.

**Full screen.** Installed to the home screen, the app opens full screen (`display: fullscreen`;
on iPhone and iPad, under the status bar). In a browser tab, it asks for full screen when you open
a book. It keeps the screen on while you read (Wake Lock), and it works offline: the service worker
keeps the app and every book.

## Develop

Needs Node 22 or later.

```bash
npm install
```

```bash
npm run dev
```

| Command | Does |
|---|---|
| `npm run dev` | Development server, also on the local network (open it on your phone) |
| `npm run build` | Type check, production build in `dist/`, and one PDF per book in `dist/pdf/` |
| `npm run build:pdf` | Only the PDFs (after a build); `node scripts/build-pdfs.mjs <id>` for one book |
| `npm run preview` | Serve the production build (service worker included) |
| `npm test` | Unit tests, including the colour contrast checks and every book's content checks |
| `npm run validate` | Check every book file in `src/books/`: format and writing rules |
| `npm run check:screens` | Render every screen of every book at 360, 390 and 820 px; report screens that do not fit |

The PDFs and the screen check use Playwright's Chromium. `npm install` installs Playwright; if no
Chromium is found, run `npx playwright install chromium`. To build without PDFs: `SKIP_PDF=1 npm run build`.
In development, "Download PDF" opens the print view (`#/print/<id>`) instead of a built file.

`.npmrc` sets `legacy-peer-deps`, because npm 10 fails to resolve Vitest's optional peer
dependencies.

The build uses relative paths, so `dist/` works from any folder.

## Deploy

`.github/workflows/pages.yml` installs Chromium, runs the tests, builds the app and the PDFs, and
publishes them to GitHub Pages on every push to `main`, and on demand from the Actions tab. One-time setup: in the repository, open
Settings → Pages → Build and deployment and set Source to **GitHub Actions**. The site is then at
`https://<owner>.github.io/<repository>/`.

## Add a book

Ask Claude Code in this repository, for example "Add a story guide of Pride and Prejudice up to
Chapter 6" with the book file attached. The **ghostwriter-book** skill
(`.claude/skills/ghostwriter-book/`) does the work:

1. Extracts the book's text from an EPUB, PDF, TXT, Markdown or HTML file into `work/<id>/`
   (`scripts/extract_book.py`). `work/` is in `.gitignore`: book text is never committed.
2. Writes a fact sheet per chapter, every fact with its place in the text, and lists the book's
   own concepts and distinctions (for example Nexus's objective, subjective and intersubjective
   reality). Each gets a chart in its chapter and a row in the K · Key concepts overview.
3. Writes the Map file `src/books/<guide>-map.json` from the fact sheets, diagrams first, with
   PDF-only detail; then the texts of the other styles, from which `scripts/build_styles.py` builds
   the Recap, Recall and Layers files.
4. Checks every chapter against the text, then runs `npm run validate`, `npm run check:screens`
   and `npm run build`.

The skill holds the content rules (book content only, no quotations, no spoilers), the writing
style, the screen recipes of each guide type and the guidance on which chart fits which idea. Maps of
real places come from its `scripts/map.py` (Natural Earth data, public domain).

To write a book file by hand, follow [docs/content-format.md](docs/content-format.md) and run
`npm run validate`.

The library has **Nexus** by Yuval Noah Harari: a book summary of every chapter, written from the
EPUB, in each of the four styles. Story guides for fiction use the same format: see the scenes and threads charts in
[docs/content-format.md](docs/content-format.md).

## Code map

```
src/
  main.ts            routes: library (#/) and reader (#/read/<book>/<chapter>/<n>)
  model/types.ts     the book format
  model/validate.ts  checks a book file and lists every problem
  model/plan.ts      book → flat list of screens with part, chapter and section; navigation
  input/gestures.ts  swipe detection (pointer events): axis lock, drag, commit or spring back
  input/keys.ts      keyboard and wheel
  ui/reader.ts       read mode: the stage, drag-to-slide transitions, moves
  ui/hud.ts          the "where am I" indicator
  ui/menu.ts         contents, library, full screen
  ui/library.ts      main screen
  model/lint.ts      writing rules for book files: limits, style, spelling, spoilers
  screens/render.ts  one renderer per screen type; fit-to-screen
  charts/            charts from data: bars, compare, flow, timeline, matrix, branches (HTML);
                     network, threads, scenes, cycle, layers (SVG, laid out at 340 or 640 wide);
                     the book map
  print/print.ts     the PDF: the book on A4 pages (#/print/<book>)
  ui/check.ts        the screen check (#/check/<book>), used by scripts/check-screens.mjs
  lib/               DOM helpers, SVG sanitiser, PDF link, full screen and wake lock, settings storage
  styles/            design tokens: page colours and the accent (docs/design.md); print.css
  lib/scheme.ts      page colour choice; ui/scheme-picker.ts draws the picker
scripts/
  build-pdfs.mjs     dist/ → dist/pdf/<book>.pdf with Chromium
  check-screens.mjs  every screen of every book at three sizes
```

To add a screen type: add it to `Screen` in `model/types.ts`, check it in `model/validate.ts` and
`model/lint.ts`, render it in `screens/render.ts` (and in `print/print.ts` if the PDF needs a
different layout), style it in `styles/screens.css`, describe it in `docs/content-format.md`, and
tell the skill when to use it (`references/visuals.md`).
