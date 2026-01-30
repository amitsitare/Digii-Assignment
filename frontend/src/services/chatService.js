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

  // Get conversations
  getConversations: async () => {
    const response = await api.get('/chat/conversations');
    return response.data;
  },
};
