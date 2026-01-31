from app.db import query_db, insert_db


def _serialize_notification(row):
    """Convert notification row to JSON-friendly dict (e.g. for socket emit)."""
    if not row:
        return None
    out = dict(row)
    if hasattr(out.get('created_at'), 'isoformat'):
        out['created_at'] = out['created_at'].isoformat()
    return out


def create_notification(user_id, title, content, notification_type):
    """Create a new notification for a user and emit real-time event via Socket.IO."""
    new_id = insert_db(
        """INSERT INTO notifications (user_id, title, content, notification_type)
           VALUES (%s, %s, %s, %s)""",
        (user_id, title, content, notification_type)
    )
    row = query_db(
        "SELECT id, user_id, title, content, notification_type, is_read, created_at FROM notifications WHERE id = %s",
        (new_id,),
        one=True
    )
    payload = _serialize_notification(row)

    # Emit real-time event so the user's client updates without polling
    try:
        from app import socketio
        if socketio is not None and payload:
            socketio.emit('new_notification', payload, room=f'user_{user_id}')
    except Exception:
        pass  # Vercel/serverless: socketio may be None; ignore

    return new_id

def notify_students_of_timetable_change(timetable_entry, change_type='updated'):
    """Notify all students of a department/batch about timetable changes"""
    # Get all students in the department and batch
    students = query_db(
        """SELECT id FROM users 
           WHERE role = 'student' 
           AND department_id = %s 
           AND batch = %s 
           AND is_active = TRUE""",
        (timetable_entry['department_id'], timetable_entry['batch'])
    )
    
    if change_type == 'created':
        title = "New Class Added"
        content = f"New class {timetable_entry['subject']} has been added to your timetable."
    elif change_type == 'updated':
        title = "Class Rescheduled"
        content = f"Class {timetable_entry['subject']} has been rescheduled."
    else:
        title = "Class Removed"
        content = f"Class {timetable_entry['subject']} has been removed from your timetable."
    
    for student in students:
        create_notification(student['id'], title, content, f'timetable_{change_type}')
    
    return len(students)

def notify_class_reminder(timetable_entry):
    """Send 15-minute reminder notification to students"""
    # Get all students in the department and batch
    students = query_db(
        """SELECT id FROM users 
           WHERE role = 'student' 
           AND department_id = %s 
           AND batch = %s 
           AND is_active = TRUE""",
        (timetable_entry['department_id'], timetable_entry['batch'])
    )
    
    # Get classroom info
    classroom = query_db(
        "SELECT room_no FROM classrooms WHERE id = %s",
        (timetable_entry['classroom_id'],),
        one=True
    )
    
    room_no = classroom['room_no'] if classroom else 'TBA'
    
    title = "Upcoming Class"
    content = f"{timetable_entry['subject']} starts in 15 minutes - Room {room_no}"
    
    for student in students:
        create_notification(student['id'], title, content, 'class_reminder')
    
    return len(students)


def notify_all_users_auditorium_booking(classroom, booking_data):
    """Notify all active users about a new auditorium booking."""
    users = query_db(
        "SELECT id FROM users WHERE is_active = TRUE"
    )

    room_no = classroom.get('room_no', 'Auditorium')
    title = "Auditorium Booking"
    content = (
        f"Auditorium {room_no} booked for '{booking_data['event_name']}' "
        f"on {booking_data['booking_date']} from {booking_data['start_time']} "
        f"to {booking_data['end_time']}."
    )

    for user in users:
        create_notification(user['id'], title, content, 'auditorium_booking')

    return len(users)


def get_user_notifications(user_id, limit=20, unread_only=False):
    """Get notifications for a user"""
    if unread_only:
        return query_db(
            """SELECT * FROM notifications 
               WHERE user_id = %s AND is_read = FALSE 
               ORDER BY created_at DESC LIMIT %s""",
            (user_id, limit)
        )
    return query_db(
        """SELECT * FROM notifications 
           WHERE user_id = %s 
           ORDER BY created_at DESC LIMIT %s""",
        (user_id, limit)
    )

def mark_notification_read(notification_id, user_id):
    """Mark a notification as read"""
    return query_db(
        """UPDATE notifications 
           SET is_read = TRUE 
           WHERE id = %s AND user_id = %s""",
        (notification_id, user_id)
    )

def mark_all_notifications_read(user_id):
    """Mark all notifications as read for a user"""
    return query_db(
        "UPDATE notifications SET is_read = TRUE WHERE user_id = %s",
        (user_id,)
    )

def get_unread_count(user_id):
    """Get count of unread notifications"""
    result = query_db(
        "SELECT COUNT(*) as count FROM notifications WHERE user_id = %s AND is_read = FALSE",
        (user_id,),
        one=True
    )
    return result['count'] if result else 0
