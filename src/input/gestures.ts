// Pointer input.
//
//   attachSwipe  the reader: one finger (or a mouse drag) moves the screen with it; on release the
//                move is committed or cancelled. A short touch without movement is a tap. The
//                element must have `touch-action: none`, so the browser does not scroll, zoom or
//                pull-to-refresh while the finger moves.
//   attachHold   the whole app: a touch held still for HOLD_TIME is a long press (it opens the menu).

export type Axis = 'x' | 'y';

export interface SwipeHandlers {
  /** The finger has moved far enough along one axis: a drag starts. `delta` is in px. */
  start(axis: Axis, delta: number): void;
  move(axis: Axis, delta: number): void;
  /** `velocity` in px/ms along the axis (negative: towards the top or the left). */
  end(axis: Axis, delta: number, velocity: number): void;
  cancel(): void;
  tap(target: Element, x: number, y: number): void;
}

export interface HoldHandlers {
  /** False: a finger that goes down now does not start a long press (the menu is open). */
  enabled(): boolean;
  /** A finger is down and still: a long press may follow (show feedback). */
  pressStart(x: number, y: number): void;
  /** The finger moved, lifted or the long press fired: hide the feedback. */
  pressEnd(): void;
  /** The finger stayed still for HOLD_TIME. */
  longPress(x: number, y: number): void;
}

/** Movement before a touch becomes a drag, in px. */
export const SLOP = 10;
/** A drag commits when it covers this part of the screen… */
export const COMMIT_DISTANCE = 0.22;
/** …or is a flick: this fast (px/ms) and at least FLICK_MIN px long. */
export const FLICK_VELOCITY = 0.45;
export const FLICK_MIN = 24;
const TAP_TIME = 450;
/**
 * A still touch this long (ms) is a long press. Phones use about 500 ms; a little more avoids
 * opening the menu while a reader rests a finger on the screen.
 */
export const HOLD_TIME = 600;
/** After a long press the finger lifts over whatever opened; ignore the click that follows (ms). */
const CLICK_AFTER_HOLD = 700;

/** The axis of a drag once the finger has left the slop circle, else null. */
export function lockAxis(dx: number, dy: number, slop = SLOP): Axis | null {
  if (Math.hypot(dx, dy) < slop) return null;
  return Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
}

/** Whether a released drag moves to the neighbour screen. */
export function shouldCommit(delta: number, velocity: number, size: number): boolean {
  if (Math.abs(delta) >= size * COMMIT_DISTANCE) return true;
  // A flick counts only when it goes the same way as the drag.
  return Math.abs(velocity) >= FLICK_VELOCITY && Math.abs(delta) >= FLICK_MIN && Math.sign(velocity) === Math.sign(delta);
}

export function attachSwipe(el: HTMLElement, h: SwipeHandlers): () => void {
  let id: number | null = null;
  let x0 = 0, y0 = 0, t0 = 0;
  let axis: Axis | null = null;
  let samples: { t: number; v: number }[] = [];

  const delta = (e: PointerEvent) => (axis === 'x' ? e.clientX - x0 : e.clientY - y0);

  const down = (e: PointerEvent) => {
    if (id !== null) {
      // A second finger: stop, so pinch and two-finger gestures do nothing odd.
      if (axis) h.cancel();
      reset();
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    id = e.pointerId;
    x0 = e.clientX;
    y0 = e.clientY;
    t0 = e.timeStamp;
    axis = null;
    samples = [];
  };

  const move = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    if (!axis) {
      axis = lockAxis(e.clientX - x0, e.clientY - y0);
      if (!axis) return;
      el.setPointerCapture(e.pointerId);
      h.start(axis, delta(e));
    }
    const d = delta(e);
    samples.push({ t: e.timeStamp, v: d });
    if (samples.length > 6) samples.shift();
    h.move(axis, d);
  };

  const up = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    if (axis) {
      const d = delta(e);
      h.end(axis, d, velocity(samples, e.timeStamp, d));
    } else if (e.timeStamp - t0 < TAP_TIME && e.target instanceof Element) {
      h.tap(e.target, e.clientX, e.clientY);
    }
    reset();
  };

  const cancel = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    if (axis) h.cancel();
    reset();
  };

  const reset = () => {
    id = null;
    axis = null;
    samples = [];
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);
  return () => {
    reset();
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', cancel);
  };
}

