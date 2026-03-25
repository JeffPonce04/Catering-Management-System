import React, { useState, useEffect } from 'react';
import {
  UserOutlined,
  SearchOutlined,
  PlusOutlined,
  DownloadOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  MailOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  BankOutlined,
  IdcardOutlined,
  UploadOutlined,
  StarOutlined,
  FilterOutlined,
  ReloadOutlined,
  CloseOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CoffeeOutlined,
  ScheduleOutlined,
  SafetyOutlined,
  HeartOutlined,
  TrophyOutlined,
  BookOutlined,
  FileTextOutlined,
  PrinterOutlined,
  ShareAltOutlined,
  CreditCardOutlined,
  PhoneFilled,
  MailFilled,
  CheckOutlined,
  StopOutlined,
  PauseCircleOutlined,
  HistoryOutlined,
  InboxOutlined,
  LeftOutlined,
  RightOutlined,
  DownOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  DollarOutlined,
  RiseOutlined,
  FallOutlined,
  BarChartOutlined,
  PieChartOutlined,
  WalletOutlined,
  BankOutlined as BankIcon,
  PercentageOutlined,
  CalculatorOutlined,
  FileDoneOutlined,
  SettingOutlined,
  LogoutOutlined,
  BellOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import '../Components/styles/Staff_Payroll.css';

// Import sample images
import employee1 from './images/logo.png';
import employee2 from './images/logo.png';
import employee3 from './images/logo.png';
import employee4 from './images/logo.png';

const Staff_Payroll_Formal = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('March 2026');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const pageSize = 10;

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount).replace('PHP', '₱');
  };

  // Sample employees data
  const employees = [
    {
      id: 'EMP-001',
      name: 'John Smith',
      initials: 'JS',
      position: 'Executive Chef',
      department: 'Kitchen',
      status: 'active',
      shift: 'Morning',
      hourlyRate: 350,
      weeklyHours: 40,
      monthlySalary: 56000,
      bankName: 'BDO',
      bankAccount: '1234-5678-9012',
      taxId: '123-456-789',
      sss: '34-1234567-8',
      philhealth: '12-345678901-2',
      pagibig: '1234-5678-9012',
      image: employee1,
      color: '#2563eb',
      overtime: 8,
      late: 2,
      allowances: 2000,
      deductions: 1500
    },
    {
      id: 'EMP-002',
      name: 'Sarah Johnson',
      initials: 'SJ',
      position: 'Pastry Chef',
      department: 'Pastry',
      status: 'active',
      shift: 'Morning',
      hourlyRate: 300,
      weeklyHours: 40,
      monthlySalary: 48000,
      bankName: 'BPI',
      bankAccount: '2345-6789-0123',
      taxId: '234-567-890',
      sss: '45-2345678-9',
      philhealth: '23-456789012-3',
      pagibig: '2345-6789-0123',
      image: employee2,
      color: '#059669',
      overtime: 5,
      late: 0,
      allowances: 2000,
      deductions: 1400
    },
    {
      id: 'EMP-003',
      name: 'Michael Chen',
      initials: 'MC',
      position: 'Sous Chef',
      department: 'Kitchen',
      status: 'onleave',
      shift: 'Evening',
      hourlyRate: 280,
      weeklyHours: 0,
      monthlySalary: 0,
      bankName: 'Metrobank',
      bankAccount: '3456-7890-1234',
      taxId: '345-678-901',
      sss: '56-3456789-0',
      philhealth: '34-567890123-4',
      pagibig: '3456-7890-1234',
      image: employee3,
      color: '#d97706',
      overtime: 0,
      late: 0,
      allowances: 0,
      deductions: 0
    },
    {
      id: 'EMP-004',
      name: 'Emily Davis',
      initials: 'ED',
      position: 'Event Coordinator',
      department: 'Events',
      status: 'active',
      shift: 'Flexible',
      hourlyRate: 250,
      weeklyHours: 35,
      monthlySalary: 35000,
      bankName: 'Security Bank',
      bankAccount: '4567-8901-2345',
      taxId: '456-789-012',
      sss: '67-4567890-1',
      philhealth: '45-678901234-5',
      pagibig: '4567-8901-2345',
      image: employee4,
      color: '#7c3aed',
      overtime: 10,
      late: 1,
      allowances: 2000,
      deductions: 1300
    }
  ];

  // Generate payroll data
  const generatePayrollData = () => {
    return employees
      .filter(emp => emp.status === 'active')
      .map((emp, index) => {
        const grossPay = emp.monthlySalary + (emp.overtime * emp.hourlyRate * 1.5) + emp.allowances;
        const tax = Math.round(grossPay * 0.1);
        const sss = Math.round(grossPay * 0.045);
        const philhealth = Math.round(grossPay * 0.03);
        const pagibig = 100;
        const lateDeduction = emp.late * emp.hourlyRate * 0.5;
        const totalDeductions = tax + sss + philhealth + pagibig + lateDeduction + emp.deductions;
        const netPay = grossPay - totalDeductions;

        return {
          id: `PAY-${String(index + 1).padStart(3, '0')}`,
          employeeId: emp.id,
          employeeName: emp.name,
          employeeInitials: emp.initials,
          employeePosition: emp.position,
          employeeDepartment: emp.department,
          employeeImage: emp.image,
          employeeColor: emp.color,
          period: 'March 16-31, 2026',
          regularHours: emp.weeklyHours * 2,
          overtimeHours: emp.overtime,
          lateHours: emp.late,
          hourlyRate: emp.hourlyRate,
          grossPay: grossPay,
          deductions: {
            tax: tax,
            sss: sss,
            philhealth: philhealth,
            pagibig: pagibig,
            late: lateDeduction,
            other: emp.deductions
          },
          netPay: netPay,
          status: index % 3 === 0 ? 'paid' : index % 3 === 1 ? 'processing' : 'pending',
          paymentDate: index % 3 === 0 ? '2026-03-31' : null,
          bankName: emp.bankName,
          bankAccount: emp.bankAccount
        };
      });
  };

  const [payrollData] = useState(generatePayrollData());

  // Calculate totals
  const totalGross = payrollData.reduce((sum, item) => sum + item.grossPay, 0);
  const totalDeductions = payrollData.reduce((sum, item) => {
    return sum + Object.values(item.deductions).reduce((a, b) => a + b, 0);
  }, 0);
  const totalNet = payrollData.reduce((sum, item) => sum + item.netPay, 0);
  const paidCount = payrollData.filter(item => item.status === 'paid').length;
  const pendingCount = payrollData.filter(item => item.status === 'pending').length;
  const processingCount = payrollData.filter(item => item.status === 'processing').length;

  // Statistics
  const statistics = [
    { 
      label: 'Total Payroll', 
      value: formatCurrency(totalNet), 
      icon: <DollarOutlined />, 
      trend: '+8.2%',
      trendDirection: 'up'
    },
    { 
      label: 'Active Employees', 
      value: employees.filter(e => e.status === 'active').length, 
      icon: <TeamOutlined />, 
      trend: '+2',
      trendDirection: 'up'
    },
    { 
      label: 'Average Salary', 
      value: formatCurrency(totalNet / payrollData.length), 
      icon: <WalletOutlined />, 
      trend: '+3.1%',
      trendDirection: 'up'
    },
    { 
      label: 'Pending Amount', 
      value: formatCurrency(payrollData.filter(p => p.status === 'pending').reduce((sum, item) => sum + item.netPay, 0)), 
      icon: <ClockCircleOutlined />, 
      trend: `${pendingCount} employees`,
      trendDirection: 'neutral'
    },
  ];

  // Department breakdown
  const departmentBreakdown = [
    { dept: 'Kitchen', count: 3, total: payrollData.filter(p => p.employeeDepartment === 'Kitchen').reduce((sum, item) => sum + item.netPay, 0), color: '#2563eb' },
    { dept: 'Pastry', count: 1, total: payrollData.filter(p => p.employeeDepartment === 'Pastry').reduce((sum, item) => sum + item.netPay, 0), color: '#059669' },
    { dept: 'Events', count: 1, total: payrollData.filter(p => p.employeeDepartment === 'Events').reduce((sum, item) => sum + item.netPay, 0), color: '#7c3aed' },
    { dept: 'Service', count: 1, total: payrollData.filter(p => p.employeeDepartment === 'Service').reduce((sum, item) => sum + item.netPay, 0), color: '#0891b2' }
  ];

  // Filter payroll data
  const filteredData = payrollData.filter(item => {
    const deptMatch = selectedDepartment === 'all' || item.employeeDepartment === selectedDepartment;
    const statusMatch = selectedStatus === 'all' || item.status === selectedStatus;
    const filterMatch = selectedFilter === 'all' || item.status === selectedFilter;
    const searchMatch = item.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       item.employeeId.toLowerCase().includes(searchQuery.toLowerCase());
    return deptMatch && statusMatch && filterMatch && searchMatch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Recent transactions
  const recentTransactions = payrollData.slice(0, 5).map((item) => ({
    id: item.id,
    employee: item.employeeName,
    amount: item.netPay,
    date: item.paymentDate || '2026-03-31',
    status: item.status
  }));

  // Handle view payroll details
  const handleViewPayroll = (item) => {
    const employee = employees.find(e => e.id === item.employeeId);
    setSelectedEmployee({ ...item, ...employee });
    setShowPayrollModal(true);
  };

  return (
    <div className="prf-payroll-container">
      {/* Header */}
      <header className="prf-header">
        <div className="prf-header-left">
          <div className="prf-logo">
            <div className="prf-logo-icon">
              <DollarOutlined />
            </div>
            <div className="prf-logo-text">
              <h1>Payroll Management</h1>
              <span>Enterprise Compensation System</span>
            </div>
          </div>

          <nav className="prf-nav">
            <button className="prf-nav-item active">
              <CalculatorOutlined /> Dashboard
            </button>
            <button className="prf-nav-item">
              <TeamOutlined /> Employees
            </button>
            <button className="prf-nav-item">
              <HistoryOutlined /> History
            </button>
            <button className="prf-nav-item">
              <FileDoneOutlined /> Reports
            </button>
          </nav>
        </div>

        <div className="prf-header-right">
          <button className="prf-notification-btn">
            <BellOutlined />
            <span className="prf-notification-badge">3</span>
          </button>
          <button className="prf-help-btn">
            <QuestionCircleOutlined />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="prf-main">
        {/* Fixed Top Section */}
        <div className="prf-fixed-top">
          {/* Period Navigator */}
          <div className="prf-period-nav">
            <div className="prf-period-left">
              <div className="prf-period-picker">
                <CalendarOutlined />
                <span>March 16-31, 2026</span>
                <DownOutlined className="prf-period-icon" />
              </div>
              <div className="prf-period-buttons">
                <button className="prf-period-btn">
                  <LeftOutlined />
                </button>
                <button className="prf-period-btn">
                  <RightOutlined />
                </button>
              </div>
              <button className="prf-period-current">Current Period</button>
            </div>
            <div className="prf-period-right">
              <button className="prf-btn-primary">
                <CalculatorOutlined /> Process Payroll
              </button>
              <button className="prf-btn-secondary">
                <DownloadOutlined /> Export
              </button>
              <button className="prf-btn-secondary">
                <PrinterOutlined /> Print
              </button>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="prf-stats-grid">
            {statistics.map((stat, index) => (
              <div key={index} className="prf-stat-card">
                <div className="prf-stat-icon" style={{ background: stat.trendDirection === 'up' ? '#e6f7e6' : '#fff3e6' }}>
                  {stat.icon}
                </div>
                <div className="prf-stat-content">
                  <span className="prf-stat-label">{stat.label}</span>
                  <h3 className="prf-stat-value">{stat.value}</h3>
                  <div className="prf-stat-footer">
                    <span className={`prf-stat-trend prf-trend-${stat.trendDirection}`}>
                      {stat.trendDirection === 'up' && <RiseOutlined />}
                      {stat.trendDirection === 'down' && <FallOutlined />}
                      {stat.trend}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Stats */}
          <div className="prf-quick-stats">
            <div className="prf-quick-card">
              <div className="prf-quick-icon prf-icon-blue">
                <TeamOutlined />
              </div>
              <div className="prf-quick-content">
                <span className="prf-quick-label">Total Employees</span>
                <span className="prf-quick-value">{employees.length}</span>
                <span className="prf-quick-trend positive">
                  <RiseOutlined /> +2 this month
                </span>
              </div>
            </div>

            <div className="prf-quick-card">
              <div className="prf-quick-icon prf-icon-green">
                <CheckCircleOutlined />
              </div>
              <div className="prf-quick-content">
                <span className="prf-quick-label">Paid Employees</span>
                <span className="prf-quick-value">{paidCount}</span>
                <span className="prf-quick-trend">
                  {formatCurrency(payrollData.filter(p => p.status === 'paid').reduce((sum, item) => sum + item.netPay, 0))}
                </span>
              </div>
            </div>

            <div className="prf-quick-card">
              <div className="prf-quick-icon prf-icon-orange">
                <ClockCircleOutlined />
              </div>
              <div className="prf-quick-content">
                <span className="prf-quick-label">Pending</span>
                <span className="prf-quick-value">{pendingCount}</span>
                <span className="prf-quick-trend">
                  {formatCurrency(payrollData.filter(p => p.status === 'pending').reduce((sum, item) => sum + item.netPay, 0))}
                </span>
              </div>
            </div>

            <div className="prf-quick-card">
              <div className="prf-quick-icon prf-icon-purple">
                <ReloadOutlined />
              </div>
              <div className="prf-quick-content">
                <span className="prf-quick-label">Processing</span>
                <span className="prf-quick-value">{processingCount}</span>
                <span className="prf-quick-trend">
                  Next: Apr 1
                </span>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="prf-filters">
            <div className="prf-filter-tabs">
              <button 
                className={`prf-filter-tab ${selectedFilter === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedFilter('all')}
              >
                All
              </button>
              <button 
                className={`prf-filter-tab ${selectedFilter === 'paid' ? 'active' : ''}`}
                onClick={() => setSelectedFilter('paid')}
              >
                Paid
              </button>
              <button 
                className={`prf-filter-tab ${selectedFilter === 'pending' ? 'active' : ''}`}
                onClick={() => setSelectedFilter('pending')}
              >
                Pending
              </button>
              <button 
                className={`prf-filter-tab ${selectedFilter === 'processing' ? 'active' : ''}`}
                onClick={() => setSelectedFilter('processing')}
              >
                Processing
              </button>
            </div>

            <div className="prf-filter-controls">
              <select 
                className="prf-filter-select"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
              >
                <option value="all">All Departments</option>
                <option value="Kitchen">Kitchen</option>
                <option value="Pastry">Pastry</option>
                <option value="Events">Events</option>
                <option value="Service">Service</option>
              </select>

              <select 
                className="prf-filter-select"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
              </select>

              <div className="prf-filter-search">
                <SearchOutlined className="prf-search-icon" />
                <input
                  type="text"
                  className="prf-search-input"
                  placeholder="Search by name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="prf-filter-badge">
                <ReloadOutlined /> <span>{filteredData.length} records</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="prf-scrollable">
          {/* Payroll Table */}
          <div className="prf-table-card">
            <div className="prf-table-header">
              <h3 className="prf-table-title">
                <DollarOutlined /> Payroll Register
              </h3>
              <div className="prf-table-actions">
                <button className="prf-table-btn">
                  <FileExcelOutlined /> Excel
                </button>
                <button className="prf-table-btn">
                  <FilePdfOutlined /> PDF
                </button>
                <button className="prf-table-btn prf-btn-primary">
                  <PlusOutlined /> Add Entry
                </button>
              </div>
            </div>

            <div className="prf-table-wrapper">
              <table className="prf-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Position</th>
                    <th>Regular</th>
                    <th>OT</th>
                    <th>Gross Pay</th>
                    <th>Deductions</th>
                    <th>Net Pay</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((item) => {
                    const totalDeductions = Object.values(item.deductions).reduce((a, b) => a + b, 0);
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="prf-employee-cell">
                            <div className="prf-employee-avatar" style={{ background: item.employeeColor }}>
                              {item.employeeImage ? (
                                <img src={item.employeeImage} alt={item.employeeName} />
                              ) : (
                                item.employeeInitials
                              )}
                            </div>
                            <div className="prf-employee-info">
                              <span className="prf-employee-name">{item.employeeName}</span>
                              <span className="prf-employee-id">{item.employeeId}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="prf-position-info">
                            <span className="prf-position-title">{item.employeePosition}</span>
                            <span className="prf-position-dept">{item.employeeDepartment}</span>
                          </div>
                        </td>
                        <td className="prf-number-cell">{item.regularHours}h</td>
                        <td className="prf-number-cell">{item.overtimeHours > 0 ? `${item.overtimeHours}h` : '—'}</td>
                        <td className="prf-number-cell prf-text-positive">{formatCurrency(item.grossPay)}</td>
                        <td className="prf-number-cell prf-text-negative">{formatCurrency(totalDeductions)}</td>
                        <td className="prf-number-cell prf-text-primary">{formatCurrency(item.netPay)}</td>
                        <td>
                          <span className={`prf-status-badge prf-status-${item.status}`}>
                            {item.status === 'paid' && <CheckCircleOutlined />}
                            {item.status === 'pending' && <ClockCircleOutlined />}
                            {item.status === 'processing' && <ReloadOutlined />}
                            <span>{item.status}</span>
                          </span>
                        </td>
                        <td>
                          <div className="prf-action-buttons">
                            <button 
                              className="prf-action-btn" 
                              title="View Details"
                              onClick={() => handleViewPayroll(item)}
                            >
                              <EyeOutlined />
                            </button>
                            <button className="prf-action-btn" title="Edit">
                              <EditOutlined />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="prf-pagination">
              <span className="prf-pagination-info">
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} records
              </span>
              <div className="prf-pagination-controls">
                <button 
                  className="prf-page-btn"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <LeftOutlined />
                </button>
                {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={i}
                      className={`prf-page-btn ${currentPage === pageNum ? 'active' : ''}`}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button 
                  className="prf-page-btn"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <RightOutlined />
                </button>
              </div>
            </div>
          </div>

          {/* Analytics Section */}
          <div className="prf-analytics-grid">
            {/* Payment Status Chart */}
            <div className="prf-chart-card">
              <div className="prf-chart-header">
                <h4><PieChartOutlined /> Payment Status</h4>
              </div>
              <div className="prf-chart-content">
                <div className="prf-pie-container">
                  <svg viewBox="0 0 100 100" className="prf-pie-chart">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#10b981"
                      strokeWidth="20"
                      strokeDasharray={`${(paidCount / payrollData.length) * 251.2} 251.2`}
                      strokeDashoffset="0"
                      transform="rotate(-90 50 50)"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#f59e0b"
                      strokeWidth="20"
                      strokeDasharray={`${(pendingCount / payrollData.length) * 251.2} 251.2`}
                      strokeDashoffset={`-${(paidCount / payrollData.length) * 251.2}`}
                      transform="rotate(-90 50 50)"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#6366f1"
                      strokeWidth="20"
                      strokeDasharray={`${(processingCount / payrollData.length) * 251.2} 251.2`}
                      strokeDashoffset={`-${((paidCount + pendingCount) / payrollData.length) * 251.2}`}
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                </div>
                <div className="prf-pie-legend">
                  <div className="prf-legend-item">
                    <span className="prf-legend-dot" style={{ background: '#10b981' }}></span>
                    <span className="prf-legend-label">Paid</span>
                    <span className="prf-legend-value">{paidCount}</span>
                  </div>
                  <div className="prf-legend-item">
                    <span className="prf-legend-dot" style={{ background: '#f59e0b' }}></span>
                    <span className="prf-legend-label">Pending</span>
                    <span className="prf-legend-value">{pendingCount}</span>
                  </div>
                  <div className="prf-legend-item">
                    <span className="prf-legend-dot" style={{ background: '#6366f1' }}></span>
                    <span className="prf-legend-label">Processing</span>
                    <span className="prf-legend-value">{processingCount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Department Breakdown */}
            <div className="prf-chart-card">
              <div className="prf-chart-header">
                <h4><BarChartOutlined /> Department Breakdown</h4>
              </div>
              <div className="prf-chart-content">
                {departmentBreakdown.map((dept, index) => {
                  const percentage = (dept.total / totalNet) * 100;
                  return (
                    <div key={index} className="prf-dept-bar">
                      <div className="prf-bar-label">
                        <span>{dept.dept}</span>
                        <span>{formatCurrency(dept.total)}</span>
                      </div>
                      <div className="prf-bar-container">
                        <div 
                          className="prf-bar-fill" 
                          style={{ 
                            width: `${percentage}%`,
                            background: dept.color
                          }}
                        />
                      </div>
                      <div className="prf-bar-percentage">{percentage.toFixed(1)}%</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="prf-chart-card prf-recent-card">
              <div className="prf-chart-header">
                <h4><HistoryOutlined /> Recent Transactions</h4>
              </div>
              <div className="prf-transactions-list">
                {recentTransactions.map((transaction, index) => (
                  <div key={index} className="prf-transaction-item">
                    <div className="prf-transaction-icon" style={{ 
                      background: transaction.status === 'paid' ? '#e6f7e6' : '#fff3e6' 
                    }}>
                      <DollarOutlined style={{ 
                        color: transaction.status === 'paid' ? '#10b981' : '#f59e0b' 
                      }} />
                    </div>
                    <div className="prf-transaction-content">
                      <div className="prf-transaction-title">
                        <strong>{transaction.employee}</strong>
                        <span className={`prf-transaction-status prf-status-${transaction.status}`}>
                          {transaction.status}
                        </span>
                      </div>
                      <div className="prf-transaction-meta">
                        <CalendarOutlined /> {transaction.date}
                      </div>
                    </div>
                    <div className={`prf-transaction-amount ${transaction.status === 'paid' ? 'paid' : ''}`}>
                      {formatCurrency(transaction.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Payroll Details Modal */}
      {showPayrollModal && selectedEmployee && (
        <div className="prf-modal-overlay" onClick={() => setShowPayrollModal(false)}>
          <div className="prf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="prf-modal-header">
              <h2><EyeOutlined /> Payroll Details</h2>
              <button className="prf-modal-close" onClick={() => setShowPayrollModal(false)}>
                <CloseOutlined />
              </button>
            </div>
            <div className="prf-modal-body">
              <div className="prf-modal-employee">
                <div className="prf-modal-avatar" style={{ background: selectedEmployee.employeeColor }}>
                  {selectedEmployee.employeeImage ? (
                    <img src={selectedEmployee.employeeImage} alt={selectedEmployee.employeeName} />
                  ) : (
                    selectedEmployee.employeeInitials
                  )}
                </div>
                <div className="prf-modal-info">
                  <h3>{selectedEmployee.employeeName}</h3>
                  <p>{selectedEmployee.employeePosition} • {selectedEmployee.employeeDepartment}</p>
                  <span className="prf-modal-id">{selectedEmployee.employeeId}</span>
                </div>
                <span className={`prf-modal-status prf-status-${selectedEmployee.status}`}>
                  {selectedEmployee.status}
                </span>
              </div>

              <div className="prf-modal-period">
                <div className="prf-period-detail">
                  <span className="prf-detail-label">Pay Period</span>
                  <span className="prf-detail-value">{selectedEmployee.period}</span>
                </div>
                <div className="prf-period-detail">
                  <span className="prf-detail-label">Payment Date</span>
                  <span className="prf-detail-value">{selectedEmployee.paymentDate || 'Not yet paid'}</span>
                </div>
              </div>

              <h4 className="prf-section-title">Earnings</h4>
              <div className="prf-earnings-card">
                <div className="prf-earning-row">
                  <span>Base Salary ({selectedEmployee.regularHours} hrs)</span>
                  <span className="prf-earning-amount">{formatCurrency(selectedEmployee.hourlyRate * selectedEmployee.regularHours)}</span>
                </div>
                <div className="prf-earning-row">
                  <span>Overtime ({selectedEmployee.overtimeHours} hrs @ 1.5x)</span>
                  <span className="prf-earning-amount">{formatCurrency(selectedEmployee.overtimeHours * selectedEmployee.hourlyRate * 1.5)}</span>
                </div>
                <div className="prf-earning-row">
                  <span>Allowances</span>
                  <span className="prf-earning-amount">{formatCurrency(2000)}</span>
                </div>
                <div className="prf-earning-row prf-total">
                  <span>Gross Pay</span>
                  <span className="prf-earning-amount prf-total">{formatCurrency(selectedEmployee.grossPay)}</span>
                </div>
              </div>

              <h4 className="prf-section-title">Deductions</h4>
              <div className="prf-deductions-card">
                <div className="prf-deduction-row">
                  <span>Withholding Tax (10%)</span>
                  <span className="prf-deduction-amount">{formatCurrency(selectedEmployee.deductions.tax)}</span>
                </div>
                <div className="prf-deduction-row">
                  <span>SSS (4.5%)</span>
                  <span className="prf-deduction-amount">{formatCurrency(selectedEmployee.deductions.sss)}</span>
                </div>
                <div className="prf-deduction-row">
                  <span>PhilHealth (3%)</span>
                  <span className="prf-deduction-amount">{formatCurrency(selectedEmployee.deductions.philhealth)}</span>
                </div>
                <div className="prf-deduction-row">
                  <span>Pag-IBIG</span>
                  <span className="prf-deduction-amount">{formatCurrency(selectedEmployee.deductions.pagibig)}</span>
                </div>
                <div className="prf-deduction-row">
                  <span>Late Deductions</span>
                  <span className="prf-deduction-amount">{formatCurrency(selectedEmployee.deductions.late)}</span>
                </div>
                <div className="prf-deduction-row prf-total">
                  <span>Total Deductions</span>
                  <span className="prf-deduction-amount prf-total">{formatCurrency(Object.values(selectedEmployee.deductions).reduce((a, b) => a + b, 0))}</span>
                </div>
              </div>

              <div className="prf-netpay-card">
                <div className="prf-netpay-left">
                  <span className="prf-netpay-label">Net Pay</span>
                  <span className="prf-netpay-value">{formatCurrency(selectedEmployee.netPay)}</span>
                </div>
                <div className="prf-netpay-right">
                  <span className="prf-payment-method">Bank Transfer</span>
                  <span className="prf-bank-details">{selectedEmployee.bankName} •••• {selectedEmployee.bankAccount.slice(-4)}</span>
                </div>
              </div>
            </div>
            <div className="prf-modal-footer">
              <button className="prf-modal-btn prf-modal-secondary" onClick={() => setShowPayrollModal(false)}>
                Close
              </button>
              <button className="prf-modal-btn prf-modal-primary">
                <DownloadOutlined /> Download Payslip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staff_Payroll_Formal;