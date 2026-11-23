-- Adds the TRAINER staff role. SQLite cannot change a CHECK constraint in place, so gym_staff is rebuilt
-- with the same columns and data. 0001 has already run, so it is left untouched.
CREATE TABLE gym_staff_new (
  gym_id TEXT NOT NULL REFERENCES gyms(id),
  invite_email TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'MANAGER', 'TRAINER')),
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (gym_id, invite_email)
);
INSERT INTO gym_staff_new (gym_id, invite_email, user_id, role, active, created_by, created_at)
  SELECT gym_id, invite_email, user_id, role, active, created_by, created_at FROM gym_staff;
DROP TABLE gym_staff;
ALTER TABLE gym_staff_new RENAME TO gym_staff;
CREATE INDEX idx_staff_user ON gym_staff (user_id);
CREATE INDEX idx_staff_email ON gym_staff (invite_email);
