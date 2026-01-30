import api from './api';

export const notificationService = {
  // Get notifications
  getNotifications: async (limit = 20, unreadOnly = false) => {
    const response = await api.get('/notifications', {
      params: { limit, unread_only: unreadOnly },
    });
    return response.data;
  },

  // Mark notification as read
  markAsRead: async (notificationId) => {
    const response = await api.put(`/notifications/${notificationId}/read`);
    return response.data;
  },

  // Mark all as read
  markAllAsRead: async () => {
    const response = await api.put('/notifications/read-all');
    return response.data;
  },

  // Get unread count
  getUnreadCount: async () => {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  },
};
