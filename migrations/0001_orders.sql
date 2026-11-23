-- Orders placed on the site. Money is integer sen. Every row carries shop_id so one codebase
-- can serve more than one shop.
CREATE TABLE orders (
  id               TEXT PRIMARY KEY,
  shop_id          TEXT NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('awaiting_payment', 'paid', 'accepted', 'ready', 'collected', 'expired', 'cancelled', 'refunded')),
  pickup_at        TEXT NOT NULL,
  customer_name    TEXT NOT NULL,
  phone            TEXT NOT NULL,
  email            TEXT NOT NULL,
  note             TEXT NOT NULL DEFAULT '',
  total_sen        INTEGER NOT NULL CHECK (total_sen > 0),
  payment_method   TEXT NOT NULL,
  purchase_id      TEXT UNIQUE,
  created_at       TEXT NOT NULL,
  paid_at          TEXT,
  updated_at       TEXT NOT NULL
);
CREATE INDEX orders_by_shop_status ON orders (shop_id, status, pickup_at);

CREATE TABLE order_items (
  order_id         TEXT NOT NULL REFERENCES orders (id),
  dish_id          TEXT NOT NULL,
  name             TEXT NOT NULL,
  unit_sen         INTEGER NOT NULL CHECK (unit_sen > 0),
  quantity         INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 20),
  PRIMARY KEY (order_id, dish_id)
);

-- Each payment callback once: the provider retries and can deliver twice.
CREATE TABLE payment_events (
  id               TEXT PRIMARY KEY,
  order_id         TEXT NOT NULL REFERENCES orders (id),
  kind             TEXT NOT NULL,
  received_at      TEXT NOT NULL,
  body             TEXT NOT NULL
);
