import {describe, expect, it} from 'vitest';
import type {Alert} from '../ops/alert.server';
import type {OrderStatus} from '../orders/model';
import type {OrderRow} from '../orders/repo.server';
import {CourierError, type BookingRequest, type Courier, type Tracking} from './courier';
import {book, collectAt, refresh, sweep, type DispatchDeps} from './dispatch';
import type {DeliveryRow} from './repo.server';
import type {DeliveryState} from './model';

const NOW = new Date('2026-11-25T02:00:00.000Z');
const minutesFromNow = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();

function order(status: OrderStatus, pickupAt: string): OrderRow {
  return {
    id: 'order-1', status, pickupAt,
    customer: {name: 'Aisyah Rahman', phone: '+60123456789', email: 'a@example.com', note: ''},
    totalSen: 5000, purchaseId: 'p', createdAt: NOW.toISOString(), paidAt: NOW.toISOString(), posRecordedAt: null, arrivedAt: null, items: [], delivery: null,
  };
}

function delivery(state: DeliveryState, extra: Partial<DeliveryRow> = {}): DeliveryRow {
  return {
    orderId: 'order-1', dropOff: {address: 'Setia Alam', unit: 'No. 12', note: 'Blue gate', place: {lat: 3.13, lng: 101.51}}, distanceM: 6000, feeSen: 1200,
    state, attempts: 0, courierOrderId: null, shareLink: null, driver: null, costSen: null, problem: null, bookedAt: null, ...extra,
  };
}

/** The deps over one order and its delivery, held in memory, with a courier that answers as told. */
function world(start: {order: OrderRow; delivery: DeliveryRow}, courier: Partial<Courier> = {}) {
  const state = {order: start.order, delivery: start.delivery, alerts: [] as Alert[], notified: 0, booked: [] as BookingRequest[], refunded: false, failWrite: false};
  const deps: DispatchDeps = {
    deliveries: {
      get: async () => state.delivery,
      byCourierOrder: async () => state.delivery,
      async claim(_id, _now, byHand) {
        const from: DeliveryState[] = byHand ? ['waiting', 'failed', 'stuck'] : ['waiting', 'failed'];
        if (!from.includes(state.delivery.state) || (!byHand && state.delivery.attempts >= 3)) return null;
        state.delivery = {...state.delivery, state: 'booking', attempts: state.delivery.attempts + 1, courierOrderId: null};
        return state.delivery.attempts;
      },
      async booked(_id, booking, to) {
        if (state.failWrite) throw new Error('D1 is unavailable');
        if (state.delivery.state !== 'booking') return;
        state.delivery = {...state.delivery, state: to, courierOrderId: booking.courierOrderId, costSen: booking.costSen};
      },
      async release(_id, to, problem) {
        state.delivery = {...state.delivery, state: to, problem};
      },
      async track(_id, from, to, tracking, problem) {
        if (state.delivery.state !== from) return false;
        state.delivery = {...state.delivery, state: to, driver: tracking.driver, problem};
        return true;
      },
      async move(_id, from, to, problem) {
        if (state.delivery.state !== from) return false;
        state.delivery = {...state.delivery, state: to, problem};
        return true;
      },
      due: async () => (['waiting', 'failed'].includes(state.delivery.state) ? [state.delivery.orderId] : []),
      live: async () => (['finding_rider', 'rider_assigned', 'on_the_way'].includes(state.delivery.state) ? [state.delivery] : []),
      lapsedClaims: async () => [],
      ofRefunded: async () => {
        const {state: at, problem} = state.delivery;
        const open = ['waiting', 'failed', 'stuck'].includes(at) || (['finding_rider', 'rider_assigned'].includes(at) && problem === null);
        return state.refunded && open ? [state.delivery] : [];
      },
    },
    orders: {
      get: async () => state.order,
      async move(_id, to) {
        const moves: Partial<Record<OrderStatus, OrderStatus[]>> = {accepted: ['paid'], ready: ['accepted'], collected: ['ready']};
        if (!moves[to]?.includes(state.order.status)) return false;
        state.order = {...state.order, status: to};
        return true;
      },
    },
    courier: {
      quote: async () => ({feeSen: 1200, distanceM: 6000}),
      async book(request) {
        state.booked.push(request);
        return {courierOrderId: `L${state.booked.length}`, shareLink: null, costSen: 1200, status: 'finding_rider'};
      },
      track: async (): Promise<Tracking> => ({status: 'finding_rider', shareLink: null, driver: null}),
      cancel: async () => true,
      confirm: async () => null,
      ...courier,
    },
    area: {from: {lat: 3.07, lng: 101.51}, radiusKm: 10, service: 'MOTORCYCLE', minutesPerKm: 3, handoverMinutes: 10},
    shop: {name: 'Cake Jalan Tiung', phone: '+60128787258', address: '9, Jln Sukun 4/7'},
    alert: async (alert) => void state.alerts.push(alert),
    notify: () => void state.notified++,
    now: NOW,
  };
  return {state, deps};
}

