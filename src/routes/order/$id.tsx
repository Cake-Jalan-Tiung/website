import {createFileRoute, notFound} from '@tanstack/react-router';
import {getOrder} from '../../orders/functions';
import {OrderStatusPage} from '../../orders/OrderStatus';

export const Route = createFileRoute('/order/$id')({
  head: () => ({meta: [{title: 'Your order — Cake Jalan Tiung'}, {name: 'robots', content: 'noindex'}]}),
  loader: async ({params}) => {
    const order = await getOrder({data: {id: params.id}});
    if (!order) throw notFound();
    return order;
  },
  component: function OrderRoute() {
    return <OrderStatusPage initial={Route.useLoaderData()} />;
  },
});
