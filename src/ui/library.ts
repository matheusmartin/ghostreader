// The main screen: every book in src/books. Each book opens at its cover.

import { h } from '../lib/dom.ts';
import { canFullscreen, isFullscreen, isInstalled, toggleFullscreen } from '../lib/device.ts';
import { groupGuides, loadAllBooks, type GuideEntry, type LoadedBook } from '../data/books.ts';
import { getSetting, setSetting } from '../lib/storage.ts';
import { STYLES, type Style } from '../model/types.ts';
import { GUIDE_NAMES, STYLE_NAMES } from '../screens/render.ts';
import { pdfLink } from '../lib/pdf.ts';
import { installPrompt, onUpdateReady, applyUpdate } from '../pwa.ts';

export interface LibraryOptions {
  open(bookId: string): void;
}

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
    grid.replaceChildren(...groupGuides(books).map((g) => card(g, opts)));
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

/** One line under the style buttons: what the chosen style does. */
const STYLE_HINTS: Record<Style, string> = {
  map: 'Diagrams first: each idea as a chart',
  recap: 'The story so far, in short prose',
  recall: 'Questions first; tap to see the answer',
  layers: 'One line, three points, then the detail',
};

function brokenCard(loaded: LoadedBook): HTMLElement {
  return h('div', { class: 'book-card broken' },
    h('span', { class: 'label' }, 'Cannot open'),
    h('span', { class: 'bc-title' }, `${loaded.id}.json`),
    h('span', { class: 'bc-error' }, loaded.errors[0] ?? 'Unknown error'),
    loaded.errors.length > 1 ? h('span', { class: 'bc-error' }, `and ${loaded.errors.length - 1} more problems`) : null,
  );
}

/** One tile per guide. With several styles, buttons choose the one to read; the choice is kept. */
function card(entry: GuideEntry, opts: LibraryOptions): HTMLElement {
  if (entry.broken) return brokenCard(entry.broken);
  const styles = STYLES.filter((s) => entry.styles[s]);
  const saved = getSetting('style') as Style | null;
  let current: Style = saved && entry.styles[saved] ? saved : styles.includes('map') ? 'map' : styles[0];
  const book = () => entry.styles[current]!;
  const b = book();

  const open = h('button', { type: 'button', class: 'bc-open', onclick: () => opts.open(book().id) });
  const hint = h('span', { class: 'bc-hint' });
  const pdfSlot = h('span', { class: 'bc-pdf' });
  const buttons = styles.map((s) =>
    h('button', { type: 'button', class: 'bc-style', role: 'radio', onclick: () => select(s) }, STYLE_NAMES[s]),
  );
  const sync = () => {
    buttons.forEach((btn, i) => btn.setAttribute('aria-checked', String(styles[i] === current)));
    hint.textContent = STYLE_HINTS[current];
    open.setAttribute('aria-label', `Read ${b.title}, ${STYLE_NAMES[current]} style`);
    pdfSlot.replaceChildren(pdfLink(book(), 'Download PDF', 'btn small'));
  };
  const select = (s: Style) => {
    current = s;
    setSetting('style', s);
    sync();
  };
  sync();

  const kicker = [GUIDE_NAMES[b.type], b.upTo ? `to ${b.upTo}` : ''].filter(Boolean).join(' · ');
  // The whole card opens the chosen style; the style buttons and the actions sit on top of it.
  return h('div', { class: 'book-card' },
    open,
    h('span', { class: 'bc-top' }, h('span', { class: 'label' }, kicker), b.sample ? h('span', { class: 'tag grey' }, 'Sample') : null),
    h('span', { class: 'bc-title' }, b.title),
    b.subtitle ? h('span', { class: 'bc-sub' }, b.subtitle) : null,
    h('span', { class: 'bc-author' }, b.author),
    styles.length > 1
      ? h('div', { class: 'bc-styles' },
          h('div', { class: 'bc-style-list', role: 'radiogroup', 'aria-label': 'Style' }, buttons),
          hint,
        )
      : null,
    h('span', { class: 'bc-actions' },
      h('button', { type: 'button', class: 'btn small primary', onclick: () => opts.open(book().id) }, 'Read'),
      pdfSlot,
    ),
  );
}
