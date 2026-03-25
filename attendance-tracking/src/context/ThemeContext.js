// src/context/ThemeContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await SecureStore.getItemAsync('theme');
      if (savedTheme !== null) {
        setIsDarkMode(JSON.parse(savedTheme));
      }
    } catch (error) {
      console.warn('Error loading theme, using default:', error);
      setIsDarkMode(false);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = async () => {
    try {
      const newTheme = !isDarkMode;
      setIsDarkMode(newTheme);
      await SecureStore.setItemAsync('theme', JSON.stringify(newTheme));
    } catch (error) {
      console.warn('Error saving theme:', error);
    }
  };

  const theme = {
    isDarkMode,
    isLoading,
    toggleTheme,
    colors: {
      primary: '#3B82F6',
      secondary: '#60A5FA',
      background: isDarkMode ? '#1F2937' : '#FFFFFF',
      surface: isDarkMode ? '#374151' : '#F3F4F6',
      text: isDarkMode ? '#F9FAFB' : '#111827',
      textSecondary: isDarkMode ? '#D1D5DB' : '#6B7280',
      border: isDarkMode ? '#4B5563' : '#E5E7EB',
      success: '#10B981',
      error: '#EF4444',
      warning: '#F59E0B',
    }
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};