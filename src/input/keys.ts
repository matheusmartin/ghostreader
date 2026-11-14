// Keyboard and wheel input, for desktop browsers and for tests. Same moves as the swipes.

export type Move = 'next' | 'prev' | 'nextChapter' | 'prevChapter' | 'first' | 'last' | 'menu';

const KEYS: Record<string, Move> = {
  ArrowDown: 'next', PageDown: 'next', ' ': 'next', j: 'next',
  ArrowUp: 'prev', PageUp: 'prev', k: 'prev',
  ArrowRight: 'nextChapter', l: 'nextChapter',
  ArrowLeft: 'prevChapter', h: 'prevChapter',
  Home: 'first', End: 'last',
  Escape: 'menu', Enter: 'menu',
};

export function moveForKey(e: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>): Move | null {
  if (e.altKey || e.ctrlKey || e.metaKey) return null;
  if (e.key === ' ' && e.shiftKey) return 'prev';
  return KEYS[e.key] ?? null;
}

export function attachKeys(onMove: (m: Move) => void): () => void {
  const key = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    // Enter and Space on a button belong to the button.
    if (t && t.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
    const m = moveForKey(e);
    if (!m) return;
    e.preventDefault();
    onMove(m);
  };
  addEventListener('keydown', key);
  return () => removeEventListener('keydown', key);
}

/**
 * Mouse wheel and trackpad: one move per gesture. After a move, the wheel must stay still
 * for a moment before the next one, so trackpad momentum does not skip screens.
 */
export function attachWheel(el: HTMLElement, onMove: (m: Move) => void): () => void {
  let sumX = 0, sumY = 0;
  let locked = false;
  let quiet: ReturnType<typeof setTimeout> | undefined;
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    clearTimeout(quiet);
    quiet = setTimeout(() => { locked = false; sumX = sumY = 0; }, 180);
    if (locked) return;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
    sumX += e.deltaX * unit;
    sumY += e.deltaY * unit;
    if (Math.abs(sumY) >= 50 && Math.abs(sumY) >= Math.abs(sumX)) onMove(sumY > 0 ? 'next' : 'prev');
    else if (Math.abs(sumX) >= 50) onMove(sumX > 0 ? 'nextChapter' : 'prevChapter');
    else return;
    locked = true;
  };
  el.addEventListener('wheel', wheel, { passive: false });
  return () => {
    clearTimeout(quiet);
    el.removeEventListener('wheel', wheel);
  };
}
