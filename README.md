# Ghostwriter

A progressive web app that helps you read a book with charts, infographics and summaries.
It replaces the book-infographic skill: instead of one A4 page per chapter, a chapter is a series
of screens, and you move through them with your finger.

## How it works

- **Library**: the main screen shows every book.
- **Read mode**: tap a book. The app goes full screen and shows one screen at a time, from the cover.

| Gesture | Move |
|---|---|
| Swipe up / down | Next / previous screen (continues into the next chapter) |
| Swipe left / right | Start of the next / previous chapter |
| Tap | Menu: contents, library, full screen |

Keyboard and mouse wheel do the same moves (arrows, Space, Page Up / Down, Enter, Esc).

**Where am I.** A chapter can take many screens, so the reader always shows its place:

- a strip at the top: one segment per chapter, filled up to the current screen;
- under it: number, part, chapter title and section, and screen *n* of *N* in the chapter.

**Page colour.** Paper (off-white) by day and Dusk (soft dark) when the device is in dark mode.
The menu also offers Quiet, Warm and Night. Colours, roles and contrast rules:
[docs/design.md](docs/design.md).

**Book only, no personal data.** The app shows the book's content and nothing else: no highlights,
notes or ratings, and it keeps no record of what or how far you read. It stores two settings on
the device: the page colour and whether the gesture hint was shown.

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
| `npm run build` | Type check and production build in `dist/` |
| `npm run preview` | Serve the production build (service worker included) |
| `npm test` | Unit tests, including the colour contrast checks |
| `npm run validate` | Check every book file in `src/books/` |

`.npmrc` sets `legacy-peer-deps`, because npm 10 fails to resolve Vitest's optional peer
dependencies.

The build uses relative paths, so `dist/` works from any folder.

## Deploy

`.github/workflows/pages.yml` builds the app, runs the tests and publishes it to GitHub Pages on
every push to `main` (or the current working branch). One-time setup: in the repository, open
Settings → Pages → Build and deployment and set Source to **GitHub Actions**. The site is then at
`https://<owner>.github.io/<repository>/`.

## Add a book

Write `src/books/<id>.json` in the format of [docs/content-format.md](docs/content-format.md),
then run `npm run validate`. The sample book (Nexus, book summary) uses only content from the
book-infographic skill's examples: The book in one page and Chapter 5. The other chapters are
listed but not written.

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
  screens/render.ts  one renderer per screen type; fit-to-screen
  charts/            charts from data (bars, compare, flow) and the book map
  lib/               DOM helpers, SVG sanitiser, full screen and wake lock, settings storage
  styles/            design tokens: page colours and part colours (docs/design.md)
  lib/scheme.ts      page colour choice; ui/scheme-picker.ts draws the picker
```

To add a screen type: add it to `Screen` in `model/types.ts`, check it in `model/validate.ts`,
render it in `screens/render.ts`, style it in `styles/screens.css`, and describe it in
`docs/content-format.md`.
