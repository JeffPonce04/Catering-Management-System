import React from 'react';
import { App as AntdApp } from 'antd';
import { AppDataProvider } from '../../contexts/AppDataContext';
import { AuthProvider } from '../../contexts/AuthContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { QueryProvider } from './QueryProvider';

const AppProviders = ({ children }) => (
  <QueryProvider>
    <AuthProvider>
      <NotificationProvider>
        <AppDataProvider>
          <AntdApp>{children}</AntdApp>
        </AppDataProvider>
      </NotificationProvider>
    </AuthProvider>
  </QueryProvider>
);

export default AppProviders;
