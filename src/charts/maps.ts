// Mind map (a topic with its concepts and the book's examples) and x/y chart (items placed on two
// axes, or a scatter plot of real numbers), drawn as SVG at the design width: 340 on a phone, 640
// in the PDF. Both report collisions they cannot avoid in data-overlap, for the screen check.

import type { MindmapChart, XYChart } from '../model/types.ts';
import { clamp, lines, overlaps, root, s, textWidth, wrap, type Box } from './svg.ts';

const TITLE_FS = 12;
const LEAF_FS = 11;
const NOTE_FS = 10;

// ---- mind map -----------------------------------------------------------------------------------

interface Branch {
  title: string[];
  note: string[];
  leaves: string[][];
  key: boolean;
  side: 0 | 1;
  box: Box;
  h: number;
}

/**
 * The topic in the middle; concepts on either side in boxes, linked to it; the book's examples
 * hang under their concept, unboxed, on a dotted rule (concepts are boxed, examples are not).
 */
export function mindmap(c: MindmapChart, width: number): SVGSVGElement {
  const W = width;
  const phone = width < 480;
  const centreW = phone ? 86 : 150;
  const gap = phone ? 10 : 24;
  const colW = (W - centreW - 2 * gap) / 2;
  const inner = colW - 14;

  const branches: Branch[] = c.branches.map((b) => {
    const title = wrap(b.title, inner, TITLE_FS, true).slice(0, 3);
    const note = b.note ? wrap(b.note, inner, NOTE_FS).slice(0, 2) : [];
    const leaves = (b.leaves ?? []).map((l) => wrap(l, colW - 16, LEAF_FS).slice(0, 3));
    const boxH = 14 + title.length * 15 + note.length * 12;
    const leavesH = leaves.reduce((n, l) => n + l.length * 13 + 5, 0);
    return { title, note, leaves, key: !!b.key, side: 0, box: { x: 0, y: 0, w: colW, h: boxH }, h: boxH + (leaves.length ? leavesH + 6 : 0) };
  });

  // Balance the two sides by height, keeping the book's order within each side.
  const BETWEEN = phone ? 14 : 18;
  const heights = [0, 0];
  for (const b of branches) {
    b.side = heights[0] <= heights[1] ? 0 : 1;
    heights[b.side] += b.h + BETWEEN;
  }
  const centreLines = wrap(c.centre, centreW - 14, TITLE_FS + 1, true).slice(0, 6);
  const centreH = 18 + centreLines.length * 16;
  const H = Math.max(heights[0], heights[1], centreH + 20) - BETWEEN + 4;

  for (const side of [0, 1] as const) {
    const col = branches.filter((b) => b.side === side);
    const total = col.reduce((n, b) => n + b.h, 0) + BETWEEN * (col.length - 1);
    let y = (H - total) / 2;
    for (const b of col) {
      b.box.x = side === 0 ? 0 : W - colW;
      b.box.y = y;
      y += b.h + BETWEEN;
    }
  }
  const centre: Box = { x: (W - centreW) / 2, y: (H - centreH) / 2, w: centreW, h: centreH };

  const parts: SVGElement[] = [];
  // Links from the topic to each concept: a soft curve from the topic's side to the box's inner side.
  for (const b of branches) {
    const x0 = b.side === 0 ? centre.x : centre.x + centre.w;
    const y0 = clamp(b.box.y + b.box.h / 2, centre.y + 10, centre.y + centre.h - 10);
    const x1 = b.side === 0 ? b.box.x + b.box.w : b.box.x;
    const y1 = b.box.y + b.box.h / 2;
    const mx = (x0 + x1) / 2;
    parts.push(s('path', { class: `ln${b.key ? ' strong' : ''}`, d: `M ${x0} ${y0} C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}` }));
  }
  parts.push(s('rect', { class: 'bi', x: centre.x, y: centre.y, width: centre.w, height: centre.h, rx: 14 }));
  parts.push(lines(centreLines, W / 2, centre.y + centre.h / 2 + 4, 16, 't3 tb c tw'));

  let overlap = 0;
  for (const b of branches) {
    const { x, y, w, h } = b.box;
    const tw = b.key ? ' tw' : '';
    parts.push(s('rect', { class: b.key ? 'k' : 'bt', x, y, width: w, height: h, rx: 12 }));
    const top = y + 7 + 11;
    b.title.forEach((t, k) => parts.push(s('text', { class: `t2 tb c${tw}`, x: x + w / 2, y: top + k * 15 }, t)));
    b.note.forEach((t, k) => parts.push(s('text', { class: `t4 c${tw}`, x: x + w / 2, y: top + b.title.length * 15 + k * 12 }, t)));
    if (b.leaves.length) {
      // Examples: a dotted rule down the concept's outer side, each example on a short tick.
      const rx = b.side === 0 ? x + 8 : x + w - 8;
      let ly = y + h + 8;
      const ticks: SVGElement[] = [];
      const texts: SVGElement[] = [];
      for (const leaf of b.leaves) {
        const mid = ly + ((leaf.length - 1) * 13) / 2 + 4;
        ticks.push(s('line', { class: 'ln dash', x1: rx, y1: mid - 4, x2: b.side === 0 ? rx + 6 : rx - 6, y2: mid - 4 }));
        texts.push(s('text', { class: `tn${b.side === 0 ? '' : ' e'}`, x: b.side === 0 ? rx + 10 : rx - 10, y: ly + 9 },
          leaf.map((t, k) => s('tspan', { x: b.side === 0 ? rx + 10 : rx - 10, y: ly + 9 + k * 13 }, t))));
        ly += leaf.length * 13 + 5;
      }
      parts.push(s('line', { class: 'ln dash', x1: rx, y1: y + h, x2: rx, y2: ly - 9 }), ...ticks, ...texts);
      if (ly > H + 2) overlap++;
    }
  }
  const label = `A mind map of ${c.centre}: ${c.branches.map((b) => b.title + (b.leaves?.length ? ` (${b.leaves.join(', ')})` : '')).join('; ')}.`;
  const el = root('mindmap', W, H, label, parts);
  el.dataset.overlap = String(overlap);
  return el;
}

