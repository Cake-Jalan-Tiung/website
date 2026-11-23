// Emails the developer when something needs a person: a payment callback that failed, money
// that arrived without its callback, the POS sync failing. Each kind of alert (`key`) is sent at
// most once per quiet period. Sending never throws: an alert must not break the flow it reports.
import {env, waitUntil} from 'cloudflare:workers';

const FROM = {email: 'alerts@hazli.dev', name: 'Cake Jalan Tiung site'};
const QUIET_HOURS = 6;

type AlertEnv = {DB: D1Database; ALERT_EMAIL: SendEmail; ALERT_TO: string};

export type Alert = {
  /** Groups repeats: the same key is emailed at most once every few hours. Put an order id in it to alert once per order. */
  key: string;
  subject: string;
  /** Plain text: what happened, what it affects, what to check. No secrets, no customer details beyond the order code. */
  body: string;
};

/** Claims the key for this quiet period; false when it was already sent within it. */
async function claim(db: D1Database, key: string, now: Date) {
  const quietSince = new Date(now.getTime() - QUIET_HOURS * 3_600_000).toISOString();
  const result = await db
    .prepare('INSERT INTO alerts_sent (key, sent_at) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET sent_at = excluded.sent_at WHERE alerts_sent.sent_at < ?')
    .bind(key, now.toISOString(), quietSince)
    .run();
  return result.meta.changes > 0;
}

export async function sendAlert(alert: Alert, target: AlertEnv = env, now: Date = new Date()): Promise<void> {
  console.error(`[alert] ${alert.subject}\n${alert.body}`);
  try {
    if (!target.ALERT_TO || !(await claim(target.DB, alert.key, now))) return;
    await target.ALERT_EMAIL.send({
      to: target.ALERT_TO,
      from: FROM,
      subject: `[Cake Jalan Tiung] ${alert.subject}`,
      text: `${alert.body}\n\nSent by the cakejalantiung Worker at ${now.toISOString()}. Repeats of this alert are held back for ${QUIET_HOURS} hours.`,
    });
  } catch (error) {
    console.error('Alert email not sent', error);
  }
}

/** Sends an alert after the response, for code that runs inside a request. */
export const alertLater = (alert: Alert) => waitUntil(sendAlert(alert));
