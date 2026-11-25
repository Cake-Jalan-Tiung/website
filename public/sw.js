// The shop's service worker, registered by the root route in production builds. It keeps the
// home page, the menu and the offline page with the code, styles and fonts they load, so an
// installed shop opens with no connection. Pages are asked of the network first, so a page
// online is always the current deploy's; code and photos under /assets/ come from the cache
// first, since a file there never changes. Calls to the server pass by untouched.

const PAGES = 'cjt-pages-v1';
const ASSETS = 'cjt-assets-v1';
const OFFLINE = '/offline';
const KEPT = ['/', '/menu', OFFLINE];

/** Every file under /assets/ a page names, in src, href, srcset or inline CSS. */
const named = (html) => new Set(html.match(/\/assets\/[^"'\s,)]+/g));
/** What a page cannot start without: its scripts, styles and fonts. Photos follow as it shows them. */
const needed = (html) => [...named(html)].filter((url) => /\.(?:js|css|woff2)$/.test(url));

self.addEventListener('install', (event) => {
  // A worker that could not keep every page fails to install, and the browser tries again on the next visit.
  event.waitUntil(Promise.all(KEPT.map((path) => fetch(path).then((page) => keep(path, page)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name !== PAGES && name !== ASSETS) await caches.delete(name);
      // The page request starts while the worker wakes, so asking the network first costs no wait.
      await self.registration.navigationPreload?.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const {request} = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/assets/')) event.respondWith(asset(event));
  else if (request.mode === 'navigate') event.respondWith(page(event, url));
});

// A page that loaded before this worker ran, as every first visit does, hands over the files it
// loaded. Those under /assets/ are kept: the photos it chose to show among them, at the width it
// chose, from the browser's own cache rather than the network.
self.addEventListener('message', (event) => {
  const loaded = Array.isArray(event.data?.loaded) ? event.data.loaded : [];
  const files = loaded.flatMap((href) => {
    try {
      const url = new URL(href);
      return url.origin === self.location.origin && url.pathname.startsWith('/assets/') ? [url.pathname] : [];
    } catch {
      return [];
    }
  });
  event.waitUntil(caches.open(ASSETS).then((assets) => Promise.all(files.map(async (path) => (await assets.match(path, {ignoreVary: true})) ?? assets.add(path).catch(() => undefined)))));
});

async function asset(event) {
  const cache = await caches.open(ASSETS);
  const kept = await cache.match(event.request, {ignoreVary: true});
  if (kept) return kept;
  const response = await fetch(event.request).catch(() => Response.error());
  if (response.ok) event.waitUntil(cache.put(event.request, response.clone()));
  return response;
}

async function page(event, url) {
  try {
    const response = (await event.preloadResponse) ?? (await fetch(event.request));
    if (KEPT.includes(url.pathname) && response.ok) event.waitUntil(keep(url.pathname, response.clone()).catch(() => undefined));
    return response;
  } catch {
    const kept = await (await caches.open(PAGES)).match(url.pathname);
    if (kept) return kept;
    if (url.pathname === OFFLINE) return Response.error();
    return Response.redirect(new URL(`${OFFLINE}?from=${encodeURIComponent(url.pathname + url.search)}`, url.origin), 302);
  }
}

/**
 * Keeps a page and what it needs to start, the files first so a kept page always has its code.
 * When the page names other files than the copy it replaces, a deploy has happened: files no
 * kept page names any more are let go, and come back when a page asks for them.
 */
async function keep(path, response) {
  if (!response.ok || response.redirected) throw new Error(`${path} answered ${response.status}`);
  const html = await response.clone().text();
  const [pages, assets] = await Promise.all([caches.open(PAGES), caches.open(ASSETS)]);
  await Promise.all(needed(html).map(async (url) => (await assets.match(url, {ignoreVary: true})) ?? assets.add(url)));
  const before = await pages.match(path);
  await pages.put(path, response);
  if (before && [...named(await before.text())].sort().join() !== [...named(html)].sort().join()) await letGo(pages, assets);
}

async function letGo(pages, assets) {
  const still = new Set();
  for (const path of KEPT) {
    const kept = await pages.match(path);
    if (kept) for (const url of named(await kept.text())) still.add(url);
  }
  for (const request of await assets.keys()) if (!still.has(new URL(request.url).pathname)) await assets.delete(request);
}
