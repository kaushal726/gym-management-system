-- Each gym has exactly one main owner, set by the platform admin when the gym is onboarded.
-- The owner adds managers and trainers, never a second owner.
CREATE UNIQUE INDEX idx_one_owner_per_gym ON gym_staff (gym_id) WHERE role = 'OWNER' AND active = 1;
