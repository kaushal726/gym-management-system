# GymDesk — D1 schema (Phase 0, draft for confirmation)

SQLite (Cloudflare D1). Conventions:
- Ids are `TEXT` (ULID), so they sort by creation time and are safe to show in URLs.
- Money is `INTEGER` paise. Dates are `TEXT 'YYYY-MM-DD'` in the gym's timezone; timestamps are `TEXT` ISO-8601 UTC.
- Every gym-owned table has `gym_id`, and every query filters by it.
- Nothing financial is ever deleted: payments are voided, subscriptions cancelled.
- No file/blob columns: the app stores no uploads. The only picture is the Google profile picture URL.

```sql
CREATE TABLE gyms (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,              -- QR target: /g/:slug
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  upi_id TEXT,                            -- QR drawn in the browser from this
  grace_days INTEGER NOT NULL DEFAULT 3,
  joining_fee_paise INTEGER NOT NULL DEFAULT 0,
  checkin_enabled INTEGER NOT NULL DEFAULT 0,
  reminder_hour INTEGER NOT NULL DEFAULT 9,
  next_receipt_no INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE users (                       -- one per Google account, global across gyms
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  picture_url TEXT,                       -- from the Google ID token, refreshed on each sign-in
  is_platform_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id_hash TEXT PRIMARY KEY,               -- sha-256 of the cookie value
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE gym_staff (
  gym_id TEXT NOT NULL REFERENCES gyms(id),
  user_id TEXT REFERENCES users(id),      -- NULL until the invite is accepted
  invite_email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('OWNER','MANAGER')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  PRIMARY KEY (gym_id, invite_email)
);

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  gym_id TEXT NOT NULL REFERENCES gyms(id),
  user_id TEXT REFERENCES users(id),      -- NULL for desk-added members who never sign in
  name TEXT NOT NULL,
  phone TEXT NOT NULL,                    -- 10 digits
  dob TEXT,
  gender TEXT,
  emergency_name TEXT,
  emergency_phone TEXT,
  guardian_name TEXT,                     -- required by the API when dob says under 18
  guardian_phone TEXT,
  source TEXT NOT NULL CHECK (source IN ('QR','DESK')),
  status TEXT NOT NULL CHECK (status IN ('PENDING','ACTIVE','INACTIVE','LEAD','REJECTED')),
  request_no INTEGER,                     -- shown on the "show this at the desk" screen
  consent_at TEXT,
  anonymised_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (gym_id, phone),
  UNIQUE (gym_id, user_id)
);

CREATE TABLE member_phone_history (
  id TEXT PRIMARY KEY,
  gym_id TEXT NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id),
  old_phone TEXT NOT NULL,
  new_phone TEXT NOT NULL,
  changed_by TEXT NOT NULL REFERENCES users(id),
  changed_at TEXT NOT NULL
);

CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  gym_id TEXT NOT NULL REFERENCES gyms(id),
  name TEXT NOT NULL,
  duration_months INTEGER,                -- exactly one of months / days is set
  duration_days INTEGER,
  price_paise INTEGER NOT NULL,
  max_freeze_days INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  CHECK ((duration_months IS NULL) <> (duration_days IS NULL))
);

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  gym_id TEXT NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id),
  plan_id TEXT REFERENCES plans(id),
  plan_name TEXT NOT NULL,                -- snapshot
  duration_months INTEGER,                -- snapshot
  duration_days INTEGER,                  -- snapshot
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,                 -- includes freeze shifts
  list_price_paise INTEGER NOT NULL,
  final_price_paise INTEGER NOT NULL,
  discount_reason TEXT,                   -- required when final < list
  joining_fee_paise INTEGER NOT NULL DEFAULT 0,
  backdate_reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('UPCOMING','ACTIVE','FROZEN','EXPIRED','CANCELLED')),
  cancelled_reason TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  gym_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
  amount_paise INTEGER NOT NULL,          -- negative = refund
  mode TEXT NOT NULL CHECK (mode IN ('CASH','UPI','CARD')),
  paid_on TEXT NOT NULL,
  receipt_no INTEGER NOT NULL,
  collected_by TEXT NOT NULL REFERENCES users(id),
  note TEXT,
  voided_at TEXT,
  voided_by TEXT REFERENCES users(id),
  void_reason TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (gym_id, receipt_no)
);

CREATE TABLE freezes (
  id TEXT PRIMARY KEY,
  gym_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
  from_date TEXT NOT NULL,
  to_date TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE attendance (
  id TEXT PRIMARY KEY,
  gym_id TEXT NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id),
  at TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('ACTIVE','GRACE','EXPIRED','NO_PLAN')),
  method TEXT NOT NULL CHECK (method IN ('QR','DESK'))
);

CREATE TABLE claim_tokens (
  token_hash TEXT PRIMARY KEY,
  gym_id TEXT NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE reminders_sent (
  gym_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
  type TEXT NOT NULL,                     -- EXPIRY_M5, EXPIRY_M1, EXPIRY_0, EXPIRED_P3, RENEW_P7, RENEW_P15, DUES
  for_date TEXT NOT NULL,
  push_ok INTEGER NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (subscription_id, type, for_date)
);

CREATE TABLE followups (
  id TEXT PRIMARY KEY,
  gym_id TEXT NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id),
  subscription_id TEXT REFERENCES subscriptions(id),
  type TEXT NOT NULL,                     -- same set as reminders_sent.type, plus LEAD
  for_date TEXT NOT NULL,
  push_failed INTEGER NOT NULL DEFAULT 0,
  contacted_at TEXT,
  contacted_by TEXT REFERENCES users(id),
  note TEXT,
  UNIQUE (member_id, type, for_date)
);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  gym_id TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,                   -- e.g. PAYMENT_VOID, SUB_CREATE, MEMBER_PHONE_EDIT
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  reason TEXT,
  at TEXT NOT NULL
);

CREATE INDEX idx_members_gym_status ON members (gym_id, status);
CREATE INDEX idx_subs_gym_end ON subscriptions (gym_id, status, end_date);
CREATE INDEX idx_subs_member ON subscriptions (member_id);
CREATE INDEX idx_payments_sub ON payments (subscription_id);
CREATE INDEX idx_payments_gym_day ON payments (gym_id, paid_on);
CREATE INDEX idx_attendance_gym_at ON attendance (gym_id, at);
CREATE INDEX idx_followups_gym_open ON followups (gym_id, contacted_at, for_date);
CREATE INDEX idx_audit_gym_at ON audit_log (gym_id, at);
```

## Derived values (computed, never stored)
- `due_paise(sub) = final_price_paise + joining_fee_paise − SUM(amount_paise WHERE voided_at IS NULL)`
- Member's current state today: the latest non-cancelled subscription →
  `UPCOMING` / `ACTIVE` / `FROZEN` / `GRACE` (end < today ≤ end + grace_days) / `EXPIRED`.
- Freeze days used = `SUM(to_date − from_date + 1)` over that subscription's freezes.
