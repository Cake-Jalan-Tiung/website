-- When a paid order was recorded as a sale in the shop's POS, and when that sale was cancelled
-- after a refund. Null means not yet; the sync sweep picks those up.
ALTER TABLE orders ADD COLUMN pos_recorded_at TEXT;
ALTER TABLE orders ADD COLUMN pos_cancelled_at TEXT;
