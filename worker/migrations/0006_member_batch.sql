-- The time of day a member usually trains. Optional; set by the desk or picked at QR sign-up.
ALTER TABLE members ADD COLUMN batch TEXT CHECK (batch IS NULL OR batch IN ('MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'));
