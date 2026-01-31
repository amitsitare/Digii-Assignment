from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
import bcrypt
import secrets
import csv
import io

from app.db import query_db, insert_db, execute_db
from app.utils.decorators import role_required
from app.utils.serializers import serialize_rows
from app.utils.validators import validate_email
from app.services.email_service import send_credentials_email
from app.services.notification_service import notify_all_users_auditorium_booking
from app import mail

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/students', methods=['POST'])
@jwt_required()
@role_required('admin')
def add_student():
    """Add a new student"""
    data = request.get_json()
    
    required_fields = ['email', 'first_name', 'last_name', 'department_id', 'batch']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400
    
    email = data['email'].lower().strip()
    
    if not validate_email(email):
        return jsonify({'error': 'Invalid email format'}), 400
    
    # Check if email exists
    existing = query_db("SELECT id FROM users WHERE email = %s", (email,), one=True)
    if existing:
        return jsonify({'error': 'Email already registered'}), 400
    
    # Check if department exists
    dept = query_db("SELECT id FROM departments WHERE id = %s", (data['department_id'],), one=True)
    if not dept:
        return jsonify({'error': 'Department not found'}), 400
    
    # Generate temporary password
    temp_password = secrets.token_urlsafe(12)
    password_hash = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Create student
    user_id = insert_db(
        """INSERT INTO users (email, password_hash, role, first_name, last_name, department_id, batch, must_change_password)
           VALUES (%s, %s, 'student', %s, %s, %s, %s, TRUE)""",
        (email, password_hash, data['first_name'], data['last_name'], data['department_id'], data['batch'])
    )
    
    # Send credentials email
    send_credentials_email(mail, email, temp_password, 'student', data['first_name'])
    
    return jsonify({
        'message': 'Student added successfully. Credentials sent via email.',
        'user_id': user_id
    }), 201

@admin_bp.route('/professors', methods=['POST'])
@jwt_required()
@role_required('admin')
def add_professor():
    """Add a new professor"""
    data = request.get_json()
    
    required_fields = ['email', 'first_name', 'last_name', 'department_id']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400
    
    email = data['email'].lower().strip()
    
    if not validate_email(email):
        return jsonify({'error': 'Invalid email format'}), 400
    
    # Check if email exists
    existing = query_db("SELECT id FROM users WHERE email = %s", (email,), one=True)
    if existing:
        return jsonify({'error': 'Email already registered'}), 400
    
    # Check if department exists
    dept = query_db("SELECT id FROM departments WHERE id = %s", (data['department_id'],), one=True)
    if not dept:
        return jsonify({'error': 'Department not found'}), 400
    
    # Generate temporary password
    temp_password = secrets.token_urlsafe(12)
    password_hash = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Create professor
    user_id = insert_db(
        """INSERT INTO users (email, password_hash, role, first_name, last_name, department_id, must_change_password)
           VALUES (%s, %s, 'professor', %s, %s, %s, TRUE)""",
        (email, password_hash, data['first_name'], data['last_name'], data['department_id'])
    )
    
    # Send credentials email
    send_credentials_email(mail, email, temp_password, 'professor', data['first_name'])
    
    return jsonify({
        'message': 'Professor added successfully. Credentials sent via email.',
        'user_id': user_id
    }), 201

@admin_bp.route('/users', methods=['GET'])
@jwt_required()
@role_required('admin')
def list_users():
    """List all users with filters"""
    role = request.args.get('role')
    department_id = request.args.get('department_id')
    batch = request.args.get('batch')
    search = request.args.get('search', '')
    
    query = """
        SELECT u.id, u.email, u.role, u.first_name, u.last_name, 
               u.department_id, d.name as department_name, u.batch, 
               u.is_active, u.created_at
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE 1=1
    """
    params = []
    
    if role:
        query += " AND u.role = %s"
        params.append(role)
    
    if department_id:
        query += " AND u.department_id = %s"
        params.append(department_id)
    
    if batch:
        query += " AND u.batch = %s"
        params.append(batch)
    
    if search:
        query += " AND (u.first_name ILIKE %s OR u.last_name ILIKE %s OR u.email ILIKE %s)"
        search_pattern = f'%{search}%'
        params.extend([search_pattern, search_pattern, search_pattern])
    
    query += " ORDER BY u.created_at DESC"
    
    users = query_db(query, tuple(params))
    
    return jsonify({'users': users}), 200

