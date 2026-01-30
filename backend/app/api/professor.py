from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.db import query_db, execute_db
from app.utils.decorators import role_required
from app.utils.serializers import serialize_rows
from app.services.notification_service import notify_students_of_timetable_change

professor_bp = Blueprint('professor', __name__)

@professor_bp.route('/my-classes', methods=['GET'])
@jwt_required()
@role_required('professor')
def get_my_classes():
    """Get professor's own classes. Optional rescheduled_only=1 returns only classes that were rescheduled (updated_at > created_at)."""
    user_id = get_jwt_identity()
    day_of_week = request.args.get('day_of_week', type=int)
    rescheduled_only = request.args.get('rescheduled_only', type=str) in ('1', 'true', 'yes')
    
    query = """
        SELECT t.*, d.name as department_name, d.code as department_code,
               c.room_no, c.room_type
        FROM timetable t
        JOIN departments d ON t.department_id = d.id
        JOIN classrooms c ON t.classroom_id = c.id
        WHERE t.professor_id = %s
    """
    params = [user_id]
    
    if day_of_week is not None:
        query += " AND t.day_of_week = %s"
        params.append(day_of_week)
    
    if rescheduled_only:
        query += " AND t.created_at IS NOT NULL AND t.updated_at > t.created_at"
    
    query += " ORDER BY t.day_of_week, t.start_time"
    
    classes = query_db(query, tuple(params))
    classes = serialize_rows(classes)
    return jsonify({'classes': classes}), 200

@professor_bp.route('/reschedule/<int:entry_id>', methods=['PUT'])
@jwt_required()
@role_required('professor')
def reschedule_class(entry_id):
    """Reschedule a professor's own class"""
    user_id = get_jwt_identity()
    if user_id is None:
        return jsonify({'error': 'Unauthorized'}), 401
    user_id = int(user_id) if isinstance(user_id, str) else user_id

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({'error': 'Request body with reschedule data is required'}), 400

    # Check if entry exists and belongs to this professor
    entry = query_db(
        "SELECT * FROM timetable WHERE id = %s AND professor_id = %s",
        (entry_id, user_id),
        one=True
    )
    
    if not entry:
        return jsonify({'error': 'Class not found or not authorized'}), 404

    # Coerce values from request or use existing entry
    try:
        new_day = int(data.get('day_of_week', entry['day_of_week']))
        new_room = int(data.get('classroom_id', entry['classroom_id']))
    except (TypeError, ValueError):
        return jsonify({'error': 'day_of_week and classroom_id must be numbers'}), 400

    new_start = data.get('start_time') or str(entry['start_time'])
    new_end = data.get('end_time') or str(entry['end_time'])
    # Normalize time to HH:MM or HH:MM:SS for PostgreSQL TIME
    if len(new_start) == 5 and new_start.count(':') == 1:
        new_start += ':00'
    if len(new_end) == 5 and new_end.count(':') == 1:
        new_end += ':00'
    
    # Validate day_of_week
    if not (0 <= new_day <= 6):
        return jsonify({'error': 'day_of_week must be between 0 and 6'}), 400

    # Only classrooms (no auditorium) allowed for reschedule
    room_row = query_db(
        "SELECT id, room_type FROM classrooms WHERE id = %s",
        (new_room,),
        one=True
    )
    if not room_row:
        return jsonify({'error': 'Room not found'}), 400
    if room_row.get('room_type') != 'classroom':
        return jsonify({'error': 'Only classrooms can be selected for reschedule. Auditoriums are not allowed.'}), 400
    
    # Check for room conflicts (excluding current entry)
    room_conflict = query_db("""
        SELECT id FROM timetable 
        WHERE classroom_id = %s 
        AND day_of_week = %s
        AND id != %s
        AND (
            (start_time <= %s AND end_time > %s) OR
            (start_time < %s AND end_time >= %s) OR
            (start_time >= %s AND end_time <= %s)
        )
    """, (
        new_room, new_day, entry_id,
        new_start, new_start,
        new_end, new_end,
        new_start, new_end
    ), one=True)
    
    if room_conflict:
        return jsonify({'error': 'Room is already booked for this time slot'}), 400
    
    # Check for professor conflicts (excluding current entry)
    professor_conflict = query_db("""
        SELECT id FROM timetable 
        WHERE professor_id = %s 
        AND day_of_week = %s
        AND id != %s
        AND (
            (start_time <= %s AND end_time > %s) OR
            (start_time < %s AND end_time >= %s) OR
            (start_time >= %s AND end_time <= %s)
        )
    """, (
        user_id, new_day, entry_id,
        new_start, new_start,
        new_end, new_end,
        new_start, new_end
    ), one=True)
    
    if professor_conflict:
        return jsonify({'error': 'You already have another class at this time'}), 400
    
    # Update the entry
    execute_db("""
        UPDATE timetable 
        SET day_of_week = %s, start_time = %s, end_time = %s, classroom_id = %s, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
    """, (new_day, new_start, new_end, new_room, entry_id))
    
    # Get updated entry
    updated_entry = query_db("SELECT * FROM timetable WHERE id = %s", (entry_id,), one=True)
    
    # Notify students
    notify_students_of_timetable_change(updated_entry, 'updated')
    
    return jsonify({'message': 'Class rescheduled successfully. Students have been notified.'}), 200

@professor_bp.route('/students', methods=['GET'])
@jwt_required()
@role_required('professor')
def get_my_students():
    """Get students in professor's department"""
    user_id = get_jwt_identity()
    
    # Get professor's department
    professor = query_db("SELECT department_id FROM users WHERE id = %s", (user_id,), one=True)
    
    if not professor or not professor['department_id']:
        return jsonify({'error': 'Department not found'}), 400
    
    batch = request.args.get('batch')
    
    query = """
        SELECT id, email, first_name, last_name, batch
        FROM users 
        WHERE role = 'student' 
        AND department_id = %s 
        AND is_active = TRUE
    """
    params = [professor['department_id']]
    
    if batch:
        query += " AND batch = %s"
        params.append(batch)
    
    query += " ORDER BY batch, last_name, first_name"
    
    students = query_db(query, tuple(params))
    
    return jsonify({'students': students}), 200

@professor_bp.route('/batches', methods=['GET'])
@jwt_required()
@role_required('professor')
def get_my_batches():
    """Get unique batches that professor teaches"""
    user_id = get_jwt_identity()
    
    batches = query_db("""
        SELECT DISTINCT batch FROM timetable 
        WHERE professor_id = %s 
        ORDER BY batch
    """, (user_id,))
    
    return jsonify({'batches': [b['batch'] for b in batches]}), 200
