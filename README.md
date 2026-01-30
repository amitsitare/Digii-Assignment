# CampusOne

A full-stack web application for managing campus resources including timetables, classrooms, and communication between administration, professors, and students.

## Features

- **Role-based Access Control**: Admin, Professor, and Student roles with specific permissions
- **Timetable Management**: Create, view, and manage class schedules
- **Real-time Notifications**: Get notified of schedule changes and 15-minute class reminders
- **Messaging System**: Direct messages, broadcast, department, and batch messaging
- **Auditorium Booking**: Book and view auditorium schedules

## Tech Stack

### Backend
- Flask (Python web framework)
- PostgreSQL with psycopg2 (Database)
- Flask-JWT-Extended (Authentication)
- Flask-SocketIO (Real-time communication)
- Flask-Mail (Email service)
- APScheduler (Background tasks)

### Frontend
- React.js (Create React App)
- Bootstrap 5 + React-Bootstrap (UI framework)
- Axios (HTTP client)
- Socket.IO Client (Real-time updates)

## Prerequisites

- Python 3.8+
- Node.js 16+
- PostgreSQL 12+

## Setup Instructions

### 1. Database Setup

```bash
# Create database
psql -U postgres
CREATE DATABASE campus_db;
\q

# Run schema
psql -U postgres -d campus_db -f backend/schema.sql
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file (copy from .env.example)
copy .env.example .env
# Edit .env with your database credentials and email settings

# Run the server
python run.py
```

The backend will start at `http://localhost:5000`

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

The frontend will start at `http://localhost:3000`

## Environment Variables

### Backend (.env)

```env
DB_HOST=localhost
DB_NAME=campus_db
DB_USER=postgres
DB_PASSWORD=your-password
DB_PORT=5432

JWT_SECRET_KEY=your-secret-key

MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
```

### Frontend (.env)

```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

## User Roles & Permissions

### Administration
- Self-register via Register page
- Add students and professors (credentials sent via email)
- Manage all timetables (create, update, delete)
- Book auditoriums
- Message anyone

### Professors
- Login with provided credentials
- View own classes
- Reschedule own classes
- Message department students

### Students
- Login with provided credentials
- View timetable (read-only)
- View auditorium schedule
- Receive notifications
- Chat with classmates

## API Endpoints

### Authentication
- `POST /api/auth/register` - Admin registration
- `POST /api/auth/login` - User login
- `POST /api/auth/change-password` - Change password
- `GET /api/auth/me` - Get current user

### Admin
- `POST /api/admin/students` - Add student
- `POST /api/admin/professors` - Add professor
- `GET /api/admin/users` - List users
- `GET /api/admin/departments` - List departments
- `POST /api/admin/auditorium/book` - Book auditorium

### Timetable
- `GET /api/timetable` - Get timetable (with filters)
- `POST /api/timetable` - Create entry (admin)
- `PUT /api/timetable/:id` - Update entry (admin)
- `DELETE /api/timetable/:id` - Delete entry (admin)

### Professor
- `GET /api/professor/my-classes` - Get own classes
- `PUT /api/professor/reschedule/:id` - Reschedule class

### Student
- `GET /api/student/timetable` - Get own timetable
- `GET /api/student/auditorium` - Get auditorium schedule

### Chat
- `POST /api/chat/send` - Send message
- `GET /api/chat/messages` - Get messages
- `GET /api/chat/users/search` - Search users

### Notifications
- `GET /api/notifications` - Get notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read

## Project Structure

```
c:\Amit\
├── backend/
│   ├── app/
│   │   ├── __init__.py         # Flask app factory
│   │   ├── config.py           # Configuration
│   │   ├── db.py               # Database helpers
│   │   ├── api/
│   │   │   ├── auth.py         # Auth endpoints
│   │   │   ├── admin.py        # Admin endpoints
│   │   │   ├── professor.py    # Professor endpoints
│   │   │   ├── student.py      # Student endpoints
│   │   │   ├── timetable.py    # Timetable endpoints
│   │   │   ├── chat.py         # Chat endpoints
│   │   │   └── notifications.py
│   │   ├── services/
│   │   │   ├── email_service.py
│   │   │   ├── notification_service.py
│   │   │   └── scheduler_service.py
│   │   └── utils/
│   │       ├── decorators.py
│   │       └── validators.py
│   ├── schema.sql              # Database schema
│   ├── requirements.txt
│   └── run.py
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   ├── Navbar.js
│   │   │   │   ├── Sidebar.js
│   │   │   │   ├── NotificationDropdown.js
│   │   │   │   └── ProtectedRoute.js
│   │   ├── pages/
│   │   │   ├── Home.js
│   │   │   ├── Login.js
│   │   │   ├── Register.js
│   │   │   ├── ChangePassword.js
│   │   │   ├── AdminDashboard.js
│   │   │   ├── ProfessorDashboard.js
│   │   │   ├── StudentDashboard.js
│   │   │   └── ChatPage.js
│   │   ├── context/
│   │   │   ├── AuthContext.js
│   │   │   └── NotificationContext.js
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   ├── authService.js
│   │   │   ├── adminService.js
│   │   │   ├── timetableService.js
│   │   │   ├── chatService.js
│   │   │   └── notificationService.js
│   │   ├── hooks/
│   │   │   └── useSocket.js
│   │   ├── utils/
│   │   │   └── constants.js
│   │   ├── App.js
│   │   ├── App.css
│   │   └── index.js
│   └── package.json
│
└── README.md
```

## License

MIT License

---
**CampusOne** - Simplifying Campus Operations
