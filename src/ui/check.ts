// #/check/<book>: renders every screen of a book at this window's size, fits it, and reports the
// screens that are still too full, SVG charts drawn too small to read, charts whose layout has
// overlapping labels, and HTML chart parts whose text does not fit their box. scripts/check-screens.mjs
// opens it at several phone sizes and prints the report.

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
  /** Text of the HTML chart parts that are wider than their box (cut off or spilling out). */
  clipped: string[];
}

/** Charts and figures on a screen: the chart screens, scene figures and the book map. */
const CHART_PARTS = '.figure, .bookmap';

/**
 * HTML elements in the charts of `screen` whose content is wider than their box (scrollWidth >
 * clientWidth), with text in them. Only the innermost such element is given, because its overflow
 * also makes its parents overflow. 1 px is allowed for sub-pixel rounding, as in fitScreen.
 */
export function clippedChartText(screen: HTMLElement): string[] {
  const over = [...screen.querySelectorAll(CHART_PARTS)]
    .flatMap((chart) => [chart, ...chart.querySelectorAll('*')])
    .filter((el): el is HTMLElement => el instanceof HTMLElement)
    .filter((el) => el.scrollWidth > el.clientWidth + 1 && el.textContent!.trim() !== '');
  return over
    .filter((el) => !over.some((other) => other !== el && el.contains(other)))
    .map((el) => {
      const text = el.textContent!.replace(/\s+/g, ' ').trim();
      const name = el.classList[0] ? `.${el.classList[0]}` : el.localName;
      return `“${text.length > 40 ? `${text.slice(0, 39)}…` : text}” (${name})`;
    });
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
      clipped: clippedChartText(screen),
    });
    screen.remove();
  }
  window.__check = results;
  document.documentElement.dataset.checkReady = '1';
  el.append(h('pre', { class: 'check-report' }, JSON.stringify(results, null, 1)));
  return { destroy: () => el.remove() };
}
