import {createFileRoute} from '@tanstack/react-router';
import {Checkout} from '../orders/Checkout';

export const Route = createFileRoute('/checkout')({
  head: () => ({meta: [{title: 'Checkout — Cake Jalan Tiung'}, {name: 'robots', content: 'noindex'}]}),
  component: Checkout,
});
