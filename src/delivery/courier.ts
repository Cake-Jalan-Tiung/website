// The one seam between deliveries and whoever carries them. The order flow only knows this shape;
// Lalamove is one implementation, the local stand-in another.
import type {CourierStatus, Place} from './model';

/** A stop as a courier needs it: the point, and the address said in words for the rider. */
export type Stop = {place: Place; address: string};
export type Contact = {name: string; phone: string};

/** A price for one ride, from the shop to `to`. */
export type CourierQuote = {feeSen: number; distanceM: number};

export type BookingRequest = {
  from: Stop;
  to: Stop;
  /** When the rider should collect; null for as soon as possible. */
  at: Date | null;
  sender: Contact;
  recipient: Contact;
  /** For the rider, at the door: unit, note and the order code. */
  remarks: string;
  /** This site's order id, kept with the booking. */
  reference: string;
};

export type Booking = {courierOrderId: string; shareLink: string | null; costSen: number; status: CourierStatus};

export type Driver = {name: string; phone: string; plate: string};
export type Tracking = {status: CourierStatus; shareLink: string | null; driver: Driver | null};

/**
 * Why a courier call failed. `retry` may work later (busy, down, rate limited) and nothing was
 * booked; `refused` will not work until something changes; `unsure` is a booking that may or may
 * not exist (the call timed out or its answer was unreadable), so it must never be made again blind.
 */
export class CourierError extends Error {
  constructor(
    message: string,
    readonly kind: 'retry' | 'refused' | 'unsure',
    readonly status: number | null = null,
  ) {
    super(message);
  }
}

export interface Courier {
  quote(from: Stop, to: Stop, service: string): Promise<CourierQuote>;
  /** Prices the ride again and books it: a courier's quote lasts minutes. */
  book(request: BookingRequest, service: string): Promise<Booking>;
  /** Asks the courier directly, for when a webhook is slow or lost. */
  track(courierOrderId: string): Promise<Tracking>;
  /** True when the booking is cancelled (or already was); false when the courier no longer allows it. */
  cancel(courierOrderId: string): Promise<boolean>;
  /**
   * Reads a webhook from its raw body: the booking it names, once proven to come from the courier.
   * Null when it cannot be proven or names none. The webhook is only a prompt: callers `track` it.
   */
  confirm(rawBody: string, path: string): Promise<string | null>;
}
