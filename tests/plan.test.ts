import { describe, expect, it } from 'vitest';
import { buildPlan, contentChapters, locate, nextChapter, nextScreen, prevChapter, prevScreen } from '../src/model/plan.ts';
import type { Book } from '../src/model/types.ts';

const book: Book = {
  format: 1,
  id: 'test',
  type: 'reading',
  title: 'Test',
  author: 'A. Author',
 
  parts: [
    {
      id: 'p1',
      label: 'Part I',
      title: 'Start',
      chapters: [
        { id: 'c1', number: '01', title: 'One', screens: [{ type: 'text', paragraphs: ['a'] }, { type: 'text', paragraphs: ['b'] }] },
        { id: 'c2', number: '02', title: 'Two (not written)' },
      ],
    },
    {
      id: 'p2',
      title: 'Middle',
      chapters: [
        {
          id: 'c3',
          number: '03',
          title: 'Three',
          sections: [
            { title: 'Idea', screens: [{ type: 'text', paragraphs: ['c'] }] },
            { title: 'Test', screens: [{ type: 'text', paragraphs: ['d'] }, { type: 'text', paragraphs: ['e'] }] },
          ],
        },
        { id: 'c4', number: '04', title: 'Four', opener: false, screens: [{ type: 'text', paragraphs: ['f'] }] },
      ],
    },
  ],
};

const plan = buildPlan(book);
const keys = plan.screens.map((s) => s.key);

describe('buildPlan', () => {
  it('adds the cover, chapter openers and the end around the author screens', () => {
    expect(keys).toEqual(['_cover/0', 'c1/0', 'c1/1', 'c1/2', 'c3/0', 'c3/1', 'c3/2', 'c3/3', 'c4/0', '_end/0']);
    expect(plan.screens.map((s) => s.content.type)).toEqual(['cover', 'opener', 'text', 'text', 'opener', 'text', 'text', 'text', 'text', 'end']);
  });

  it('lists chapters without screens in their part but does not navigate to them', () => {
    const c2 = plan.parts[0].chapters[1];
    expect(c2.count).toBe(0);
    expect(c2.order).toBe(-1);
    expect(plan.chapters.map((c) => c.id)).toEqual(['_cover', 'c1', 'c3', 'c4', '_end']);
    expect(contentChapters(plan).map((c) => c.id)).toEqual(['c1', 'c3', 'c4']);
  });

  it('builds the part kicker', () => {
    expect(plan.parts.map((p) => p.kicker)).toEqual(['Part I · Start', 'Middle']);
  });

  it('records sections with their first screen and count; the opener has no section', () => {
    const c3 = plan.chapters[2];
    expect(c3.sections.map((s) => [s.title, s.first, s.count])).toEqual([['Idea', 5, 1], ['Test', 6, 2]]);
    expect(plan.screens[4].section).toBeNull();
    expect(plan.screens[7].section?.title).toBe('Test');
    expect(plan.screens[7].inChapter).toBe(3);
  });
});

describe('navigation', () => {
  it('moves screen by screen across chapter borders', () => {
    expect(nextScreen(plan, 3)).toBe(4);
    expect(prevScreen(plan, 4)).toBe(3);
    expect(prevScreen(plan, 0)).toBeNull();
    expect(nextScreen(plan, plan.screens.length - 1)).toBeNull();
  });

  it('jumps to the start of the next and previous chapter, skipping unwritten ones', () => {
    expect(nextChapter(plan, 2)).toBe(4); // c1 → c3 (c2 is not written)
    expect(prevChapter(plan, 6)).toBe(1); // middle of c3 → start of c1
    expect(prevChapter(plan, 1)).toBe(0); // c1 → cover
    expect(nextChapter(plan, 8)).toBe(9); // c4 → end
    expect(nextChapter(plan, 9)).toBeNull();
    expect(prevChapter(plan, 0)).toBeNull();
  });

  it('locates a chapter screen and clamps n', () => {
    expect(locate(plan, 'c3', 2)).toBe(6);
    expect(locate(plan, 'c3', 99)).toBe(7);
    expect(locate(plan, 'c2', 0)).toBeNull();
    expect(locate(plan, 'nope', 0)).toBeNull();
  });
});
