from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request

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

@chat_bp.route('/recipients', methods=['GET'])
@jwt_required()
def get_recipients():
    """List users by role for chat (professor: admins, professors, students in dept; admin can use for consistency)."""
    user_id = get_jwt_identity()
    user_id_int = int(user_id) if isinstance(user_id, str) else user_id
    role_filter = request.args.get('role')  # 'admin', 'professor', 'student'

    current_user = query_db("SELECT * FROM users WHERE id = %s", (user_id_int,), one=True)
    if not current_user:
        return jsonify({'error': 'User not found'}), 404

    if role_filter not in ('admin', 'professor', 'student'):
        return jsonify({'error': 'Invalid role; use admin, professor, or student'}), 400

    query = """
        SELECT u.id, u.email, u.role, u.first_name, u.last_name,
               u.department_id, d.name as department_name, u.batch
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.is_active = TRUE AND u.role = %s
    """
    params = [role_filter]

    if current_user['role'] == 'professor':
        if role_filter == 'admin':
            pass  # all admins
        elif role_filter == 'professor':
            query += " AND u.id != %s"
            params.append(user_id_int)
        elif role_filter == 'student':
            if not current_user.get('department_id'):
                return jsonify({'users': []}), 200
            query += " AND u.department_id = %s"
            params.append(current_user['department_id'])
    elif current_user['role'] == 'admin':
        # Admin can list any role (same as list_users but this endpoint is for chat UI)
        pass
    elif current_user['role'] == 'student':
        if role_filter == 'admin':
            pass  # all admins
        elif role_filter == 'professor':
            # Students can message professors (same department if set, else all)
            dept_id = current_user.get('department_id')
            if dept_id is not None:
                query += " AND u.department_id = %s"
                params.append(int(dept_id) if dept_id is not None else dept_id)
        elif role_filter == 'student':
            # Students can message other students (same department if set, else all; exclude self)
            query += " AND u.id != %s"
            params.append(user_id_int)
            dept_id = current_user.get('department_id')
            if dept_id is not None:
                query += " AND u.department_id = %s"
                params.append(int(dept_id) if dept_id is not None else dept_id)
    else:
        return jsonify({'users': []}), 200

    query += " ORDER BY u.first_name, u.last_name"
    users = query_db(query, tuple(params))
    return jsonify({'users': users}), 200


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
    """Get list of conversations: people I've had direct messages with (sent or received), with last message."""
    user_id = get_jwt_identity()
    user_id_int = int(user_id) if isinstance(user_id, str) else user_id

    conversations = query_db("""
        WITH thread AS (
            SELECT mr.recipient_id AS other_id, m.content AS last_message, m.created_at AS last_message_time
            FROM messages m
            JOIN message_recipients mr ON mr.message_id = m.id
            WHERE m.sender_id = %s AND m.message_type = 'direct'
            UNION ALL
            SELECT m.sender_id AS other_id, m.content AS last_message, m.created_at AS last_message_time
            FROM messages m
            JOIN message_recipients mr ON mr.message_id = m.id
            WHERE mr.recipient_id = %s AND m.message_type = 'direct'
        )
        SELECT DISTINCT ON (t.other_id) t.other_id AS id, t.last_message, t.last_message_time,
               u.first_name, u.last_name, u.role
        FROM thread t
        JOIN users u ON u.id = t.other_id
        WHERE u.is_active = TRUE
        ORDER BY t.other_id, t.last_message_time DESC
    """, (user_id_int, user_id_int))

    # Normalize keys for frontend (id, first_name, last_name, role, last_message, last_message_time)
    out = []
    for c in conversations:
        out.append({
            'id': c['id'],
            'first_name': c['first_name'],
            'last_name': c['last_name'],
            'role': c['role'],
            'last_message': c['last_message'],
            'last_message_time': c['last_message_time'],
        })
    return jsonify({'conversations': out}), 200


@chat_bp.route('/conversation/<int:other_user_id>', methods=['GET'])
@jwt_required()
def get_conversation_thread(other_user_id):
    """Get all direct messages between current user and other_user_id (thread for 1:1 chat)."""
    user_id = get_jwt_identity()
    user_id_int = int(user_id) if isinstance(user_id, str) else user_id

    # Only direct messages where (I sent to other) or (other sent to me)
    messages = query_db("""
        SELECT m.id, m.content, m.created_at, m.sender_id,
               u.first_name AS sender_first_name, u.last_name AS sender_last_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        JOIN message_recipients mr ON mr.message_id = m.id
        WHERE m.message_type = 'direct'
        AND (
            (m.sender_id = %s AND mr.recipient_id = %s)
            OR (m.sender_id = %s AND mr.recipient_id = %s)
        )
        ORDER BY m.created_at ASC
    """, (user_id_int, other_user_id, other_user_id, user_id_int))

    # Get other user info for header
    other_user = query_db(
        "SELECT id, first_name, last_name, role FROM users WHERE id = %s AND is_active = TRUE",
        (other_user_id,),
        one=True,
    )
    if not other_user:
        return jsonify({'error': 'User not found'}), 404

    return jsonify({
        'other_user': {
            'id': other_user['id'],
            'first_name': other_user['first_name'],
            'last_name': other_user['last_name'],
            'role': other_user['role'],
        },
        'messages': messages,
    }), 200


@chat_bp.route('/sent/to-recipients', methods=['GET', 'OPTIONS'])
def get_sent_messages_to_recipients():
    """Get messages sent by current user to an exact set of recipients (for selected students/professors thread)."""
    if request.method == 'OPTIONS':
        return '', 200
    verify_jwt_in_request()
    user_id = get_jwt_identity()
    user_id_int = int(user_id) if isinstance(user_id, str) else user_id
    ids_param = request.args.get('ids', '')
    try:
        recipient_ids = sorted([int(x.strip()) for x in ids_param.split(',') if x.strip()])
    except ValueError:
        return jsonify({'error': 'Invalid ids parameter'}), 400
    if not recipient_ids:
        return jsonify({'messages': []}), 200

    # Get all direct messages sent by me with their recipient_ids
    rows = query_db("""
        SELECT m.id, m.content, m.created_at, m.sender_id, mr.recipient_id
        FROM messages m
        JOIN message_recipients mr ON mr.message_id = m.id
        WHERE m.sender_id = %s AND m.message_type = 'direct'
        ORDER BY m.created_at ASC
    """, (user_id_int,))

    # Group by message id and keep only messages where recipients exactly match
    target_set = set(recipient_ids)
    seen = {}
    for r in rows:
        mid = r['id']
        if mid not in seen:
            seen[mid] = {'id': r['id'], 'content': r['content'], 'created_at': r['created_at'],
                         'sender_id': r['sender_id'], 'recipient_ids': []}
        seen[mid]['recipient_ids'].append(r['recipient_id'])

    messages = [
        {'id': m['id'], 'content': m['content'], 'created_at': m['created_at'], 'sender_id': m['sender_id']}
        for m in seen.values()
        if set(m['recipient_ids']) == target_set
    ]
    messages.sort(key=lambda x: x['created_at'])

    return jsonify({'messages': messages}), 200