/**
 * Long press anywhere in the app: listens on the window, before any element, so it works on every
 * screen (library, reader, PDF view) and over buttons and links. The touch is cancelled when the
 * finger moves past SLOP, a second finger comes down, the page scrolls or the browser takes the
 * touch (pointercancel). After a long press, the click that the lifted finger makes is ignored.
 */
export function attachHold(h: HoldHandlers): () => void {
  let id: number | null = null;
  let x0 = 0, y0 = 0;
  let timer = 0;
  let held = false;
  /** The pointer type of the last touch: the browser's own long-press menu is stopped for touch and pen only. */
  let lastType = '';

  const stop = () => {
    if (timer) {
      clearTimeout(timer);
      timer = 0;
      h.pressEnd();
    }
  };
  const reset = () => {
    stop();
    id = null;
    held = false;
  };

  const down = (e: PointerEvent) => {
    lastType = e.pointerType;
    if (id !== null) {
      // A second finger: no long press (pinch and two-finger gestures).
      reset();
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!e.isPrimary || !h.enabled()) return;
    id = e.pointerId;
    x0 = e.clientX;
    y0 = e.clientY;
    const target = e.target instanceof Element ? e.target : null;
    h.pressStart(x0, y0);
    timer = window.setTimeout(() => {
      timer = 0;
      held = true;
      h.pressEnd();
      // Keep the rest of this touch on the element it started on, not on the menu that now covers it.
      try { if (target?.isConnected && id !== null) target.setPointerCapture(id); } catch { /* the pointer is already gone */ }
      h.longPress(x0, y0);
    }, HOLD_TIME);
  };

  const move = (e: PointerEvent) => {
    if (e.pointerId !== id || held) return;
    if (Math.hypot(e.clientX - x0, e.clientY - y0) >= SLOP) reset();
  };

  const up = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    if (held) swallowNextClick();
    reset();
  };

  const cancel = (e: PointerEvent) => {
    if (e.pointerId === id) reset();
  };

  // Scrolling the library or the menu is not a long press.
  const scroll = () => {
    if (!held) reset();
  };

  // A long press must not open the browser's text, link or image menu.
  const noMenu = (e: Event) => {
    if (lastType !== 'mouse') e.preventDefault();
  };

  const opts = { capture: true };
  addEventListener('pointerdown', down, opts);
  addEventListener('pointermove', move, opts);
  addEventListener('pointerup', up, opts);
  addEventListener('pointercancel', cancel, opts);
  addEventListener('scroll', scroll, opts);
  addEventListener('contextmenu', noMenu, opts);
  return () => {
    reset();
    removeEventListener('pointerdown', down, opts);
    removeEventListener('pointermove', move, opts);
    removeEventListener('pointerup', up, opts);
    removeEventListener('pointercancel', cancel, opts);
    removeEventListener('scroll', scroll, opts);
    removeEventListener('contextmenu', noMenu, opts);
  };
}

/** Ignores the next click anywhere (the one the browser sends when a held finger lifts). */
function swallowNextClick() {
  const opts = { capture: true };
  const swallow = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    window.removeEventListener('click', swallow, opts);
  };
  window.addEventListener('click', swallow, opts);
  window.setTimeout(() => window.removeEventListener('click', swallow, opts), CLICK_AFTER_HOLD);
}

/** Speed over the last ~100 ms of the drag. */
function velocity(samples: { t: number; v: number }[], now: number, last: number): number {
  const recent = samples.filter((s) => now - s.t <= 100);
  const from = recent[0] ?? samples[samples.length - 1];
  if (!from || now - from.t <= 0) return 0;
  return (last - from.v) / (now - from.t);
}
