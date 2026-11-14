// `npm run validate` runs this file: every book in src/books must pass the format check.

import { describe, expect, it } from 'vitest';
import { validateBook } from '../src/model/validate.ts';

const files = import.meta.glob<unknown>('../src/books/*.json', { eager: true, import: 'default' });

describe('bundled books', () => {
  it('has at least one book', () => {
    expect(Object.keys(files).length).toBeGreaterThan(0);
  });

  for (const [path, raw] of Object.entries(files)) {
    const file = path.replace(/^.*\//, '');
    it(`${file} is a valid book`, () => {
      const { errors } = validateBook(raw);
      expect(errors, errors.join('\n')).toEqual([]);
      expect((raw as { id: string }).id, 'the id must match the file name').toBe(file.replace(/\.json$/, ''));
    });
  }
});

describe('validateBook', () => {
  it('reports every problem with its path', () => {
    const { book, errors } = validateBook({
      format: 1,
      id: 'x',
      type: 'novel',
      title: 'X',
      author: 'Y',
      lead: 'Z',
      parts: [
        {
          id: 'p',
          theme: 'blue',
          chapters: [
            { id: 'c', number: '1', title: 'One', screens: [{ type: 'summary', label: 'In short' }, { type: 'chart', chart: 'pie' }] },
            { id: 'c', number: '2', title: 'Two', screens: [], sections: [] },
          ],
        },
      ],
    });
    expect(book).toBeNull();
    expect(errors).toEqual([
      '"type" must be one of fiction, reading, done',
      'parts[0]: "theme" must be one of front, p1, p2, p3, p4, p5',
      'parts[0].chapters[0].screens[0]: missing "text"',
      'parts[0].chapters[0].screens[1]: "chart" must be one of bars, compare, flow',
      'parts[0].chapters[1]: id "c" is used twice',
      'parts[0].chapters[1]: use "screens" or "sections", not both',
      'parts[0].chapters[1]: "screens" needs at least 1 item',
      'parts[0].chapters[1]: "sections" needs at least 1 item',
    ]);
  });
});
