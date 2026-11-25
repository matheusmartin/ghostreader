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

  it('wants causes, not "and then"', () => {
    expect(lintBook(bookWith([{ type: 'steps', label: 'The logic', steps: ['Print spreads, and then witch-hunts spread.', 'Then science wins.', 'Print spreads, so witch-hunts spread.'] }]))).toEqual([
      'parts[0].chapters[0].screens[0].steps[0]: "then" orders events without a cause: say why ("because", "so"), or cut it',
      'parts[0].chapters[0].screens[0].steps[1]: "then" orders events without a cause: say why ("because", "so"), or cut it',
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
      expect(guide([summary, stands(['The question', 'Established so far', 'This chapter adds', 'Where it stops'])], 'reading')).toEqual([]);
    });

    it('reports a missing, misplaced or wrong "Where it stands"', () => {
      expect(guide([summary])).toEqual([
        'parts[0].chapters[0]: the last screens must be "Where it stands" (points: "When and where", "Who is there", "What they want", "What just happened"), then optionally "Still open"',
      ]);
      expect(guide([stands(fiction), summary, open])[0]).toContain('the last screens must be "Where it stands"');
      expect(guide([summary, stands(['When and where', 'Who is there'])])).toEqual([
        'parts[0].chapters[0]: "Where it stands" needs the items "When and where", "Who is there", "What they want", "What just happened", in this order (has "When and where", "Who is there")',
      ]);
    });

    it('needs no resume screens outside a guide, or in a chapter not written yet', () => {
      expect(lintBook(bookWith([summary]))).toEqual([]);
      expect(guide([{ ...summary, only: 'pdf' }])).toEqual([]);
    });
  });

  describe('book summary', () => {
    const stands: Screen = { type: 'points', label: 'Where it stands', items: ['The question', 'Established so far', 'This chapter adds', 'Where it stops'].map((title) => ({ title, text: 'Text.' })) };
    const chart: Screen = { type: 'chart', chart: 'cycle', nodes: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] };
    const sections = (withBefore: boolean) => [
      ...(withBefore ? [{ title: 'Before this chapter', screens: [{ type: 'list', label: 'Before this chapter', rows: [{ name: 'Chapter 1', text: 'Information connects.' }] } as Screen] }] : []),
      { title: 'Recap', screens: [{ type: 'text', label: 'Recap', paragraphs: ['It happens, so it matters.'] } as Screen] },
      { title: 'In short', screens: [{ type: 'points', label: 'In short', items: [{ title: 'A point', text: 'Text.' }, { title: 'Takeaway', text: 'Text.' }] } as Screen] },
      { title: 'Key moments', screens: [chart, { ...chart, label: 'Another' } as Screen] },
      { title: 'Where it stands', screens: [stands] },
    ];
    const summary = (chapters: { id: string; sections: ReturnType<typeof sections> }[]): Book => ({
      format: 1, id: 's', type: 'done', title: 'S', author: 'A',
      parts: [{ id: 'p', chapters: chapters.map((c, i) => ({ id: c.id, number: `0${i + 1}`, title: `Chapter ${i + 1}`, sections: c.sections })) }],
    });

    it('passes the five sections, with no "Before this chapter" in the first chapter', () => {
      expect(lintBook(summary([{ id: 'a', sections: sections(false) }, { id: 'b', sections: sections(true) }]))).toEqual([]);
    });

    it('reports missing or misplaced sections', () => {
      const problems = lintBook(summary([{ id: 'a', sections: sections(true) }, { id: 'b', sections: sections(false) }]));
      expect(problems[0]).toContain('no "Before this chapter" in the first chapter');
      expect(problems[1]).toContain('"Before this chapter", "Recap", "In short", "Key moments", "Where it stands", in this order');
    });

    it('wants diagrams in "Key moments" and a takeaway last in "In short"', () => {
      const s = sections(false);
      s[2].screens = [{ type: 'text', paragraphs: ['Words.'] } as Screen, chart];
      (s[1].screens[0] as { items: { title: string }[] }).items[1].title = 'Last point';
      const problems = lintBook(summary([{ id: 'a', sections: s }]));
      expect(problems).toEqual([
        'parts[0].chapters[0].sections[1]: "In short" ends with an item titled "Takeaway"',
        'parts[0].chapters[0].sections[2]: "Key moments" holds diagrams (charts, figures, scenes) only',
      ]);
    });
  });

  it('reports guide-made overview chapters: a guide holds only the book\'s own chapters', () => {
    const withK: Partial<Book> = { parts: [{ id: 'p', chapters: [
      { id: 'c', number: '01', title: 'One', screens: [] },
      { id: 'k', number: 'K', title: 'Key concepts', screens: [{ type: 'list', label: 'Key concepts', rows: [{ name: 'Term', text: 'A short definition.' }] }] },
    ] }] };
    expect(lintBook(bookWith([], withK))).toEqual([
      'parts[0].chapters[1]: number "K" marks a guide-made overview chapter ("Key concepts"): a guide holds only the book\'s own chapters, so remove it',
    ]);
    expect(lintBook(bookWith([], { ...withK, type: 'fiction' }))).toHaveLength(1);
    expect(lintBook(bookWith([]))).toEqual([]);
  });
});
