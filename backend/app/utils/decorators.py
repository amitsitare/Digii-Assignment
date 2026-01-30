from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from app.db import query_db

def role_required(*roles):
    """Decorator to require specific roles for access"""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            # Convert string ID to int for database query
            user_id_int = int(user_id) if isinstance(user_id, str) else user_id
            user = query_db("SELECT * FROM users WHERE id = %s", (user_id_int,), one=True)
            if not user or user['role'] not in roles:
                return jsonify({'error': 'Unauthorized access'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator

def get_current_user():
    """Get the current authenticated user"""
    user_id = get_jwt_identity()
    if user_id:
        # Convert string ID to int for database query
        user_id_int = int(user_id) if isinstance(user_id, str) else user_id
        return query_db("SELECT * FROM users WHERE id = %s", (user_id_int,), one=True)
    return None
