// A stand-in courier for local work without Lalamove keys. It prices a ride by straight-line
// distance at made-up rates, and its rides move only when someone presses a button on
// /deliver/test/<order>, which posts an unsigned event to the same webhook Lalamove uses, so the
// local flow runs the real path. Selected only when DELIVERY=fake, which needs PAYMENTS=fake.
import {isRecord, textAt} from '../lib/guards';
import type {Courier, Driver, Tracking} from './courier';
import {metresBetween, type CourierStatus} from './model';

const STATUSES: readonly CourierStatus[] = ['finding_rider', 'rider_assigned', 'picked_up', 'completed', 'gave_up'];
const TEST_DRIVER: Driver = {name: 'Test Rider', phone: '+60120000000', plate: 'TEST 1'};

/** Made-up rates: RM 5 to start, RM 1.20 a kilometre, rounded up to 10 sen. Only ever shown on a local build. */
const feeFor = (metres: number) => Math.ceil((500 + (metres / 1000) * 120) / 10) * 10;

const rides = new Map<string, {reference: string; tracking: Tracking}>();
export const fakeRideFor = (reference: string) => [...rides.entries()].find(([, ride]) => ride.reference === reference)?.[0] ?? null;

export const fakeCourier: Courier = {
  async quote(from, to) {
    const distanceM = metresBetween(from.place, to.place);
    return {feeSen: feeFor(distanceM), distanceM};
  },
  async book(request) {
    const courierOrderId = `test_${request.reference}_${rides.size + 1}`;
    rides.set(courierOrderId, {reference: request.reference, tracking: {status: 'finding_rider', shareLink: null, driver: null}});
    return {courierOrderId, shareLink: null, costSen: feeFor(metresBetween(request.from.place, request.to.place)), status: 'finding_rider'};
  },
  async track(courierOrderId) {
    return rides.get(courierOrderId)?.tracking ?? {status: 'finding_rider', shareLink: null, driver: null};
  },
  async cancel(courierOrderId) {
    const ride = rides.get(courierOrderId);
    if (ride?.tracking.status === 'picked_up' || ride?.tracking.status === 'completed') return false;
    if (ride) ride.tracking = {status: 'gave_up', shareLink: null, driver: null};
    return true;
  },
  async confirm(rawBody) {
    let event: unknown;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return null;
    }
    const courierOrderId = textAt(event, 'courierOrderId');
    const status = STATUSES.find((s) => isRecord(event) && s === event.status);
    const ride = rides.get(courierOrderId);
    if (!ride || !status) return null;
    const hasDriver = status === 'rider_assigned' || status === 'picked_up' || status === 'completed';
    ride.tracking = {status, shareLink: null, driver: hasDriver ? TEST_DRIVER : null};
    return courierOrderId;
  },
};
