import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachHold, COMMIT_DISTANCE, FLICK_VELOCITY, HOLD_TIME, lockAxis, shouldCommit, SLOP } from '../src/input/gestures.ts';
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

describe('long press (the menu, on every screen)', () => {
  // attachHold listens on the window; here the window is a plain EventTarget.
  let win: EventTarget;
  let calls: string[];
  let enabled: boolean;
  let detach: () => void;
  const pointer = (type: string, init: Partial<PointerEvent> = {}) => {
    const e = new Event(type, { cancelable: true });
    Object.assign(e, { pointerId: 1, pointerType: 'touch', button: 0, isPrimary: true, clientX: 100, clientY: 200, ...init });
    win.dispatchEvent(e);
    return e;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    win = new EventTarget();
    vi.stubGlobal('addEventListener', win.addEventListener.bind(win));
    vi.stubGlobal('removeEventListener', win.removeEventListener.bind(win));
    vi.stubGlobal('window', { setTimeout, clearTimeout, addEventListener: win.addEventListener.bind(win), removeEventListener: win.removeEventListener.bind(win) });
    vi.stubGlobal('Element', class {});
    calls = [];
    enabled = true;
    detach = attachHold({
      enabled: () => enabled,
      pressStart: () => calls.push('start'),
      pressEnd: () => calls.push('end'),
      longPress: () => calls.push('long'),
    });
  });

  afterEach(() => {
    detach();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('fires after HOLD_TIME when the finger stays still', () => {
    pointer('pointerdown');
    vi.advanceTimersByTime(HOLD_TIME - 1);
    expect(calls).toEqual(['start']);
    vi.advanceTimersByTime(1);
    expect(calls).toEqual(['start', 'end', 'long']);
  });

  it('does not fire when the finger moves, lifts, scrolls or is joined by a second finger', () => {
    pointer('pointerdown');
    pointer('pointermove', { clientX: 100 + SLOP });
    pointer('pointerdown');
    pointer('pointerup');
    pointer('pointerdown');
    win.dispatchEvent(new Event('scroll'));
    pointer('pointerdown');
    pointer('pointerdown', { pointerId: 2, isPrimary: false });
    vi.advanceTimersByTime(HOLD_TIME * 2);
    expect(calls).not.toContain('long');
  });

  it('does not start while the menu is open, or for the right mouse button', () => {
    enabled = false;
    pointer('pointerdown');
    enabled = true;
    pointer('pointerdown', { pointerType: 'mouse', button: 2 });
    vi.advanceTimersByTime(HOLD_TIME * 2);
    expect(calls).toEqual([]);
  });

  it('stops the browser menu for a touch, not for a mouse', () => {
    pointer('pointerdown');
    const touchMenu = new Event('contextmenu', { cancelable: true });
    win.dispatchEvent(touchMenu);
    expect(touchMenu.defaultPrevented).toBe(true);
    pointer('pointerup');
    pointer('pointerdown', { pointerType: 'mouse', button: 2 });
    const mouseMenu = new Event('contextmenu', { cancelable: true });
    win.dispatchEvent(mouseMenu);
    expect(mouseMenu.defaultPrevented).toBe(false);
  });

  it('ignores the click that the lifted finger makes after a long press', () => {
    pointer('pointerdown');
    vi.advanceTimersByTime(HOLD_TIME);
    pointer('pointerup');
    const click = new Event('click', { cancelable: true });
    win.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    const next = new Event('click', { cancelable: true });
    win.dispatchEvent(next);
    expect(next.defaultPrevented).toBe(false);
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

  it('opens the menu with Esc and Enter', () => {
    expect(k('Escape')).toBe('menu');
    expect(k('Enter')).toBe('menu');
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

describe('theme', () => {
  it('resolves Auto from the device mode and keeps a fixed choice', async () => {
    const { resolveScheme } = await import('../src/lib/scheme.ts');
    expect(resolveScheme('auto', false)).toBe('paper');
    expect(resolveScheme('auto', true)).toBe('dusk');
    expect(resolveScheme('night', false)).toBe('night');
    expect(resolveScheme('quiet', true)).toBe('quiet');
  });
});
