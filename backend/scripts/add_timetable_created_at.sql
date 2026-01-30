-- Add created_at to timetable for existing databases (run once if table already exists without created_at)
ALTER TABLE timetable ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
UPDATE timetable SET created_at = updated_at WHERE created_at IS NULL;
