-- Failed staff PIN attempts, to slow guessing: logins are refused after too many in a window.
CREATE TABLE staff_login_failures (
  ip               TEXT NOT NULL,
  at               TEXT NOT NULL
);
CREATE INDEX staff_login_failures_by_ip ON staff_login_failures (ip, at);
