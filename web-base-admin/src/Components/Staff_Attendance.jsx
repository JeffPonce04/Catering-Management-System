// Staff_Attendance.jsx (Complete Fixed Version with Selfie)
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './styles/Staff_Attendance.css';

// Icon Imports - Using only Feather Icons for consistency
import {
  FiUser,
  FiUsers,
  FiClock,
  FiCalendar,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiTrendingUp,
  FiTrendingDown,
  FiSearch,
  FiFilter,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiEye,
  FiDownload,
  FiUpload,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiChevronDown,
  FiChevronUp,
  FiMoreVertical,
  FiPrinter,
  FiMail,
  FiPhone,
  FiMapPin,
  FiStar,
  FiAward,
  FiBarChart2,
  FiPieChart,
  FiSettings,
  FiLogOut,
  FiSunrise,
  FiSunset,
  FiClock as FiClockIcon,
  FiCalendar as FiCalendarIcon,
  FiUserCheck,
  FiUserX,
  FiUserPlus,
  FiUserMinus,
  FiBriefcase,
  FiHome,
  FiCoffee,
  FiBell,
  FiMessageSquare,
  FiThumbsUp,
  FiThumbsDown,
  FiList,
  FiGrid,
  FiXCircle as FiX,
  FiCamera
} from 'react-icons/fi';

import {
  BsCalendarDay,
  BsCalendarMonth,
  BsCalendarWeek,
  BsCalendarCheck,
  BsCalendarX,
  BsCalendarEvent,
  BsPersonBadge,
  BsPersonWorkspace,
  BsPersonCheck,
  BsPersonX,
  BsPersonPlus,
  BsPersonDash,
  BsClock,
  BsStopwatch,
  BsHourglassSplit,
  BsCameraFill
} from 'react-icons/bs';

