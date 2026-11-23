// Server functions behind the bag, checkout, order page and staff screen. Each validates its
// input here, at the boundary; everything past it trusts the domain types.
import {createServerFn} from '@tanstack/react-start';
import {deleteCookie, getCookie, getRequest, getRequestHeader, setCookie} from '@tanstack/react-start/server';
import {env} from 'cloudflare:workers';
import {storefront} from '../site/content';
import {isRecord, textAt} from '../lib/guards';
import {startOfShopDay} from '../storefront/hours';
import {paymentProvider} from '../payments/select.server';
import {alertLater} from '../ops/alert.server';
import type {PaymentMethod, PaymentState} from '../payments/provider';
import {CartError, KITCHEN_STATUSES, kitchenNext, orderCode, orderableDish, parseCustomer, paymentDueAt, priceCart, servingWindow, settledStatus, type CartLine, type OrderStatus, type PricedCart, type PricedLine} from './model';
import {isOpenSlot, pickupSlots, type Slot} from './pickup';
import {closuresRepo, ordersRepo, staffAttempts, type OrderRow} from './repo.server';
import {ORDERS_SUBJECT, assertAvailable, availabilityFrom, closureEnds, dishSubject, parseCloseFor, type Availability} from './availability';
import {STAFF_COOKIE, STAFF_SESSION_DAYS, isStaffToken, issueStaffToken, sameSecret} from './staff-session.server';
import {posStuckBefore, posState, posSyncOn, type PosBacklog, type PosState} from '../pos/status';

const repo = () => ordersRepo(env.DB, env.SHOP_ID);
const closures = () => closuresRepo(env.DB, env.SHOP_ID);
const readAvailability = async (now: Date) => availabilityFrom(await closures().all(), now);
const provider = () => paymentProvider(env);

/** A validator that reads one string field. */
const field = (key: string) => (input: unknown) => textAt(input, key);

function parseCart(value: unknown): CartLine[] {
  if (!Array.isArray(value) || value.length > 50) throw new CartError('The bag could not be read.');
  return value.map((line) => {
    if (!isRecord(line) || typeof line.dishId !== 'string' || typeof line.quantity !== 'number') throw new CartError('The bag could not be read.');
    return {dishId: line.dishId, quantity: line.quantity};
  });
}

/** A refusal says whether trying again can help: a cart the shop cannot take stays refused until the bag changes. */
type Failure = {ok: false; message: string; canRetry?: boolean};
type Result<T> = ({ok: true} & T) | Failure;
/** What a customer reads when the shop failed on its side: what did not happen, and what to do. */
const FAILED = {
  load: `Checkout didn’t load. Try again, or order at the counter on ${storefront.phone.display}.`,
  pay: 'Payment didn’t open, and nothing was taken. Try again.',
} as const;
const failure = (error: unknown, during: keyof typeof FAILED): Failure => {
  if (error instanceof CartError) return {ok: false, message: error.message, canRetry: false};
  alertLater({
    key: 'checkout-error',
    subject: 'Checkout failed for a customer',
    body: `A customer saw "Something went wrong" at checkout: ${String(error)}\n\nIf this repeats, customers cannot order. Check the Worker's logs and whether CHIP is reachable.`,
  });
  return {ok: false, message: FAILED[during], canRetry: true};
};

export type CheckoutOptions = {cart: PricedCart; slots: Slot[]; methods: PaymentMethod[]; window: ReturnType<typeof servingWindow> | null};

/** What the checkout can offer for this bag: its real prices, open pick-up times and ways to pay. */
export const getCheckoutOptions = createServerFn({method: 'POST'})
  .validator((input: unknown) => parseCart(isRecord(input) ? input.cart : undefined))
  .handler(async ({data: cart}): Promise<Result<CheckoutOptions>> => {
    try {
      const priced = priceCart(storefront, cart, {allowTest: await isStaff()});
      assertAvailable(storefront, cart, await readAvailability(new Date()));
      const window = servingWindow(storefront, cart);
      return {
        ok: true,
        cart: priced,
        slots: pickupSlots(storefront, new Date(), window?.span),
        methods: await provider().methods(priced.totalSen),
        window: window ?? null,
      };
    } catch (error) {
      return failure(error, 'load');
    }
  });