describe('booking a rider', () => {
  it('waits until collection is within half an hour', async () => {
    const {state, deps} = world({order: order('paid', minutesFromNow(90)), delivery: delivery('waiting')});
    expect(await book('order-1', deps)).toBeNull();
    expect(state.booked).toHaveLength(0);
  });

  it('books a due order for its collection time, with the door and the code for the rider', async () => {
    const {state, deps} = world({order: order('accepted', minutesFromNow(25)), delivery: delivery('waiting')});
    expect(await book('order-1', deps)).toBe('finding_rider');
    expect(state.delivery).toMatchObject({state: 'finding_rider', courierOrderId: 'L1', attempts: 1});
    const [request] = state.booked;
    expect(request.at?.toISOString()).toBe(minutesFromNow(25));
    expect(request.remarks).toBe('No. 12\nBlue gate\nCake Jalan Tiung order ORDER-');
    expect(request.recipient).toEqual({name: 'Aisyah Rahman', phone: '+60123456789'});
  });

  it('books as soon as possible when collection is close or past', () => {
    expect(collectAt(minutesFromNow(5), NOW)).toBeNull();
    expect(collectAt(minutesFromNow(-30), NOW)).toBeNull();
  });

  it('books once, however many ask', async () => {
    const {state, deps} = world({order: order('paid', minutesFromNow(10)), delivery: delivery('waiting')});
    await Promise.all([book('order-1', deps), book('order-1', deps), book('order-1', deps)]);
    expect(state.booked).toHaveLength(1);
  });

  it('lets staff book early', async () => {
    const {state, deps} = world({order: order('ready', minutesFromNow(120)), delivery: delivery('waiting')});
    expect(await book('order-1', deps, {byHand: true})).toBe('finding_rider');
    expect(state.booked).toHaveLength(1);
  });

  it('hands a refusal to staff at once, and keeps a hiccup for the job', async () => {
    const refused = world({order: order('paid', minutesFromNow(10)), delivery: delivery('waiting')}, {book: async () => Promise.reject(new CourierError('The Lalamove wallet has too little credit.', 'refused'))});
    expect(await book('order-1', refused.deps)).toBe('stuck');
    expect(refused.state.delivery.problem).toMatch(/too little credit/);
    expect(refused.state.alerts[0].subject).toBe('Order ORDER- has no rider');

    const busy = world({order: order('paid', minutesFromNow(10)), delivery: delivery('waiting')}, {book: async () => Promise.reject(new CourierError('Lalamove could not be reached', 'retry'))});
    expect(await book('order-1', busy.deps)).toBe('failed');
    expect(busy.state.alerts).toHaveLength(0);
  });

  it('never books blind again after an answer that may have booked', async () => {
    const {state, deps} = world({order: order('paid', minutesFromNow(10)), delivery: delivery('waiting')}, {book: async () => Promise.reject(new CourierError('Lalamove may or may not have booked this ride: timed out', 'unsure'))});
    expect(await book('order-1', deps)).toBe('stuck');
    expect(state.delivery.problem).toMatch(/Partner Portal/);
    await sweep(deps);
    expect(state.booked).toHaveLength(0);
  });

  it('never books again when Lalamove took the ride but recording it failed', async () => {
    const {state, deps} = world({order: order('paid', minutesFromNow(10)), delivery: delivery('waiting')});
    state.failWrite = true;
    await expect(book('order-1', deps)).rejects.toThrow(/D1/);
    state.failWrite = false;
    expect(state.delivery.state).toBe('booking');
    await sweep(deps);
    expect(state.booked).toHaveLength(1);
  });

  it('ignores news of the last ride while the next is being booked', async () => {
    const {state, deps} = world(
      {order: order('accepted', minutesFromNow(10)), delivery: delivery('booking', {attempts: 2})},
      {track: async () => ({status: 'gave_up', shareLink: null, driver: null})},
    );
    await refresh({...state.delivery, courierOrderId: 'L0'}, deps);
    expect(state.delivery.state).toBe('booking');
    expect(state.booked).toHaveLength(0);
  });

  it('alerts when the ride cost more than the customer paid', async () => {
    const {state, deps} = world({order: order('paid', minutesFromNow(10)), delivery: delivery('waiting')}, {
      book: async () => ({courierOrderId: 'L1', shareLink: null, costSen: 1500, status: 'finding_rider'}),
    });
    await book('order-1', deps);
    expect(state.alerts.map((alert) => alert.key)).toEqual(['delivery-cost-above-fee']);
  });
});

