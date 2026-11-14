import './styles/tokens.css';
import './styles/base.css';
import './styles/library.css';
import './styles/reader.css';
import './styles/screens.css';
import './styles/figures.css';

import { loadBook } from './data/books.ts';
import { loadPosition, savePosition } from './data/progress.ts';
import { enterFullscreen, keepAwake } from './lib/device.ts';
import { buildPlan, locate, progressAt } from './model/plan.ts';
import { parseRoute, readHash } from './router.ts';
import { renderLibrary } from './ui/library.ts';
import { Reader } from './ui/reader.ts';
import { startPwa } from './pwa.ts';

const root = document.getElementById('app')!;
let view: { destroy(): void } | null = null;
/** True when the reader was opened from the library, so "back" can use the browser history. */
let openedFromLibrary = false;
let routeToken = 0;

async function route() {
  const r = parseRoute(location.hash);
  const token = ++routeToken;

  if (r.name === 'library') {
    openedFromLibrary = false;
    view?.destroy();
    view = renderLibrary(root, { open: openBook });
    document.title = 'Ghostwriter';
    return;
  }

  const loaded = await loadBook(r.bookId);
  if (token !== routeToken) return;
  if (!loaded?.book) {
    location.replace('#/');
    return;
  }
  const book = loaded.book;
  const plan = buildPlan(book);
  const saved = loadPosition(book.id);
  const start =
    (r.chapterId !== undefined ? locate(plan, r.chapterId, r.n) : null) ??
    (saved ? locate(plan, saved.chapter, saved.n) : null) ??
    0;

  view?.destroy();
  const sleep = keepAwake();
  const reader = new Reader({
    plan,
    start,
    exit: leaveBook,
    arrived(ps) {
      const ch = ps.chapter;
      savePosition(book.id, {
        chapter: ch.id,
        n: ps.inChapter,
        progress: progressAt(plan, ps.index),
        where: ch.kind === 'chapter' ? `${ch.number} ${ch.title}` : ch.kind === 'cover' ? 'Cover' : 'End',
        at: Date.now(),
      });
      // Keep the address in step with the place, without adding a history entry per swipe.
      history.replaceState(history.state, '', readHash(book.id, ch.id, ps.inChapter));
    },
  });
  reader.attach(root);
  view = {
    destroy() {
      reader.destroy();
      sleep();
    },
  };
  document.title = `${book.title} – Ghostwriter`;
}

function openBook(bookId: string) {
  // Full screen needs the tap that opens the book, so ask now, before the route changes.
  void enterFullscreen();
  openedFromLibrary = true;
  location.hash = readHash(bookId);
}

function leaveBook() {
  if (openedFromLibrary) history.back();
  else location.replace('#/');
}

addEventListener('hashchange', () => void route());
void route();
startPwa();