/** Places the order and opens payment. The order exists, unpaid, before the provider is asked. */
export const placeOrder = createServerFn({method: 'POST'})
  .validator((input: unknown) => ({
    cart: parseCart(isRecord(input) ? input.cart : undefined),
    customer: isRecord(input) ? input.customer : undefined,
    pickupAt: textAt(input, 'pickupAt'),
    method: textAt(input, 'method'),
  }))
  .handler(async ({data}): Promise<Result<{redirectUrl: string}>> => {
    try {
      const now = new Date();
      const payments = provider();
      const cart = priceCart(storefront, data.cart, {allowTest: await isStaff()});
      assertAvailable(storefront, data.cart, await readAvailability(now));
      const customer = parseCustomer(data.customer);
      if (!isOpenSlot(storefront, now, data.pickupAt, servingWindow(storefront, data.cart)?.span)) {
        throw new CartError('That pick-up time has just gone. Choose another.');
      }
      if (!(await payments.methods(cart.totalSen)).some((method) => method.id === data.method)) throw new CartError('Choose a way to pay.');

      const id = crypto.randomUUID();
      const orders = repo();
      await orders.create({id, cart, customer, pickupAt: data.pickupAt, paymentMethod: data.method, now});
      const origin = new URL(getRequest().url).origin;
      const checkout = await payments
        .createCheckout({
          orderId: id,
          lines: cart.lines,
          customer,
          method: data.method,
          dueAt: paymentDueAt(now.toISOString()),
          returnUrl: `${origin}/order/${id}`,
          callbackUrl: `${origin}/api/payments/callback`,
        })
        .catch(async (error: unknown) => {
          // No purchase exists, so this order can never be paid; close it rather than leave it waiting.
          await orders.move(id, 'cancelled', new Date());
          throw error;
        });
      await orders.attachPurchase(id, checkout.purchaseId);
      return {ok: true, redirectUrl: checkout.redirectUrl};
    } catch (error) {
      return failure(error, 'pay');
    }
  });

/** What can be ordered right now: whether online ordering is paused, and which dishes are sold out. */
export const getAvailability = createServerFn({method: 'GET'}).handler(async (): Promise<Availability> => readAvailability(new Date()));

/** Staff close or open online ordering, or one dish. */
export const setAvailability = createServerFn({method: 'POST'})
  .validator((input: unknown) => {
    const dishId = textAt(input, 'dishId');
    const closeFor = textAt(input, 'closeFor');
    return {
      subject: dishId ? dishSubject(dishId) : ORDERS_SUBJECT,
      dishId,
      closeFor: parseCloseFor(closeFor),
    };
  })
  .handler(async ({data}): Promise<Result<{availability: Availability}>> => {
    if (!(await isStaff())) return {ok: false, message: 'Signed out. Enter the PIN again.'};
    if (data.dishId && !orderableDish(storefront, data.dishId)) return {ok: false, message: 'That dish is not on the menu.'};
    const now = new Date();
    if (data.closeFor) await closures().close(data.subject, closureEnds(storefront, data.closeFor, now), now);
    else await closures().open(data.subject);
    return {ok: true, availability: await readAvailability(now)};
  });

export type PublicOrder = {
  id: string;
  code: string;
  status: OrderStatus;
  pickupAt: string;
  firstName: string;
  items: PricedLine[];
  totalSen: number;
  /** When the customer said they were at the shop. */
  arrivedAt: string | null;
};

const toPublic = (order: OrderRow): PublicOrder => ({
  id: order.id,
  code: orderCode(order.id),
  status: order.status,
  pickupAt: order.pickupAt,
  firstName: order.customer.name.split(/\s+/)[0],
  items: order.items,
  totalSen: order.totalSen,
  arrivedAt: order.arrivedAt,
});

/**
 * One order, for its customer. While it waits for payment it asks the provider directly, so
 * the page is right even when a callback is late or lost, and expires once its due time has
 * passed without payment.
 */
export const getOrder = createServerFn({method: 'GET'})
  .validator(field('id'))
  .handler(async ({data: id}): Promise<PublicOrder | null> => {
    const orders = repo();
    const order = await orders.get(id);
    if (!order) return null;
    if (order.status !== 'awaiting_payment' || !order.purchaseId) return toPublic(order);
    let state: PaymentState;
    try {
      state = await provider().state(order.purchaseId);
    } catch (error) {
      // The provider is unreachable: show the order as stored; the next poll or the callback moves it.
      console.error(error);
      return toPublic(order);
    }
    const now = new Date();
    const to = settledStatus(state, order.createdAt, now);
    if (to && (await orders.move(id, to, now))) return toPublic({...order, status: to});
    return toPublic(order);
  });

/**
 * "I'm here", from the order's page: the kitchen's board marks the order and rings. Whoever has
 * the order's link can say so, as they can read it; it changes nothing but this one mark.
 */
export const arriveForOrder = createServerFn({method: 'POST'})
  .validator(field('id'))
  .handler(async ({data: id}): Promise<PublicOrder | null> => {
    const orders = repo();
    await orders.arrive(id, new Date());
    const order = await orders.get(id);
    return order ? toPublic(order) : null;
  });

/** The order behind the local test provider's payment page; null unless this deploy runs PAYMENTS=fake. */
export const getTestPayment = createServerFn({method: 'GET'})
  .validator(field('id'))
  .handler(async ({data: id}) => {
    if (env.PAYMENTS !== 'fake') return null;
    const order = await repo().get(id);
    return order && order.status === 'awaiting_payment' ? {id: order.id, totalSen: order.totalSen} : null;
  });

