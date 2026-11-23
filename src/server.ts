import {createServerEntry, createStartHandler, defaultStreamHandler} from '@tanstack/react-start/server';
import {env} from 'cloudflare:workers';
import {runScheduled} from './ops/scheduled.server';

export default {
  ...createServerEntry({fetch: createStartHandler(defaultStreamHandler)}),
  /** The cron trigger in cloudflare.config.ts: settles unpaid orders and records sales in the POS. */
  scheduled(_controller: ScheduledController, _env: unknown, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduled(env));
  },
};
