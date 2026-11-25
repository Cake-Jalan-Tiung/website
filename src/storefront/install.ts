// Whether and how this browser can install the shop. Chrome, Edge and Samsung Internet offer
// their own install prompt, held here from the moment it is offered, which may be before any
// page asks; iOS adds to the home screen by hand from the Share menu. Read like the bag: nothing
// on the server, known once the page is live.
import {useSyncExternalStore} from 'react';

/** Installed already, a prompt to show, steps to give on iOS, or nothing to offer. */
export type InstallWay = 'installed' | 'prompt' | 'ios' | 'none';

type Device = {standalone: boolean; prompt: boolean; userAgent: string; touchPoints: number};

// Browsers inside these apps have no Add to Home Screen.
const IN_APP = /FBAN|FBAV|Instagram|Line\/|musical_ly|Bytedance/;

export function installWay({standalone, prompt, userAgent, touchPoints}: Device): InstallWay {
  if (standalone) return 'installed';
  if (prompt) return 'prompt';
  // An iPad asks for desktop pages and names itself a Mac; the touch screen gives it away.
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && touchPoints > 1);
  return ios && !IN_APP.test(userAgent) ? 'ios' : 'none';
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
  interface Navigator {
    /** iOS: true in an app added to the home screen. */
    standalone?: boolean;
  }
}

let offered: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const publish = () => listeners.forEach((listener) => listener());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Held for our own button rather than the browser's banner.
    event.preventDefault();
    offered = event;
    publish();
  });
  window.addEventListener('appinstalled', () => {
    installedNow = true;
    offered = null;
    publish();
  });
}

const snapshot = (): InstallWay =>
  installWay({
    standalone: installedNow || window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
    prompt: offered !== null,
    userAgent: navigator.userAgent,
    touchPoints: navigator.maxTouchPoints,
  });

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useInstallWay = () => useSyncExternalStore(subscribe, snapshot, (): InstallWay => 'none');

/** Shows the browser's install prompt. It can be shown once; the browser may offer another later. */
export async function install() {
  const event = offered;
  if (!event) return;
  offered = null;
  publish();
  await event.prompt();
  await event.userChoice;
}
