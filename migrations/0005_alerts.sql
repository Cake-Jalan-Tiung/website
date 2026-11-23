-- When each kind of failure alert was last emailed, so a failure that repeats every few minutes
-- sends one email, not hundreds.
CREATE TABLE alerts_sent (
  key              TEXT PRIMARY KEY,
  sent_at          TEXT NOT NULL
);
