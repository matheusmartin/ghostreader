// Fiction charts drawn from data: the scene chart ("who is where") and the thread tracker.
//
// Scene chart: a storyline chart. The scenes go down the chart, in book order. Each person is one
// line; the lines of the people in a scene come together in a band, so you see who meets whom and
// how each person moves through the chapter. A line starts where the person enters the chapter
// (their name is above it) and ends with a dot where they leave. Main character (the first `focus`
// name): ink line; second focus person: accent line; the others grey. Dotted: there only at a
// distance. Faint: away for a scene. The key scene (the turning point) is the darker band.
// Wide (the PDF): the scene text is on the left of each band. Narrow (a phone): a number at each
// band, and the text on the next screens.
//
// Thread tracker: one row per story thread, one column per chapter. Small dot: the thread
// appears; large dot: a major development.

import type { ScenesScreen, ThreadsChart } from '../model/types.ts';
import { smartQuotes } from '../lib/dom.ts';
import { tagPill } from './network.ts';
import { root, s, textWidth } from './svg.ts';

const NAME_FS = 12;
const TAG_FS = 7.5;

/** Width at and above which the scene text goes into the chart, next to its band. */
export const SCENE_TEXT_WIDTH = 560;

const SCENE_FS = 12;
const SCENE_LH = 16;
const LABEL_STEP = 18;
const BAND_H = 34;
/** Least space between two bands: room for a name. */
const NAME_GAP = 22;

export type Run = [text: string, cls: '' | 'ta' | 'tb'];
export type LineState = 'in' | 'off' | 'gone';

export interface SceneRow {
  /** Top of the row (the first text line) and the centre line of its band. */
  y: number;
  band: number;
  lines: Run[][];
  key: boolean;
  /** Band: left and right edge. */
  x0: number;
  x1: number;
}

export interface PersonLine {
  name: string;
  tag?: string;
  /** 'ink' (main character), 'acc' (second focus person) or 'grey'. */
  role: 'ink' | 'acc' | 'grey';
  points: { x: number; y: number; state: LineState }[];
  /** Set when the person leaves before the last scene: the dot at the end of the line. */
  end?: { x: number; y: number };
  label: { x: number; y: number; w: number };
}

export interface SceneLayout {
  width: number;
  height: number;
  /** True: the scene text is in the chart. False: a number marks each band. */
  text: boolean;
  textWidth: number;
  rows: SceneRow[];
  people: PersonLine[];
}

/** {when} (accent, bold) and [where] (bold) as runs of one sentence. */
export function styledRuns(text: string): Run[] {
  return smartQuotes(text)
    .split(/(\{[^{}]+\}|\[[^[\]]+\])/)
    .filter(Boolean)
    .map((m): Run => (m.startsWith('{') && m.endsWith('}') ? [m.slice(1, -1), 'ta'] : m.startsWith('[') && m.endsWith(']') ? [m.slice(1, -1), 'tb'] : [m, '']));
}

/** Wraps styled runs into lines no wider than `max`. Punctuation right after a run stays with it. */
export function wrapRuns(runs: Run[], max: number, size: number): Run[][] {
  const words: Run[][] = [];
  let space = true;
  for (const [txt, cls] of runs) {
    for (const part of txt.split(/( +)/)) {
      if (!part) continue;
      if (/^ +$/.test(part)) {
        space = true;
        continue;
      }
      if (!space && words.length) words[words.length - 1].push([part, cls]);
      else words.push([[part, cls]]);
      space = false;
    }
  }
  const sp = textWidth(' ', size);
  const lines: Run[][][] = [];
  let cur: Run[][] = [];
  let cw = 0;
  for (const wd of words) {
    const ww = wd.reduce((n, [t, c]) => n + textWidth(t, size, c !== ''), 0);
    if (cur.length && cw + sp + ww > max) {
      lines.push(cur);
      cur = [];
      cw = 0;
    }
    cw += (cur.length ? sp : 0) + ww;
    cur.push(wd);
  }
  if (cur.length) lines.push(cur);
  // Join the words of a line, merging pieces of the same style.
  return lines.map((line) => {
    const out: Run[] = [];
    line.forEach((wd, k) => {
      wd.forEach(([t, c], j) => {
        if (k && !j) out[out.length - 1] = [out[out.length - 1][0] + ' ', out[out.length - 1][1]];
        const last = out[out.length - 1];
        if (last && last[1] === c) out[out.length - 1] = [last[0] + t, c];
        else out.push([t, c]);
      });
    });
    return out;
  });
}

