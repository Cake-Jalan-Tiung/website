import {createFileRoute} from '@tanstack/react-router';
import {pathOnSite} from '../lib/canonical';
import {OfflinePage} from '../storefront/error';

export const Route = createFileRoute('/offline')({
  validateSearch: (search: Record<string, unknown>): {from?: string} => (typeof search.from === 'string' ? {from: search.from} : {}),
  head: () => ({meta: [{title: 'Offline — Cake Jalan Tiung'}, {name: 'robots', content: 'noindex'}]}),
  component: function OfflineRoute() {
    return <OfflinePage from={pathOnSite(Route.useSearch().from)} />;
  },
});
