// What a delivery is, independent of the courier, the map and storage: where it goes, what the
// ride costs the customer, and where the courier's booking stands. The kitchen's side does not
// change: a delivery's `pickupAt` is when the rider collects it at the counter.
import {textAt} from '../lib/guards';

export type Place = {lat: number; lng: number};

/**
 * Where the customer wants it. `address` is the street address the map or the search found;
 * `unit` is what no map knows (house number, unit, floor); `note` is for the rider (a gate, a guard).
 */
export type DropOff = {address: string; unit: string; note: string; place: Place};

/** How the shop delivers: from where, how far, by which of the courier's services, and how long a ride takes. */
export type DeliveryArea = {
  /** The shop's door, where riders collect. Null until the shop has confirmed its pin: no delivery without it. */
  from: Place | null;
  radiusKm: number;
  /** The courier's service key, e.g. Lalamove's MOTORCYCLE. */
  service: string;
  /** A rider's time per kilometre in town, and the minutes to collect and set off: the arrival estimate's two terms. */
  minutesPerKm: number;
  handoverMinutes: number;
};

export const ADDRESS_MAX = 200;
/** What placing an order says when its delivery fee has expired or does not match: checkout prices again. */
export const STALE_FEE = 'The delivery fee needs checking again. Confirm your address, then pay.';
export const UNIT_MAX = 80;
export const NOTE_MAX = 200;

/** Metres between two points on the earth, as the crow flies. */
export function metresBetween(a: Place, b: Place): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.asin(Math.sqrt(h)));
}

/** 6240 → "6.2 km"; under a kilometre in metres. */
export const formatDistance = (metres: number) => (metres < 1000 ? `${Math.max(100, Math.round(metres / 100) * 100)} m` : `${(metres / 1000).toFixed(1)} km`);

/** Minutes from the counter to the door: the handover, then the ride. An estimate, said as "about". */
export const rideMinutes = (area: DeliveryArea, metres: number) => area.handoverMinutes + Math.ceil((metres / 1000) * area.minutesPerKm);

/** When a delivery collected at `pickupAt` should reach the door. */
export const arrivesAt = (area: DeliveryArea, pickupAt: string, metres: number) => new Date(Date.parse(pickupAt) + rideMinutes(area, metres) * 60_000).toISOString();

/** Whether a point is inside the area, by straight line from the shop. */
export const isInArea = (area: DeliveryArea, from: Place, to: Place) => metresBetween(from, to) <= area.radiusKm * 1000;

const isLatLng = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** A point from untrusted input; null when it is not one. Six decimals is about 10 cm. */
export function parsePlace(input: unknown): Place | null {
  const record = typeof input === 'object' && input !== null ? input : null;
  const lat = record && 'lat' in record ? Number(record.lat) : NaN;
  const lng = record && 'lng' in record ? Number(record.lng) : NaN;
  return isLatLng(lat, lng) ? {lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6} : null;
}

export type DropOffField = 'address' | 'unit';

/** What is wrong with each part of a drop-off, in the words the customer reads beside it. */
export function dropOffProblems(input: unknown): Partial<Record<DropOffField, string>> {
  const problems: Partial<Record<DropOffField, string>> = {};
  const address = textAt(input, 'address').trim();
  if (address.length < 1 || parsePlace(typeof input === 'object' && input !== null && 'place' in input ? input.place : null) === null) {
    problems.address = 'Find your address, or use your location.';
  } else if (address.length > ADDRESS_MAX) problems.address = 'That address is too long. Choose it from the list.';
  const unit = textAt(input, 'unit').trim();
  if (unit.length < 1) problems.unit = 'Enter your house or unit number, so the rider finds your door.';
  else if (unit.length > UNIT_MAX) problems.unit = `Use ${UNIT_MAX} characters or fewer.`;
  return problems;
}

/** Parses a drop-off from untrusted input; throws the first problem's words. */
export function parseDropOff(input: unknown, fail: (message: string) => Error): DropOff {
  const [problem] = Object.values(dropOffProblems(input));
  if (problem) throw fail(problem);
  const place = parsePlace(typeof input === 'object' && input !== null && 'place' in input ? input.place : null);
  if (!place) throw fail('Find your address, or use your location.');
  return {
    address: textAt(input, 'address').trim(),
    unit: textAt(input, 'unit').trim(),
    note: textAt(input, 'note').trim().slice(0, NOTE_MAX),
    place,
  };
}

