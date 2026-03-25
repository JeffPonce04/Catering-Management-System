import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import React from 'react';
import LoginPage from './pages/Login/LoginPage';
import Navigation from './Components/Navigation';
import Dashboard from './Components/Dashboard';
import Inventory from './Components/Inventory';
import Staff from './Components/Staff_Management';
import Schedule from './Components/Staff_Scheduling';
import Attendance from './Components/Staff_Attendance';
import Payroll from './Components/Staff_Payroll';
import { useAuth } from './Components/Context/AuthContext';
import './App.css'; // Make sure you have this CSS file

const LoadingScreen = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '1.2rem',
    color: '#666'
  }}>
    Loading...
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  console.log('ProtectedRoute - isAuthenticated:', isAuthenticated, 'loading:', loading);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    console.log('Not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  console.log('Authenticated, rendering protected content');
  return children;
};

const AppLayout = ({ children }) => {
  const { isAuthenticated } = useAuth();
  console.log('AppLayout - isAuthenticated:', isAuthenticated);
  
  return (
    <div className="app-layout">
      <Navigation />
      <div className="main-content">
        {children}
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Route */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* Protected Routes with AppLayout */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/inventory" element={
          <ProtectedRoute>
            <AppLayout>
              <Inventory />
            </AppLayout>
          </ProtectedRoute>
        } />

        {/* Staff Management routes - properly structured with AppLayout */}
        <Route path="/staff" element={
          <ProtectedRoute>
            <AppLayout>
              <Staff />
            </AppLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/staff/directory" element={
          <ProtectedRoute>
            <AppLayout>
              <Staff />
            </AppLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/staff/attendance" element={
          <ProtectedRoute>
            <AppLayout>
              <Attendance />
            </AppLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/staff/payroll" element={
          <ProtectedRoute>
            <AppLayout>
              <Payroll />
            </AppLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/staff/schedule" element={
          <ProtectedRoute>
            <AppLayout>
              <Schedule />
            </AppLayout>
          </ProtectedRoute>
        } />
        
        {/* Catch all route - redirect to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
} 

export default App;