// Staff ------------------------------------------------------------------------------------

const MAX_FAILURES = 10;
/** Across every address, so guessing from many IPs is slowed too. Signed-in tablets keep their session. */
const MAX_FAILURES_EVERYWHERE = 50;
const FAILURE_WINDOW_MINUTES = 15;

const isStaff = () => isStaffToken(env.SESSION_SECRET, env.STAFF_PIN, getCookie(STAFF_COOKIE), new Date());

export const staffLogin = createServerFn({method: 'POST'})
  .validator(field('pin'))
  .handler(async ({data: pin}): Promise<Result<object>> => {
    const now = new Date();
    const ip = getRequestHeader('CF-Connecting-IP') ?? 'local';
    const attempts = staffAttempts(env.DB);
    const windowStart = new Date(now.getTime() - FAILURE_WINDOW_MINUTES * 60_000);
    const [fromHere, everywhere] = await Promise.all([attempts.recentFailures(ip, windowStart), attempts.recentFailures(null, windowStart)]);
    if (fromHere >= MAX_FAILURES || everywhere >= MAX_FAILURES_EVERYWHERE) {
      return {ok: false, message: `Too many tries. Wait ${FAILURE_WINDOW_MINUTES} minutes.`};
    }
    if (!env.STAFF_PIN || env.STAFF_PIN.length < 6 || !(await sameSecret(pin, env.STAFF_PIN))) {
      await attempts.fail(ip, now, windowStart);
      return {ok: false, message: 'That PIN is not right.'};
    }
    setCookie(STAFF_COOKIE, await issueStaffToken(env.SESSION_SECRET, env.STAFF_PIN, now), {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: STAFF_SESSION_DAYS * 86_400,
    });
    return {ok: true};
  });

export const staffLogout = createServerFn({method: 'POST'}).handler(async () => {
  deleteCookie(STAFF_COOKIE, {path: '/'});
  return {ok: true};
});

/** `pos` is where the sale stands in StoreHub; null on a deploy that does not send sales there. */
export type StaffOrder = PublicOrder & {name: string; phone: string; note: string; pos: PosState | null};
/** `pos` counts what StoreHub is missing across every day, not only the board's; null when sales are not sent there. */
export type StaffBoardData = {orders: StaffOrder[]; pos: PosBacklog | null};

/**
 * A refund made in the provider's dashboard sends no callback, so orders on the board are
 * checked with the provider at most once a minute each (per isolate) and leave it once refunded.
 */
const REFUND_CHECK_MS = 60_000;
const refundCheckedAt = new Map<string, number>();

async function withoutRefunded(board: OrderRow[], now: Date): Promise<OrderRow[]> {
  const orders = repo();
  const onBoard = new Set(board.map((order) => order.id));
  for (const id of refundCheckedAt.keys()) if (!onBoard.has(id)) refundCheckedAt.delete(id);
  const kept = await Promise.all(
    board.map(async (order) => {
      const purchaseId = order.purchaseId;
      if (!purchaseId || !KITCHEN_STATUSES.includes(order.status)) return order;
      if (now.getTime() - (refundCheckedAt.get(order.id) ?? 0) < REFUND_CHECK_MS) return order;
      refundCheckedAt.set(order.id, now.getTime());
      try {
        if ((await provider().state(purchaseId)) === 'refunded' && (await orders.move(order.id, 'refunded', now))) return null;
      } catch (error) {
        console.error(error);
      }
      return order;
    }),
  );
  return kept.filter((order): order is OrderRow => order !== null);
}

/**
 * The kitchen's board: orders to make, soonest pick-up first, those collected today, and how
 * web sales stand in StoreHub. Null when signed out.
 */
export const getStaffBoard = createServerFn({method: 'GET'}).handler(async (): Promise<StaffBoardData | null> => {
  if (!(await isStaff())) return null;
  const now = new Date();
  const syncOn = posSyncOn(env.PAYMENTS);
  const [board, backlog] = await Promise.all([
    repo().kitchen(startOfShopDay(storefront.timeZone, now)).then((orders) => withoutRefunded(orders, now)),
    syncOn ? repo().posBacklog(posStuckBefore(now)) : null,
  ]);
  return {
    orders: board.map((order) => ({
      ...toPublic(order),
      name: order.customer.name,
      phone: order.customer.phone,
      note: order.customer.note,
      pos: syncOn ? posState(order, now) : null,
    })),
    pos: backlog,
  };
});

export const advanceOrder = createServerFn({method: 'POST'})
  .validator(field('id'))
  .handler(async ({data: id}): Promise<Result<object>> => {
    if (!(await isStaff())) return {ok: false, message: 'Signed out. Enter the PIN again.'};
    const orders = repo();
    const order = await orders.get(id);
    const next = order && kitchenNext(order.status);
    if (next && (await orders.move(id, next.to, new Date()))) return {ok: true};
    return {ok: false, message: 'This order has already moved on.'};
  });
