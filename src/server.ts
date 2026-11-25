import {createServerEntry, createStartHandler, defaultStreamHandler} from '@tanstack/react-start/server';
import {env} from 'cloudflare:workers';
import {canonicalRedirect} from './lib/canonical';
import {runScheduled} from './ops/scheduled.server';

const handle = createStartHandler(defaultStreamHandler);

export default {
  ...createServerEntry({fetch: (request, opts) => canonicalRedirect(request, env.SITE_URL) ?? handle(request, opts)}),
  /** The cron trigger in cloudflare.config.ts: settles unpaid orders and records sales in the POS. */
  scheduled(_controller: ScheduledController, _env: unknown, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduled(env));
  },
};
