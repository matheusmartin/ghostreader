// Fiction charts drawn from data: the scene chart ("who is where") and the thread tracker.
//
// Scene chart: one row per person, one column per scene, in book order. A dot means the person
// is in the scene; a ring, there only at a distance. A vertical line joins the people who share
// a scene, so you see who meets whom; a line along a row shows a person staying in the story.
// The key scene (the turning point) is the one accent column.
//
// Thread tracker: one row per story thread, one column per chapter. Small dot: the thread
// appears; large dot: a major development.

import type { ScenesScreen, ThreadsChart } from '../model/types.ts';
import { tagPill } from './network.ts';
import { root, s, textWidth } from './svg.ts';

const NAME_FS = 12;
const TAG_FS = 7.5;

export function sceneChart(c: ScenesScreen, width: number): SVGSVGElement {
  const W = width;
  const phone = width < 480;
  const n = c.scenes.length;
  const tagW = (t?: string) => (t ? textWidth(t.toUpperCase(), TAG_FS, true) + 14 : 0);
  const nameW = Math.min(W * (phone ? 0.44 : 0.3), Math.max(64, ...c.people.map((p) => textWidth(p.name, NAME_FS) + tagW(p.tag) + 10)));
  const head = 22;
  const rowH = phone ? 40 : 30;
  const colW = (W - nameW - 2) / n;
  const H = head + rowH * c.people.length + 4;
  const x = (j: number) => nameW + colW * (j + 0.5);
  const y = (i: number) => head + rowH * (i + 0.5);
  const keyCol = c.scenes.findIndex((sc) => sc.key);
  const where = (name: string, j: number) => {
    const sc = c.scenes[j];
    return sc.with.includes(name) ? 'in' : sc.off?.includes(name) ? 'off' : null;
  };

  const parts: SVGElement[] = [];
  if (keyCol >= 0) {
    parts.push(s('rect', { class: 'band', x: x(keyCol) - colW / 2 + 1, y: head - 2, width: colW - 2, height: rowH * c.people.length + 4, rx: 8 }));
  }
  // Scene numbers.
  c.scenes.forEach((sc, j) => parts.push(s('text', { class: `t2 c${sc.key ? ' ta' : ' tb'}`, x: x(j), y: 14 }, String(j + 1))));
  // Rows: rail, lines between scenes, names.
  c.people.forEach((p, i) => {
    parts.push(s('line', { class: 'rail', x1: x(0) - colW * 0.35, y1: y(i), x2: x(n - 1) + colW * 0.35, y2: y(i) }));
    for (let j = 0; j + 1 < n; j++) {
      const a = where(p.name, j);
      const b = where(p.name, j + 1);
      if (a && b) parts.push(s('line', { class: `life${a === 'off' || b === 'off' ? ' dim' : ''}`, x1: x(j), y1: y(i), x2: x(j + 1), y2: y(i) }));
    }
    parts.push(s('text', { class: 't2 name', x: 0, y: y(i) + 4 }, p.name));
    if (p.tag) parts.push(tagPill(p.tag, textWidth(p.name, NAME_FS) + 6, y(i)));
  });
  // Columns: the line that joins the people in a scene, then the dots.
  c.scenes.forEach((sc, j) => {
    const rows = c.people.map((p, i) => (where(p.name, j) ? i : -1)).filter((i) => i >= 0);
    if (rows.length > 1) {
      parts.push(s('line', { class: `join${sc.key ? ' key' : ''}`, x1: x(j), y1: y(rows[0]), x2: x(j), y2: y(rows[rows.length - 1]) }));
    }
    for (const i of rows) {
      const off = where(c.people[i].name, j) === 'off';
      parts.push(s('circle', { class: off ? 'ring' : sc.key ? 'dot key' : 'dot', cx: x(j), cy: y(i), r: off ? 4.2 : 5 }));
    }
  });

  const label = c.scenes.map((sc, j) => `Scene ${j + 1}: ${[...sc.with, ...(sc.off ?? []).map((o) => `${o} (at a distance)`)].join(', ')}`).join('. ');
  return root('scenes', W, H, `Who is in each scene. ${label}`, parts);
}

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
