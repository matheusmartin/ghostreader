// The menu: one for the whole app, opened by holding a finger still anywhere (or Esc / Enter on a
// keyboard). It is the one way to every setting and action, on every screen:
//
//   head        what this screen is (the library, a book, a book's PDF)
//   actions     the screen's own buttons, then the app's: full screen, install, update
//   top         the screen's sections above the theme (a book: style)
//   theme       every screen but the PDF view, which is always Paper
//   bottom      the screen's sections below the theme (a book: contents)
//   help        the gestures
//
// Each screen gives its part with useMenu() and takes it back when it closes.

import { append, h } from '../lib/dom.ts';
import { canFullscreen, isFullscreen, isInstalled, toggleFullscreen } from '../lib/device.ts';
import { attachHold, HOLD_TIME } from '../input/gestures.ts';
import { moveForKey } from '../input/keys.ts';
import { applyUpdate, installPrompt, onUpdateReady } from '../pwa.ts';
import { schemePicker } from './scheme-picker.ts';

type Part = HTMLElement | null;

export interface MenuPage {
  label: string;
  title: string;
  sub?: string;
  /** Each part is built when the menu opens, so it shows the state at that time. */
  actions?(): Part[];
  top?(): Part[];
  bottom?(): Part[];
  /** False: no theme picker. */
  theme?: boolean;
  /** Gesture → what it does. */
  help?: [string, string][];
  /** The menu closed. */
  closed?(): void;
}

/** Help lines that every screen shows. */
export const HOLD_HELP: [string, string] = ['Hold anywhere', 'This menu (Esc on a keyboard)'];

const DEFAULT_PAGE: MenuPage = {
  label: 'Menu',
  title: 'Ghostreader',
  help: [HOLD_HELP],
};

/** The hold ring appears only after this long (ms), so taps and swipes do not flash it. */
const RING_DELAY = 150;
/** How long (ms) after opening the menu ignores clicks: the tap's own click comes within this time. */
const MENU_CLICK_GUARD = 500;

let page: MenuPage = DEFAULT_PAGE;
let el: HTMLElement | null = null;
let sheet: HTMLElement;
let ring: HTMLElement;
let fsButton: HTMLButtonElement | null = null;
/** Until this time (ms) the menu ignores clicks: see open(). */
let guardUntil = 0;

/** Mounts the menu and the hold ring, and starts the long press and the keys. Call once. */
export function startMenu(): void {
  if (el) return;
  ring = h('div', { class: 'hold-ring', 'aria-hidden': 'true' });
  ring.innerHTML = '<svg viewBox="0 0 80 80"><circle class="track" cx="40" cy="40" r="34"/><circle class="fill" cx="40" cy="40" r="34"/></svg>';
  ring.style.setProperty('--ring-delay', `${RING_DELAY}ms`);
  ring.style.setProperty('--ring-fill', `${HOLD_TIME - RING_DELAY}ms`);

  sheet = h('div', { class: 'menu-sheet', role: 'dialog', 'aria-modal': 'true' });
  el = h('div', { class: 'menu', hidden: true },
    h('div', { class: 'menu-backdrop', onclick: () => closeMenu() }),
    sheet,
  );
  // On a touch screen the touch that opens the menu is followed by a click at the same place, which
  // would land on the menu that just opened: on the backdrop (closing it) or on a button (jumping
  // to a chapter). Swallow clicks for a moment after the menu opens.
  el.addEventListener('click', (e) => {
    if (performance.now() < guardUntil) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
  document.body.append(ring, el);

  attachHold({
    enabled: () => !isMenuOpen(),
    pressStart: (x, y) => {
      ring.classList.remove('on');
      ring.style.left = `${x}px`;
      ring.style.top = `${y}px`;
      void ring.offsetWidth; // restart the fill
      ring.classList.add('on');
    },
    pressEnd: () => ring.classList.remove('on'),
    longPress: () => {
      try { navigator.vibrate?.(12); } catch { /* no vibration */ }
      openMenu();
    },
  });

  addEventListener('keydown', (e) => {
    if (moveForKey(e) !== 'menu') return;
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    // Enter on a button or a link belongs to it; Esc always works.
    if (e.key === 'Enter' && t?.closest('button, a[href]')) return;
    e.preventDefault();
    toggleMenu();
  });

  document.addEventListener('fullscreenchange', syncFs);
  onUpdateReady.subscribe(refreshActions);
  installPrompt.subscribe(refreshActions);
}

/** Gives this screen's part of the menu. Returns the function that takes it back (and closes the menu). */
export function useMenu(p: MenuPage): () => void {
  closeMenu();
  page = p;
  return () => {
    if (page !== p) return;
    closeMenu();
    page = DEFAULT_PAGE;
  };
}

export function isMenuOpen(): boolean {
  return el !== null && !el.hidden;
}

export function openMenu(): void {
  if (!el || isMenuOpen()) return;
  guardUntil = performance.now() + MENU_CLICK_GUARD;
  build();
  el.hidden = false;
  document.documentElement.classList.add('menu-open');
  void el.offsetHeight; // start the slide-in from the closed state
  el.classList.add('open');
  sheet.scrollTop = 0;
  // The current chapter, if any; 'nearest' keeps the top of the menu (actions, theme) in view when it can.
  sheet.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
}

export function closeMenu(): void {
  if (!el || !isMenuOpen()) return;
  el.classList.remove('open');
  el.hidden = true;
  document.documentElement.classList.remove('menu-open');
  page.closed?.();
}

export function toggleMenu(): void {
  if (isMenuOpen()) closeMenu();
  else openMenu();
}

function build() {
  const p = page;
  sheet.setAttribute('aria-label', `${p.title} menu`);
  sheet.replaceChildren();
  append(sheet, [
    h('div', { class: 'menu-head' },
      h('div', null,
        h('span', { class: 'label' }, p.label),
        h('h2', { class: 'menu-title' }, p.title),
        p.sub ? h('p', { class: 'menu-author' }, p.sub) : null,
      ),
      h('button', { type: 'button', class: 'btn icon', 'aria-label': 'Close menu', onclick: () => closeMenu() }, 'Close'),
    ),
    h('div', { class: 'menu-actions' }, actions()),
    p.top?.() ?? [],
    p.theme === false ? null : schemePicker(),
    p.bottom?.() ?? [],
    p.help?.length
      ? h('dl', { class: 'menu-help' }, p.help.flatMap(([dt, dd]) => [h('dt', null, dt), h('dd', null, dd)]))
      : null,
  ]);
}

/** The screen's buttons, then the app's. */
function actions(): Part[] {
  fsButton = canFullscreen() && !isInstalled()
    ? h('button', { type: 'button', class: 'btn', onclick: () => void toggleFullscreen().then(syncFs) }, '')
    : null;
  syncFs();
  return [
    ...(page.actions?.() ?? []),
    fsButton,
    installPrompt.event && !isInstalled()
      ? h('button', { type: 'button', class: 'btn', onclick: () => void installPrompt.show() }, 'Install app')
      : null,
    onUpdateReady.ready
      ? h('button', { type: 'button', class: 'btn primary', onclick: () => applyUpdate() }, 'Update app')
      : null,
  ];
}

/** An update or the install prompt came while the menu is open: show its button now. */
function refreshActions() {
  if (!isMenuOpen()) return;
  const row = sheet.querySelector('.menu-actions');
  if (!row) return;
  row.replaceChildren();
  append(row, actions());
}

function syncFs() {
  if (fsButton) fsButton.textContent = isFullscreen() ? 'Exit full screen' : 'Full screen';
}
