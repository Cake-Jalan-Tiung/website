// What an order is, independent of storage and payment: a priced cart, who collects it and
// when, and a status that only moves forward. Money is integer sen everywhere.
import {dishIndex, type Storefront} from '../storefront/model';
import {toMinutes, type Span} from '../storefront/hours';
import type {PaymentState} from '../payments/provider';
import {textAt} from '../lib/guards';

export type CartLine = {dishId: string; quantity: number};
export const MAX_QUANTITY = 20;

/**
 * How long an order waits for payment before it expires. Shorter than the pick-up lead time,
 * so an order paid at the last moment still reaches the kitchen before its pick-up time.
 */
export const PAYMENT_WINDOW_MINUTES = 15;
export const paymentDueAt = (createdAt: string) => new Date(Date.parse(createdAt) + PAYMENT_WINDOW_MINUTES * 60_000);

export type PricedLine = {dishId: string; name: string; unitSen: number; quantity: number};
export type PricedCart = {lines: PricedLine[]; totalSen: number};

export class CartError extends Error {}

/** 5450 → "RM 54.50": checkout, receipts and the kitchen always show the currency and two decimals. */
export const formatRM = (sen: number) => `RM ${(sen / 100).toFixed(2)}`;

/**
 * Prices a cart from the catalogue. The browser only says which dishes and how many, so a
 * tampered price cannot reach an order. Throws on anything that is not a real, sane cart.
 * Catalogue prices are in ringgit as the platform lists them; this is where they become sen.
 */
