-- Which batches a gym runs (the time-of-day choices its members see). Most gyms run a morning and an evening batch;
-- an owner can turn on afternoon and night in Settings. Members who already have another batch keep it.
ALTER TABLE gyms ADD COLUMN batches TEXT NOT NULL DEFAULT 'MORNING,EVENING';
