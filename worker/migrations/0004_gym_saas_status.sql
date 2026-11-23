-- The platform side of each gym (the gym's own GymDesk subscription, run by the platform admin):
--   status     ACTIVE | PAUSED (by hand) | ARCHIVED (closed). Expiry is not stored as a status: a gym whose
--              valid_till is more than the grace days in the past is treated as paused (shared/saas.ts).
--   valid_till last day the gym has paid for; NULL means no end date.
ALTER TABLE gyms ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'ARCHIVED'));
ALTER TABLE gyms ADD COLUMN status_reason TEXT;
ALTER TABLE gyms ADD COLUMN status_changed_at TEXT;
ALTER TABLE gyms ADD COLUMN saas_plan_name TEXT;
ALTER TABLE gyms ADD COLUMN valid_till TEXT;

-- What each gym paid the platform. Recorded by hand (UPI/cash), never deleted.
CREATE TABLE gym_billing (
  id TEXT PRIMARY KEY,
  gym_id TEXT NOT NULL REFERENCES gyms(id),
  plan_name TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise >= 0),
  mode TEXT NOT NULL CHECK (mode IN ('CASH', 'UPI', 'CARD', 'BANK')),
  paid_on TEXT NOT NULL,
  valid_till_before TEXT,
  valid_till_after TEXT NOT NULL,
  note TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_gym_billing_gym ON gym_billing (gym_id, created_at);
