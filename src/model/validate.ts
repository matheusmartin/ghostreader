// Checks a book file against the format in types.ts. Returns every problem found, with its path,
// so an author can fix a whole file in one pass. `npm run validate` runs it on every bundled book.

import { THEMES, type Book } from './types.ts';

export interface ValidationResult {
  book: Book | null;
  errors: string[];
}

const BOOK_TYPES = ['fiction', 'reading', 'done'];
const SCREEN_TYPES = ['summary', 'points', 'steps', 'list', 'quiz', 'highlights', 'text', 'chart', 'figure'];
const CHART_KINDS = ['bars', 'compare', 'flow'];
const ID = /^[a-z0-9][a-z0-9-]*$/i;

type Obj = Record<string, unknown>;

export function validateBook(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const err = (path: string, msg: string) => errors.push(path ? `${path}: ${msg}` : msg);

  const at = (path: string, key: string) => (path ? `${path}.${key}` : key);
  const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
  const str = (o: Obj, key: string, path: string, required = true) => {
    const v = o[key];
    if (v === undefined) {
      if (required) err(path, `missing "${key}"`);
    } else if (typeof v !== 'string' || v.trim() === '') err(path, `"${key}" must be a non-empty string`);
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
  const strList = (o: Obj, key: string, path: string, min = 1) => {
    const list = arr(o, key, path, min);
    list?.forEach((v, i) => {
      if (typeof v !== 'string' || v.trim() === '') err(`${at(path, key)}[${i}]`, 'must be a non-empty string');
    });
  };
  const objList = (o: Obj, key: string, path: string, each: (item: Obj, p: string) => void, min = 1) => {
    const list = arr(o, key, path, min);
    list?.forEach((v, i) => {
      const p = `${at(path, key)}[${i}]`;
      if (isObj(v)) each(v, p);
      else err(p, 'must be an object');
    });
  };
  const theme = (o: Obj, path: string) => {
    if (o.theme !== undefined && !THEMES.includes(o.theme as never)) err(path, `"theme" must be one of ${THEMES.join(', ')}`);
  };

  const screen = (s: Obj, p: string) => {
    if (!SCREEN_TYPES.includes(s.type as string)) {
      err(p, `"type" must be one of ${SCREEN_TYPES.join(', ')}`);
      return;
    }
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
      case 'highlights':
        str(s, 'label', p);
        objList(s, 'items', p, (h, hp) => {
          str(h, 'text', hp);
          str(h, 'loc', hp, false);
          str(h, 'note', hp, false);
        });
        if (s.more !== undefined && !(Number.isInteger(s.more) && (s.more as number) > 0)) err(p, '"more" must be a positive whole number');
        break;
      case 'text':
        str(s, 'label', p, false);
        strList(s, 'paragraphs', p);
        break;
      case 'figure':
        str(s, 'label', p, false);
        str(s, 'alt', p);
        str(s, 'caption', p, false);
        if (typeof s.svg !== 'string' || !/^\s*<svg[\s>]/.test(s.svg)) err(p, '"svg" must be a string that starts with <svg');
        break;
      case 'chart':
        str(s, 'label', p, false);
        str(s, 'caption', p, false);
        if (!CHART_KINDS.includes(s.chart as string)) {
          err(p, `"chart" must be one of ${CHART_KINDS.join(', ')}`);
          break;
        }
        if (s.chart === 'bars') {
          objList(s, 'data', p, (d, dp) => {
            str(d, 'label', dp);
            if (typeof d.value !== 'number' || !Number.isFinite(d.value) || d.value < 0) err(dp, '"value" must be a number ≥ 0');
          });
        } else if (s.chart === 'compare') {
          const cols = s.columns;
          if (!Array.isArray(cols) || cols.length !== 2 || cols.some((c) => typeof c !== 'string')) err(p, '"columns" must be two strings');
          const rows = arr(s, 'rows', p);
          rows?.forEach((r, i) => {
            if (!Array.isArray(r) || r.length !== 2 || r.some((c) => typeof c !== 'string')) err(`${p}.rows[${i}]`, 'must be two strings');
          });
          str(s, 'key', p, false);
          if (s.negative !== undefined && s.negative !== 0 && s.negative !== 1) err(p, '"negative" must be 0 or 1');
        } else {
          str(s, 'start', p, false);
          str(s, 'key', p, false);
          objList(s, 'groups', p, (g, gp) => {
            str(g, 'label', gp, false);
            theme(g, gp);
            strList(g, 'items', gp);
          });
        }
        break;
    }
  };

  if (!isObj(raw)) return { book: null, errors: ['the book must be a JSON object'] };

  if (raw.format !== 1) err('', '"format" must be 1');
  str(raw, 'id', '');
  if (typeof raw.id === 'string' && !ID.test(raw.id)) err('', '"id" may use only letters, digits and hyphens');
  if (!BOOK_TYPES.includes(raw.type as string)) err('', `"type" must be one of ${BOOK_TYPES.join(', ')}`);
  str(raw, 'title', '');
  str(raw, 'author', '');
  str(raw, 'lead', '');
  for (const k of ['subtitle', 'edition', 'upTo']) str(raw, k, '', false);
  if (raw.year !== undefined && !Number.isInteger(raw.year)) err('', '"year" must be a whole number');

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
      if (ch.opener !== undefined && typeof ch.opener !== 'boolean') err(cp, '"opener" must be true or false');
      if (ch.screens !== undefined && ch.sections !== undefined) err(cp, 'use "screens" or "sections", not both');
      if (ch.screens !== undefined) {
        objList(ch, 'screens', cp, screen);
        screens += Array.isArray(ch.screens) ? ch.screens.length : 0;
      }
      if (ch.sections !== undefined) {
        objList(ch, 'sections', cp, (sec, sp) => {
          if (sec.id !== undefined) uniqueId(sec, sp);
          str(sec, 'title', sp);
          objList(sec, 'screens', sp, screen);
          screens += Array.isArray(sec.screens) ? sec.screens.length : 0;
        });
      }
    });
  });
  if (errors.length === 0 && screens === 0) err('', 'the book has no screens: write at least one chapter');

  return { book: errors.length === 0 ? (raw as unknown as Book) : null, errors };
}
