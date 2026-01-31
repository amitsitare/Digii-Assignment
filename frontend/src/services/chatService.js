import api from './api';

export const chatService = {
  // Send message
  sendMessage: async (data) => {
    const response = await api.post('/chat/send', data);
    return response.data;
  },

  // Get messages
  getMessages: async (type) => {
    const params = type ? `?type=${type}` : '';
    const response = await api.get(`/chat/messages${params}`);
    return response.data;
  },

  // Get sent messages
  getSentMessages: async () => {
    const response = await api.get('/chat/sent');
    return response.data;
  },

  // Mark message as read
  markAsRead: async (messageId) => {
    const response = await api.put(`/chat/read/${messageId}`);
    return response.data;
  },

  // Search users for messaging
  searchUsers: async (query, role) => {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (role) params.append('role', role);
    
    const response = await api.get(`/chat/users/search?${params.toString()}`);
    return response.data;
  },

  // Get conversations (list of people I've chatted with)
  getConversations: async () => {
    const response = await api.get('/chat/conversations');
    return response.data;
  },

  // Get 1:1 conversation thread with a user (for WhatsApp-style chat view)
  getConversationThread: async (otherUserId) => {
    const response = await api.get(`/chat/conversation/${otherUserId}`);
    return response.data;
  },

  // Get messages sent to a specific set of recipients (selected students/professors only)
  getSentMessagesToRecipients: async (recipientIds) => {
    if (!recipientIds || recipientIds.length === 0) return { messages: [] };
    const ids = Array.isArray(recipientIds) ? recipientIds : Array.from(recipientIds);
    const response = await api.get(`/chat/sent/to-recipients?ids=${ids.join(',')}`);
    return response.data;
  },

  // Get recipients by role (for professor: admins, professors, students in dept)
  getRecipients: async (role) => {
    const response = await api.get(`/chat/recipients?role=${role}`);
    return response.data;
  },
};
