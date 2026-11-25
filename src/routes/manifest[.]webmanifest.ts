import {createFileRoute} from '@tanstack/react-router';
import {storefront} from '../site/content';
import {webManifest} from '../storefront/manifest';

export const Route = createFileRoute('/manifest.webmanifest')({
  server: {
    handlers: {
      GET: () =>
        new Response(JSON.stringify(webManifest(storefront)), {
          headers: {'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600'},
        }),
    },
  },
});
