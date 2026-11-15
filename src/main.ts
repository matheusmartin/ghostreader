import './styles/tokens.css';
import './styles/base.css';
import './styles/library.css';
import './styles/reader.css';
import './styles/screens.css';
import './styles/figures.css';
import './styles/print.css';

import { loadBook, resolveBookId } from './data/books.ts';
import { forgetOldData } from './lib/storage.ts';
import { enterFullscreen, keepAwake } from './lib/device.ts';
import { buildPlan, locate } from './model/plan.ts';
import { parseRoute, readHash } from './router.ts';
import { renderPrint } from './print/print.ts';
import { renderCheck } from './ui/check.ts';
import { renderLibrary } from './ui/library.ts';
import { Reader } from './ui/reader.ts';
import { startPwa } from './pwa.ts';
import { startScheme } from './lib/scheme.ts';

// The app keeps no record of what you read. Move settings kept under the old name (Ghostwriter)
// and delete reading places saved by earlier versions.
forgetOldData();
startScheme();

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
    document.title = 'Ghostreader';
    return;
  }

  // An old link may name the guide instead of one of its style files.
  const resolved = resolveBookId(r.bookId);
  if (resolved && resolved !== r.bookId) {
    const rest = location.hash.split('/').slice(3).join('/');
    location.replace(`#/${r.name}/${encodeURIComponent(resolved)}${rest ? `/${rest}` : ''}`);
    return;
  }
  const loaded = await loadBook(r.bookId);
  if (token !== routeToken) return;
  if (!loaded?.book) {
    location.replace('#/');
    return;
  }
  const book = loaded.book;

  if (r.name === 'print') {
    view?.destroy();
    view = renderPrint(root, book, { back: leaveBook });
    document.title = `${book.title} – PDF – Ghostreader`;
    return;
  }
  const plan = buildPlan(book);
  if (r.name === 'check') {
    view?.destroy();
    view = renderCheck(root, plan);
    return;
  }

  // A link or a reload can name a screen; otherwise the book opens at its cover.
  const start = (r.chapterId !== undefined ? locate(plan, r.chapterId, r.n) : null) ?? 0;

  view?.destroy();
  const sleep = keepAwake();
  const reader = new Reader({
    plan,
    start,
    exit: leaveBook,
    arrived(ps) {
      // Keep the address in step with the screen: a reload, a bookmark or a shared link opens the
      // same screen (menu: "Share this screen"). The cover is the book's own address. Nothing is saved.
      const hash = ps.chapter.kind === 'cover' ? readHash(book.id) : readHash(book.id, ps.chapter.id, ps.inChapter);
      history.replaceState(history.state, '', hash);
    },
  });
  reader.attach(root);
  view = {
    destroy() {
      reader.destroy();
      sleep();
    },
  };
  document.title = `${book.title} – Ghostreader`;
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
