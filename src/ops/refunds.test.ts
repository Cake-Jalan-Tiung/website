import {describe, expect, it} from 'vitest';
import type {Alert} from './alert.server';
import type {PaymentState} from '../payments/provider';
import {REFUND_FIRST_CHECK_HOURS, REFUND_LOOKBACK_DAYS, REFUND_RECHECK_HOURS, catchRefunds, type RefundDeps} from './refunds';

const now = new Date('2026-11-23T10:00:00.000Z');

function setup(states: Record<string, PaymentState | Error>) {
  const events: string[] = [];
  const alerts: Alert[] = [];
  const asked: {paidSince?: Date; paidBefore?: Date; checkedBefore?: Date} = {};
  const deps: RefundDeps = {
    orders: {
      refundCheckDue: async (window) => {
        Object.assign(asked, window);
        return Object.keys(states).map((id) => ({id, purchaseId: `p-${id}`}));
      },
      markRefundChecked: async (id) => void events.push(`checked ${id}`),
      move: async (id, to) => (events.push(`${to} ${id}`), true),
    },
    provider: {
      state: async (purchaseId) => {
        const state = states[purchaseId.slice(2)];
        if (state instanceof Error) throw state;
        return state;
      },
    },
    alert: async (alert) => void alerts.push(alert),
    now,
  };
  return {deps, events, alerts, asked};
}

describe('catchRefunds', () => {
  it('moves a refunded order to refunded and marks every order it asked about', async () => {
    const {deps, events, alerts} = setup({a: 'paid', b: 'refunded'});
    await catchRefunds(deps);
    expect(events).toEqual(['checked a', 'refunded b', 'checked b']);
    expect(alerts).toEqual([]);
  });

  it('asks about the last month, leaving just-paid orders to the board and recently asked ones alone', async () => {
    const {deps, asked} = setup({});
    await catchRefunds(deps);
    expect(asked.paidSince).toEqual(new Date(now.getTime() - REFUND_LOOKBACK_DAYS * 86_400_000));
    expect(asked.paidBefore).toEqual(new Date(now.getTime() - REFUND_FIRST_CHECK_HOURS * 3_600_000));
    expect(asked.checkedBefore).toEqual(new Date(now.getTime() - REFUND_RECHECK_HOURS * 3_600_000));
  });

  it('stops when the provider cannot be reached, leaving the rest unmarked for the next run', async () => {
    const {deps, events, alerts} = setup({a: 'paid', b: new Error('timeout'), c: 'refunded'});
    await catchRefunds(deps);
    expect(events).toEqual(['checked a']);
    expect(alerts.map((a) => a.key)).toEqual(['provider-unreachable']);
  });
});
