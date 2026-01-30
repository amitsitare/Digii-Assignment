from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.db import query_db, insert_db, execute_db
from app.utils.decorators import role_required
from app.utils.serializers import serialize_rows
from app.services.notification_service import notify_students_of_timetable_change

timetable_bp = Blueprint('timetable', __name__)

@timetable_bp.route('', methods=['GET'])
@jwt_required()
def get_timetable():
    """Get timetable with filters"""
    department_id = request.args.get('department_id')
    batch = request.args.get('batch')
    day_of_week = request.args.get('day_of_week')
    professor_id = request.args.get('professor_id')
    
    query = """
        SELECT t.*, d.name as department_name, d.code as department_code,
               c.room_no, c.room_type,
               u.first_name as professor_first_name, u.last_name as professor_last_name
        FROM timetable t
        JOIN departments d ON t.department_id = d.id
        JOIN classrooms c ON t.classroom_id = c.id
        JOIN users u ON t.professor_id = u.id
        WHERE 1=1
    """
    params = []
    
    if department_id:
        query += " AND t.department_id = %s"
        params.append(department_id)
    
    if batch:
        query += " AND t.batch = %s"
        params.append(batch)
    
    if day_of_week is not None:
        query += " AND t.day_of_week = %s"
        params.append(day_of_week)
    
    if professor_id:
        query += " AND t.professor_id = %s"
        params.append(professor_id)
    
    query += " ORDER BY t.day_of_week, t.start_time"
    
    timetable = query_db(query, tuple(params))
    timetable = serialize_rows(timetable)
    return jsonify({'timetable': timetable}), 200

