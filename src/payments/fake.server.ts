// A stand-in provider for local work without payment keys. Its checkout is a page on this site
// (/pay/test/<order>) whose Pay and Cancel buttons post an unsigned event to the same callback
// CHIP uses, so the local flow runs the real path. Selected only when PAYMENTS=fake.
import {textAt} from '../lib/guards';
import type {PaymentProvider} from './provider';

const purchaseFor = (orderId: string) => `test_${orderId}`;

export const fakeProvider: PaymentProvider = {
  async methods() {
    return [
      {id: 'fpx', kind: 'fpx', name: 'Online banking (FPX)'},
      {id: 'duitnow_qr', kind: 'duitnow', name: 'DuitNow QR'},
      {id: 'razer_tng', kind: 'tng', name: "Touch 'n Go eWallet"},
      {id: 'razer_grabpay', kind: 'grabpay', name: 'GrabPay'},
      {id: 'visa', kind: 'card', name: 'Card'},
    ];
  },
  async createCheckout({orderId}) {
    return {purchaseId: purchaseFor(orderId), redirectUrl: `/pay/test/${orderId}`};
  },
  async confirm(rawBody) {
    let event: unknown;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return null;
    }
    const orderId = textAt(event, 'orderId');
    const outcome = textAt(event, 'outcome');
    if (!orderId || (outcome !== 'paid' && outcome !== 'failed')) return null;
    return {eventId: `${purchaseFor(orderId)}:${outcome}`, purchaseId: purchaseFor(orderId), orderId, state: outcome};
  },
  async state() {
    return 'pending';
  },
};
