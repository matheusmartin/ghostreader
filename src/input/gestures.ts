// Swipe input for the reader. One finger (or a mouse drag) moves the screen with it; on release
// the move is committed or cancelled. A short touch without movement is a tap.
//
// The element must have `touch-action: none`, so the browser does not scroll, zoom or
// pull-to-refresh while the finger moves.

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

/** Movement before a touch becomes a drag, in px. */
export const SLOP = 10;
/** A drag commits when it covers this part of the screen… */
export const COMMIT_DISTANCE = 0.22;
/** …or is a flick: this fast (px/ms) and at least FLICK_MIN px long. */
export const FLICK_VELOCITY = 0.45;
export const FLICK_MIN = 24;
const TAP_TIME = 450;

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

  // A long press must not open the text or image menu.
  const noMenu = (e: Event) => e.preventDefault();

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('contextmenu', noMenu);
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', cancel);
    el.removeEventListener('contextmenu', noMenu);
  };
}

/** Speed over the last ~100 ms of the drag. */
function velocity(samples: { t: number; v: number }[], now: number, last: number): number {
  const recent = samples.filter((s) => now - s.t <= 100);
  const from = recent[0] ?? samples[samples.length - 1];
  if (!from || now - from.t <= 0) return 0;
  return (last - from.v) / (now - from.t);
}
