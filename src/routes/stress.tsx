import {createFileRoute, notFound} from '@tanstack/react-router';
import {Stress} from '../specimen/Stress';

export const Route = createFileRoute('/stress')({
  // Dev only: production answers 404.
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  head: () => ({meta: [{name: 'robots', content: 'noindex'}, {title: 'Cake Jalan Tiung — Worst case'}]}),
  component: Stress,
});
