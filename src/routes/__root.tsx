import {useEffect, type ReactNode} from 'react';
import {HeadContent, Outlet, Scripts, createRootRoute, useRouter} from '@tanstack/react-router';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '../index.css';
import {Theme} from '@astryxdesign/core/theme';
import {themes, defaultThemeSlug, themeModes} from '../astryx-themes';
import {Link, LinkProvider} from '@astryxdesign/core/Link';
import jost from '@fontsource-variable/jost/files/jost-latin-wght-normal.woff2?url';
import {Stack} from '../system/layout';
import {Type} from '../system/Type';
import {Sections} from '../storefront/sections';
import {StoreLink} from '../storefront/link';
import {refreshAvailability} from '../orders/availability-store';
import {getDelivers} from '../orders/functions';
import {color} from '../system/tokens';
import {storefront} from '../site/content';
import {MANIFEST_PATH} from '../storefront/manifest';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {charSet: 'utf-8'},
      {name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover'},
      {name: 'theme-color', content: color.paper},
      // iOS names a home-screen app from this rather than the manifest.
      {name: 'apple-mobile-web-app-title', content: storefront.shortName ?? storefront.name},
      {title: 'Cake Jalan Tiung — Shah Alam'},
    ],
    links: [
      // Every page sets its words in Jost: fetched with the page, so the first paint is already in it.
      {rel: 'preload', href: jost, as: 'font', type: 'font/woff2', crossOrigin: 'anonymous'},
      // Drawn from the brand marks by `pnpm icons`.
      {rel: 'icon', href: '/favicon.ico', sizes: '16x16 32x32'},
      {rel: 'apple-touch-icon', href: '/apple-touch-icon.png'},
      {rel: 'manifest', href: MANIFEST_PATH},
    ],
  }),
  // Whether the site delivers is fixed per deploy: asked once, on the server for the first page.
  loader: () => getDelivers(),
  staleTime: Infinity,
  shellComponent: Shell,
  notFoundComponent: NotFound,
  component: () => (
    <>
      <AfterNavigate />
      <OfflineReady />
      <Outlet />
    </>
  ),
});

/**
 * A page reached in place starts as a loaded one would: focus on the place its link named
 * (/menu#pastries) or else on its content, so a screen reader reads on and the next Tab is the
 * next link there; and what is sold out is asked again.
 */
function AfterNavigate() {
  const router = useRouter();
  useEffect(
    () =>
      router.subscribe('onResolved', ({fromLocation, toLocation, pathChanged}) => {
        if (!fromLocation || !pathChanged) return;
        refreshAvailability();
        const place = toLocation.hash ? document.getElementById(toLocation.hash) : null;
        if (place && !place.hasAttribute('tabindex')) place.setAttribute('tabindex', '-1');
        (place ?? document.querySelector<HTMLElement>('main'))?.focus({preventScroll: true});
      }),
    [router],
  );
  return null;
}

/**
 * Hands the page to the service worker (public/sw.js), which keeps the menu for offline use.
 * Only in a production build: `vite dev` pages load their code from source, not /assets/.
 */
function OfflineReady() {
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    // A page that loaded before the worker ran hands it the files it loaded, so what it shows opens offline.
    const loadedAlone = navigator.serviceWorker.controller === null;
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => loadedAlone && registration.active?.postMessage({loaded: performance.getEntriesByType('resource').map((entry) => entry.name)}))
      .catch(() => undefined);
  }, []);
  return null;
}

function NotFound() {
  return (
    <Sections>
      <Stack gap="md">
        <Type role="display" as="h1">Page not found</Type>
        <Type role="body" as="p">This page has moved or never existed.</Type>
        <Link href="/menu">See the menu</Link>
      </Stack>
    </Sections>
  );
}

/** The theme and the site's links sit around every page, an error raised by the root itself included. */
function Shell({children}: {children: ReactNode}) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Theme theme={themes[defaultThemeSlug]} mode={themeModes[defaultThemeSlug]}>
          <LinkProvider component={StoreLink}>{children}</LinkProvider>
        </Theme>
        <Scripts />
      </body>
    </html>
  );
}
