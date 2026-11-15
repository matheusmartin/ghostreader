// Content checks for a valid book (run validate.ts first). Each problem is "<path>: <message>".
// They enforce the writing rules of the ghostreader-book skill that a program can check:
//
//   limits      words per field and items per block, strict for phone screens (one screen must
//               fit without scrolling) and looser for blocks marked only: "pdf"
//   style       sentence-case labels without a full stop; Mr, Mrs, Dr, St without points;
//               British spelling (-ise, colour, centre…); no quotations from the book
//   spoilers    with "upTo": no words that look past the limit ("eventually", "in the end")
//   charts      scene text with the {when} and [where] the book gives; ring links between neighbours
//   structure   only the book's own chapters: no guide-made overview chapter (S, B, K, W, T, M)
//   resume      in a guide file, every written chapter ends with "Where it stands" (four fixed
//               parts) and, optionally, "Still open": the screens a reader returns to
//   causes      events are linked by cause ("because", "so"), not by time alone ("and then")
//
// `npm run validate` fails on any problem in a bundled book.

import type { Book, BookType, NetworkChart, Screen, ScenesScreen } from './types.ts';

type Target = 'app' | 'pdf';

/** Numbers of the overview chapters earlier skill versions added (Where you stopped, The book in
 * one page, Key concepts, Who's who, Story threads, map). A guide has only the book's chapters. */
const GUIDE_MADE = new Set(['S', 'B', 'K', 'W', 'T', 'M']);

/** [app, pdf] limits. */
type Lim = readonly [number, number];
const L = {
  label: 5,
  caption: 16,
  summary: [50, 80], takeaway: [22, 30],
  pointsItems: [4, 10], pointTitle: [6, 8], pointText: [30, 45],
  steps: [6, 10], step: [18, 28],
  rows: [8, 30], rowName: [6, 8], rowText: [18, 30],
  questions: [3, 6], question: [24, 30], answer: [30, 40],
  textTotal: [120, 450],
  bars: [8, 16], barLabel: [5, 6],
  cmpRows: [5, 8], cmpCell: [10, 14], cmpKey: [12, 14],
  flowGroups: [3, 3], flowItems: [4, 6], flowItem: [7, 9], flowStart: [12, 14], flowKey: [10, 12], flowGroupLabel: [6, 6],
  tlItems: [6, 12], tlWhen: [4, 4], tlTitle: [6, 8], tlText: [22, 35],
  netNodes: [10, 16], netLinks: [10, 18], netName: [4, 4], netNote: [3, 3], netLabel: [4, 4],
  people: [8, 12], scenes: [8, 12], sceneText: [35, 35], person: [3, 3],
  threads: [8, 10], threadName: [3, 3], threadText: [15, 15],
  cycleTitle: [4, 4], cycleText: [6, 8], cycleCentre: [6, 6],
  mxCols: [4, 6], mxRows: [6, 10], mxCol: [2, 2], mxLabel: [4, 5], mxKey: [12, 14],
  brStart: [6, 8], brTitle: [5, 6], brText: [8, 12],
  layerTitle: [3, 3], layerText: [5, 6],
} as const;

const NAME_CHARS = 22;

/** The resume screens at the end of every written chapter of a guide (skill: references/styles.md).
 * "Where it stands" has these four parts, in this order. */
export const WHERE_IT_STANDS = 'Where it stands';
export const STILL_OPEN = 'Still open';
export const STANDS_TITLES: Record<BookType, readonly string[]> = {
  fiction: ['When and where', 'Who is there', 'What they want', 'What just happened'],
  reading: ['The question', 'Established so far', 'This chapter adds', 'Where it stops'],
  done: ['The question', 'Established so far', 'This chapter adds', 'Where it stops'],
};
const STILL_OPEN_ROWS = 3;
/** "and then", or a sentence or item that starts with "Then": order without a cause. */
const THEN = /\band then\b|(?:^|[.!?;:]\s+)then\b/i;

