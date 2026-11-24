import {useState} from 'react';
import {createFileRoute, notFound, useRouter} from '@tanstack/react-router';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {getTestRide} from '../../../orders/functions';
import {orderCode} from '../../../orders/model';
import {storefront} from '../../../site/content';
import {Sections, StoreHeader} from '../../../storefront/sections';
import {Page, Row, Stack} from '../../../system/layout';
import {Type} from '../../../system/Type';

const STEPS = [
  {status: 'rider_assigned', label: 'Rider found'},
  {status: 'picked_up', label: 'Picked up'},
  {status: 'completed', label: 'Delivered'},
  {status: 'gave_up', label: 'No rider'},
] as const;

/**
 * The stand-in courier's controls: no rider moves. Each button posts the event Lalamove would
 * send to the same webhook. The server returns no ride unless DELIVERY=fake.
 */
export const Route = createFileRoute('/deliver/test/$id')({
  head: () => ({meta: [{title: 'Test ride'}, {name: 'robots', content: 'noindex'}]}),
  loader: async ({params}) => {
    const ride = await getTestRide({data: {id: params.id}});
    if (!ride) throw notFound();
    return ride;
  },
  component: function TestRide() {
    const ride = Route.useLoaderData();
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const send = async (status: string) => {
      setBusy(true);
      await fetch('/api/delivery/callback', {method: 'POST', body: JSON.stringify({courierOrderId: ride.courierOrderId, status})});
      await router.navigate({href: `/order/${ride.orderId}`});
    };
    return (
      <Page top={<StoreHeader store={storefront} mode="focus" />}>
        <Sections>
          <Stack gap="lg">
            <Banner status="warning" title="Test ride" description="This page stands in for Lalamove while the shop's keys are not set. No rider moves." />
            <Type role="display" as="h1">Order {orderCode(ride.orderId)}</Type>
            <Row gap="sm">
              {STEPS.map((step) => (
                <Button key={step.status} variant="secondary" size="lg" label={step.label} isDisabled={busy} onClick={() => void send(step.status)} />
              ))}
            </Row>
          </Stack>
        </Sections>
      </Page>
    );
  },
});
