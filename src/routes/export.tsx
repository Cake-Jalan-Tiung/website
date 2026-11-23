import {createFileRoute, notFound} from '@tanstack/react-router';
import {Exports} from '../specimen/Applications';

export const Route = createFileRoute('/export')({
  // Dev only: production answers 404.
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  head: () => ({meta: [{name: 'robots', content: 'noindex'}, {title: 'Cake Jalan Tiung — Exports'}]}),
  component: Exports,
});
