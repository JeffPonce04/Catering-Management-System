import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token');
      const storedUser = localStorage.getItem('user');
      
      console.log('Checking auth - Token:', token ? 'Present' : 'Not present');
      console.log('Checking auth - Stored user:', storedUser ? 'Present' : 'Not present');

      if (token && storedUser) {
        try {
          // Set the token in api headers
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // Verify token with backend
          const response = await api.get('/auth/user');
          console.log('Auth verification response:', response.data);
          
          if (response.data.success) {
            setUser(response.data.data.user || JSON.parse(storedUser));
            setIsAuthenticated(true);
          } else {
            // Token invalid, clear storage
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            delete api.defaults.headers.common['Authorization'];
            setUser(null);
            setIsAuthenticated(false);
          }
        } catch (error) {
          console.error('Auth verification failed:', error);
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          delete api.defaults.headers.common['Authorization'];
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = (token, userData) => {
    console.log('Login called with token:', token);
    console.log('Login called with user:', userData);
    
    // Store in localStorage
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    
    // Set token in api headers
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    // Update state
    setUser(userData);
    setIsAuthenticated(true);
    
    console.log('Auth state updated - isAuthenticated:', true);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      delete api.defaults.headers.common['Authorization'];
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    logout
  };

  console.log('AuthProvider state:', { isAuthenticated, loading, hasUser: !!user });

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};