// British spelling: whole words.
const SPELLING: Record<string, string> = {
  color: 'colour', colors: 'colours', colored: 'coloured', colorful: 'colourful',
  favor: 'favour', favors: 'favours', favorite: 'favourite', favorites: 'favourites', favored: 'favoured',
  honor: 'honour', honors: 'honours', honored: 'honoured', honorable: 'honourable',
  behavior: 'behaviour', behaviors: 'behaviours', neighbor: 'neighbour', neighbors: 'neighbours', neighborhood: 'neighbourhood',
  labor: 'labour', harbor: 'harbour', humor: 'humour', rumor: 'rumour', rumors: 'rumours', vigor: 'vigour', valor: 'valour',
  center: 'centre', centers: 'centres', centered: 'centred', theater: 'theatre', theaters: 'theatres', meter: 'metre', meters: 'metres',
  defense: 'defence', offense: 'offence', gray: 'grey', traveled: 'travelled', traveling: 'travelling', traveler: 'traveller',
  canceled: 'cancelled', modeling: 'modelling', jewelry: 'jewellery', catalog: 'catalogue', dialog: 'dialogue',
  aging: 'ageing', fulfill: 'fulfil', enroll: 'enrol', skeptic: 'sceptic', skeptical: 'sceptical', skepticism: 'scepticism',
  mold: 'mould', plow: 'plough', amongst: 'among', whilst: 'while', analyze: 'analyse', analyzed: 'analysed',
  paralyze: 'paralyse', paralyzed: 'paralysed', program: 'programme (but "program" for computer code)', programs: 'programmes',
};
const IZE = /\b([a-z]{2,})iz(e|es|ed|ing|ation|ations|er|ers)\b/gi;
const IZE_OK = new Set(['maize', 'baize', 'capsize', 'capsized', 'belize']);
const SPOILER = /\b(eventually|ultimately|will turn out|turns out later|in the end|will later|later in the book|will prove)\b/i;
/** Keys whose strings are not prose: names, ids and settings. */
const NOT_PROSE = new Set(['type', 'chart', 'only', 'style', 'tag', 'svg', 'from', 'to', 'with', 'off', 'appears', 'major', 'columns']);

