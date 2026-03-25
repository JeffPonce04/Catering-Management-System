import React, { useState, useEffect } from 'react';
import {
  CalendarOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  UserOutlined,
  DollarOutlined,
  PlusOutlined,
  DownloadOutlined,
  FilterOutlined,
  ReloadOutlined,
  CloseOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ScheduleOutlined,
  BarChartOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  MailOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  BankOutlined,
  IdcardOutlined,
  CoffeeOutlined,
  RiseOutlined,
  SafetyOutlined,
  HeartOutlined,
  TrophyOutlined,
  BookOutlined,
  FileTextOutlined,
  PrinterOutlined,
  ShareAltOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  CheckOutlined,
  StopOutlined,
  PauseCircleOutlined,
  RestOutlined,
  HistoryOutlined,
  InboxOutlined,
  PushpinOutlined,
  ThunderboltOutlined,
  PercentageOutlined,
  LeftOutlined,
  RightOutlined,
  DownOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileImageOutlined
} from '@ant-design/icons';
import '../Components/styles/Staff_Scheduling.css';

// Import sample images
import employee1 from './images/logo.png';
import employee2 from './images/logo.png';
import employee3 from './images/logo.png';
import employee4 from './images/logo.png';

const Staff_Scheduling = () => {
  const [activeTab, setActiveTab] = useState('calendar');
  const [selectedView, setSelectedView] = useState('week');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [currentDate, setCurrentDate] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  // Set current date
  useEffect(() => {
    const date = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    setCurrentDate(date.toLocaleDateString('en-US', options));
  }, []);

  // Sample employee data
  const [employees] = useState([
    {
      id: 'CAT-001',
      name: 'John Smith',
      initials: 'JS',
      position: 'Executive Chef',
      department: 'Kitchen Operations',
      status: 'active',
      type: 'Regular',
      shift: 'Morning',
      hourlyRate: 35,
      weeklyHours: 40,
      email: 'john.smith@catering.com',
      phone: '+1 (234) 567-8901',
      image: employee1,
      color: '#2563eb'
    },
    {
      id: 'CAT-002',
      name: 'Sarah Johnson',
      initials: 'SJ',
      position: 'Pastry Chef',
      department: 'Pastry & Desserts',
      status: 'active',
      type: 'Regular',
      shift: 'Morning',
      hourlyRate: 30,
      weeklyHours: 40,
      email: 'sarah.j@catering.com',
      phone: '+1 (234) 567-8902',
      image: employee2,
      color: '#059669'
    },
    {
      id: 'CAT-003',
      name: 'Michael Chen',
      initials: 'MC',
      position: 'Sous Chef',
      department: 'Kitchen Operations',
      status: 'onleave',
      type: 'Regular',
      shift: 'Evening',
      hourlyRate: 28,
      weeklyHours: 0,
      email: 'michael.c@catering.com',
      phone: '+1 (234) 567-8903',
      image: employee3,
      color: '#d97706'
    },
    {
      id: 'CAT-004',
      name: 'Emily Davis',
      initials: 'ED',
      position: 'Event Coordinator',
      department: 'Events Management',
      status: 'active',
      type: 'OnCall',
      shift: 'Flexible',
      hourlyRate: 25,
      weeklyHours: 20,
      email: 'emily.d@catering.com',
      phone: '+1 (234) 567-8904',
      image: employee4,
      color: '#7c3aed'
    },
    {
      id: 'CAT-005',
      name: 'Robert Wilson',
      initials: 'RW',
      position: 'Line Cook',
      department: 'Kitchen Operations',
      status: 'active',
      type: 'Regular',
      shift: 'Evening',
      hourlyRate: 22,
      weeklyHours: 40,
      email: 'robert.w@catering.com',
      phone: '+1 (234) 567-8905',
      image: null,
      color: '#dc2626'
    },
    {
      id: 'CAT-006',
      name: 'Maria Garcia',
      initials: 'MG',
      position: 'Server',
      department: 'Service Staff',
      status: 'active',
      type: 'OnCall',
      shift: 'Flexible',
      hourlyRate: 18,
      weeklyHours: 25,
      email: 'maria.g@catering.com',
      phone: '+1 (234) 567-8906',
      image: null,
      color: '#0891b2'
    }
  ]);

  // Sample shifts data
  const [shifts, setShifts] = useState([
    {
      id: 'SH-001',
      employeeId: 'CAT-001',
      employeeName: 'John Smith',
      date: '2024-03-18',
      startTime: '06:00',
      endTime: '14:00',
      department: 'Kitchen Operations',
      type: 'Regular',
      hourlyRate: 35,
      status: 'scheduled'
    },
    {
      id: 'SH-002',
      employeeId: 'CAT-002',
      employeeName: 'Sarah Johnson',
      date: '2024-03-18',
      startTime: '06:00',
      endTime: '14:00',
      department: 'Pastry & Desserts',
      type: 'Regular',
      hourlyRate: 30,
      status: 'scheduled'
    },
    {
      id: 'SH-003',
      employeeId: 'CAT-004',
      employeeName: 'Emily Davis',
      date: '2024-03-18',
      startTime: '10:00',
      endTime: '18:00',
      department: 'Events Management',
      type: 'OnCall',
      hourlyRate: 25,
      status: 'scheduled'
    },
    {
      id: 'SH-004',
      employeeId: 'CAT-005',
      employeeName: 'Robert Wilson',
      date: '2024-03-18',
      startTime: '14:00',
      endTime: '22:00',
      department: 'Kitchen Operations',
      type: 'Regular',
      hourlyRate: 22,
      status: 'scheduled'
    },
    {
      id: 'SH-005',
      employeeId: 'CAT-001',
      employeeName: 'John Smith',
      date: '2024-03-19',
      startTime: '06:00',
      endTime: '14:00',
      department: 'Kitchen Operations',
      type: 'Regular',
      hourlyRate: 35,
      status: 'scheduled'
    },
    {
      id: 'SH-006',
      employeeId: 'CAT-006',
      employeeName: 'Maria Garcia',
      date: '2024-03-19',
      startTime: '16:00',
      endTime: '22:00',
      department: 'Service Staff',
      type: 'OnCall',
      hourlyRate: 18,
      status: 'scheduled'
    }
  ]);

  // Sample time-off requests
  const [requests, setRequests] = useState([
    {
      id: 'REQ-001',
      employeeId: 'CAT-003',
      employeeName: 'Michael Chen',
      employeeInitials: 'MC',
      type: 'leave',
      startDate: '2024-03-20',
      endDate: '2024-03-25',
      reason: 'Medical Leave',
      status: 'pending',
      submittedDate: '2024-03-15'
    },
    {
      id: 'REQ-002',
      employeeId: 'CAT-006',
      employeeName: 'Maria Garcia',
      employeeInitials: 'MG',
      type: 'off',
      startDate: '2024-03-22',
      endDate: '2024-03-23',
      reason: 'Personal',
      status: 'pending',
      submittedDate: '2024-03-16'
    },
    {
      id: 'REQ-003',
      employeeId: 'CAT-002',
      employeeName: 'Sarah Johnson',
      employeeInitials: 'SJ',
      type: 'sick',
      startDate: '2024-03-19',
      endDate: '2024-03-19',
      reason: 'Sick Leave',
      status: 'approved',
      submittedDate: '2024-03-17'
    }
  ]);

  // Calculate labor costs
  const calculateLaborCosts = () => {
    const regularShifts = shifts.filter(s => s.type === 'Regular');
    const onCallShifts = shifts.filter(s => s.type === 'OnCall');
    
    const regularHours = regularShifts.reduce((total, shift) => {
      const hours = (parseInt(shift.endTime.split(':')[0]) - parseInt(shift.startTime.split(':')[0]));
      return total + hours;
    }, 0);
    
    const onCallHours = onCallShifts.reduce((total, shift) => {
      const hours = (parseInt(shift.endTime.split(':')[0]) - parseInt(shift.startTime.split(':')[0]));
      return total + hours;
    }, 0);
    
    const regularCost = regularShifts.reduce((total, shift) => {
      const hours = (parseInt(shift.endTime.split(':')[0]) - parseInt(shift.startTime.split(':')[0]));
      return total + (hours * shift.hourlyRate);
    }, 0);
    
    const onCallCost = onCallShifts.reduce((total, shift) => {
      const hours = (parseInt(shift.endTime.split(':')[0]) - parseInt(shift.startTime.split(':')[0]));
      return total + (hours * shift.hourlyRate);
    }, 0);
    
    const totalCost = regularCost + onCallCost;
    const totalHours = regularHours + onCallHours;
    const avgRate = totalHours > 0 ? (totalCost / totalHours).toFixed(2) : 0;
    
    return {
      regularHours,
      onCallHours,
      totalHours,
      regularCost,
      onCallCost,
      totalCost,
      avgRate
    };
  };

  const laborCosts = calculateLaborCosts();

  // Statistics
  const statistics = [
    { 
      label: 'Total Shifts', 
      value: shifts.length, 
      icon: <ScheduleOutlined />, 
      trend: '+3 today',
      trendDirection: 'up'
    },
    { 
      label: 'Staff Scheduled', 
      value: new Set(shifts.map(s => s.employeeId)).size, 
      icon: <TeamOutlined />, 
      trend: `${employees.filter(e => e.status === 'active').length} active`,
      trendDirection: 'neutral'
    },
    { 
      label: 'Pending Requests', 
      value: requests.filter(r => r.status === 'pending').length, 
      icon: <ClockCircleOutlined />, 
      trend: 'Need review',
      trendDirection: 'warning'
    },
    { 
      label: 'On Call Today', 
      value: shifts.filter(s => s.type === 'OnCall' && s.date === '2024-03-18').length, 
      icon: <UserOutlined />, 
      trend: 'Flexible staff',
      trendDirection: 'neutral'
    },
  ];

  // Generate week days
  const getWeekDays = () => {
    const days = [];
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay() + 1);
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const weekDays = getWeekDays();
  const weekStart = weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const weekEnd = weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Time slots
  const timeSlots = [
    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
    '20:00', '21:00', '22:00', '23:00'
  ];

  // Get shifts for a specific day and time
  const getShiftsForTimeSlot = (day, time) => {
    const dateStr = day.toISOString().split('T')[0];
    return shifts.filter(shift => 
      shift.date === dateStr && 
      shift.startTime <= time && 
      shift.endTime > time
    );
  };

  // Handle request approval
  const handleApproveRequest = (requestId) => {
    setRequests(requests.map(req => 
      req.id === requestId ? { ...req, status: 'approved' } : req
    ));
  };

  // Handle request decline
  const handleDeclineRequest = (requestId) => {
    setRequests(requests.map(req => 
      req.id === requestId ? { ...req, status: 'declined' } : req
    ));
  };

  // Add new shift
  const handleAddShift = (shiftData) => {
    const newShift = {
      id: `SH-${String(shifts.length + 1).padStart(3, '0')}`,
      ...shiftData,
      status: 'scheduled'
    };
    setShifts([...shifts, newShift]);
    setShowModal(false);
  };

  // Format currency to PHP
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount).replace('PHP', '₱');
  };

  // Navigate weeks
  const navigateWeek = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + (direction * 7));
    setSelectedDate(newDate);
  };

  return (
    <div className="sdf-scheduling-container">
      {/* Header */}
      <header className="sdf-header">
        <div className="sdf-header-left">
          <div className="sdf-logo">
            <div className="sdf-logo-icon">
              <ScheduleOutlined />
            </div>
            <div className="sdf-logo-text">
              <h1>Staff Scheduling</h1>
              <span>Enterprise System</span>
            </div>
          </div>

          <nav className="sdf-nav">
            <button 
              className={`sdf-nav-item ${activeTab === 'calendar' ? 'active' : ''}`}
              onClick={() => setActiveTab('calendar')}
            >
              <CalendarOutlined /> Calendar
            </button>
            <button 
              className={`sdf-nav-item ${activeTab === 'requests' ? 'active' : ''}`}
              onClick={() => setActiveTab('requests')}
            >
              <ClockCircleOutlined /> Requests
              {requests.filter(r => r.status === 'pending').length > 0 && (
                <span className="sdf-nav-badge">
                  {requests.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
            <button 
              className={`sdf-nav-item ${activeTab === 'employees' ? 'active' : ''}`}
              onClick={() => setActiveTab('employees')}
            >
              <TeamOutlined /> Employees
            </button>
            <button 
              className={`sdf-nav-item ${activeTab === 'costs' ? 'active' : ''}`}
              onClick={() => setActiveTab('costs')}
            >
              <DollarOutlined /> Labor Costs
            </button>
          </nav>
        </div>

        <div className="sdf-header-right">
          <div className="sdf-date">
            <CalendarOutlined />
            <span>{currentDate}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="sdf-main">
        {/* Fixed Top Section */}
        <div className="sdf-fixed-top">
          {/* Statistics Grid */}
          <div className="sdf-stats-grid">
            {statistics.map((stat, index) => (
              <div key={index} className="sdf-stat-card">
                <div className="sdf-stat-icon" style={{ 
                  background: stat.trendDirection === 'up' ? '#e6f7e6' : 
                             stat.trendDirection === 'warning' ? '#fff3e6' : '#e6f0ff' 
                }}>
                  {stat.icon}
                </div>
                <div className="sdf-stat-content">
                  <span className="sdf-stat-label">{stat.label}</span>
                  <h3 className="sdf-stat-value">{stat.value}</h3>
                  <div className="sdf-stat-footer">
                    <span className={`sdf-stat-trend sdf-trend-${stat.trendDirection}`}>
                      {stat.trendDirection === 'up' && <RiseOutlined />}
                      {stat.trend}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Labor Cost Card */}
          <div className="sdf-labor-card">
            <div className="sdf-labor-info">
              <div className="sdf-label-group">
                <span className="sdf-label-badge">
                  <DollarOutlined /> COST ANALYSIS
                </span>
                <span className="sdf-update-badge">
                  <ReloadOutlined /> Updated 2 min ago
                </span>
              </div>
              <h3>Total Labor Cost</h3>
              <h2>{formatCurrency(laborCosts.totalCost)}</h2>
              <div className="sdf-period">
                <span>
                  <CalendarOutlined /> This Week
                  <span className="sdf-date-range">{weekStart} - {weekEnd}</span>
                </span>
                <span>
                  <TeamOutlined /> {laborCosts.totalHours} Total Hours
                </span>
              </div>
            </div>
            
            <div className="sdf-labor-breakdown">
              <div className="sdf-labor-item">
                <div className="sdf-item-label">
                  <CheckCircleOutlined /> REGULAR
                </div>
                <div className="sdf-item-value">{formatCurrency(laborCosts.regularCost)}</div>
                <div className="sdf-item-sub">{laborCosts.regularHours} hours</div>
              </div>
              <div className="sdf-labor-item">
                <div className="sdf-item-label">
                  <ClockCircleOutlined /> ON-CALL
                </div>
                <div className="sdf-item-value">{formatCurrency(laborCosts.onCallCost)}</div>
                <div className="sdf-item-sub">{laborCosts.onCallHours} hours</div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="sdf-action-bar">
            <div className="sdf-action-left">
              <div className="sdf-action-badge">
                <ScheduleOutlined /> <strong>{shifts.length}</strong> Shifts Scheduled
              </div>
              <div className="sdf-action-badge">
                <TeamOutlined /> <strong>{new Set(shifts.map(s => s.employeeId)).size}</strong> Staff Working
              </div>
            </div>
            <div className="sdf-action-right">
              <div className="sdf-export-dropdown">
                <button 
                  className="sdf-btn sdf-btn-outline"
                  onClick={() => setShowExportDropdown(!showExportDropdown)}
                >
                  <DownloadOutlined /> Export <DownOutlined className="sdf-icon-small" />
                </button>
                {showExportDropdown && (
                  <div className="sdf-export-menu">
                    <div className="sdf-export-item">
                      <FileExcelOutlined /> Export as Excel
                    </div>
                    <div className="sdf-export-item">
                      <FilePdfOutlined /> Export as PDF
                    </div>
                    <div className="sdf-export-item">
                      <FileImageOutlined /> Export as Image
                    </div>
                  </div>
                )}
              </div>
              <button className="sdf-btn sdf-btn-primary" onClick={() => setShowModal(true)}>
                <PlusOutlined /> Create Shift
              </button>
            </div>
          </div>

          {/* Date Navigator and Filters */}
          <div className="sdf-control-bar">
            <div className="sdf-date-navigator">
              <button className="sdf-date-nav-btn" onClick={() => navigateWeek(-1)}>
                <LeftOutlined />
              </button>
              <span className="sdf-date-display">{weekStart} - {weekEnd}</span>
              <button className="sdf-date-nav-btn" onClick={() => navigateWeek(1)}>
                <RightOutlined />
              </button>
              <button className="sdf-today-btn">Today</button>
            </div>
            
            <div className="sdf-control-group">
              <select 
                className="sdf-filter-select"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
              >
                <option value="all">All Departments</option>
                <option value="Kitchen Operations">Kitchen Operations</option>
                <option value="Pastry & Desserts">Pastry & Desserts</option>
                <option value="Events Management">Events Management</option>
                <option value="Service Staff">Service Staff</option>
              </select>

              <div className="sdf-view-toggle">
                <button 
                  className={`sdf-view-btn ${selectedView === 'day' ? 'active' : ''}`}
                  onClick={() => setSelectedView('day')}
                >
                  Day
                </button>
                <button 
                  className={`sdf-view-btn ${selectedView === 'week' ? 'active' : ''}`}
                  onClick={() => setSelectedView('week')}
                >
                  Week
                </button>
                <button 
                  className={`sdf-view-btn ${selectedView === 'month' ? 'active' : ''}`}
                  onClick={() => setSelectedView('month')}
                >
                  Month
                </button>
              </div>

              <button className="sdf-btn sdf-btn-sm">
                <FilterOutlined /> Filter
              </button>
              <button className="sdf-btn sdf-btn-sm sdf-btn-outline">
                <ReloadOutlined /> Refresh
              </button>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="sdf-filter-chips">
            <span className="sdf-filter-chip active">
              <CheckCircleOutlined /> All Shifts
            </span>
            <span className="sdf-filter-chip">
              <UserOutlined /> Regular
            </span>
            <span className="sdf-filter-chip">
              <ClockCircleOutlined /> On-Call
            </span>
            <span className="sdf-filter-chip">
              <TeamOutlined /> Morning Shift
            </span>
            <span className="sdf-filter-chip">
              <TeamOutlined /> Evening Shift
            </span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="sdf-scrollable">
          {/* Calendar View */}
          {activeTab === 'calendar' && (
            <div className="sdf-calendar">
              <div className="sdf-calendar-header">
                <div className="sdf-calendar-header-cell">Time</div>
                {weekDays.map((day, index) => (
                  <div key={index} className="sdf-calendar-header-cell">
                    {day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
                ))}
              </div>
              <div className="sdf-calendar-body">
                {timeSlots.map((time, timeIndex) => (
                  <div key={timeIndex} className="sdf-calendar-row">
                    <div className="sdf-time-column">{time}</div>
                    {weekDays.map((day, dayIndex) => {
                      const shiftsInSlot = getShiftsForTimeSlot(day, time);
                      return (
                        <div key={dayIndex} className="sdf-cell">
                          {shiftsInSlot.map((shift, shiftIndex) => (
                            <div 
                              key={shiftIndex} 
                              className={`sdf-shift-card sdf-shift-${shift.type.toLowerCase()}`}
                              onClick={() => {
                                setSelectedShift(shift);
                                setModalMode('view');
                                setShowModal(true);
                              }}
                            >
                              <div className="sdf-shift-employee">
                                {shift.employeeName}
                                <span className={`sdf-shift-badge sdf-shift-${shift.type.toLowerCase()}`}>
                                  {shift.type}
                                </span>
                              </div>
                              <div className="sdf-shift-time">
                                {shift.startTime} - {shift.endTime}
                              </div>
                              <div className="sdf-shift-rate">
                                {formatCurrency(shift.hourlyRate)}/hr
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Requests View */}
          {activeTab === 'requests' && (
            <div className="sdf-requests-container">
              <div className="sdf-requests-grid">
                {requests.filter(r => r.status === 'pending').map((request) => (
                  <div key={request.id} className="sdf-request-card">
                    <div className="sdf-request-header">
                      <div className="sdf-request-avatar" style={{ 
                        background: employees.find(e => e.id === request.employeeId)?.color || '#2563eb' 
                      }}>
                        {request.employeeInitials}
                      </div>
                      <div className="sdf-request-info">
                        <h4>{request.employeeName}</h4>
                        <p>
                          <IdcardOutlined /> {request.employeeId}
                          <span className="sdf-dot">•</span>
                          <ClockCircleOutlined /> {request.submittedDate}
                        </p>
                      </div>
                    </div>

                    <span className={`sdf-request-type sdf-type-${request.type}`}>
                      {request.type === 'leave' && 'Leave Request'}
                      {request.type === 'off' && 'Day Off'}
                      {request.type === 'sick' && 'Sick Leave'}
                    </span>

                    <div className="sdf-request-details">
                      <div className="sdf-request-detail">
                        <div className="sdf-detail-label">Start Date</div>
                        <div className="sdf-detail-value">{request.startDate}</div>
                      </div>
                      <div className="sdf-request-detail">
                        <div className="sdf-detail-label">End Date</div>
                        <div className="sdf-detail-value">{request.endDate}</div>
                      </div>
                    </div>

                    <div className="sdf-request-reason">
                      <strong>Reason:</strong> {request.reason}
                    </div>

                    <div className="sdf-request-actions">
                      <button 
                        className="sdf-request-btn approve"
                        onClick={() => handleApproveRequest(request.id)}
                      >
                        <CheckCircleOutlined /> Approve
                      </button>
                      <button 
                        className="sdf-request-btn decline"
                        onClick={() => handleDeclineRequest(request.id)}
                      >
                        <CloseOutlined /> Decline
                      </button>
                    </div>
                  </div>
                ))}

                {requests.filter(r => r.status === 'pending').length === 0 && (
                  <div className="sdf-empty-state">
                    <ClockCircleOutlined className="sdf-empty-icon" />
                    <h3>No Pending Requests</h3>
                    <p>All time-off requests have been processed</p>
                  </div>
                )}
              </div>

              {/* Request History */}
              {requests.filter(r => r.status !== 'pending').length > 0 && (
                <div className="sdf-request-history">
                  <h3 className="sdf-history-title">
                    <HistoryOutlined /> Request History
                  </h3>
                  <div className="sdf-history-list">
                    {requests.filter(r => r.status !== 'pending').map((request) => (
                      <div key={request.id} className="sdf-history-item">
                        <div className="sdf-history-left">
                          <div className={`sdf-history-status ${request.status}`}>
                            {request.status === 'approved' ? <CheckOutlined /> : <CloseOutlined />}
                          </div>
                          <div className="sdf-history-info">
                            <h4>{request.employeeName} - {request.type}</h4>
                            <p>{request.startDate} to {request.endDate} • {request.reason}</p>
                          </div>
                        </div>
                        <span className={`sdf-history-badge ${request.status}`}>
                          {request.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Employee Schedule View */}
          {activeTab === 'employees' && (
            <div className="sdf-employee-list">
              <div className="sdf-employee-header">
                <h3>Employee Schedule Overview</h3>
                <span className="sdf-employee-count">{employees.length} Employees</span>
              </div>
              <div className="sdf-employee-grid">
                {employees.map((emp) => {
                  const employeeShifts = shifts.filter(s => s.employeeId === emp.id);
                  const totalHours = employeeShifts.reduce((total, shift) => {
                    const hours = (parseInt(shift.endTime.split(':')[0]) - parseInt(shift.startTime.split(':')[0]));
                    return total + hours;
                  }, 0);

                  return (
                    <div key={emp.id} className="sdf-employee-card">
                      <div className="sdf-employee-avatar" style={{ background: emp.color }}>
                        {emp.image ? (
                          <img src={emp.image} alt={emp.name} />
                        ) : (
                          emp.initials
                        )}
                        <span className={`sdf-status-dot ${emp.status}`} />
                      </div>
                      <div className="sdf-employee-info">
                        <div className="sdf-employee-name">{emp.name}</div>
                        <div className="sdf-employee-position">{emp.position}</div>
                        <div className="sdf-employee-meta">
                          <span><BankOutlined /> {emp.department}</span>
                          <span><DollarOutlined /> {formatCurrency(emp.hourlyRate)}/hr</span>
                        </div>
                        <div className="sdf-employee-footer">
                          <span className={`sdf-employee-type ${emp.type.toLowerCase()}`}>
                            {emp.type}
                          </span>
                          <span className="sdf-employee-hours">
                            {employeeShifts.length} shifts • {totalHours} hrs
                          </span>
                        </div>
                        {employeeShifts.length > 0 && (
                          <div className="sdf-employee-next-shift">
                            <strong>Next Shift:</strong> {employeeShifts[0].date} {employeeShifts[0].startTime}-{employeeShifts[0].endTime}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Labor Costs Detailed View */}
          {activeTab === 'costs' && (
            <div className="sdf-costs-container">
              <h3 className="sdf-costs-title">
                <BarChartOutlined /> Detailed Labor Cost Analysis
              </h3>

              <div className="sdf-costs-summary">
                <div className="sdf-cost-card">
                  <div className="sdf-cost-label">
                    <DollarOutlined /> Total Labor Cost
                  </div>
                  <div className="sdf-cost-value primary">{formatCurrency(laborCosts.totalCost)}</div>
                  <div className="sdf-cost-period">This Week</div>
                </div>

                <div className="sdf-cost-card">
                  <div className="sdf-cost-label">
                    <TeamOutlined /> Total Hours
                  </div>
                  <div className="sdf-cost-value success">{laborCosts.totalHours}</div>
                  <div className="sdf-cost-period">Staff Hours</div>
                </div>

                <div className="sdf-cost-card">
                  <div className="sdf-cost-label">
                    <PercentageOutlined /> Average Rate
                  </div>
                  <div className="sdf-cost-value warning">{formatCurrency(laborCosts.avgRate)}</div>
                  <div className="sdf-cost-period">Per Hour</div>
                </div>
              </div>

              <div className="sdf-costs-breakdown">
                {/* Regular Staff Breakdown */}
                <div className="sdf-breakdown-card">
                  <h4 className="sdf-breakdown-title">
                    <CheckCircleOutlined /> Regular Staff
                  </h4>
                  <div className="sdf-breakdown-content">
                    <div className="sdf-breakdown-item">
                      <span>Hours Worked:</span>
                      <strong>{laborCosts.regularHours} hrs</strong>
                    </div>
                    <div className="sdf-breakdown-item">
                      <span>Total Cost:</span>
                      <strong>{formatCurrency(laborCosts.regularCost)}</strong>
                    </div>
                    <div className="sdf-breakdown-total">
                      <span>Average Rate:</span>
                      <strong>{formatCurrency(laborCosts.regularCost / laborCosts.regularHours)}/hr</strong>
                    </div>
                  </div>
                </div>

                {/* On-Call Staff Breakdown */}
                <div className="sdf-breakdown-card">
                  <h4 className="sdf-breakdown-title warning">
                    <ClockCircleOutlined /> On-Call Staff
                  </h4>
                  <div className="sdf-breakdown-content">
                    <div className="sdf-breakdown-item">
                      <span>Hours Worked:</span>
                      <strong>{laborCosts.onCallHours} hrs</strong>
                    </div>
                    <div className="sdf-breakdown-item">
                      <span>Total Cost:</span>
                      <strong>{formatCurrency(laborCosts.onCallCost)}</strong>
                    </div>
                    <div className="sdf-breakdown-total">
                      <span>Average Rate:</span>
                      <strong>{formatCurrency(laborCosts.onCallCost / laborCosts.onCallHours)}/hr</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Shift Details Table */}
              <div className="sdf-table-container">
                <h4 className="sdf-table-title">Shift Details</h4>
                <table className="sdf-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Date</th>
                      <th>Shift</th>
                      <th>Hours</th>
                      <th>Rate</th>
                      <th>Total</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((shift, index) => {
                      const hours = parseInt(shift.endTime.split(':')[0]) - parseInt(shift.startTime.split(':')[0]);
                      const total = hours * shift.hourlyRate;
                      return (
                        <tr key={index}>
                          <td>{shift.employeeName}</td>
                          <td>{shift.date}</td>
                          <td>{shift.startTime} - {shift.endTime}</td>
                          <td>{hours} hrs</td>
                          <td>{formatCurrency(shift.hourlyRate)}/hr</td>
                          <td className="sdf-table-total">{formatCurrency(total)}</td>
                          <td>
                            <span className={`sdf-table-type ${shift.type.toLowerCase()}`}>
                              {shift.type}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Create/Edit Shift Modal */}
      {showModal && (
        <div className="sdf-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="sdf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sdf-modal-header">
              <h2>
                {modalMode === 'add' && <><PlusOutlined /> Create New Shift</>}
                {modalMode === 'edit' && <><EditOutlined /> Edit Shift</>}
                {modalMode === 'view' && <><EyeOutlined /> Shift Details</>}
              </h2>
              <button className="sdf-modal-close" onClick={() => setShowModal(false)}>
                <CloseOutlined />
              </button>
            </div>
            
            <div className="sdf-modal-body">
              {modalMode === 'view' && selectedShift ? (
                <div>
                  <div className="sdf-modal-employee">
                    <div className="sdf-modal-avatar" style={{ 
                      background: employees.find(e => e.id === selectedShift.employeeId)?.color || '#2563eb' 
                    }}>
                      {employees.find(e => e.id === selectedShift.employeeId)?.initials || 'U'}
                    </div>
                    <h3>{selectedShift.employeeName}</h3>
                    <p>{selectedShift.department}</p>
                    <span className={`sdf-employee-type ${selectedShift.type.toLowerCase()}`}>
                      {selectedShift.type}
                    </span>
                  </div>

                  <div className="sdf-shift-summary">
                    <div className="sdf-summary-item">
                      <span className="sdf-summary-label">Date</span>
                      <span className="sdf-summary-value">{selectedShift.date}</span>
                    </div>
                    <div className="sdf-summary-item">
                      <span className="sdf-summary-label">Time</span>
                      <span className="sdf-summary-value">{selectedShift.startTime} - {selectedShift.endTime}</span>
                    </div>
                    <div className="sdf-summary-item">
                      <span className="sdf-summary-label">Duration</span>
                      <span className="sdf-summary-value">
                        {parseInt(selectedShift.endTime.split(':')[0]) - parseInt(selectedShift.startTime.split(':')[0])} hours
                      </span>
                    </div>
                    <div className="sdf-summary-item">
                      <span className="sdf-summary-label">Hourly Rate</span>
                      <span className="sdf-summary-value">{formatCurrency(selectedShift.hourlyRate)}/hr</span>
                    </div>
                    <div className="sdf-summary-total">
                      Total: {formatCurrency((parseInt(selectedShift.endTime.split(':')[0]) - parseInt(selectedShift.startTime.split(':')[0])) * selectedShift.hourlyRate)}
                    </div>
                  </div>

                  <div className="sdf-modal-actions">
                    <button className="sdf-btn sdf-btn-outline">
                      <EditOutlined /> Edit Shift
                    </button>
                    <button className="sdf-btn sdf-btn-danger">
                      <DeleteOutlined /> Cancel Shift
                    </button>
                  </div>
                </div>
              ) : (
                <form>
                  <div className="sdf-form-group">
                    <label className="sdf-form-label">Select Employee</label>
                    <select className="sdf-form-select">
                      <option>Choose employee...</option>
                      {employees.filter(e => e.status === 'active').map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} - {emp.position} ({formatCurrency(emp.hourlyRate)}/hr)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sdf-form-row">
                    <div className="sdf-form-group">
                      <label className="sdf-form-label">Date</label>
                      <input type="date" className="sdf-form-input" />
                    </div>
                    <div className="sdf-form-group">
                      <label className="sdf-form-label">Shift Type</label>
                      <select className="sdf-form-select">
                        <option>Regular</option>
                        <option>On-Call</option>
                      </select>
                    </div>
                  </div>

                  <div className="sdf-form-row">
                    <div className="sdf-form-group">
                      <label className="sdf-form-label">Start Time</label>
                      <select className="sdf-form-select">
                        {timeSlots.map(time => (
                          <option key={time}>{time}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sdf-form-group">
                      <label className="sdf-form-label">End Time</label>
                      <select className="sdf-form-select">
                        {timeSlots.map(time => (
                          <option key={time}>{time}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="sdf-form-group">
                    <label className="sdf-form-label">Notes (Optional)</label>
                    <textarea 
                      className="sdf-form-textarea"
                      placeholder="Add any special instructions..."
                    />
                  </div>

                  <div className="sdf-shift-summary">
                    <div className="sdf-summary-item">
                      <span className="sdf-summary-label">Duration</span>
                      <span className="sdf-summary-value">8 hours</span>
                    </div>
                    <div className="sdf-summary-item">
                      <span className="sdf-summary-label">Hourly Rate</span>
                      <span className="sdf-summary-value">{formatCurrency(30)}/hr</span>
                    </div>
                    <div className="sdf-summary-total">
                      Total: {formatCurrency(240)}
                    </div>
                  </div>
                </form>
              )}
            </div>
            
            <div className="sdf-modal-footer">
              <button 
                className="sdf-btn"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              {modalMode !== 'view' && (
                <button className="sdf-btn sdf-btn-primary">
                  {modalMode === 'add' ? 'Create Shift' : 'Save Changes'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staff_Scheduling;