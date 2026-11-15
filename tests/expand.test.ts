// The plan's handling of the PDF-only marks and of blocks that become several screens.

import { describe, expect, it } from 'vitest';
import { buildPlan, chapterBlocks, sceneRuns, threadRanges, THREAD_COLUMNS } from '../src/model/plan.ts';
import type { Book, ScenesScreen, ThreadsChart } from '../src/model/types.ts';

const scene = (words: number, key = false) => ({ text: `{Then} ${'word '.repeat(words - 3)}at [home].`, with: ['A'], key });

const scenes: ScenesScreen = {
  type: 'scenes',
  people: [{ name: 'A' }],
  scenes: [scene(30), scene(30), scene(30, true), scene(30), scene(30)],
};

const book: Book = {
  format: 1, id: 'b', type: 'fiction', title: 'B', author: 'C',
  parts: [{ id: 'p', chapters: [
    { id: 'c1', number: '01', title: 'One', screens: [
      { type: 'summary', label: 'In short', text: 'x' },
      { type: 'text', label: 'Detailed synopsis', paragraphs: ['long'], only: 'pdf' },
      scenes,
    ] },
    { id: 'c2', number: '02', title: 'Two', sections: [
      { title: 'For the PDF', only: 'pdf', screens: [{ type: 'text', paragraphs: ['y'] }] },
    ] },
  ] }],
};

describe('only: app or pdf', () => {
  it('leaves PDF-only screens and sections out of the app', () => {
    const plan = buildPlan(book);
    const c1 = plan.chapters.find((c) => c.id === 'c1')!;
    const types = plan.screens.slice(c1.first, c1.first + c1.count).map((s) => s.content.type);
    expect(types).toEqual(['opener', 'summary', 'scenes', 'scene-list', 'scene-list']);
    // A chapter with PDF content only is "not in this guide yet" in the app.
    expect(plan.parts[0].chapters.find((c) => c.id === 'c2')!.count).toBe(0);
  });

  it('gives the PDF every block that is not app-only', () => {
    const ch = book.parts[0].chapters[0];
    expect(chapterBlocks(ch, 'pdf')[0].screens.map((s) => s.type)).toEqual(['summary', 'text', 'scenes']);
    expect(chapterBlocks(book.parts[0].chapters[1], 'pdf')[0].section?.title).toBe('For the PDF');
  });
});

describe('scene lists', () => {
  it('splits scenes into balanced runs of at most four', () => {
    expect(sceneRuns(scenes.scenes)).toEqual([[0, 2], [2, 5]]);
    expect(sceneRuns([scene(10), scene(10)])).toEqual([[0, 2]]);
    const many = Array.from({ length: 8 }, () => scene(8));
    expect(sceneRuns(many).every(([a, b]) => b - a <= 4)).toBe(true);
    expect(sceneRuns(many).flatMap(([a, b]) => Array.from({ length: b - a }, (_, i) => a + i))).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('thread charts', () => {
  it('splits a long tracker into charts a phone can show', () => {
    const columns = Array.from({ length: 40 }, (_, i) => String(i + 1));
    const c: ThreadsChart = { type: 'chart', chart: 'threads', columns, threads: [{ name: 'T', appears: ['1', '25', '40'], major: ['25'] }] };
    const parts = threadRanges(c);
    expect(parts).toHaveLength(3);
    expect(parts.every((p) => p.columns.length <= THREAD_COLUMNS)).toBe(true);
    expect(parts[1].threads[0]).toMatchObject({ appears: ['25'], major: ['25'] });
    expect(parts[0].label).toBe('Story threads · 1–14');
  });
});
