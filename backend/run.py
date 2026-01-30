from app import create_app, socketio
from app.services.scheduler_service import init_scheduler, shutdown_scheduler
import atexit

app = create_app()

# Initialize scheduler
with app.app_context():
    init_scheduler(app)

# Register shutdown handler
atexit.register(shutdown_scheduler)

# Socket.IO event handlers
@socketio.on('connect')
def handle_connect():
    print('Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

@socketio.on('join_room')
def handle_join_room(data):
    from flask_socketio import join_room
    room = data.get('room')
    if room:
        join_room(room)
        print(f'User joined room: {room}')

@socketio.on('leave_room')
def handle_leave_room(data):
    from flask_socketio import leave_room
    room = data.get('room')
    if room:
        leave_room(room)
        print(f'User left room: {room}')

if __name__ == '__main__':
    # use_reloader=False prevents port conflict issues with eventlet on Windows
    socketio.run(app, debug=True, host='0.0.0.0', port=5000, use_reloader=False)
