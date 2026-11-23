-- When the customer told the shop they had arrived ("I'm here" on their order page), so the
-- counter can hand the order over without being asked. Set once; null until then.
ALTER TABLE orders ADD COLUMN arrived_at TEXT;
