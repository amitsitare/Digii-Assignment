import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

export const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      // Join user-specific room
      if (user) {
        newSocket.emit('join_room', { room: `user_${user.id}` });
        // Join role-specific room
        newSocket.emit('join_room', { room: `role_${user.role}` });
        // Join department room if applicable
        if (user.department_id) {
          newSocket.emit('join_room', { room: `dept_${user.department_id}` });
        }
      }
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- socket omitted to avoid re-run when setSocket updates
  }, [isAuthenticated, user]);

  const joinRoom = useCallback((room) => {
    if (socket && isConnected) {
      socket.emit('join_room', { room });
    }
  }, [socket, isConnected]);

  const leaveRoom = useCallback((room) => {
    if (socket && isConnected) {
      socket.emit('leave_room', { room });
    }
  }, [socket, isConnected]);

  const on = useCallback((event, callback) => {
    if (socket) {
      socket.on(event, callback);
      return () => socket.off(event, callback);
    }
  }, [socket]);

  const emit = useCallback((event, data) => {
    if (socket && isConnected) {
      socket.emit(event, data);
    }
  }, [socket, isConnected]);

  return {
    socket,
    isConnected,
    joinRoom,
    leaveRoom,
    on,
    emit,
  };
};

export default useSocket;
