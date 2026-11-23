import {bindings, defineConfig} from 'cf/config';
import * as entrypoint from './src/server.ts' with {type: 'cf-worker'};

export default defineConfig({
  worker: {
    name: 'cakejalantiung',
    entrypoint,
    compatibilityDate: '2026-11-23',
    compatibilityFlags: ['nodejs_compat'],
    env: {
      // Replace with the id from `cf d1 create cakejalantiung` before the first deploy.
      DB: bindings.d1({name: 'cakejalantiung', id: '00000000-0000-4000-8000-00000000c1d1'}),
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
