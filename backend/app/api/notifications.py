from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.services.notification_service import (
    get_user_notifications,
    mark_notification_read,
    mark_all_notifications_read,
    get_unread_count
)

notifications_bp = Blueprint('notifications', __name__)

@notifications_bp.route('', methods=['GET'])
@jwt_required()
def get_notifications():
    """Get notifications for current user"""
    user_id = get_jwt_identity()
    limit = request.args.get('limit', 20, type=int)
    unread_only = request.args.get('unread_only', 'false').lower() == 'true'
    
    notifications = get_user_notifications(user_id, limit, unread_only)
    unread_count = get_unread_count(user_id)
    
    return jsonify({
        'notifications': notifications,
        'unread_count': unread_count
    }), 200

@notifications_bp.route('/<int:notification_id>/read', methods=['PUT'])
@jwt_required()
def mark_read(notification_id):
    """Mark a notification as read"""
    user_id = get_jwt_identity()
    
    mark_notification_read(notification_id, user_id)
    
    return jsonify({'message': 'Notification marked as read'}), 200

@notifications_bp.route('/read-all', methods=['PUT'])
@jwt_required()
def mark_all_read():
    """Mark all notifications as read"""
    user_id = get_jwt_identity()
    
    mark_all_notifications_read(user_id)
    
    return jsonify({'message': 'All notifications marked as read'}), 200

@notifications_bp.route('/unread-count', methods=['GET'])
@jwt_required()
def unread_notification_count():
    """Get unread notification count"""
    user_id = get_jwt_identity()
    
    count = get_unread_count(user_id)
    
    return jsonify({'unread_count': count}), 200
