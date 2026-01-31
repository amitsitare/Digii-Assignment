import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Container, Form, Button, Modal } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { chatService } from '../services/chatService';
import { adminService } from '../services/adminService';
import { getRelativeTime } from '../utils/constants';

const SEND_MODES = {
  BROADCAST: 'broadcast',
  ADMIN: 'admin',                    // professor/student: send to selected admin(s) only
  ALL_PROFESSORS: 'all_professors',  // admin: send to all professors
  SELECTED_PROFESSORS: 'selected_professors',
  SELECTED_STUDENTS: 'selected_students',
};

const ChatPage = () => {
  const { user } = useAuth();
  const [receivedMessages, setReceivedMessages] = useState([]);
  const [, setSentMessages] = useState([]);
  const [, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [, setNewMessage] = useState('');
  const [, setSelectedRecipients] = useState([]);
  const [, setMessageType] = useState('direct');
  const [, setTargetBatch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);

  // Admin/Professor: send-mode choice and list selection
  const [adminSendMode, setAdminSendMode] = useState(null);
  const [professorsList, setProfessorsList] = useState([]);
  const [studentsList, setStudentsList] = useState([]);
  const [adminsList, setAdminsList] = useState([]);
  const [selectedProfessorIds, setSelectedProfessorIds] = useState(new Set());
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
  const [selectedAdminIds, setSelectedAdminIds] = useState(new Set());
  const [loadingProfessors, setLoadingProfessors] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [recipientSearchProfessor, setRecipientSearchProfessor] = useState('');
  const [recipientSearchStudent, setRecipientSearchStudent] = useState('');

  // WhatsApp-style: conversation list + active chat thread
  const [conversations, setConversations] = useState([]);
  const [activeChatUser, setActiveChatUser] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadMessageInput, setThreadMessageInput] = useState('');
  const [sendingFromThread, setSendingFromThread] = useState(false);

  // After modal "Continue": show ChatGPT-style page (left list + dark chat). No send in modal.
  const [activeSendMode, setActiveSendMode] = useState(null);
  const [chatViewMessages, setChatViewMessages] = useState([]);
  const [chatViewInput, setChatViewInput] = useState('');
  const [sendingChatView, setSendingChatView] = useState(false);
  const chatViewTextareaRef = useRef(null);

  const isAdmin = user?.role === 'admin';
  const isProfessor = user?.role === 'professor';
  const isStudent = user?.role === 'student';
  const myId = user?.id != null ? Number(user.id) : null;

  const fetchData = useCallback(async () => {
    try {
      const [messagesData, sentData, convData] = await Promise.all([
        chatService.getMessages(),
        chatService.getSentMessages(),
        chatService.getConversations().catch(() => ({ conversations: [] })),
      ]);
      setReceivedMessages(messagesData.messages || []);
      setSentMessages(sentData.messages);
      setConversations(convData.conversations || []);
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

  // Auto-open send-mode modal for admin, professor, and student (so they select how to send)
  useEffect(() => {
    if (!loading && (isAdmin || isProfessor || isStudent)) {
      setShowNewMessageModal(true);
    }
  }, [loading, isAdmin, isProfessor, isStudent]);

  const fetchThread = useCallback(async (otherUserId) => {
    if (!otherUserId) return;
    setLoadingThread(true);
    try {
      const data = await chatService.getConversationThread(otherUserId);
      setThreadMessages(data.messages || []);
      setActiveChatUser((prev) =>
        prev && data.other_user && prev.id === data.other_user.id ? { ...data.other_user } : prev
      );
    } catch (err) {
      console.error('Failed to fetch thread:', err);
      setThreadMessages([]);
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    if (activeChatUser?.id) {
      fetchThread(activeChatUser.id);
    } else {
      setThreadMessages([]);
    }
  }, [activeChatUser?.id, fetchThread]);

  const openConversation = (conv) => {
    setActiveChatUser(conv ? { id: conv.id, first_name: conv.first_name, last_name: conv.last_name, role: conv.role } : null);
  };

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchUsers();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, searchUsers]);

  // Normalize API response to array of users (backend may return { users: [...] })
  const normalizeUsersResponse = (data) => {
    if (!data) return [];
    if (Array.isArray(data.users)) return data.users;
    if (Array.isArray(data)) return data;
    return [];
  };

  // Fetch professors list when modal or chat view needs professors (admin, professor, or student)
  useEffect(() => {
    const needProfessors =
      (isAdmin && (adminSendMode === SEND_MODES.SELECTED_PROFESSORS || activeSendMode === SEND_MODES.ALL_PROFESSORS || activeSendMode === SEND_MODES.SELECTED_PROFESSORS)) ||
      (isProfessor && (adminSendMode === SEND_MODES.SELECTED_PROFESSORS || activeSendMode === SEND_MODES.SELECTED_PROFESSORS)) ||
      (isStudent && (adminSendMode === SEND_MODES.SELECTED_PROFESSORS || activeSendMode === SEND_MODES.SELECTED_PROFESSORS));
    if (!needProfessors) return;
    setLoadingProfessors(true);
    const fetch = isAdmin ? adminService.getUsers({ role: 'professor' }) : chatService.getRecipients('professor');
    fetch
      .then((data) => setProfessorsList(normalizeUsersResponse(data)))
      .catch(() => setProfessorsList([]))
      .finally(() => setLoadingProfessors(false));
  }, [isAdmin, isProfessor, isStudent, adminSendMode, activeSendMode]);

  // Fetch students list when modal or chat view needs students (admin, professor, or student)
  useEffect(() => {
    const needStudents =
      (isAdmin && (adminSendMode === SEND_MODES.SELECTED_STUDENTS || activeSendMode === SEND_MODES.SELECTED_STUDENTS)) ||
      (isProfessor && (adminSendMode === SEND_MODES.SELECTED_STUDENTS || activeSendMode === SEND_MODES.SELECTED_STUDENTS)) ||
      (isStudent && (adminSendMode === SEND_MODES.SELECTED_STUDENTS || activeSendMode === SEND_MODES.SELECTED_STUDENTS));
    if (!needStudents) return;
    setLoadingStudents(true);
    const fetch = isAdmin ? adminService.getUsers({ role: 'student' }) : chatService.getRecipients('student');
    fetch
      .then((data) => setStudentsList(normalizeUsersResponse(data)))
      .catch(() => setStudentsList([]))
      .finally(() => setLoadingStudents(false));
  }, [isAdmin, isProfessor, isStudent, adminSendMode, activeSendMode]);

  // Fetch admins list when professor or student selects "Admin" mode
  useEffect(() => {
    const needAdmins = (isProfessor || isStudent) && (adminSendMode === SEND_MODES.ADMIN || activeSendMode === SEND_MODES.ADMIN);
    if (!needAdmins) return;
    setLoadingAdmins(true);
    chatService
      .getRecipients('admin')
      .then((data) => setAdminsList(data.users || []))
      .catch(() => setAdminsList([]))
      .finally(() => setLoadingAdmins(false));
  }, [isProfessor, isStudent, adminSendMode, activeSendMode]);

  // Fetch messages only for the selected students/professors/admins (specific thread)
  const fetchChatViewMessages = useCallback(async () => {
    if (!activeSendMode) return;
    let ids = [];
    if (activeSendMode === SEND_MODES.SELECTED_PROFESSORS) {
      ids = Array.from(selectedProfessorIds);
    } else if (activeSendMode === SEND_MODES.SELECTED_STUDENTS) {
      ids = Array.from(selectedStudentIds);
    } else if (activeSendMode === SEND_MODES.ALL_PROFESSORS && professorsList.length) {
      ids = professorsList.map((p) => p.id).filter(Boolean);
    } else if (activeSendMode === SEND_MODES.ADMIN) {
      ids = Array.from(selectedAdminIds);
    }
    if (ids.length === 0) {
      setChatViewMessages([]);
      return;
    }
    try {
      const data = await chatService.getSentMessagesToRecipients(ids);
      const list = (data.messages || []).map((m) => ({
        ...m,
        is_mine: m.sender_id === myId,
      }));
      setChatViewMessages(list);
    } catch (err) {
      console.error('Failed to fetch thread messages:', err);
      setChatViewMessages([]);
    }
  }, [activeSendMode, selectedProfessorIds, selectedStudentIds, selectedAdminIds, professorsList, myId]);

  useEffect(() => {
    if (!activeSendMode) return;
    if (
      activeSendMode === SEND_MODES.BROADCAST ||
      (activeSendMode === SEND_MODES.SELECTED_PROFESSORS && selectedProfessorIds.size === 0) ||
      (activeSendMode === SEND_MODES.SELECTED_STUDENTS && selectedStudentIds.size === 0) ||
      (activeSendMode === SEND_MODES.ADMIN && selectedAdminIds.size === 0)
    ) {
      setChatViewMessages([]);
      return;
    }
    fetchChatViewMessages();
  }, [activeSendMode, selectedProfessorIds, selectedStudentIds, selectedAdminIds, professorsList, fetchChatViewMessages]);

  const resetAdminSendState = useCallback(() => {
    setAdminSendMode(null);
    setSelectedProfessorIds(new Set());
    setSelectedStudentIds(new Set());
    setSelectedAdminIds(new Set());
    setProfessorsList([]);
    setStudentsList([]);
    setAdminsList([]);
  }, []);

  const handleCloseNewMessageModal = () => {
    setShowNewMessageModal(false);
    setNewMessage('');
    setSelectedRecipients([]);
    setMessageType('direct');
    setTargetBatch('');
    setSearchQuery('');
    setSearchResults([]);
    resetAdminSendState();
  };

  // Modal is only for selecting how to send. Continue opens ChatGPT-style page (admin, professor, or student).
  const handleContinueFromModal = () => {
    if ((isAdmin || isProfessor || isStudent) && adminSendMode) {
      setActiveSendMode(adminSendMode);
      setChatViewMessages([]);
    }
    setShowNewMessageModal(false);
  };

  const sendFromThread = async () => {
    const content = (threadMessageInput || '').trim();
    if (!content || !activeChatUser?.id) return;
    setSendingFromThread(true);
    try {
      await chatService.sendMessage({
        content,
        message_type: 'direct',
        recipients: [activeChatUser.id],
      });
      setThreadMessageInput('');
      const data = await chatService.getConversationThread(activeChatUser.id);
      setThreadMessages(data.messages || []);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send message');
    } finally {
      setSendingFromThread(false);
    }
  };

  const sendFromChatView = async () => {
    const content = (chatViewInput || '').trim();
    if (!content || !activeSendMode) return;
    if (
      (activeSendMode === SEND_MODES.SELECTED_PROFESSORS && selectedProfessorIds.size === 0) ||
      (activeSendMode === SEND_MODES.SELECTED_STUDENTS && selectedStudentIds.size === 0) ||
      (activeSendMode === SEND_MODES.ADMIN && selectedAdminIds.size === 0)
    ) {
      alert(
        activeSendMode === SEND_MODES.ADMIN
          ? 'Please select at least one admin.'
          : activeSendMode === SEND_MODES.SELECTED_PROFESSORS
            ? 'Please select at least one professor.'
            : 'Please select at least one student.'
      );
      return;
    }
    setSendingChatView(true);
    try {
      let payload = { content };
      if (activeSendMode === SEND_MODES.BROADCAST) {
        payload.message_type = 'broadcast';
      } else if (activeSendMode === SEND_MODES.ADMIN) {
        payload.message_type = 'direct';
        payload.recipients = Array.from(selectedAdminIds);
      } else if (activeSendMode === SEND_MODES.ALL_PROFESSORS) {
        const ids = (professorsList || []).map((u) => u.id).filter(Boolean);
        if (ids.length === 0) {
          alert('No professors found.');
          setSendingChatView(false);
          return;
        }
        payload.message_type = 'direct';
        payload.recipients = ids;
      } else if (activeSendMode === SEND_MODES.SELECTED_PROFESSORS) {
        payload.message_type = 'direct';
        payload.recipients = Array.from(selectedProfessorIds);
      } else if (activeSendMode === SEND_MODES.SELECTED_STUDENTS) {
        payload.message_type = 'direct';
        payload.recipients = Array.from(selectedStudentIds);
      }
      await chatService.sendMessage(payload);
      setChatViewInput('');
      if (chatViewTextareaRef.current) {
        chatViewTextareaRef.current.style.height = 'auto';
      }
      fetchData();
      fetchChatViewMessages();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send message');
    } finally {
      setSendingChatView(false);
    }
  };

  const toggleProfessor = (id) => {
    setSelectedProfessorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleStudent = (id) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllProfessors = () => {
    if (selectedProfessorIds.size === professorsList.length) {
      setSelectedProfessorIds(new Set());
    } else {
      setSelectedProfessorIds(new Set(professorsList.map((p) => p.id)));
    }
  };

  const selectAllStudents = () => {
    if (selectedStudentIds.size === studentsList.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(studentsList.map((s) => s.id)));
    }
  };

  const toggleAdmin = (id) => {
    setSelectedAdminIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filterBySearch = (list, search, nameKeys = ['first_name', 'last_name', 'email']) => {
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((item) =>
      nameKeys.some((k) => (item[k] || '').toString().toLowerCase().includes(q))
    );
  };

  const filteredProfessors = filterBySearch(professorsList, recipientSearchProfessor);
  const filteredStudents = filterBySearch(studentsList, recipientSearchStudent);

  if (loading) {
    return (
      <Container className="py-5">
        <div className="loading-spinner">Loading...</div>
      </Container>
    );
  }

  const displayName = user?.first_name || user?.email || 'there';

  // Format sender label for received messages: "From: Name (role)" or "Broadcast message sent by Name"
  const getReceivedMessageSenderLabel = (msg) => {
    const name = [msg.sender_first_name, msg.sender_last_name].filter(Boolean).join(' ') || 'Unknown';
    const role = (msg.sender_role || '').toLowerCase();
    const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : '';
    if (msg.message_type === 'broadcast') {
      return `Broadcast message sent by ${name}`;
    }
    if (msg.message_type === 'department') {
      return `Department message sent by ${name}`;
    }
    if (msg.message_type === 'batch') {
      return `Batch message sent by ${name}`;
    }
    return roleLabel ? `From: ${name} (${roleLabel})` : `From: ${name}`;
  };

  const recentReceived = (receivedMessages || []).slice(0, 25);

  // When user clicks a received message in the right panel, open chat with that sender
  const openChatWithSender = (msg) => {
    if (!msg?.sender_id) return;
    setActiveSendMode(null);
    setActiveChatUser({
      id: msg.sender_id,
      first_name: msg.sender_first_name || '',
      last_name: msg.sender_last_name || '',
      role: msg.sender_role || '',
    });
  };

  return (
    <Container fluid className="chat-page-whatsapp chat-page-no-gap px-0">
      <div className="chat-layout chat-layout-gpt">
        {/* Left: list (professors/students when activeSendMode) or minimal "New chat" only */}
        <div className="chat-sidebar">
          {activeSendMode ? (
            <>
              <div className="chat-sidebar-header">
                <h5 className="mb-0 fw-bold">
                  {activeSendMode === SEND_MODES.BROADCAST && 'Everyone'}
                  {activeSendMode === SEND_MODES.ADMIN && 'Select admin'}
                  {activeSendMode === SEND_MODES.ALL_PROFESSORS && 'Professors'}
                  {activeSendMode === SEND_MODES.SELECTED_PROFESSORS && 'Select professors'}
                  {activeSendMode === SEND_MODES.SELECTED_STUDENTS && 'Select students'}
                </h5>
              </div>
              <div className="chat-list-panel">
                {activeSendMode === SEND_MODES.BROADCAST && (
                  <p className="text-muted small text-center py-4 px-2">Sending to everyone.</p>
                )}
                {activeSendMode === SEND_MODES.ADMIN && (
                  <>
                    {loadingAdmins ? (
                      <p className="text-muted small text-center py-3">Loading...</p>
                    ) : adminsList.length === 0 ? (
                      <p className="text-muted small text-center py-3">No admins found</p>
                    ) : (
                      <>
                        <p className="text-muted small px-2 mb-2">Select the admin you want to message (no option to send to all admins).</p>
                        <div className="list-scroll flex-grow-1 overflow-auto">
                          {adminsList.map((a) => (
                            <div
                              key={a.id}
                              className="d-flex align-items-center gap-2 py-2 px-2 recipient-item cursor-pointer"
                              onClick={() => toggleAdmin(a.id)}
                            >
                              <Form.Check
                                type="checkbox"
                                checked={selectedAdminIds.has(a.id)}
                                onChange={() => toggleAdmin(a.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="small">
                                {a.first_name} {a.last_name}
                                <span className="text-muted ms-1">(Admin)</span>
                              </span>
                            </div>
                          ))}
                        </div>
                        {selectedAdminIds.size > 0 && (
                          <small className="text-primary ms-2 mt-2">{selectedAdminIds.size} selected</small>
                        )}
                      </>
                    )}
                  </>
                )}
                {(activeSendMode === SEND_MODES.ALL_PROFESSORS ||
                  activeSendMode === SEND_MODES.SELECTED_PROFESSORS) && (
                  <>
                    {activeSendMode === SEND_MODES.SELECTED_PROFESSORS && (
                      <>
                        <Form.Control
                          type="text"
                          placeholder="Search professors..."
                          value={recipientSearchProfessor}
                          onChange={(e) => setRecipientSearchProfessor(e.target.value)}
                          className="mb-2 rounded-pill mx-2"
                          size="sm"
                        />
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="rounded-pill ms-2 mb-2"
                          onClick={selectAllProfessors}
                        >
                          {selectedProfessorIds.size === professorsList.length ? 'Deselect all' : 'Select all'}
                        </Button>
                      </>
                    )}
                    <div className="list-scroll flex-grow-1 overflow-auto">
                      {loadingProfessors ? (
                        <p className="text-muted small text-center py-3">Loading...</p>
                      ) : filteredProfessors.length === 0 ? (
                        <p className="text-muted small text-center py-3">No professors found</p>
                      ) : (
                        filteredProfessors.map((p) => (
                          <div
                            key={p.id}
                            className={`d-flex align-items-center gap-2 py-2 px-2 recipient-item ${activeSendMode === SEND_MODES.SELECTED_PROFESSORS ? 'cursor-pointer' : ''}`}
                            onClick={() =>
                              activeSendMode === SEND_MODES.SELECTED_PROFESSORS && toggleProfessor(p.id)
                            }
                          >
                            {activeSendMode === SEND_MODES.SELECTED_PROFESSORS && (
                              <Form.Check
                                type="checkbox"
                                checked={selectedProfessorIds.has(p.id)}
                                onChange={() => toggleProfessor(p.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                            <span className="small">
                              {p.first_name} {p.last_name}
                              {p.department_name && (
                                <span className="text-muted ms-1">({p.department_name})</span>
                              )}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                    {activeSendMode === SEND_MODES.SELECTED_PROFESSORS && selectedProfessorIds.size > 0 && (
                      <small className="text-primary ms-2 mt-2">{selectedProfessorIds.size} selected</small>
                    )}
                  </>
                )}
                {activeSendMode === SEND_MODES.SELECTED_STUDENTS && (
                  <>
                    <Form.Control
                      type="text"
                      placeholder="Search students..."
                      value={recipientSearchStudent}
                      onChange={(e) => setRecipientSearchStudent(e.target.value)}
                      className="mb-2 rounded-pill mx-2"
                      size="sm"
                    />
                    <Button
                      variant="outline-primary"
                      size="sm"
                      className="rounded-pill ms-2 mb-2"
                      onClick={selectAllStudents}
                    >
                      {selectedStudentIds.size === studentsList.length ? 'Deselect all' : 'Select all'}
                    </Button>
                    <div className="list-scroll flex-grow-1 overflow-auto">
                      {loadingStudents ? (
                        <p className="text-muted small text-center py-3">Loading...</p>
                      ) : filteredStudents.length === 0 ? (
                        <p className="text-muted small text-center py-3">No students found</p>
                      ) : (
                        filteredStudents.map((s) => (
                          <div
                            key={s.id}
                            className="d-flex align-items-center gap-2 py-2 px-2 recipient-item cursor-pointer"
                            onClick={() => toggleStudent(s.id)}
                          >
                            <Form.Check
                              type="checkbox"
                              checked={selectedStudentIds.has(s.id)}
                              onChange={() => toggleStudent(s.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="small">
                              {s.first_name} {s.last_name}
                              {(s.batch || s.department_name) && (
                                <span className="text-muted ms-1">
                                  ({[s.batch, s.department_name].filter(Boolean).join(', ')})
                                </span>
                              )}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                    {selectedStudentIds.size > 0 && (
                      <small className="text-primary ms-2 mt-2">{selectedStudentIds.size} selected</small>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="chat-sidebar-header">
                <h5 className="mb-0 fw-bold">Messages</h5>
                <span className="text-muted small">Hi, {displayName}</span>
                <Button
                  size="sm"
                  className="btn-primary-gradient rounded-pill"
                  onClick={() => setShowNewMessageModal(true)}
                >
                  New chat
                </Button>
              </div>
              <p className="text-muted small text-center px-3 py-2 mb-0">
                {(isProfessor || isStudent)
                  ? 'Choose how to send: Broadcast to all, Admin, Selected Professors, or Selected Students.'
                  : 'Choose how to send: Broadcast, Professors, or Students.'}
              </p>
              <div className="chat-conversation-list">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`chat-conv-item ${activeChatUser?.id === conv.id ? 'active' : ''}`}
                    onClick={() => openConversation(conv)}
                  >
                    <div className="chat-conv-avatar">
                      {(conv.first_name?.[0] || '') + (conv.last_name?.[0] || '') || '?'}
                    </div>
                    <div className="chat-conv-body">
                      <div className="chat-conv-name">
                        {conv.first_name} {conv.last_name}
                      </div>
                      <div className="chat-conv-preview text-muted">
                        {(conv.last_message || '').slice(0, 40)}
                        {(conv.last_message || '').length > 40 ? '…' : ''}
                      </div>
                    </div>
                    <div className="chat-conv-time text-muted small">
                      {conv.last_message_time ? getRelativeTime(conv.last_message_time) : ''}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right: always ChatGPT-style page (no middle "Select a conversation" page) */}
        <div className="chat-main chat-main-gpt">
          {activeSendMode ? (
            <>
              <div className="chat-gpt-recipients-bar">
                {activeSendMode === SEND_MODES.BROADCAST && (
                  <span className="chat-gpt-recipient-pill">Everyone</span>
                )}
                {activeSendMode === SEND_MODES.ADMIN &&
                  adminsList
                    .filter((a) => selectedAdminIds.has(a.id))
                    .map((a) => (
                      <span key={a.id} className="chat-gpt-recipient-pill">
                        {a.first_name} {a.last_name}
                      </span>
                    ))}
                {activeSendMode === SEND_MODES.ALL_PROFESSORS &&
                  professorsList.map((p) => (
                    <span key={p.id} className="chat-gpt-recipient-pill">
                      {p.first_name} {p.last_name}
                    </span>
                  ))}
                {activeSendMode === SEND_MODES.SELECTED_PROFESSORS &&
                  professorsList
                    .filter((p) => selectedProfessorIds.has(p.id))
                    .map((p) => (
                      <span key={p.id} className="chat-gpt-recipient-pill">
                        {p.first_name} {p.last_name}
                      </span>
                    ))}
                {activeSendMode === SEND_MODES.SELECTED_STUDENTS &&
                  studentsList
                    .filter((s) => selectedStudentIds.has(s.id))
                    .map((s) => (
                      <span key={s.id} className="chat-gpt-recipient-pill">
                        {s.first_name} {s.last_name}
                      </span>
                    ))}
              </div>
              <div className="chat-gpt-messages">
                {chatViewMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`chat-gpt-bubble ${msg.is_mine ? 'mine' : 'theirs'}`}
                  >
                    <div className="chat-gpt-bubble-text">{msg.content}</div>
                    <small className="chat-gpt-bubble-time">
                      {getRelativeTime(msg.created_at)}
                    </small>
                  </div>
                ))}
              </div>
              <div className="chat-gpt-input-bar">
                <div className="chat-gpt-input-wrap">
                  <textarea
                    ref={chatViewTextareaRef}
                    className="chat-gpt-input"
                    placeholder="Ask anything"
                    value={chatViewInput}
                    onChange={(e) => setChatViewInput(e.target.value)}
                    onInput={(e) => {
                      const el = e.target;
                      el.style.height = 'auto';
                      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendFromChatView();
                      }
                    }}
                    rows={1}
                  />
                  <button
                    type="button"
                    className="chat-gpt-send-inside"
                    onClick={sendFromChatView}
                    disabled={!chatViewInput.trim() || sendingChatView}
                    aria-label="Send"
                  >
                    {sendingChatView ? '…' : '➤'}
                  </button>
                </div>
              </div>
            </>
          ) : activeChatUser ? (
            <>
              <div className="chat-thread-header">
                <div className="d-flex align-items-center gap-2">
                  <div
                    className="chat-conv-avatar"
                    style={{ width: 36, height: 36, fontSize: '0.9rem' }}
                  >
                    {(activeChatUser.first_name?.[0] || '') + (activeChatUser.last_name?.[0] || '') || '?'}
                  </div>
                  <div>
                    <strong>
                      {activeChatUser.first_name} {activeChatUser.last_name}
                    </strong>
                    {activeChatUser.role && (
                      <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                        {activeChatUser.role}
                      </small>
                    )}
                  </div>
                </div>
              </div>
              <div className="chat-thread-messages">
                {loadingThread ? (
                  <p className="text-muted text-center py-4">Loading…</p>
                ) : threadMessages.length === 0 ? (
                  <p className="text-muted text-center py-4">No messages yet. Say hello!</p>
                ) : (
                  threadMessages.map((msg) => {
                    const isMine = msg.sender_id === myId;
                    return (
                      <div
                        key={msg.id}
                        className={`chat-bubble-wrap ${isMine ? 'mine' : 'theirs'}`}
                      >
                        <div className="chat-bubble">
                          {!isMine && (
                            <small className="chat-bubble-sender text-muted">
                              {msg.sender_first_name} {msg.sender_last_name}
                            </small>
                          )}
                          <div className="chat-bubble-text">{msg.content}</div>
                          <small className="chat-bubble-time text-muted">
                            {getRelativeTime(msg.created_at)}
                          </small>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="chat-thread-input">
                <Form.Control
                  as="textarea"
                  rows={1}
                  placeholder="Type a message..."
                  value={threadMessageInput}
                  onChange={(e) => setThreadMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendFromThread();
                    }
                  }}
                  className="rounded-3 chat-input-field"
                />
                <Button
                  className="btn-primary-gradient rounded-circle ms-2 chat-send-btn"
                  onClick={sendFromThread}
                  disabled={!threadMessageInput.trim() || sendingFromThread}
                >
                  {sendingFromThread ? '…' : '➤'}
                </Button>
              </div>
            </>
          ) : !activeChatUser ? (
            <>
              <div className="chat-gpt-messages">
                <p className="text-muted mb-0 pt-2">
                  Click <strong>New chat</strong> on the left to choose how to send
                  {(isProfessor || isStudent) ? ' (Broadcast to all, Admin, Selected Professors, or Selected Students)' : ' (Broadcast, Professors, or Students)'}, then type and send here.
                </p>
              </div>
              <div className="chat-gpt-input-bar">
                <div className="chat-gpt-input-wrap">
                  <input
                    type="text"
                    className="chat-gpt-input"
                    placeholder="Ask anything"
                    readOnly
                    style={{ cursor: 'pointer' }}
                    onClick={() => setShowNewMessageModal(true)}
                  />
                  <button
                    type="button"
                    className="chat-gpt-send-inside"
                    onClick={() => setShowNewMessageModal(true)}
                    aria-label="New chat"
                  >
                    ➤
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Right: Recent received messages (admin, professor, student) */}
        <div className="chat-recent-messages">
          <div className="chat-recent-messages-header">
            <h6 className="mb-0 fw-bold">Recent received messages</h6>
          </div>
          <div className="chat-recent-messages-list">
            {recentReceived.length === 0 ? (
              <p className="text-muted small text-center py-4 px-2 mb-0">No received messages yet.</p>
            ) : (
              recentReceived.map((msg) => (
                <div
                  key={msg.id}
                  className="chat-recent-msg-item chat-recent-msg-item-clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => openChatWithSender(msg)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openChatWithSender(msg);
                    }
                  }}
                >
                  <small className="chat-recent-msg-sender text-primary fw-semibold d-block mb-1">
                    {getReceivedMessageSenderLabel(msg)}
                  </small>
                  <div className="chat-recent-msg-content">{msg.content}</div>
                  <small className="chat-recent-msg-time text-muted">{getRelativeTime(msg.created_at)}</small>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal: only for selecting how to send. User cannot close without selecting (no X, no backdrop click, no Escape). */}
      <Modal
        show={showNewMessageModal}
        onHide={handleCloseNewMessageModal}
        backdrop="static"
        keyboard={false}
        size="lg"
        centered
        className="chat-send-modal"
      >
        <Modal.Header closeButton={false} className="border-0 pb-0">
          <Modal.Title className="fw-bold">Send Message</Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-2">
          <p className="text-muted mb-3">Choose how you want to send messages. You will type and send on the next page.</p>
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <div
                className={`send-mode-card p-4 rounded-3 border border-2 h-100 cursor-pointer ${adminSendMode === SEND_MODES.BROADCAST ? 'border-primary' : ''}`}
                onClick={() => setAdminSendMode(SEND_MODES.BROADCAST)}
              >
                <div className="d-flex align-items-center gap-3">
                  <div className="send-mode-icon rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center">
                    <span className="fs-4">📢</span>
                  </div>
                  <div>
                    <h6 className="mb-1 fw-semibold">{(isProfessor || isStudent) ? 'Broadcast to all' : 'Broadcast'}</h6>
                    <small className="text-muted">{isProfessor ? 'Send to everyone (all users)' : 'Send to everyone (all users)'}</small>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-6">
              {isAdmin ? (
                <div
                  className={`send-mode-card p-4 rounded-3 border border-2 h-100 cursor-pointer ${adminSendMode === SEND_MODES.ALL_PROFESSORS ? 'border-primary' : ''}`}
                  onClick={() => setAdminSendMode(SEND_MODES.ALL_PROFESSORS)}
                >
                  <div className="d-flex align-items-center gap-3">
                    <div className="send-mode-icon rounded-circle bg-success bg-opacity-10 text-success d-flex align-items-center justify-content-center">
                      <span className="fs-4">👨‍🏫</span>
                    </div>
                    <div>
                      <h6 className="mb-1 fw-semibold">All Professors</h6>
                      <small className="text-muted">Send to every professor</small>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={`send-mode-card p-4 rounded-3 border border-2 h-100 cursor-pointer ${adminSendMode === SEND_MODES.ADMIN ? 'border-primary' : ''}`}
                  onClick={() => setAdminSendMode(SEND_MODES.ADMIN)}
                >
                  <div className="d-flex align-items-center gap-3">
                    <div className="send-mode-icon rounded-circle bg-success bg-opacity-10 text-success d-flex align-items-center justify-content-center">
                      <span className="fs-4">👤</span>
                    </div>
                    <div>
                      <h6 className="mb-1 fw-semibold">Admin</h6>
                      <small className="text-muted">Pick the specific admin you want to message (left side). No send-to-all-admins.</small>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="col-12 col-md-6">
              <div
                className={`send-mode-card p-4 rounded-3 border border-2 h-100 cursor-pointer ${adminSendMode === SEND_MODES.SELECTED_PROFESSORS ? 'border-primary' : ''}`}
                onClick={() => setAdminSendMode(SEND_MODES.SELECTED_PROFESSORS)}
              >
                <div className="d-flex align-items-center gap-3">
                  <div className="send-mode-icon rounded-circle bg-info bg-opacity-10 text-info d-flex align-items-center justify-content-center">
                    <span className="fs-4">✓👨‍🏫</span>
                  </div>
                  <div>
                    <h6 className="mb-1 fw-semibold">Selected Professors</h6>
                    <small className="text-muted">Pick professors from the list (left side)</small>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-6">
              <div
                className={`send-mode-card p-4 rounded-3 border border-2 h-100 cursor-pointer ${adminSendMode === SEND_MODES.SELECTED_STUDENTS ? 'border-primary' : ''}`}
                onClick={() => setAdminSendMode(SEND_MODES.SELECTED_STUDENTS)}
              >
                <div className="d-flex align-items-center gap-3">
                  <div className="send-mode-icon rounded-circle bg-warning bg-opacity-10 text-warning d-flex align-items-center justify-content-center">
                    <span className="fs-4">✓🎓</span>
                  </div>
                  <div>
                    <h6 className="mb-1 fw-semibold">Selected Students</h6>
                    <small className="text-muted">Pick students from the list (left side)</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0">
          <Button variant="secondary" onClick={handleCloseNewMessageModal} className="rounded-pill">
            Cancel
          </Button>
          <Button
            className="btn-primary-gradient rounded-pill"
            onClick={handleContinueFromModal}
            disabled={(isAdmin || isProfessor || isStudent) && !adminSendMode}
          >
            Continue
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ChatPage;
