// Helpers for charts drawn as SVG: element builder, text widths, wrapping and box geometry.
// Text widths come from Helvetica metrics (Arial and Liberation Sans have the same widths), so a
// layout is the same on every device and in the PDF, and can be tested without a browser.

const NS = 'http://www.w3.org/2000/svg';

type Attr = string | number | null | undefined | false;
type Kid = Node | string | null | undefined | false;

export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, Attr> = {}, ...kids: (Kid | Kid[])[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    el.setAttribute(k, typeof v === 'number' ? String(Math.round(v * 10) / 10) : v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
  return el;
}

/** The root of a chart: viewBox units are CSS pixels at the chart's design width. */
export function root(kind: string, w: number, h: number, label: string, ...kids: (Kid | Kid[])[]): SVGSVGElement {
  const el = s('svg', { viewBox: `0 0 ${Math.round(w)} ${Math.ceil(h)}`, class: `chart-svg ${kind}`, role: 'img', 'aria-label': label }, ...kids);
  el.dataset.kind = kind;
  return el;
}

// ---- text widths ------------------------------------------------------------------------------

// Helvetica advance widths per 1000 units: regular and bold.
const LOWER_R = [556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500];
const LOWER_B = [556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500];
const UPPER_R = [667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611];
const UPPER_B = [722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611];
const PUNCT: Record<string, number> = {
  ' ': 278, '.': 278, ',': 278, "'": 222, '’': 222, '‘': 222, '"': 355, '“': 333, '”': 333, '-': 333, '–': 556, '—': 1000,
  '(': 333, ')': 333, ':': 278, ';': 278, '!': 278, '?': 556, '/': 278, '·': 278, '&': 667, '%': 889,
};

/** Width in px of `text` at `size` px. A 4 % margin covers Helvetica Neue and font hinting. */
export function textWidth(text: string, size: number, bold = false): number {
  let units = 0;
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if (c >= 97 && c <= 122) units += (bold ? LOWER_B : LOWER_R)[c - 97];
    else if (c >= 65 && c <= 90) units += (bold ? UPPER_B : UPPER_R)[c - 65];
    else if (c >= 48 && c <= 57) units += 556;
    else units += PUNCT[ch] ?? (bold ? 611 : 556);
  }
  return (units * size * 1.04) / 1000;
}

/** Wraps text into lines no wider than `max`. A word longer than a line gets a line of its own. */
export function wrap(text: string, max: number, size: number, bold = false): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const trial = cur ? `${cur} ${word}` : word;
    if (!cur || textWidth(trial, size, bold) <= max) cur = trial;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** <text> with one <tspan> per line, centred on (x, y) as a block. */
export function lines(text: string[], x: number, yMid: number, lineH: number, cls: string): SVGTextElement {
  const top = yMid - ((text.length - 1) * lineH) / 2;
  return s('text', { class: cls, x, y: top },
    text.map((t, i) => s('tspan', { x, y: top + i * lineH }, t)),
  );
}

// ---- geometry -----------------------------------------------------------------------------------

export interface Box { x: number; y: number; w: number; h: number }

export const overlaps = (a: Box, b: Box, pad = 0) =>
  !(a.x + a.w + pad <= b.x || b.x + b.w + pad <= a.x || a.y + a.h + pad <= b.y || b.y + b.h + pad <= a.y);

export const inside = (b: Box, x: number, y: number) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h;

export const outOf = (b: Box, w: number, h: number) => b.x < 0 || b.y < 0 || b.x + b.w > w || b.y + b.h > h;

/** Where the line from the centre of `b` towards (tx, ty) leaves the box. */
export function edgePoint(b: Box, tx: number, ty: number): [number, number] {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return [cx, cy];
  const t = Math.min(dx === 0 ? Infinity : b.w / 2 / Math.abs(dx), dy === 0 ? Infinity : b.h / 2 / Math.abs(dy));
  return [cx + dx * t, cy + dy * t];
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
