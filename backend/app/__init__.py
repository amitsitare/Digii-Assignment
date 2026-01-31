import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_mail import Mail

from .config import Config
from .db import init_db, init_schema, close_db

# Vercel serverless does not support WebSockets; skip SocketIO when VERCEL=1
VERCEL = os.environ.get('VERCEL') == '1'
if VERCEL:
    socketio = None
else:
    from flask_socketio import SocketIO
    socketio = SocketIO()

# Initialize extensions
jwt = JWTManager()
mail = Mail()

def create_app(config_class=Config):
    app = Flask(__name__)
    
    # Load config
    app.config.from_object(config_class)
    
    # Initialize extensions – CORS for all /api routes, including preflight OPTIONS
    origins = app.config['CORS_ORIGINS']
    CORS(
        app,
        origins=origins,
        supports_credentials=True,
        resources={r'/api/*': {'origins': origins}},
        allow_headers=['Content-Type', 'Authorization'],
        methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    )
    jwt.init_app(app)
    mail.init_app(app)
    if socketio is not None:
        socketio.init_app(app, cors_allowed_origins=app.config['CORS_ORIGINS'])
    
    # Initialize database and create tables if they don't exist
    with app.app_context():
        init_db(app)
        init_schema(app)
    
    # Register teardown
    app.teardown_appcontext(close_db)
    
    # Ensure CORS headers on EVERY response so browser never blocks (including JWT/role errors)
    @app.after_request
    def add_cors_headers(response):
        # Always send CORS when we have allowed origins: use request origin if allowed, else first allowed
        if not origins:
            return response
        origin = (request.origin if request.origin in origins else None) or origins[0]
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        return response
    
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
    
    # Ensure CORS on error responses (JWT/role errors etc.) – after_request runs on these too
    @app.errorhandler(401)
    @app.errorhandler(403)
    @app.errorhandler(404)
    @app.errorhandler(500)
    def json_error(e):
        if e.code == 401:
            return jsonify({'error': 'Unauthorized', 'message': str(e.description) if hasattr(e, 'description') else 'Invalid or missing token'}), 401
        if e.code == 403:
            return jsonify({'error': 'Forbidden', 'message': getattr(e, 'description', 'Access denied')}), 403
        if e.code == 404:
            return jsonify({'error': 'Not found'}), 404
        return jsonify({'error': 'Internal server error'}), 500
    
    return app
