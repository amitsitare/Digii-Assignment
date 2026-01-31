-- Add registered_by to users: the admin who created this professor/student (run once for existing DBs)
ALTER TABLE users ADD COLUMN IF NOT EXISTS registered_by INTEGER REFERENCES users(id);
