import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Form, Button, ListGroup, Modal, Badge } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { chatService } from '../services/chatService';
import { getRelativeTime, BATCH_OPTIONS } from '../utils/constants';

const ChatPage = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [sentMessages, setSentMessages] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [messageType, setMessageType] = useState('direct');
  const [targetBatch, setTargetBatch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [activeTab, setActiveTab] = useState('received');

  const fetchData = useCallback(async () => {
    try {
      const [messagesData, sentData] = await Promise.all([
        chatService.getMessages(),
        chatService.getSentMessages(),
      ]);
      
      setMessages(messagesData.messages);
      setSentMessages(sentData.messages);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const searchUsers = useCallback(async () => {
    try {
      const data = await chatService.searchUsers(searchQuery);
      setSearchResults(data.users);
    } catch (err) {
      console.error('Failed to search users:', err);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchUsers();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, searchUsers]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageData = {
      content: newMessage,
      message_type: messageType,
    };

    if (messageType === 'direct') {
      if (selectedRecipients.length === 0) {
        alert('Please select at least one recipient');
        return;
      }
      messageData.recipients = selectedRecipients.map(r => r.id);
    } else if (messageType === 'batch' && targetBatch) {
      messageData.target_batch = targetBatch;
    }

    try {
      await chatService.sendMessage(messageData);
      setNewMessage('');
      setSelectedRecipients([]);
      setShowNewMessageModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send message');
    }
  };

  const addRecipient = (user) => {
    if (!selectedRecipients.find(r => r.id === user.id)) {
      setSelectedRecipients([...selectedRecipients, user]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeRecipient = (userId) => {
    setSelectedRecipients(selectedRecipients.filter(r => r.id !== userId));
  };

  const getMessageTypeLabel = (type) => {
    switch (type) {
      case 'broadcast': return 'Broadcast';
      case 'department': return 'Department';
      case 'batch': return 'Batch';
      default: return 'Direct';
    }
  };

  if (loading) {
    return (
      <Container className="py-5">
        <div className="loading-spinner">Loading...</div>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Messages</h2>
        <Button 
          className="btn-primary-gradient"
          onClick={() => setShowNewMessageModal(true)}
        >
          New Message
        </Button>
      </div>

      <Card className="feature-card">
        <Card.Body>
          {/* Tabs */}
          <div className="d-flex gap-3 mb-4">
            <Button
              variant={activeTab === 'received' ? 'primary' : 'outline-secondary'}
              onClick={() => setActiveTab('received')}
            >
              Received
            </Button>
            <Button
              variant={activeTab === 'sent' ? 'primary' : 'outline-secondary'}
              onClick={() => setActiveTab('sent')}
            >
              Sent
            </Button>
          </div>

          {/* Messages List */}
          {activeTab === 'received' && (
            <div>
              {messages.length === 0 ? (
                <p className="text-muted text-center py-4">No messages received</p>
              ) : (
                <ListGroup variant="flush">
                  {messages.map(msg => (
                    <ListGroup.Item key={msg.id} className="px-0">
                      <div className="d-flex justify-content-between">
                        <div>
                          <strong>{msg.sender_first_name} {msg.sender_last_name}</strong>
                          <Badge 
                            bg="light" 
                            text="dark" 
                            className="ms-2"
                          >
                            {getMessageTypeLabel(msg.message_type)}
                          </Badge>
                          {!msg.is_read && (
                            <Badge bg="primary" className="ms-2">New</Badge>
                          )}
                        </div>
                        <small className="text-muted">
                          {getRelativeTime(msg.created_at)}
                        </small>
                      </div>
                      <p className="mb-0 mt-2 text-muted">{msg.content}</p>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </div>
          )}

          {activeTab === 'sent' && (
            <div>
              {sentMessages.length === 0 ? (
                <p className="text-muted text-center py-4">No messages sent</p>
              ) : (
                <ListGroup variant="flush">
                  {sentMessages.map(msg => (
                    <ListGroup.Item key={msg.id} className="px-0">
                      <div className="d-flex justify-content-between">
                        <div>
                          <Badge bg="light" text="dark">
                            {getMessageTypeLabel(msg.message_type)}
                          </Badge>
                          {msg.recipients_names && (
                            <span className="ms-2 text-muted">
                              To: {msg.recipients_names}
                            </span>
                          )}
                        </div>
                        <small className="text-muted">
                          {getRelativeTime(msg.created_at)}
                        </small>
                      </div>
                      <p className="mb-0 mt-2">{msg.content}</p>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </div>
          )}
        </Card.Body>
      </Card>

      {/* New Message Modal */}
      <Modal 
        show={showNewMessageModal} 
        onHide={() => setShowNewMessageModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>New Message</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Message Type</Form.Label>
            <Form.Select
              value={messageType}
              onChange={(e) => setMessageType(e.target.value)}
            >
              <option value="direct">Direct Message</option>
              {user?.role === 'admin' && (
                <option value="broadcast">Broadcast to All</option>
              )}
              <option value="department">Department</option>
              <option value="batch">Batch</option>
            </Form.Select>
          </Form.Group>

          {messageType === 'direct' && (
            <Form.Group className="mb-3">
              <Form.Label>Recipients</Form.Label>
              
              {/* Selected Recipients */}
              <div className="d-flex flex-wrap gap-2 mb-2">
                {selectedRecipients.map(r => (
                  <Badge 
                    key={r.id} 
                    bg="primary"
                    className="d-flex align-items-center gap-1 p-2"
                  >
                    {r.first_name} {r.last_name}
                    <span 
                      style={{ cursor: 'pointer' }}
                      onClick={() => removeRecipient(r.id)}
                    >
                      x
                    </span>
                  </Badge>
                ))}
              </div>

              {/* Search */}
              <Form.Control
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              {/* Search Results */}
              {searchResults.length > 0 && (
                <ListGroup className="mt-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {searchResults.map(u => (
                    <ListGroup.Item
                      key={u.id}
                      action
                      onClick={() => addRecipient(u)}
                    >
                      {u.first_name} {u.last_name}
                      <small className="text-muted ms-2">({u.role})</small>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </Form.Group>
          )}

          {messageType === 'batch' && (
            <Form.Group className="mb-3">
              <Form.Label>Batch</Form.Label>
              <Form.Select
                value={targetBatch}
                onChange={(e) => setTargetBatch(e.target.value)}
              >
                <option value="">Select Batch</option>
                {BATCH_OPTIONS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </Form.Select>
            </Form.Group>
          )}

          <Form.Group className="mb-3">
            <Form.Label>Message</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowNewMessageModal(false)}>
            Cancel
          </Button>
          <Button className="btn-primary-gradient" onClick={handleSendMessage}>
            Send Message
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ChatPage;
