-- Orders that go to the customer instead of being collected: where to, what the customer paid for
-- the ride, and where the courier's booking stands. An order is a delivery when it has a row here.
-- `fee_sen` is part of orders.total_sen; `cost_sen` is what the courier charged when it was booked.
-- The address, unit and note are the customer's own words; lat and lng are the pin they confirmed.
CREATE TABLE deliveries (
  order_id          TEXT PRIMARY KEY REFERENCES orders (id),
  address           TEXT NOT NULL,
  unit              TEXT NOT NULL,
  note              TEXT NOT NULL DEFAULT '',
  lat               REAL NOT NULL,
  lng               REAL NOT NULL,
  distance_m        INTEGER NOT NULL CHECK (distance_m >= 0),
  fee_sen           INTEGER NOT NULL CHECK (fee_sen >= 0),
  state             TEXT NOT NULL CHECK (state IN ('waiting', 'booking', 'finding_rider', 'rider_assigned', 'on_the_way', 'delivered', 'failed', 'stuck', 'cancelled')),
  -- Bookings made, including ones the courier gave up on; the job stops booking again after a few.
  attempts          INTEGER NOT NULL DEFAULT 0,
  courier_order_id  TEXT UNIQUE,
  share_link        TEXT,
  driver_name       TEXT,
  driver_phone      TEXT,
  driver_plate      TEXT,
  cost_sen          INTEGER,
  -- Why it needs staff, in words for the kitchen board; null unless stuck.
  problem           TEXT,
  booked_at         TEXT,
  updated_at        TEXT NOT NULL
);
CREATE INDEX deliveries_by_state ON deliveries (state);
