// Where an order stands for its customer, for pick-up and delivery alike: the title and line they
// read, the progress bar and how far along it is, and whether anything more will happen. The order
// page, the last-order card and the emails all read it from here.
import {DELIVERY_COPY, DELIVERY_STEPS} from '../delivery/model';
import type {PublicOrder} from './functions';
import {CUSTOMER_STEPS, customerCopy, isFinished, type OrderStatus} from './model';

export type Journey = {
  title: string;
  line: string;
  steps: readonly string[];
  /** The step reached; -1 before the money is in, or after it went back. */
  reached: number;
  /** Nothing more will happen: collected, delivered or refunded. */
  finished: boolean;
};

type Trip = Pick<PublicOrder, 'status' | 'delivery'>;

const PICKUP_STEPS = CUSTOMER_STEPS.map((step) => step.label);

function pickup(status: OrderStatus): Journey {
  const copy = customerCopy(status);
  return {...copy, steps: PICKUP_STEPS, reached: CUSTOMER_STEPS.findIndex((step) => step.status === status), finished: isFinished(status)};
}

export function journey({status, delivery}: Trip): Journey {
  if (!delivery) return pickup(status);
  const at = (copy: {title: string; line: string}, reached: number, finished = false): Journey => ({...copy, steps: DELIVERY_STEPS, reached, finished});
  if (status === 'refunded' || delivery.state === 'cancelled') return at(customerCopy('refunded'), -1, true);
  if (delivery.state === 'delivered') return at(DELIVERY_COPY.delivered, 3, true);
  if (status === 'collected' && (delivery.state === 'stuck' || delivery.state === 'failed')) return at(DELIVERY_COPY.lost, 2);
  if (status === 'collected' || delivery.state === 'on_the_way') return at(DELIVERY_COPY.onTheWay, 2);
  const inKitchen = status === 'paid' || status === 'accepted' || status === 'ready';
  if (!inKitchen) return at(customerCopy(status), -1);
  const reached = status === 'paid' ? 0 : 1;
  if (delivery.state === 'stuck' || delivery.state === 'failed') return at(DELIVERY_COPY.noRider, reached);
  if (delivery.state === 'rider_assigned' && status !== 'paid') return at(DELIVERY_COPY.riderComing, reached);
  return at(status === 'paid' ? DELIVERY_COPY.paid : status === 'accepted' ? DELIVERY_COPY.accepted : DELIVERY_COPY.ready, reached);
}

/** Whether the order is still with the shop or the rider: what the last-order card follows. */
export const isUnderway = (trip: Trip) => {
  const {reached, finished} = journey(trip);
  return reached >= 0 && !finished;
};
