from flask_mail import Message
from flask import current_app

def send_credentials_email(mail, user_email, temp_password, role, first_name):
    """Send login credentials to newly created user"""
    try:
        msg = Message(
            subject="Your CampusOne Login Credentials",
            recipients=[user_email],
            body=f"""
Hello {first_name},

Welcome to CampusOne!

Your login credentials:
Email: {user_email}
Temporary Password: {temp_password}
Role: {role.capitalize()}

Please change your password after your first login.

Best regards,
CampusOne Administration
            """
        )
        mail.send(msg)
        return True
    except Exception as e:
        current_app.logger.error(f"Failed to send email: {str(e)}")
        return False

def send_notification_email(mail, user_email, subject, content):
    """Send notification email"""
    try:
        msg = Message(
            subject=subject,
            recipients=[user_email],
            body=content
        )
        mail.send(msg)
        return True
    except Exception as e:
        current_app.logger.error(f"Failed to send notification email: {str(e)}")
        return False

def send_password_reset_email(mail, user_email, reset_token):
    """Send password reset email"""
    try:
        msg = Message(
            subject="Password Reset Request - CampusOne",
            recipients=[user_email],
            body=f"""
You have requested to reset your password for CampusOne.

Your password reset token: {reset_token}

This token will expire in 1 hour.

If you did not request this reset, please ignore this email.

Best regards,
CampusOne Administration
            """
        )
        mail.send(msg)
        return True
    except Exception as e:
        current_app.logger.error(f"Failed to send reset email: {str(e)}")
        return False
