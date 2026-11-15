// Checks a book file against the format in types.ts. Returns every problem found, with its path,
// so an author can fix a whole file in one pass. `npm run validate` runs it on every bundled book,
// together with the content checks of lint.ts.

import { STYLES, type Book } from './types.ts';

export interface ValidationResult {
  book: Book | null;
  errors: string[];
}

const BOOK_TYPES = ['fiction', 'reading', 'done'];
export const SCREEN_TYPES = ['summary', 'points', 'steps', 'list', 'quiz', 'text', 'scenes', 'chart', 'figure'];
export const CHART_KINDS = ['bars', 'compare', 'flow', 'timeline', 'network', 'threads', 'cycle', 'matrix', 'branches', 'layers'];
const ID = /^[a-z0-9][a-z0-9-]*$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

type Obj = Record<string, unknown>;

export function validateBook(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const err = (path: string, msg: string) => errors.push(path ? `${path}: ${msg}` : msg);

  const at = (path: string, key: string) => (path ? `${path}.${key}` : key);
  const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
  const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
  const str = (o: Obj, key: string, path: string, required = true) => {
    const v = o[key];
    if (v === undefined) {
      if (required) err(path, `missing "${key}"`);
    } else if (!isStr(v)) err(path, `"${key}" must be a non-empty string`);
  };
  const bool = (o: Obj, key: string, path: string) => {
    if (o[key] !== undefined && typeof o[key] !== 'boolean') err(path, `"${key}" must be true or false`);
  };
  const arr = (o: Obj, key: string, path: string, min = 1): unknown[] | null => {
    const v = o[key];
    if (!Array.isArray(v)) {
      err(path, `"${key}" must be a list`);
      return null;
    }
    if (v.length < min) err(path, `"${key}" needs at least ${min} item${min === 1 ? '' : 's'}`);
    return v;
  };
  const strList = (o: Obj, key: string, path: string, min = 1): string[] => {
    const list = arr(o, key, path, min);
    list?.forEach((v, i) => {
      if (!isStr(v)) err(`${at(path, key)}[${i}]`, 'must be a non-empty string');
    });
    return (list ?? []).filter(isStr);
  };
  const optStrList = (o: Obj, key: string, path: string): string[] => (o[key] === undefined ? [] : strList(o, key, path, 0));
  const objList = (o: Obj, key: string, path: string, each: (item: Obj, p: string, i: number) => void, min = 1) => {
    const list = arr(o, key, path, min);
    list?.forEach((v, i) => {
      const p = `${at(path, key)}[${i}]`;
      if (isObj(v)) each(v, p, i);
      else err(p, 'must be an object');
    });
    return (list ?? []).filter(isObj);
  };
  // One colour scheme for the whole book: parts and groups no longer take a colour.
  const theme = (o: Obj, path: string) => {
    if (o.theme !== undefined) err(path, '"theme" is no longer used (one colour for the whole book): remove it');
  };
  const only = (o: Obj, path: string) => {
    if (o.only !== undefined && o.only !== 'app' && o.only !== 'pdf') err(path, '"only" must be "app" or "pdf"');
  };
  /** Names must be unique in a list; returns the set. */
  const names = (list: string[], path: string, what: string) => {
    const seen = new Set<string>();
    for (const n of list) {
      if (seen.has(n)) err(path, `${what} "${n}" is used twice`);
      seen.add(n);
    }
    return seen;
  };
  const known = (set: Set<string>, list: string[], path: string, what: string) => {
    for (const n of list) if (!set.has(n)) err(path, `"${n}" is not in ${what}`);
  };
  const atMostOneKey = (items: Obj[], path: string, exactlyOne = false) => {
    const keys = items.filter((it) => it.key === true).length;
    if (keys > 1) err(path, 'mark at most one item as "key"');
    if (exactlyOne && keys === 0) err(path, 'mark one item as "key" (the turning point)');
  };

  const chart = (s: Obj, p: string) => {
    if (!CHART_KINDS.includes(s.chart as string)) {
      err(p, `"chart" must be one of ${CHART_KINDS.join(', ')}`);
      return;
    }
    switch (s.chart) {
      case 'bars':
        objList(s, 'data', p, (d, dp) => {
          str(d, 'label', dp);
          bool(d, 'focus', dp);
          if (typeof d.value !== 'number' || !Number.isFinite(d.value) || d.value < 0) err(dp, '"value" must be a number ≥ 0');
        });
        break;
      case 'compare': {
        const cols = s.columns;
        if (!Array.isArray(cols) || cols.length !== 2 || cols.some((c) => !isStr(c))) err(p, '"columns" must be two strings');
        arr(s, 'rows', p)?.forEach((r, i) => {
          if (!Array.isArray(r) || r.length !== 2 || r.some((c) => !isStr(c))) err(`${p}.rows[${i}]`, 'must be two strings');
        });
        str(s, 'key', p, false);
        if (s.negative !== undefined && s.negative !== 0 && s.negative !== 1) err(p, '"negative" must be 0 or 1');
        break;
      }
      case 'flow':
        str(s, 'start', p, false);
        str(s, 'key', p, false);
        objList(s, 'groups', p, (g, gp) => {
          str(g, 'label', gp, false);
          theme(g, gp);
          strList(g, 'items', gp);
        });
        break;
      case 'timeline': {
        const items = objList(s, 'items', p, (it, ip) => {
          str(it, 'when', ip);
          str(it, 'title', ip, false);
          str(it, 'text', ip);
          bool(it, 'key', ip);
        }, 2);
        atMostOneKey(items, p);
        break;
      }
      case 'network': {
        const centre = strList(s, 'centre', p);
        if (centre.length > 2) err(p, '"centre" takes one or two names');
        const nodes = objList(s, 'nodes', p, (n, np) => {
          str(n, 'name', np);
          str(n, 'note', np, false);
          str(n, 'tag', np, false);
        });
        const all = names([...centre, ...nodes.map((n) => n.name).filter(isStr)], p, 'name');
        objList(s, 'links', p, (l, lp) => {
          str(l, 'from', lp);
          str(l, 'to', lp);
          str(l, 'label', lp, false);
          bool(l, 'arrow', lp);
          known(all, [l.from, l.to].filter(isStr), lp, 'centre or nodes');
          if (l.from === l.to) err(lp, 'a link joins two different names');
        }, 0);
        break;
      }
      case 'threads': {
        const cols = names(strList(s, 'columns', p), p, 'column');
        objList(s, 'threads', p, (t, tp) => {
          str(t, 'name', tp);
          str(t, 'text', tp, false);
          const appears = strList(t, 'appears', tp);
          const major = optStrList(t, 'major', tp);
          known(cols, [...appears, ...major], tp, '"columns"');
          for (const m of major) if (!appears.includes(m)) err(tp, `major "${m}" must also be in "appears"`);
        });
        break;
      }
      case 'cycle': {
        const nodes = objList(s, 'nodes', p, (n, np) => {
          str(n, 'title', np);
          str(n, 'text', np, false);
          bool(n, 'key', np);
        }, 3);
        if (nodes.length > 6) err(p, 'a cycle takes 3–6 nodes');
        atMostOneKey(nodes, p);
        str(s, 'centre', p, false);
        break;
      }
      case 'matrix': {
        const cols = strList(s, 'columns', p);
        objList(s, 'rows', p, (r, rp) => {
          str(r, 'label', rp);
          bool(r, 'focus', rp);
          const cells = r.cells;
          if (!Array.isArray(cells) || cells.some((c) => typeof c !== 'boolean')) err(rp, '"cells" must be a list of true or false');
          else if (cells.length !== cols.length) err(rp, `"cells" needs ${cols.length} values, one per column`);
        });
        str(s, 'key', p, false);
        break;
      }
      case 'branches': {
        str(s, 'start', p);
        const opts = objList(s, 'options', p, (o, op) => {
          str(o, 'title', op);
          str(o, 'text', op, false);
          bool(o, 'key', op);
          bool(o, 'negative', op);
        }, 2);
        if (opts.length > 4) err(p, 'branches take 2–4 options');
        atMostOneKey(opts, p);
        break;
      }
      case 'layers': {
        const rings = objList(s, 'rings', p, (r, rp) => {
          str(r, 'title', rp);
          str(r, 'text', rp, false);
        }, 2);
        if (rings.length > 5) err(p, 'layers take 2–5 rings');
        break;
      }
    }
  };

  const screen = (s: Obj, p: string) => {
    if (!SCREEN_TYPES.includes(s.type as string)) {
      err(p, `"type" must be one of ${SCREEN_TYPES.join(', ')}`);
      return;
    }
    only(s, p);
    switch (s.type) {
      case 'summary':
        str(s, 'label', p);
        str(s, 'text', p);
        if (s.takeaway !== undefined) {
          if (isObj(s.takeaway)) {
            str(s.takeaway, 'label', `${p}.takeaway`);
            str(s.takeaway, 'text', `${p}.takeaway`);
          } else err(p, '"takeaway" must be an object with label and text');
        }
        break;
      case 'points':
        str(s, 'label', p);
        if (s.style !== undefined && s.style !== 'bar' && s.style !== 'box') err(p, '"style" must be "bar" or "box"');
        objList(s, 'items', p, (it, ip) => {
          str(it, 'title', ip);
          str(it, 'text', ip);
          str(it, 'tag', ip, false);
        });
        break;
      case 'steps':
        str(s, 'label', p);
        strList(s, 'steps', p);
        break;
      case 'list':
        str(s, 'label', p);
        objList(s, 'rows', p, (r, rp) => {
          str(r, 'name', rp);
          str(r, 'text', rp);
          str(r, 'meta', rp, false);
        });
        break;
      case 'quiz':
        str(s, 'label', p);
        objList(s, 'questions', p, (q, qp) => {
          str(q, 'q', qp);
          str(q, 'a', qp);
        });
        break;
      case 'text':
        str(s, 'label', p, false);
        strList(s, 'paragraphs', p);
        break;
      case 'scenes': {
        str(s, 'label', p, false);
        const people = objList(s, 'people', p, (pp, ppp) => {
          str(pp, 'name', ppp);
          str(pp, 'tag', ppp, false);
        });
        const cast = names(people.map((x) => x.name).filter(isStr), p, 'person');
        const scenes = objList(s, 'scenes', p, (sc, sp) => {
          str(sc, 'text', sp);
          bool(sc, 'key', sp);
          const w = strList(sc, 'with', sp);
          const off = optStrList(sc, 'off', sp);
          known(cast, [...w, ...off], sp, '"people"');
          for (const n of off) if (w.includes(n)) err(sp, `"${n}" is in both "with" and "off"`);
        });
        atMostOneKey(scenes, p, true);
        for (const n of cast) {
          if (!scenes.some((sc) => [sc.with, sc.off].some((l) => Array.isArray(l) && l.includes(n)))) err(p, `"${n}" is in no scene`);
        }
        break;
      }
      case 'figure':
        str(s, 'label', p, false);
        str(s, 'alt', p);
        str(s, 'caption', p, false);
        if (typeof s.svg !== 'string' || !/^\s*<svg[\s>]/.test(s.svg)) err(p, '"svg" must be a string that starts with <svg');
        break;
      case 'chart':
        str(s, 'label', p, false);
        str(s, 'caption', p, false);
        chart(s, p);
        break;
    }
  };

  if (!isObj(raw)) return { book: null, errors: ['the book must be a JSON object'] };

  if (raw.format !== 1) err('', '"format" must be 1');
  str(raw, 'id', '');
  if (typeof raw.id === 'string' && !ID.test(raw.id)) err('', '"id" may use only letters, digits and hyphens');
  if (!BOOK_TYPES.includes(raw.type as string)) err('', `"type" must be one of ${BOOK_TYPES.join(', ')}`);
  if (raw.style !== undefined && !STYLES.includes(raw.style as never)) err('', `"style" must be one of ${STYLES.join(', ')}`);
  if (raw.guide !== undefined) {
    if (typeof raw.guide !== 'string' || !ID.test(raw.guide)) err('', '"guide" may use only letters, digits and hyphens');
    else if (raw.style === undefined) err('', 'a file with "guide" needs "style"');
    else if (raw.id !== `${raw.guide}-${raw.style}`) err('', `"id" must be "${raw.guide}-${raw.style}" ("<guide>-<style>")`);
  }
  str(raw, 'title', '');
  str(raw, 'author', '');
  for (const k of ['subtitle', 'edition', 'upTo']) str(raw, k, '', false);
  if (raw.year !== undefined && !Number.isInteger(raw.year)) err('', '"year" must be a whole number');
  bool(raw, 'sample', '');
  if (raw.source !== undefined) {
    if (!isObj(raw.source)) err('', '"source" must be an object');
    else {
      if (raw.source.kind !== 'book-file' && raw.source.kind !== 'summaries') err('source', '"kind" must be "book-file" or "summaries"');
      str(raw.source, 'file', 'source', false);
      str(raw.source, 'skill', 'source', false);
      if (raw.source.written !== undefined && !(typeof raw.source.written === 'string' && DATE.test(raw.source.written))) {
        err('source', '"written" must be a date, YYYY-MM-DD');
      }
    }
  }

  const ids = new Set<string>();
  const uniqueId = (o: Obj, p: string) => {
    str(o, 'id', p);
    if (typeof o.id !== 'string') return;
    if (!ID.test(o.id)) err(p, '"id" may use only letters, digits and hyphens');
    if (ids.has(o.id)) err(p, `id "${o.id}" is used twice`);
    ids.add(o.id);
  };

  let screens = 0;
  objList(raw, 'parts', '', (part, pp) => {
    uniqueId(part, pp);
    str(part, 'label', pp, false);
    str(part, 'title', pp, false);
    theme(part, pp);
    objList(part, 'chapters', pp, (ch, cp) => {
      uniqueId(ch, cp);
      str(ch, 'number', cp);
      str(ch, 'title', cp);
      if (ch.length !== undefined && !(typeof ch.length === 'number' && ch.length > 0)) err(cp, '"length" must be a number > 0');
      bool(ch, 'opener', cp);
      if (ch.screens !== undefined && ch.sections !== undefined) err(cp, 'use "screens" or "sections", not both');
      if (ch.screens !== undefined) {
        objList(ch, 'screens', cp, screen);
        screens += Array.isArray(ch.screens) ? ch.screens.length : 0;
      }
      if (ch.sections !== undefined) {
        objList(ch, 'sections', cp, (sec, sp) => {
          if (sec.id !== undefined) uniqueId(sec, sp);
          str(sec, 'title', sp);
          only(sec, sp);
          objList(sec, 'screens', sp, screen);
          screens += Array.isArray(sec.screens) ? sec.screens.length : 0;
        });
      }
    });
  });
  if (errors.length === 0 && screens === 0) err('', 'the book has no screens: write at least one chapter');

  return { book: errors.length === 0 ? (raw as unknown as Book) : null, errors };
}