const tagW = (t?: string) => (t ? textWidth(t.toUpperCase(), TAG_FS, true) + 14 : 0);

/** The storyline layout, without the DOM (so it can be tested). */
export function sceneLayout(c: ScenesScreen, width: number, withText = width >= SCENE_TEXT_WIDTH): SceneLayout {
  const W = width;
  const names = c.people.map((p) => p.name);
  const focus = c.focus ?? names.slice(0, 2);
  const n = names.length;
  // Text column (wide) or number column (narrow), then the area of the lines.
  const TW = withText ? Math.round(W * 0.47) : 0;
  const X0 = withText ? Math.round(W * 0.53) : 46;
  const X1 = W - 14;
  const GAP = withText ? 19 : Math.min(19, (X1 - X0) / Math.max(n, 1));
  const LX0 = withText ? TW + 10 : 30;
  const step = Math.min((X1 - X0) / Math.max(n - 1, 1), 72);
  const left = (X0 + X1) / 2 - (step * (n - 1)) / 2;
  const home = new Map(names.map((nm, i) => [nm, left + i * step]));
  const where = (nm: string, j: number): LineState => {
    const sc = c.scenes[j];
    return sc.with.includes(nm) ? 'in' : sc.off?.includes(nm) ? 'off' : 'gone';
  };
  const labelW = (nm: string, tag?: string) => textWidth(nm, NAME_FS, true) + tagW(tag);
  const labelX = (nm: string, w: number) => Math.min(Math.max(home.get(nm)!, LX0 + w / 2), W - 2 - w / 2);

  // Room above the first scene for the names of the people who start there (staggered when close).
  const lv: { x: number; w: number; k: number }[] = [];
  for (const p of c.people) {
    if (where(p.name, 0) === 'gone') continue;
    const w = labelW(p.name, p.tag);
    const x = labelX(p.name, w);
    let k = 0;
    while (lv.some((o) => o.k === k && !(x - w / 2 > o.x + o.w / 2 + 4 || x + w / 2 < o.x - o.w / 2 - 4))) k++;
    lv.push({ x, w, k });
  }
  const lift = LABEL_STEP * Math.max(0, ...lv.map((o) => o.k));

  // Lay out the rows, the lines and the names. When the names of the people who enter at a scene
  // do not fit in the space above it, give that space one more line and lay out again.
  const extra = c.scenes.map(() => 0);
  for (let round = 0; ; round++) {
    // Rows: one paragraph per scene (wide) or one band (narrow).
    const rows: SceneRow[] = [];
    let y = 38 + lift;
    const rowGap = withText ? NAME_GAP : 30;
    c.scenes.forEach((sc, j) => {
      y += extra[j];
      const lines = withText ? wrapRuns(styledRuns(sc.text), TW, SCENE_FS) : [];
      // A band is 34 high; the rows keep at least NAME_GAP between bands, for the names of people
      // who enter there.
      const h = withText ? Math.max(SCENE_LH * lines.length, BAND_H) : 26;
      rows.push({ y, band: y + h / 2 - 1, lines, key: !!sc.key, x0: 0, x1: 0 });
      y += h + rowGap;
    });
    const H = y - rowGap + (withText ? 10 : 22);

    // Where each person sits in each scene: the people of a scene close together, in lane order.
    const pos = c.scenes.map((_, j) => {
      const here = names.filter((nm) => where(nm, j) !== 'gone');
      const mid = here.reduce((t, nm) => t + home.get(nm)!, 0) / Math.max(here.length, 1);
      const half = ((here.length - 1) * GAP) / 2;
      const cx = Math.max(X0 + half, Math.min(X1 - half, mid));
      const at = new Map(here.map((nm, k) => [nm, cx + (k - (here.length - 1) / 2) * GAP]));
      rows[j].x0 = cx - half - 15;
      rows[j].x1 = cx + half + 15;
      return at;
    });

    // Lines first, then the names (a name keeps clear of the bands, the other names and the lines).
    const people: PersonLine[] = [];
    const firsts: number[] = [];
    for (const p of c.people) {
      const nm = p.name;
      const idx = c.scenes.map((_, j) => j).filter((j) => pos[j].has(nm));
      if (!idx.length) continue;
      const f = idx[0];
      const l = idx[idx.length - 1];
      const role = nm === focus[0] ? 'ink' : focus.slice(1).includes(nm) ? 'acc' : 'grey';
      // A person who enters later starts in the space between the band before and their own band.
      const y0 = f === 0 ? 24 + lift : (rows[f - 1].band + rows[f].band) / 2;
      const points: PersonLine['points'] = [{ x: home.get(nm)!, y: y0, state: 'in' }];
      for (let j = f; j <= l; j++) {
        const st = where(nm, j);
        points.push({ x: st === 'gone' ? home.get(nm)! : pos[j].get(nm)!, y: rows[j].band, state: st });
      }
      const leaves = l < c.scenes.length - 1;
      const yEnd = leaves ? rows[l].band + BAND_H : H - 2;
      points.push({ x: home.get(nm)!, y: yEnd, state: 'in' });
      people.push({ name: nm, tag: p.tag, role, points, end: leaves ? { x: home.get(nm)!, y: yEnd } : undefined, label: { x: 0, y: 0, w: labelW(nm, p.tag) } });
      firsts.push(f);
    }

    const placed: { x: number; y: number; w: number }[] = [];
    const touchesName = (b: LabelBox) => placed.some((o) => overlap(b, labelBox(o), 4));
    // People in the first scene: names above the chart, moved up when they would touch another name.
    people.forEach((p, i) => {
      if (firsts[i] !== 0) return;
      const w = p.label.w;
      const x = labelX(p.name, w);
      let y = p.points[0].y - 8;
      while (touchesName(labelBox({ x, y, w }))) y -= LABEL_STEP;
      p.label = { x, y, w };
      placed.push(p.label);
    });
    // People who enter later: the best place near the start of the line. Never on a band or another
    // name; as few lines crossed as possible.
    const bands: LabelBox[] = rows.map((r) => ({ x0: r.x0, y0: r.band - BAND_H / 2, x1: r.x1, y1: r.band + BAND_H / 2 }));
    const samples = people.map((p) => lineSamples(p.points));
    const fit = (x: number, w: number) => Math.min(Math.max(x, LX0 + w / 2), W - 2 - w / 2);
    const crowded = new Set<number>();
    people.forEach((p, i) => {
      if (firsts[i] === 0) return;
      const { x: sx, y: sy } = p.points[0];
      const w = p.label.w;
      const mid = sy + 4;
      // Next to the start, right or left, then further along the space between the bands.
      const tries: { x: number; y: number; w: number }[] = [];
      // Baselines that keep the name inside the space between the bands.
      const f = firsts[i];
      const ys: number[] = [];
      for (let ly = rows[f - 1].band + BAND_H / 2 + 12; ly <= rows[f].band - BAND_H / 2 - 5; ly += 4) ys.push(ly);
      for (const dx of [0, 24, 48, 72, 96]) {
        for (const ly of ys) {
          tries.push({ x: fit(sx + 7 + dx + w / 2, w), y: ly, w }, { x: fit(sx - 7 - dx - w / 2, w), y: ly, w });
        }
      }
      const score = (t: { x: number; y: number; w: number }) => {
        const b = labelBox(t);
        // Far from the start of the line is worse.
        let n = Math.abs(t.x - sx) * 0.02 + Math.abs(t.y - mid) * 0.05;
        if (bands.some((band) => overlap(b, band, 2))) n += 1000;
        if (touchesName(b)) n += 1000;
        let crossed = 0;
        samples.forEach((pts, j) => {
          if (j !== i) crossed += pts.filter(([x, y]) => x > b.x0 - 1 && x < b.x1 + 1 && y > b.y0 - 1 && y < b.y1 + 1).length;
        });
        return { n: n + 5 * crossed, crossed };
      };
      const best = tries.map((t) => ({ t, ...score(t) })).sort((a, b) => a.n - b.n)[0];
      p.label = best.t;
      placed.push(best.t);
      // On a band or another name: more room. Across lines: more room too, but at most two lines.
      if (best.n >= 1000 || (best.crossed >= 3 && extra[f] < 2 * LABEL_STEP)) crowded.add(f);
    });
    if (!crowded.size || round >= 8) return { width: W, height: H, text: withText, textWidth: TW, rows, people };
    for (const f of crowded) extra[f] += LABEL_STEP;
  }
}

