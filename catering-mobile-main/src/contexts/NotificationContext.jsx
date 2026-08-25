// src/contexts/NotificationContext.jsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import { notificationAPI } from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated, user } = useAuth();

  // Load notifications when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications();
    } else {
      loadLocalNotifications();
    }
  }, [isAuthenticated, user?.id]);

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const response = await notificationAPI.getNotifications({ per_page: 50 });
      if (response.data.success) {
        const data = response.data.data;
        setNotifications(data.data || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (error) {
      console.log('Error loading notifications:', error);
      loadLocalNotifications();
    } finally {
      setIsLoading(false);
    }
  };

  const loadLocalNotifications = async () => {
    try {
      const saved = await AsyncStorage.getItem('@notifications');
      if (saved) {
        const parsed = JSON.parse(saved);
        setNotifications(parsed);
        setUnreadCount(parsed.filter(n => !n.read).length);
      }
    } catch (error) {
      console.error('Failed to load local notifications:', error);
    }
  };

  const saveLocalNotifications = async (notifs) => {
    try {
      await AsyncStorage.setItem('@notifications', JSON.stringify(notifs));
    } catch (error) {
      console.error('Failed to save local notifications:', error);
    }
  };

  const addNotification = (notification) => {
    const newNotification = {
      id: Date.now().toString(),
      read: false,
      created_at: new Date().toISOString(),
      ...notification,
    };
    
    const updated = [newNotification, ...notifications];
    setNotifications(updated);
    setUnreadCount(prev => prev + 1);
    saveLocalNotifications(updated);
  };

  const markAsRead = async (notificationId) => {
    try {
      if (isAuthenticated) {
        await notificationAPI.markAsRead(notificationId);
      }
      
      const updated = notifications.map(n => 
        n.id === notificationId ? { ...n, read: true, read_at: new Date().toISOString() } : n
      );
      setNotifications(updated);
      setUnreadCount(updated.filter(n => !n.read).length);
      saveLocalNotifications(updated);
    } catch (error) {
      console.log('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      if (isAuthenticated) {
        await notificationAPI.markAllAsRead();
      }
      
      const updated = notifications.map(n => ({ 
        ...n, 
        read: true, 
        read_at: new Date().toISOString() 
      }));
      setNotifications(updated);
      setUnreadCount(0);
      saveLocalNotifications(updated);
    } catch (error) {
      console.log('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      if (isAuthenticated) {
        await notificationAPI.deleteNotification(notificationId);
      }
      
      const updated = notifications.filter(n => n.id !== notificationId);
      setNotifications(updated);
      setUnreadCount(updated.filter(n => !n.read).length);
      saveLocalNotifications(updated);
    } catch (error) {
      console.log('Error deleting notification:', error);
    }
  };

  const clearAll = async () => {
    try {
      if (isAuthenticated) {
        await notificationAPI.clearAll();
      }
      setNotifications([]);
      setUnreadCount(0);
      saveLocalNotifications([]);
    } catch (error) {
      console.log('Error clearing notifications:', error);
    }
  };

  const refreshNotifications = () => {
    if (isAuthenticated) {
      loadNotifications();
    }
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      isLoading,
      addNotification,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      clearAll,
      refreshNotifications,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};