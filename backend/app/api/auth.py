from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
import bcrypt
import secrets

from app.db import query_db, insert_db, execute_db
from app.utils.validators import validate_email, validate_password

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new admin user - ADMIN ONLY registration"""
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['email', 'password', 'first_name', 'last_name']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400
    
    email = data['email'].lower().strip()
    password = data['password']
    first_name = data['first_name'].strip()
    last_name = data['last_name'].strip()
    
    # Validate email format
    if not validate_email(email):
        return jsonify({'error': 'Invalid email format'}), 400
    
    # Validate password strength
    if not validate_password(password):
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    
    # Check if email already exists
    existing = query_db("SELECT id FROM users WHERE email = %s", (email,), one=True)
    if existing:
        return jsonify({'error': 'Email already registered'}), 400
    
    # Hash password
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Create admin user (only admin can self-register); is_active=TRUE so they can log in
    user_id = insert_db(
        """INSERT INTO users (email, password_hash, role, first_name, last_name, must_change_password, is_active)
           VALUES (%s, %s, 'admin', %s, %s, FALSE, TRUE)""",
        (email, password_hash, first_name, last_name)
    )
    
    return jsonify({
        'message': 'Admin registered successfully',
        'user_id': user_id
    }), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    """Login for all users"""
    data = request.get_json()
    
    email = data.get('email', '').lower().strip()
    password = data.get('password', '')
    
    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400
    
    # Get user
    user = query_db(
        "SELECT * FROM users WHERE email = %s AND is_active = TRUE",
        (email,),
        one=True
    )
    
    if not user:
        return jsonify({'error': 'Invalid email or password'}), 401
    
    # Verify password (password_hash from DB may be str or bytes)
    stored_hash = user['password_hash']
    if isinstance(stored_hash, str):
        stored_hash = stored_hash.encode('utf-8')
    if not bcrypt.checkpw(password.encode('utf-8'), stored_hash):
        return jsonify({'error': 'Invalid email or password'}), 401
    
    # Create access token (identity must be a string in Flask-JWT-Extended 4.x)
    access_token = create_access_token(identity=str(user['id']))
    
    # Get department name if exists
    department_name = None
    if user['department_id']:
        dept = query_db("SELECT name FROM departments WHERE id = %s", (user['department_id'],), one=True)
        department_name = dept['name'] if dept else None
    
    return jsonify({
        'access_token': access_token,
        'user': {
            'id': user['id'],
            'email': user['email'],
            'role': user['role'],
            'first_name': user['first_name'],
            'last_name': user['last_name'],
            'department_id': user['department_id'],
            'department_name': department_name,
            'batch': user['batch'],
            'must_change_password': user['must_change_password']
        }
    }), 200

@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """Change user password"""
    data = request.get_json()
    user_id = get_jwt_identity()
    # Convert string ID to int for database query
    user_id_int = int(user_id) if isinstance(user_id, str) else user_id
    
    current_password = data.get('current_password', '')
    new_password = data.get('new_password', '')
    
    if not current_password or not new_password:
        return jsonify({'error': 'Current and new password are required'}), 400
    
    if not validate_password(new_password):
        return jsonify({'error': 'New password must be at least 8 characters'}), 400
    
    # Get user
    user = query_db("SELECT * FROM users WHERE id = %s", (user_id_int,), one=True)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Verify current password
    if not bcrypt.checkpw(current_password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        return jsonify({'error': 'Current password is incorrect'}), 401
    
    # Hash new password
    new_password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Update password
    execute_db(
        "UPDATE users SET password_hash = %s, must_change_password = FALSE WHERE id = %s",
        (new_password_hash, user_id_int)
    )
    
    return jsonify({'message': 'Password changed successfully'}), 200

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current user profile"""
    user_id = get_jwt_identity()
    # Convert string ID to int for database query
    user_id_int = int(user_id) if isinstance(user_id, str) else user_id
    
    user = query_db(
        """SELECT u.*, d.name as department_name 
           FROM users u 
           LEFT JOIN departments d ON u.department_id = d.id 
           WHERE u.id = %s""",
        (user_id_int,),
        one=True
    )
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'id': user['id'],
        'email': user['email'],
        'role': user['role'],
        'first_name': user['first_name'],
        'last_name': user['last_name'],
        'department_id': user['department_id'],
        'department_name': user['department_name'],
        'batch': user['batch'],
        'must_change_password': user['must_change_password']
    }), 200

@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Logout user (client should discard the token)
    No JWT required - logout should work even with expired/invalid tokens"""
    return jsonify({'message': 'Logged out successfully'}), 200
