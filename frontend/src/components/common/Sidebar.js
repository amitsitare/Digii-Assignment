import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Sidebar = () => {
  const { user } = useAuth();

  const getMenuItems = () => {
    switch (user?.role) {
      case 'admin':
        return [
          { path: '/admin', label: 'Dashboard' },
          { path: '/admin/students', label: 'Student' },
          { path: '/admin/professors', label: 'Professor' },
          { path: '/admin/timetable', label: 'Manage Timetable' },
          { path: '/admin/auditorium', label: 'Auditorium Bookings' },
          { path: '/admin/departments', label: 'Departments' },
          { path: '/admin/classrooms', label: 'Classrooms' },
          { path: '/chat', label: 'Messages' },
        ];
      case 'professor':
        return [
          { path: '/professor', label: 'Dashboard' },
          { path: '/professor/schedule', label: 'My Schedule' },
          { path: '/professor/reschedule', label: 'Reschedule Class' },
          { path: '/chat', label: 'Messages' },
        ];
      case 'student':
        return [
          { path: '/student', label: 'Dashboard' },
          { path: '/student/timetable', label: 'My Timetable' },
          { path: '/student/auditorium', label: 'Auditorium Schedule' },
          { path: '/chat', label: 'Messages' },
        ];
      default:
        return [];
    }
  };

  return (
    <div className="sidebar">
      <div className="px-3 mb-3">
        <small className="text-uppercase text-muted">Menu</small>
      </div>
      <nav>
        {getMenuItems().map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
            end={item.path === '/admin' || item.path === '/professor' || item.path === '/student'}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;
