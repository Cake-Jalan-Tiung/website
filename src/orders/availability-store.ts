// What can be ordered, in the browser: read once the page is live, on every page reached in place,
// and again when the tab comes back into view. The server renders everything as available; checkout asks the server again,
// so a stale copy here can only show an Add button that checkout then explains.
import {useSyncExternalStore} from 'react';
import {OPEN, type Availability} from './availability';
import {getAvailability} from './functions';

let current: Availability = OPEN;
let started = false;
const listeners = new Set<() => void>();

const publish = (next: Availability) => {
  current = next;
  listeners.forEach((listener) => listener());
};

const refresh = () => getAvailability().then(publish, () => undefined);

function snapshot() {
  if (!started && typeof window !== 'undefined') {
    started = true;
    void refresh();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void refresh();
    });
  }
  return current;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useAvailability = () => useSyncExternalStore(subscribe, snapshot, () => OPEN);
/** Asks again, as each page reached in place would have when it loaded. */
export const refreshAvailability = () => void (started ? refresh() : snapshot());
/** Replaces the copy after staff change it on this device. */
export const showAvailability = publish;
