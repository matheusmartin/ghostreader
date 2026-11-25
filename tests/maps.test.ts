import { describe, expect, it } from 'vitest';
import { validateBook } from '../src/model/validate.ts';
import { lintBook } from '../src/model/lint.ts';
import type { Book } from '../src/model/types.ts';

const bookWith = (chart: object) => ({
  format: 1, id: 'b', type: 'reading', title: 'B', author: 'C',
  parts: [{ id: 'p', chapters: [{ id: 'c', number: '01', title: 'One', screens: [{ type: 'chart', ...chart }] }] }],
});

const mindmap = {
  chart: 'mindmap', centre: 'Stories link strangers',
  branches: [
    { title: 'Fake memories', leaves: ['The Passover'] },
    { title: 'Intersubjective reality', key: true, leaves: ['The bitcoin pizzas', 'Kosovo'] },
  ],
};

const xy = {
  chart: 'xy',
  x: { label: 'Information flow', low: 'Centralised', high: 'Distributed' },
  y: { label: 'Self-correction', low: 'Weak', high: 'Strong' },
  quadrants: ['', 'Democracy', 'Totalitarianism', ''],
  points: [{ label: 'Soviet Union', x: 0, y: 0 }, { label: 'United States', x: 4, y: 4, key: true }],
  arrows: [{ from: 'Soviet Union', to: 'United States' }],
};

describe('mind map', () => {
  it('accepts a topic with concepts and their examples', () => {
    const { errors, book } = validateBook(bookWith(mindmap));
    expect(errors).toEqual([]);
    expect(lintBook(book as Book)).toEqual([]);
  });

  it('needs two branches, unique titles and at most one key', () => {
    expect(validateBook(bookWith({ ...mindmap, branches: [{ title: 'A' }] })).errors).toEqual(['parts[0].chapters[0].screens[0]: "branches" needs at least 2 items']);
    const twice = validateBook(bookWith({ ...mindmap, branches: [{ title: 'A', key: true }, { title: 'A', key: true }] })).errors;
    expect(twice.join('\n')).toContain('used twice');
    expect(twice.join('\n')).toContain('at most one item as "key"');
  });

  it('limits branches and examples on a phone', () => {
    const many = { ...mindmap, branches: Array.from({ length: 7 }, (_, i) => ({ title: `Concept ${i}`, leaves: ['One', 'Two', 'Three', 'Four'] })) };
    const problems = lintBook(validateBook(bookWith(many)).book as Book);
    expect(problems[0]).toContain('7 branches; at most 6');
    expect(problems[1]).toContain('4 leaves; at most 3');
  });
});

describe('x/y chart', () => {
  it('accepts positions 0–4 on the book\'s two dimensions', () => {
    const { errors, book } = validateBook(bookWith(xy));
    expect(errors).toEqual([]);
    expect(lintBook(book as Book)).toEqual([]);
  });

  it('keeps scale positions within 0–4 and arrows to known items', () => {
    const errors = validateBook(bookWith({ ...xy, points: [{ label: 'A', x: 5, y: 1 }, { label: 'B', x: 1, y: 1 }], arrows: [{ from: 'A', to: 'C' }] })).errors;
    expect(errors).toEqual([
      'parts[0].chapters[0].screens[0].points[0]: "x" must be 0–4 on the book\'s scale (none, little, some, much, most); use "mode": "data" for the book\'s numbers',
      'parts[0].chapters[0].screens[0].arrows[0]: "C" is not in point labels',
    ]);
  });

  it('plots the book\'s numbers in data mode, without end words or quadrants', () => {
    const data = { chart: 'xy', mode: 'data', x: { label: 'Year', unit: 'year' }, y: { label: 'Military spending', unit: '%' },
      points: [{ label: 'Rome', x: 100, y: 50 }, { label: 'World, 2020', x: 2020, y: 7, key: true }] };
    expect(validateBook(bookWith(data)).errors).toEqual([]);
    expect(validateBook(bookWith({ ...data, quadrants: ['a', 'b', 'c', 'd'] })).errors).toEqual(['parts[0].chapters[0].screens[0]: "quadrants" are for "scale" mode only']);
  });
});
