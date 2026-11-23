-- When the payment provider was last asked whether a sold order has been refunded. A refund made
-- in the provider's dashboard sends no callback, so the scheduled sweep asks, and this keeps it
-- from asking about the same order more than every few hours.
ALTER TABLE orders ADD COLUMN refund_checked_at TEXT;
