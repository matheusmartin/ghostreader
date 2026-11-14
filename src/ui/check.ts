// #/check/<book>: renders every screen of a book at this window's size, fits it, and reports the
// screens that are still too full, SVG charts drawn too small to read, and charts whose layout has
// overlapping labels. scripts/check-screens.mjs opens it at several phone sizes and prints the report.

import { h } from '../lib/dom.ts';
import { fitScreen, renderScreen, type ScreenContext } from '../screens/render.ts';
import type { Plan } from '../model/plan.ts';

export interface CheckResult {
  key: string;
  where: string;
  type: string;
  /** Still too full after the type was made smaller. */
  overfull: boolean;
  /** The type had to be made smaller (1 = not at all). */
  fit: number;
  /** Smallest scale of an SVG chart on the screen (1 = drawn at its design size). */
  chartScale: number;
  /** Overlapping labels or nodes the chart layout could not avoid. */
  overlap: number;
}

declare global {
  interface Window { __check?: CheckResult[] }
}

export function renderCheck(root: HTMLElement, plan: Plan): { destroy(): void } {
  const stage = h('main', { class: 'stage' });
  const el = h('div', { class: 'reader' }, stage);
  root.append(el);
  const ctx: ScreenContext = { plan, jump: () => {}, exit: () => {} };
  const results: CheckResult[] = [];
  for (const ps of plan.screens) {
    const screen = renderScreen(ps, ctx);
    stage.append(screen);
    fitScreen(screen);
    const body = screen.querySelector<HTMLElement>('.screen-body')!;
    const svgs = [...screen.querySelectorAll<SVGSVGElement>('svg.chart-svg')];
    const scale = Math.min(1, ...svgs.map((svg) => svg.getBoundingClientRect().width / svg.viewBox.baseVal.width));
    const ch = ps.chapter;
    results.push({
      key: ps.key,
      where: ch.kind === 'chapter' ? `${ch.number} ${ch.title}, screen ${ps.inChapter + 1}` : ch.title,
      type: ps.content.type === 'chart' ? `chart ${ps.content.chart}` : ps.content.type,
      overfull: screen.classList.contains('overfull'),
      fit: Number(body.style.getPropertyValue('--fit') || 1),
      chartScale: Math.round(scale * 100) / 100,
      overlap: svgs.reduce((n, svg) => n + Number(svg.dataset.overlap ?? 0), 0),
    });
    screen.remove();
  }
  window.__check = results;
  document.documentElement.dataset.checkReady = '1';
  el.append(h('pre', { class: 'check-report' }, JSON.stringify(results, null, 1)));
  return { destroy: () => el.remove() };
}
