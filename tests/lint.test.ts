import { describe, expect, it } from 'vitest';
import { lintBook } from '../src/model/lint.ts';
import type { Book, Screen } from '../src/model/types.ts';

const bookWith = (screens: Screen[], extra: Partial<Book> = {}): Book => ({
  format: 1, id: 'b', type: 'reading', title: 'B', author: 'C', lead: 'A short lead.',
  parts: [{ id: 'p', chapters: [{ id: 'c', number: '01', title: 'One', screens }] }],
  ...extra,
});

describe('lintBook', () => {
  it('passes clean content', () => {
    expect(lintBook(bookWith([{ type: 'summary', label: 'In short', text: 'Mr Darcy is proud.', takeaway: { label: 'Why it matters', text: 'It colours her view.' } }]))).toEqual([]);
  });

  it('reports title case, full stops, points after Mr, and American spelling', () => {
    const problems = lintBook(bookWith([{ type: 'summary', label: 'Key Concepts.', text: 'Mr. Darcy will realize his favorite color.' }]));
    expect(problems).toEqual([
      'parts[0].chapters[0].screens[0]: "label" ends with a full stop: labels have none',
      'parts[0].chapters[0].screens[0]: "label" is in title case: use sentence case ("Key concepts.")',
      'parts[0].chapters[0].screens[0].text: write "Mr" without a full stop',
      'parts[0].chapters[0].screens[0].text: British spelling: "favorite" → favourite',
      'parts[0].chapters[0].screens[0].text: British spelling: "color" → colour',
      'parts[0].chapters[0].screens[0].text: British spelling: "realize" → -ise ("realise")',
    ]);
  });

  it('is strict on phone screens and looser on PDF-only blocks', () => {
    const long = Array.from({ length: 200 }, () => 'word').join(' ');
    expect(lintBook(bookWith([{ type: 'text', paragraphs: [long] }]))).toEqual([
      'parts[0].chapters[0].screens[0]: 200 words; at most 120 on a screen (mark a longer text only: "pdf")',
    ]);
    expect(lintBook(bookWith([{ type: 'text', paragraphs: [long], only: 'pdf' }]))).toEqual([]);
    const items = Array.from({ length: 6 }, (_, i) => ({ title: `Idea ${i}`, text: 'Short text.' }));
    expect(lintBook(bookWith([{ type: 'points', label: 'Key concepts', items }]))[0]).toContain('6 items; at most 4');
    expect(lintBook(bookWith([{ type: 'points', label: 'Key concepts', items, only: 'pdf' }]))).toEqual([]);
  });

  it('checks quotations, spoilers and scene marks', () => {
    const problems = lintBook(bookWith([
      { type: 'text', paragraphs: ['She says "it is a truth universally acknowledged that" all is well.'] },
      { type: 'text', paragraphs: ['{Later that night} she leaves. Eventually they marry.'] },
      { type: 'scenes', people: [{ name: 'A' }], scenes: [{ text: 'A walks home.', with: ['A'] }, { text: '{Then} A sits at [home].', with: ['A'], key: true }] },
    ], { upTo: 'Chapter 3' }));
    expect(problems).toEqual([
      'parts[0].chapters[0].screens[0].paragraphs[0]: possible quotation ("it is a truth universally ackn…"): paraphrase the book instead',
      'parts[0].chapters[0].screens[1].paragraphs[0]: "Eventually" looks past the limit (upTo Chapter 3): leave it out',
      'parts[0].chapters[0].screens[2].scenes[0]: scene text needs the {when} and [where] the book gives: one of each, at least one (has 0 and 0)',
    ]);
  });

  it('wants linked ring nodes next to each other', () => {
    const problems = lintBook(bookWith([{
      type: 'chart', chart: 'network', centre: ['X'],
      nodes: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }],
      links: [{ from: 'A', to: 'B', label: 'Friends' }, { from: 'D', to: 'A' }, { from: 'A', to: 'C' }],
    }]));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"A" and "C" are not next to each other');
  });
});
