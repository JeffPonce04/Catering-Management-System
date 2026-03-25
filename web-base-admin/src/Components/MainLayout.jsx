import React from 'react';
import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';
import { useAuth } from './Context/AuthContext';
import './styles/MainLayout.css';

const MainLayout = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="main-layout">
      <Navigation />
      <div className="content-area">
      
        <div className="content-body">
          <Outlet context={{ user }} />
        </div>
      </div>
    </div>
  );
};

export default MainLayout;