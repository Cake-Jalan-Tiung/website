// The time in the browser, for words that depend on it ("Open now"). Null on the server and in
// the first paint, so the page hydrates the same everywhere; then read again every half minute
// and whenever the tab comes back into view.
import {useSyncExternalStore} from 'react';

const TICK_MS = 30_000;
let now: Date | null = null;
let timer = 0;
const listeners = new Set<() => void>();

const tick = () => {
  now = new Date();
  listeners.forEach((listener) => listener());
};
const onVisible = () => document.visibilityState === 'visible' && tick();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    timer = window.setInterval(tick, TICK_MS);
    document.addEventListener('visibilitychange', onVisible);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    now = null;
  };
}

export const useNow = () => useSyncExternalStore(subscribe, () => (now ??= new Date()), () => null);
