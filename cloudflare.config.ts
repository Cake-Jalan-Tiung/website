import {bindings, defineConfig} from 'cf/config';
import * as entrypoint from './src/server.ts' with {type: 'cf-worker'};

export default defineConfig({
  accountId: '9c006d850453ab5c068f5688d138521b',
  worker: {
    name: 'cakejalantiung',
    entrypoint,
    compatibilityDate: '2026-11-23',
    compatibilityFlags: ['nodejs_compat'],
    env: {
      DB: bindings.d1({name: 'cakejalantiung', id: '9f1ccf1f-02eb-47eb-be65-c20274559efe'}),
      SHOP_ID: bindings.text('cakejalantiung'),
      // Set per environment with no default, so a deploy cannot fall back to test payments:
      // `chip` in production, `fake` in `.dev.vars` for local work without payment keys.
      PAYMENTS: bindings.secret(),
      CHIP_BRAND_ID: bindings.secret(),
      CHIP_SECRET_KEY: bindings.secret(),
      STAFF_PIN: bindings.secret(),
      SESSION_SECRET: bindings.secret(),
    },
  },
});
