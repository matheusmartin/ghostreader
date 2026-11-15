// "Page colour": one round swatch per scheme, drawn in that scheme's own colours. Ghostreader's own
// colours first; the code editors' themes in a section that opens, in light and dark groups.

import { h } from '../lib/dom.ts';
import { SCHEMES, getSchemeChoice, setSchemeChoice, type SchemeChoice, type SchemeGroup } from '../lib/scheme.ts';

export function schemePicker(): HTMLElement {
  const buttons = new Map<SchemeChoice, HTMLButtonElement>();
  const sync = () => {
    const chosen = getSchemeChoice();
    for (const [id, b] of buttons) b.setAttribute('aria-checked', String(id === chosen));
  };
  const option = ({ id, name }: (typeof SCHEMES)[number]) => {
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
  };
  const list = (group: SchemeGroup, label: string) =>
    h('div', { class: 'scheme-list', role: 'group', 'aria-label': label }, SCHEMES.filter((s) => s.group === group).map(option));

  const editorCount = SCHEMES.filter((s) => s.group !== 'ghostreader').length;
  const chosenGroup = SCHEMES.find((s) => s.id === getSchemeChoice())?.group;
  const editors = h('details', { class: 'scheme-more', open: chosenGroup !== 'ghostreader' },
    h('summary', null, h('span', null, 'From code editors'), h('span', { class: 'scheme-count' }, String(editorCount))),
    h('p', { class: 'scheme-note' }, 'Every theme built into Atom, Sublime Text and Zed, with the editors’ names.'),
    h('h4', { class: 'label' }, 'Light'),
    list('light', 'Light, from code editors'),
    h('h4', { class: 'label' }, 'Dark'),
    list('dark', 'Dark, from code editors'),
  );
  sync();
  return h('section', { class: 'scheme-picker', role: 'radiogroup', 'aria-label': 'Page colour' },
    h('h3', { class: 'label' }, 'Page colour'),
    list('ghostreader', 'Ghostreader'),
    h('p', { class: 'scheme-note' }, 'Auto: Paper by day, Dusk when your device is in dark mode.'),
    editors,
  );
}
