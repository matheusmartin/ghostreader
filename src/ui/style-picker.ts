// "Style", in the menu: one button per style and a line on what the chosen style does. In the
// library it sets the style that books open in (kept on the device); in a book it switches this
// book to the same chapter in the other style (ui/book-menu.ts).

import { h } from '../lib/dom.ts';
import { STYLE_NAMES } from '../screens/render.ts';
import type { Style } from '../model/types.ts';

/** What each style does, in one line. */
export const STYLE_HINTS: Record<Style, string> = {
  map: 'Diagrams first: each idea as a chart',
  recap: 'The story so far, in short prose',
  recall: 'Questions first; tap to see the answer',
  layers: 'One line, three points, then the detail',
};

export function stylePicker(styles: Style[], current: Style, pick: (s: Style) => void): HTMLElement {
  const hint = h('p', { class: 'style-hint' });
  const buttons = styles.map((s) =>
    h('button', { type: 'button', class: 'style-opt', role: 'radio', onclick: () => select(s) }, STYLE_NAMES[s]),
  );
  const sync = () => {
    buttons.forEach((b, i) => b.setAttribute('aria-checked', String(styles[i] === current)));
    hint.textContent = STYLE_HINTS[current];
  };
  const select = (s: Style) => {
    if (s === current) return;
    current = s;
    sync();
    pick(s);
  };
  sync();
  return h('div', { class: 'style-picker' },
    h('span', { class: 'label' }, 'Style'),
    h('div', { class: 'style-list', role: 'radiogroup', 'aria-label': 'Style' }, buttons),
    hint,
  );
}
