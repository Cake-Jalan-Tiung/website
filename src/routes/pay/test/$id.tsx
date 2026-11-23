import {useState} from 'react';
import {createFileRoute, notFound} from '@tanstack/react-router';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {getTestPayment} from '../../../orders/functions';
import {formatRM} from '../../../orders/model';
import {Sections} from '../../../storefront/sections';
import {Row, Stack} from '../../../system/layout';
import {Type} from '../../../system/Type';

/**
 * The local test provider's payment page: no money moves. Its buttons post to the same
 * callback the real provider uses. The server returns no order unless PAYMENTS=fake.
 */
export const Route = createFileRoute('/pay/test/$id')({
  head: () => ({meta: [{title: 'Test payment'}, {name: 'robots', content: 'noindex'}]}),
  loader: async ({params}) => {
    const order = await getTestPayment({data: {id: params.id}});
    if (!order) throw notFound();
    return order;
  },
  component: function TestPayment() {
    const order = Route.useLoaderData();
    const [busy, setBusy] = useState(false);
    const settle = async (outcome: 'paid' | 'failed') => {
      setBusy(true);
      await fetch('/api/payments/callback', {method: 'POST', body: JSON.stringify({orderId: order.id, outcome})});
      window.location.assign(`/order/${order.id}`);
    };
    return (
      <Sections>
        <Stack gap="lg">
          <Banner status="warning" title="Test payment" description="This page stands in for the payment provider while the shop's CHIP keys are not set. No money moves." />
          <Type role="display" as="h1">{formatRM(order.totalSen)}</Type>
          <Row gap="sm">
            <Button variant="primary" size="lg" label="Pay" isLoading={busy} onClick={() => void settle('paid')} />
            <Button variant="secondary" size="lg" label="Cancel payment" isDisabled={busy} onClick={() => void settle('failed')} />
          </Row>
        </Stack>
      </Sections>
    );
  },
});
