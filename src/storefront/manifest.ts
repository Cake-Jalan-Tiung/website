// The web app manifest: what a phone needs to install the shop as an app. Built from the shop's
// content and the brand's colours, so another shop's deploy installs as that shop. The icons
// are drawn into public/ by `pnpm icons`.
import {color} from '../system/tokens';
import type {Storefront} from './model';

export const MANIFEST_PATH = '/manifest.webmanifest';

export const manifestIcons = [
  {src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any'},
  {src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any'},
  {src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
] as const;

export function webManifest(store: Storefront) {
  return {
    id: '/',
    name: store.name,
    short_name: store.shortName ?? store.name,
    lang: 'en',
    // An installed shop opens where an order starts.
    start_url: store.menu.href,
    scope: '/',
    display: 'standalone',
    // The splash screen is the icon's own ground, so the icon sits on it without an edge.
    background_color: color['cream-100'],
    theme_color: color.paper,
    categories: ['food', 'shopping'],
    icons: manifestIcons,
  };
}