interface LabelBox { x0: number; y0: number; x1: number; y1: number }

/** The box of a name: `x` is its centre, `y` its baseline. */
export const labelBox = (l: { x: number; y: number; w: number }): LabelBox => ({ x0: l.x - l.w / 2, y0: l.y - 10, x1: l.x + l.w / 2, y1: l.y + 3 });

const overlap = (a: LabelBox, b: LabelBox, pad: number) => !(a.x1 + pad <= b.x0 || b.x1 + pad <= a.x0 || a.y1 + pad <= b.y0 || b.y1 + pad <= a.y0);

/** Points along a person's line: each part is the curve the chart draws (see sceneChart). */
function lineSamples(points: PersonLine['points']): [number, number][] {
  const out: [number, number][] = [];
  points.slice(1).forEach((b, i) => {
    const a = points[i];
    const m = (a.y + b.y) / 2;
    for (let k = 0; k <= 16; k++) {
      const t = k / 16;
      const u = 1 - t;
      const x = u * u * u * a.x + 3 * u * u * t * a.x + 3 * u * t * t * b.x + t * t * t * b.x;
      const y = u * u * u * a.y + 3 * u * u * t * m + 3 * u * t * t * m + t * t * t * b.y;
      out.push([x, y]);
    }
  });
  return out;
}

