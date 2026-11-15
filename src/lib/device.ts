// Full screen and screen wake lock. Both fail quietly where the browser does not allow them:
// iPhone Safari has no Fullscreen API for pages (installed to the home screen, the app is
// already full screen), and wake lock needs a secure context.

export function isInstalled(): boolean {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    // A browser tab in full screen (Fullscreen API) also matches display-mode: fullscreen.
    (matchMedia('(display-mode: fullscreen)').matches && !isFullscreen()) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function canFullscreen(): boolean {
  return document.fullscreenEnabled === true && typeof document.documentElement.requestFullscreen === 'function';
}

export function isFullscreen(): boolean {
  return document.fullscreenElement !== null && document.fullscreenElement !== undefined;
}

/** Call from a user gesture (tap or click), or the browser refuses. */
export async function enterFullscreen(): Promise<void> {
  if (isInstalled() || isFullscreen() || !canFullscreen()) return;
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    /* not allowed here: stay in the window */
  }
}

export async function toggleFullscreen(): Promise<void> {
  if (isFullscreen()) await document.exitFullscreen().catch(() => {});
  else if (canFullscreen()) await document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
}

/** Keeps the screen on while reading. Returns the function that lets it sleep again. */
export function keepAwake(): () => void {
  if (!('wakeLock' in navigator)) return () => {};
  let lock: WakeLockSentinel | null = null;
  let active = true;
  const acquire = async () => {
    if (!active || document.visibilityState !== 'visible' || (lock && !lock.released)) return;
    try {
      lock = await navigator.wakeLock.request('screen');
    } catch {
      lock = null;
    }
  };
  // The browser releases the lock when the page is hidden; take it again on return.
  const onVisible = () => void acquire();
  document.addEventListener('visibilitychange', onVisible);
  void acquire();
  return () => {
    active = false;
    document.removeEventListener('visibilitychange', onVisible);
    void lock?.release().catch(() => {});
    lock = null;
  };
}

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
