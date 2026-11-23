// The customer's order after paying: where it is, when to come, what is in it. It follows the
// order by itself until it is finished.
import {useEffect, useState} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {Link} from '@astryxdesign/core/Link';
import {storefront} from '../site/content';
import {formatShopTime} from '../storefront/hours';
import {Sections, StoreHeader} from '../storefront/sections';
import {Page, Stack} from '../system/layout';
import {Type} from '../system/Type';
import {bag} from './bag';
import {OrderTotal} from './Checkout';
import {getOrder, type PublicOrder} from './functions';
import {CUSTOMER_STEPS, customerCopy, formatRM, isDormant, isFinished} from './model';
import s from './orders.module.css';

const POLL_MS = 4000;
/** Expired and cancelled orders are checked only now and then, for a late payment. */
const DORMANT_POLL_MS = 60_000;

export function OrderStatusPage({initial}: {initial: PublicOrder}) {
  const [order, setOrder] = useState(initial);

  useEffect(() => {
    if (isFinished(order.status)) return;
    const timer = window.setInterval(() => {
      getOrder({data: {id: order.id}}).then((next) => next && setOrder(next));
    }, isDormant(order.status) ? DORMANT_POLL_MS : POLL_MS);
    return () => window.clearInterval(timer);
  }, [order.id, order.status]);

  const reached = CUSTOMER_STEPS.findIndex((step) => step.status === order.status);
  const inKitchen = reached >= 0;
  // Once the money is in, the bag has done its job.
  useEffect(() => {
    if (inKitchen) bag.clear();
  }, [inKitchen]);

  const copy = customerCopy(order.status);

  return (
    <Page top={<StoreHeader store={storefront} />}>
      <Sections>
        <Stack gap="xl">
          <Stack gap="sm">
            <Type role="label" ink="secondary">
              Order <span className={s.code}>{order.code}</span> · {order.firstName}
            </Type>
            <Type role="display" as="h1" aria-live="polite">{copy.title}</Type>
            <Type role="body" as="p">{copy.line}</Type>
          </Stack>

          {inKitchen ? (
            <ol className={s.progress} aria-label="Progress">
              {CUSTOMER_STEPS.map((step, index) => (
                <li key={step.status} data-done={index <= reached ? '' : undefined} aria-current={index === reached ? 'step' : undefined}>
                  <Type role="caption">{step.label}</Type>
                </li>
              ))}
            </ol>
          ) : order.status !== 'refunded' ? (
            <Button variant="primary" size="lg" label="Back to checkout" href="/checkout" />
          ) : null}

          <Stack gap="sm">
            <Type role="subhead" as="h2">Pick-up</Type>
            <Type role="body">{formatShopTime(storefront.timeZone, order.pickupAt)}</Type>
            <Type role="body">{storefront.address.join(', ')}</Type>
            <Link href={storefront.mapHref} isExternalLink>Open in Google Maps</Link>
          </Stack>

          <Stack gap="sm">
            <Type role="subhead" as="h2">Your order</Type>
            <ul className={s.lines}>
              {order.items.map((item) => (
                <li key={item.dishId} className={s.line}>
                  <Type role="body">{item.quantity} × {item.name}</Type>
                  <Type role="body">{formatRM(item.unitSen * item.quantity)}</Type>
                </li>
              ))}
            </ul>
            <OrderTotal totalSen={order.totalSen} />
          </Stack>

          <Type role="caption" ink="secondary">
            Questions about this order? Call {storefront.phone.display} and give the code {order.code}.
          </Type>
        </Stack>
      </Sections>
    </Page>
  );
}
