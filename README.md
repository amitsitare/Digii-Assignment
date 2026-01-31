# CampusOne

> A full-stack web app that solves **the coordination problem** on campus: one source of truth for schedules, clear ownership, and real-time notifications so students and staff stay informed without manual chasing.

---

## Table of contents

| Section | Description |
|--------|-------------|
| [At a glance](#at-a-glance) | One-screen summary |
| [Assignment answers](#assignment-what-this-repository-delivers) | Problem, solution, assumptions, scope |
| [Software wireframe](#software-wireframe) | UI flow and screen layout |
| [Entities we create](#entities-we-create) | Domain entities and purpose |
| [APIs we create](#apis-we-create) | All HTTP endpoints for use |
| [SQL tables & ER diagram](#sql-tables--er-diagram) | Database schema and relationships |
| [Features implemented](#features-implemented) | What the system does, by area |
| [How to run](#how-to-run-this-project) | Quick start |
| [Setup](#setup-instructions) | Database, backend, frontend, env |
| [Example commands](#example-commands) | Launch and test |
| [Code & APIs](#code-included) | Core logic, project structure |
| [Project structure](#project-structure) | Folder layout |

---

## At a glance

| | |
|--|--|
| **Problem** | Students and staff don’t know the latest schedule; coordination is manual and error-prone. |
| **Solution** | Single timetable + auditorium in DB; role-based ownership; notifications on change + 15‑min reminders. |
| **Stack** | Backend: Flask, PostgreSQL, JWT, Socket.IO, APScheduler. Frontend: React, Bootstrap, Socket.IO client. |
| **Run** | DB → `backend/schema_init.sql` → `cd backend && python run.py` → `cd frontend && npm start` → http://localhost:3000 |

---

## Assignment: What This Repository Delivers

### 1. What problem did you choose to solve?

**Problem**

On a mid-sized campus, students often **don’t know the latest status of their schedule** and **act on outdated information** (wrong room, wrong time, missed reschedules). Administrators struggle with **tracking what is planned**, **who is responsible**, and **last-minute changes**. Coordination relies on manual calls, messages, or spreadsheets.

**Concrete focus**

We chose **“Up-to-date schedule visibility and clear ownership”**:

- Students see their current timetable and get notified when it changes or when a class is about to start.
- Professors can reschedule their own classes (with conflict checks); affected students are notified.
- Admins have one place to manage timetables and auditorium bookings, with clear responsibility.

**Why this problem**

- **High impact, clear scope** — Timetable affects everyone daily; fixing wrong room/time is well-bounded.
- **Verifiable** — One place for schedule, changes trigger notifications, responsibility is in the data.
- **One product slice** — Timetable + notifications + reschedule + auditorium ship as a coherent slice.

---

### 2. How does your solution work?

| Pillar | Description |
|--------|-------------|
| **Single source of truth** | All schedules in DB: timetable (dept, batch, room, professor, subject, day, time) and auditorium bookings. No spreadsheets. |
| **Role-based ownership** | Admins: create/update/delete timetable, book auditorium. Professors: reschedule own classes only. Students: read-only. |
| **Proactive notifications** | Timetable create/update/delete → notify affected students. Auditorium book → notify all. Background job: **15‑minute class reminder** (subject + room). |
| **Real-time** | Notifications pushed via Socket.IO when available; frontend falls back to polling (e.g. serverless). |
| **Structured coordination** | Chat (direct, broadcast, department, batch) and auditorium booking replace ad-hoc coordination. |

---

### 3. What assumptions did you make?

- **Single campus** — One DB; no multi-tenant/multi-campus.
- **Admin-provisioned users** — Students/professors added by admin (or CSV); credentials by email. Self-signup only for first admin.
- **Timetable per department + batch** — One timetable per student (dept + batch); no overlapping groups.
- **Professors reschedule classrooms only** — Auditoriums booked by admins only.
- **Real-time best-effort** — Socket.IO when Flask runs; polling on serverless.
- **Email for credentials** — SMTP optional; if it fails, user exists but may not get password.
- **15‑min reminder** — Scheduler uses server time; timezone left to environment.

---

### 4. What we chose not to build

We deliberately **did not** build the following so we could focus on schedule visibility and coordination:

| What we did not build | Why |
|-----------------------|-----|
| **Learning management** (assignments, grades, materials) | Academic content delivery is a different problem; we focus on real-time schedule coordination, not course content. |
| **Student performance analytics** | That is about historical academic data; we target live timetable accuracy and change tracking. |
| **Chat / social messaging** | Unstructured chat adds moderation and privacy complexity; we rely on system-generated notifications for coordination. |
| **Library, lab equipment, or asset tracking** | Those are inventory and resource-management problems, separate from time-based class scheduling. |
| **Campus ERP modules** (finance, HR, admissions) | Institution-wide administration would expand scope beyond our single-purpose coordination layer. |

---

## Software wireframe

Single high-level view: entry → auth → role-based dashboard (navbar + sidebar + main content).

```
                    http://localhost:3000
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
    [ Home ]             [ Login ]           [ Register ]
    Login / Reg          email, pwd            (first admin)
         │                    │
         └────────────────────┼────────────────────┘
                              │ after login
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │  Admin   │   │ Professor│   │ Student  │
        └────┬─────┘   └────┬─────┘   └────┬─────┘
             │              │              │
             └──────────────┼──────────────┘
                            ▼
    ┌─────────────────────────────────────────────────────────┐
    │  Navbar   CampusOne   [Notifications]   [User]   Logout  │
    ├──────────┬──────────────────────────────────────────────┤
    │ Sidebar  │  Main content                                 │
    │ (by role)│  • Admin: stats, users, timetable, auditorium │
    │          │  • Professor: my classes, reschedule         │
    │ Dashboard│  • Student: my timetable, auditorium, alerts │
    │ …        │                                              │
    └──────────┴──────────────────────────────────────────────┘
```

---

## Entities we create

We model the campus coordination domain with the following **entities**. Each corresponds to a main concept users and the system work with.

| Entity | Description | Used for |
|--------|-------------|----------|
| **User** | A person in the system: admin, professor, or student. Has email, name, role, optional department and batch. | Login, ownership (who created/rescheduled/booked), chat, notifications. |
| **Department** | Academic unit (e.g. CSE, ECE). Has name and code. | Grouping users and timetable entries; filtering students/professors; chat targets. |
| **Classroom** | A room: classroom, auditorium, or lab. Has room number, capacity, type. | Timetable slots (which room); auditorium bookings (which venue). |
| **Timetable** | One recurring weekly slot: which department/batch, which room, which professor, subject, day of week, start/end time. | Source of truth for “when and where is class”; conflict checks; notifications on change. |
| **AuditoriumBooking** | A one-off booking of an auditorium: event name, date, start/end time, who booked it. | Events in auditoriums; conflict checks; notifying everyone when booked. |
| **Notification** | A message to one user: title, content, type (e.g. timetable_updated, class_reminder), read/unread. | In-app alerts and 15‑minute class reminders; real-time push or polling. |
| **Message** | A chat message: sender, type (direct / broadcast / department / batch), content, optional target department/batch. | Structured coordination (direct, broadcast, by dept/batch) instead of ad-hoc chats. |
| **MessageRecipient** | Links a direct message to a recipient and tracks read status. | Direct messages and “read” state. |

**Summary:** Users (with roles) and Departments/Classrooms are the core structure; Timetable and AuditoriumBooking are the schedule entities; Notification and Message/MessageRecipient support coordination and alerts.

---

## APIs we create

All APIs are under base URL **`http://localhost:5000/api`**. Protected routes require header: **`Authorization: Bearer <access_token>`**.

### Authentication (`/api/auth`)

| Method | Path | Description | Who |
|--------|------|-------------|-----|
| POST | `/auth/register` | Register first admin (email, password, name). | Public |
| POST | `/auth/login` | Login; returns JWT access token. | Public |
| GET | `/auth/me` | Current user profile (role, department, batch, etc.). | Any logged-in |
| POST | `/auth/change-password` | Change password (current + new). | Any logged-in |
| POST | `/auth/logout` | Logout (client discards token). | Any logged-in |

### Admin (`/api/admin`)

| Method | Path | Description | Who |
|--------|------|-------------|-----|
| POST | `/admin/students` | Add one student (email, name, department_id, batch); sends credentials by email. | Admin |
| POST | `/admin/professors` | Add one professor (email, name, department_id); sends credentials by email. | Admin |
| GET | `/admin/users` | List users; optional filters: role, department_id, batch, search. | Admin |
| DELETE | `/admin/users/<id>` | Deactivate a user (set is_active false). | Admin |
| GET | `/admin/departments` | List all departments. | Admin |
| POST | `/admin/departments` | Add department (name, code). | Admin |
| GET | `/admin/classrooms` | List classrooms; optional room_type. | Admin, Professor |
| POST | `/admin/classrooms` | Add classroom (room_no, capacity, room_type). | Admin |
| DELETE | `/admin/classrooms/<id>` | Delete classroom. | Admin |
| POST | `/admin/auditorium/book` | Book auditorium (classroom_id, event_name, booking_date, start_time, end_time); notifies all users. | Admin |
| GET | `/admin/auditorium/bookings` | List auditorium bookings. | Admin |
| GET | `/admin/stats` | Dashboard counts: students, professors, classrooms, departments. | Admin |
| POST | `/admin/students/upload-csv` | Bulk add students from CSV (email, first_name, last_name, department_code, batch). | Admin |
| POST | `/admin/professors/upload-csv` | Bulk add professors from CSV. | Admin |
| GET | `/admin/students/template` | Download CSV template for students. | Admin |
| GET | `/admin/professors/template` | Download CSV template for professors. | Admin |

### Timetable (`/api/timetable`)

| Method | Path | Description | Who |
|--------|------|-------------|-----|
| GET | `/timetable` | Get timetable; optional filters: department_id, batch, day_of_week, professor_id. | Any logged-in |
| POST | `/timetable` | Create timetable entry; room & professor conflict checks; notifies affected students. | Admin |
| PUT | `/timetable/<id>` | Update timetable entry; notifies affected students. | Admin |
| DELETE | `/timetable/<id>` | Delete timetable entry; notifies affected students. | Admin |
| GET | `/timetable/available-rooms` | Rooms free for given day_of_week, start_time, end_time. | Any logged-in |
| POST | `/timetable/seed` | Insert sample timetable entries (for demo). | Admin |

### Professor (`/api/professor`)

| Method | Path | Description | Who |
|--------|------|-------------|-----|
| GET | `/professor/my-classes` | Professor’s classes; optional day_of_week, rescheduled_only. | Professor |
| PUT | `/professor/reschedule/<id>` | Reschedule own class (day, time, room); conflict checks; notifies affected students. | Professor |
| GET | `/professor/students` | Students in professor’s department; optional batch. | Professor |
| GET | `/professor/batches` | Batches the professor teaches. | Professor |

### Student (`/api/student`)

| Method | Path | Description | Who |
|--------|------|-------------|-----|
| GET | `/student/timetable` | Student’s timetable (by department & batch); optional day_of_week. | Student |
| GET | `/student/today` | Today’s classes for the student. | Student |
| GET | `/student/auditorium` | Upcoming auditorium bookings (read-only). | Student |
| GET | `/student/classmates` | Other students in same department and batch. | Student |

### Notifications (`/api/notifications`)

| Method | Path | Description | Who |
|--------|------|-------------|-----|
| GET | `/notifications` | List notifications; optional limit, unread_only. Returns unread_count. | Any logged-in |
| PUT | `/notifications/<id>/read` | Mark one notification as read. | Any logged-in |
| PUT | `/notifications/read-all` | Mark all notifications as read. | Any logged-in |
| GET | `/notifications/unread-count` | Get unread count only. | Any logged-in |

### Chat (`/api/chat`)

| Method | Path | Description | Who |
|--------|------|-------------|-----|
| POST | `/chat/send` | Send message (direct, broadcast, department, or batch). | Any logged-in |
| GET | `/chat/messages` | Get messages (inbox/sent; filters by type). | Any logged-in |
| GET | `/chat/sent` | Get sent messages. | Any logged-in |
| PUT | `/chat/read/<id>` | Mark message as read. | Any logged-in |
| GET | `/chat/recipients` | Get recipients for a message. | Any logged-in |
| GET | `/chat/users/search` | Search users (for direct messages). | Any logged-in |
| GET | `/chat/conversations` | List conversations. | Any logged-in |
| GET | `/chat/conversation/<other_user_id>` | Messages with one user. | Any logged-in |
| GET | `/chat/sent/to-recipients` | Sent messages with recipient info. | Any logged-in |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server health check (no auth). |

---

## SQL tables & ER diagram

We use **PostgreSQL** and define the following tables in **`backend/schema_init.sql`**. The diagram below shows tables and foreign-key relationships.

### Table list (short)

| Table | Purpose |
|-------|---------|
| **departments** | id, name, code (unique). |
| **classrooms** | id, room_no (unique), capacity, room_type (classroom / auditorium / lab). |
| **users** | id, email (unique), password_hash, role (admin/professor/student), first_name, last_name, department_id → departments, batch, registered_by → users, must_change_password, created_at, is_active. |
| **timetable** | id, department_id → departments, batch, classroom_id → classrooms, professor_id → users, subject, day_of_week (0–6), start_time, end_time, created_by → users, created_at, updated_at. |
| **auditorium_bookings** | id, classroom_id → classrooms, booked_by → users, event_name, booking_date, start_time, end_time, status. |
| **notifications** | id, user_id → users, title, content, notification_type, is_read, created_at. |
| **messages** | id, sender_id → users, message_type (broadcast/direct/department/batch), content, target_department_id → departments, target_batch, created_at. |
| **message_recipients** | id, message_id → messages, recipient_id → users, is_read, read_at. |

### ER diagram (relationships)

```
                    ┌─────────────────┐
                    │   departments   │
                    │ id (PK)         │
                    │ name, code      │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│     users       │  │   timetable      │  │    messages     │
│ id (PK)         │  │ id (PK)          │  │ id (PK)          │
│ email, role     │  │ department_id(FK)│  │ sender_id (FK)   │
│ department_id(FK)│  │ batch           │  │ message_type     │
│ batch           │  │ classroom_id(FK) │  │ target_dept_id(FK)
│ registered_by(FK)│  │ professor_id(FK)│  │ target_batch     │
└────────┬────────┘  │ subject         │  └────────┬────────┘
         │           │ day_of_week     │           │
         │           │ start_time,     │           │
         │           │ end_time        │           ▼
         │           │ created_by (FK) │  ┌─────────────────────┐
         │           └────────┬────────┘  │ message_recipients  │
         │                    │          │ id (PK)              │
         │                    │          │ message_id (FK)      │
         │                    │          │ recipient_id (FK)    │
         │                    │          │ is_read, read_at     │
         │                    │          └─────────────────────┘
         │                    │
         │           ┌────────┴────────┐
         │           ▼                 ▼
         │  ┌─────────────────┐  ┌─────────────────────┐
         │  │   classrooms    │  │ auditorium_bookings │
         │  │ id (PK)         │  │ id (PK)              │
         │  │ room_no, type   │  │ classroom_id (FK)   │
         │  │ capacity        │  │ booked_by (FK) →users│
         │  └─────────────────┘  │ event_name, date   │
         │                        │ start_time, end_time│
         │                        └─────────────────────┘
         │
         ▼
┌─────────────────┐
│  notifications  │
│ id (PK)         │
│ user_id (FK)    │
│ title, content  │
│ notification_type
│ is_read         │
│ created_at      │
└─────────────────┘
```

**Relationships in words:**

- **departments** → users (users.department_id), timetable (timetable.department_id), messages (messages.target_department_id).
- **classrooms** → timetable (timetable.classroom_id), auditorium_bookings (classroom_id).
- **users** → timetable (professor_id, created_by), auditorium_bookings (booked_by), notifications (user_id), messages (sender_id), message_recipients (recipient_id), users (registered_by).

---

## Features implemented

What the system does, grouped by area. This is the set of **features** we implemented to solve the coordination problem.

### Authentication & users

- **Register** — First admin can self-register (email, password, name).
- **Login / Logout** — JWT-based login; client stores token; logout discards it.
- **Change password** — Logged-in user can set a new password.
- **Current user** — `/auth/me` returns profile (role, department, batch, name).
- **Role-based access** — Routes protected by role (admin, professor, student); frontend shows role-specific menus and pages.

### Admin: users & structure

- **Add student** — Single student (email, name, department, batch); temp password sent by email.
- **Add professor** — Single professor (email, name, department); temp password sent by email.
- **Bulk add students** — CSV upload (email, first_name, last_name, department_code, batch).
- **Bulk add professors** — CSV upload for professors.
- **CSV templates** — Download template files for students and professors.
- **List users** — With filters (role, department, batch, search).
- **Deactivate user** — Soft-disable a user (is_active = false).
- **Departments** — List and add departments (name, code).
- **Classrooms** — List, add, delete classrooms (room_no, capacity, room_type).

### Admin: timetable & auditorium

- **Create timetable entry** — Department, batch, room, professor, subject, day, start/end time; room and professor conflict checks.
- **Update timetable entry** — Change time, room, subject, etc.; conflict checks; notify affected students.
- **Delete timetable entry** — Remove entry; notify affected students before delete.
- **View timetable** — Filter by department, batch, day, professor.
- **Available rooms** — Get rooms free for a given day and time slot.
- **Seed timetable** — Insert sample entries for demo.
- **Book auditorium** — Event name, date, time; conflict check; notify all users.
- **List auditorium bookings** — View all upcoming/confirmed bookings.
- **Dashboard stats** — Counts of students, professors, classrooms, departments.

### Professor

- **My classes** — List professor’s classes; optional filter by day or “rescheduled only”.
- **Reschedule class** — Change date, time, or room for own class only; room and professor conflict checks; students notified.
- **My schedule view** — Calendar + grid view of timetable; only own classes clickable to reschedule.
- **Rescheduled list** — List of classes that have been rescheduled (updated_at > created_at).
- **Students & batches** — List students in department; list batches professor teaches (for messaging or context).

### Student

- **My timetable** — Weekly timetable for student’s department and batch (read-only).
- **Today’s classes** — List of classes for current day.
- **My Timetable page** — Calendar + day view of own timetable.
- **Auditorium schedule** — View upcoming auditorium events (read-only).
- **Classmates** — List other students in same department and batch.

### Notifications

- **Timetable change notifications** — When admin or professor creates/updates/deletes a timetable entry, affected students get a notification (e.g. “Class Rescheduled”).
- **15-minute class reminder** — Background job every minute finds classes starting in ~15 minutes and sends “Upcoming Class” (subject + room) to affected students.
- **Auditorium booking notification** — When admin books an auditorium, all users get a notification.
- **List notifications** — Get user’s notifications (with limit, unread_only); response includes unread count.
- **Mark read** — Mark one or all notifications as read.
- **Unread count** — Endpoint and UI badge for unread count.
- **Real-time push** — When server supports Socket.IO, new notifications are pushed to the user’s browser; otherwise frontend polls.

### Chat / messaging

- **Send message** — Direct (to user), broadcast (all), department, or batch.
- **View messages** — Inbox, sent, conversations, or thread with one user.
- **Search users** — For choosing direct-message recipient.
- **Mark as read** — Mark a direct message as read.
- **Recipients** — See who received a message.

### Frontend & UX

- **Home** — Public landing with Login / Register.
- **Login / Register** — Forms with validation and error handling.
- **Role-based dashboards** — Separate UIs for Admin, Professor, Student (sidebar + main content).
- **Navbar** — CampusOne logo, Notifications dropdown (with count), User menu, Logout.
- **Sidebar** — Role-specific menu (Dashboard, Timetable, Auditorium, Messages, etc.).
- **Timetable calendar** — Date picker + day view for timetable (admin, professor, student).
- **Reschedule modal** — Professor: pick new date, time, room; submit with conflict feedback.
- **Protected routes** — Unauthenticated or wrong-role users redirected to login or home.
- **Change password page** — For first login or voluntary change.

---

## How to run this project

1. **Database** — Create DB, run `backend/schema_init.sql` (see [Setup](#setup-instructions)).
2. **Backend** — In `backend/`: `.env` (DB, JWT, optional mail) → `python run.py` → http://localhost:5000.
3. **Frontend** — In `frontend/`: `.env` (API + Socket URL) → `npm install` → `npm start` → http://localhost:3000.
4. **Use** — Register (first admin) → add depts, rooms, users → create timetable → log in as professor/student to test.

---

## Setup instructions

**Prerequisites:** Python 3.8+, Node.js 16+, PostgreSQL 12+.

### 1. Database

```bash
psql -U postgres -c "CREATE DATABASE campus_db;"
psql -U postgres -d campus_db -f backend/schema_init.sql
```

### 2. Backend

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate   |   Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
# Create .env (DB_*, JWT_*, optional MAIL_*, CORS_ORIGINS)
python run.py
```

→ http://localhost:5000 | API: http://localhost:5000/api | Health: http://localhost:5000/api/health

### 3. Frontend

```bash
cd frontend
npm install
# Create .env: REACT_APP_API_URL, REACT_APP_SOCKET_URL
npm start
```

→ http://localhost:3000

### 4. Environment variables

**Backend (`backend/.env`):** `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_PORT`, `JWT_SECRET_KEY`, optional `MAIL_*`, `CORS_ORIGINS`.

**Frontend (`frontend/.env`):** `REACT_APP_API_URL` (e.g. http://localhost:5000/api), `REACT_APP_SOCKET_URL` (e.g. http://localhost:5000).

---

## Example commands

**Launch**

```bash
cd backend && python run.py
cd frontend && npm start
```

**Test API**

```bash
curl http://localhost:5000/api/health
curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@example.com\",\"password\":\"your-password\"}"
```

**Manual test:** Register → Admin: add dept, rooms, users, timetable → Professor: reschedule a class → Student: see timetable and notifications.

---

## Code included

- **Entities** — See [Entities we create](#entities-we-create).
- **APIs** — See [APIs we create](#apis-we-create).
- **SQL tables & ER diagram** — See [SQL tables & ER diagram](#sql-tables--er-diagram).
- **Features** — See [Features implemented](#features-implemented).

### Core logic (backend)

| Module | Responsibility |
|--------|----------------|
| `notification_service.py` | Create notifications; notify on timetable change, 15‑min reminder, auditorium book; Socket.IO emit |
| `scheduler_service.py` | Every minute: classes in ~15 min → notify_class_reminder |
| `timetable.py` | CRUD + conflict checks; notify students on create/update/delete |
| `professor.py` | My classes; reschedule own only + conflicts; notify students |
| `student.py` | My timetable, today, auditorium |
| `admin.py` | Users, depts, classrooms, auditorium book/list, stats |
| `decorators.py` | @role_required |

---

## Project structure

```
├── backend/
│   ├── app/
│   │   ├── __init__.py, config.py, db.py
│   │   ├── api/          auth, admin, professor, student, timetable, chat, notifications
│   │   ├── services/     email_service, notification_service, scheduler_service
│   │   └── utils/        decorators, serializers
│   ├── schema_init.sql
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   └── src/
│       ├── components/   Navbar, Sidebar, NotificationDropdown, ProtectedRoute, TimetableCalendar
│       ├── pages/        Home, Login, Register, *Dashboard, ChatPage
│       ├── context/      AuthContext, NotificationContext
│       ├── services/     api, authService, adminService, timetableService, notificationService, chatService
│       └── hooks/        useSocket
└── README.md
```

---

## Tech stack

- **Backend:** Flask, PostgreSQL (psycopg2), Flask-JWT-Extended, Flask-SocketIO, Flask-Mail, APScheduler  
- **Frontend:** React (CRA), React-Bootstrap, Axios, Socket.IO client

---

**CampusOne** — One source of truth, clear ownership, real-time notifications.
