// Turns a book into a reading plan: one flat list of screens, each one knowing its part,
// chapter and section. The reader moves through this list; the indicator reads its labels.
//
//   swipe up / down     → next / previous screen (flows across chapters)
//   swipe left / right  → start of the next / previous chapter
//
// The plan adds screens the author does not write: the cover (first), a chapter opener (first
// screen of each chapter, unless `opener: false`) and the end (last). Some blocks become more
// than one screen, so that each screen holds one piece of information:
//   scenes          → the "who is where" chart, then the scenes as a numbered list (2–4 per screen)
//   threads chart   → one chart per 18 chapters, then the thread list when threads have a text
// Screens and sections marked `only: "pdf"` are left out.

import type { Book, Chapter, ListScreen, Screen, ScenesScreen, Section, ThreadsChart } from './types.ts';

/** A part of a scenes block, shown as a numbered list: scenes[from] to scenes[to - 1]. */
export interface SceneListScreen { type: 'scene-list'; source: ScenesScreen; from: number; to: number }
export type AutoScreen = { type: 'cover' } | { type: 'opener' } | { type: 'end' } | SceneListScreen;
export type AnyScreen = Screen | AutoScreen;

export type Target = 'app' | 'pdf';
const shows = (only: Target | undefined, target: Target) => only === undefined || only === target;

/** The authored screens of a chapter for one target, by section (`null`: the chapter has no sections). */
export function chapterBlocks(ch: Chapter, target: Target): { section: Section | null; screens: Screen[] }[] {
  if (ch.screens) return [{ section: null, screens: ch.screens.filter((s) => shows(s.only, target)) }];
  return (ch.sections ?? [])
    .filter((sec) => shows(sec.only, target))
    .map((sec) => ({ section: sec, screens: sec.screens.filter((s) => shows(s.only, target)) }))
    .filter((b) => b.screens.length > 0);
}

export const hasBlocks = (ch: Chapter, target: Target) => chapterBlocks(ch, target).some((b) => b.screens.length > 0);

/** Most words of scene text on one list screen, and most scenes. */
const SCENE_WORDS = 90;
const SCENES_PER_SCREEN = 4;
/** Most chapter columns in one thread chart on a phone. */
export const THREAD_COLUMNS = 18;

const words = (s: string) => s.replace(/[{}[\]*]/g, '').split(/\s+/).filter(Boolean).length;

/** Splits n items into balanced runs so no run exceeds the limits. Returns [from, to) pairs. */
export function sceneRuns(scenes: { text: string }[]): [number, number][] {
  const total = scenes.reduce((sum, s) => sum + words(s.text), 0);
  const parts = Math.max(Math.ceil(total / SCENE_WORDS), Math.ceil(scenes.length / SCENES_PER_SCREEN), 1);
  const target = total / parts;
  const runs: [number, number][] = [];
  let from = 0;
  let acc = 0;
  scenes.forEach((s, i) => {
    const w = words(s.text);
    const left = scenes.length - i;
    const runsLeft = parts - runs.length;
    const full = i - from >= SCENES_PER_SCREEN;
    const long = acc + w > target * 1.15 && runsLeft > 1 && left >= runsLeft - 1;
    if (i > from && (full || long)) {
      runs.push([from, i]);
      from = i;
      acc = 0;
    }
    acc += w;
  });
  runs.push([from, scenes.length]);
  return runs;
}

/** A thread chart with more columns than a phone can show becomes several charts. */
export function threadRanges(c: ThreadsChart): ThreadsChart[] {
  const n = c.columns.length;
  if (n <= THREAD_COLUMNS) return [c];
  const parts = Math.ceil(n / THREAD_COLUMNS);
  const size = Math.ceil(n / parts);
  const out: ThreadsChart[] = [];
  for (let a = 0; a < n; a += size) {
    const cols = c.columns.slice(a, a + size);
    const inRange = (x: string) => cols.includes(x);
    out.push({
      ...c,
      label: `${c.label ?? 'Story threads'} · ${cols[0]}–${cols[cols.length - 1]}`,
      columns: cols,
      threads: c.threads.map((t) => ({ ...t, appears: t.appears.filter(inRange), major: t.major?.filter(inRange) })),
    });
  }
  return out;
}

/** The thread list that follows a thread chart, when the threads have a text. */
export function threadList(c: ThreadsChart): ListScreen | null {
  const rows = c.threads.filter((t) => t.text).map((t) => ({ name: t.name, text: t.text! }));
  return rows.length > 0 ? { type: 'list', label: c.label ?? 'Story threads', rows } : null;
}

export interface PlanPart {
  id: string;
  label?: string;
  title?: string;
  /** "Part I · Human Networks": the label and title together, or the book title. */
  kicker: string;
  /** Every chapter of the part, also the ones not written yet. */
  chapters: PlanChapter[];
}

export interface PlanChapter {
  id: string;
  kind: 'cover' | 'chapter' | 'end';
  number: string;
  title: string;
  length?: number;
  part: PlanPart;
  /** Index of the first screen in `plan.screens`; -1 when the chapter has no screens yet. */
  first: number;
  count: number;
  sections: PlanSection[];
  /** Position in `plan.chapters` (navigable chapters only); -1 when not written yet. */
  order: number;
}

