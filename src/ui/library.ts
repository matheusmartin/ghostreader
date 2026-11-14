// The main screen: every book in src/books. Each book opens at its cover.

import { h } from '../lib/dom.ts';
import { canFullscreen, isFullscreen, isInstalled, toggleFullscreen } from '../lib/device.ts';
import { loadAllBooks, type LoadedBook } from '../data/books.ts';
import { GUIDE_NAMES } from '../screens/render.ts';
import { pdfLink } from '../lib/pdf.ts';
import { installPrompt, onUpdateReady, applyUpdate } from '../pwa.ts';
import type { Theme } from '../model/types.ts';

export interface LibraryOptions {
  open(bookId: string): void;
}

const CARD_THEMES: Theme[] = ['p2', 'p1', 'p3', 'front', 'p4', 'p5'];

export function renderLibrary(root: HTMLElement, opts: LibraryOptions): { destroy(): void } {
  const grid = h('div', { class: 'lib-grid', 'aria-busy': 'true' });
  const actions = h('div', { class: 'lib-actions' });
  const el = h('div', { class: 'library' },
    h('header', { class: 'lib-head' },
      h('div', null,
        h('h1', null, 'Ghostwriter'),
        h('p', null, 'Read with charts, infographics and summaries.'),
      ),
      actions,
    ),
    grid,
  );
  root.append(el);

  const syncActions = () => {
    actions.replaceChildren();
    const update = onUpdateReady.ready;
    if (update) actions.append(h('button', { type: 'button', class: 'btn primary', onclick: () => applyUpdate() }, 'Update app'));
    const prompt = installPrompt.event;
    if (prompt && !isInstalled()) {
      actions.append(h('button', { type: 'button', class: 'btn', onclick: () => void installPrompt.show().then(syncActions) }, 'Install'));
    }
    if (canFullscreen() && !isInstalled()) {
      actions.append(h('button', { type: 'button', class: 'btn', onclick: () => void toggleFullscreen() }, isFullscreen() ? 'Exit full screen' : 'Full screen'));
    }
  };
  syncActions();
  const offUpdate = onUpdateReady.subscribe(syncActions);
  const offInstall = installPrompt.subscribe(syncActions);
  document.addEventListener('fullscreenchange', syncActions);

  let alive = true;
  void loadAllBooks().then((books) => {
    if (!alive) return;
    grid.removeAttribute('aria-busy');
    grid.replaceChildren(...books.map((b, i) => card(b, CARD_THEMES[i % CARD_THEMES.length], opts)));
    if (books.length === 0) grid.append(h('p', { class: 'lib-empty' }, 'No books yet. Add a book file to src/books.'));
  });

  return {
    destroy() {
      alive = false;
      offUpdate();
      offInstall();
      document.removeEventListener('fullscreenchange', syncActions);
      el.remove();
    },
  };
}

function card(loaded: LoadedBook, theme: Theme, opts: LibraryOptions): HTMLElement {
  if (!loaded.book) {
    return h('div', { class: 'book-card broken' },
      h('span', { class: 'label' }, 'Cannot open'),
      h('span', { class: 'bc-title' }, `${loaded.id}.json`),
      h('span', { class: 'bc-error' }, loaded.errors[0] ?? 'Unknown error'),
      loaded.errors.length > 1 ? h('span', { class: 'bc-error' }, `and ${loaded.errors.length - 1} more problems`) : null,
    );
  }
  const b = loaded.book;
  const kicker = [GUIDE_NAMES[b.type], b.upTo ? `to ${b.upTo}` : ''].filter(Boolean).join(' · ');
  // The whole card opens the book; the PDF link sits on top of it.
  return h('div', { class: `book-card theme-${theme}` },
    h('button', { type: 'button', class: 'bc-open', onclick: () => opts.open(b.id), 'aria-label': `Read ${b.title}` }),
    h('span', { class: 'bc-top' }, h('span', { class: 'label' }, kicker), b.sample ? h('span', { class: 'tag grey' }, 'Sample') : null),
    h('span', { class: 'bc-title' }, b.title),
    b.subtitle ? h('span', { class: 'bc-sub' }, b.subtitle) : null,
    h('span', { class: 'bc-author' }, b.author),
    h('span', { class: 'bc-actions' }, pdfLink(b, 'Download PDF', 'btn small')),
  );
}
