-- GymDesk initial schema (Cloudflare D1 / SQLite).
-- Money is integer paise. Dates are 'YYYY-MM-DD' in the gym's time zone; timestamps are ISO-8601 UTC.
-- Financial rows are never deleted: payments are voided, subscriptions cancelled.
-- No file or blob columns: the app stores no uploads. The only picture is the Google profile picture URL.

CREATE TABLE gyms (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  upi_id TEXT,
  grace_days INTEGER NOT NULL DEFAULT 3,
  joining_fee_paise INTEGER NOT NULL DEFAULT 0,
  checkin_enabled INTEGER NOT NULL DEFAULT 0,
  checkin_lat REAL,
  checkin_lng REAL,
  checkin_radius_m INTEGER,
  reminder_hour INTEGER NOT NULL DEFAULT 9,
  next_receipt_no INTEGER NOT NULL DEFAULT 1,
  next_request_no INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  picture_url TEXT,
  created_at TEXT NOT NULL,
  last_login_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions (user_id);

CREATE TABLE gym_staff (
  gym_id TEXT NOT NULL REFERENCES gyms(id),
  invite_email TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'MANAGER')),
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (gym_id, invite_email)
);
CREATE INDEX idx_staff_user ON gym_staff (user_id);
CREATE INDEX idx_staff_email ON gym_staff (invite_email);

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  gym_id TEXT NOT NULL REFERENCES gyms(id),
  user_id TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  dob TEXT,
  gender TEXT CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
  emergency_name TEXT,
  emergency_phone TEXT,
  guardian_name TEXT,
  guardian_phone TEXT,
  source TEXT NOT NULL CHECK (source IN ('QR', 'DESK')),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'JOINED', 'LEAD', 'REJECTED')),
  request_no INTEGER,
  rejected_reason TEXT,
  archived_at TEXT,
  archived_reason TEXT,
  consent_at TEXT,
  anonymised_at TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (gym_id, phone),
  UNIQUE (gym_id, user_id)
);
CREATE INDEX idx_members_gym_status ON members (gym_id, status);

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
  kind TEXT NOT NULL DEFAULT 'MEMBERSHIP' CHECK (kind IN ('MEMBERSHIP', 'PT')),
  name TEXT NOT NULL,
  duration_months INTEGER,
  duration_days INTEGER,
  price_paise INTEGER NOT NULL CHECK (price_paise >= 0),
  max_freeze_days INTEGER NOT NULL DEFAULT 0,
  trainer_commission_pct INTEGER NOT NULL DEFAULT 0 CHECK (trainer_commission_pct BETWEEN 0 AND 100),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  CHECK ((duration_months IS NULL) <> (duration_days IS NULL))
);
CREATE INDEX idx_plans_gym ON plans (gym_id, active);

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  gym_id TEXT NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id),
  plan_id TEXT REFERENCES plans(id),
  kind TEXT NOT NULL DEFAULT 'MEMBERSHIP' CHECK (kind IN ('MEMBERSHIP', 'PT')),
  plan_name TEXT NOT NULL,
  duration_months INTEGER,
  duration_days INTEGER,
  max_freeze_days INTEGER NOT NULL DEFAULT 0,
  trainer_name TEXT,
  trainer_commission_pct INTEGER NOT NULL DEFAULT 0,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  list_price_paise INTEGER NOT NULL,
  final_price_paise INTEGER NOT NULL CHECK (final_price_paise >= 0),
  discount_reason TEXT,
  joining_fee_paise INTEGER NOT NULL DEFAULT 0 CHECK (joining_fee_paise >= 0),
  backdate_reason TEXT,
  cancelled_at TEXT,
  cancelled_by TEXT,
  cancelled_reason TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_subs_gym_end ON subscriptions (gym_id, end_date);
CREATE INDEX idx_subs_member ON subscriptions (member_id);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  gym_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  amount_paise INTEGER NOT NULL CHECK (amount_paise <> 0),
  mode TEXT NOT NULL CHECK (mode IN ('CASH', 'UPI', 'CARD')),
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
CREATE INDEX idx_payments_sub ON payments (subscription_id);
CREATE INDEX idx_payments_gym_day ON payments (gym_id, paid_on);

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
CREATE INDEX idx_freezes_sub ON freezes (subscription_id);

CREATE TABLE attendance (
  id TEXT PRIMARY KEY,
  gym_id TEXT NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id),
  at TEXT NOT NULL,
  day TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('ACTIVE', 'GRACE', 'FROZEN', 'UPCOMING', 'EXPIRED', 'NO_PLAN')),
  method TEXT NOT NULL CHECK (method IN ('QR', 'DESK', 'OFFLINE')),
  distance_m INTEGER,
  recorded_by TEXT
);
CREATE INDEX idx_attendance_gym_at ON attendance (gym_id, at);
CREATE INDEX idx_attendance_member ON attendance (member_id, day);

CREATE TABLE claim_tokens (
  token_hash TEXT PRIMARY KEY,
  gym_id TEXT NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
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
CREATE INDEX idx_push_user ON push_subscriptions (user_id);

-- One row per reminder ever generated: the primary key is what stops a reminder going out twice.
CREATE TABLE reminders_sent (
  gym_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  type TEXT NOT NULL,
  for_date TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (subscription_id, type, for_date)
);

-- Pushes waiting to go out. The free Workers plan allows 50 outgoing requests per run, so the hourly
-- cron sends what fits and the next run carries on.
CREATE TABLE push_queue (
  id TEXT PRIMARY KEY,
  gym_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT NOT NULL,
  tag TEXT,
  followup_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'NO_DEVICE', 'EXPIRED')),
  created_at TEXT NOT NULL,
  sent_at TEXT
);
CREATE INDEX idx_push_queue_status ON push_queue (status, created_at);

CREATE TABLE followups (
  id TEXT PRIMARY KEY,
  gym_id TEXT NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id),
  subscription_id TEXT,
  type TEXT NOT NULL,
  for_date TEXT NOT NULL,
  push_failed INTEGER NOT NULL DEFAULT 0,
  contacted_at TEXT,
  contacted_by TEXT REFERENCES users(id),
  note TEXT,
  UNIQUE (member_id, type, for_date)
);
CREATE INDEX idx_followups_gym_open ON followups (gym_id, contacted_at, for_date);

CREATE TABLE gym_daily_runs (
  gym_id TEXT NOT NULL,
  for_date TEXT NOT NULL,
  ran_at TEXT NOT NULL,
  PRIMARY KEY (gym_id, for_date)
);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  gym_id TEXT NOT NULL,
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  reason TEXT,
  at TEXT NOT NULL
);
CREATE INDEX idx_audit_gym_at ON audit_log (gym_id, at);
