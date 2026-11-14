// Service worker and install prompt. The service worker precaches the app and every book, so
// the library works offline. A new version waits: the library shows "Update app", and the
// reader is never reloaded in the middle of a chapter.

import { registerSW } from 'virtual:pwa-register';

type Listener = () => void;

function signal<T>() {
  let value: T | null = null;
  const listeners = new Set<Listener>();
  return {
    get: () => value,
    set(v: T | null) {
      value = v;
      listeners.forEach((l) => l());
    },
    subscribe(l: Listener) {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
  };
}

const updater = signal<(reload?: boolean) => Promise<void>>();
let register: ((reload?: boolean) => Promise<void>) | null = null;

export const onUpdateReady = {
  get ready() {
    return updater.get() !== null;
  },
  subscribe: updater.subscribe,
};

export function applyUpdate(): void {
  void updater.get()?.(true);
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const deferred = signal<BeforeInstallPromptEvent>();

export const installPrompt = {
  get event() {
    return deferred.get();
  },
  subscribe: deferred.subscribe,
  async show() {
    const e = deferred.get();
    if (!e) return;
    await e.prompt();
    await e.userChoice.catch(() => null);
    deferred.set(null);
  },
};

export function startPwa(): void {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred.set(e as BeforeInstallPromptEvent);
  });
  addEventListener('appinstalled', () => deferred.set(null));
  register = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (register) updater.set(register);
    },
  });
}
