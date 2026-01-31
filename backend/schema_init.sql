-- Idempotent schema init: creates tables/indexes only if they don't exist.
-- Safe to run on every app startup (used by init_schema() in db.py).

-- Departments table
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(10) UNIQUE NOT NULL
);

-- Classrooms table
CREATE TABLE IF NOT EXISTS classrooms (
    id SERIAL PRIMARY KEY,
    room_no VARCHAR(20) UNIQUE NOT NULL,
    capacity INTEGER,
    room_type VARCHAR(20) CHECK (room_type IN ('classroom', 'auditorium', 'lab')) DEFAULT 'classroom'
);

-- Users table with role-based hierarchy
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'professor', 'student')),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    department_id INTEGER REFERENCES departments(id),
    batch VARCHAR(20),
    registered_by INTEGER REFERENCES users(id),
    must_change_password BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Timetable entries
CREATE TABLE IF NOT EXISTS timetable (
    id SERIAL PRIMARY KEY,
    department_id INTEGER REFERENCES departments(id) NOT NULL,
    batch VARCHAR(20) NOT NULL,
    classroom_id INTEGER REFERENCES classrooms(id) NOT NULL,
    professor_id INTEGER REFERENCES users(id) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Auditorium bookings
CREATE TABLE IF NOT EXISTS auditorium_bookings (
    id SERIAL PRIMARY KEY,
    classroom_id INTEGER REFERENCES classrooms(id) NOT NULL,
    booked_by INTEGER REFERENCES users(id) NOT NULL,
    event_name VARCHAR(200),
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'confirmed'
);

-- Messages for chat
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id) NOT NULL,
    message_type VARCHAR(20) CHECK (message_type IN ('broadcast', 'direct', 'department', 'batch')) NOT NULL,
    content TEXT NOT NULL,
    target_department_id INTEGER REFERENCES departments(id),
    target_batch VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Message recipients for direct messages
CREATE TABLE IF NOT EXISTS message_recipients (
    id SERIAL PRIMARY KEY,
    message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
    recipient_id INTEGER REFERENCES users(id) NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    title VARCHAR(200),
    content TEXT,
    notification_type VARCHAR(30),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes (IF NOT EXISTS supported in PostgreSQL 9.5+)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_timetable_department_batch ON timetable(department_id, batch);
CREATE INDEX IF NOT EXISTS idx_timetable_professor ON timetable(professor_id);
CREATE INDEX IF NOT EXISTS idx_timetable_day ON timetable(day_of_week);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_message_recipients_recipient ON message_recipients(recipient_id);

-- Seed data: insert only if not already present (idempotent)
INSERT INTO departments (name, code) VALUES
    ('Computer Science Engineering', 'CSE'),
    ('Electronics and Communication', 'ECE'),
    ('Mechanical Engineering', 'ME'),
    ('Civil Engineering', 'CE'),
    ('Information Technology', 'IT')
ON CONFLICT (code) DO NOTHING;

INSERT INTO classrooms (room_no, capacity, room_type) VALUES
    ('101', 60, 'classroom'),
    ('102', 60, 'classroom'),
    ('103', 40, 'classroom'),
    ('201', 60, 'classroom'),
    ('202', 60, 'classroom'),
    ('203', 40, 'classroom'),
    ('301', 80, 'classroom'),
    ('Main Auditorium', 500, 'auditorium'),
    ('Mini Auditorium', 150, 'auditorium')
ON CONFLICT (room_no) DO NOTHING;

-- Ensure migration columns exist on existing DBs (no-op if already present)
ALTER TABLE users ADD COLUMN IF NOT EXISTS registered_by INTEGER REFERENCES users(id);
ALTER TABLE timetable ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