export interface PlanSection {
  id: string;
  title: string;
  first: number;
  count: number;
}

export interface PlanScreen {
  index: number;
  /** Stable address for links and saved positions: "<chapter id>/<n>". */
  key: string;
  content: AnyScreen;
  chapter: PlanChapter;
  section: PlanSection | null;
  /** 0-based position inside the chapter. */
  inChapter: number;
}

export interface Plan {
  book: Book;
  /** The book's own parts (without the cover and end). */
  parts: PlanPart[];
  /** Chapters you can land on, in reading order: cover, written chapters, end. */
  chapters: PlanChapter[];
  screens: PlanScreen[];
}

export function buildPlan(book: Book): Plan {
  const screens: PlanScreen[] = [];
  const chapters: PlanChapter[] = [];

  const add = (chapter: PlanChapter, content: AnyScreen, section: PlanSection | null) => {
    const inChapter = chapter.count++;
    if (chapter.first < 0) chapter.first = screens.length;
    if (section) {
      if (section.first < 0) section.first = screens.length;
      section.count++;
    }
    screens.push({ index: screens.length, key: `${chapter.id}/${inChapter}`, content, chapter, section, inChapter });
  };

  const pseudoPart = (id: string): PlanPart => ({ id, kicker: book.title, chapters: [] });
  const pseudoChapter = (kind: 'cover' | 'end', part: PlanPart): PlanChapter => {
    const ch: PlanChapter = { id: `_${kind}`, kind, number: '', title: book.title, part, first: -1, count: 0, sections: [], order: chapters.length };
    part.chapters.push(ch);
    chapters.push(ch);
    return ch;
  };

  add(pseudoChapter('cover', pseudoPart('_cover')), { type: 'cover' }, null);

  const parts = book.parts.map((part): PlanPart => {
    const kicker = [part.label, part.title].filter(Boolean).join(' · ') || book.title;
    const planPart: PlanPart = { id: part.id, label: part.label, title: part.title, kicker, chapters: [] };
    for (const ch of part.chapters) planPart.chapters.push(planChapter(ch, planPart));
    return planPart;
  });

  function planChapter(ch: Chapter, part: PlanPart): PlanChapter {
    const pc: PlanChapter = {
      id: ch.id, kind: 'chapter', number: ch.number, title: ch.title, length: ch.length,
      part, first: -1, count: 0, sections: [], order: -1,
    };
    const blocks = chapterBlocks(ch, 'app');
    if (!blocks.some((b) => b.screens.length > 0)) return pc;

    pc.order = chapters.length;
    chapters.push(pc);
    if (ch.opener !== false) add(pc, { type: 'opener' }, null);
    for (const { section, screens } of blocks) {
      let ps: PlanSection | null = null;
      if (section) {
        const i = (ch.sections ?? []).indexOf(section);
        ps = { id: section.id ?? `${ch.id}-s${i + 1}`, title: section.title, first: -1, count: 0 };
        pc.sections.push(ps);
      }
      for (const s of screens) for (const view of expand(s)) add(pc, view, ps);
    }
    return pc;
  }

  add(pseudoChapter('end', pseudoPart('_end')), { type: 'end' }, null);

  return { book, parts, chapters, screens };
}

/** The screens one authored block becomes in the app. */
function expand(s: Screen): AnyScreen[] {
  if (s.type === 'scenes') {
    return [s, ...sceneRuns(s.scenes).map(([from, to]): SceneListScreen => ({ type: 'scene-list', source: s, from, to }))];
  }
  if (s.type === 'chart' && s.chart === 'threads') {
    const list = threadList(s);
    return [...threadRanges(s), ...(list ? [list] : [])];
  }
  return [s];
}

// ---- navigation ----------------------------------------------------------------------------

export function nextScreen(plan: Plan, i: number): number | null {
  return i + 1 < plan.screens.length ? i + 1 : null;
}

export function prevScreen(_plan: Plan, i: number): number | null {
  return i > 0 ? i - 1 : null;
}

/** First screen of the next chapter (the end screen after the last chapter). */
export function nextChapter(plan: Plan, i: number): number | null {
  const ch = plan.chapters[plan.screens[i].chapter.order + 1];
  return ch ? ch.first : null;
}

/** First screen of the previous chapter (the cover before the first chapter). */
export function prevChapter(plan: Plan, i: number): number | null {
  const ch = plan.chapters[plan.screens[i].chapter.order - 1];
  return ch ? ch.first : null;
}

/** Index of screen `n` of a chapter, clamped to the chapter; null if the chapter is unknown or empty. */
export function locate(plan: Plan, chapterId: string, n = 0): number | null {
  const ch = plan.chapters.find((c) => c.id === chapterId);
  if (!ch || ch.count === 0) return null;
  return ch.first + Math.min(Math.max(0, Math.floor(n)), ch.count - 1);
}

/** Chapters with content, without the cover and end: what the progress strip and contents show. */
export function contentChapters(plan: Plan): PlanChapter[] {
  return plan.chapters.filter((c) => c.kind === 'chapter');
}
