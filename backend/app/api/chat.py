from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.db import query_db, insert_db, execute_db
from app.services.notification_service import create_notification

chat_bp = Blueprint('chat', __name__)

@chat_bp.route('/send', methods=['POST'])
@jwt_required()
def send_message():
    """Send a message (broadcast/direct/department/batch)"""
    user_id = get_jwt_identity()
    # Convert string ID to int for database query
    user_id_int = int(user_id) if isinstance(user_id, str) else user_id
    data = request.get_json()
    
    if not data.get('content'):
        return jsonify({'error': 'Message content is required'}), 400
    
    message_type = data.get('message_type', 'direct')
    if message_type not in ['broadcast', 'direct', 'department', 'batch']:
        return jsonify({'error': 'Invalid message type'}), 400
    
    # Get sender info
    sender = query_db("SELECT * FROM users WHERE id = %s", (user_id_int,), one=True)
    
    # Validate based on role and message type
    if message_type == 'broadcast':
        # Admin can broadcast to all
        # Professor can only broadcast to their department
        # Student can only broadcast to their batch
        if sender['role'] == 'student':
            # Students can only broadcast to their batch
            if not sender['department_id'] or not sender['batch']:
                return jsonify({'error': 'Student department or batch not set'}), 400
            target_department_id = sender['department_id']
            target_batch = sender['batch']
        elif sender['role'] == 'professor':
            # Professors can broadcast to their department
            if not sender['department_id']:
                return jsonify({'error': 'Professor department not set'}), 400
            target_department_id = sender['department_id']
            target_batch = data.get('target_batch')  # Optional
        else:
            # Admin can broadcast to all or specific department/batch
            target_department_id = data.get('target_department_id')
            target_batch = data.get('target_batch')
    
    elif message_type == 'department':
        # Must specify department
        if sender['role'] == 'admin':
            target_department_id = data.get('target_department_id')
            if not target_department_id:
                return jsonify({'error': 'target_department_id is required'}), 400
        else:
            # Non-admins can only message their own department
            target_department_id = sender['department_id']
        target_batch = data.get('target_batch')
    
    elif message_type == 'batch':
        # Students can only message their own batch
        if sender['role'] == 'student':
            target_department_id = sender['department_id']
            target_batch = data.get('target_batch', sender['batch'])
            # Students can only select batches within their department
        else:
            target_department_id = data.get('target_department_id', sender.get('department_id'))
            target_batch = data.get('target_batch')
            if not target_batch:
                return jsonify({'error': 'target_batch is required'}), 400
    
    else:  # direct
        target_department_id = None
        target_batch = None
    
    # Create message
    message_id = insert_db("""
        INSERT INTO messages (sender_id, message_type, content, target_department_id, target_batch)
        VALUES (%s, %s, %s, %s, %s)
    """, (user_id_int, message_type, data['content'], target_department_id, target_batch))
    
    # For direct messages, add recipients
    if message_type == 'direct':
        recipients = data.get('recipients', [])
        if not recipients:
            return jsonify({'error': 'Recipients are required for direct messages'}), 400
        
        for recipient_id in recipients:
            insert_db("""
                INSERT INTO message_recipients (message_id, recipient_id)
                VALUES (%s, %s)
            """, (message_id, recipient_id))
            
            # Create notification for recipient
            create_notification(
                recipient_id,
                f"New message from {sender['first_name']} {sender['last_name']}",
                data['content'][:100],
                'new_message'
            )
    else:
        # For broadcast/department/batch messages, notify all affected users
        recipients_query = "SELECT id FROM users WHERE is_active = TRUE AND id != %s"
        params = [user_id_int]
        
        # Filter by department if specified (for broadcast) or required (for department/batch)
        if target_department_id is not None:
            recipients_query += " AND department_id = %s"
            params.append(target_department_id)
        elif message_type != 'broadcast':
            # For non-broadcast messages, department filter should have been set above
            # This is a safety check
            if sender.get('department_id'):
                recipients_query += " AND department_id = %s"
                params.append(sender['department_id'])
        
        if target_batch:
            recipients_query += " AND batch = %s"
            params.append(target_batch)
        
        # For professors messaging, only students
        if sender['role'] == 'professor' and message_type in ['broadcast', 'department', 'batch']:
            recipients_query += " AND role = 'student'"
        
        recipients = query_db(recipients_query, tuple(params))
        
        for recipient in recipients:
            create_notification(
                recipient['id'],
                f"New {message_type} message from {sender['first_name']} {sender['last_name']}",
                data['content'][:100],
                'new_message'
            )
    
    return jsonify({
        'message': 'Message sent successfully',
        'message_id': message_id
    }), 201

