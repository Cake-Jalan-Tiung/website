-- The emails each order's customer gets: one when it is paid, one when it is ready. A row is
-- the claim on sending one: 'sending' while a send is under way, then 'sent', or 'failed' to be
-- retried by the 5-minute job until the attempts run out. 'skipped' is never sent.
CREATE TABLE order_emails (
  order_id         TEXT NOT NULL REFERENCES orders(id),
  kind             TEXT NOT NULL,
  state            TEXT NOT NULL,
  attempts         INTEGER NOT NULL,
  updated_at       TEXT NOT NULL,
  PRIMARY KEY (order_id, kind)
);

-- What already happened before these emails existed is not emailed now: no receipt for an order
-- already paid, no "ready" for one already ready or past it. Anything later is emailed as usual.
INSERT INTO order_emails (order_id, kind, state, attempts, updated_at)
  SELECT id, 'paid', 'skipped', 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM orders WHERE paid_at IS NOT NULL;
INSERT INTO order_emails (order_id, kind, state, attempts, updated_at)
  SELECT id, 'ready', 'skipped', 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM orders WHERE status IN ('ready', 'collected', 'refunded');
