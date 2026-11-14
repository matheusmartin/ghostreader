// Network: who or what connects to whom. Fiction: the cast map (main character in the centre,
// the cast on a ring around, relations as labelled links). Non-fiction: a concept map.
//
// Layout: one or two centre nodes in the middle; the other nodes on an ellipse, in the order
// given, clockwise from the left of the top arc. On a phone the ring leaves out the far left and
// right, so every link is long enough to carry its label. Overlapping nodes are pushed apart along
// the ring; labels go where they touch the fewest nodes, labels and lines.

import type { NetworkChart } from '../model/types.ts';
import { clamp, edgePoint, overlaps, outOf, root, s, textWidth, type Box } from './svg.ts';

interface Node {
  name: string;
  note?: string;
  tag?: string;
  centre: boolean;
  key: boolean;
  w: number;
  h: number;
  /** Centre of the pill. */
  x: number;
  y: number;
  angle: number;
  /** 1 on the ring; less when the node is staggered inwards to make room. */
  reach: number;
}

const FS = 12;
const TAG_FS = 7.5;
const LABEL_FS = 10.5;

export function network(c: NetworkChart, width: number): SVGSVGElement {
  const phone = width < 480;
  const W = width;
  const H = phone ? Math.round(W * 1.45) : Math.round(W * 0.66);
  const pillH = phone ? 24 : 26;
  const centreH = phone ? 30 : 32;
  const noteH = 12;

  const tagW = (t?: string) => (t ? textWidth(t.toUpperCase(), TAG_FS, true) + 10 : 0);
  const mk = (name: string, centre: boolean, key: boolean, note?: string, tag?: string): Node => {
    const fs = centre ? 14 : FS;
    const w = Math.min(W * 0.46, textWidth(name, fs, true) + 22 + (tag ? tagW(tag) + 4 : 0));
    return { name, note, tag, centre, key, w: Math.max(w, 48), h: centre ? centreH : pillH, x: 0, y: 0, angle: 0, reach: 1 };
  };

  const centre = c.centre.map((n, i) => mk(n, true, i === 0));
  const ring = c.nodes.map((n) => mk(n.name, false, false, n.note, n.tag));
  const byName = new Map([...centre, ...ring].map((n) => [n.name, n]));

  // Centre nodes.
  const cx = W / 2;
  const cy = H / 2;
  const gap = centre.length === 2 ? centreH / 2 + 22 : 0;
  centre.forEach((n, i) => {
    n.x = cx;
    n.y = centre.length === 2 ? cy + (i === 0 ? -gap : gap) : cy;
  });

  // The ring: an ellipse almost as wide as the chart; a pill near the edge is moved inside.
  const boxH = (n: Node) => n.h + (n.note ? noteH : 0);
  const maxH = Math.max(pillH, ...ring.map(boxH));
  const rx = W / 2 - (phone ? 14 : 70);
  const ry = H / 2 - maxH / 2 - 2;
  const side = ((phone ? 18 : 8) * Math.PI) / 180;
  const topCount = Math.ceil(ring.length / 2);
  const arcs: { nodes: Node[]; a0: number; a1: number }[] = [
    { nodes: ring.slice(0, topCount), a0: -Math.PI + side, a1: -side },
    { nodes: ring.slice(topCount), a0: side, a1: Math.PI - side },
  ];
  const put = (n: Node, a: number) => {
    n.angle = a;
    n.x = clamp(cx + rx * n.reach * Math.cos(a), n.w / 2 + 2, W - n.w / 2 - 2);
    n.y = cy + ry * n.reach * Math.sin(a) - (n.note ? noteH / 2 : 0);
  };
  const box = (n: Node): Box => ({ x: n.x - n.w / 2, y: n.y - n.h / 2, w: n.w, h: boxH(n) });
  const pill = (n: Node): Box => ({ x: n.x - n.w / 2, y: n.y - n.h / 2, w: n.w, h: n.h });

  // Spacing walk: each node takes the first angle where it clears the one before; the room left
  // over is shared out, so nodes spread evenly where the ring is short of room and where it is not.
  const STEP = Math.PI / 720;
  /** Spacing walk with a gap of `pad` px: each node takes the first angle where it clears the two
   *  before it. Returns the angle of the last node. */
  const walk = (arc: (typeof arcs)[number], pad: number): number[] => {
    const pos: number[] = [];
    arc.nodes.forEach((n, i) => {
      let a = i === 0 ? arc.a0 : pos[i - 1] + STEP;
      put(n, a);
      const before = arc.nodes.slice(Math.max(0, i - 2), i);
      while (a < arc.a1 + Math.PI && before.some((b) => overlaps(box(b), box(n), pad))) put(n, (a += STEP));
      pos.push(a);
    });
    return pos;
  };
  /** The widest even gap that still fits the arc, then the nodes centred in it. */
  const spread = (arc: (typeof arcs)[number]): boolean => {
    const fits = (pad: number) => {
      const pos = walk(arc, pad);
      return pos[pos.length - 1] <= arc.a1 ? pos : null;
    };
    let best = fits(8);
    if (!best) return false;
    let lo = 8;
    let hi = W;
    for (let it = 0; it < 18; it++) {
      const mid = (lo + hi) / 2;
      const pos = fits(mid);
      if (pos) { lo = mid; best = pos; } else hi = mid;
    }
    const shift = (arc.a1 - best[best.length - 1] - (best[0] - arc.a0)) / 2;
    arc.nodes.forEach((n, i) => put(n, best![i] + shift));
    return true;
  };
  for (const arc of arcs) {
    if (arc.nodes.length === 0 || spread(arc)) continue;
    // Not enough room: every second node moves inwards, so neighbours sit at different heights.
    arc.nodes.forEach((n, i) => { n.reach = i % 2 === 1 ? 0.74 : 1; });
    if (spread(arc)) continue;
    // Still too many: squeeze them in (the screen check reports the overlap).
    const pos = walk(arc, 4);
    const last = pos[pos.length - 1];
    arc.nodes.forEach((n, i) => put(n, arc.a0 + ((pos[i] - arc.a0) * (arc.a1 - arc.a0)) / (last - arc.a0 || 1)));
  }
  let overlap = 0;
  const all = [...centre, ...ring];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (overlaps(box(all[i]), box(all[j]), 2)) overlap++;

  // Links.
  interface Link { d: string; at: (t: number) => [number, number]; label?: string; arrow: boolean; key: boolean; spoke?: boolean; pts: [number, number][] }
  const links: Link[] = [];
  for (const l of c.links) {
    const a = byName.get(l.from);
    const b = byName.get(l.to);
    if (!a || !b) continue;
    const curved = !a.centre && !b.centre;
    if (curved) {
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const toC = Math.hypot(cx - mx, cy - my) || 1;
      // A slight bend towards the centre: enough to clear the pills, not enough to cross the spokes.
      const bulge = clamp(Math.hypot(b.x - a.x, b.y - a.y) * 0.18, 8, 26);
      const qx = mx + ((cx - mx) / toC) * bulge;
      const qy = my + ((cy - my) / toC) * bulge;
      const [x1, y1] = edgePoint(pill(a), qx, qy);
      const [x2, y2] = edgePoint(pill(b), qx, qy);
      const at = (t: number): [number, number] => [
        (1 - t) ** 2 * x1 + 2 * (1 - t) * t * qx + t ** 2 * x2,
        (1 - t) ** 2 * y1 + 2 * (1 - t) * t * qy + t ** 2 * y2,
      ];
      links.push({ d: `M ${r(x1)} ${r(y1)} Q ${r(qx)} ${r(qy)} ${r(x2)} ${r(y2)}`, at, label: l.label, arrow: !!l.arrow, key: false, pts: sample(at) });
    } else {
      const [x1, y1] = edgePoint(pill(a), b.x, b.y);
      const [x2, y2] = edgePoint(pill(b), a.x, a.y);
      // Labels sit nearer the ring end, where spokes are further apart: measure from the centre.
      const fromCentre = a.centre && !b.centre ? 1 : !a.centre && b.centre ? -1 : 0;
      const base = (t: number): [number, number] => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
      const at = fromCentre === -1 ? (t: number) => base(1 - t) : base;
      links.push({ d: `M ${r(x1)} ${r(y1)} L ${r(x2)} ${r(y2)}`, at, label: l.label, arrow: !!l.arrow, key: a.key || b.key, spoke: fromCentre !== 0, pts: sample(base) });
    }
  }

  // Label pills where they collide least.
  const pills = all.map(box);
  const placed: Box[] = [];
  const labels: { box: Box; text: string }[] = [];
  let crowded = 0;
  for (const ln of links) {
    if (!ln.label) continue;
    const lw = textWidth(ln.label, LABEL_FS) + 12;
    let best: Box | null = null;
    let bestScore = Infinity;
    const ts = ln.spoke ? [0.6, 0.68, 0.52, 0.76, 0.44, 0.36] : [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74];
    for (const t of ts) for (const off of [0, 16, -16, 28, -28]) {
      // On the line, or just beside it (along the normal) when the line is short or crowded.
      const [px0, py0] = ln.at(Math.max(0, t - 0.02));
      const [px1, py1] = ln.at(Math.min(1, t + 0.02));
      const len = Math.hypot(px1 - px0, py1 - py0) || 1;
      const [x0, y0] = ln.at(t);
      const x = x0 + (-(py1 - py0) / len) * off;
      const y = y0 + ((px1 - px0) / len) * off;
      const cand: Box = { x: x - lw / 2, y: y - 8, w: lw, h: 16 };
      let score = Math.abs(t - ts[0]) + Math.abs(off) / 20;
      score += 10 * pills.filter((p) => overlaps(cand, p, 1)).length;
      score += 10 * placed.filter((p) => overlaps(cand, p, 2)).length;
      score += 3 * links.filter((o) => o !== ln && o.pts.some(([px, py]) => px > cand.x && px < cand.x + cand.w && py > cand.y && py < cand.y + cand.h)).length;
      if (outOf(cand, W, H)) score += 20;
      if (score < bestScore) {
        bestScore = score;
        best = cand;
      }
    }
    // Only a label on a name or on another label is a fault; lying across a line is fine.
    if (bestScore >= 10) crowded++;
    placed.push(best!);
    labels.push({ box: best!, text: ln.label });
  }

  const el = root('network', W, H, describe(c),
    links.map((ln) => s('path', { class: `${ln.arrow ? 'ar' : 'ln'}${ln.key ? ' strong' : ''}`, d: ln.d })),
    all.map((n) => {
      const p = pill(n);
      const textX = n.tag ? p.x + (p.w - tagW(n.tag) - 4) / 2 : n.x;
      return s('g', { class: 'node' },
        s('rect', { class: n.key ? 'k' : n.centre ? 'bi' : 'bt', x: p.x, y: p.y, width: p.w, height: p.h, rx: p.h / 2 }),
        s('text', { class: `${n.centre ? 't1' : 't2 tb'} c${n.key || n.centre ? ' tw' : ''}`, x: textX, y: n.y + (n.centre ? 5 : 4) }, n.name),
        n.tag ? tagPill(n.tag, p.x + p.w - tagW(n.tag) - 7, n.y) : null,
        n.note ? s('text', { class: 't4 c', x: n.x, y: p.y + p.h + 10 }, n.note) : null,
      );
    }),
    labels.map((lb) => s('g', { class: 'link-label' },
      s('rect', { class: 'bx', x: lb.box.x, y: lb.box.y, width: lb.box.w, height: lb.box.h, rx: 8 }),
      s('text', { class: 'tl c', x: lb.box.x + lb.box.w / 2, y: lb.box.y + 11.5 }, lb.text),
    )),
  );
  el.dataset.overlap = String(overlap + crowded);
  return el;
}

/** The small dark "NEW" pill after a name. */
export function tagPill(tag: string, x: number, yMid: number): SVGGElement {
  const t = tag.toUpperCase();
  const w = textWidth(t, TAG_FS, true) + 10;
  return s('g', { class: 'tag-pill' },
    s('rect', { class: 'tagbg', x, y: yMid - 6, width: w, height: 12, rx: 6 }),
    s('text', { class: 'tag-t c', x: x + w / 2, y: yMid + 2.7 }, t),
  );
}

const r = (v: number) => Math.round(v * 10) / 10;
const sample = (at: (t: number) => [number, number]) => Array.from({ length: 31 }, (_, i) => at(i / 30));

function describe(c: NetworkChart): string {
  const rel = c.links.map((l) => `${l.from} and ${l.to}${l.label ? `: ${l.label}` : ''}`).join('; ');
  return `${c.centre.join(' and ')} at the centre, with ${c.nodes.map((n) => n.name).join(', ')}. ${rel}`;
}
