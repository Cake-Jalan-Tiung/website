// The one seam between orders and whoever takes the money. The order flow only knows this
// shape; CHIP is one implementation, the local test provider another.
import type {Customer, PricedLine} from '../orders/model';

/** A way to pay, as the checkout shows it. `id` is what the provider is told to open. */
export type PaymentMethod = {id: string; kind: MethodKind; name: string};
export type MethodKind = 'fpx' | 'duitnow' | 'tng' | 'grabpay' | 'shopeepay' | 'card' | 'applepay' | 'googlepay' | 'other';

export type PaymentState = 'paid' | 'pending' | 'failed' | 'expired' | 'refunded';

export type CheckoutRequest = {
  orderId: string;
  lines: readonly PricedLine[];
  customer: Customer;
  method: string;
  dueAt: Date;
  returnUrl: string;
  callbackUrl: string;
};

/** A provider event that has passed its checks: who sent it is proven and the state confirmed. */
export type ConfirmedEvent = {eventId: string; purchaseId: string; orderId: string; state: PaymentState};

export interface PaymentProvider {
  methods(amountSen: number): Promise<PaymentMethod[]>;
  createCheckout(request: CheckoutRequest): Promise<{purchaseId: string; redirectUrl: string}>;
  /** Verifies a callback from its raw body and headers; null when it cannot be proven. */
  confirm(rawBody: string, headers: Headers): Promise<ConfirmedEvent | null>;
  /** Asks the provider directly, for when a callback is slow or cannot reach us. */
  state(purchaseId: string): Promise<PaymentState>;
}
