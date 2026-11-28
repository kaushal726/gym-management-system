-- Counters behind the request limits: how many times one caller hit one route in the current time window.
-- Old windows are deleted by the hourly job.
CREATE TABLE rate_limits (
  key TEXT NOT NULL,
  window INTEGER NOT NULL,
  n INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (key, window)
);
CREATE INDEX idx_rate_limits_expires ON rate_limits (expires_at);
