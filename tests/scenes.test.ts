import { describe, expect, it } from 'vitest';
import { sceneLayout, styledRuns, wrapRuns } from '../src/charts/scenes.ts';
import { validateBook } from '../src/model/validate.ts';
import type { ScenesScreen } from '../src/model/types.ts';

const chart: ScenesScreen = {
  type: 'scenes',
  people: [{ name: 'Nick', tag: 'New' }, { name: 'Daisy' }, { name: 'Tom' }, { name: 'Gatsby', tag: 'New' }],
  focus: ['Nick', 'Daisy'],
  scenes: [
    { text: '{In spring} Nick rents a house in [West Egg].', with: ['Nick'] },
    { text: '{At dinner} the telephone rings for Tom at [the Buchanans’ house].', with: ['Nick', 'Daisy', 'Tom'], key: true },
    { text: '{After dinner}, on [the porch], Daisy talks.', with: ['Nick', 'Daisy'], off: ['Tom'] },
    { text: '{That night} Nick sees Gatsby on [the lawn].', with: ['Nick', 'Gatsby'] },
  ],
};

describe('scene chart (storyline)', () => {
  it('splits {when} and [where] into styled runs', () => {
    expect(styledRuns('{At dinner} the phone rings in [the hall].')).toEqual([
      ['At dinner', 'ta'], [' the phone rings in ', ''], ['the hall', 'tb'], ['.', ''],
    ]);
  });

  it('wraps runs and keeps punctuation with the run before it', () => {
    const lines = wrapRuns(styledRuns('{At dinner} the phone rings in [the hall].'), 90, 12);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.map((l) => l.map(([t]) => t).join('')).join(' ')).toBe('At dinner the phone rings in the hall.');
    expect(lines[lines.length - 1].at(-1)).toEqual(['.', '']);
  });

  it('draws the first focus person in ink, the second in the accent colour, the others grey', () => {
    const roles = Object.fromEntries(sceneLayout(chart, 340).people.map((p) => [p.name, p.role]));
    expect(roles).toEqual({ Nick: 'ink', Daisy: 'acc', Tom: 'grey', Gatsby: 'grey' });
  });

  it('uses the first two people when there is no focus', () => {
    const roles = sceneLayout({ ...chart, focus: undefined }, 340).people.map((p) => p.role);
    expect(roles).toEqual(['ink', 'acc', 'grey', 'grey']);
  });

  it('starts a line at the first scene of a person and ends it with a dot after the last', () => {
    const L = sceneLayout(chart, 340);
    const tom = L.people.find((p) => p.name === 'Tom')!;
    expect(tom.points.map((p) => p.state)).toEqual(['in', 'in', 'off', 'in']);
    expect(tom.end).toBeDefined();
    expect(tom.points[0].y).toBeLessThan(L.rows[1].band);
    expect(L.people.find((p) => p.name === 'Nick')!.end).toBeUndefined();
  });

  it('marks a person away for a scene between two of theirs as gone', () => {
    const c: ScenesScreen = { ...chart, scenes: [chart.scenes[1], chart.scenes[0], { ...chart.scenes[2], off: [] , with: ['Daisy', 'Tom']}] };
    const tom = sceneLayout(c, 340).people.find((p) => p.name === 'Tom')!;
    expect(tom.points.map((p) => p.state)).toEqual(['in', 'in', 'gone', 'in', 'in']);
  });

  it('puts the scene text in the chart only when it is wide', () => {
    expect(sceneLayout(chart, 340).text).toBe(false);
    const wide = sceneLayout(chart, 640);
    expect(wide.text).toBe(true);
    expect(wide.rows.every((r) => r.lines.length > 0)).toBe(true);
  });

  it('keeps every band and name inside the chart, at both widths', () => {
    const big: ScenesScreen = {
      type: 'scenes',
      people: ['Wilson', 'Myrtle', 'Tom', 'Nick', 'Catherine', 'The McKees', 'Jordan', 'Daisy'].map((name) => ({ name, tag: 'New' })),
      scenes: [
        { text: '{One} a [b].', with: ['Wilson', 'Myrtle', 'Tom', 'Nick', 'Catherine', 'The McKees', 'Jordan', 'Daisy'] },
        { text: '{Two} a [b].', with: ['Myrtle', 'Tom'], key: true },
        { text: '{Three} a [b].', with: ['Nick', 'Daisy'], off: ['Jordan'] },
      ],
    };
    for (const w of [340, 640]) {
      const L = sceneLayout(big, w);
      for (const r of L.rows) {
        expect(r.x0).toBeGreaterThanOrEqual(0);
        expect(r.x1).toBeLessThanOrEqual(w);
      }
      for (const p of L.people) {
        expect(p.label.x - p.label.w / 2).toBeGreaterThanOrEqual(0);
        expect(p.label.x + p.label.w / 2).toBeLessThanOrEqual(w);
        expect(p.label.y).toBeGreaterThan(8);
        for (const pt of p.points) expect(Number.isFinite(pt.x) && Number.isFinite(pt.y)).toBe(true);
      }
    }
  });
});

describe('focus in the book file', () => {
  const book = (focus: unknown) => ({
    format: 1, id: 'x', type: 'fiction', title: 'X', author: 'Y',
    parts: [{ id: 'p', chapters: [{ id: 'c', number: '1', title: 'One', screens: [{ ...chart, focus }] }] }],
  });

  it('accepts 1 or 2 names from people', () => {
    expect(validateBook(book(['Nick'])).errors).toEqual([]);
    expect(validateBook(book(['Nick', 'Gatsby'])).errors).toEqual([]);
  });

  it('rejects more than 2 names, or a name not in people', () => {
    expect(validateBook(book(['Nick', 'Daisy', 'Tom'])).errors.join()).toMatch(/1 or 2 names/);
    expect(validateBook(book(['Jay'])).errors.join()).toMatch(/Jay/);
  });
});
