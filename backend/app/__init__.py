from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_mail import Mail
from flask_socketio import SocketIO

from .config import Config
from .db import init_db, close_db

# Initialize extensions
jwt = JWTManager()
mail = Mail()
socketio = SocketIO()

def create_app(config_class=Config):
    app = Flask(__name__)
    
    # Load config
    app.config.from_object(config_class)
    
    # Initialize extensions
    CORS(app, origins=app.config['CORS_ORIGINS'], supports_credentials=True)
    jwt.init_app(app)
    mail.init_app(app)
    socketio.init_app(app, cors_allowed_origins=app.config['CORS_ORIGINS'])
    
    # Initialize database
    with app.app_context():
        init_db(app)
    
    # Register teardown
    app.teardown_appcontext(close_db)
    
    # Register blueprints
    from .api.auth import auth_bp
    from .api.admin import admin_bp
    from .api.professor import professor_bp
    from .api.student import student_bp
    from .api.timetable import timetable_bp
    from .api.chat import chat_bp
    from .api.notifications import notifications_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(professor_bp, url_prefix='/api/professor')
    app.register_blueprint(student_bp, url_prefix='/api/student')
    app.register_blueprint(timetable_bp, url_prefix='/api/timetable')
    app.register_blueprint(chat_bp, url_prefix='/api/chat')
    app.register_blueprint(notifications_bp, url_prefix='/api/notifications')
    
    # Health check route
    @app.route('/api/health')
    def health_check():
        return {'status': 'healthy'}
    
    return app
