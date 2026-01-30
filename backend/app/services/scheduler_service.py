from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
from flask import current_app

scheduler = BackgroundScheduler()

def check_upcoming_classes(app):
    """Run every minute to check for classes starting in 15 mins"""
    with app.app_context():
        from app.db import query_db
        from app.services.notification_service import notify_class_reminder
        
        now = datetime.now()
        target_time = (now + timedelta(minutes=15)).strftime('%H:%M:%S')
        target_time_end = (now + timedelta(minutes=16)).strftime('%H:%M:%S')
        current_day = now.weekday()
        
        # Find classes starting in exactly 15 minutes
        upcoming = query_db("""
            SELECT t.*, d.name as department_name, c.room_no
            FROM timetable t
            JOIN departments d ON t.department_id = d.id
            JOIN classrooms c ON t.classroom_id = c.id
            WHERE t.day_of_week = %s 
            AND t.start_time >= %s 
            AND t.start_time < %s
        """, (current_day, target_time, target_time_end))
        
        for entry in upcoming:
            notify_class_reminder(entry)

def init_scheduler(app):
    """Initialize the scheduler with the app context"""
    if not scheduler.running:
        scheduler.add_job(
            func=check_upcoming_classes,
            trigger='interval',
            minutes=1,
            args=[app],
            id='class_reminder_job',
            replace_existing=True
        )
        scheduler.start()

def shutdown_scheduler():
    """Shutdown the scheduler"""
    if scheduler.running:
        scheduler.shutdown()
