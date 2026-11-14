import { describe, expect, it } from 'vitest';
import { COMMIT_DISTANCE, FLICK_VELOCITY, lockAxis, shouldCommit } from '../src/input/gestures.ts';
import { moveForKey } from '../src/input/keys.ts';
import { parseRoute, readHash } from '../src/router.ts';

describe('swipe classification', () => {
  it('waits for the finger to leave the slop circle, then locks the dominant axis', () => {
    expect(lockAxis(3, 4)).toBeNull();
    expect(lockAxis(-30, 8)).toBe('x');
    expect(lockAxis(5, -40)).toBe('y');
  });

  it('commits a long drag or a flick in the same direction, not a short slow one', () => {
    const size = 800;
    expect(shouldCommit(-size * COMMIT_DISTANCE, 0, size)).toBe(true);
    expect(shouldCommit(-40, -FLICK_VELOCITY - 0.1, size)).toBe(true);
    expect(shouldCommit(-40, 0.1, size)).toBe(false);
    // A flick back towards the start cancels the move.
    expect(shouldCommit(-100, FLICK_VELOCITY + 0.2, size)).toBe(false);
  });
});

describe('keys', () => {
  const k = (key: string, shiftKey = false) => moveForKey({ key, shiftKey, altKey: false, ctrlKey: false, metaKey: false });
  it('maps arrows to screens (up/down) and chapters (left/right)', () => {
    expect(k('ArrowDown')).toBe('next');
    expect(k('ArrowUp')).toBe('prev');
    expect(k('ArrowRight')).toBe('nextChapter');
    expect(k('ArrowLeft')).toBe('prevChapter');
    expect(k(' ')).toBe('next');
    expect(k(' ', true)).toBe('prev');
    expect(k('x')).toBeNull();
  });
});

describe('routes', () => {
  it('parses library and reader addresses', () => {
    expect(parseRoute('')).toEqual({ name: 'library' });
    expect(parseRoute('#/')).toEqual({ name: 'library' });
    expect(parseRoute('#/read/nexus')).toEqual({ name: 'read', bookId: 'nexus', chapterId: undefined, n: undefined });
    expect(parseRoute('#/read/nexus/ch5/3')).toEqual({ name: 'read', bookId: 'nexus', chapterId: 'ch5', n: 2 });
    expect(parseRoute('#/read/nexus/ch5/0')).toMatchObject({ name: 'read', n: undefined });
  });

  it('writes addresses that parse back', () => {
    expect(parseRoute(readHash('nexus', 'ch5', 2))).toEqual({ name: 'read', bookId: 'nexus', chapterId: 'ch5', n: 2 });
  });
});
