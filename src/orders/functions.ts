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
import {CartError, KITCHEN_STATUSES, TEST_DISH, kitchenNext, orderCode, orderableDish, parseCustomer, paymentDueAt, priceCart, servingWindow, awaitsMoney, statusAfterAsking, type CartLine, type OrderStatus, type PricedCart, type PricedLine} from './model';
import {isOpenSlot, pickupSlots, type Slot} from './pickup';
import {closuresRepo, ordersRepo, staffAttempts, type OrderRow} from './repo.server';
import {notifyLater} from './notify.server';
import {DELIVERY_SUBJECT, ORDERS_SUBJECT, assertAvailable, availabilityFrom, closureEnds, dishSubject, parseCloseFor, type Availability} from './availability';
import {STAFF_COOKIE, STAFF_SESSION_DAYS, isStaffToken, issueStaffToken, sameSecret} from './staff-session.server';
import {posStuckBefore, posState, posSyncOn, type PosBacklog, type PosState} from '../pos/status';
import {deliverySetup, type Delivery} from '../delivery/select.server';
import {readQuote, signQuote} from '../delivery/quote-token.server';
import {dispatchDeps, dispatchLater} from '../delivery/dispatch.server';
import {book} from '../delivery/dispatch';
import {CourierError} from '../delivery/courier';
import {STALE_FEE, arrivesAt, canBookByHand, formatDistance, isInArea, metresBetween, parseDropOff, parsePlace, staffLine, type DeliveryState, type Place} from '../delivery/model';
import type {DeliveryRow} from '../delivery/repo.server';

const repo = () => ordersRepo(env.DB, env.SHOP_ID);
const closures = () => closuresRepo(env.DB, env.SHOP_ID);
const delivery = () => deliverySetup(env, storefront);
const readAvailability = async (now: Date) => availabilityFrom(await closures().all(), now, delivery() !== null);
const provider = () => paymentProvider(env);
/** The browser's Google Maps key, public by design (restricted to the shop's domains). */
const mapsKey = () => textAt(env, 'GOOGLE_MAPS_KEY');

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

/** How the browser finds addresses: Google's map and search, or a stand-in list on a local build. */
export type Maps = {provider: 'google'; key: string} | {provider: 'fake'};

/**
 * What checkout needs to offer delivery: the shop's door and the ride estimate (for arrival
 * times), how far it goes, and the map. `paused` is staff stopping delivery for now.
 */
export type DeliveryOffer = {from: Place; radiusKm: number; minutesPerKm: number; handoverMinutes: number; maps: Maps; paused: boolean};

export type CheckoutOptions = {cart: PricedCart; slots: Slot[]; methods: PaymentMethod[]; window: ReturnType<typeof servingWindow> | null; delivery: DeliveryOffer | null};

/** Delivery as this deploy offers it, or null: a live courier also needs a map to find addresses with. */
function deliveryOffer(setup: Delivery | null, availability: Availability): DeliveryOffer | null {
  if (!setup) return null;
  // A live courier is only set up with a key (select.server.ts); the stand-in may run without one.
  const key = mapsKey();
  const {from, radiusKm, minutesPerKm, handoverMinutes} = setup.area;
  return {from, radiusKm, minutesPerKm, handoverMinutes, maps: key ? {provider: 'google', key} : {provider: 'fake'}, paused: availability.deliveryPaused !== null};
}

/** What the checkout can offer for this bag: its real prices, open pick-up times and ways to pay. */
export const getCheckoutOptions = createServerFn({method: 'POST'})
  .validator((input: unknown) => parseCart(isRecord(input) ? input.cart : undefined))
  .handler(async ({data: cart}): Promise<Result<CheckoutOptions>> => {
    try {
      const priced = priceCart(storefront, cart, {allowTest: await isStaff()});
      const availability = await readAvailability(new Date());
      assertAvailable(storefront, cart, availability);
      const window = servingWindow(storefront, cart);
      return {
        ok: true,
        cart: priced,
        slots: pickupSlots(storefront, new Date(), window?.span),
        methods: await provider().methods(priced.totalSen),
        window: window ?? null,
        // The staff test item is a payment check, never a ride.
        delivery: cart.some((line) => line.dishId === TEST_DISH.id) ? null : deliveryOffer(delivery(), availability),
      };
    } catch (error) {
      return failure(error, 'load');
    }
  });

export type DeliveryQuote = {feeSen: number; distanceM: number; token: string};

/**
 * What delivery to this point costs, from the courier, with a token that holds the price until
 * the order is placed. Refused outside the area, before the courier is asked.
 */
