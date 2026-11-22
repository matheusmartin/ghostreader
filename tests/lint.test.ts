import { describe, expect, it } from 'vitest';
import { lintBook } from '../src/model/lint.ts';
import type { Book, Screen } from '../src/model/types.ts';

const bookWith = (screens: Screen[], extra: Partial<Book> = {}): Book => ({
  format: 1, id: 'b', type: 'reading', title: 'B', author: 'C',
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
      'GR-W02 parts[0].chapters[0].screens[0]: "label" ends with a full stop: labels have none',
      'GR-W01 parts[0].chapters[0].screens[0]: "label" is in title case: use sentence case ("Key concepts.")',
      'GR-W04 parts[0].chapters[0].screens[0].text: write "Mr" without a full stop',
      'GR-W05 parts[0].chapters[0].screens[0].text: British spelling: "favorite" → favourite',
      'GR-W05 parts[0].chapters[0].screens[0].text: British spelling: "color" → colour',
      'GR-W05 parts[0].chapters[0].screens[0].text: British spelling: "realize" → -ise ("realise")',
    ]);
  });

  it('is strict on phone screens and looser on PDF-only blocks', () => {
    const long = Array.from({ length: 200 }, () => 'word').join(' ');
    expect(lintBook(bookWith([{ type: 'text', paragraphs: [long] }]))).toEqual([
      'GR-L01 parts[0].chapters[0].screens[0]: 200 words; at most 120 on a screen (mark a longer text only: "pdf")',
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
      'GR-C04 parts[0].chapters[0].screens[0].paragraphs[0]: possible quotation ("it is a truth universally ackn…"): paraphrase the book instead',
      'GR-C03 parts[0].chapters[0].screens[1].paragraphs[0]: "Eventually" looks past the limit (upTo Chapter 3): leave it out',
      'GR-V01 parts[0].chapters[0].screens[2].scenes[0]: scene text needs the {when} and [where] the book gives: one of each, at least one (has 0 and 0)',
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

  it('wants causes, not "and then"', () => {
    expect(lintBook(bookWith([{ type: 'steps', label: 'The logic', steps: ['Print spreads, and then witch-hunts spread.', 'Then science wins.', 'Print spreads, so witch-hunts spread.'] }]))).toEqual([
      'GR-W03 parts[0].chapters[0].screens[0].steps[0]: "then" orders events without a cause: say why ("because", "so"), or cut it',
      'GR-W03 parts[0].chapters[0].screens[0].steps[1]: "then" orders events without a cause: say why ("because", "so"), or cut it',
    ]);
    // Time marks and timeline times may order events.
    expect(lintBook(bookWith([{ type: 'chart', chart: 'timeline', items: [{ when: 'Then', text: 'The church splits.' }] }]))).toEqual([]);
  });

  describe('resume screens in a guide file', () => {
    const stands = (titles: string[]): Screen => ({ type: 'points', label: 'Where it stands', items: titles.map((title) => ({ title, text: 'Text.' })) });
    const open: Screen = { type: 'list', label: 'Still open', rows: [{ name: 'Jane and Bingley', text: 'Will Jane see Bingley again?' }] };
    const summary: Screen = { type: 'summary', label: 'In short', text: 'Text.' };
    const fiction = ['When and where', 'Who is there', 'What they want', 'What just happened'];
    const guide = (screens: Screen[], type: Book['type'] = 'fiction') => lintBook(bookWith(screens, { guide: 'b', style: 'map', type }));

    it('passes "Where it stands" last, or followed by "Still open"', () => {
      expect(guide([summary, stands(fiction)])).toEqual([]);
      expect(guide([summary, { ...summary, only: 'pdf' }, stands(fiction), open])).toEqual([]);
      expect(guide([summary, stands(['The question', 'Established so far', 'This chapter adds', 'Where it stops'])], 'done')).toEqual([]);
    });

    it('reports a missing, misplaced or wrong "Where it stands"', () => {
      expect(guide([summary])).toEqual([
        'GR-R01 parts[0].chapters[0]: the last screens must be "Where it stands" (points: "When and where", "Who is there", "What they want", "What just happened"), then optionally "Still open"',
      ]);
      expect(guide([stands(fiction), summary, open])[0]).toContain('the last screens must be "Where it stands"');
      expect(guide([summary, stands(['When and where', 'Who is there'])])).toEqual([
        'GR-R02 parts[0].chapters[0]: "Where it stands" needs the items "When and where", "Who is there", "What they want", "What just happened", in this order (has "When and where", "Who is there")',
      ]);
    });

    it('needs no resume screens outside a guide, or in a chapter not written yet', () => {
      expect(lintBook(bookWith([summary]))).toEqual([]);
      expect(guide([{ ...summary, only: 'pdf' }])).toEqual([]);
    });
  });

  it('reports guide-made overview chapters: a guide holds only the book\'s own chapters', () => {
    const withK: Partial<Book> = { parts: [{ id: 'p', chapters: [
      { id: 'c', number: '01', title: 'One', screens: [] },
      { id: 'k', number: 'K', title: 'Key concepts', screens: [{ type: 'list', label: 'Key concepts', rows: [{ name: 'Term', text: 'A short definition.' }] }] },
    ] }] };
    expect(lintBook(bookWith([], withK))).toEqual([
      'GR-S01 parts[0].chapters[1]: number "K" marks a guide-made overview chapter ("Key concepts"): a guide holds only the book\'s own chapters, so remove it',
    ]);
    expect(lintBook(bookWith([], { ...withK, type: 'fiction' }))).toHaveLength(1);
    expect(lintBook(bookWith([]))).toEqual([]);
  });
});