const Staff_Attendance = () => {
  // Refs for scroll management
  const mainContentRef = useRef(null);
  
  // Helper functions
  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  const formatDateShort = (date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Mock Employees Data - Regular Employees
  const [regularEmployees] = useState([
    {
      id: 'REG-001',
      name: 'John Smith',
      position: 'Head Chef',
      department: 'Kitchen',
      phone: '+1234567890',
      email: 'john.smith@catering.com',
      type: 'regular',
      shift: 'morning',
      joinDate: '2022-03-15',
      status: 'active',
      avatar: '👨‍🍳',
      selfie: null,
      emergencyContact: '+1234567891',
      address: '123 Main St, City',
      salary: 45000
    },
    {
      id: 'REG-002',
      name: 'Sarah Johnson',
      position: 'Sous Chef',
      department: 'Kitchen',
      phone: '+1234567892',
      email: 'sarah.j@catering.com',
      type: 'regular',
      shift: 'morning',
      joinDate: '2022-06-20',
      status: 'active',
      avatar: '👩‍🍳',
      selfie: null,
      emergencyContact: '+1234567893',
      address: '456 Oak Ave, City',
      salary: 38000
    },
    {
      id: 'REG-003',
      name: 'Michael Chen',
      position: 'Event Coordinator',
      department: 'Events',
      phone: '+1234567894',
      email: 'michael.c@catering.com',
      type: 'regular',
      shift: 'afternoon',
      joinDate: '2022-01-10',
      status: 'active',
      avatar: '👨‍💼',
      selfie: null,
      emergencyContact: '+1234567895',
      address: '789 Pine Rd, City',
      salary: 42000
    },
    {
      id: 'REG-004',
      name: 'Emily Rodriguez',
      position: 'Pastry Chef',
      department: 'Kitchen',
      phone: '+1234567896',
      email: 'emily.r@catering.com',
      type: 'regular',
      shift: 'morning',
      joinDate: '2022-08-05',
      status: 'active',
      avatar: '👩‍🍳',
      selfie: null,
      emergencyContact: '+1234567897',
      address: '321 Elm St, City',
      salary: 36000
    },
    {
      id: 'REG-005',
      name: 'David Kim',
      position: 'Logistics Manager',
      department: 'Operations',
      phone: '+1234567898',
      email: 'david.k@catering.com',
      type: 'regular',
      shift: 'morning',
      joinDate: '2022-02-28',
      status: 'active',
      avatar: '👨‍💼',
      selfie: null,
      emergencyContact: '+1234567899',
      address: '654 Cedar Ln, City',
      salary: 44000
    },
    {
      id: 'REG-006',
      name: 'Lisa Thompson',
      position: 'Waitstaff Supervisor',
      department: 'Service',
      phone: '+1234567800',
      email: 'lisa.t@catering.com',
      type: 'regular',
      shift: 'evening',
      joinDate: '2022-04-12',
      status: 'active',
      avatar: '👩‍💼',
      selfie: null,
      emergencyContact: '+1234567801',
      address: '987 Birch Dr, City',
      salary: 35000
    }
  ]);

  // Mock Employees Data - On-Call Employees
  const [onCallEmployees] = useState([
    {
      id: 'ONC-001',
      name: 'Robert Garcia',
      position: 'Line Cook',
      department: 'Kitchen',
      phone: '+1234567802',
      email: 'robert.g@catering.com',
      type: 'oncall',
      hourlyRate: 25,
      availability: ['weekends', 'evenings'],
      joinDate: '2023-01-15',
      status: 'active',
      avatar: '👨‍🍳',
      selfie: null,
      emergencyContact: '+1234567803',
      address: '147 Spruce Ave, City',
      maxHoursPerWeek: 30
    },
    {
      id: 'ONC-002',
      name: 'Maria Santos',
      position: 'Server',
      department: 'Service',
      phone: '+1234567804',
      email: 'maria.s@catering.com',
      type: 'oncall',
      hourlyRate: 20,
      availability: ['weekdays', 'evenings'],
      joinDate: '2023-03-20',
      status: 'active',
      avatar: '👩‍🍳',
      selfie: null,
      emergencyContact: '+1234567805',
      address: '258 Willow Way, City',
      maxHoursPerWeek: 25
    },
    {
      id: 'ONC-003',
      name: 'James Wilson',
      position: 'Dishwasher',
      department: 'Kitchen',
      phone: '+1234567806',
      email: 'james.w@catering.com',
      type: 'oncall',
      hourlyRate: 18,
      availability: ['weekends', 'mornings'],
      joinDate: '2023-05-10',
      status: 'active',
      avatar: '👨‍🍳',
      selfie: null,
      emergencyContact: '+1234567807',
      address: '369 Poplar St, City',
      maxHoursPerWeek: 20
    },
    {
      id: 'ONC-004',
      name: 'Patricia Lee',
      position: 'Bartender',
      department: 'Beverage',
      phone: '+1234567808',
      email: 'patricia.l@catering.com',
      type: 'oncall',
      hourlyRate: 28,
      availability: ['evenings', 'nights'],
      joinDate: '2023-02-08',
      status: 'active',
      avatar: '👩‍🍳',
      selfie: null,
      emergencyContact: '+1234567809',
      address: '159 Maple Ave, City',
      maxHoursPerWeek: 25
    },
    {
      id: 'ONC-005',
      name: 'Thomas Brown',
      position: 'Setup Crew',
      department: 'Operations',
      phone: '+1234567810',
      email: 'thomas.b@catering.com',
      type: 'oncall',
      hourlyRate: 22,
      availability: ['weekends', 'mornings'],
      joinDate: '2023-06-15',
      status: 'active',
      avatar: '👨‍🔧',
      selfie: null,
      emergencyContact: '+1234567811',
      address: '753 Ash Blvd, City',
      maxHoursPerWeek: 30
    }
  ]);

  // Generate initial attendance data
  const generateInitialAttendance = () => {
    const data = [];
    const startDate = new Date(2024, 0, 1);
    const endDate = new Date();
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      
      regularEmployees.forEach(emp => {
        const isPresent = Math.random() < 0.85;
        const isLate = !isPresent ? false : Math.random() < 0.1;
        
        if (isPresent) {
          data.push({
            id: data.length + 1,
            employeeId: emp.id,
            employeeName: emp.name,
            employeeType: 'regular',
            date: dateStr,
            shift: emp.shift,
            checkIn: isLate ? '09:15' : '08:45',
            checkInSelfie: isPresent ? `selfie_${emp.id}_${dateStr}_in.jpg` : null,
            checkOut: '17:30',
            checkOutSelfie: isPresent ? `selfie_${emp.id}_${dateStr}_out.jpg` : null,
            status: isLate ? 'late' : 'present',
            overtime: Math.random() < 0.2 ? 0.5 : 0,
            notes: ''
          });
        } else {
          data.push({
            id: data.length + 1,
            employeeId: emp.id,
            employeeName: emp.name,
            employeeType: 'regular',
            date: dateStr,
            shift: emp.shift,
            checkIn: null,
            checkInSelfie: null,
            checkOut: null,
            checkOutSelfie: null,
            status: 'absent',
            overtime: 0,
            notes: 'No show'
          });
        }
      });
      
      onCallEmployees.forEach(emp => {
        const isWorking = Math.random() < 0.4;
        
        if (isWorking) {
          const isPresent = Math.random() < 0.9;
          const isLate = isPresent && Math.random() < 0.15;
          
          if (isPresent) {
            data.push({
              id: data.length + 1,
              employeeId: emp.id,
              employeeName: emp.name,
              employeeType: 'oncall',
              date: dateStr,
              shift: emp.availability.includes('evenings') ? 'evening' : 'morning',
              checkIn: isLate ? '09:30' : '09:00',
              checkInSelfie: `selfie_${emp.id}_${dateStr}_in.jpg`,
              checkOut: '18:00',
              checkOutSelfie: `selfie_${emp.id}_${dateStr}_out.jpg`,
              status: isLate ? 'late' : 'present',
              overtime: Math.random() < 0.25 ? 1 : 0,
              notes: ''
            });
          }
        }
      });
    }
    
    return data;
  };

  // State for date view mode
  const [dateViewMode, setDateViewMode] = useState('day');
  
  // State for date navigation
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // 15-day cutoff state
  const [cutoffDay, setCutoffDay] = useState(15);
  const [payPeriods, setPayPeriods] = useState([]);
  const [selectedPayPeriod, setSelectedPayPeriod] = useState(null);
  
  // State for employee type filter
  const [employeeType, setEmployeeType] = useState('all');
  
  // State for view mode
  const [viewMode, setViewMode] = useState('table');
  
  // State for search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [shiftFilter, setShiftFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // State for selected employee
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEmployeeDetails, setShowEmployeeDetails] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [showAttendanceSummary, setShowAttendanceSummary] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [selectedSelfie, setSelectedSelfie] = useState(null);
  const [selfieType, setSelfieType] = useState('');
  
  // State for camera
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // State for check in/out form
  const [checkInData, setCheckInData] = useState({
    time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
    status: 'present',
    shift: 'morning',
    selfie: null,
    notes: ''
  });
  
  const [checkOutData, setCheckOutData] = useState({
    time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
    overtime: 0,
    selfie: null,
    notes: ''
  });
  
  // State for notification
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('success');
  
  // State for attendance data
  const [attendance, setAttendance] = useState([]);
  
  // State for pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Initialize attendance data
  useEffect(() => {
    setAttendance(generateInitialAttendance());
  }, []);

  // Generate pay periods based on cutoff day
  useEffect(() => {
    const periods = [];
    const startDate = new Date(2024, 0, 1);
    const endDate = new Date();
    
    let currentStart = new Date(startDate);
    
    while (currentStart <= endDate) {
      const currentEnd = new Date(currentStart);
      currentEnd.setDate(cutoffDay - 1);
      if (currentEnd < currentStart) {
        currentEnd.setMonth(currentEnd.getMonth() + 1);
      }
      
      const periodStart = new Date(currentStart);
      const periodEnd = new Date(currentEnd);
      
      periods.push({
        id: periods.length + 1,
        startDate: periodStart,
        endDate: periodEnd,
        label: `${formatDateShort(periodStart)} - ${formatDateShort(periodEnd)}`
      });
      
      currentStart = new Date(periodEnd);
      currentStart.setDate(periodEnd.getDate() + 1);
    }
    
    setPayPeriods(periods);
    setSelectedPayPeriod(periods[periods.length - 1]);
  }, [cutoffDay]);

  // Show notification
  const showNotificationMessage = (message, type = 'success') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  // Summary statistics
  const [stats, setStats] = useState({
    totalEmployees: 0,
    present: 0,
    absent: 0,
    late: 0,
    onLeave: 0,
    overtime: 0,
    totalHours: 0,
    averageHours: 0
  });

  // Update stats
  useEffect(() => {
    if (!attendance.length) return;

    let filteredAttendance = [];
    
    if (dateViewMode === 'day') {
      filteredAttendance = attendance.filter(a => a.date === formatDate(selectedDate));
    } else if (dateViewMode === 'month') {
      filteredAttendance = attendance.filter(a => {
        const date = new Date(a.date);
        return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
      });
    } else if (dateViewMode === 'year') {
      filteredAttendance = attendance.filter(a => {
        const date = new Date(a.date);
        return date.getFullYear() === selectedYear;
      });
    } else if (dateViewMode === 'range' && selectedPayPeriod) {
      filteredAttendance = attendance.filter(a => {
        const date = new Date(a.date);
        return date >= selectedPayPeriod.startDate && date <= selectedPayPeriod.endDate;
      });
    }
    
    const filteredByType = filteredAttendance.filter(a => 
      employeeType === 'all' ? true : a.employeeType === employeeType
    );

    let totalHours = 0;
    filteredByType.forEach(a => {
      if (a.checkIn && a.checkOut) {
        const [inHour, inMin] = a.checkIn.split(':').map(Number);
        const [outHour, outMin] = a.checkOut.split(':').map(Number);
        const hours = (outHour + outMin/60) - (inHour + inMin/60);
        totalHours += hours + (a.overtime || 0);
      }
    });

    setStats({
      totalEmployees: employeeType === 'all' 
        ? regularEmployees.length + onCallEmployees.length
        : employeeType === 'regular' 
          ? regularEmployees.length 
          : onCallEmployees.length,
      present: filteredByType.filter(a => a.status === 'present' || a.status === 'late').length,
      absent: filteredByType.filter(a => a.status === 'absent').length,
      late: filteredByType.filter(a => a.status === 'late').length,
      onLeave: filteredByType.filter(a => a.status === 'on-leave').length,
      overtime: filteredByType.filter(a => a.overtime > 0).length,
      totalHours: Math.round(totalHours * 10) / 10,
      averageHours: filteredByType.length > 0 ? Math.round((totalHours / filteredByType.length) * 10) / 10 : 0
    });
  }, [selectedDate, selectedMonth, selectedYear, selectedPayPeriod, dateViewMode, employeeType, attendance, regularEmployees.length, onCallEmployees.length]);

  // Format date for display
  const formatDisplayDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatDisplayMonth = (month, year) => {
    return new Date(year, month, 1).toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const getDayName = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  // Date navigation
  const goToPrevious = () => {
    if (dateViewMode === 'day') {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() - 1);
      setSelectedDate(newDate);
    } else if (dateViewMode === 'month') {
      if (selectedMonth === 0) {
        setSelectedMonth(11);
        setSelectedYear(selectedYear - 1);
      } else {
        setSelectedMonth(selectedMonth - 1);
      }
    } else if (dateViewMode === 'year') {
      setSelectedYear(selectedYear - 1);
    } else if (dateViewMode === 'range') {
      const currentIndex = payPeriods.findIndex(p => p.id === selectedPayPeriod?.id);
      if (currentIndex > 0) {
        setSelectedPayPeriod(payPeriods[currentIndex - 1]);
      }
    }
    showNotificationMessage(`Navigated to previous ${dateViewMode}`, 'info');
  };

  const goToNext = () => {
    if (dateViewMode === 'day') {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() + 1);
      setSelectedDate(newDate);
    } else if (dateViewMode === 'month') {
      if (selectedMonth === 11) {
        setSelectedMonth(0);
        setSelectedYear(selectedYear + 1);
      } else {
        setSelectedMonth(selectedMonth + 1);
      }
    } else if (dateViewMode === 'year') {
      setSelectedYear(selectedYear + 1);
    } else if (dateViewMode === 'range') {
      const currentIndex = payPeriods.findIndex(p => p.id === selectedPayPeriod?.id);
      if (currentIndex < payPeriods.length - 1) {
        setSelectedPayPeriod(payPeriods[currentIndex + 1]);
      }
    }
    showNotificationMessage(`Navigated to next ${dateViewMode}`, 'info');
  };

  const goToToday = () => {
    setSelectedDate(new Date());
    setSelectedMonth(new Date().getMonth());
    setSelectedYear(new Date().getFullYear());
    if (payPeriods.length > 0) {
      setSelectedPayPeriod(payPeriods[payPeriods.length - 1]);
    }
    showNotificationMessage('Navigated to today', 'success');
  };

  // Camera functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      setShowCamera(true);
    } catch (err) {
      showNotificationMessage('Unable to access camera', 'error');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const captureSelfie = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const selfieData = canvas.toDataURL('image/jpeg');
      
      if (showCheckInModal) {
        setCheckInData({ ...checkInData, selfie: selfieData });
      } else if (showCheckOutModal) {
        setCheckOutData({ ...checkOutData, selfie: selfieData });
      }
      
      stopCamera();
      showNotificationMessage('Selfie captured successfully', 'success');
    }
  };

  // Handle export
  const handleExport = (format) => {
    setShowExportModal(false);
    showNotificationMessage(`Exporting as ${format}...`, 'info');
    setTimeout(() => {
      showNotificationMessage(`Export completed successfully`, 'success');
    }, 2000);
  };

  // Handle print
  const handlePrint = () => {
    setShowPrintModal(false);
    showNotificationMessage('Preparing print preview...', 'info');
    setTimeout(() => {
      window.print();
      showNotificationMessage('Print preview ready', 'success');
    }, 1000);
  };

  // Handle refresh
  const handleRefresh = () => {
    setAttendance(generateInitialAttendance());
    showNotificationMessage('Data refreshed successfully', 'success');
  };

  // Get all employees with attendance
  const getAllEmployeesWithAttendance = () => {
    const allEmployees = [
      ...(employeeType === 'all' || employeeType === 'regular' ? regularEmployees : []),
      ...(employeeType === 'all' || employeeType === 'oncall' ? onCallEmployees : [])
    ];

    if (dateViewMode === 'day') {
      return allEmployees.map(emp => {
        const attendanceRecord = attendance.find(
          a => a.employeeId === emp.id && a.date === formatDate(selectedDate)
        ) || {
          employeeId: emp.id,
          employeeName: emp.name,
          employeeType: emp.type,
          date: formatDate(selectedDate),
          shift: emp.shift || 'morning',
          checkIn: null,
          checkInSelfie: null,
          checkOut: null,
          checkOutSelfie: null,
          status: 'absent',
          overtime: 0,
          notes: ''
        };
        
        return {
          ...emp,
          attendance: attendanceRecord
        };
      });
    } else {
      return allEmployees.map(emp => {
        const empAttendance = attendance.filter(a => 
          a.employeeId === emp.id && 
          (dateViewMode === 'month' ? new Date(a.date).getMonth() === selectedMonth && new Date(a.date).getFullYear() === selectedYear :
           dateViewMode === 'year' ? new Date(a.date).getFullYear() === selectedYear :
           dateViewMode === 'range' && selectedPayPeriod ? new Date(a.date) >= selectedPayPeriod.startDate && new Date(a.date) <= selectedPayPeriod.endDate :
           true)
        );
        
        const present = empAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
        const absent = empAttendance.filter(a => a.status === 'absent').length;
        const late = empAttendance.filter(a => a.status === 'late').length;
        const totalHours = empAttendance.reduce((sum, a) => {
          if (a.checkIn && a.checkOut) {
            const [inHour, inMin] = a.checkIn.split(':').map(Number);
            const [outHour, outMin] = a.checkOut.split(':').map(Number);
            return sum + (outHour + outMin/60) - (inHour + inMin/60) + (a.overtime || 0);
          }
          return sum;
        }, 0);
        
        return {
          ...emp,
          summary: {
            total: empAttendance.length,
            present,
            absent,
            late,
            totalHours: Math.round(totalHours * 10) / 10,
            averageHours: present > 0 ? Math.round((totalHours / present) * 10) / 10 : 0
          }
        };
      });
    }
  };

  // Filter employees
  const getFilteredEmployees = () => {
    let employees = getAllEmployeesWithAttendance();

    if (searchTerm) {
      employees = employees.filter(emp => 
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.department.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (dateViewMode === 'day' && statusFilter !== 'all') {
      employees = employees.filter(emp => emp.attendance?.status === statusFilter);
    }

    if (shiftFilter !== 'all') {
      employees = employees.filter(emp => emp.shift === shiftFilter);
    }

    return employees;
  };

  // Pagination
  const filteredEmployees = getFilteredEmployees();
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Handle check in
  const handleCheckIn = () => {
    const newAttendance = {
      id: attendance.length + 1,
      employeeId: selectedEmployee.id,
      employeeName: selectedEmployee.name,
      employeeType: selectedEmployee.type,
      date: formatDate(selectedDate),
      shift: checkInData.shift,
      checkIn: checkInData.time,
      checkInSelfie: checkInData.selfie || `selfie_${selectedEmployee.id}_${formatDate(selectedDate)}_in.jpg`,
      checkOut: null,
      checkOutSelfie: null,
      status: checkInData.status,
      overtime: 0,
      notes: checkInData.notes
    };

    setAttendance([...attendance, newAttendance]);
    setShowCheckInModal(false);
    setCheckInData({
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      status: 'present',
      shift: 'morning',
      selfie: null,
      notes: ''
    });
    showNotificationMessage(`Check-in recorded for ${selectedEmployee.name}`, 'success');
  };

  // Handle check out
  const handleCheckOut = () => {
    const updatedAttendance = attendance.map(a => {
      if (a.employeeId === selectedEmployee.id && a.date === formatDate(selectedDate)) {
        return {
          ...a,
          checkOut: checkOutData.time,
          checkOutSelfie: checkOutData.selfie || `selfie_${selectedEmployee.id}_${formatDate(selectedDate)}_out.jpg`,
          overtime: checkOutData.overtime,
          notes: a.notes + ' ' + checkOutData.notes
        };
      }
      return a;
    });

    setAttendance(updatedAttendance);
    setShowCheckOutModal(false);
    setCheckOutData({
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      overtime: 0,
      selfie: null,
      notes: ''
    });
    showNotificationMessage(`Check-out recorded for ${selectedEmployee.name}`, 'success');
  };

  // Handle mark attendance
  const handleMarkAttendance = (employeeId, status) => {
    const existingRecord = attendance.find(
      a => a.employeeId === employeeId && a.date === formatDate(selectedDate)
    );

    if (existingRecord) {
      setAttendance(attendance.map(a => 
        a.id === existingRecord.id ? { ...a, status } : a
      ));
    } else {
      const employee = [...regularEmployees, ...onCallEmployees].find(e => e.id === employeeId);
      const newAttendance = {
        id: attendance.length + 1,
        employeeId,
        employeeName: employee.name,
        employeeType: employee.type,
        date: formatDate(selectedDate),
        shift: employee.shift || 'morning',
        checkIn: status === 'present' ? '09:00' : null,
        checkInSelfie: status === 'present' ? `selfie_${employeeId}_${formatDate(selectedDate)}_in.jpg` : null,
        checkOut: status === 'present' ? '17:00' : null,
        checkOutSelfie: status === 'present' ? `selfie_${employeeId}_${formatDate(selectedDate)}_out.jpg` : null,
        status,
        overtime: 0,
        notes: `Marked as ${status} manually`
      };
      setAttendance([...attendance, newAttendance]);
    }
    showNotificationMessage(`Attendance marked as ${status}`, 'success');
  };

  // Handle edit employee
  const handleEditEmployee = () => {
    setShowEmployeeDetails(false);
    showNotificationMessage('Edit employee feature coming soon!', 'info');
  };

  // Handle delete employee
  const handleDeleteEmployee = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedEmployee.name}?`)) {
      showNotificationMessage(`Employee ${selectedEmployee.name} deleted`, 'warning');
      setShowEmployeeDetails(false);
    }
  };

  // Get status badge details
  const getStatusDetails = (status) => {
    const statusMap = {
      'present': { color: '#27ae60', icon: FiCheckCircle, text: 'Present', bg: 'rgba(39, 174, 96, 0.1)' },
      'absent': { color: '#e74c3c', icon: FiXCircle, text: 'Absent', bg: 'rgba(231, 76, 60, 0.1)' },
      'late': { color: '#f39c12', icon: FiAlertCircle, text: 'Late', bg: 'rgba(243, 156, 18, 0.1)' },
      'half-day': { color: '#9b59b6', icon: FiClock, text: 'Half Day', bg: 'rgba(155, 89, 182, 0.1)' },
      'on-leave': { color: '#7f8c8d', icon: FiCalendar, text: 'On Leave', bg: 'rgba(127, 140, 141, 0.1)' }
    };
    return statusMap[status] || statusMap['absent'];
  };

  // Get shift details
  const getShiftDetails = (shift) => {
    const shiftMap = {
      'morning': { color: '#f39c12', icon: FiSunrise, text: 'Morning (8AM-4PM)' },
      'afternoon': { color: '#3498db', icon: FiSunrise, text: 'Afternoon (1PM-9PM)' },
      'evening': { color: '#9b59b6', icon: FiSunset, text: 'Evening (5PM-1AM)' },
      'night': { color: '#2c3e50', icon: FiSunset, text: 'Night (10PM-6AM)' }
    };
    return shiftMap[shift] || shiftMap['morning'];
  };

  // Notification component
  const Notification = () => (
    <motion.div 
      className={`attendance-notification ${notificationType}`}
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
    >
      <div className="notification-icon">
        {notificationType === 'success' && <FiCheckCircle />}
        {notificationType === 'error' && <FiXCircle />}
        {notificationType === 'warning' && <FiAlertCircle />}
        {notificationType === 'info' && <FiClock />}
      </div>
      <div className="notification-message">{notificationMessage}</div>
      <button className="notification-close" onClick={() => setShowNotification(false)}>
        <FiX />
      </button>
    </motion.div>
  );

  // Loading state
  if (!attendance.length) {
    return <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Loading attendance data...</p>
    </div>;
  }

  return (
    <div className="attendance-container">
      {/* Notification */}
      <AnimatePresence>
        {showNotification && <Notification />}
      </AnimatePresence>

      {/* Header */}
      <motion.div 
        className="attendance-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="header-left">
          <motion.div 
            className="header-icon"
            whileHover={{ rotate: 180 }}
            transition={{ duration: 0.3 }}
          >
            <FiUserCheck />
          </motion.div>
          <div className="header-title">
            <h1>Attendance Management</h1>
            <p>Track employee attendance with selfie verification</p>
          </div>
        </div>

        <div className="header-actions">
          <motion.button
            className="action-btn"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAttendanceSummary(true)}
            title="View Summary"
          >
            <FiBarChart2 />
            <span>Summary</span>
          </motion.button>
          
          <motion.button
            className="action-btn"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowExportModal(true)}
            title="Export Data"
          >
            <FiDownload />
            <span>Export</span>
          </motion.button>
          
          <motion.button
            className="action-btn"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowPrintModal(true)}
            title="Print"
          >
            <FiPrinter />
            <span>Print</span>
          </motion.button>
          
          <motion.button
            className="action-btn primary"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddEmployeeModal(true)}
            title="Add New Employee"
          >
            <FiUserPlus />
            <span>Add Employee</span>
          </motion.button>
          
          <motion.button
            className="action-btn refresh-btn"
            whileHover={{ rotate: 180 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            title="Refresh Data"
          >
            <FiRefreshCw />
          </motion.button>
        </div>
      </motion.div>

      {/* Date Navigator */}
      <motion.div 
        className="date-navigator"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="date-view-toggle">
          <motion.button
            className={`view-mode-btn ${dateViewMode === 'day' ? 'active' : ''}`}
            onClick={() => {
              setDateViewMode('day');
              setCurrentPage(1);
              showNotificationMessage('Switched to day view', 'info');
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <BsCalendarDay />
            <span>Day</span>
          </motion.button>
          
          <motion.button
            className={`view-mode-btn ${dateViewMode === 'month' ? 'active' : ''}`}
            onClick={() => {
              setDateViewMode('month');
              setCurrentPage(1);
              showNotificationMessage('Switched to month view', 'info');
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <BsCalendarMonth />
            <span>Month</span>
          </motion.button>
          
          <motion.button
            className={`view-mode-btn ${dateViewMode === 'year' ? 'active' : ''}`}
            onClick={() => {
              setDateViewMode('year');
              setCurrentPage(1);
              showNotificationMessage('Switched to year view', 'info');
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <BsCalendarWeek />
            <span>Year</span>
          </motion.button>
          
          <motion.button
            className={`view-mode-btn ${dateViewMode === 'range' ? 'active' : ''}`}
            onClick={() => {
              setDateViewMode('range');
              setCurrentPage(1);
              showNotificationMessage('Switched to pay period view', 'info');
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FiCalendar />
            <span>Pay Period</span>
          </motion.button>
        </div>

        <div className="date-display">
          <div className="date-icon">
            <FiCalendar />
          </div>
          <div className="date-info">
            {dateViewMode === 'day' && (
              <>
                <span className="current-date">{formatDisplayDate(selectedDate)}</span>
                <span className="current-day">{getDayName(selectedDate)}</span>
              </>
            )}
            {dateViewMode === 'month' && (
              <span className="current-date">{formatDisplayMonth(selectedMonth, selectedYear)}</span>
            )}
            {dateViewMode === 'year' && (
              <span className="current-date">{selectedYear}</span>
            )}
            {dateViewMode === 'range' && selectedPayPeriod && (
              <span className="current-date">{selectedPayPeriod.label}</span>
            )}
          </div>
        </div>

        <div className="date-controls">
          <motion.button
            className="date-nav-btn"
            onClick={goToPrevious}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <FiChevronLeft />
          </motion.button>
          
            <motion.button
      className="today-btn"
      onClick={goToToday}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <FiCalendar /> {/* Add this icon if missing */}
      <span>Today</span>
    </motion.button>
          
          <motion.button
            className="date-nav-btn"
            onClick={goToNext}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <FiChevronRight />
          </motion.button>
        </div>
      </motion.div>

      {/* Cutoff Day Selector */}
      {dateViewMode === 'range' && (
        <motion.div 
          className="cutoff-selector"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12 }}
        >
          <label>Pay Period Cutoff Day:</label>
          <select 
            value={cutoffDay} 
            onChange={(e) => {
              setCutoffDay(parseInt(e.target.value));
              showNotificationMessage(`Cutoff day changed to ${e.target.value}th`, 'info');
            }}
            className="cutoff-select"
          >
            {[1, 5, 10, 15, 20, 25].map(day => (
              <option key={day} value={day}>{day}th of month</option>
            ))}
          </select>
          <span className="cutoff-info">Every {cutoffDay}th is cutoff</span>
        </motion.div>
      )}

      {/* Employee Type Tabs */}
      <motion.div 
        className="employee-tabs"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        <motion.button
          className={`employee-tab ${employeeType === 'all' ? 'active' : ''}`}
          onClick={() => {
            setEmployeeType('all');
            setCurrentPage(1);
            showNotificationMessage('Showing all employees', 'info');
          }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.95 }}
        >
          <FiUsers />
          <span>All Employees</span>
          <span className="tab-badge">{regularEmployees.length + onCallEmployees.length}</span>
        </motion.button>

        <motion.button
          className={`employee-tab regular ${employeeType === 'regular' ? 'active' : ''}`}
          onClick={() => {
            setEmployeeType('regular');
            setCurrentPage(1);
            showNotificationMessage('Showing regular employees', 'info');
          }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.95 }}
        >
          <FiBriefcase />
          <span>Regular</span>
          <span className="tab-badge">{regularEmployees.length}</span>
        </motion.button>

        <motion.button
          className={`employee-tab oncall ${employeeType === 'oncall' ? 'active' : ''}`}
          onClick={() => {
            setEmployeeType('oncall');
            setCurrentPage(1);
            showNotificationMessage('Showing on-call staff', 'info');
          }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.95 }}
        >
          <FiClock />
          <span>On-Call</span>
          <span className="tab-badge">{onCallEmployees.length}</span>
        </motion.button>
      </motion.div>

      {/* Stats Cards */}
      <motion.div 
        className="stats-grid"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <motion.div 
          className="stat-card formal"
          whileHover={{ y: -2 }}
          onClick={() => showNotificationMessage(`Total Employees: ${stats.totalEmployees}`, 'info')}
        >
          <div className="stat-icon total">
            <FiUsers />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Employees</span>
            <span className="stat-value">{stats.totalEmployees}</span>
          </div>
        </motion.div>

        <motion.div 
          className="stat-card formal"
          whileHover={{ y: -2 }}
          onClick={() => showNotificationMessage(`Present: ${stats.present} employees`, 'success')}
        >
          <div className="stat-icon present">
            <FiCheckCircle />
          </div>
          <div className="stat-info">
            <span className="stat-label">Present</span>
            <span className="stat-value">{stats.present}</span>
            <span className="stat-percentage">{((stats.present / stats.totalEmployees) * 100 || 0).toFixed(0)}%</span>
          </div>
        </motion.div>

        <motion.div 
          className="stat-card formal"
          whileHover={{ y: -2 }}
          onClick={() => showNotificationMessage(`Absent: ${stats.absent} employees`, 'warning')}
        >
          <div className="stat-icon absent">
            <FiXCircle />
          </div>
          <div className="stat-info">
            <span className="stat-label">Absent</span>
            <span className="stat-value">{stats.absent}</span>
            <span className="stat-percentage">{((stats.absent / stats.totalEmployees) * 100 || 0).toFixed(0)}%</span>
          </div>
        </motion.div>

        <motion.div 
          className="stat-card formal"
          whileHover={{ y: -2 }}
          onClick={() => showNotificationMessage(`Total Hours: ${stats.totalHours}`, 'info')}
        >
          <div className="stat-icon hours">
            <FiClock />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Hours</span>
            <span className="stat-value">{stats.totalHours}</span>
            <span className="stat-percentage">Avg: {stats.averageHours}h</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Search and Filter Bar */}
      <motion.div 
        className="search-filter-bar"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
      >
        <div className="search-wrapper">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search by name, ID, position, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <motion.button
              className="clear-search"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              onClick={() => {
                setSearchTerm('');
                showNotificationMessage('Search cleared', 'info');
              }}
            >
              <FiX />
            </motion.button>
          )}
        </div>

        <div className="filter-actions">
          <motion.button
            className={`filter-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FiFilter />
            <span>Filters</span>
            {(statusFilter !== 'all' || shiftFilter !== 'all') && (
              <motion.span 
                className="filter-badge"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                {(statusFilter !== 'all' ? 1 : 0) + (shiftFilter !== 'all' ? 1 : 0)}
              </motion.span>
            )}
          </motion.button>

          <div className="view-toggle">
            <motion.button
              className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => {
                setViewMode('table');
                showNotificationMessage('Switched to table view', 'info');
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <FiList />
            </motion.button>
            <motion.button
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => {
                setViewMode('grid');
                showNotificationMessage('Switched to grid view', 'info');
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <FiGrid />
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div 
            className="filters-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="filters-header">
              <h3>Filter Attendance</h3>
              <motion.button
                className="close-filters"
                onClick={() => setShowFilters(false)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <FiX />
              </motion.button>
            </div>

            <div className="filters-content">
              {dateViewMode === 'day' && (
                <div className="filter-group">
                  <label>Status</label>
                  <div className="filter-options">
                    <motion.button
                      className={`filter-option ${statusFilter === 'all' ? 'active' : ''}`}
                      onClick={() => {
                        setStatusFilter('all');
                        showNotificationMessage('Status filter cleared', 'info');
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      All
                    </motion.button>
                    <motion.button
                      className={`filter-option present ${statusFilter === 'present' ? 'active' : ''}`}
                      onClick={() => {
                        setStatusFilter('present');
                        showNotificationMessage('Filtering: Present', 'info');
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Present
                    </motion.button>
                    <motion.button
                      className={`filter-option absent ${statusFilter === 'absent' ? 'active' : ''}`}
                      onClick={() => {
                        setStatusFilter('absent');
                        showNotificationMessage('Filtering: Absent', 'info');
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Absent
                    </motion.button>
                    <motion.button
                      className={`filter-option late ${statusFilter === 'late' ? 'active' : ''}`}
                      onClick={() => {
                        setStatusFilter('late');
                        showNotificationMessage('Filtering: Late', 'info');
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Late
                    </motion.button>
                  </div>
                </div>
              )}

              <div className="filter-group">
                <label>Shift</label>
                <div className="filter-options">
                  <motion.button
                    className={`filter-option ${shiftFilter === 'all' ? 'active' : ''}`}
                    onClick={() => {
                      setShiftFilter('all');
                      showNotificationMessage('Shift filter cleared', 'info');
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    All Shifts
                  </motion.button>
                  <motion.button
                    className={`filter-option morning ${shiftFilter === 'morning' ? 'active' : ''}`}
                    onClick={() => {
                      setShiftFilter('morning');
                      showNotificationMessage('Filtering: Morning shift', 'info');
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Morning
                  </motion.button>
                  <motion.button
                    className={`filter-option afternoon ${shiftFilter === 'afternoon' ? 'active' : ''}`}
                    onClick={() => {
                      setShiftFilter('afternoon');
                      showNotificationMessage('Filtering: Afternoon shift', 'info');
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Afternoon
                  </motion.button>
                  <motion.button
                    className={`filter-option evening ${shiftFilter === 'evening' ? 'active' : ''}`}
                    onClick={() => {
                      setShiftFilter('evening');
                      showNotificationMessage('Filtering: Evening shift', 'info');
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Evening
                  </motion.button>
                </div>
              </div>

                <div className="filter-actions-bottom">
                  <motion.button
  className="clear-filters-btn"
  onClick={() => {
    setStatusFilter('all');
    setShiftFilter('all');
    showNotificationMessage('All filters cleared', 'success');
  }}
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
>
  <FiXCircle /> {/* This icon should be there */}
  Clear All Filters
</motion.button>
                </div>
              </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content - Scrollable Area */}
      <div className="main-content-scrollable" ref={mainContentRef}>
        {/* Table View */}
        {viewMode === 'table' && (
          <motion.div 
            className="attendance-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <table className="attendance-table formal">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>ID</th>
                  <th>Position</th>
                  <th>Department</th>
                  {dateViewMode === 'day' ? (
                    <>
                      <th>Shift</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Selfie</th>
                      <th>Status</th>
                    </>
                  ) : (
                    <>
                      <th>Present</th>
                      <th>Absent</th>
                      <th>Late</th>
                      <th>Total Hours</th>
                      <th>Avg Hours</th>
                    </>
                  )}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEmployees.map((employee, index) => {
                  if (dateViewMode === 'day') {
                    const attendance = employee.attendance;
                    const status = getStatusDetails(attendance.status);
                    const StatusIcon = status.icon;
                    const shift = getShiftDetails(attendance.shift);
                    const ShiftIcon = shift.icon;

                    return (
                      <motion.tr
                        key={employee.id}
                        className="formal-row"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <td>
                          <div className="employee-cell">
                            <div className={`employee-avatar ${employee.type}`}>
                              {employee.avatar}
                            </div>
                            <div className="employee-info">
                              <span className="employee-name">{employee.name}</span>
                              <span className="employee-type">{employee.type === 'regular' ? 'Regular' : 'On-Call'}</span>
                            </div>
                          </div>
                        </td>
                        <td><span className="employee-id">{employee.id}</span></td>
                        <td>{employee.position}</td>
                        <td>{employee.department}</td>
                        <td>
                          <span className={`shift-badge ${attendance.shift}`}>
                            <ShiftIcon />
                            <span>{attendance.shift}</span>
                          </span>
                        </td>
                        <td>{attendance.checkIn || '—'}</td>
                        <td>
                          {attendance.checkOut ? (
                            <span>{attendance.checkOut} {attendance.overtime > 0 && <span className="overtime-badge">+{attendance.overtime}h</span>}</span>
                          ) : attendance.checkIn ? 'In Progress' : '—'}
                        </td>
                        <td>
                          {(attendance.checkInSelfie || attendance.checkOutSelfie) && (
                            <button
                              className="selfie-thumbnail"
                              onClick={() => {
                                setSelectedSelfie(attendance.checkInSelfie || attendance.checkOutSelfie);
                                setSelfieType(attendance.checkInSelfie ? 'Check In' : 'Check Out');
                                setShowSelfieModal(true);
                              }}
                              title="View Selfie"
                            >
                              <BsCameraFill />
                            </button>
                          )}
                        </td>
                        <td>
                          <span className={`status-badge ${attendance.status}`}>
                            <StatusIcon />
                            <span>{status.text}</span>
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            {dateViewMode === 'day' && !attendance.checkIn && (
                              <>
                                <button
                                  className="action-icon-btn check-in"
                                  onClick={() => {
                                    setSelectedEmployee(employee);
                                    setShowCheckInModal(true);
                                  }}
                                  title="Check In with Selfie"
                                >
                                  <FiLogOut style={{ transform: 'rotate(180deg)' }} />
                                </button>
                                <button
                                  className="action-icon-btn present"
                                  onClick={() => handleMarkAttendance(employee.id, 'present')}
                                  title="Mark Present"
                                >
                                  <FiCheckCircle />
                                </button>
                                <button
                                  className="action-icon-btn absent"
                                  onClick={() => handleMarkAttendance(employee.id, 'absent')}
                                  title="Mark Absent"
                                >
                                  <FiXCircle />
                                </button>
                              </>
                            )}
                            {dateViewMode === 'day' && attendance.checkIn && !attendance.checkOut && (
                              <button
                                className="action-icon-btn check-out"
                                onClick={() => {
                                  setSelectedEmployee(employee);
                                  setShowCheckOutModal(true);
                                }}
                                title="Check Out with Selfie"
                              >
                                <FiLogOut />
                              </button>
                            )}
                            <button
                              className="action-icon-btn view"
                              onClick={() => {
                                setSelectedEmployee(employee);
                                setShowEmployeeDetails(true);
                              }}
                              title="View Details"
                            >
                              <FiEye />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  } else {
                    return (
                      <motion.tr
                        key={employee.id}
                        className="formal-row"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <td>
                          <div className="employee-cell">
                            <div className={`employee-avatar ${employee.type}`}>
                              {employee.avatar}
                            </div>
                            <div className="employee-info">
                              <span className="employee-name">{employee.name}</span>
                              <span className="employee-type">{employee.type === 'regular' ? 'Regular' : 'On-Call'}</span>
                            </div>
                          </div>
                        </td>
                        <td><span className="employee-id">{employee.id}</span></td>
                        <td>{employee.position}</td>
                        <td>{employee.department}</td>
                        <td className="text-success">{employee.summary?.present || 0}</td>
                        <td className="text-danger">{employee.summary?.absent || 0}</td>
                        <td className="text-warning">{employee.summary?.late || 0}</td>
                        <td><strong>{employee.summary?.totalHours || 0}h</strong></td>
                        <td>{employee.summary?.averageHours || 0}h</td>
                        <td>
                          <div className="action-buttons">
                            <button
                              className="action-icon-btn view"
                              onClick={() => {
                                setSelectedEmployee(employee);
                                setShowEmployeeDetails(true);
                              }}
                              title="View Details"
                            >
                              <FiEye />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  }
                })}
              </tbody>
            </table>

            {/* Empty State */}
            {filteredEmployees.length === 0 && (
              <motion.div 
                className="empty-state"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <FiUsers className="empty-icon" />
                <h3>No employees found</h3>
                <p>Try adjusting your search or filter criteria</p>
                <button
                  className="clear-filters-btn"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setShiftFilter('all');
                    showNotificationMessage('All filters cleared', 'success');
                  }}
                >
                  Clear Filters
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Grid View */}
        {viewMode === 'grid' && (
          <motion.div 
            className="employee-grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="grid-container">
              {paginatedEmployees.map((employee, index) => {
                if (dateViewMode === 'day') {
                  const attendance = employee.attendance;
                  const status = getStatusDetails(attendance.status);
                  const StatusIcon = status.icon;

                  return (
                    <motion.div
                      key={employee.id}
                      className="employee-card formal"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <div className="card-header">
                        <div className="employee-avatar-large">{employee.avatar}</div>
                        <div className="employee-id-badge">{employee.id}</div>
                      </div>
                      <div className="card-body">
                        <h3 className="employee-name">{employee.name}</h3>
                        <p className="employee-position">{employee.position}</p>
                        <p className="employee-department">{employee.department}</p>
                        <div className="employee-type-badge">{employee.type === 'regular' ? 'Regular' : 'On-Call'}</div>
                        
                        <div className="attendance-details">
                          <div className="detail-item">
                            <span className="detail-label">Shift:</span>
                            <span className="detail-value">{attendance.shift}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Check In:</span>
                            <span className="detail-value">{attendance.checkIn || '—'}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Check Out:</span>
                            <span className="detail-value">{attendance.checkOut || '—'}</span>
                          </div>
                          {(attendance.checkInSelfie || attendance.checkOutSelfie) && (
                            <div className="detail-item">
                              <span className="detail-label">Selfie:</span>
                              <button
                                className="selfie-thumbnail small"
                                onClick={() => {
                                  setSelectedSelfie(attendance.checkInSelfie || attendance.checkOutSelfie);
                                  setSelfieType(attendance.checkInSelfie ? 'Check In' : 'Check Out');
                                  setShowSelfieModal(true);
                                }}
                              >
                                <BsCameraFill />
                              </button>
                            </div>
                          )}
                        </div>

                        <div className={`status-badge ${attendance.status}`}>
                          <StatusIcon />
                          <span>{status.text}</span>
                        </div>
                      </div>
                      <div className="card-footer">
                        {!attendance.checkIn && (
                          <>
                            <button
                              className="action-btn small check-in"
                              onClick={() => {
                                setSelectedEmployee(employee);
                                setShowCheckInModal(true);
                              }}
                            >
                              Check In
                            </button>
                            <button
                              className="action-icon-btn present"
                              onClick={() => handleMarkAttendance(employee.id, 'present')}
                              title="Mark Present"
                            >
                              <FiCheckCircle />
                            </button>
                          </>
                        )}
                        {attendance.checkIn && !attendance.checkOut && (
                          <button
                            className="action-btn small check-out"
                            onClick={() => {
                              setSelectedEmployee(employee);
                              setShowCheckOutModal(true);
                            }}
                          >
                            Check Out
                          </button>
                        )}
                        <button
                          className="action-icon-btn view"
                          onClick={() => {
                            setSelectedEmployee(employee);
                            setShowEmployeeDetails(true);
                          }}
                          title="View Details"
                        >
                          <FiEye />
                        </button>
                      </div>
                    </motion.div>
                  );
                } else {
                  return (
                    <motion.div
                      key={employee.id}
                      className="employee-card formal"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <div className="card-header">
                        <div className="employee-avatar-large">{employee.avatar}</div>
                        <div className="employee-id-badge">{employee.id}</div>
                      </div>
                      <div className="card-body">
                        <h3 className="employee-name">{employee.name}</h3>
                        <p className="employee-position">{employee.position}</p>
                        <p className="employee-department">{employee.department}</p>
                        <div className="employee-type-badge">{employee.type === 'regular' ? 'Regular' : 'On-Call'}</div>
                        
                        <div className="attendance-summary-grid">
                          <div className="summary-item">
                            <span className="summary-label">Present</span>
                            <span className="summary-value success">{employee.summary?.present || 0}</span>
                          </div>
                          <div className="summary-item">
                            <span className="summary-label">Absent</span>
                            <span className="summary-value danger">{employee.summary?.absent || 0}</span>
                          </div>
                          <div className="summary-item">
                            <span className="summary-label">Late</span>
                            <span className="summary-value warning">{employee.summary?.late || 0}</span>
                          </div>
                          <div className="summary-item">
                            <span className="summary-label">Hours</span>
                            <span className="summary-value">{employee.summary?.totalHours || 0}h</span>
                          </div>
                        </div>
                      </div>
                      <div className="card-footer">
                        <button
                          className="action-btn small"
                          onClick={() => {
                            setSelectedEmployee(employee);
                            setShowEmployeeDetails(true);
                          }}
                        >
                          View Details
                        </button>
                      </div>
                    </motion.div>
                  );
                }
              })}
            </div>

            {/* Empty State */}
            {filteredEmployees.length === 0 && (
              <motion.div 
                className="empty-state"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <FiUsers className="empty-icon" />
                <h3>No employees found</h3>
                <p>Try adjusting your search or filter criteria</p>
                <button
                  className="clear-filters-btn"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setShiftFilter('all');
                    showNotificationMessage('All filters cleared', 'success');
                  }}
                >
                  Clear Filters
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Pagination */}
        {filteredEmployees.length > 0 && (
          <motion.div 
            className="pagination formal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div className="pagination-info">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredEmployees.length)} of {filteredEmployees.length} employees
            </div>
            
            <div className="pagination-controls">
              <motion.button
                className="pagination-btn"
                onClick={() => {
                  setCurrentPage(prev => Math.max(1, prev - 1));
                  showNotificationMessage(`Page ${currentPage - 1}`, 'info');
                  mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={currentPage === 1}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <FiChevronLeft />
              </motion.button>
              
              {[...Array(totalPages)].map((_, i) => (
                <motion.button
                  key={i}
                  className={`pagination-btn ${currentPage === i + 1 ? 'active' : ''}`}
                  onClick={() => {
                    setCurrentPage(i + 1);
                    showNotificationMessage(`Page ${i + 1}`, 'info');
                    mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {i + 1}
                </motion.button>
              ))}
              
              <motion.button
                className="pagination-btn"
                onClick={() => {
                  setCurrentPage(prev => Math.min(totalPages, prev + 1));
                  showNotificationMessage(`Page ${currentPage + 1}`, 'info');
                  mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={currentPage === totalPages}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <FiChevronRight />
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Check In Modal with Selfie */}
      <AnimatePresence>
        {showCheckInModal && selectedEmployee && (
          <motion.div 
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              stopCamera();
              setShowCheckInModal(false);
            }}
          >
            <motion.div 
              className="modal-content check-modal"
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>Check In - {selectedEmployee.name}</h2>
                <button
                  className="close-modal"
                  onClick={() => {
                    stopCamera();
                    setShowCheckInModal(false);
                  }}
                >
                  <FiX />
                </button>
              </div>

              <div className="modal-body">
                <div className="employee-preview">
                  <div className="preview-avatar">{selectedEmployee.avatar}</div>
                  <div className="preview-details">
                    <h3>{selectedEmployee.name}</h3>
                    <p>{selectedEmployee.position} • {selectedEmployee.department}</p>
                    <span className="preview-type">{selectedEmployee.type === 'regular' ? 'Regular' : 'On-Call'}</span>
                  </div>
                </div>

                {showCamera ? (
                  <div className="camera-container">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="camera-preview"
                    />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    <div className="camera-controls">
                      <motion.button
                        className="capture-btn"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={captureSelfie}
                      >
                        <BsCameraFill />
                        <span>Capture Selfie</span>
                      </motion.button>
                      <motion.button
                        className="cancel-btn"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={stopCamera}
                      >
                        Cancel
                      </motion.button>
                    </div>
                  </div>
                ) : (
                  <>
                    {checkInData.selfie ? (
                      <div className="selfie-preview">
                        <img src={checkInData.selfie} alt="Check-in selfie" />
                        <div className="selfie-actions">
                          <motion.button
                            className="retake-btn"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setCheckInData({ ...checkInData, selfie: null });
                              startCamera();
                            }}
                          >
                            <FiCamera />
                            <span>Retake</span>
                          </motion.button>
                        </div>
                      </div>
                    ) : (
                      <motion.button
                        className="take-selfie-btn"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={startCamera}
                      >
                        <BsCameraFill />
                        <span>Take Selfie for Check-in</span>
                      </motion.button>
                    )}
                  </>
                )}

                {!showCamera && (
                  <div className="check-form">
                    <div className="form-group">
                      <label>Check In Time</label>
                      <div className="time-input-group">
                        <input
                          type="time"
                          value={checkInData.time}
                          onChange={(e) => setCheckInData({...checkInData, time: e.target.value})}
                        />
                        <button
                          className="time-now-btn"
                          onClick={() => setCheckInData({
                            ...checkInData,
                            time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
                          })}
                        >
                          Now
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Shift</label>
                      <select
                        value={checkInData.shift}
                        onChange={(e) => setCheckInData({...checkInData, shift: e.target.value})}
                        className="form-select"
                      >
                        <option value="morning">Morning (8AM-4PM)</option>
                        <option value="afternoon">Afternoon (1PM-9PM)</option>
                        <option value="evening">Evening (5PM-1AM)</option>
                        <option value="night">Night (10PM-6AM)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Status</label>
                      <select
                        value={checkInData.status}
                        onChange={(e) => setCheckInData({...checkInData, status: e.target.value})}
                        className="form-select"
                      >
                        <option value="present">Present</option>
                        <option value="late">Late</option>
                        <option value="half-day">Half Day</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Notes</label>
                      <textarea
                        value={checkInData.notes}
                        onChange={(e) => setCheckInData({...checkInData, notes: e.target.value})}
                        placeholder="Add any notes..."
                        rows="3"
                      />
                    </div>
                  </div>
                )}
              </div>

              {!showCamera && (
                <div className="modal-footer">
                  <button
                    className="modal-btn secondary"
                    onClick={() => {
                      stopCamera();
                      setShowCheckInModal(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="modal-btn success"
                    onClick={handleCheckIn}
                    disabled={!checkInData.selfie}
                  >
                    Confirm Check In
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Check Out Modal with Selfie */}
      <AnimatePresence>
        {showCheckOutModal && selectedEmployee && (
          <motion.div 
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              stopCamera();
              setShowCheckOutModal(false);
            }}
          >
            <motion.div 
              className="modal-content check-modal"
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>Check Out - {selectedEmployee.name}</h2>
                <button
                  className="close-modal"
                  onClick={() => {
                    stopCamera();
                    setShowCheckOutModal(false);
                  }}
                >
                  <FiX />
                </button>
              </div>

              <div className="modal-body">
                <div className="employee-preview">
                  <div className="preview-avatar">{selectedEmployee.avatar}</div>
                  <div className="preview-details">
                    <h3>{selectedEmployee.name}</h3>
                    <p>{selectedEmployee.position} • {selectedEmployee.department}</p>
                    <span className="preview-type">{selectedEmployee.type === 'regular' ? 'Regular' : 'On-Call'}</span>
                  </div>
                </div>

                {showCamera ? (
                  <div className="camera-container">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="camera-preview"
                    />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    <div className="camera-controls">
                      <motion.button
                        className="capture-btn"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={captureSelfie}
                      >
                        <BsCameraFill />
                        <span>Capture Selfie</span>
                      </motion.button>
                      <motion.button
                        className="cancel-btn"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={stopCamera}
                      >
                        Cancel
                      </motion.button>
                    </div>
                  </div>
                ) : (
                  <>
                    {checkOutData.selfie ? (
                      <div className="selfie-preview">
                        <img src={checkOutData.selfie} alt="Check-out selfie" />
                        <div className="selfie-actions">
                          <motion.button
                            className="retake-btn"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setCheckOutData({ ...checkOutData, selfie: null });
                              startCamera();
                            }}
                          >
                            <FiCamera />
                            <span>Retake</span>
                          </motion.button>
                        </div>
                      </div>
                    ) : (
                      <motion.button
                        className="take-selfie-btn"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={startCamera}
                      >
                        <BsCameraFill />
                        <span>Take Selfie for Check-out</span>
                      </motion.button>
                    )}
                  </>
                )}

                {!showCamera && (
                  <div className="check-form">
                    <div className="form-group">
                      <label>Check Out Time</label>
                      <div className="time-input-group">
                        <input
                          type="time"
                          value={checkOutData.time}
                          onChange={(e) => setCheckOutData({...checkOutData, time: e.target.value})}
                        />
                        <button
                          className="time-now-btn"
                          onClick={() => setCheckOutData({
                            ...checkOutData,
                            time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
                          })}
                        >
                          Now
                        </button>
                      </div>
                    </div>

                    {selectedEmployee.type === 'oncall' && (
                      <div className="form-group">
                        <label>Overtime (hours)</label>
                        <input
                          type="number"
                          value={checkOutData.overtime}
                          onChange={(e) => setCheckOutData({...checkOutData, overtime: parseFloat(e.target.value) || 0})}
                          min="0"
                          step="0.5"
                        />
                      </div>
                    )}

                    <div className="form-group">
                      <label>Notes</label>
                      <textarea
                        value={checkOutData.notes}
                        onChange={(e) => setCheckOutData({...checkOutData, notes: e.target.value})}
                        placeholder="Add any notes..."
                        rows="3"
                      />
                    </div>
                  </div>
                )}
              </div>

              {!showCamera && (
                <div className="modal-footer">
                  <button
                    className="modal-btn secondary"
                    onClick={() => {
                      stopCamera();
                      setShowCheckOutModal(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="modal-btn primary"
                    onClick={handleCheckOut}
                    disabled={!checkOutData.selfie}
                  >
                    Confirm Check Out
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selfie View Modal */}
      <AnimatePresence>
        {showSelfieModal && selectedSelfie && (
          <motion.div 
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSelfieModal(false)}
          >
            <motion.div 
              className="modal-content selfie-modal"
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>Selfie - {selfieType}</h2>
                <button
                  className="close-modal"
                  onClick={() => setShowSelfieModal(false)}
                >
                  <FiX />
                </button>
              </div>

              <div className="modal-body">
                <img src={selectedSelfie} alt={`${selfieType} selfie`} className="selfie-full" />
              </div>

              <div className="modal-footer">
                <button
                  className="modal-btn primary"
                  onClick={() => setShowSelfieModal(false)}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Employee Details Modal */}
      <AnimatePresence>
        {showEmployeeDetails && selectedEmployee && (
          <motion.div 
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowEmployeeDetails(false)}
          >
            <motion.div 
              className="modal-content"
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>Employee Details</h2>
                <button
                  className="close-modal"
                  onClick={() => setShowEmployeeDetails(false)}
                >
                  <FiX />
                </button>
              </div>

              <div className="modal-body">
                <div className="employee-profile">
                  <div className="profile-avatar">{selectedEmployee.avatar}</div>
                  <div className="profile-info">
                    <h2>{selectedEmployee.name}</h2>
                    <p>{selectedEmployee.position}</p>
                    <span className="employee-type-badge">{selectedEmployee.type}</span>
                  </div>
                </div>

                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Employee ID</span>
                    <span className="detail-value">{selectedEmployee.id}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Department</span>
                    <span className="detail-value">{selectedEmployee.department}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Email</span>
                    <span className="detail-value">{selectedEmployee.email}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Phone</span>
                    <span className="detail-value">{selectedEmployee.phone}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Join Date</span>
                    <span className="detail-value">{selectedEmployee.joinDate}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Shift</span>
                    <span className="detail-value">{selectedEmployee.shift}</span>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="modal-btn secondary"
                  onClick={() => setShowEmployeeDetails(false)}
                >
                  Close
                </button>
                <button
                  className="modal-btn primary"
                  onClick={handleEditEmployee}
                >
                  Edit
                </button>
                {dateViewMode === 'day' && !selectedEmployee.attendance?.checkIn && (
                  <button
                    className="modal-btn success"
                    onClick={() => {
                      setShowEmployeeDetails(false);
                      setShowCheckInModal(true);
                    }}
                  >
                    Check In
                  </button>
                )}
                {dateViewMode === 'day' && selectedEmployee.attendance?.checkIn && !selectedEmployee.attendance?.checkOut && (
                  <button
                    className="modal-btn primary"
                    onClick={() => {
                      setShowEmployeeDetails(false);
                      setShowCheckOutModal(true);
                    }}
                  >
                    Check Out
                  </button>
                )}
                <button
                  className="modal-btn danger"
                  onClick={handleDeleteEmployee}
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attendance Summary Modal */}
      <AnimatePresence>
        {showAttendanceSummary && (
          <motion.div 
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAttendanceSummary(false)}
          >
            <motion.div 
              className="modal-content"
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>Attendance Summary</h2>
                <button
                  className="close-modal"
                  onClick={() => setShowAttendanceSummary(false)}
                >
                  <FiX />
                </button>
              </div>

              <div className="modal-body">
                <div className="summary-period">
                  <h3>
                    {dateViewMode === 'day' && `Summary for ${formatDisplayDate(selectedDate)}`}
                    {dateViewMode === 'month' && `Summary for ${formatDisplayMonth(selectedMonth, selectedYear)}`}
                    {dateViewMode === 'year' && `Summary for ${selectedYear}`}
                    {dateViewMode === 'range' && selectedPayPeriod && `Summary for ${selectedPayPeriod.label}`}
                  </h3>
                </div>

                <div className="summary-stats">
                  <div className="summary-stat">
                    <span className="stat-label">Total Employees</span>
                    <span className="stat-value">{stats.totalEmployees}</span>
                  </div>
                  <div className="summary-stat">
                    <span className="stat-label">Present</span>
                    <span className="stat-value success">{stats.present}</span>
                  </div>
                  <div className="summary-stat">
                    <span className="stat-label">Absent</span>
                    <span className="stat-value danger">{stats.absent}</span>
                  </div>
                  <div className="summary-stat">
                    <span className="stat-label">Late</span>
                    <span className="stat-value warning">{stats.late}</span>
                  </div>
                  <div className="summary-stat">
                    <span className="stat-label">Total Hours</span>
                    <span className="stat-value">{stats.totalHours}</span>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="modal-btn secondary"
                  onClick={() => setShowAttendanceSummary(false)}
                >
                  Close
                </button>
                <button
                  className="modal-btn primary"
                  onClick={() => {
                    setShowAttendanceSummary(false);
                    setShowExportModal(true);
                  }}
                >
                  Export
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <motion.div 
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowExportModal(false)}
          >
            <motion.div 
              className="modal-content small"
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>Export Data</h2>
                <button
                  className="close-modal"
                  onClick={() => setShowExportModal(false)}
                >
                  <FiX />
                </button>
              </div>

              <div className="modal-body">
                <p>Choose export format:</p>
                <div className="export-options">
                  <button
  className="export-option"
  onClick={() => handleExport('CSV')}
>
  <FiDownload /> {/* Add this icon */}
  CSV
</button>
                  <button
                    className="export-option"
                    onClick={() => handleExport('Excel')}
                  >
                    Excel
                  </button>
                  <button
                    className="export-option"
                    onClick={() => handleExport('PDF')}
                  >
                    PDF
                  </button>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="modal-btn secondary"
                  onClick={() => setShowExportModal(false)}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Print Modal */}
      <AnimatePresence>
        {showPrintModal && (
          <motion.div 
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPrintModal(false)}
          >
            <motion.div 
              className="modal-content small"
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>Print Options</h2>
                <button
                  className="close-modal"
                  onClick={() => setShowPrintModal(false)}
                >
                  <FiX />
                </button>
              </div>

              <div className="modal-body">
                <p>Choose what to print:</p>
                <div className="print-options">
                  <label>
                    <input type="radio" name="print" defaultChecked /> Current View
                  </label>
                  <label>
                    <input type="radio" name="print" /> All Employees
                  </label>
                  <label>
                    <input type="radio" name="print" /> Summary Only
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="modal-btn secondary"
                  onClick={() => setShowPrintModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="modal-btn primary"
                  onClick={handlePrint}
                >
                  Print
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Employee Modal */}
      <AnimatePresence>
        {showAddEmployeeModal && (
          <motion.div 
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAddEmployeeModal(false)}
          >
            <motion.div 
              className="modal-content add-modal"
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>Add New Employee</h2>
                <button
                  className="close-modal"
                  onClick={() => setShowAddEmployeeModal(false)}
                >
                  <FiX />
                </button>
              </div>

              <div className="modal-body">
                <p className="coming-soon">Employee registration form coming soon!</p>
                <p>This feature will allow you to add both regular and on-call employees with all their details.</p>
              </div>

              <div className="modal-footer">
                <button
                  className="modal-btn primary"
                  onClick={() => setShowAddEmployeeModal(false)}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Staff_Attendance;