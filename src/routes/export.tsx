import {createFileRoute} from '@tanstack/react-router';
import {Exports} from '../specimen/Applications';

export const Route = createFileRoute('/export')({
  head: () => ({meta: [{name: 'robots', content: 'noindex'}, {title: 'Cake Jalan Tiung — Exports'}]}),
  component: Exports,
});
