// "Theme": one round swatch per theme, drawn in that theme's own colours, all in one grid.

import { h } from '../lib/dom.ts';
import { SCHEMES, getSchemeChoice, setSchemeChoice, type SchemeChoice } from '../lib/scheme.ts';

export function schemePicker(): HTMLElement {
  const buttons = new Map<SchemeChoice, HTMLButtonElement>();
  const sync = () => {
    const chosen = getSchemeChoice();
    for (const [id, b] of buttons) b.setAttribute('aria-checked', String(id === chosen));
  };
  const list = h('div', { class: 'scheme-list', role: 'radiogroup', 'aria-label': 'Theme' },
    SCHEMES.map(({ id, name }) => {
      const swatch = id === 'auto'
        ? h('span', { class: 'swatch split' }, h('span', { 'data-scheme': 'paper' }), h('span', { 'data-scheme': 'dusk' }))
        : h('span', { class: 'swatch', 'data-scheme': id }, 'Aa');
      const b = h('button', {
        type: 'button',
        class: 'scheme-opt',
        role: 'radio',
        'aria-checked': 'false',
        onclick: () => { setSchemeChoice(id); sync(); },
      }, h('span', { class: 'swatch-ring' }, swatch), h('span', { class: 'scheme-name' }, name));
      buttons.set(id, b);
      return b;
    }),
  );
  sync();
  return h('section', { class: 'scheme-picker' },
    h('h3', { class: 'label' }, 'Theme'),
    list,
    h('p', { class: 'scheme-note' }, 'Auto: Paper by day, Dusk when your device is in dark mode.'),
  );
}
