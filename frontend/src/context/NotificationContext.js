import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { notificationService } from '../services/notificationService';
import { useAuth } from './AuthContext';
import { useSocket } from '../hooks/useSocket';
import { getRelativeTime } from '../utils/constants';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { isAuthenticated, user } = useAuth();
  const { on } = useSocket();
  const addNotificationRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      const data = await notificationService.getNotifications(20, false);
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchNotifications();
    
    // Fallback poll when socket is unavailable (e.g. serverless)
    const interval = setInterval(fetchNotifications, 30000);
    
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Real-time: add notification to list and show app-like toast
  const addNotification = useCallback((notification) => {
    if (!notification?.id) return;
    setNotifications(prev => {
      if (prev.some(n => n.id === notification.id)) return prev;
      return [notification, ...prev];
    });
    if (!notification.is_read) {
      setUnreadCount(prev => prev + 1);
    }
    // Show same content as in dropdown – like an in-app push notification
    const timeStr = notification.created_at ? getRelativeTime(notification.created_at) : 'Just now';
    toast(
      <div className="notification-toast-content">
        <div className="notification-toast-title">{notification.title}</div>
        <div className="notification-toast-body">{notification.content}</div>
        <div className="notification-toast-time">{timeStr}</div>
      </div>,
      {
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        className: 'notification-toast',
      }
    );
  }, []);

  addNotificationRef.current = addNotification;

  // Subscribe to real-time notifications via Socket.IO
  useEffect(() => {
    if (!isAuthenticated || !user || !on) return;
    const unsubscribe = on('new_notification', (payload) => {
      if (payload && payload.user_id === user.id && addNotificationRef.current) {
        addNotificationRef.current(payload);
      }
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [isAuthenticated, user, on]);

  const markAsRead = async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const value = {
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    addNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;
