import re

def validate_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password(password):
    """Validate password strength - minimum 8 characters"""
    return len(password) >= 8

def validate_time_format(time_str):
    """Validate time format HH:MM"""
    pattern = r'^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
    return re.match(pattern, time_str) is not None

def validate_day_of_week(day):
    """Validate day of week (0-6)"""
    return isinstance(day, int) and 0 <= day <= 6