export function priceCart(store: Storefront, cart: readonly CartLine[]): PricedCart {
  if (cart.length === 0) throw new CartError('The bag is empty.');
  const seen = new Set<string>();
  const lines = cart.map(({dishId, quantity}) => {
    const dish = dishIndex(store).get(dishId);
    if (!dish) throw new CartError('Something in the bag is no longer on the menu.');
    if (seen.has(dishId)) throw new CartError('A dish appears twice in the bag.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) throw new CartError(`Quantities run from 1 to ${MAX_QUANTITY}.`);
    seen.add(dishId);
    return {dishId, name: dish.name, unitSen: Math.round(dish.price * 100), quantity};
  });
  return {lines, totalSen: lines.reduce((sum, line) => sum + line.unitSen * line.quantity, 0)};
}

/** When every dish in the cart can be collected, and which categories limit it; undefined when none do. */
export function servingWindow(store: Storefront, cart: readonly CartLine[]): {span: Span; categories: string[]} | undefined {
  const ids = new Set(cart.map((line) => line.dishId));
  const limiting = store.categories.flatMap((category) =>
    category.servedBetween && category.dishes.some((dish) => ids.has(dish.id)) ? [{name: category.name, span: category.servedBetween}] : [],
  );
  if (limiting.length === 0) return undefined;
  const later = (a: Span[0], b: Span[0]) => (toMinutes(a) >= toMinutes(b) ? a : b);
  const sooner = (a: Span[1], b: Span[1]) => (toMinutes(a) <= toMinutes(b) ? a : b);
  return {
    span: limiting.map((c) => c.span).reduce((a, b): Span => [later(a[0], b[0]), sooner(a[1], b[1])]),
    categories: limiting.map((c) => c.name),
  };
}

// Statuses ------------------------------------------------------------------------------------

/**
 * Every status, in one table: where it can move, what the customer reads, and, while the
 * kitchen is working on it, its column and the one action that moves it on. Everything else
 * about statuses (the SQL for the board, the customer's progress bar) is derived from here.
 */
const STATUSES = {
  awaiting_payment: {
    moves: ['paid', 'expired', 'cancelled'],
    customer: {title: 'Waiting for payment', line: 'Finish paying and this page updates by itself.'},
  },
  paid: {
    moves: ['accepted', 'refunded'],
    customer: {title: 'Order received', line: 'Paid. The kitchen will confirm it in a moment.', step: 'Paid'},
    kitchen: {column: 'New', next: {to: 'accepted', label: 'Accept'}},
  },
  accepted: {
    moves: ['ready', 'refunded'],
    customer: {title: 'Being prepared', line: 'The kitchen has your order.', step: 'Preparing'},
    kitchen: {column: 'Preparing', next: {to: 'ready', label: 'Mark ready'}},
  },
  ready: {
    moves: ['collected', 'refunded'],
    customer: {title: 'Ready to collect', line: 'Come to the counter and give your name.', step: 'Ready'},
    kitchen: {column: 'Ready to collect', next: {to: 'collected', label: 'Collected'}},
  },
  collected: {moves: [], customer: {title: 'Collected', line: 'Enjoy. Thank you for ordering.', step: 'Collected'}},
  // Money can still arrive after an order expired or a payment attempt failed (the customer
  // retried, or a callback was late); money that arrives is always honoured.
  expired: {moves: ['paid'], customer: {title: 'Payment not received', line: 'This order expired before it was paid. Nothing was charged.'}},
  cancelled: {moves: ['paid'], customer: {title: 'Cancelled', line: 'This order was cancelled. Nothing was charged.'}},
  refunded: {moves: [], customer: {title: 'Refunded', line: 'This order was refunded to your payment method.'}},
} as const satisfies Record<string, StatusInfo>;

type StatusInfo = {
  moves: readonly string[];
  customer: {title: string; line: string; step?: string};
  kitchen?: {column: string; next: {to: string; label: string}};
};

export type OrderStatus = keyof typeof STATUSES;
export const ORDER_STATUSES = Object.keys(STATUSES).filter((key): key is OrderStatus => key in STATUSES);
const info = (status: OrderStatus): StatusInfo => STATUSES[status];

export const canMove = (from: OrderStatus, to: OrderStatus) => info(from).moves.includes(to);
export const allowedFrom = (to: OrderStatus) => ORDER_STATUSES.filter((from) => canMove(from, to));
export const customerCopy = (status: OrderStatus) => info(status).customer;
export const isFinished = (status: OrderStatus) => info(status).moves.length === 0;
/** Expired or cancelled: nothing is expected to happen, though a late payment still could. */
export const isDormant = (status: OrderStatus) => status === 'expired' || status === 'cancelled';

/** The customer's progress bar: statuses with a step, in order. */
export const CUSTOMER_STEPS = ORDER_STATUSES.flatMap((status) => {
  const step = info(status).customer.step;
  return step ? [{status, label: step}] : [];
});

/** The kitchen board's columns, in order, each with the action that moves an order on. */
export const KITCHEN_COLUMNS = ORDER_STATUSES.flatMap((status) => {
  const kitchen = info(status).kitchen;
  const to = kitchen && ORDER_STATUSES.find((s) => s === kitchen.next.to);
  return kitchen && to ? [{status, title: kitchen.column, next: {to, label: kitchen.next.label}}] : [];
});
export const KITCHEN_STATUSES = KITCHEN_COLUMNS.map((column) => column.status);
export const kitchenNext = (status: OrderStatus) => KITCHEN_COLUMNS.find((column) => column.status === status)?.next;

/** What a payment provider's state means for an order; null when it changes nothing. */
export function statusForPayment(state: PaymentState): OrderStatus | null {
  if (state === 'paid') return 'paid';
  if (state === 'refunded') return 'refunded';
  if (state === 'expired') return 'expired';
  if (state === 'failed') return 'cancelled';
  return null;
}

// Customers ----------------------------------------------------------------------------------

export type Customer = {name: string; phone: string; email: string; note: string};

/** Parses who is collecting, from untrusted input. Phone numbers come back as +60…. */
export function parseCustomer(input: unknown): Customer {
  const name = textAt(input, 'name').trim();
  if (name.length < 1 || name.length > 60) throw new CartError('Add the name to call at the counter.');
  const digits = textAt(input, 'phone').trim().replace(/[\s\-()]/g, '');
  const local = digits.startsWith('+60') ? digits.slice(3) : digits.startsWith('60') ? digits.slice(2) : digits.replace(/^0/, '');
  if (!/^1\d{8,9}$/.test(local)) throw new CartError('Add a Malaysian mobile number, like 012-345 6789.');
  const email = textAt(input, 'email').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new CartError('Add an email for the receipt.');
  const note = textAt(input, 'note').trim().slice(0, 280);
  return {name, phone: `+60${local}`, email, note};
}
