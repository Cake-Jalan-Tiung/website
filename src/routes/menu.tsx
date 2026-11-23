import {createFileRoute} from '@tanstack/react-router';
import {Menu} from '../site/Menu';

export const Route = createFileRoute('/menu')({
  head: () => ({meta: [{title: 'Menu — Cake Jalan Tiung, Shah Alam'}]}),
  component: Menu,
});
