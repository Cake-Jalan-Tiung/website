import type {ReactNode} from 'react';
import {HeadContent, Outlet, Scripts, createRootRoute} from '@tanstack/react-router';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '../index.css';
import {Theme} from '@astryxdesign/core/theme';
import {themes, defaultThemeSlug, themeModes} from '../astryx-themes';
import {Link} from '@astryxdesign/core/Link';
import {Stack} from '../system/layout';
import {Type} from '../system/Type';
import {Sections} from '../storefront/sections';
import {color} from '../system/tokens';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {charSet: 'utf-8'},
      {name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover'},
      {name: 'theme-color', content: color.paper},
      {title: 'Cake Jalan Tiung — Shah Alam'},
    ],
  }),
  shellComponent: Shell,
  notFoundComponent: NotFound,
  component: () => (
    <Theme theme={themes[defaultThemeSlug]} mode={themeModes[defaultThemeSlug]}>
      <Outlet />
    </Theme>
  ),
});

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

function Shell({children}: {children: ReactNode}) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
