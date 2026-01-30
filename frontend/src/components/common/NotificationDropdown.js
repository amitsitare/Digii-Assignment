import React from 'react';
import { Dropdown, Badge } from 'react-bootstrap';
import { useNotifications } from '../../context/NotificationContext';
import { getRelativeTime } from '../../utils/constants';

const NotificationDropdown = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
  };

  return (
    <Dropdown align="end" className="me-2">
      <Dropdown.Toggle
        variant="link"
        className="nav-link position-relative text-decoration-none"
        id="notification-dropdown"
      >
        Notifications
        {unreadCount > 0 && (
          <Badge
            bg="danger"
            pill
            className="position-absolute"
            style={{ top: '0', right: '-5px', fontSize: '0.65rem' }}
          >
            {unreadCount}
          </Badge>
        )}
      </Dropdown.Toggle>

      <Dropdown.Menu className="notification-dropdown p-0">
        <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
          <strong>Notifications</strong>
          {unreadCount > 0 && (
            <small
              className="text-primary"
              style={{ cursor: 'pointer' }}
              onClick={markAllAsRead}
            >
              Mark all read
            </small>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="p-4 text-center text-muted">
            No notifications
          </div>
        ) : (
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {notifications.slice(0, 10).map((notification) => (
              <div
                key={notification.id}
                className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="fw-medium">{notification.title}</div>
                <div className="text-muted small">{notification.content}</div>
                <div className="notification-time mt-1">
                  {getRelativeTime(notification.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="p-2 border-top text-center">
          <small className="text-muted">
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </small>
        </div>
      </Dropdown.Menu>
    </Dropdown>
  );
};

export default NotificationDropdown;
