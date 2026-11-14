// Turns a book into a reading plan: one flat list of screens, each one knowing its part,
// chapter and section. The reader moves through this list; the indicator reads its labels.
//
//   swipe up / down     → next / previous screen (flows across chapters)
//   swipe left / right  → start of the next / previous chapter
//
// The plan adds three kinds of screens the author does not write: the cover (first), a chapter
// opener (first screen of each chapter, unless `opener: false`) and the end (last).

import type { Book, Chapter, Screen, Theme } from './types.ts';

export type AutoScreen = { type: 'cover' } | { type: 'opener' } | { type: 'end' };
export type AnyScreen = Screen | AutoScreen;

export interface PlanPart {
  id: string;
  label?: string;
  title?: string;
  /** "Part I · Human Networks": the label and title together, or the book title. */
  kicker: string;
  theme: Theme;
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

const PART_THEMES: Theme[] = ['p1', 'p2', 'p3', 'p4', 'p5'];

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

  const pseudoPart = (id: string): PlanPart => ({ id, kicker: book.title, theme: 'front', chapters: [] });
  const pseudoChapter = (kind: 'cover' | 'end', part: PlanPart): PlanChapter => {
    const ch: PlanChapter = { id: `_${kind}`, kind, number: '', title: book.title, part, first: -1, count: 0, sections: [], order: chapters.length };
    part.chapters.push(ch);
    chapters.push(ch);
    return ch;
  };

  add(pseudoChapter('cover', pseudoPart('_cover')), { type: 'cover' }, null);

  let partThemeIndex = 0;
  const parts = book.parts.map((part): PlanPart => {
    const theme = part.theme ?? PART_THEMES[partThemeIndex++ % PART_THEMES.length];
    const kicker = [part.label, part.title].filter(Boolean).join(' · ') || book.title;
    const planPart: PlanPart = { id: part.id, label: part.label, title: part.title, kicker, theme, chapters: [] };
    for (const ch of part.chapters) planPart.chapters.push(planChapter(ch, planPart));
    return planPart;
  });

  function planChapter(ch: Chapter, part: PlanPart): PlanChapter {
    const pc: PlanChapter = {
      id: ch.id, kind: 'chapter', number: ch.number, title: ch.title, length: ch.length,
      part, first: -1, count: 0, sections: [], order: -1,
    };
    const hasContent = (ch.screens?.length ?? 0) > 0 || (ch.sections ?? []).some((s) => s.screens.length > 0);
    if (!hasContent) return pc;

    pc.order = chapters.length;
    chapters.push(pc);
    if (ch.opener !== false) add(pc, { type: 'opener' }, null);
    for (const s of ch.screens ?? []) add(pc, s, null);
    (ch.sections ?? []).forEach((sec, i) => {
      const ps: PlanSection = { id: sec.id ?? `${ch.id}-s${i + 1}`, title: sec.title, first: -1, count: 0 };
      pc.sections.push(ps);
      for (const s of sec.screens) add(pc, s, ps);
    });
    return pc;
  }

  add(pseudoChapter('end', pseudoPart('_end')), { type: 'end' }, null);

  return { book, parts, chapters, screens };
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
