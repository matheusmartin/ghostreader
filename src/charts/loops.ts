// Cycle (a loop that feeds itself) and layers (nested levels), drawn as SVG.

import type { CycleChart, LayersChart } from '../model/types.ts';
import { clamp, inside, lines, overlaps, root, s, wrap, type Box } from './svg.ts';

const TITLE_FS = 12;
const NOTE_FS = 10.5;

export function cycle(c: CycleChart, width: number): SVGSVGElement {
  const W = width;
  const phone = width < 480;
  const n = c.nodes.length;
  const boxW = phone ? (n >= 5 ? 120 : 128) : 170;
  const inner = boxW - 16;
  const wrapped = c.nodes.map((nd) => ({
    title: wrap(nd.title, inner, TITLE_FS, true).slice(0, 2),
    note: nd.text ? wrap(nd.text, inner, NOTE_FS).slice(0, 2) : [],
  }));
  const boxH = Math.max(...wrapped.map((t) => 16 + t.title.length * 15 + t.note.length * 13));
  const H = phone ? (n === 3 ? 300 : 370) : 330;
  const cx = W / 2;
  const cy = H / 2;
  const rx = W / 2 - boxW / 2 - 2;
  const ry = H / 2 - boxH / 2 - 2;

  const angles = c.nodes.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / n);
  const box = (a: number): Box => ({ x: cx + rx * Math.cos(a) - boxW / 2, y: cy + ry * Math.sin(a) - boxH / 2, w: boxW, h: boxH });
  // Push apart neighbours that touch (five nodes on a narrow phone).
  for (let it = 0; it < 300; it++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (overlaps(box(angles[i]), box(angles[j]), 8)) {
        angles[i] -= 0.005;
        angles[j] += 0.005;
        moved = true;
      }
    }
    if (!moved) break;
  }

  const point = (a: number): [number, number] => [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  const arrows: SVGElement[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = angles[i];
    let a1 = angles[(i + 1) % n];
    if (a1 <= a0) a1 += 2 * Math.PI;
    const b0 = box(angles[i]);
    const b1 = box(angles[(i + 1) % n]);
    let s0 = a0;
    while (s0 < a1 && inside(grow(b0, 4), ...point(s0))) s0 += 0.01;
    let s1 = a1;
    while (s1 > s0 && inside(grow(b1, 6), ...point(s1))) s1 -= 0.01;
    if (s1 - s0 < 0.05) continue;
    const [x0, y0] = point(s0);
    const [x1, y1] = point(s1);
    arrows.push(s('path', { class: 'ar', d: `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${rx.toFixed(1)} ${ry.toFixed(1)} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}` }));
  }

  const nodes = c.nodes.map((nd, i) => {
    const b = box(angles[i]);
    const t = wrapped[i];
    const tw = nd.key ? ' tw' : '';
    const top = b.y + (boxH - (t.title.length * 15 + t.note.length * 13)) / 2 + 11;
    return s('g', { class: 'node' },
      s('rect', { class: nd.key ? 'k' : 'bt', x: b.x, y: b.y, width: b.w, height: b.h, rx: 12 }),
      t.title.map((line, k) => s('text', { class: `t2 tb c${tw}`, x: b.x + b.w / 2, y: top + k * 15 }, line)),
      t.note.map((line, k) => s('text', { class: `t4 c${tw}`, x: b.x + b.w / 2, y: top + t.title.length * 15 + k * 13 }, line)),
    );
  });

  // The note in the middle takes the room between the boxes at mid-height.
  let middle: SVGTextElement | null = null;
  if (c.centre) {
    const band: Box = { x: 0, y: cy - 24, w: W, h: 48 };
    const near = angles.map(box).filter((b) => overlaps(b, band));
    const left = Math.max(cx - rx, ...near.filter((b) => b.x + b.w / 2 < cx).map((b) => b.x + b.w));
    const right = Math.min(cx + rx, ...near.filter((b) => b.x + b.w / 2 > cx).map((b) => b.x));
    const room = Math.max(56, right - left - 14);
    middle = lines(wrap(c.centre, room, NOTE_FS + 1).slice(0, 3), (left + right) / 2, cy + 4, 14, 'tn c');
  }
  const label = `A loop: ${c.nodes.map((nd) => nd.title).join(', then ')}, and back to ${c.nodes[0].title}.`;
  return root('cycle', W, H, label, arrows, nodes, middle);
}

export function layers(c: LayersChart, width: number): SVGSVGElement {
  const W = width;
  const phone = width < 480;
  const R = phone ? W / 2 - 2 : Math.min(W / 2 - 2, 190);
  const H = 2 * R + 4;
  const cx = W / 2;
  const cy = R + 2;
  const n = c.rings.length;
  const innerR = R * (n > 3 ? 0.27 : 0.32);
  const radius = (i: number) => R - (i * (R - innerR)) / (n - 1);
  const opacity = (i: number) => clamp(0.1 + i * 0.09, 0.1, 0.42);

  const parts: SVGElement[] = [];
  for (let i = 0; i < n - 1; i++) {
    parts.push(s('circle', { class: 'lay', cx, cy, r: radius(i), 'fill-opacity': opacity(i) }));
  }
  parts.push(s('circle', { class: 'k', cx, cy, r: innerR }));
  for (let i = 0; i < n - 1; i++) {
    const band = radius(i) - radius(i + 1);
    const ring = c.rings[i];
    const yTitle = cy - radius(i) + Math.min(17, band / 2 + (ring.text && band >= 30 ? -1 : 4));
    parts.push(s('text', { class: 't2 tb c', x: cx, y: yTitle }, ring.title));
    if (ring.text && band >= 30) parts.push(s('text', { class: 't4 c', x: cx, y: yTitle + 13 }, ring.text));
  }
  const centre = c.rings[n - 1];
  const title = wrap(centre.title, innerR * 1.7, TITLE_FS, true).slice(0, 2);
  const note = centre.text ? wrap(centre.text, innerR * 1.7, NOTE_FS).slice(0, 2) : [];
  const blockH = title.length * 15 + note.length * 13;
  const top = cy - blockH / 2 + 11;
  title.forEach((t, k) => parts.push(s('text', { class: 't2 tb c tw', x: cx, y: top + k * 15 }, t)));
  note.forEach((t, k) => parts.push(s('text', { class: 't4 c tw', x: cx, y: top + title.length * 15 + k * 13 }, t)));

  return root('layers', W, H, `Layers, from the outside in: ${c.rings.map((r) => r.title).join(', ')}.`, parts);
}

const grow = (b: Box, d: number): Box => ({ x: b.x - d, y: b.y - d, w: b.w + 2 * d, h: b.h + 2 * d });
