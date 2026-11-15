// Charts drawn from data. HTML and CSS charts (bars, compare, flow, timeline, matrix, branches)
// reflow to any width; SVG charts (network, threads, cycle, layers, and the scene chart) are laid
// out for a design width: 340 on a phone, 640 in the PDF.
// The design system: one key element (accent) per diagram, soft rounded shapes, labels inside the
// shapes, no legends.

import { h, rich } from '../lib/dom.ts';
import type {
  BarsChart, BranchesChart, ChartKind, ChartScreen, CompareChart, FlowChart, MatrixChart, TimelineChart,
} from '../model/types.ts';
import { cycle, layers } from './loops.ts';
import { network } from './network.ts';
import { threadChart } from './scenes.ts';

export const PHONE_WIDTH = 340;
export const PRINT_WIDTH = 640;

const SVG_KINDS: ChartKind[] = ['network', 'threads', 'cycle', 'layers'];
/** SVG charts take the free height of a screen and keep their proportions. */
export const isSvgChart = (kind: ChartKind) => SVG_KINDS.includes(kind);

/** Caption used when the author gives none: data charts say what their marks mean. */
export const DEFAULT_CAPTION: Partial<Record<ChartKind, string>> = {
  threads: 'Small dot: the thread appears · large dot: a major development',
};

export function renderChart(c: ChartScreen, width = PHONE_WIDTH): Element {
  switch (c.chart) {
    case 'bars': return bars(c);
    case 'compare': return compare(c);
    case 'flow': return flow(c);
    case 'timeline': return timeline(c);
    case 'matrix': return matrix(c);
    case 'branches': return branches(c);
    case 'network': return network(c, width);
    case 'threads': return threadChart(c, width);
    case 'cycle': return cycle(c, width);
    case 'layers': return layers(c, width);
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

const arrow = () => h('div', { class: 'flow-arrow', 'aria-hidden': 'true' });

/** Start → groups of points → key conclusion. One group is a simple flow; several, an argument map. */
function flow(c: FlowChart): HTMLElement {
  const groups = h('div', { class: 'flow-groups' },
    c.groups.map((g) =>
      h('div', { class: 'flow-group' },
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

/** Events in order down a line: the time on the left, what happens on the right. */
function timeline(c: TimelineChart): HTMLElement {
  return h('ol', { class: 'chart-timeline' },
    c.items.map((it) =>
      h('li', { class: `tl-item${it.key ? ' key-item' : ''}` },
        rich(it.when, 'span', 'tl-when'),
        h('span', { class: 'tl-dot', 'aria-hidden': 'true' }),
        h('div', { class: 'tl-body' },
          it.title ? rich(it.title, 'span', 'tl-title') : null,
          rich(it.text, 'p', 'tl-text'),
        ),
      ),
    ),
  );
}

/** Items (rows) against features (columns): a dot for yes, a dash for no. */
function matrix(c: MatrixChart): HTMLElement {
  const grid = h('div', { class: 'mx-grid', role: 'table' },
    h('div', { class: 'mx-row mx-headrow', role: 'row' },
      h('span', { class: 'mx-corner', role: 'columnheader' }),
      c.columns.map((col) => rich(col, 'span', 'mx-head')),
    ),
    c.rows.map((r) =>
      h('div', { class: `mx-row${r.focus ? ' focus' : ''}`, role: 'row' },
        rich(r.label, 'span', 'mx-label'),
        r.cells.map((yes, i) =>
          h('span', { class: `mx-cell ${yes ? 'yes' : 'no'}`, role: 'cell', 'aria-label': `${c.columns[i]}: ${yes ? 'yes' : 'no'}` }),
        ),
      ),
    ),
  );
  grid.style.setProperty('--cols', String(c.columns.length));
  return h('div', { class: 'chart-matrix' }, grid, c.key ? rich(c.key, 'div', 'mx-key key') : null);
}

/** One situation and the outcomes it can lead to. */
function branches(c: BranchesChart): HTMLElement {
  return h('div', { class: 'chart-branches' },
    rich(c.start, 'div', 'br-start'),
    h('ul', { class: 'br-options' },
      c.options.map((o) =>
        h('li', { class: `br-opt${o.key ? ' key-opt' : ''}${o.negative ? ' neg' : ''}` },
          rich(o.title, 'span', 'br-title'),
          o.text ? rich(o.text, 'span', 'br-text') : null,
        ),
      ),
    ),
  );
}
