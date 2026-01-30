from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.db import query_db
from app.utils.decorators import role_required
from app.utils.serializers import serialize_rows

student_bp = Blueprint('student', __name__)

@student_bp.route('/timetable', methods=['GET'])
@jwt_required()
@role_required('student')
def get_my_timetable():
    """Get student's timetable based on their department and batch"""
    user_id = get_jwt_identity()
    
    # Get student's department and batch
    student = query_db(
        "SELECT department_id, batch FROM users WHERE id = %s",
        (user_id,),
        one=True
    )
    
    if not student or not student['department_id'] or not student['batch']:
        return jsonify({'error': 'Student department or batch not set'}), 400
    
    day_of_week = request.args.get('day_of_week', type=int)
    
    query = """
        SELECT t.*, d.name as department_name, d.code as department_code,
               c.room_no, c.room_type,
               u.first_name as professor_first_name, u.last_name as professor_last_name
        FROM timetable t
        JOIN departments d ON t.department_id = d.id
        JOIN classrooms c ON t.classroom_id = c.id
        JOIN users u ON t.professor_id = u.id
        WHERE t.department_id = %s AND t.batch = %s
    """
    params = [student['department_id'], student['batch']]
    
    if day_of_week is not None:
        query += " AND t.day_of_week = %s"
        params.append(day_of_week)
    
    query += " ORDER BY t.day_of_week, t.start_time"
    
    timetable = query_db(query, tuple(params))
    timetable = serialize_rows(timetable)
    return jsonify({'timetable': timetable}), 200

@student_bp.route('/auditorium', methods=['GET'])
@jwt_required()
@role_required('student')
def get_auditorium_schedule():
    """Get auditorium booking schedule (view only)"""
    bookings = query_db("""
        SELECT ab.id, ab.event_name, ab.booking_date, ab.start_time, ab.end_time,
               c.room_no
        FROM auditorium_bookings ab
        JOIN classrooms c ON ab.classroom_id = c.id
        WHERE ab.status = 'confirmed'
        AND ab.booking_date >= CURRENT_DATE
        ORDER BY ab.booking_date, ab.start_time
    """)
    
    bookings = serialize_rows(bookings)
    return jsonify({'bookings': bookings}), 200

@student_bp.route('/today', methods=['GET'])
@jwt_required()
@role_required('student')
def get_today_classes():
    """Get today's classes for the student"""
    user_id = get_jwt_identity()
    
    # Get student's department and batch
    student = query_db(
        "SELECT department_id, batch FROM users WHERE id = %s",
        (user_id,),
        one=True
    )
    
    if not student or not student['department_id'] or not student['batch']:
        return jsonify({'error': 'Student department or batch not set'}), 400
    
    # Get current day of week (Python: Monday=0, Sunday=6)
    from datetime import datetime
    today = datetime.now().weekday()
    
    classes = query_db("""
        SELECT t.*, d.name as department_name,
               c.room_no, c.room_type,
               u.first_name as professor_first_name, u.last_name as professor_last_name
        FROM timetable t
        JOIN departments d ON t.department_id = d.id
        JOIN classrooms c ON t.classroom_id = c.id
        JOIN users u ON t.professor_id = u.id
        WHERE t.department_id = %s 
        AND t.batch = %s 
        AND t.day_of_week = %s
        ORDER BY t.start_time
    """, (student['department_id'], student['batch'], today))
    
    classes = serialize_rows(classes)
    return jsonify({'classes': classes}), 200

@student_bp.route('/classmates', methods=['GET'])
@jwt_required()
@role_required('student')
def get_classmates():
    """Get classmates in the same department and batch"""
    user_id = get_jwt_identity()
    
    # Get student's department and batch
    student = query_db(
        "SELECT department_id, batch FROM users WHERE id = %s",
        (user_id,),
        one=True
    )
    
    if not student or not student['department_id'] or not student['batch']:
        return jsonify({'error': 'Student department or batch not set'}), 400
    
    classmates = query_db("""
        SELECT id, email, first_name, last_name
        FROM users 
        WHERE role = 'student' 
        AND department_id = %s 
        AND batch = %s 
        AND id != %s
        AND is_active = TRUE
        ORDER BY last_name, first_name
    """, (student['department_id'], student['batch'], user_id))
    
    return jsonify({'classmates': classmates}), 200