@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
@role_required('admin')
def deactivate_user(user_id):
    """Deactivate a user"""
    user = query_db("SELECT * FROM users WHERE id = %s", (user_id,), one=True)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if user['role'] == 'admin':
        return jsonify({'error': 'Cannot deactivate admin users'}), 400
    
    execute_db("UPDATE users SET is_active = FALSE WHERE id = %s", (user_id,))
    
    return jsonify({'message': 'User deactivated successfully'}), 200

@admin_bp.route('/departments', methods=['GET'])
@jwt_required()
@role_required('admin')
def list_departments():
    """List all departments"""
    departments = query_db("SELECT * FROM departments ORDER BY name")
    return jsonify({'departments': departments}), 200

@admin_bp.route('/departments', methods=['POST'])
@jwt_required()
@role_required('admin')
def add_department():
    """Add a new department"""
    data = request.get_json()
    
    if not data.get('name') or not data.get('code'):
        return jsonify({'error': 'Name and code are required'}), 400
    
    # Check if code exists
    existing = query_db("SELECT id FROM departments WHERE code = %s", (data['code'].upper(),), one=True)
    if existing:
        return jsonify({'error': 'Department code already exists'}), 400
    
    dept_id = insert_db(
        "INSERT INTO departments (name, code) VALUES (%s, %s)",
        (data['name'], data['code'].upper())
    )
    
    return jsonify({
        'message': 'Department added successfully',
        'department_id': dept_id
    }), 201

@admin_bp.route('/classrooms', methods=['GET'])
@jwt_required()
@role_required('admin', 'professor')
def list_classrooms():
    """List all classrooms"""
    room_type = request.args.get('room_type')
    
    if room_type:
        classrooms = query_db(
            "SELECT * FROM classrooms WHERE room_type = %s ORDER BY room_no",
            (room_type,)
        )
    else:
        classrooms = query_db("SELECT * FROM classrooms ORDER BY room_no")
    
    return jsonify({'classrooms': classrooms}), 200

@admin_bp.route('/classrooms', methods=['POST'])
@jwt_required()
@role_required('admin')
def add_classroom():
    """Add a new classroom"""
    data = request.get_json()
    
    if not data.get('room_no'):
        return jsonify({'error': 'Room number is required'}), 400
    
    room_type = data.get('room_type', 'classroom')
    if room_type not in ['classroom', 'auditorium']:
        return jsonify({'error': 'Invalid room type'}), 400
    
    # Check if room exists
    existing = query_db("SELECT id FROM classrooms WHERE room_no = %s", (data['room_no'],), one=True)
    if existing:
        return jsonify({'error': 'Room number already exists'}), 400
    
    room_id = insert_db(
        "INSERT INTO classrooms (room_no, capacity, room_type) VALUES (%s, %s, %s)",
        (data['room_no'], data.get('capacity'), room_type)
    )
    
    return jsonify({
        'message': 'Classroom added successfully',
        'classroom_id': room_id
    }), 201


@admin_bp.route('/classrooms/<int:classroom_id>', methods=['DELETE'])
@jwt_required()
@role_required('admin')
def delete_classroom(classroom_id):
    """Delete a classroom permanently (used when a room is no longer available)."""
    classroom = query_db(
        "SELECT * FROM classrooms WHERE id = %s",
        (classroom_id,),
        one=True
    )

    if not classroom:
        return jsonify({'error': 'Classroom not found'}), 404

    # Attempt delete; if there are foreign key constraints, the DB will raise an error
    try:
        execute_db("DELETE FROM classrooms WHERE id = %s", (classroom_id,))
    except Exception as e:
        return jsonify({'error': f'Unable to delete classroom: {str(e)}'}), 400

    return jsonify({'message': 'Classroom deleted successfully'}), 200

