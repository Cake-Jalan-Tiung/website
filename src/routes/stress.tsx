import {createFileRoute} from '@tanstack/react-router';
import {Stress} from '../specimen/Stress';

export const Route = createFileRoute('/stress')({
  head: () => ({meta: [{name: 'robots', content: 'noindex'}, {title: 'Cake Jalan Tiung — Worst case'}]}),
  component: Stress,
});