// States -------------------------------------------------------------------------------------

/**
 * Where a delivery's booking stands, in one table: what the kitchen board says about it, and
 * whether the courier is still working on it. `waiting` is paid and not yet booked; `booking` is a
 * claim on booking it (a claim that lapses is never retried blind: the courier may have taken it);
 * `failed` is a booking the courier gave up on, booked again by the job; `stuck` needs staff.
 */
const STATES = {
  waiting: {staff: 'Rider not booked yet', live: false},
  booking: {staff: 'Booking a rider…', live: false},
  finding_rider: {staff: 'Finding a rider', live: true},
  rider_assigned: {staff: 'Rider on the way to the shop', live: true},
  on_the_way: {staff: 'With the rider', live: true},
  delivered: {staff: 'Delivered', live: false},
  failed: {staff: 'No rider yet, booking again', live: false},
  stuck: {staff: 'Needs you: no rider booked', live: false},
  cancelled: {staff: 'Rider cancelled', live: false},
} as const satisfies Record<string, {staff: string; live: boolean}>;

export type DeliveryState = keyof typeof STATES;
export const DELIVERY_STATES = Object.keys(STATES).filter((key): key is DeliveryState => key in STATES);
export const staffLine = (state: DeliveryState) => STATES[state].staff;
/** The courier has a booking it is still working on: the job asks after it. */
export const isLive = (state: DeliveryState) => STATES[state].live;
/** Booked or past it: nothing left to book. */
export const isBooked = (state: DeliveryState) => state !== 'waiting' && state !== 'failed' && state !== 'stuck' && state !== 'booking';
/** Nothing more will happen to it. */
export const isDone = (state: DeliveryState) => state === 'delivered' || state === 'cancelled';
/** States staff may book a rider from by hand. */
export const canBookByHand = (state: DeliveryState) => state === 'waiting' || state === 'failed' || state === 'stuck';

/** How many bookings the job makes for one order before it asks staff. */
export const BOOKING_ATTEMPTS = 3;
/** How long before collection the rider is booked: a scheduled booking can only be cancelled until a rider matches. */
export const BOOK_AHEAD_MINUTES = 30;
/** A booking claim older than this is taken to have died part-way. */
export const BOOKING_CLAIM_MINUTES = 2;

/** What the courier says about a booking, in this app's words. */
export type CourierStatus = 'finding_rider' | 'rider_assigned' | 'picked_up' | 'completed' | 'gave_up';

/** Where a delivery goes when the courier reports `status`; null when it does not move. Done deliveries stay done. */
export function stateForCourier(state: DeliveryState, status: CourierStatus): DeliveryState | null {
  // Booking: a new ride is being made, and anything heard now is about the one before it.
  if (isDone(state) || state === 'stuck' || state === 'waiting' || state === 'booking') return null;
  const to: DeliveryState =
    status === 'finding_rider' ? 'finding_rider'
    : status === 'rider_assigned' ? 'rider_assigned'
    : status === 'picked_up' ? 'on_the_way'
    : status === 'completed' ? 'delivered'
    : 'failed';
  return to === state ? null : to;
}

// The customer's view -----------------------------------------------------------------------

/** What the customer reads about a delivery while the kitchen has it, by the order's own step. */
export const DELIVERY_COPY = {
  paid: {title: 'Order received', line: 'Paid. The kitchen will confirm it in a moment.'},
  accepted: {title: 'Being prepared', line: 'The kitchen has your order. A rider takes it from the shop to you.'},
  ready: {title: 'Ready for the rider', line: 'Your order is packed and waiting at the counter for the rider.'},
  riderComing: {title: 'Rider on the way', line: 'A rider is on the way to the shop to collect your order.'},
  onTheWay: {title: 'On the way', line: 'Your rider has your order and is on the way to you.'},
  delivered: {title: 'Delivered', line: 'Enjoy. Thank you for ordering.'},
  noRider: {title: 'Finding a rider', line: 'Riders are busy right now. We are booking another, and we will call you if it takes longer.'},
  lost: {title: 'Delivery delayed', line: 'Something went wrong with the ride. The shop will call you.'},
} as const;

/** The customer's progress bar for a delivery. */
export const DELIVERY_STEPS = ['Paid', 'Preparing', 'On the way', 'Delivered'] as const;