@admin_bp.route('/auditorium/book', methods=['POST'])
@jwt_required()
@role_required('admin')
def book_auditorium():
    """Book an auditorium"""
    data = request.get_json()
    user_id = get_jwt_identity()
    
    required_fields = ['classroom_id', 'event_name', 'booking_date', 'start_time', 'end_time']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400
    
    # Check if classroom is an auditorium
    classroom = query_db(
        "SELECT * FROM classrooms WHERE id = %s AND room_type = 'auditorium'",
        (data['classroom_id'],),
        one=True
    )
    if not classroom:
        return jsonify({'error': 'Classroom not found or not an auditorium'}), 400
    
    # Check for conflicts
    conflict = query_db("""
        SELECT id FROM auditorium_bookings 
        WHERE classroom_id = %s 
        AND booking_date = %s 
        AND status = 'confirmed'
        AND (
            (start_time <= %s AND end_time > %s) OR
            (start_time < %s AND end_time >= %s) OR
            (start_time >= %s AND end_time <= %s)
        )
    """, (
        data['classroom_id'], data['booking_date'],
        data['start_time'], data['start_time'],
        data['end_time'], data['end_time'],
        data['start_time'], data['end_time']
    ), one=True)
    
    if conflict:
        return jsonify({'error': 'Time slot already booked'}), 400
    
    booking_id = insert_db("""
        INSERT INTO auditorium_bookings 
        (classroom_id, booked_by, event_name, booking_date, start_time, end_time)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (
        data['classroom_id'], user_id, data['event_name'],
        data['booking_date'], data['start_time'], data['end_time']
    ))

    # Notify all active users about this booking (best-effort, ignore failures)
    try:
        notify_all_users_auditorium_booking(classroom, data)
    except Exception as e:
        print(f"Failed to send auditorium booking notifications: {str(e)}")

    return jsonify({
        'message': 'Auditorium booked successfully',
        'booking_id': booking_id
    }), 201

@admin_bp.route('/auditorium/bookings', methods=['GET'])
@jwt_required()
@role_required('admin')
def list_auditorium_bookings():
    """List all auditorium bookings"""
    bookings = query_db("""
        SELECT ab.*, c.room_no, u.first_name, u.last_name
        FROM auditorium_bookings ab
        JOIN classrooms c ON ab.classroom_id = c.id
        JOIN users u ON ab.booked_by = u.id
        WHERE ab.status = 'confirmed'
        ORDER BY ab.booking_date, ab.start_time
    """)
    bookings = serialize_rows(bookings)
    return jsonify({'bookings': bookings}), 200

@admin_bp.route('/stats', methods=['GET'])
@jwt_required()
@role_required('admin')
def get_stats():
    """Get dashboard statistics"""
    students = query_db(
        "SELECT COUNT(*) as count FROM users WHERE role = 'student' AND is_active = TRUE",
        one=True
    )
    professors = query_db(
        "SELECT COUNT(*) as count FROM users WHERE role = 'professor' AND is_active = TRUE",
        one=True
    )
    # total_classes = number of available classrooms (rooms), not timetable entries
    classrooms = query_db("SELECT COUNT(*) as count FROM classrooms", one=True)
    departments = query_db("SELECT COUNT(*) as count FROM departments", one=True)

    return jsonify({
        'total_students': students['count'],
        'total_professors': professors['count'],
        'total_classes': classrooms['count'],
        'total_departments': departments['count']
    }), 200

@admin_bp.route('/students/upload-csv', methods=['POST'])
@jwt_required()
@role_required('admin')
def upload_students_csv():
    """Upload CSV file to add multiple students"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not file.filename.endswith('.csv'):
        return jsonify({'error': 'File must be a CSV'}), 400
    
    try:
        # Read CSV file
        stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
        csv_reader = csv.DictReader(stream)
        
        # Expected columns: email, first_name, last_name, department_code, batch
        required_columns = ['email', 'first_name', 'last_name', 'department_code', 'batch']
        
        # Validate headers
        if not all(col in csv_reader.fieldnames for col in required_columns):
            return jsonify({
                'error': f'CSV must contain columns: {", ".join(required_columns)}'
            }), 400
        
        results = {
            'success': [],
            'errors': [],
            'total': 0
        }
        
        # Get all departments for lookup
        departments = query_db("SELECT id, code FROM departments")
        dept_map = {dept['code'].upper(): dept['id'] for dept in departments}
        
        for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 (1 is header)
            results['total'] += 1
            
            try:
                email = row['email'].strip().lower()
                first_name = row['first_name'].strip()
                last_name = row['last_name'].strip()
                department_code = row['department_code'].strip().upper()
                batch = row['batch'].strip()
                
                # Validate required fields
                if not all([email, first_name, last_name, department_code, batch]):
                    results['errors'].append({
                        'row': row_num,
                        'email': email or 'N/A',
                        'error': 'Missing required fields'
                    })
                    continue
                
                # Validate email format
                if not validate_email(email):
                    results['errors'].append({
                        'row': row_num,
                        'email': email,
                        'error': 'Invalid email format'
                    })
                    continue
                
                # Check if email exists
                existing = query_db("SELECT id FROM users WHERE email = %s", (email,), one=True)
                if existing:
                    results['errors'].append({
                        'row': row_num,
                        'email': email,
                        'error': 'Email already registered'
                    })
                    continue
                
                # Check if department exists
                department_id = dept_map.get(department_code)
                if not department_id:
                    results['errors'].append({
                        'row': row_num,
                        'email': email,
                        'error': f'Department code "{department_code}" not found'
                    })
                    continue
                
                # Generate temporary password
                temp_password = secrets.token_urlsafe(12)
                password_hash = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                
                # Create student
                user_id = insert_db(
                    """INSERT INTO users (email, password_hash, role, first_name, last_name, department_id, batch, must_change_password)
                       VALUES (%s, %s, 'student', %s, %s, %s, %s, TRUE)""",
                    (email, password_hash, first_name, last_name, department_id, batch)
                )
                
                # Send credentials email
                try:
                    send_credentials_email(mail, email, temp_password, 'student', first_name)
                except Exception as e:
                    # Log email error but don't fail the import
                    print(f"Failed to send email to {email}: {str(e)}")
                
                results['success'].append({
                    'row': row_num,
                    'email': email,
                    'user_id': user_id
                })
                
            except Exception as e:
                results['errors'].append({
                    'row': row_num,
                    'email': row.get('email', 'N/A'),
                    'error': str(e)
                })
        
        return jsonify({
            'message': f'Processed {results["total"]} rows. {len(results["success"])} successful, {len(results["errors"])} errors.',
            'results': results
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Error processing CSV: {str(e)}'}), 500

@admin_bp.route('/professors/upload-csv', methods=['POST'])
@jwt_required()
@role_required('admin')
def upload_professors_csv():
    """Upload CSV file to add multiple professors"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not file.filename.endswith('.csv'):
        return jsonify({'error': 'File must be a CSV'}), 400
    
    try:
        # Read CSV file
        stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
        csv_reader = csv.DictReader(stream)
        
        # Expected columns: email, first_name, last_name, department_code
        required_columns = ['email', 'first_name', 'last_name', 'department_code']
        
        # Validate headers
        if not all(col in csv_reader.fieldnames for col in required_columns):
            return jsonify({
                'error': f'CSV must contain columns: {", ".join(required_columns)}'
            }), 400
        
        results = {
            'success': [],
            'errors': [],
            'total': 0
        }
        
        # Get all departments for lookup
        departments = query_db("SELECT id, code FROM departments")
        dept_map = {dept['code'].upper(): dept['id'] for dept in departments}
        
        for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 (1 is header)
            results['total'] += 1
            
            try:
                email = row['email'].strip().lower()
                first_name = row['first_name'].strip()
                last_name = row['last_name'].strip()
                department_code = row['department_code'].strip().upper()
                
                # Validate required fields
                if not all([email, first_name, last_name, department_code]):
                    results['errors'].append({
                        'row': row_num,
                        'email': email or 'N/A',
                        'error': 'Missing required fields'
                    })
                    continue
                
                # Validate email format
                if not validate_email(email):
                    results['errors'].append({
                        'row': row_num,
                        'email': email,
                        'error': 'Invalid email format'
                    })
                    continue
                
                # Check if email exists
                existing = query_db("SELECT id FROM users WHERE email = %s", (email,), one=True)
                if existing:
                    results['errors'].append({
                        'row': row_num,
                        'email': email,
                        'error': 'Email already registered'
                    })
                    continue
                
                # Check if department exists
                department_id = dept_map.get(department_code)
                if not department_id:
                    results['errors'].append({
                        'row': row_num,
                        'email': email,
                        'error': f'Department code "{department_code}" not found'
                    })
                    continue
                
                # Generate temporary password
                temp_password = secrets.token_urlsafe(12)
                password_hash = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                
                # Create professor
                user_id = insert_db(
                    """INSERT INTO users (email, password_hash, role, first_name, last_name, department_id, must_change_password)
                       VALUES (%s, %s, 'professor', %s, %s, %s, TRUE)""",
                    (email, password_hash, first_name, last_name, department_id)
                )
                
                # Send credentials email
                try:
                    send_credentials_email(mail, email, temp_password, 'professor', first_name)
                except Exception as e:
                    # Log email error but don't fail the import
                    print(f"Failed to send email to {email}: {str(e)}")
                
                results['success'].append({
                    'row': row_num,
                    'email': email,
                    'user_id': user_id
                })
                
            except Exception as e:
                results['errors'].append({
                    'row': row_num,
                    'email': row.get('email', 'N/A'),
                    'error': str(e)
                })
        
        return jsonify({
            'message': f'Processed {results["total"]} rows. {len(results["success"])} successful, {len(results["errors"])} errors.',
            'results': results
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Error processing CSV: {str(e)}'}), 500

@admin_bp.route('/students/template', methods=['GET'])
@jwt_required()
@role_required('admin')
def download_students_template():
    """Download CSV template for students"""
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow(['email', 'first_name', 'last_name', 'department_code', 'batch'])
    
    # Write example row
    writer.writerow(['student@example.com', 'Amit1', 'Diwakar1', 'CSE', '2027'])
    
    # Create BytesIO object
    mem = io.BytesIO()
    mem.write(output.getvalue().encode('utf-8'))
    mem.seek(0)
    output.close()
    
    return send_file(
        mem,
        mimetype='text/csv',
        as_attachment=True,
        download_name='students_template.csv'
    )

@admin_bp.route('/professors/template', methods=['GET'])
@jwt_required()
@role_required('admin')
def download_professors_template():
    """Download CSV template for professors"""
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow(['email', 'first_name', 'last_name', 'department_code'])
    
    # Write example row
    writer.writerow(['professor@example.com', 'Amit', 'Diwakar', 'CSE'])
    
    # Create BytesIO object
    mem = io.BytesIO()
    mem.write(output.getvalue().encode('utf-8'))
    mem.seek(0)
    output.close()
    
    return send_file(
        mem,
        mimetype='text/csv',
        as_attachment=True,
        download_name='professors_template.csv'
    )