export const quoteDelivery = createServerFn({method: 'POST'})
  .validator((input: unknown) => ({place: parsePlace(isRecord(input) ? input.place : null), address: textAt(input, 'address').trim().slice(0, 200)}))
  .handler(async ({data}): Promise<Result<DeliveryQuote>> => {
    const setup = delivery();
    if (!setup || !data.place || !data.address) return {ok: false, message: 'Delivery isn’t available right now. Choose Pick-up.', canRetry: false};
    const {area} = setup;
    if (!isInArea(area, area.from, data.place)) {
      return {ok: false, canRetry: false, message: `We deliver up to ${area.radiusKm} km from the shop, and this address is ${formatDistance(metresBetween(area.from, data.place))} away. Choose Pick-up, or another address.`};
    }
    try {
      const quoted = await setup.courier.quote({place: area.from, address: storefront.address.join(', ')}, {place: data.place, address: data.address}, area.service);
      return {ok: true, ...quoted, token: await signQuote(env.SESSION_SECRET, data.place, quoted, new Date())};
    } catch (error) {
      if (error instanceof CourierError && error.kind === 'refused') {
        console.error(error);
        return {ok: false, canRetry: false, message: 'Our rider service can’t reach this address. Choose Pick-up, or another address.'};
      }
      alertLater({
        key: 'delivery-quote',
        subject: 'Delivery could not be priced for a customer',
        body: `Pricing a delivery at checkout failed: ${String(error)}\n\nCustomers can still choose pick-up. If this repeats, check Lalamove's status and the API keys.`,
      });
      return {ok: false, canRetry: true, message: 'Couldn’t price delivery just now. Try again, or choose Pick-up.'};
    }
  });