const words = (s: string) => s.replace(/[{}[\]*]/g, '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

export function lintBook(book: Book): string[] {
  const out: string[] = [];
  const say = (path: string, msg: string) => out.push(path ? `${path}: ${msg}` : msg);
  const limit = (path: string, field: string, text: string | undefined, max: number) => {
    if (text !== undefined && words(text) > max) say(path, `"${field}" has ${words(text)} words; at most ${max}`);
  };
  const count = (path: string, what: string, n: number, max: number) => {
    if (n > max) say(path, `${n} ${what}; at most ${max} (split it into two screens, or mark the fuller one only: "pdf")`);
  };
  const lab = (path: string, field: string, text: string | undefined) => {
    if (text === undefined) return;
    limit(path, field, text, L.label);
    if (/\.\s*$/.test(text)) say(path, `"${field}" ends with a full stop: labels have none`);
    if (!/^[\p{Lu}\p{N}"'‘“(]/u.test(text)) say(path, `"${field}" must start with a capital letter`);
    const ws = text.split(/\s+/).filter((w) => /\p{L}/u.test(w) && !/^(I|II|III|IV|V|VI|Mr|Mrs|Ms|Dr|St|·)$/.test(w));
    if (ws.length >= 2 && ws.every((w) => /^[\p{Lu}]/u.test(w))) say(path, `"${field}" is in title case: use sentence case ("${sentenceCase(text)}")`);
  };

  book.parts.forEach((part, pi) => part.chapters.forEach((ch, ci) => {
    const cp = `parts[${pi}].chapters[${ci}]`;
    if (GUIDE_MADE.has(ch.number)) {
      say(cp, `number "${ch.number}" marks a guide-made overview chapter ("${ch.title}"): a guide holds only the book's own chapters, so remove it`);
    }
    const visit = (s: Screen, path: string, target: Target) => {
      screen(s, path, s.only ?? target);
      walkStrings(s, path, (p, text) => style(p, text));
    };
    ch.screens?.forEach((s, i) => visit(s, `${cp}.screens[${i}]`, 'app'));
    ch.sections?.forEach((sec, si) => {
      const sp = `${cp}.sections[${si}]`;
      lab(sp, 'title', sec.title);
      sec.screens.forEach((s, i) => visit(s, `${sp}.screens[${i}]`, sec.only === 'pdf' ? 'pdf' : 'app'));
    });
    if (book.guide) resume(ch.screens ?? ch.sections?.flatMap((sec) => sec.screens) ?? [], cp);
  }));
  return out;

  /** A written chapter ends with "Where it stands", then optionally "Still open", in app and PDF. */
  function resume(screens: Screen[], cp: string) {
    if (!screens.some((s) => s.only !== 'pdf')) return;
    const titles = STANDS_TITLES[book.type];
    const n = screens.length;
    const last = screens[n - 1];
    const open = 'label' in last && last.label === STILL_OPEN ? last : undefined;
    const stands = screens[open ? n - 2 : n - 1];
    if (!stands || !('label' in stands) || stands.label !== WHERE_IT_STANDS) {
      say(cp, `the last screens must be "${WHERE_IT_STANDS}" (points: ${titles.map((t) => `"${t}"`).join(', ')}), then optionally "${STILL_OPEN}"`);
    } else if (stands.type !== 'points' || stands.only) {
      say(cp, `"${WHERE_IT_STANDS}" must be a points screen in both the app and the PDF (no "only")`);
    } else {
      const got = stands.items.map((it) => it.title);
      if (got.join('|') !== titles.join('|')) say(cp, `"${WHERE_IT_STANDS}" needs the items ${titles.map((t) => `"${t}"`).join(', ')}, in this order (has ${got.map((t) => `"${t}"`).join(', ')})`);
    }
    if (open) {
      if (open.type !== 'list' || open.only) say(cp, `"${STILL_OPEN}" must be a list screen in both the app and the PDF (no "only")`);
      else if (open.rows.length < 1 || open.rows.length > STILL_OPEN_ROWS) say(cp, `"${STILL_OPEN}" needs 1–${STILL_OPEN_ROWS} rows (has ${open.rows.length})`);
    }
    screens.forEach((s, i) => {
      if (i < n - 2 && 'label' in s && (s.label === WHERE_IT_STANDS || s.label === STILL_OPEN)) say(cp, `"${s.label}" must be at the end of the chapter`);
    });
  }

  function style(path: string, text: string) {
    const abbr = text.match(/\b(Mr|Mrs|Ms|Dr|St)\./);
    if (abbr) say(path, `write "${abbr[1]}" without a full stop`);
    for (const w of text.match(/\b[a-z]+\b/gi) ?? []) {
      const br = SPELLING[w.toLowerCase()];
      if (br) say(path, `British spelling: "${w}" → ${br}`);
    }
    for (const m of text.matchAll(IZE)) {
      if (!IZE_OK.has(m[0].toLowerCase())) say(path, `British spelling: "${m[0]}" → -ise ("${m[0].replace(/iz/i, 'is')}")`);
    }
    for (const m of text.matchAll(/["“]([^"”]+)["”]/g)) {
      if (words(m[1]) >= 6) say(path, `possible quotation ("${m[1].slice(0, 30)}…"): paraphrase the book instead`);
    }
    if (book.upTo) {
      const sp = text.replace(/\{[^{}]*\}/g, '').match(SPOILER);
      if (sp) say(path, `"${sp[0]}" looks past the limit (upTo ${book.upTo}): leave it out`);
    }
    // Time marks ({Then}) and timeline "when" fields may order events; prose must say why.
    if (!/\.when$/.test(path) && THEN.test(text.replace(/\{[^{}]*\}/g, '').trim())) {
      say(path, `"then" orders events without a cause: say why ("because", "so"), or cut it`);
    }
  }

  function screen(s: Screen, p: string, target: Target) {
    const t = target === 'app' ? 0 : 1;
    const max = (l: Lim) => l[t];
    if ('label' in s && typeof s.label === 'string') lab(p, 'label', s.label);
    if ('caption' in s && typeof s.caption === 'string') limit(p, 'caption', s.caption, L.caption);
    switch (s.type) {
      case 'summary':
        limit(p, 'text', s.text, max(L.summary));
        if (s.takeaway) {
          lab(`${p}.takeaway`, 'label', s.takeaway.label);
          limit(`${p}.takeaway`, 'text', s.takeaway.text, max(L.takeaway));
        }
        break;
      case 'points':
        count(p, 'items', s.items.length, max(L.pointsItems));
        s.items.forEach((it, i) => {
          limit(`${p}.items[${i}]`, 'title', it.title, max(L.pointTitle));
          limit(`${p}.items[${i}]`, 'text', it.text, max(L.pointText));
        });
        break;
      case 'steps':
        count(p, 'steps', s.steps.length, max(L.steps));
        s.steps.forEach((st, i) => limit(`${p}.steps[${i}]`, 'step', st, max(L.step)));
        break;
      case 'list':
        count(p, 'rows', s.rows.length, max(L.rows));
        s.rows.forEach((r, i) => {
          limit(`${p}.rows[${i}]`, 'name', r.name, max(L.rowName));
          limit(`${p}.rows[${i}]`, 'text', r.text, max(L.rowText));
        });
        break;
      case 'quiz':
        count(p, 'questions', s.questions.length, max(L.questions));
        s.questions.forEach((q, i) => {
          limit(`${p}.questions[${i}]`, 'q', q.q, max(L.question));
          limit(`${p}.questions[${i}]`, 'a', q.a, max(L.answer));
        });
        break;
      case 'text': {
        const total = s.paragraphs.reduce((n, para) => n + words(para), 0);
        if (total > max(L.textTotal)) say(p, `${total} words; at most ${max(L.textTotal)}${t === 0 ? ' on a screen (mark a longer text only: "pdf")' : ''}`);
        break;
      }
      case 'scenes':
        scenes(s, p, max);
        break;
      case 'figure':
        break;
      case 'chart':
        switch (s.chart) {
          case 'bars':
            count(p, 'bars', s.data.length, max(L.bars));
            s.data.forEach((d, i) => limit(`${p}.data[${i}]`, 'label', d.label, max(L.barLabel)));
            break;
          case 'compare':
            count(p, 'rows', s.rows.length, max(L.cmpRows));
            s.rows.forEach((r, i) => r.forEach((cell, k) => limit(`${p}.rows[${i}]`, `column ${k + 1}`, cell, max(L.cmpCell))));
            limit(p, 'key', s.key, max(L.cmpKey));
            break;
          case 'flow':
            count(p, 'groups', s.groups.length, max(L.flowGroups));
            limit(p, 'start', s.start, max(L.flowStart));
            limit(p, 'key', s.key, max(L.flowKey));
            s.groups.forEach((g, i) => {
              count(`${p}.groups[${i}]`, 'items', g.items.length, max(L.flowItems));
              limit(`${p}.groups[${i}]`, 'label', g.label, max(L.flowGroupLabel));
              g.items.forEach((it, k) => limit(`${p}.groups[${i}].items[${k}]`, 'item', it, max(L.flowItem)));
            });
            break;
          case 'timeline':
            count(p, 'items', s.items.length, max(L.tlItems));
            s.items.forEach((it, i) => {
              limit(`${p}.items[${i}]`, 'when', it.when, max(L.tlWhen));
              limit(`${p}.items[${i}]`, 'title', it.title, max(L.tlTitle));
              limit(`${p}.items[${i}]`, 'text', it.text, max(L.tlText));
            });
            break;
          case 'network':
            network(s, p, max);
            break;
          case 'threads':
            count(p, 'threads', s.threads.length, max(L.threads));
            s.threads.forEach((th, i) => {
              limit(`${p}.threads[${i}]`, 'name', th.name, max(L.threadName));
              limit(`${p}.threads[${i}]`, 'text', th.text, max(L.threadText));
            });
            break;
          case 'cycle':
            limit(p, 'centre', s.centre, max(L.cycleCentre));
            s.nodes.forEach((n, i) => {
              limit(`${p}.nodes[${i}]`, 'title', n.title, max(L.cycleTitle));
              limit(`${p}.nodes[${i}]`, 'text', n.text, max(L.cycleText));
            });
            break;
          case 'matrix':
            count(p, 'columns', s.columns.length, max(L.mxCols));
            count(p, 'rows', s.rows.length, max(L.mxRows));
            s.columns.forEach((c, i) => limit(p, `columns[${i}]`, c, max(L.mxCol)));
            s.rows.forEach((r, i) => limit(`${p}.rows[${i}]`, 'label', r.label, max(L.mxLabel)));
            limit(p, 'key', s.key, max(L.mxKey));
            break;
          case 'branches':
            limit(p, 'start', s.start, max(L.brStart));
            s.options.forEach((o, i) => {
              limit(`${p}.options[${i}]`, 'title', o.title, max(L.brTitle));
              limit(`${p}.options[${i}]`, 'text', o.text, max(L.brText));
            });
            break;
          case 'layers':
            s.rings.forEach((r, i) => {
              limit(`${p}.rings[${i}]`, 'title', r.title, max(L.layerTitle));
              limit(`${p}.rings[${i}]`, 'text', r.text, max(L.layerText));
            });
            break;
        }
        break;
    }
  }

  function scenes(s: ScenesScreen, p: string, max: (l: Lim) => number) {
    count(p, 'people', s.people.length, max(L.people));
    count(p, 'scenes', s.scenes.length, max(L.scenes));
    if (s.scenes.length < 2) say(p, 'a scene chart needs at least two scenes');
    s.people.forEach((x, i) => {
      limit(`${p}.people[${i}]`, 'name', x.name, max(L.person));
      if (x.name.length > NAME_CHARS) say(`${p}.people[${i}]`, `name over ${NAME_CHARS} characters: use the short form the book uses`);
    });
    s.scenes.forEach((sc, i) => {
      const sp = `${p}.scenes[${i}]`;
      limit(sp, 'text', sc.text, max(L.sceneText));
      const when = sc.text.match(/\{[^{}]+\}/g)?.length ?? 0;
      const where = sc.text.match(/\[[^[\]]+\]/g)?.length ?? 0;
      // The time and the place the book gives, one of each; the book may give only one of them.
      if (when > 1 || where > 1 || when + where === 0) say(sp, `scene text needs the {when} and [where] the book gives: one of each, at least one (has ${when} and ${where})`);
    });
  }

  function network(c: NetworkChart, p: string, max: (l: Lim) => number) {
    count(p, 'nodes', c.nodes.length, max(L.netNodes));
    count(p, 'links', c.links.length, max(L.netLinks));
    const named: { name: string; note?: string }[] = [...c.centre.map((name) => ({ name })), ...c.nodes];
    for (const n of named) {
      limit(p, `name "${n.name}"`, n.name, max(L.netName));
      if (n.name.length > NAME_CHARS) say(p, `name "${n.name}" is over ${NAME_CHARS} characters`);
      limit(p, `note of "${n.name}"`, n.note, max(L.netNote));
    }
    const ring = c.nodes.map((n) => n.name);
    c.links.forEach((l, i) => {
      const lp = `${p}.links[${i}]`;
      limit(lp, 'label', l.label, max(L.netLabel));
      if (l.label && l.label.length > NAME_CHARS) say(lp, `label over ${NAME_CHARS} characters`);
      const a = ring.indexOf(l.from);
      const b = ring.indexOf(l.to);
      if (a >= 0 && b >= 0) {
        const d = Math.abs(a - b);
        if (d !== 1 && d !== ring.length - 1) say(lp, `"${l.from}" and "${l.to}" are not next to each other on the ring: reorder "nodes" so linked names are neighbours, or link one of them to the centre`);
      }
    });
  }
}

/** Every prose string in a screen, with its path. */
function walkStrings(v: unknown, path: string, f: (path: string, text: string) => void, key = '') {
  if (NOT_PROSE.has(key)) return;
  if (typeof v === 'string') f(path, v);
  else if (Array.isArray(v)) v.forEach((x, i) => walkStrings(x, `${path}[${i}]`, f, key));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      // Network names are names, not prose; their notes and link labels are prose.
      if (k === 'centre' && Array.isArray(x)) continue;
      if (k === 'name' && path.includes('.nodes[')) continue;
      walkStrings(x, `${path}.${k}`, f, k);
    }
  }
}

const sentenceCase = (s: string) => s.replace(/(\s)(\p{Lu})(\p{Ll})/gu, (_m, sp, a, b) => `${sp}${a.toLowerCase()}${b}`);
