// The main screen: every book in src/books, one tile per guide. Each book opens at its cover, in
// the style chosen in the menu. Everything else (style, theme, full screen, install, update)
// is in the menu: hold anywhere (ui/menu.ts).

import { h } from '../lib/dom.ts';
import { groupGuides, loadAllBooks, type GuideEntry, type LoadedBook } from '../data/books.ts';
import { getSetting, setSetting } from '../lib/storage.ts';
import { STYLES, type Style } from '../model/types.ts';
import { GUIDE_NAMES, STYLE_NAMES } from '../screens/render.ts';
import { pdfLink } from '../lib/pdf.ts';
import { onUpdateReady } from '../pwa.ts';
import { HOLD_HELP, openMenu, useMenu } from './menu.ts';
import { STYLE_HINTS, stylePicker } from './style-picker.ts';

export interface LibraryOptions {
  open(bookId: string): void;
}

export function renderLibrary(root: HTMLElement, opts: LibraryOptions): { destroy(): void } {
  const grid = h('div', { class: 'lib-grid', 'aria-busy': 'true' });
  // The one pointer to the menu. When a new version waits, it says so: the update is in the menu.
  const hint = h('button', { type: 'button', class: 'lib-hint', onclick: () => openMenu() });
  const syncHint = () => {
    hint.replaceChildren(
      onUpdateReady.ready
        ? h('span', null, h('b', null, 'Update ready.'), ' Hold anywhere for the menu.')
        : h('span', null, h('b', null, 'Hold'), ' anywhere for the menu: style, theme and more.'),
    );
  };
  const el = h('div', { class: 'library' },
    h('header', { class: 'lib-head' },
      h('h1', null, 'Ghostreader'),
      hint,
    ),
    grid,
  );
  root.append(el);
  syncHint();
  const offUpdate = onUpdateReady.subscribe(syncHint);

  let guides: GuideEntry[] = [];
  /** Each tile shows the style it opens in; these bring the tiles up to date after a change. */
  let syncCards: (() => void)[] = [];
  const offMenu = useMenu({
    label: 'Library',
    title: 'Ghostreader',
    // The style books open in. A book without that style opens in Map (or its first style).
    top: () => {
      const offered = STYLES.filter((s) => guides.some((g) => g.styles[s]));
      if (offered.length < 2) return [];
      const saved = getSetting('style') as Style | null;
      const current = saved && offered.includes(saved) ? saved : offered.includes('map') ? 'map' : offered[0];
      return [stylePicker(offered, current, (s) => {
        setSetting('style', s);
        syncCards.forEach((sync) => sync());
      })];
    },
    help: [
      ['Tap a book', 'Read it, in the style you chose'],
      HOLD_HELP,
    ],
  });

  let alive = true;
  void loadAllBooks().then((books) => {
    if (!alive) return;
    grid.removeAttribute('aria-busy');
    guides = groupGuides(books);
    const cards = guides.map((g) => card(g, opts));
    syncCards = cards.map((c) => c.sync);
    grid.replaceChildren(...cards.map((c) => c.el));
    if (books.length === 0) grid.append(h('p', { class: 'lib-empty' }, 'No books yet. Add a book file to src/books.'));
  });

  return {
    destroy() {
      alive = false;
      offUpdate();
      offMenu();
      el.remove();
    },
  };
}

function brokenCard(loaded: LoadedBook): HTMLElement {
  return h('div', { class: 'book-card broken' },
    h('span', { class: 'label' }, 'Cannot open'),
    h('span', { class: 'bc-title' }, `${loaded.id}.json`),
    h('span', { class: 'bc-error' }, loaded.errors[0] ?? 'Unknown error'),
    loaded.errors.length > 1 ? h('span', { class: 'bc-error' }, `and ${loaded.errors.length - 1} more problems`) : null,
  );
}

/** One tile per guide. It opens the style chosen in the menu, and says which style that is. */
function card(entry: GuideEntry, opts: LibraryOptions): { el: HTMLElement; sync(): void } {
  if (entry.broken) return { el: brokenCard(entry.broken), sync: () => {} };
  const styles = STYLES.filter((s) => entry.styles[s]);
  const chosen = (): Style => {
    const saved = getSetting('style') as Style | null;
    return saved && entry.styles[saved] ? saved : styles.includes('map') ? 'map' : styles[0];
  };
  let current = chosen();
  const book = () => entry.styles[current]!;
  const b = book();

  const open = h('button', { type: 'button', class: 'bc-open', onclick: () => opts.open(book().id) });
  const style = h('span', { class: 'bc-style' });
  const pdfSlot = h('span', { class: 'bc-pdf' });
  const sync = () => {
    current = chosen();
    style.replaceChildren(h('b', null, STYLE_NAMES[current]), ` · ${STYLE_HINTS[current]}`);
    open.setAttribute('aria-label', `Read ${b.title}, ${STYLE_NAMES[current]} style`);
    pdfSlot.replaceChildren(pdfLink(book(), 'Download PDF', 'btn small'));
  };
  sync();

  const kicker = [GUIDE_NAMES[b.type], b.upTo ? `to ${b.upTo}` : ''].filter(Boolean).join(' · ');
  // The whole card opens the chosen style; the actions sit on top of it.
  const el = h('div', { class: 'book-card' },
    open,
    h('span', { class: 'bc-top' }, h('span', { class: 'label' }, kicker), b.sample ? h('span', { class: 'tag grey' }, 'Sample') : null),
    h('span', { class: 'bc-title' }, b.title),
    b.subtitle ? h('span', { class: 'bc-sub' }, b.subtitle) : null,
    h('span', { class: 'bc-author' }, b.author),
    styles.length > 1 ? style : null,
    h('span', { class: 'bc-actions' },
      h('button', { type: 'button', class: 'btn small primary', onclick: () => opts.open(book().id) }, 'Read'),
      pdfSlot,
    ),
  );
  return { el, sync };
}