/** Places the order and opens payment. The order exists, unpaid, before the provider is asked. */
export const placeOrder = createServerFn({method: 'POST'})
  .validator((input: unknown) => ({
    cart: parseCart(isRecord(input) ? input.cart : undefined),
    customer: isRecord(input) ? input.customer : undefined,
    pickupAt: textAt(input, 'pickupAt'),
    method: textAt(input, 'method'),
    /** Absent for pick-up; else where to and the quote's token. */
    delivery: isRecord(input) && isRecord(input.delivery) ? {dropOff: input.delivery.dropOff, token: textAt(input.delivery, 'token')} : null,
  }))
  .handler(async ({data}): Promise<Result<{orderId: string; redirectUrl: string}>> => {
    try {
      const now = new Date();
      const payments = provider();
      const cart = priceCart(storefront, data.cart, {allowTest: await isStaff()});
      assertAvailable(storefront, data.cart, await readAvailability(now));
      const customer = parseCustomer(data.customer);
      if (!isOpenSlot(storefront, now, data.pickupAt, servingWindow(storefront, data.cart)?.span)) {
        throw new CartError(data.delivery ? 'That delivery time has just gone. Choose another.' : 'That pick-up time has just gone. Choose another.');
      }
      const ride = data.delivery ? await deliveryFor(data.delivery, data.cart, now) : undefined;
      const lines = ride ? [...cart.lines, {dishId: 'delivery', name: 'Delivery', unitSen: ride.feeSen, quantity: 1}] : cart.lines;
      const totalSen = cart.totalSen + (ride?.feeSen ?? 0);
      if (!(await payments.methods(totalSen)).some((method) => method.id === data.method)) throw new CartError('Choose a way to pay.');

      const id = crypto.randomUUID();
      const orders = repo();
      await orders.create({id, cart, customer, pickupAt: data.pickupAt, paymentMethod: data.method, now, delivery: ride});
      const origin = new URL(getRequest().url).origin;
      const checkout = await payments
        .createCheckout({
          orderId: id,
          lines,
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
      return {ok: true, orderId: id, redirectUrl: checkout.redirectUrl};
    } catch (error) {
      return failure(error, 'pay');
    }
  });

/** Checks a delivery as the order is placed: offered and not paused, inside the area, at the fee the customer was shown. */
async function deliveryFor(input: {dropOff: unknown; token: string}, cart: CartLine[], now: Date) {
  const setup = delivery();
  if (!setup || cart.some((line) => line.dishId === TEST_DISH.id)) throw new CartError('Delivery isn’t available right now. Choose Pick-up.');
  if ((await readAvailability(now)).deliveryPaused) throw new CartError('Delivery is paused for now. Choose Pick-up, or try again later.');
  const dropOff = parseDropOff(input.dropOff, (message) => new CartError(message));
  if (!isInArea(setup.area, setup.area.from, dropOff.place)) throw new CartError(`We deliver up to ${setup.area.radiusKm} km from the shop. Choose Pick-up, or another address.`);
  const quoted = await readQuote(env.SESSION_SECRET, input.token, dropOff.place, now);
  if (!quoted) throw new CartError(STALE_FEE);
  return {dropOff, ...quoted};
}

/** Whether this deploy delivers at all: read once per visit, so pages render their delivery wording on the server. */
export const getDelivers = createServerFn({method: 'GET'}).handler(async (): Promise<boolean> => delivery() !== null);

/** What can be ordered right now: whether online ordering is paused, and which dishes are sold out. */
export const getAvailability = createServerFn({method: 'GET'}).handler(async (): Promise<Availability> => readAvailability(new Date()));

/** Staff close or open online ordering, or one dish. */
export const setAvailability = createServerFn({method: 'POST'})
  .validator((input: unknown) => {
    const dishId = textAt(input, 'dishId');
    const closeFor = textAt(input, 'closeFor');
    return {
      subject: dishId ? dishSubject(dishId) : textAt(input, 'what') === 'delivery' ? DELIVERY_SUBJECT : ORDERS_SUBJECT,
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
  /** Where it is going and how the ride stands; null for pick-up. */
  delivery: PublicDelivery | null;
};

/**
 * A delivery as anyone with the order's link may read it: the street, not the unit or the note;
 * the rider's name and the courier's live map, not phone numbers.
 */
export type PublicDelivery = {address: string; distanceM: number; feeSen: number; state: DeliveryState; arrivesAt: string; rider: string | null; trackUrl: string | null};

const toPublicDelivery = (delivery: DeliveryRow, pickupAt: string): PublicDelivery => {
  const area = storefront.deliveryArea;
  return {
    address: delivery.dropOff.address,
    distanceM: delivery.distanceM,
    feeSen: delivery.feeSen,
    state: delivery.state,
    arrivesAt: area ? arrivesAt(area, pickupAt, delivery.distanceM) : pickupAt,
    rider: delivery.driver ? delivery.driver.name.split(/\s+/)[0] : null,
    trackUrl: delivery.state === 'rider_assigned' || delivery.state === 'on_the_way' ? delivery.shareLink : null,
  };
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
  delivery: order.delivery ? toPublicDelivery(order.delivery, order.pickupAt) : null,
});

/**
 * One order, for its customer. While it waits for payment it asks the provider directly, so
 * the page is right even when a callback is late or lost, and expires once its due time has
 * passed without payment. An expired or cancelled one keeps asking for a few hours, as its page
 * promises, in case the money arrives late.
 */
export const getOrder = createServerFn({method: 'GET'})
  .validator(field('id'))
  .handler(async ({data: id}): Promise<PublicOrder | null> => {
    const orders = repo();
    const order = await orders.get(id);
    if (!order) return null;
    const now = new Date();
    if (!order.purchaseId || !awaitsMoney(order.status, order.createdAt, now)) return toPublic(order);
    let state: PaymentState;
    try {
      state = await provider().state(order.purchaseId);
    } catch (error) {
      // The provider is unreachable: show the order as stored; the next poll or the callback moves it.
      console.error(error);
      return toPublic(order);
    }
    const to = statusAfterAsking(order.status, state, order.createdAt, now);
    if (!to || !(await orders.move(id, to, now))) return toPublic(order);
    notifyLater(id);
    if (to === 'paid' && order.delivery) dispatchLater(id);
    return toPublic({...order, status: to});
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

/** The booking behind the stand-in courier's test page; null unless this deploy runs DELIVERY=fake. */
export const getTestRide = createServerFn({method: 'GET'})
  .validator(field('id'))
  .handler(async ({data: id}) => {
    if (delivery()?.kind !== 'fake') return null;
    const order = await repo().get(id);
    const courierOrderId = order?.delivery?.courierOrderId;
    return order && courierOrderId ? {orderId: order.id, courierOrderId} : null;
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

/** A delivery as the kitchen sees it: all of the address, the rider and what needs doing. */
export type StaffDelivery = {
  address: string;
  unit: string;
  note: string;
  distanceM: number;
  feeSen: number;
  state: DeliveryState;
  line: string;
  problem: string | null;
  rider: {name: string; phone: string; plate: string} | null;
  trackUrl: string | null;
  canBook: boolean;
};

const toStaffDelivery = (delivery: DeliveryRow): StaffDelivery => ({
  address: delivery.dropOff.address,
  unit: delivery.dropOff.unit,
  note: delivery.dropOff.note,
  distanceM: delivery.distanceM,
  feeSen: delivery.feeSen,
  state: delivery.state,
  line: staffLine(delivery.state),
  problem: delivery.problem,
  rider: delivery.driver,
  trackUrl: delivery.shareLink,
  canBook: canBookByHand(delivery.state),
});

/** `pos` is where the sale stands in StoreHub; null on a deploy that does not send sales there. */
export type StaffOrder = Omit<PublicOrder, 'delivery'> & {name: string; phone: string; note: string; pos: PosState | null; delivery: StaffDelivery | null};
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
      delivery: order.delivery ? toStaffDelivery(order.delivery) : null,
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
    if (!next || !(await orders.move(id, next.to, new Date()))) return {ok: false, message: 'This order has already moved on.'};
    notifyLater(id);
    return {ok: true};
  });

/** Staff book a rider now: early, again after Lalamove gave up, or after the job asked for them. */
export const bookRider = createServerFn({method: 'POST'})
  .validator(field('id'))
  .handler(async ({data: id}): Promise<Result<{state: DeliveryState}>> => {
    if (!(await isStaff())) return {ok: false, message: 'Signed out. Enter the PIN again.'};
    const deps = dispatchDeps(env, new Date());
    if (!deps) return {ok: false, message: 'This site has no rider service set up.'};
    const state = await book(id, deps, {byHand: true});
    if (state === null) return {ok: false, message: 'This order has a rider already, or is no longer one to deliver.'};
    if (state === 'stuck') return {ok: false, message: 'No rider booked. The reason is on the ticket.'};
    return {ok: true, state};
  });
