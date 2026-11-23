import {createFileRoute} from '@tanstack/react-router';
import {getStaffBoard} from '../orders/functions';
import {StaffBoard} from '../orders/StaffBoard';

export const Route = createFileRoute('/staff')({
  head: () => ({meta: [{title: 'Kitchen — Cake Jalan Tiung'}, {name: 'robots', content: 'noindex'}]}),
  loader: () => getStaffBoard(),
  component: function StaffRoute() {
    return <StaffBoard initial={Route.useLoaderData()} />;
  },
});