// ---- x/y chart ---------------------------------------------------------------------------------

/**
 * Two axes the book names, each from `low` to `high`, and items placed on them. In "scale" mode
 * the positions are 0–4 on the book's own scale (none, little, some, much, most); in "data" mode
 * they are the book's numbers and the axes show their range. One `key` item in the accent colour;
 * `arrows` show a move from one item to another (a change the book describes).
 */
export function xy(c: XYChart, width: number): SVGSVGElement {
  const W = width;
  const phone = width < 480;
  const data = c.mode === 'data';
  const left = 24;
  const right = 6;
  const top = 18;
  const plotW = W - left - right;
  const plotH = phone ? Math.round(plotW * 0.95) : Math.round(plotW * 0.62);
  const bottom = 34;
  const H = top + plotH + bottom;
  const x0 = left;
  const y0 = top + plotH;

  const range = (vals: number[]) => {
    if (!data) return [0, 4] as const;
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = (hi - lo || Math.abs(hi) || 1) * 0.12;
    return [lo - pad, hi + pad] as const;
  };
  const [xl, xh] = range(c.points.map((p) => p.x));
  const [yl, yh] = range(c.points.map((p) => p.y));
  // Keep the points off the axes: the scale runs from 9% to 91% of each axis.
  const px = (v: number) => x0 + plotW * (0.09 + 0.82 * ((v - xl) / (xh - xl)));
  const py = (v: number) => y0 - plotH * (0.09 + 0.82 * ((v - yl) / (yh - yl)));

  const parts: SVGElement[] = [];
  // Quadrants (scale mode): faint lines at the middle; each name sits by the centre of the chart,
  // in its quadrant, where extreme points are least likely to be.
  const quads: Box[] = [];
  if (!data) {
    const mx = px(2);
    const my = py(2);
    parts.push(s('line', { class: 'ln dash', x1: mx, y1: top, x2: mx, y2: y0 }));
    parts.push(s('line', { class: 'ln dash', x1: x0, y1: my, x2: x0 + plotW, y2: my }));
    (c.quadrants ?? []).forEach((t, i) => {
      if (!t) return;
      const right = i % 2 === 1;
      const below = i >= 2;
      const w = textWidth(t, NOTE_FS);
      const x = right ? mx + 6 : mx - 6;
      const y = below ? my + 14 : my - 6;
      quads.push({ x: right ? x : x - w, y: y - 10, w, h: 12 });
      parts.push(s('text', { class: `t4${right ? '' : ' e'}`, x, y }, t));
    });
  }
  // Axes with arrow heads. Scale mode: the book's words for each end; data mode: the lowest and
  // highest of the book's numbers, with a tick. The y axis reads upwards, along the axis.
  parts.push(s('path', { class: 'ar', d: `M ${x0} ${y0} L ${x0 + plotW} ${y0}` }));
  parts.push(s('path', { class: 'ar', d: `M ${x0} ${y0} L ${x0} ${top - 4}` }));
  const xs = c.points.map((p) => p.x);
  const ys = c.points.map((p) => p.y);
  const xEnds: [string, number, string][] = data
    ? [[fmt(Math.min(...xs), c.x.unit), px(Math.min(...xs)), 'c'], [fmt(Math.max(...xs), c.x.unit), px(Math.max(...xs)), 'c']]
    : [[c.x.low ?? '', x0, ''], [c.x.high ?? '', x0 + plotW, 'e']];
  for (const [t, x, a] of xEnds) {
    parts.push(s('text', { class: `t4${a ? ` ${a}` : ''}`, x, y: y0 + 13 }, t));
    if (data) parts.push(s('line', { class: 'ln', x1: x, y1: y0 - 3, x2: x, y2: y0 + 3 }));
  }
  parts.push(s('text', { class: 't2 tb c', x: x0 + plotW / 2, y: y0 + 28 }, c.x.label));
  // In the rotated frame, x grows upwards from the middle of the y axis.
  const ax = x0 - 9;
  const ay = top + plotH / 2;
  const up = (yv: number) => ax + (ay - yv);
  const yEnds: [string, number, string][] = data
    ? [[fmt(Math.min(...ys), c.y.unit), up(py(Math.min(...ys))), 'c'], [fmt(Math.max(...ys), c.y.unit), up(py(Math.max(...ys))), 'c']]
    : [[c.y.low ?? '', up(y0), ''], [c.y.high ?? '', up(top), 'e']];
  parts.push(s('g', { transform: `rotate(-90 ${ax} ${ay})` },
    s('text', { class: 't2 tb c', x: ax, y: ay + 4 }, c.y.label),
    yEnds.map(([t, x, a]) => s('text', { class: `t4${a ? ` ${a}` : ''}`, x, y: ay + 4 }, t)),
  ));
  if (data) for (const v of [Math.min(...ys), Math.max(...ys)]) parts.push(s('line', { class: 'ln', x1: x0 - 3, y1: py(v), x2: x0 + 3, y2: py(v) }));

  // Dots, then labels placed where they collide least: right, left, above, below.
  const dots: Box[] = c.points.map((p) => ({ x: px(p.x) - 6, y: py(p.y) - 6, w: 12, h: 12 }));
  const placed: Box[] = [...quads];
  // Points along each move, so labels keep off the arrows.
  const at = new Map(c.points.map((p) => [p.label, [px(p.x), py(p.y)] as const]));
  const trail: [number, number][] = (c.arrows ?? []).flatMap((a) => {
    const f = at.get(a.from);
    const t = at.get(a.to);
    if (!f || !t) return [];
    return Array.from({ length: 9 }, (_, k) => [f[0] + ((t[0] - f[0]) * (k + 1)) / 10, f[1] + ((t[1] - f[1]) * (k + 1)) / 10] as [number, number]);
  });
  let overlap = 0;
  const labels: SVGElement[] = [];
  c.points.forEach((p, i) => {
    const cx = px(p.x);
    const cy = py(p.y);
    const title = wrap(p.label, phone ? 110 : 160, LEAF_FS + 0.5, true).slice(0, 2);
    const note = p.note ? wrap(p.note, phone ? 110 : 160, NOTE_FS).slice(0, 1) : [];
    const lw = Math.max(...title.map((t) => textWidth(t, LEAF_FS + 0.5, true)), ...note.map((t) => textWidth(t, NOTE_FS)));
    const lh = title.length * 13 + note.length * 12;
    const cands: [Box, 'l' | 'r' | 'c'][] = [
      [{ x: cx + 9, y: cy - lh / 2, w: lw, h: lh }, 'l'],
      [{ x: cx - 9 - lw, y: cy - lh / 2, w: lw, h: lh }, 'r'],
      [{ x: clamp(cx - lw / 2, x0 + 4, W - lw - 2), y: cy - 9 - lh, w: lw, h: lh }, 'c'],
      [{ x: clamp(cx - lw / 2, x0 + 4, W - lw - 2), y: cy + 9, w: lw, h: lh }, 'c'],
    ];
    let best = cands[0];
    let bestScore = Infinity;
    const forced = p.side ? [cands[['right', 'left', 'above', 'below'].indexOf(p.side)]] : null;
    for (const cand of forced ?? cands) {
      const [b] = cand;
      let score = 0;
      score += 10 * placed.filter((o) => overlaps(b, o, 2)).length;
      score += 10 * dots.filter((d, j) => j !== i && overlaps(b, d)).length;
      score += 3 * trail.filter(([tx, ty]) => tx > b.x && tx < b.x + b.w && ty > b.y && ty < b.y + b.h).length;
      if (b.x < x0 + 2 || b.x + b.w > W || b.y < 0 || b.y + b.h > y0 - 1) score += 6;
      if (score < bestScore) { bestScore = score; best = cand; }
    }
    if (bestScore >= 10) overlap++;
    placed.push(best[0]);
    const [b, align] = best;
    const tx = align === 'l' ? b.x : align === 'r' ? b.x + b.w : b.x + b.w / 2;
    const anchor = align === 'l' ? '' : align === 'r' ? ' e' : ' c';
    labels.push(s('text', { class: `t2 tb${anchor}${p.key ? ' ta' : ''}`, x: tx, y: b.y + 10 },
      title.map((t, k) => s('tspan', { x: tx, y: b.y + 10 + k * 13 }, t))));
    if (note.length) labels.push(s('text', { class: `t4${anchor}`, x: tx, y: b.y + title.length * 13 + 9 }, note[0]));
  });
  // Moves between items: a curve bent to the side where its label meets no other label.
  const pos = new Map(c.points.map((p) => [p.label, [px(p.x), py(p.y)] as const]));
  const moves: SVGElement[] = [];
  for (const a of c.arrows ?? []) {
    const from = pos.get(a.from);
    const to = pos.get(a.to);
    if (!from || !to) continue;
    const [ax, ay] = from;
    const [bx, by] = to;
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const sx = ax + ((bx - ax) / len) * 9;
    const sy = ay + ((by - ay) / len) * 9;
    const ex = bx - ((bx - ax) / len) * 11;
    const ey = by - ((by - ay) / len) * 11;
    let best: { d: string; lx: number; ly: number; score: number } | null = null;
    for (const bend of [18, -18, 34, -34]) {
      const cx = (sx + ex) / 2 - ((ey - sy) / len) * bend;
      const cy = (sy + ey) / 2 + ((ex - sx) / len) * bend;
      const mx = 0.25 * sx + 0.5 * cx + 0.25 * ex;
      const my = 0.25 * sy + 0.5 * cy + 0.25 * ey;
      const lw = a.label ? textWidth(a.label, NOTE_FS) : 0;
      const lb: Box = { x: mx - lw / 2, y: my - 14, w: lw, h: 12 };
      let score = a.label ? placed.filter((o) => overlaps(lb, o, 2)).length + dots.filter((d) => overlaps(lb, d)).length : 0;
      // The curve itself should not cross a label: sample it and count the hits.
      for (let k = 1; k < 12; k++) {
        const t = k / 12;
        const qx = (1 - t) ** 2 * sx + 2 * (1 - t) * t * cx + t * t * ex;
        const qy = (1 - t) ** 2 * sy + 2 * (1 - t) * t * cy + t * t * ey;
        if (placed.some((o) => qx > o.x - 2 && qx < o.x + o.w + 2 && qy > o.y - 2 && qy < o.y + o.h + 2)) score += 0.5;
      }
      if (!best || score < best.score) best = { d: `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`, lx: mx, ly: my - 4, score };
    }
    if (!best) continue;
    if (best.score > 0) overlap++;
    moves.push(s('path', { class: 'ara', d: best.d }));
    if (a.label) moves.push(s('text', { class: 't4 c', x: best.lx, y: best.ly }, a.label));
  }
  const marks = c.points.map((p) => s('circle', { class: p.key ? 'k' : 'bi', cx: px(p.x), cy: py(p.y), r: p.key ? 6.5 : 5 }));

  const label = `${c.x.label} against ${c.y.label}: ${c.points.map((p) => `${p.label} (${data ? `${p.x}, ${p.y}` : `${word(p.x)} ${c.x.label.toLowerCase()}, ${word(p.y)} ${c.y.label.toLowerCase()}`})`).join('; ')}.`;
  const el = root('xy', W, H, label, parts, moves, marks, labels);
  el.dataset.overlap = String(overlap);
  return el;
}

const word = (v: number) => ['no', 'little', 'some', 'much', 'most'][clamp(Math.round(v), 0, 4)];

function fmt(v: number, unit?: string): string {
  const r = Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
  if (unit === 'year') return String(r);
  const n = r.toLocaleString('en-GB');
  if (!unit) return n;
  return unit === '%' ? `${n}%` : unit.startsWith('$') ? `$${n}${unit.slice(1)}` : `${n} ${unit}`;
}
