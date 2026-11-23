import {chipProvider} from './chip.server';
import {fakeProvider} from './fake.server';
import type {PaymentProvider} from './provider';

type PaymentEnv = {PAYMENTS: string; CHIP_SECRET_KEY: string; CHIP_BRAND_ID: string};
let current: {key: string; provider: PaymentProvider} | undefined;

/**
 * The provider this deploy is configured for, built once per isolate so its caches (CHIP's
 * public key, payment methods) last between requests. There is no silent fallback: an
 * unknown setting fails.
 */
export function paymentProvider(env: PaymentEnv): PaymentProvider {
  const key = `${env.PAYMENTS}:${env.CHIP_BRAND_ID}:${env.CHIP_SECRET_KEY}`;
  if (current?.key === key) return current.provider;
  let provider: PaymentProvider;
  if (env.PAYMENTS === 'chip') provider = chipProvider({secretKey: env.CHIP_SECRET_KEY, brandId: env.CHIP_BRAND_ID});
  else if (env.PAYMENTS === 'fake') provider = fakeProvider;
  else throw new Error(`PAYMENTS must be "chip" or "fake", not "${env.PAYMENTS}"`);
  current = {key, provider};
  return provider;
}