@chat_bp.route('/messages', methods=['GET'])
@jwt_required()
def get_messages():
    """Get messages for the current user"""
    user_id = get_jwt_identity()
    # Convert string ID to int for database query
    user_id_int = int(user_id) if isinstance(user_id, str) else user_id
    message_type = request.args.get('type')
    
    # Get user info
    user = query_db("SELECT * FROM users WHERE id = %s", (user_id_int,), one=True)
    
    # Get direct messages sent to this user
    direct_messages = query_db("""
        SELECT m.*, u.first_name as sender_first_name, u.last_name as sender_last_name,
               u.role as sender_role, mr.is_read
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        JOIN message_recipients mr ON m.id = mr.message_id
        WHERE mr.recipient_id = %s
        ORDER BY m.created_at DESC
    """, (user_id_int,))
    
    # Get broadcast/department/batch messages relevant to this user
    broadcast_query = """
        SELECT m.*, u.first_name as sender_first_name, u.last_name as sender_last_name,
               u.role as sender_role
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.message_type != 'direct'
        AND m.sender_id != %s
        AND (
            m.target_department_id IS NULL 
            OR m.target_department_id = %s
        )
        AND (
            m.target_batch IS NULL 
            OR m.target_batch = %s
        )
        ORDER BY m.created_at DESC
    """
    broadcast_messages = query_db(broadcast_query, (user_id_int, user['department_id'], user.get('batch')))
    
    # Combine and sort
    all_messages = direct_messages + broadcast_messages
    all_messages.sort(key=lambda x: x['created_at'], reverse=True)
    
    if message_type:
        all_messages = [m for m in all_messages if m['message_type'] == message_type]
    
    return jsonify({'messages': all_messages}), 200

@chat_bp.route('/sent', methods=['GET'])
@jwt_required()
def get_sent_messages():
    """Get messages sent by current user"""
    user_id = get_jwt_identity()
    # Convert string ID to int for database query
    user_id_int = int(user_id) if isinstance(user_id, str) else user_id
    
    messages = query_db("""
        SELECT m.*, 
               CASE WHEN m.message_type = 'direct' 
                    THEN (SELECT string_agg(u.first_name || ' ' || u.last_name, ', ')
                          FROM message_recipients mr
                          JOIN users u ON mr.recipient_id = u.id
                          WHERE mr.message_id = m.id)
                    ELSE NULL 
               END as recipients_names
        FROM messages m
        WHERE m.sender_id = %s
        ORDER BY m.created_at DESC
    """, (user_id_int,))
    
    return jsonify({'messages': messages}), 200

@chat_bp.route('/read/<int:message_id>', methods=['PUT'])
@jwt_required()
def mark_message_read(message_id):
    """Mark a direct message as read"""
    user_id = get_jwt_identity()
    # Convert string ID to int for database query
    user_id_int = int(user_id) if isinstance(user_id, str) else user_id
    
    execute_db("""
        UPDATE message_recipients 
        SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
        WHERE message_id = %s AND recipient_id = %s
    """, (message_id, user_id_int))
    
    return jsonify({'message': 'Message marked as read'}), 200

@chat_bp.route('/users/search', methods=['GET'])
@jwt_required()
def search_users():
    """Search users for messaging"""
    user_id = get_jwt_identity()
    # Convert string ID to int for database query
    user_id_int = int(user_id) if isinstance(user_id, str) else user_id
    search = request.args.get('q', '')
    role = request.args.get('role')
    
    # Get current user info
    current_user = query_db("SELECT * FROM users WHERE id = %s", (user_id_int,), one=True)
    
    query = """
        SELECT id, email, first_name, last_name, role, department_id, batch
        FROM users 
        WHERE is_active = TRUE AND id != %s
    """
    params = [user_id_int]
    
    # Apply role restrictions
    if current_user['role'] == 'student':
        # Students can only search within their department
        query += " AND department_id = %s"
        params.append(current_user['department_id'])
    elif current_user['role'] == 'professor':
        # Professors can search students in their department
        query += " AND (role = 'student' AND department_id = %s)"
        params.append(current_user['department_id'])
    
    if search:
        query += " AND (first_name ILIKE %s OR last_name ILIKE %s OR email ILIKE %s)"
        search_pattern = f'%{search}%'
        params.extend([search_pattern, search_pattern, search_pattern])
    
    if role:
        query += " AND role = %s"
        params.append(role)
    
    query += " ORDER BY first_name, last_name LIMIT 20"
    
    users = query_db(query, tuple(params))
    
    return jsonify({'users': users}), 200

@chat_bp.route('/conversations', methods=['GET'])
@jwt_required()
def get_conversations():
    """Get list of conversations (unique senders)"""
    user_id = get_jwt_identity()
    # Convert string ID to int for database query
    user_id_int = int(user_id) if isinstance(user_id, str) else user_id
    
    conversations = query_db("""
        SELECT DISTINCT ON (m.sender_id) 
               m.sender_id, u.first_name, u.last_name, u.role,
               m.content as last_message, m.created_at as last_message_time
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        JOIN message_recipients mr ON m.id = mr.message_id
        WHERE mr.recipient_id = %s AND m.message_type = 'direct'
        ORDER BY m.sender_id, m.created_at DESC
    """, (user_id_int,))
    
    return jsonify({'conversations': conversations}), 200
