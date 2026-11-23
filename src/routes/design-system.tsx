import {createFileRoute} from '@tanstack/react-router';
import {DesignSystem} from '../specimen/DesignSystem';

export const Route = createFileRoute('/design-system')({
  head: () => ({meta: [{title: 'Cake Jalan Tiung — Design System'}]}),
  component: DesignSystem,
});
