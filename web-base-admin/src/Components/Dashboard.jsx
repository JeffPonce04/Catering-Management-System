import React from 'react';
import { useAuth } from './Context/AuthContext';
import './styles/Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Dashboard Overview</h2>
        <p>Welcome back, {user?.full_name || 'User'}!</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>Total Orders</h3>
            <p className="stat-value">156</p>
            <span className="stat-change">+12% from last month</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>Total Customers</h3>
            <p className="stat-value">89</p>
            <span className="stat-change">+5 new this week</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>Revenue</h3>
            <p className="stat-value">₱45,678</p>
            <span className="stat-change">+8% from yesterday</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <h3>Upcoming Events</h3>
            <p className="stat-value">12</p>
            <span className="stat-change">Next event in 2 days</span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="chart-card">
          <h3>Recent Orders</h3>
          <div className="recent-orders">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="order-item">
                <div className="order-info">
                  <span className="order-id">#ORD-{2024000 + i}</span>
                  <span className="order-customer">John Doe</span>
                </div>
                <div className="order-status completed">Completed</div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <h3>Recent Activities</h3>
          <div className="activities-list">
            {[1,2,3,4].map(i => (
              <div key={i} className="activity-item">
                <div className="activity-icon">🔔</div>
                <div className="activity-details">
                  <p>New order received</p>
                  <span className="activity-time">5 minutes ago</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;