@timetable_bp.route('', methods=['POST'])
@jwt_required()
@role_required('admin')
def create_timetable_entry():
    """Create a new timetable entry"""
    data = request.get_json()
    user_id = get_jwt_identity()
    
    required_fields = ['department_id', 'batch', 'classroom_id', 'professor_id',
                       'subject', 'day_of_week', 'start_time', 'end_time']
    for field in required_fields:
        val = data.get(field)
        if val is None or (isinstance(val, str) and val.strip() == ''):
            return jsonify({'error': f'{field} is required'}), 400
    
    # Validate day_of_week
    if not (0 <= data['day_of_week'] <= 6):
        return jsonify({'error': 'day_of_week must be between 0 and 6'}), 400
    
    # Check for room conflicts
    room_conflict = query_db("""
        SELECT id FROM timetable 
        WHERE classroom_id = %s 
        AND day_of_week = %s
        AND (
            (start_time <= %s AND end_time > %s) OR
            (start_time < %s AND end_time >= %s) OR
            (start_time >= %s AND end_time <= %s)
        )
    """, (
        data['classroom_id'], data['day_of_week'],
        data['start_time'], data['start_time'],
        data['end_time'], data['end_time'],
        data['start_time'], data['end_time']
    ), one=True)
    
    if room_conflict:
        return jsonify({'error': 'Room is already booked for this time slot'}), 400
    
    # Check for professor conflicts
    professor_conflict = query_db("""
        SELECT id FROM timetable 
        WHERE professor_id = %s 
        AND day_of_week = %s
        AND (
            (start_time <= %s AND end_time > %s) OR
            (start_time < %s AND end_time >= %s) OR
            (start_time >= %s AND end_time <= %s)
        )
    """, (
        data['professor_id'], data['day_of_week'],
        data['start_time'], data['start_time'],
        data['end_time'], data['end_time'],
        data['start_time'], data['end_time']
    ), one=True)
    
    if professor_conflict:
        return jsonify({'error': 'Professor is already assigned to another class at this time'}), 400
    
    # Create timetable entry
    entry_id = insert_db("""
        INSERT INTO timetable 
        (department_id, batch, classroom_id, professor_id, subject, day_of_week, start_time, end_time, created_by)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        data['department_id'], data['batch'], data['classroom_id'], data['professor_id'],
        data['subject'], data['day_of_week'], data['start_time'], data['end_time'], user_id
    ))
    
    # Get full entry for notification
    entry = query_db("SELECT * FROM timetable WHERE id = %s", (entry_id,), one=True)
    
    # Notify students
    notify_students_of_timetable_change(entry, 'created')
    
    return jsonify({
        'message': 'Timetable entry created successfully',
        'entry_id': entry_id
    }), 201

@timetable_bp.route('/<int:entry_id>', methods=['PUT'])
@jwt_required()
@role_required('admin')
def update_timetable_entry(entry_id):
    """Update a timetable entry"""
    data = request.get_json()
    
    # Check if entry exists
    entry = query_db("SELECT * FROM timetable WHERE id = %s", (entry_id,), one=True)
    if not entry:
        return jsonify({'error': 'Timetable entry not found'}), 404
    
    # Build update query
    update_fields = []
    params = []
    
    if 'classroom_id' in data:
        update_fields.append("classroom_id = %s")
        params.append(data['classroom_id'])
    
    if 'day_of_week' in data:
        if not (0 <= data['day_of_week'] <= 6):
            return jsonify({'error': 'day_of_week must be between 0 and 6'}), 400
        update_fields.append("day_of_week = %s")
        params.append(data['day_of_week'])
    
    if 'start_time' in data:
        update_fields.append("start_time = %s")
        params.append(data['start_time'])
    
    if 'end_time' in data:
        update_fields.append("end_time = %s")
        params.append(data['end_time'])
    
    if 'subject' in data:
        update_fields.append("subject = %s")
        params.append(data['subject'])
    
    if not update_fields:
        return jsonify({'error': 'No fields to update'}), 400
    
    update_fields.append("updated_at = CURRENT_TIMESTAMP")
    params.append(entry_id)
    
    execute_db(
        f"UPDATE timetable SET {', '.join(update_fields)} WHERE id = %s",
        tuple(params)
    )
    
    # Get updated entry
    updated_entry = query_db("SELECT * FROM timetable WHERE id = %s", (entry_id,), one=True)
    
    # Notify students
    notify_students_of_timetable_change(updated_entry, 'updated')
    
    return jsonify({'message': 'Timetable entry updated successfully'}), 200

@timetable_bp.route('/<int:entry_id>', methods=['DELETE'])
@jwt_required()
@role_required('admin')
def delete_timetable_entry(entry_id):
    """Delete a timetable entry"""
    entry = query_db("SELECT * FROM timetable WHERE id = %s", (entry_id,), one=True)
    if not entry:
        return jsonify({'error': 'Timetable entry not found'}), 404
    
    # Notify students before deletion
    notify_students_of_timetable_change(entry, 'deleted')
    
    execute_db("DELETE FROM timetable WHERE id = %s", (entry_id,))
    
    return jsonify({'message': 'Timetable entry deleted successfully'}), 200

@timetable_bp.route('/available-rooms', methods=['GET'])
@jwt_required()
def get_available_rooms():
    """Get available rooms for a specific day and time"""
    day_of_week = request.args.get('day_of_week', type=int)
    start_time = request.args.get('start_time')
    end_time = request.args.get('end_time')
    
    if day_of_week is None or not start_time or not end_time:
        return jsonify({'error': 'day_of_week, start_time, and end_time are required'}), 400
    
    # Get all rooms not booked at this time
    available = query_db("""
        SELECT c.* FROM classrooms c
        WHERE c.id NOT IN (
            SELECT classroom_id FROM timetable 
            WHERE day_of_week = %s
            AND (
                (start_time <= %s AND end_time > %s) OR
                (start_time < %s AND end_time >= %s) OR
                (start_time >= %s AND end_time <= %s)
            )
        )
        ORDER BY c.room_no
    """, (
        day_of_week,
        start_time, start_time,
        end_time, end_time,
        start_time, end_time
    ))
    
    return jsonify({'rooms': available}), 200


# Weekly time slots (9:00-9:55 style) for seed data - (start, end)
WEEKLY_SLOTS = [
    ('09:00', '09:55'), ('10:00', '10:55'), ('11:00', '11:55'), ('12:00', '12:55'),
    ('13:00', '13:55'), ('14:00', '14:55'), ('15:00', '15:55'), ('16:00', '16:55'),
]
SAMPLE_SUBJECTS = [
    'Data Structures', 'Algorithms', 'DBMS', 'Computer Networks', 'Operating Systems',
    'Software Engineering', 'Calculus', 'Signals & Systems', 'Digital Electronics',
    'Control Systems', 'Thermodynamics', 'Fluid Mechanics', 'Communication & Ethics',
    'Data Handling in Python', 'Mathematical Foundations',
]


@timetable_bp.route('/seed', methods=['POST'])
@jwt_required()
@role_required('admin')
def seed_timetable():
    """Insert sample timetable entries using available classrooms and departments."""
    departments = query_db("SELECT id, code FROM departments ORDER BY id")
    classrooms = query_db("SELECT id, room_no FROM classrooms WHERE room_type = 'classroom' ORDER BY id")
    professors = query_db("SELECT id FROM users WHERE role = 'professor' AND is_active = TRUE ORDER BY id")

    if not departments:
        return jsonify({'error': 'No departments found'}), 400
    if not classrooms:
        return jsonify({'error': 'No classrooms found'}), 400
    if not professors:
        return jsonify({'error': 'No professors found. Add at least one professor to seed timetable.'}), 400

    created = 0
    batches = ['2024', '2025', '2026']
    user_id = get_jwt_identity()
    idx = 0
    for day in range(7):
        for slot_idx, (start_time, end_time) in enumerate(WEEKLY_SLOTS):
            dept = departments[idx % len(departments)]
            room = classrooms[idx % len(classrooms)]
            prof = professors[idx % len(professors)]
            batch = batches[idx % len(batches)]
            subject = SAMPLE_SUBJECTS[idx % len(SAMPLE_SUBJECTS)]
            conflict = query_db("""
                SELECT id FROM timetable
                WHERE classroom_id = %s AND day_of_week = %s
                AND ((start_time <= %s AND end_time > %s) OR (start_time < %s AND end_time >= %s))
            """, (room['id'], day, start_time, start_time, end_time, end_time), one=True)
            if not conflict:
                try:
                    insert_db("""
                        INSERT INTO timetable
                        (department_id, batch, classroom_id, professor_id, subject, day_of_week, start_time, end_time, created_by)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (dept['id'], batch, room['id'], prof['id'], subject, day, start_time, end_time, user_id))
                    created += 1
                except Exception:
                    pass
            idx += 1
    return jsonify({
        'message': f'Sample timetable created: {created} entries added.',
        'created': created
    }), 201