export function sceneChart(c: ScenesScreen, width: number, withText = width >= SCENE_TEXT_WIDTH): SVGSVGElement {
  const L = sceneLayout(c, width, withText);
  const parts: SVGElement[] = [];
  // Rows: the rule between scenes, the band, the text or the number.
  L.rows.forEach((r, j) => {
    if (j) {
      const prev = L.rows[j - 1];
      const ry = L.text ? r.y - 10 : (prev.band + r.band) / 2;
      parts.push(s('line', { class: 'rail', x1: 0, y1: ry, x2: L.width, y2: ry }));
    }
    parts.push(s('rect', { class: r.key ? 'k kb' : 'bt', x: r.x0, y: r.band - BAND_H / 2, width: r.x1 - r.x0, height: BAND_H, rx: BAND_H / 2 }));
    if (L.text) {
      r.lines.forEach((ln, i) =>
        parts.push(s('text', { class: 'st', x: 0, y: r.y + 11 + i * SCENE_LH }, ln.map(([t, cl]) => (cl ? s('tspan', { class: cl }, t) : t)))),
      );
    } else {
      parts.push(s('circle', { class: r.key ? 'k' : 'scn', cx: 12, cy: r.band, r: 11 }));
      parts.push(s('text', { class: `t2 tb c${r.key ? ' tw' : ''}`, x: 12, y: r.band + 4 }, String(j + 1)));
    }
  });
  // Lines: grey first, so the focus lines are on top.
  const order = { grey: 0, acc: 1, ink: 2 } as const;
  const lines = [...L.people].sort((a, b) => order[a.role] - order[b.role]);
  for (const p of lines) {
    const cls = p.role === 'ink' ? 'life' : p.role === 'acc' ? 'life acc' : 'life grey';
    p.points.slice(1).forEach((b, i) => {
      const a = p.points[i];
      const st = a.state === 'gone' || b.state === 'gone' ? ' gone' : a.state === 'off' || b.state === 'off' ? ' dim' : '';
      const m = (a.y + b.y) / 2;
      parts.push(s('path', { class: cls + st, d: `M ${r1(a.x)} ${r1(a.y)} C ${r1(a.x)} ${r1(m)}, ${r1(b.x)} ${r1(m)}, ${r1(b.x)} ${r1(b.y)}` }));
    });
    if (p.end) parts.push(s('circle', { class: 'dot', cx: p.end.x, cy: p.end.y, r: 3.2 }));
  }
  // Names, over the lines.
  for (const p of L.people) {
    const tw = tagW(p.tag);
    const nw = p.label.w - tw;
    const tx = p.label.x - p.label.w / 2 + nw / 2;
    parts.push(s('text', { class: 't2 tb c halo', x: tx, y: p.label.y }, p.name));
    if (p.tag) parts.push(tagPill(p.tag, tx + nw / 2 + 5, p.label.y - 4));
  }
  const label = c.scenes
    .map((sc, j) => `Scene ${j + 1}: ${[...sc.with, ...(sc.off ?? []).map((o) => `${o} (at a distance)`)].join(', ')}`)
    .join('. ');
  return root('scenes', L.width, L.height, `Who is in each scene. ${label}`, parts);
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export function threadChart(c: ThreadsChart, width: number): SVGSVGElement {
  const W = width;
  const n = c.columns.length;
  const nameW = Math.min(W * 0.42, Math.max(60, ...c.threads.map((t) => textWidth(t.name, NAME_FS, true) + 12)));
  const head = 24;
  const rowH = width < 480 ? 38 : 30;
  const colW = (W - nameW - 6) / n;
  const H = head + rowH * c.threads.length + 2;
  const x = (j: number) => nameW + colW * (j + 0.5);
  const y = (i: number) => head + rowH * (i + 0.5);
  let every = 1;
  while (colW * every < 17) every++;
  const big = Math.max(3.6, Math.min(6.5, colW / 2 - 0.8));

  const parts: SVGElement[] = [s('text', { class: 't4', x: 0, y: 14 }, 'Chapter')];
  c.columns.forEach((col, j) => {
    if (colW >= 9) parts.push(s('line', { class: 'rail dash', x1: x(j), y1: head - 2, x2: x(j), y2: H - 2 }));
    if (j % every === 0 || j === n - 1) parts.push(s('text', { class: 't4 c', x: x(j), y: 14 }, col));
  });
  c.threads.forEach((t, i) => {
    parts.push(s('line', { class: 'rail', x1: nameW - 4, y1: y(i), x2: W - 2, y2: y(i) }));
    parts.push(s('text', { class: 't2 tb', x: 0, y: y(i) + 4 }, t.name));
    const major = new Set(t.major ?? []);
    c.columns.forEach((col, j) => {
      if (major.has(col)) parts.push(s('circle', { class: 'yes', cx: x(j), cy: y(i), r: big }));
      else if (t.appears.includes(col)) parts.push(s('circle', { class: 'past', cx: x(j), cy: y(i), r: 3.2 }));
    });
  });
  const label = c.threads.map((t) => `${t.name}: chapters ${t.appears.join(', ')}${t.major?.length ? `; major developments in ${t.major.join(', ')}` : ''}`).join('. ');
  return root('threads', W, H, `Story threads by chapter. ${label}`, parts);
}
