// Charts drawn from data, in HTML and CSS so they reflow to any screen width.
// They follow the book-infographic design system: one key element (accent) per diagram,
// soft rounded shapes, labels inside the shapes, no legends.

import { h, rich } from '../lib/dom.ts';
import type { BarsChart, CompareChart, FlowChart, ChartScreen } from '../model/types.ts';

export function renderChart(c: ChartScreen): HTMLElement {
  switch (c.chart) {
    case 'bars': return bars(c);
    case 'compare': return compare(c);
    case 'flow': return flow(c);
  }
}

/** Data chart: one row per item, bar length to scale. No key element; `focus` bars use the accent. */
function bars(c: BarsChart): HTMLElement {
  const max = Math.max(1, ...c.data.map((d) => d.value));
  return h('div', { class: 'chart-bars', role: 'list' },
    c.data.map((d) => {
      const bar = h('span', { class: 'bar' });
      bar.style.setProperty('--w', `${(d.value / max) * 100}%`);
      return h('div', { class: `bar-row${d.focus ? ' focus' : ''}`, role: 'listitem' },
        rich(d.label, 'span', 'bar-label'),
        h('span', { class: 'bar-track' }, bar),
        h('span', { class: 'bar-value' }, d.value.toLocaleString('en-GB')),
      );
    }),
  );
}

/** Two columns compared row by row, with the conclusion as the key element under both. */
function compare(c: CompareChart): HTMLElement {
  const cell = (text: string, col: 0 | 1) =>
    rich(text, 'div', `cmp-cell${c.negative === col ? ' neg' : ''}`);
  return h('div', { class: 'chart-compare' },
    h('div', { class: 'cmp-head' }, c.columns[0]),
    h('div', { class: 'cmp-head' }, c.columns[1]),
    c.rows.flatMap(([a, b]) => [cell(a, 0), cell(b, 1)]),
    c.key ? rich(c.key, 'div', 'cmp-key key') : null,
  );
}

/** Start → groups of points → key conclusion. One group is a simple flow; several, an argument map. */
function flow(c: FlowChart): HTMLElement {
  const arrow = () => h('div', { class: 'flow-arrow', 'aria-hidden': 'true' });
  const groups = h('div', { class: 'flow-groups' },
    c.groups.map((g) =>
      h('div', { class: `flow-group${g.theme ? ` theme-${g.theme}` : ''}` },
        g.label ? rich(g.label, 'div', 'flow-group-label') : null,
        g.items.map((it) => rich(it, 'div', 'flow-item')),
      ),
    ),
  );
  groups.style.setProperty('--n', String(Math.min(c.groups.length, 3)));
  return h('div', { class: 'chart-flow' },
    c.start ? rich(c.start, 'div', 'flow-start') : null,
    c.start ? arrow() : null,
    groups,
    c.key ? arrow() : null,
    c.key ? rich(c.key, 'div', 'flow-key key') : null,
  );
}
