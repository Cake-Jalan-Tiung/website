-- What staff have closed on the site: online ordering as a whole (subject 'orders') or one dish
-- (subject 'dish:<id>'). A row closes its subject until `until`; a null `until` means until staff
-- open it again. Deleting the row opens it.
CREATE TABLE closures (
  shop_id          TEXT NOT NULL,
  subject          TEXT NOT NULL,
  until            TEXT,
  closed_at        TEXT NOT NULL,
  PRIMARY KEY (shop_id, subject)
);