describe('following a ride', () => {
  const rider = {name: 'Ahmad Faiz', phone: '+60111111111', plate: 'V**1234'};

  it('clears the kitchen board and emails the customer once the rider has it', async () => {
    const {state, deps} = world(
      {order: order('accepted', minutesFromNow(0)), delivery: delivery('rider_assigned', {courierOrderId: 'L1', attempts: 1})},
      {track: async () => ({status: 'picked_up', shareLink: 'https://share.example/1', driver: rider})},
    );
    await refresh(state.delivery, deps);
    expect(state.delivery.state).toBe('on_the_way');
    expect(state.order.status).toBe('collected');
    expect(state.notified).toBe(1);
  });

  it('books again when Lalamove gives up, while tries remain', async () => {
    const {state, deps} = world(
      {order: order('accepted', minutesFromNow(5)), delivery: delivery('finding_rider', {courierOrderId: 'L0', attempts: 1})},
      {track: async () => ({status: 'gave_up', shareLink: null, driver: null})},
    );
    await refresh(state.delivery, deps);
    expect(state.booked).toHaveLength(1);
    expect(state.delivery).toMatchObject({state: 'finding_rider', attempts: 2, courierOrderId: 'L1'});
  });

  it('asks staff when a ride is lost after it left the counter, and books nothing', async () => {
    const {state, deps} = world(
      {order: order('collected', minutesFromNow(-10)), delivery: delivery('on_the_way', {courierOrderId: 'L1', attempts: 1})},
      {track: async () => ({status: 'gave_up', shareLink: null, driver: null})},
    );
    await refresh(state.delivery, deps);
    expect(state.booked).toHaveLength(0);
    expect(state.delivery).toMatchObject({state: 'stuck', problem: 'Lalamove ended this ride without delivering it.'});
    expect(state.alerts[0].subject).toBe('Order ORDER-\'s ride ended without delivering it');
  });

  it('clears the board when the rider collects an order nobody accepted', async () => {
    const {state, deps} = world(
      {order: order('paid', minutesFromNow(0)), delivery: delivery('rider_assigned', {courierOrderId: 'L1', attempts: 1})},
      {track: async () => ({status: 'picked_up', shareLink: null, driver: null})},
    );
    await refresh(state.delivery, deps);
    expect(state.order.status).toBe('collected');
  });

  it('asks staff after the last try', async () => {
    const {state, deps} = world(
      {order: order('accepted', minutesFromNow(5)), delivery: delivery('finding_rider', {courierOrderId: 'L2', attempts: 3})},
      {track: async () => ({status: 'gave_up', shareLink: null, driver: null})},
    );
    await refresh(state.delivery, deps);
    expect(state.booked).toHaveLength(0);
    expect(state.delivery.state).toBe('stuck');
    expect(state.alerts[0].body).toMatch(/3 times/);
  });
});

describe('the 5-minute job', () => {
  it('cancels a refunded order’s ride', async () => {
    const {state, deps} = world({order: order('refunded', minutesFromNow(10)), delivery: delivery('finding_rider', {courierOrderId: 'L1', attempts: 1})});
    state.refunded = true;
    await sweep(deps);
    expect(state.delivery.state).toBe('cancelled');
  });

  it('lets a ride that can no longer be cancelled finish, and says so once', async () => {
    let cancels = 0;
    const {state, deps} = world({order: order('refunded', minutesFromNow(10)), delivery: delivery('rider_assigned', {courierOrderId: 'L1', attempts: 1})}, {
      cancel: async () => (cancels++, false),
      track: async () => ({status: 'picked_up', shareLink: null, driver: null}),
    });
    state.refunded = true;
    await sweep(deps);
    await sweep(deps);
    expect(state.delivery).toMatchObject({state: 'on_the_way', problem: 'Refunded, but Lalamove no longer lets this ride be cancelled.'});
    expect(cancels).toBe(1);
    expect(state.alerts[0].subject).toMatch(/could not be cancelled/);
  });
});
