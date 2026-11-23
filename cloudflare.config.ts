import {bindings, defineConfig, triggers} from 'cf/config';
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
      // The shop's StoreHub API token; paid web orders are recorded there as sales (src/pos/).
      STOREHUB_API_TOKEN: bindings.secret(),
      // Failure alerts by email (src/ops/alert.server.ts), sent from hazli.dev to ALERT_TO.
      ALERT_EMAIL: bindings.sendEmail({allowedSenderAddresses: ['alerts@hazli.dev']}),
      ALERT_TO: bindings.secret(),
    },
    // The shop's own address. workers.dev stays on beside it: payments started there return
    // there, and links to it keep working.
    domains: ['cakejalantiung.app', 'www.cakejalantiung.app'],
    workersDev: true,
    // Every 5 minutes: settle orders still waiting for payment, and keep StoreHub in step (src/ops/scheduled.server.ts).
    triggers: [triggers.scheduled({schedule: '*/5 * * * *'})],
  },
});
