// src/components/Staff_Management.jsx - COMPLETE WORKING VERSION

import React, { useState, useEffect } from 'react';
import { 
  SearchOutlined, PlusOutlined, TeamOutlined,
  ClockCircleOutlined, CalendarOutlined, EditOutlined, DeleteOutlined,
  EyeOutlined, MailOutlined, PhoneOutlined, BankOutlined, IdcardOutlined,
  UploadOutlined, StarOutlined, FilterOutlined, ReloadOutlined,
  CloseOutlined, CheckCircleOutlined, WarningOutlined, CoffeeOutlined,
  DollarOutlined, ScheduleOutlined, SafetyOutlined, HeartOutlined,
  TrophyOutlined, BookOutlined, FileTextOutlined, PrinterOutlined,
  ShareAltOutlined, PhoneFilled, MailFilled, PauseCircleOutlined,
  DeleteOutlined as DeleteIcon, RestOutlined, HistoryOutlined, InboxOutlined,
  ExportOutlined, BarChartOutlined, SortAscendingOutlined, SortDescendingOutlined,
  ColumnHeightOutlined, FullscreenOutlined, FullscreenExitOutlined,
  WhatsAppOutlined, FacebookOutlined, TwitterOutlined, LinkOutlined, CopyOutlined,
  FileExcelOutlined, FilePdfOutlined, WalletOutlined, CodeOutlined,
  LoadingOutlined, FundOutlined, RiseOutlined, ExclamationCircleOutlined, UserOutlined
} from '@ant-design/icons';
import { staffAPI, authAPI, ensureArray, handleApiError } from '../services/api';
import '../Components/styles/Staff_Management.css';

const Staff_Management = () => {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  // Core State Management
  const [imageFile, setImageFile] = useState(null);
  const [selectedTab, setSelectedTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedShift, setSelectedShift] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentDate, setCurrentDate] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [showArchive, setShowArchive] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [showBenefitsModal, setShowBenefitsModal] = useState(false);
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [showShiftsModal, setShowShiftsModal] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('success');
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    employee: true, department: true, position: true, status: true,
    shift: true, performance: true, contact: true, actions: true
  });
  
  // Validation errors
  const [formErrors, setFormErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', middle_name: '', position_id: '', email: '',
    phone: '', address: '', city: '', state: '', postal_code: '', country: 'Philippines',
    department_id: '', employee_type: 'regular', status: 'active', shift_preference: 'morning',
    hire_date: '', monthly_salary: '', emergency_contact: '', emergency_relation: '',
    emergency_phone: '', sss: '', philhealth: '', pagibig: '', tin: '', skills: '',
    certifications: '', achievements: '', notes: '', profile_photo: null,
    bank_name: '', bank_account: '', birth_date: '', gender: ''
  });
  
  const [formStep, setFormStep] = useState(1);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  
  // API States
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [filteredPositions, setFilteredPositions] = useState([]);
  const [archivedEmployees, setArchivedEmployees] = useState([]);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [leaveData, setLeaveData] = useState([]);
  const [scheduleData, setScheduleData] = useState([]);
  const [payrollData, setPayrollData] = useState([]);
  const [performanceData, setPerformanceData] = useState([]);
  const [statsData, setStatsData] = useState({
    total_employees: 0, active: 0, on_leave: 0, inactive: 0, regular: 0, oncall: 0,
    by_department: [], by_position: []
  });

  const pageSize = 10;
  const API_URL = 'http://127.0.0.1:8000';

  // Helper function to get image URL
  const getImageUrl = (photoPath) => {
    if (!photoPath) return null;
    
    if (photoPath.startsWith('http://') || photoPath.startsWith('https://')) {
      return photoPath;
    }
    
    if (photoPath.startsWith('/storage/')) {
      return `${API_URL}${photoPath}`;
    }
    
    if (photoPath.startsWith('storage/')) {
      return `${API_URL}/${photoPath}`;
    }
    
    if (photoPath.includes('employees/')) {
      const filename = photoPath.split('/').pop();
      return `${API_URL}/storage/employees/${filename}`;
    }
    
    return `${API_URL}/storage/employees/${photoPath}`;
  };

  // Validate all required fields
  const validateForm = () => {
    const errors = {};
    
    if (!formData.first_name?.trim()) errors.first_name = 'First name is required';
    if (!formData.last_name?.trim()) errors.last_name = 'Last name is required';
    if (!formData.email?.trim()) errors.email = 'Email is required';
    if (!formData.phone?.trim()) errors.phone = 'Phone is required';
    if (!formData.department_id) errors.department_id = 'Department is required';
    if (!formData.position_id) errors.position_id = 'Position is required';
    if (!formData.hire_date) errors.hire_date = 'Hire date is required';
    
    if (formData.email && !/^[^\s@]+@([^\s@]+\.)+[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (formData.phone && !/^[0-9+\-\s()]{10,20}$/.test(formData.phone)) {
      errors.phone = 'Please enter a valid phone number';
    }
    
    if (formData.hire_date) {
      const hireDate = new Date(formData.hire_date);
      const today = new Date();
      if (hireDate > today) {
        errors.hire_date = 'Hire date cannot be in the future';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validate step 1
  const validateStep1 = () => {
    const errors = {};
    if (!formData.first_name?.trim()) errors.first_name = 'First name is required';
    if (!formData.last_name?.trim()) errors.last_name = 'Last name is required';
    if (!formData.email?.trim()) errors.email = 'Email is required';
    if (!formData.phone?.trim()) errors.phone = 'Phone is required';
    if (!formData.position_id) errors.position_id = 'Position is required';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validate step 2
  const validateStep2 = () => {
    const errors = {};
    if (!formData.department_id) errors.department_id = 'Department is required';
    if (!formData.hire_date) errors.hire_date = 'Hire date is required';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBlur = (fieldName) => {
    setTouchedFields(prev => ({ ...prev, [fieldName]: true }));
  };

  // Filter positions when department changes
  useEffect(() => {
    if (formData.department_id && positions.length > 0) {
      const filtered = positions.filter(pos => pos.department_id === parseInt(formData.department_id));
      setFilteredPositions(filtered);
    } else {
      setFilteredPositions([]);
    }
  }, [formData.department_id, positions]);

  // Check authentication
  useEffect(() => { checkAuth(); }, []);
  useEffect(() => {
    const date = new Date();
    setCurrentDate(date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
  }, []);
  useEffect(() => {
    if (isAuthenticated) fetchAllData();
  }, [isAuthenticated]);

  // Fetch all data
  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchEmployees(), fetchDepartments(), fetchPositions(),
        fetchArchivedEmployees(), fetchStats()
      ]);
      Promise.all([
        fetchAttendance(), fetchLeaves(), fetchSchedules(), 
        fetchPayroll(), fetchPerformance()
      ]).catch(err => console.log('Optional data fetch failed:', err));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Authentication
  const checkAuth = async () => {
    setAuthChecking(true);
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('user');
    if (token && user) {
      try {
        const response = await authAPI.getUser();
        if (response.data.success) {
          setIsAuthenticated(true);
          setCurrentUser(response.data.data);
        } else handleAuthFailure();
      } catch (error) {
        handleAuthFailure();
      }
    } else handleAuthFailure();
    setAuthChecking(false);
  };

  const handleAuthFailure = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
  };

  const logout = async () => {
    try { await authAPI.logout(); } catch (err) { console.error('Logout error:', err); }
    finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      setIsAuthenticated(false);
      window.location.href = '/login';
    }
  };

  // Fetch functions
  const fetchEmployees = async () => {
    try {
      const params = {};
      if (selectedDepartment !== 'all') params.department_id = selectedDepartment;
      if (selectedStatus !== 'all') params.status = selectedStatus;
      if (selectedShift !== 'all') params.shift = selectedShift;
      if (searchQuery) params.search = searchQuery;
      const response = await staffAPI.getEmployees(params);
      const fetchedEmployees = ensureArray(response.data.data || response.data);
      setEmployees(fetchedEmployees.filter(emp => emp.status !== 'inactive'));
    } catch (err) {
      console.error('Error fetching employees:', err);
      setEmployees([]);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await staffAPI.getDepartments();
      setDepartments(ensureArray(response.data.data || response.data));
    } catch (err) {
      console.error('Error fetching departments:', err);
      setDepartments([]);
    }
  };

  const fetchPositions = async () => {
    try {
      const response = await staffAPI.getPositions();
      setPositions(ensureArray(response.data.data || response.data));
    } catch (err) {
      console.error('Error fetching positions:', err);
      setPositions([]);
    }
  };

  const fetchArchivedEmployees = async () => {
    try {
      const response = await staffAPI.getEmployees({ status: 'inactive' });
      setArchivedEmployees(ensureArray(response.data.data || response.data));
    } catch (err) {
      console.error('Error fetching archived employees:', err);
      setArchivedEmployees([]);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await staffAPI.getEmployeeStats();
      setStatsData(response.data.data || response.data);
    } catch (err) { 
      console.error('Error fetching stats:', err);
    }
  };

  const fetchAttendance = async () => {
    try {
      const response = await staffAPI.getAttendance({ limit: 10 });
      setAttendanceData(ensureArray(response.data.data || response.data));
    } catch (err) { 
      setAttendanceData([]);
    }
  };

  const fetchLeaves = async () => {
    try {
      const response = await staffAPI.getLeaves({ limit: 10 });
      setLeaveData(ensureArray(response.data.data || response.data));
    } catch (err) { 
      setLeaveData([]);
    }
  };

  const fetchSchedules = async () => {
    try {
      const response = await staffAPI.getSchedules({ limit: 10 });
      setScheduleData(ensureArray(response.data.data || response.data));
    } catch (err) { 
      setScheduleData([]);
    }
  };

  const fetchPayroll = async () => {
    try {
      const response = await staffAPI.getPayroll({ limit: 10 });
      setPayrollData(ensureArray(response.data.data || response.data));
    } catch (err) { 
      setPayrollData([]);
    }
  };

  const fetchPerformance = async () => {
    try {
      const response = await staffAPI.getPerformance({ limit: 10 });
      setPerformanceData(ensureArray(response.data.data || response.data));
    } catch (err) { 
      setPerformanceData([]);
    }
  };

  // Create employee
  const createEmployee = async (employeeData) => {
    if (!validateForm()) {
      showNotificationMessage('Please fill in all required fields', 'error');
      const firstError = document.querySelector('.catering-form-input.error, .catering-form-select.error');
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    
    if (isSubmitting) return false;
    setIsSubmitting(true);
    setLoading(true);
    
    try {
      const formattedData = new FormData();
      
      // Required fields
      formattedData.append('first_name', employeeData.first_name?.trim() || '');
      formattedData.append('last_name', employeeData.last_name?.trim() || '');
      formattedData.append('email', employeeData.email?.trim() || '');
      formattedData.append('phone', employeeData.phone?.trim() || '');
      formattedData.append('department_id', employeeData.department_id?.toString() || '');
      formattedData.append('position_id', employeeData.position_id?.toString() || '');
      formattedData.append('hire_date', employeeData.hire_date || '');
      formattedData.append('employee_type', employeeData.employee_type || 'regular');
      formattedData.append('status', employeeData.status || 'active');
      formattedData.append('shift_preference', employeeData.shift_preference || 'morning');
      
      // Optional fields
      if (employeeData.middle_name) formattedData.append('middle_name', employeeData.middle_name);
      if (employeeData.address) formattedData.append('address', employeeData.address);
      if (employeeData.city) formattedData.append('city', employeeData.city);
      if (employeeData.state) formattedData.append('state', employeeData.state);
      if (employeeData.postal_code) formattedData.append('postal_code', employeeData.postal_code);
      if (employeeData.country) formattedData.append('country', employeeData.country);
      if (employeeData.monthly_salary) formattedData.append('monthly_salary', employeeData.monthly_salary.toString());
      if (employeeData.emergency_contact) formattedData.append('emergency_contact', employeeData.emergency_contact);
      if (employeeData.emergency_relation) formattedData.append('emergency_relation', employeeData.emergency_relation);
      if (employeeData.emergency_phone) formattedData.append('emergency_phone', employeeData.emergency_phone);
      if (employeeData.sss) formattedData.append('sss', employeeData.sss);
      if (employeeData.philhealth) formattedData.append('philhealth', employeeData.philhealth);
      if (employeeData.pagibig) formattedData.append('pagibig', employeeData.pagibig);
      if (employeeData.tin) formattedData.append('tin', employeeData.tin);
      if (employeeData.bank_name) formattedData.append('bank_name', employeeData.bank_name);
      if (employeeData.bank_account) formattedData.append('bank_account', employeeData.bank_account);
      if (employeeData.birth_date) formattedData.append('birth_date', employeeData.birth_date);
      if (employeeData.gender) formattedData.append('gender', employeeData.gender);
      if (employeeData.notes) formattedData.append('notes', employeeData.notes);
      
      // Skills, certifications, achievements
      if (employeeData.skills) {
        const skillsArray = employeeData.skills.split(',').map(s => s.trim()).filter(s => s);
        if (skillsArray.length > 0) formattedData.append('skills', JSON.stringify(skillsArray));
      }
      if (employeeData.certifications) {
        const certsArray = employeeData.certifications.split(',').map(s => s.trim()).filter(s => s);
        if (certsArray.length > 0) formattedData.append('certifications', JSON.stringify(certsArray));
      }
      if (employeeData.achievements) {
        const achievementsArray = employeeData.achievements.split(',').map(s => s.trim()).filter(s => s);
        if (achievementsArray.length > 0) formattedData.append('achievements', JSON.stringify(achievementsArray));
      }
      
      // Image upload
      if (imageFile) {
        formattedData.append('profile_photo', imageFile, imageFile.name);
      }
      
      const response = await staffAPI.createEmployee(formattedData);
      const newEmployee = response.data.data || response.data;
      
      setEmployees(prev => [...prev, newEmployee]);
      setShowSuccessAnimation(true);
      setTimeout(() => setShowSuccessAnimation(false), 2000);
      showNotificationMessage('Staff member added successfully', 'success');
      closeModal();
      fetchStats();
      fetchArchivedEmployees();
      return true;
      
    } catch (err) {
      console.error('Error creating employee:', err);
      const errorResponse = handleApiError(err);
      
      if (errorResponse.status === 422) {
        const serverErrors = errorResponse.errors || {};
        setFormErrors(serverErrors);
        const newTouched = {};
        Object.keys(serverErrors).forEach(key => { newTouched[key] = true; });
        setTouchedFields(prev => ({ ...prev, ...newTouched }));
        showNotificationMessage(Object.values(serverErrors).flat().join(' | '), 'error');
      } else {
        showNotificationMessage(errorResponse.message, 'error');
      }
      return false;
    } finally {
      setLoading(false);
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  // Update employee
  const updateEmployee = async (id, employeeData) => {
    if (!validateForm()) {
      showNotificationMessage('Please fill in all required fields', 'error');
      return false;
    }
    
    if (isSubmitting) return false;
    setIsSubmitting(true);
    setLoading(true);
    
    try {
      const formattedData = new FormData();
      formattedData.append('_method', 'PUT');
      
      // Add all fields
      const fields = {
        first_name: employeeData.first_name?.trim() || '',
        last_name: employeeData.last_name?.trim() || '',
        middle_name: employeeData.middle_name?.trim() || '',
        email: employeeData.email?.trim() || '',
        phone: employeeData.phone?.trim() || '',
        department_id: employeeData.department_id || '',
        position_id: employeeData.position_id || '',
        employee_type: employeeData.employee_type || 'regular',
        status: employeeData.status || 'active',
        shift_preference: employeeData.shift_preference || 'morning',
        hire_date: employeeData.hire_date || '',
        address: employeeData.address?.trim() || '',
        city: employeeData.city?.trim() || '',
        state: employeeData.state?.trim() || '',
        postal_code: employeeData.postal_code?.trim() || '',
        country: employeeData.country?.trim() || 'Philippines',
        monthly_salary: employeeData.monthly_salary || 0,
        emergency_contact: employeeData.emergency_contact?.trim() || '',
        emergency_relation: employeeData.emergency_relation?.trim() || '',
        emergency_phone: employeeData.emergency_phone?.trim() || '',
        sss: employeeData.sss?.trim() || '',
        philhealth: employeeData.philhealth?.trim() || '',
        pagibig: employeeData.pagibig?.trim() || '',
        tin: employeeData.tin?.trim() || '',
        bank_name: employeeData.bank_name?.trim() || '',
        bank_account: employeeData.bank_account?.trim() || '',
        birth_date: employeeData.birth_date || '',
        gender: employeeData.gender || '',
        notes: employeeData.notes?.trim() || ''
      };
      
      Object.keys(fields).forEach(key => {
        if (fields[key] !== null && fields[key] !== undefined) {
          formattedData.append(key, String(fields[key]));
        }
      });
      
      // Skills, certifications, achievements
      if (employeeData.skills) {
        const skillsArray = employeeData.skills.split(',').map(s => s.trim()).filter(s => s);
        if (skillsArray.length > 0) formattedData.append('skills', JSON.stringify(skillsArray));
      }
      if (employeeData.certifications) {
        const certsArray = employeeData.certifications.split(',').map(s => s.trim()).filter(s => s);
        if (certsArray.length > 0) formattedData.append('certifications', JSON.stringify(certsArray));
      }
      if (employeeData.achievements) {
        const achievementsArray = employeeData.achievements.split(',').map(s => s.trim()).filter(s => s);
        if (achievementsArray.length > 0) formattedData.append('achievements', JSON.stringify(achievementsArray));
      }
      
      if (imageFile) {
        formattedData.append('profile_photo', imageFile, imageFile.name);
      }
      
      const response = await staffAPI.updateEmployee(id, formattedData);
      const updatedEmployee = response.data.data || response.data;
      
      setEmployees(prev => prev.map(emp => 
        (emp.id === id || emp.employee_id === id) ? updatedEmployee : emp
      ));
      
      showNotificationMessage('Staff member updated successfully', 'success');
      closeModal();
      fetchStats();
      fetchArchivedEmployees();
      return true;
      
    } catch (err) {
      console.error('Error updating employee:', err);
      const errorResponse = handleApiError(err);
      
      if (errorResponse.status === 422) {
        const serverErrors = errorResponse.errors || {};
        setFormErrors(serverErrors);
        const newTouched = {};
        Object.keys(serverErrors).forEach(key => { newTouched[key] = true; });
        setTouchedFields(prev => ({ ...prev, ...newTouched }));
        showNotificationMessage(errorResponse.errorMessages?.join(' | ') || 'Validation failed', 'error');
      } else {
        showNotificationMessage(errorResponse.message, 'error');
      }
      return false;
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  // Archive employee
  const archiveEmployee = async (id) => {
    setLoading(true);
    try {
      await staffAPI.bulkArchive({ employee_ids: [id] });
      setEmployees(prev => prev.filter(emp => emp.id !== id && emp.employee_id !== id));
      await fetchArchivedEmployees();
      showNotificationMessage('Staff member archived successfully', 'info');
      fetchStats();
    } catch (err) {
      console.error('Error archiving employee:', err);
      showNotificationMessage(handleApiError(err).message, 'error');
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
      setEmployeeToDelete(null);
    }
  };

  // Restore employee
  const restoreEmployee = async (id) => {
    setLoading(true);
    try {
      await staffAPI.bulkUpdateStatus({ employee_ids: [id], status: 'active' });
      setArchivedEmployees(prev => prev.filter(emp => emp.id !== id && emp.employee_id !== id));
      await fetchEmployees();
      showNotificationMessage('Staff member restored successfully', 'success');
      fetchStats();
    } catch (err) {
      console.error('Error restoring employee:', err);
      showNotificationMessage(handleApiError(err).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Permanently delete
  const permanentlyDeleteFromArchive = async (employeeId) => {
    setLoading(true);
    try {
      await staffAPI.deleteEmployee(employeeId);
      setArchivedEmployees(prev => prev.filter(emp => emp.id !== employeeId && emp.employee_id !== employeeId));
      showNotificationMessage('Employee permanently deleted', 'warning');
    } catch (err) {
      console.error('Error deleting employee:', err);
      showNotificationMessage(handleApiError(err).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Update status
  const updateEmployeeStatus = async (id, status) => {
    setLoading(true);
    try {
      await staffAPI.bulkUpdateStatus({ employee_ids: [id], status });
      if (status === 'inactive') {
        setEmployees(prev => prev.filter(emp => emp.id !== id && emp.employee_id !== id));
        await fetchArchivedEmployees();
        showNotificationMessage('Staff member archived successfully', 'info');
      } else {
        setEmployees(prev => prev.map(emp => 
          (emp.id === id || emp.employee_id === id) ? { ...emp, status } : emp
        ));
        showNotificationMessage(`Status updated to ${status}`, 'success');
      }
      fetchStats();
    } catch (err) {
      console.error('Error updating status:', err);
      showNotificationMessage(handleApiError(err).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Bulk operations
  const bulkDeleteEmployees = async (ids) => {
    setLoading(true);
    try {
      await staffAPI.bulkDeleteEmployees({ employee_ids: ids });
      setEmployees(prev => prev.filter(emp => !ids.includes(emp.id) && !ids.includes(emp.employee_id)));
      setSelectedEmployees([]);
      showNotificationMessage(`${ids.length} staff member(s) deleted permanently`, 'warning');
      fetchStats();
    } catch (err) {
      console.error('Error bulk deleting employees:', err);
      showNotificationMessage(handleApiError(err).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const bulkArchiveEmployees = async (ids) => {
    setLoading(true);
    try {
      await staffAPI.bulkArchive({ employee_ids: ids });
      setEmployees(prev => prev.filter(emp => !ids.includes(emp.id) && !ids.includes(emp.employee_id)));
      await fetchArchivedEmployees();
      setSelectedEmployees([]);
      showNotificationMessage(`${ids.length} staff member(s) archived successfully`, 'info');
      fetchStats();
    } catch (err) {
      console.error('Error bulk archiving employees:', err);
      showNotificationMessage(handleApiError(err).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const bulkUpdateStatus = async (ids, status) => {
    setLoading(true);
    try {
      await staffAPI.bulkUpdateStatus({ employee_ids: ids, status });
      if (status === 'inactive') {
        setEmployees(prev => prev.filter(emp => !ids.includes(emp.id) && !ids.includes(emp.employee_id)));
        await fetchArchivedEmployees();
      } else {
        setEmployees(prev => prev.map(emp => 
          ids.includes(emp.id) || ids.includes(emp.employee_id) ? { ...emp, status } : emp
        ));
      }
      setSelectedEmployees([]);
      showNotificationMessage(`Status updated for ${ids.length} staff members`, 'success');
      fetchStats();
    } catch (err) {
      console.error('Error bulk updating status:', err);
      showNotificationMessage(handleApiError(err).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBookmark = async (employeeId) => {
    try {
      const employee = employees.find(emp => emp.id === employeeId || emp.employee_id === employeeId);
      if (!employee) return;
      await staffAPI.toggleBookmark(employeeId);
      setEmployees(prev => prev.map(emp =>
        (emp.id === employeeId || emp.employee_id === employeeId) 
          ? { ...emp, is_bookmarked: !emp.is_bookmarked } : emp
      ));
      showNotificationMessage(`${employee.first_name} ${employee.last_name} ${!employee.is_bookmarked ? 'added to' : 'removed from'} bookmarks`, 'success');
    } catch (err) {
      console.error('Error updating bookmark:', err);
      showNotificationMessage(handleApiError(err).message, 'error');
    }
  };

  // Import/Export
  const importEmployees = async (file) => {
    if (!file) {
      showNotificationMessage('Please select a file to import', 'error');
      return;
    }
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await staffAPI.uploadDocument(formData);
      await fetchEmployees();
      await fetchArchivedEmployees();
      showNotificationMessage('Import completed successfully', 'success');
      setShowImportModal(false);
      setSelectedFile(null);
      setImagePreview(null);
    } catch (err) {
      console.error('Error importing employees:', err);
      showNotificationMessage(handleApiError(err).message, 'error');
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const exportEmployees = async (format) => {
    setLoading(true);
    try {
      const response = await staffAPI.getEmployees({ export: format, all: true });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `employees_export.${format.toLowerCase()}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showNotificationMessage(`Export as ${format} completed`, 'success');
      setShowExportModal(false);
    } catch (err) {
      console.error('Error exporting employees:', err);
      showNotificationMessage(handleApiError(err).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const refreshDropdownData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchDepartments(), fetchPositions()]);
      showNotificationMessage('Dropdown data refreshed', 'success');
    } catch (error) {
      console.error('Error refreshing dropdown data:', error);
      showNotificationMessage('Failed to refresh dropdown data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotificationMessage = (message, type = 'success') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  const resetForm = () => {
    setFormData({
      first_name: '', last_name: '', middle_name: '', position_id: '', email: '',
      phone: '', address: '', city: '', state: '', postal_code: '', country: 'Philippines',
      department_id: '', employee_type: 'regular', status: 'active', shift_preference: 'morning',
      hire_date: '', monthly_salary: '', emergency_contact: '', emergency_relation: '',
      emergency_phone: '', sss: '', philhealth: '', pagibig: '', tin: '', skills: '',
      certifications: '', achievements: '', notes: '', profile_photo: null,
      bank_name: '', bank_account: '', birth_date: '', gender: ''
    });
    setFormErrors({});
    setTouchedFields({});
    setSelectedFile(null);
    setImagePreview(null);
    setImageFile(null);
    setUploadProgress(0);
    setFormStep(1);
    setIsSubmitting(false);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
    setSelectedEmployee(null);
    setModalMode('add');
  };

  // Statistics
  const statistics = [
    { label: 'Total Staff', value: statsData.total_employees || employees.length, icon: <TeamOutlined />, change: `${statsData.regular || 0} regular`, color: '#1e3a8a', bgColor: '#e6f0ff' },
    { label: 'Active Today', value: statsData.active || employees.filter(e => e?.status === 'active').length, icon: <CheckCircleOutlined />, change: 'On Duty', color: '#059669', bgColor: '#e6f7e6' },
    { label: 'On Leave', value: statsData.on_leave || employees.filter(e => e?.status === 'onleave').length, icon: <ClockCircleOutlined />, change: 'This week', color: '#d97706', bgColor: '#fff3e0' },
    { label: 'Archived', value: archivedEmployees.length, icon: <InboxOutlined />, change: 'Inactive staff', color: '#6b7280', bgColor: '#f3f4f6' },
  ];

  const quickActions = [
    { icon: <CalendarOutlined />, label: 'Schedule', action: () => setShowScheduleModal(true) },
    { icon: <ClockCircleOutlined />, label: 'Attendance', action: () => setShowAttendanceModal(true) },
    { icon: <DollarOutlined />, label: 'Payroll', action: () => setShowPayrollModal(true) },
    { icon: <SafetyOutlined />, label: 'Compliance', action: () => setShowComplianceModal(true) },
    { icon: <HeartOutlined />, label: 'Benefits', action: () => setShowBenefitsModal(true) },
    { icon: <FileTextOutlined />, label: 'Reports', action: () => setShowReportsModal(true) },
    { icon: <ScheduleOutlined />, label: 'Shifts', action: () => setShowShiftsModal(true) },
    { icon: <HistoryOutlined />, label: 'Archive', action: () => setShowArchive(!showArchive) }
  ];

  // Filter and sort employees
  const filteredEmployees = (employees || []).filter(emp => {
    if (!emp) return false;
    const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
    const searchLower = (searchQuery || '').toLowerCase();
    const matchesSearch = searchQuery === '' || fullName.includes(searchLower) ||
      (emp.employee_id?.toString() || '').toLowerCase().includes(searchLower) ||
      (emp.department?.name || '').toLowerCase().includes(searchLower) ||
      (emp.position?.title || '').toLowerCase().includes(searchLower) ||
      (emp.email || '').toLowerCase().includes(searchLower) ||
      (emp.phone || '').includes(searchQuery);
    const matchesDepartment = selectedDepartment === 'all' || emp.department_id === parseInt(selectedDepartment) || emp.department?.id === parseInt(selectedDepartment);
    const matchesStatus = selectedStatus === 'all' || emp.status === selectedStatus;
    const matchesShift = selectedShift === 'all' || emp.shift_preference === selectedShift;
    const matchesTab = selectedTab === 'all' ||
      (selectedTab === 'regular' && emp.employee_type === 'regular') ||
      (selectedTab === 'oncall' && emp.employee_type === 'oncall') ||
      (selectedTab === 'active' && emp.status === 'active') ||
      (selectedTab === 'onleave' && emp.status === 'onleave') ||
      (selectedTab === 'bookmarked' && emp.is_bookmarked);
    return matchesSearch && matchesDepartment && matchesStatus && matchesShift && matchesTab;
  });

  const sortedEmployees = [...filteredEmployees].sort((a, b) => {
    if (sortConfig.key) {
      let aValue, bValue;
      if (sortConfig.key === 'name') {
        aValue = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase();
        bValue = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase();
      } else if (sortConfig.key === 'department_id') {
        aValue = a.department?.name || '';
        bValue = b.department?.name || '';
      } else if (sortConfig.key === 'position') {
        aValue = a.position?.title || '';
        bValue = b.position?.title || '';
      } else {
        aValue = a[sortConfig.key] || '';
        bValue = b[sortConfig.key] || '';
      }
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const totalPages = Math.ceil(sortedEmployees.length / pageSize);
  const paginatedEmployees = sortedEmployees.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Handlers
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleInputChange = (e) => {
    const { name, value, type, files } = e.target;
    
    if (type === 'file') {
      const file = files[0];
      if (file) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
          showNotificationMessage('Only JPG, PNG images are allowed', 'error');
          return;
        }
        
        if (file.size > 2 * 1024 * 1024) {
          showNotificationMessage('Image size must be less than 2MB', 'error');
          return;
        }
        
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result);
        };
        reader.readAsDataURL(file);
        
        setImageFile(file);
        setFormData(prev => ({ ...prev, [name]: file }));
        setSelectedFile(file);
        
        setUploadProgress(0);
        const interval = setInterval(() => {
          setUploadProgress(prev => {
            if (prev >= 100) {
              clearInterval(interval);
              return 100;
            }
            return prev + 10;
          });
        }, 100);
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
      if (formErrors[name]) {
        setFormErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
      }
    }
  };

  const handleAddEmployee = () => {
    resetForm();
    setSelectedEmployee(null);
    setModalMode('add');
    setFormStep(1);
    setShowModal(true);
  };

  const handleEditEmployee = (employee) => {
    setSelectedEmployee(employee);
    setModalMode('edit');
    setFormStep(1);
    setFormData({
      first_name: employee.first_name || '', last_name: employee.last_name || '',
      middle_name: employee.middle_name || '', position_id: employee.position?.id || employee.position_id || '',
      email: employee.email || '', phone: employee.phone || '', address: employee.address || '',
      city: employee.city || '', state: employee.state || '', postal_code: employee.postal_code || '',
      country: employee.country || 'Philippines', department_id: employee.department?.id || employee.department_id || '',
      employee_type: employee.employee_type || 'regular', status: employee.status || 'active',
      shift_preference: employee.shift_preference || 'morning', hire_date: employee.hire_date || '',
      monthly_salary: employee.monthly_salary || '', emergency_contact: employee.emergency_contact || '',
      emergency_relation: employee.emergency_relation || '', emergency_phone: employee.emergency_phone || '',
      sss: employee.sss || '', philhealth: employee.philhealth || '', pagibig: employee.pagibig || '',
      tin: employee.tin || '', skills: Array.isArray(employee.skills) ? employee.skills.join(', ') : (employee.skills || ''),
      certifications: Array.isArray(employee.certifications) ? employee.certifications.join(', ') : (employee.certifications || ''),
      achievements: Array.isArray(employee.achievements) ? employee.achievements.join(', ') : (employee.achievements || ''),
      notes: employee.notes || '', profile_photo: null,
      bank_name: employee.bank_name || '', bank_account: employee.bank_account || '',
      birth_date: employee.birth_date || '', gender: employee.gender || ''
    });
    setSelectedFile(null);
    setImageFile(null);
    setImagePreview(employee.profile_photo ? getImageUrl(employee.profile_photo) : null);
    setFormErrors({});
    setTouchedFields({});
    setUploadProgress(0);
    setShowModal(true);
  };

  const handleViewEmployee = (employee) => {
    setSelectedEmployee(employee);
    setModalMode('view');
    setShowModal(true);
  };

  const handleSaveEmployee = async () => {
    if (modalMode === 'add') await createEmployee(formData);
    else if (modalMode === 'edit' && selectedEmployee) {
      await updateEmployee(selectedEmployee.id || selectedEmployee.employee_id, formData);
    }
  };

  const handleArchiveClick = (employee) => {
    setEmployeeToDelete(employee);
    setShowDeleteConfirm(true);
  };

  const confirmArchive = async () => {
    if (employeeToDelete) await archiveEmployee(employeeToDelete.id || employeeToDelete.employee_id);
  };

  const handleSelectAll = () => {
    if (selectedEmployees.length === paginatedEmployees.length) setSelectedEmployees([]);
    else setSelectedEmployees(paginatedEmployees.map(emp => emp.id || emp.employee_id));
  };

  const handleSelectEmployee = (employeeId) => {
    if (selectedEmployees.includes(employeeId)) setSelectedEmployees(selectedEmployees.filter(id => id !== employeeId));
    else setSelectedEmployees([...selectedEmployees, employeeId]);
  };

  const handleNextStep = () => {
    if (formStep === 1) {
      if (validateStep1()) {
        setFormStep(prev => prev + 1);
      } else {
        showNotificationMessage('Please fill in all required fields in Personal Information', 'error');
      }
    } else if (formStep === 2) {
      if (validateStep2()) {
        setFormStep(prev => prev + 1);
      } else {
        showNotificationMessage('Please fill in all required fields in Employment Details', 'error');
      }
    } else {
      setFormStep(prev => prev + 1);
    }
  };
  
  const handlePrevStep = () => setFormStep(prev => prev - 1);
  const handleBulkDelete = async () => await bulkDeleteEmployees(selectedEmployees);
  const handleBulkArchive = async () => await bulkArchiveEmployees(selectedEmployees);
  const handleBulkStatusUpdate = async (status) => await bulkUpdateStatus(selectedEmployees, status);
  const handleExport = (format) => exportEmployees(format);
  const handleImport = () => importEmployees(selectedFile);
  const handlePrint = () => { setShowPrintModal(false); showNotificationMessage('Preparing print preview...', 'info'); setTimeout(() => window.print(), 1000); };
  const handleShare = (method) => { setShowShareModal(false); showNotificationMessage(`Shared via ${method}`, 'success'); };
  const handleSchedule = (action) => { setShowScheduleModal(false); showNotificationMessage(`Schedule ${action}`, 'success'); };
  const handleAttendance = (action) => { setShowAttendanceModal(false); showNotificationMessage(`Attendance ${action}`, 'success'); };
  const handlePayroll = (action) => { setShowPayrollModal(false); showNotificationMessage(`Payroll ${action}`, 'success'); };
  const handleCompliance = (action) => { setShowComplianceModal(false); showNotificationMessage(`Compliance ${action}`, 'success'); };
  const handleBenefits = (action) => { setShowBenefitsModal(false); showNotificationMessage(`Benefits ${action}`, 'success'); };
  const handleReports = (action) => { setShowReportsModal(false); showNotificationMessage(`Report ${action}`, 'success'); };
  const handleShifts = (action) => { setShowShiftsModal(false); showNotificationMessage(`Shifts ${action}`, 'success'); };
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); setShowFullscreen(true); }
    else { if (document.exitFullscreen) { document.exitFullscreen(); setShowFullscreen(false); } }
  };
  const handleSearch = (query) => { setSearchQuery(query); setCurrentPage(1); if (query && !searchHistory.includes(query)) setSearchHistory(prev => [query, ...prev].slice(0, 5)); fetchEmployees(); };
  const clearSearch = () => { setSearchQuery(''); setShowSearchHistory(false); fetchEmployees(); };
  const getPerformanceColor = (score) => { if (score >= 90) return 'success'; if (score >= 75) return 'warning'; return 'danger'; };
  const getStatusBadge = (status) => {
    switch(status) {
      case 'active': return <span className="catering-status-badge active" title="Active" />;
      case 'inactive': return <span className="catering-status-badge inactive" title="Inactive" />;
      case 'onleave': return <span className="catering-status-badge onleave" title="On Leave" />;
      default: return null;
    }
  };

  const StatusControls = ({ employee }) => (
    <div className="catering-status-controls">
      <h3><ClockCircleOutlined /> Staff Status</h3>
      <div className="catering-status-buttons">
        <button className={`catering-status-btn ${employee.status === 'active' ? 'active' : ''}`}
          onClick={() => updateEmployeeStatus(employee.id || employee.employee_id, 'active')} disabled={loading}>
          <CheckCircleOutlined /> Active
        </button>
        <button className={`catering-status-btn ${employee.status === 'onleave' ? 'onleave' : ''}`}
          onClick={() => updateEmployeeStatus(employee.id || employee.employee_id, 'onleave')} disabled={loading}>
          <PauseCircleOutlined /> On Leave
        </button>
        <button className={`catering-status-btn ${employee.status === 'inactive' ? 'inactive' : ''}`}
          onClick={() => handleArchiveClick(employee)} disabled={loading}>
          <InboxOutlined /> Archive
        </button>
      </div>
      <p className="catering-status-note">
        Current Status: <strong>
          {employee.status === 'active' ? 'Active' : 
           employee.status === 'onleave' ? 'On Leave' : 
           employee.status === 'inactive' ? 'Archived' : 'Unknown'}
        </strong>
      </p>
    </div>
  );

  const ArchiveSection = () => (
    <div className="catering-archive-section">
      <div className="catering-archive-header">
        <h3><InboxOutlined /> Archived Staff</h3>
        <span className="catering-archive-count">{archivedEmployees.length} archived</span>
        <button className="catering-archive-close" onClick={() => setShowArchive(false)}><CloseOutlined /></button>
      </div>
      {loading ? (
        <div className="catering-loading-spinner"><LoadingOutlined spin /> Loading archived staff...</div>
      ) : archivedEmployees.length > 0 ? (
        <div className="catering-archive-list">
          {archivedEmployees.map((emp) => (
            <div key={emp.id || emp.employee_id} className="catering-archive-item">
              <div className="catering-archive-item-info">
                <div className="catering-archive-avatar">
                  {emp.profile_photo ? (
                    <img src={getImageUrl(emp.profile_photo)} alt={emp.first_name} 
                      style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                      onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'; }} />
                  ) : null}
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e5e7eb', 
                    display: emp.profile_photo ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 'bold', color: '#6b7280' }}>
                    {emp.first_name?.[0] || ''}{emp.last_name?.[0] || ''}
                  </div>
                </div>
                <div className="catering-archive-details">
                  <h4>{emp.first_name} {emp.last_name}</h4>
                  <p><span>{emp.position?.title}</span><span>•</span><span>{emp.department?.name}</span></p>
                  <small>Archived on: {new Date(emp.updated_at).toLocaleDateString()}</small>
                </div>
              </div>
              <div className="catering-archive-actions">
                <button className="catering-archive-restore-btn" onClick={() => restoreEmployee(emp.id || emp.employee_id)} disabled={loading}>
                  <RestOutlined /> Restore
                </button>
                <button className="catering-archive-delete-btn" onClick={() => permanentlyDeleteFromArchive(emp.id || emp.employee_id)} disabled={loading}>
                  <DeleteIcon /> Delete Permanently
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="catering-archive-empty">
          <div className="catering-archive-empty-icon"><InboxOutlined /></div>
          <p>No archived staff members</p>
        </div>
      )}
    </div>
  );

  const Notification = () => (
    <div className={`catering-notification ${notificationType}`}>
      <div className="catering-notification-icon">
        {notificationType === 'success' && <CheckCircleOutlined />}
        {notificationType === 'error' && <WarningOutlined />}
        {notificationType === 'warning' && <WarningOutlined />}
        {notificationType === 'info' && <ExclamationCircleOutlined />}
      </div>
      <div className="catering-notification-message">{notificationMessage}</div>
      <button className="catering-notification-close" onClick={() => setShowNotification(false)}><CloseOutlined /></button>
    </div>
  );

  const LoadingSpinner = () => (
    <div className="catering-loading-overlay"><LoadingOutlined spin style={{ fontSize: 40 }} /><p>Loading...</p></div>
  );

  if (authChecking) {
    return (<div className="catering-layout"><div className="catering-loading-overlay"><LoadingOutlined spin style={{ fontSize: 40 }} /><p>Checking authentication...</p></div></div>);
  }

  if (!isAuthenticated) {
    return (<div className="catering-layout"><div className="catering-auth-required"><div className="catering-auth-card"><h2>Authentication Required</h2><p>Please log in to access the staff management system.</p><button className="catering-btn catering-btn-primary" onClick={() => window.location.href = '/login'}>Go to Login</button></div></div></div>);
  }

  return (
    <div className="catering-layout">
      {loading && <LoadingSpinner />}
      
      {/* Header */}
      <header className="catering-header">
        <div className="catering-logo">
          <div className="catering-logo-icon"><CoffeeOutlined /></div>
          <div className="catering-logo-text"><h1>Catering Staff Management</h1><span>Enterprise System</span></div>
        </div>
        <div className="catering-header-right">
          <div className="catering-date"><CalendarOutlined /><span>{currentDate}</span></div>
          <div className="catering-search">
            <SearchOutlined className="catering-search-icon" />
            <input type="text" className="catering-search-input" placeholder="Search by name, ID, department..." value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)} onFocus={() => setShowSearchHistory(true)}
              onBlur={() => setTimeout(() => setShowSearchHistory(false), 200)} />
            {searchQuery && <button className="catering-search-clear" onClick={clearSearch}><CloseOutlined /></button>}
            {showSearchHistory && searchHistory.length > 0 && (<div className="catering-search-history">
              {searchHistory.map((query, index) => (<div key={index} className="catering-search-history-item" onClick={() => handleSearch(query)}><HistoryOutlined /> {query}</div>))}
            </div>)}
          </div>
          <button className="catering-header-icon" onClick={toggleFullscreen} title={showFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}>
            {showFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
          </button>
          <button className="catering-header-icon" onClick={fetchAllData} title="Refresh Data"><ReloadOutlined /></button>
          <div className="catering-user-info">
            <span className="catering-user-name">{currentUser?.name || 'User'}</span>
            <button className="catering-header-icon" onClick={logout} title="Logout"><UserOutlined /></button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="catering-main">
        {/* Statistics */}
        <div className="catering-stats-grid">
          {statistics.map((stat, index) => (
            <div key={index} className="catering-stat-card">
              <div className="catering-stat-icon" style={{ background: stat.bgColor, color: stat.color }}>{stat.icon}</div>
              <div className="catering-stat-content"><h3>{stat.value}</h3><span>{stat.label}</span></div>
              <span className="catering-stat-change">{stat.change}</span>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="catering-quick-actions">
          {quickActions.map((action, index) => (
            <div key={index} className="catering-quick-action" onClick={action.action}>
              <div className="catering-quick-icon">{action.icon}</div>
              <span>{action.label}</span>
            </div>
          ))}
        </div>

        {showArchive && <ArchiveSection />}

        {/* Filters */}
        <div className="catering-filters">
          <div className="catering-filter-tabs">
            <button className={`catering-filter-tab ${selectedTab === 'all' ? 'active' : ''}`} onClick={() => { setSelectedTab('all'); fetchEmployees(); }}>All Staff</button>
            <button className={`catering-filter-tab ${selectedTab === 'active' ? 'active' : ''}`} onClick={() => { setSelectedTab('active'); fetchEmployees(); }}>Active</button>
            <button className={`catering-filter-tab ${selectedTab === 'onleave' ? 'active' : ''}`} onClick={() => { setSelectedTab('onleave'); fetchEmployees(); }}>On Leave</button>
            <button className={`catering-filter-tab ${selectedTab === 'regular' ? 'active' : ''}`} onClick={() => { setSelectedTab('regular'); fetchEmployees(); }}>Regular</button>
            <button className={`catering-filter-tab ${selectedTab === 'oncall' ? 'active' : ''}`} onClick={() => { setSelectedTab('oncall'); fetchEmployees(); }}>On Call</button>
            <button className={`catering-filter-tab ${selectedTab === 'bookmarked' ? 'active' : ''}`} onClick={() => { setSelectedTab('bookmarked'); fetchEmployees(); }}><StarOutlined /> Bookmarked</button>
          </div>

          <select className="catering-filter-select" value={selectedDepartment} onChange={(e) => { setSelectedDepartment(e.target.value); fetchEmployees(); }}>
            <option value="all">All Departments</option>
            {departments.map(dept => (<option key={dept.id} value={dept.id}>{dept.name}</option>))}
          </select>

          <select className="catering-filter-select" value={selectedStatus} onChange={(e) => { setSelectedStatus(e.target.value); fetchEmployees(); }}>
            <option value="all">All Status</option><option value="active">Active</option><option value="onleave">On Leave</option>
          </select>

          <select className="catering-filter-select" value={selectedShift} onChange={(e) => { setSelectedShift(e.target.value); fetchEmployees(); }}>
            <option value="all">All Shifts</option><option value="morning">Morning (6AM-2PM)</option><option value="afternoon">Afternoon (2PM-10PM)</option>
            <option value="evening">Evening (6PM-2AM)</option><option value="night">Night (10PM-6AM)</option><option value="flexible">Flexible</option>
          </select>

          <button className="catering-toolbar-btn" onClick={refreshDropdownData} title="Refresh Departments & Positions"><ReloadOutlined /> Refresh Data</button>
          <button className={`catering-toolbar-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}><FilterOutlined /> Advanced Filters</button>
          <button className="catering-toolbar-btn" onClick={() => setShowColumnSelector(!showColumnSelector)}><ColumnHeightOutlined /> Columns</button>
          <button className="catering-toolbar-btn" onClick={() => handleSort('name')}>{sortConfig.key === 'name' && sortConfig.direction === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />} Sort</button>
          <button className="catering-toolbar-btn" onClick={() => setShowExportModal(true)}><ExportOutlined /> Export</button>
          <button className="catering-toolbar-btn" onClick={() => setShowImportModal(true)}><UploadOutlined /> Import</button>
          <button className="catering-toolbar-btn" onClick={() => setShowPrintModal(true)}><PrinterOutlined /> Print</button>
          <button className="catering-toolbar-btn" onClick={() => setShowShareModal(true)}><ShareAltOutlined /> Share</button>
          
          <div className="catering-badge-group">
            <span className="catering-badge"><ReloadOutlined /> Live</span>
            <span className="catering-badge"><strong>{filteredEmployees.length}</strong> / {employees.length}</span>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="catering-advanced-filters">
            <div className="catering-filter-group"><label>Performance Range</label><div className="catering-range-slider"><input type="range" min="0" max="100" defaultValue="80" /><span>80% - 100%</span></div></div>
            <div className="catering-filter-group"><label>Salary Range</label><div className="catering-range-slider"><input type="range" min="0" max="100000" defaultValue="50000" /><span>₱50k - ₱100k</span></div></div>
            <div className="catering-filter-group"><label>Hire Date</label><select className="catering-filter-select"><option>Last 30 days</option><option>Last 90 days</option><option>Last 6 months</option><option>Last year</option></select></div>
            <div className="catering-filter-group"><label>Skills</label><div className="catering-filter-chips"><span className="catering-filter-chip">Management</span><span className="catering-filter-chip">Cooking</span><span className="catering-filter-chip">Baking</span><span className="catering-filter-chip">Planning</span></div></div>
          </div>
        )}

        {/* Column Selector */}
        {showColumnSelector && (
          <div className="catering-column-selector">
            <h4>Visible Columns</h4>
            {Object.keys(visibleColumns).map(key => (<label key={key} className="catering-checkbox-label"><input type="checkbox" checked={visibleColumns[key]} onChange={() => setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }))} />{key.charAt(0).toUpperCase() + key.slice(1)}</label>))}
          </div>
        )}

        {/* Bulk Actions */}
        {selectedEmployees.length > 0 && (
          <div className="catering-bulk-actions-bar">
            <span className="catering-bulk-count">{selectedEmployees.length} selected</span>
            <button className="catering-bulk-action" onClick={() => handleBulkStatusUpdate('active')}><CheckCircleOutlined /> Set Active</button>
            <button className="catering-bulk-action" onClick={() => handleBulkStatusUpdate('onleave')}><PauseCircleOutlined /> Set On Leave</button>
            <button className="catering-bulk-action" onClick={handleBulkArchive}><InboxOutlined /> Archive</button>
            <button className="catering-bulk-action" onClick={handleBulkDelete}><DeleteOutlined /> Delete Permanently</button>
            <button className="catering-bulk-close" onClick={() => setSelectedEmployees([])}><CloseOutlined /></button>
          </div>
        )}

        {error && (<div className="catering-error-message"><WarningOutlined /> {error}<button onClick={fetchEmployees}>Retry</button></div>)}

        {/* Table Card */}
        <div className="catering-table-card">
          <div className="catering-table-header">
            <div className="catering-table-title"><h2>Staff Directory</h2><span className="catering-table-count">{employees.length} Total</span><span className="catering-table-badge"><TeamOutlined /> {filteredEmployees.length} Visible</span></div>
            <div className="catering-table-actions">
              <button className="catering-btn" onClick={() => setShowReportsModal(true)}><BarChartOutlined /> Analytics</button>
              <button className="catering-btn" onClick={() => setShowReportsModal(true)}><FileTextOutlined /> Reports</button>
              <button className="catering-btn catering-btn-primary" onClick={handleAddEmployee}><PlusOutlined /> Add Staff</button>
            </div>
          </div>

          <div className="catering-table-container">
            <table className="catering-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}><input type="checkbox" checked={selectedEmployees.length === paginatedEmployees.length && paginatedEmployees.length > 0} onChange={handleSelectAll} disabled={loading} /></th>
                  {visibleColumns.employee && <th onClick={() => handleSort('name')}>Employee {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>}
                  {visibleColumns.department && <th onClick={() => handleSort('department_id')}>Department {sortConfig.key === 'department_id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>}
                  {visibleColumns.position && <th onClick={() => handleSort('position')}>Position {sortConfig.key === 'position' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>}
                  {visibleColumns.status && <th onClick={() => handleSort('status')}>Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>}
                  {visibleColumns.shift && <th onClick={() => handleSort('shift_preference')}>Shift {sortConfig.key === 'shift_preference' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>}
                  {visibleColumns.performance && <th onClick={() => handleSort('performance')}>Performance {sortConfig.key === 'performance' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>}
                  {visibleColumns.contact && <th>Contact</th>}
                  {visibleColumns.actions && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading && paginatedEmployees.length === 0 ? (
                  <tr><td colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="catering-table-loading"><LoadingOutlined spin /> Loading staff data...</td></tr>
                ) : paginatedEmployees.length > 0 ? (
                  paginatedEmployees.map((emp) => (
                    <tr key={emp.id || emp.employee_id} className={selectedEmployees.includes(emp.id || emp.employee_id) ? 'selected' : ''}>
                      <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedEmployees.includes(emp.id || emp.employee_id)} onChange={() => handleSelectEmployee(emp.id || emp.employee_id)} disabled={loading} /></td>
                      {visibleColumns.employee && (
                        <td>
                          <div className="catering-employee-cell">
                            <div className="catering-employee-avatar" style={{ position: 'relative' }}>
                              {emp.profile_photo ? (
                                <img src={getImageUrl(emp.profile_photo)} alt={`${emp.first_name} ${emp.last_name}`}
                                  style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e5e7eb' }}
                                  onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'; }} />
                              ) : null}
                              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                                display: emp.profile_photo ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', color: 'white' }}>
                                {emp.first_name?.[0]?.toUpperCase() || ''}{emp.last_name?.[0]?.toUpperCase() || ''}
                              </div>
                              {getStatusBadge(emp.status)}
                              {emp.is_bookmarked && <StarOutlined className="catering-employee-bookmark" />}
                            </div>
                            <div className="catering-employee-info">
                              <span className="catering-employee-name">{emp.first_name} {emp.last_name}</span>
                              <span className="catering-employee-id"><IdcardOutlined /> {emp.employee_id || emp.id}</span>
                              <span className="catering-employee-position">{emp.position?.title}</span>
                            </div>
                          </div>
                        </td>
                      )}
                      {visibleColumns.department && <td><span className="catering-tag blue">{emp.department?.name || 'N/A'}</span></td>}
                      {visibleColumns.position && <td><span className="catering-role-badge">{emp.position?.title || 'N/A'}</span></td>}
                      {visibleColumns.status && (
                        <td>
                          <span className={`catering-tag ${emp.status === 'active' ? 'green' : emp.status === 'onleave' ? 'orange' : 'gray'}`}>
                            {emp.status === 'active' && <CheckCircleOutlined />}
                            {emp.status === 'onleave' && <PauseCircleOutlined />}
                            {emp.status === 'inactive' && <InboxOutlined />}
                            {emp.status === 'active' ? 'Active' : emp.status === 'onleave' ? 'On Leave' : 'Archived'}
                          </span>
                        </td>
                      )}
                      {visibleColumns.shift && <td><span className="catering-tag purple">{emp.shift_preference || 'N/A'}</span></td>}
                      {visibleColumns.performance && (
                        <td>
                          <div className="catering-progress">
                            <span>{emp.performance?.overall_score || 85}%</span>
                            <div className="catering-progress-bar">
                              <div className={`catering-progress-fill ${getPerformanceColor(emp.performance?.overall_score || 85)}`}
                                style={{ width: `${emp.performance?.overall_score || 85}%` }} />
                            </div>
                          </div>
                        </td>
                      )}
                      {visibleColumns.contact && (
                        <td>
                          <div className="catering-contact-info">
                            <span className="catering-contact-item" title={emp.email}><MailFilled /> {emp.email}</span>
                            <span className="catering-contact-item" title={emp.phone}><PhoneFilled /> {emp.phone}</span>
                          </div>
                        </td>
                      )}
                      {visibleColumns.actions && (
                        <td>
                          <div className="catering-actions" onClick={(e) => e.stopPropagation()}>
                            <button className="catering-action-btn view" onClick={() => handleViewEmployee(emp)} title="View Details" disabled={loading}><EyeOutlined /></button>
                            <button className="catering-action-btn edit" onClick={() => handleEditEmployee(emp)} title="Edit" disabled={loading}><EditOutlined /></button>
                            <button className="catering-action-btn bookmark" onClick={() => handleBookmark(emp.id || emp.employee_id)} title={emp.is_bookmarked ? "Remove Bookmark" : "Add Bookmark"} disabled={loading}><StarOutlined style={{ color: emp.is_bookmarked ? '#fbbf24' : 'inherit' }} /></button>
                            <button className="catering-action-btn schedule" onClick={() => setShowScheduleModal(true)} title="Schedule" disabled={loading}><ScheduleOutlined /></button>
                            <button className="catering-action-btn delete" onClick={() => handleArchiveClick(emp)} title="Archive" disabled={loading}><InboxOutlined /></button>
                                                    </div>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="catering-table-empty">
                      <div className="catering-empty-state">
                        <TeamOutlined className="catering-empty-icon" />
                        <h3>No staff members found</h3>
                        <p>Try adjusting your filters or add a new staff member</p>
                        <button className="catering-btn catering-btn-primary" onClick={handleAddEmployee}>
                          <PlusOutlined /> Add Staff Member
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredEmployees.length > 0 && (
            <div className="catering-pagination">
              <span className="catering-pagination-info">
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredEmployees.length)} of {filteredEmployees.length} staff members
              </span>
              <div className="catering-pagination-controls">
                <button className="catering-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1 || loading}>←</button>
                {[...Array(totalPages)].map((_, i) => (
                  <button key={i} className={`catering-page-btn ${currentPage === i + 1 ? 'active' : ''}`} onClick={() => setCurrentPage(i + 1)} disabled={loading}>{i + 1}</button>
                ))}
                <button className="catering-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || loading}>→</button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Notification */}
      {showNotification && <Notification />}

      {/* Success Animation */}
      {showSuccessAnimation && (
        <div className="catering-success-animation">
          <CheckCircleOutlined />
          <span>Staff Added Successfully!</span>
        </div>
      )}

      {/* Employee Modal */}
      {showModal && (
        <div className="catering-modal-overlay" onClick={() => modalMode === 'view' && closeModal()}>
          <div className={`catering-modal ${modalMode === 'view' ? 'catering-profile-modal' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="catering-modal-header">
              <h2>
                {modalMode === 'add' && 'Add New Staff Member'}
                {modalMode === 'edit' && 'Edit Staff Information'}
                {modalMode === 'view' && 'Staff Profile'}
              </h2>
              {modalMode !== 'view' && (
                <div className="catering-modal-progress">
                  <span className={formStep >= 1 ? 'active' : ''}>1. Personal</span>
                  <span className={formStep >= 2 ? 'active' : ''}>2. Employment</span>
                  <span className={formStep >= 3 ? 'active' : ''}>3. Government</span>
                  <span className={formStep >= 4 ? 'active' : ''}>4. Skills & Emergency</span>
                </div>
              )}
              <button className="catering-modal-close" onClick={closeModal}>
                <CloseOutlined />
              </button>
            </div>
            
            <div className="catering-modal-body">
              {modalMode === 'view' && selectedEmployee ? (
                <div className="catering-profile">
                  <div className="catering-profile-header">
                    <div className="catering-profile-avatar">
                      {selectedEmployee.profile_photo ? (
                        <img 
                          src={getImageUrl(selectedEmployee.profile_photo)} 
                          alt={selectedEmployee.first_name} 
                          style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover' }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : (
                        <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 'bold', color: 'white' }}>
                          {selectedEmployee.first_name?.[0] || ''}{selectedEmployee.last_name?.[0] || ''}
                        </div>
                      )}
                      {getStatusBadge(selectedEmployee.status)}
                      {selectedEmployee.is_bookmarked && <StarOutlined className="catering-profile-bookmark" />}
                    </div>
                    
                    <h2 className="catering-profile-name">{selectedEmployee.first_name} {selectedEmployee.last_name}</h2>
                    <p className="catering-profile-title">{selectedEmployee.position?.title}</p>
                    
                    <div className="catering-profile-badges">
                      <span className="catering-profile-badge">
                        <IdcardOutlined /> {selectedEmployee.employee_id || selectedEmployee.id}
                      </span>
                      <span className="catering-profile-badge">
                        <BankOutlined /> {selectedEmployee.department?.name}
                      </span>
                      <span className="catering-profile-badge">
                        <ClockCircleOutlined /> {selectedEmployee.shift_preference} Shift
                      </span>
                    </div>
                  </div>
                  
                  <StatusControls employee={selectedEmployee} />

                  <div className="catering-profile-stats">
                    <div className="catering-profile-stat">
                      <div className="catering-profile-stat-value">{selectedEmployee.performance?.overall_score || 85}%</div>
                      <div className="catering-profile-stat-label">Performance</div>
                    </div>
                    <div className="catering-profile-stat">
                      <div className="catering-profile-stat-value">
                        {selectedEmployee.hire_date ? Math.floor((new Date() - new Date(selectedEmployee.hire_date)) / (1000 * 60 * 60 * 24 * 365)) : 0} years
                      </div>
                      <div className="catering-profile-stat-label">Experience</div>
                    </div>
                    <div className="catering-profile-stat">
                      <div className="catering-profile-stat-value">{selectedEmployee.skills?.length || 0}</div>
                      <div className="catering-profile-stat-label">Skills</div>
                    </div>
                    <div className="catering-profile-stat">
                      <div className="catering-profile-stat-value">{selectedEmployee.login_count || 0}</div>
                      <div className="catering-profile-stat-label">Logins</div>
                    </div>
                  </div>

                  <div className="catering-profile-tabs">
                    <button className="active">Personal</button>
                    <button>Employment</button>
                    <button>Government</button>
                    <button>Skills</button>
                    <button>History</button>
                  </div>

                  <div className="catering-profile-sections">
                    <div className="catering-profile-section">
                      <h3><UserOutlined /> Personal Information</h3>
                      <div className="catering-profile-grid">
                        <div className="catering-profile-item">
                          <span className="catering-profile-label">Email</span>
                          <span className="catering-profile-value">{selectedEmployee.email}</span>
                        </div>
                        <div className="catering-profile-item">
                          <span className="catering-profile-label">Phone</span>
                          <span className="catering-profile-value">{selectedEmployee.phone}</span>
                        </div>
                        <div className="catering-profile-item">
                          <span className="catering-profile-label">Address</span>
                          <span className="catering-profile-value">{selectedEmployee.address}</span>
                        </div>
                        <div className="catering-profile-item">
                          <span className="catering-profile-label">Emergency Contact</span>
                          <span className="catering-profile-value">
                            {selectedEmployee.emergency_contact} ({selectedEmployee.emergency_relation})
                            <br />
                            <small>{selectedEmployee.emergency_phone}</small>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="catering-profile-section">
                      <h3><BankOutlined /> Employment Details</h3>
                      <div className="catering-profile-grid">
                        <div className="catering-profile-item">
                          <span className="catering-profile-label">Hire Date</span>
                          <span className="catering-profile-value">{selectedEmployee.hire_date}</span>
                        </div>
                        <div className="catering-profile-item">
                          <span className="catering-profile-label">Employee Type</span>
                          <span className="catering-profile-value">{selectedEmployee.employee_type}</span>
                        </div>
                        <div className="catering-profile-item">
                          <span className="catering-profile-label">Monthly Salary</span>
                          <span className="catering-profile-value">
                            ₱{selectedEmployee.monthly_salary?.toLocaleString()}
                          </span>
                        </div>
                        <div className="catering-profile-item">
                          <span className="catering-profile-label">Bank Account</span>
                          <span className="catering-profile-value">
                            {selectedEmployee.bank_name} - {selectedEmployee.bank_account}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="catering-profile-section">
                      <h3><SafetyOutlined /> Government IDs</h3>
                      <div className="catering-profile-grid">
                        <div className="catering-profile-item">
                          <span className="catering-profile-label">SSS</span>
                          <span className="catering-profile-value">{selectedEmployee.sss || 'N/A'}</span>
                        </div>
                        <div className="catering-profile-item">
                          <span className="catering-profile-label">PhilHealth</span>
                          <span className="catering-profile-value">{selectedEmployee.philhealth || 'N/A'}</span>
                        </div>
                        <div className="catering-profile-item">
                          <span className="catering-profile-label">Pag-IBIG</span>
                          <span className="catering-profile-value">{selectedEmployee.pagibig || 'N/A'}</span>
                        </div>
                        <div className="catering-profile-item">
                          <span className="catering-profile-label">TIN</span>
                          <span className="catering-profile-value">{selectedEmployee.tin || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="catering-profile-section">
                      <h3><BookOutlined /> Skills & Certifications</h3>
                      <div className="catering-profile-skills">
                        {Array.isArray(selectedEmployee.skills) && selectedEmployee.skills.length > 0 ? (
                          selectedEmployee.skills.map((skill, index) => (
                            <span key={index} className="catering-skill-tag highlight">{skill}</span>
                          ))
                        ) : (
                          <span className="catering-profile-empty">No skills listed</span>
                        )}
                      </div>
                      <div className="catering-profile-certifications">
                        {Array.isArray(selectedEmployee.certifications) && selectedEmployee.certifications.length > 0 ? (
                          selectedEmployee.certifications.map((cert, index) => (
                            <span key={index} className="catering-skill-tag">
                              <TrophyOutlined /> {cert}
                            </span>
                          ))
                        ) : (
                          <span className="catering-profile-empty">No certifications listed</span>
                        )}
                      </div>
                    </div>

                    <div className="catering-profile-section">
                      <h3><StarOutlined /> Achievements</h3>
                      <div className="catering-profile-achievements">
                        {Array.isArray(selectedEmployee.achievements) && selectedEmployee.achievements.length > 0 ? (
                          selectedEmployee.achievements.map((achievement, index) => (
                            <span key={index} className="catering-skill-tag">
                              <StarOutlined /> {achievement}
                            </span>
                          ))
                        ) : (
                          <span className="catering-profile-empty">No achievements listed</span>
                        )}
                      </div>
                    </div>

                    <div className="catering-profile-section">
                      <h3><HistoryOutlined /> Activity History</h3>
                      <div className="catering-activity-list">
                        <div className="catering-activity-item">
                          <span className="catering-activity-time">Last Login:</span>
                          <span className="catering-activity-value">
                            {selectedEmployee.last_login ? new Date(selectedEmployee.last_login).toLocaleString() : 'Never'}
                          </span>
                        </div>
                        <div className="catering-activity-item">
                          <span className="catering-activity-time">Created:</span>
                          <span className="catering-activity-value">{new Date(selectedEmployee.created_at).toLocaleString()}</span>
                        </div>
                        <div className="catering-activity-item">
                          <span className="catering-activity-time">Last Updated:</span>
                          <span className="catering-activity-value">{new Date(selectedEmployee.updated_at).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {selectedEmployee.notes && (
                      <div className="catering-profile-section">
                        <h3><FileTextOutlined /> Notes</h3>
                        <p className="catering-profile-notes">{selectedEmployee.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <form className="catering-form" onSubmit={(e) => e.preventDefault()}>
                  {/* Step 1: Personal Information */}
                  {formStep === 1 && (
                    <>
                      <div className="catering-upload-area" onClick={() => document.getElementById('profile-photo').click()}>
                        {imagePreview ? (
                          <img src={imagePreview} alt="Preview" className="catering-upload-preview" />
                        ) : (
                          <>
                            <UploadOutlined className="catering-upload-icon" />
                            <p>Click to upload photo</p>
                            <p className="catering-upload-hint">Supported: JPG, PNG. Max size: 2MB</p>
                          </>
                        )}
                        <input
                          type="file"
                          id="profile-photo"
                          name="profile_photo"
                          accept="image/jpeg,image/png,image/jpg"
                          onChange={handleInputChange}
                          style={{ display: 'none' }}
                        />
                      </div>

                      {uploadProgress > 0 && uploadProgress < 100 && (
                        <div className="catering-upload-progress">
                          <div className="catering-progress-bar">
                            <div className="catering-progress-fill" style={{ width: `${uploadProgress}%` }} />
                          </div>
                          <span>{uploadProgress}% uploaded</span>
                        </div>
                      )}

                      <div className="catering-form-section">
                        <h3><UserOutlined /> Personal Information</h3>
                        <div className="catering-form-row">
                          <div className="catering-form-group">
                            <label className="catering-form-label">First Name *</label>
                            <input 
                              type="text" 
                              name="first_name"
                              className={`catering-form-input ${formErrors.first_name && touchedFields.first_name ? 'error' : ''}`}
                              value={formData.first_name}
                              onChange={handleInputChange}
                              onBlur={() => handleBlur('first_name')}
                              placeholder="Enter first name"
                            />
                            {formErrors.first_name && touchedFields.first_name && (
                              <span className="catering-form-error">{formErrors.first_name}</span>
                            )}
                          </div>
                          <div className="catering-form-group">
                            <label className="catering-form-label">Last Name *</label>
                            <input 
                              type="text" 
                              name="last_name"
                              className={`catering-form-input ${formErrors.last_name && touchedFields.last_name ? 'error' : ''}`}
                              value={formData.last_name}
                              onChange={handleInputChange}
                              onBlur={() => handleBlur('last_name')}
                              placeholder="Enter last name"
                            />
                            {formErrors.last_name && touchedFields.last_name && (
                              <span className="catering-form-error">{formErrors.last_name}</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="catering-form-row">
                          <div className="catering-form-group">
                            <label className="catering-form-label">Middle Name</label>
                            <input 
                              type="text" 
                              name="middle_name"
                              className="catering-form-input"
                              value={formData.middle_name}
                              onChange={handleInputChange}
                              placeholder="Enter middle name"
                            />
                          </div>
                          <div className="catering-form-group">
                            <label className="catering-form-label">Gender</label>
                            <select 
                              name="gender"
                              className="catering-form-select"
                              value={formData.gender}
                              onChange={handleInputChange}
                            >
                              <option value="">Select gender</option>
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                        </div>

                        <div className="catering-form-row">
                          <div className="catering-form-group">
                            <label className="catering-form-label">Birth Date</label>
                            <input 
                              type="date" 
                              name="birth_date"
                              className="catering-form-input"
                              value={formData.birth_date}
                              onChange={handleInputChange}
                            />
                          </div>
                          <div className="catering-form-group">
                            <label className="catering-form-label">Position *</label>
                            <select 
                              name="position_id"
                              className={`catering-form-select ${formErrors.position_id && touchedFields.position_id ? 'error' : ''}`}
                              value={formData.position_id}
                              onChange={handleInputChange}
                              onBlur={() => handleBlur('position_id')}
                            >
                              <option value="">Select position</option>
                              {filteredPositions.length > 0 ? (
                                filteredPositions.map(pos => (
                                  <option key={pos.id} value={pos.id}>{pos.title}</option>
                                ))
                              ) : (
                                positions.map(pos => (
                                  <option key={pos.id} value={pos.id}>{pos.title}</option>
                                ))
                              )}
                            </select>
                            {formErrors.position_id && touchedFields.position_id && (
                              <span className="catering-form-error">{formErrors.position_id}</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="catering-form-row">
                          <div className="catering-form-group">
                            <label className="catering-form-label">Email *</label>
                            <input 
                              type="email" 
                              name="email"
                              className={`catering-form-input ${formErrors.email && touchedFields.email ? 'error' : ''}`}
                              value={formData.email}
                              onChange={handleInputChange}
                              onBlur={() => handleBlur('email')}
                              placeholder="Enter email"
                            />
                            {formErrors.email && touchedFields.email && (
                              <span className="catering-form-error">{formErrors.email}</span>
                            )}
                          </div>
                          <div className="catering-form-group">
                            <label className="catering-form-label">Phone *</label>
                            <input 
                              type="tel" 
                              name="phone"
                              className={`catering-form-input ${formErrors.phone && touchedFields.phone ? 'error' : ''}`}
                              value={formData.phone}
                              onChange={handleInputChange}
                              onBlur={() => handleBlur('phone')}
                              placeholder="Enter phone number"
                            />
                            {formErrors.phone && touchedFields.phone && (
                              <span className="catering-form-error">{formErrors.phone}</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="catering-form-group">
                          <label className="catering-form-label">Address</label>
                          <textarea 
                            name="address"
                            className="catering-form-textarea"
                            value={formData.address}
                            onChange={handleInputChange}
                            placeholder="Enter complete address"
                            rows="3"
                          />
                        </div>

                        <div className="catering-form-row">
                          <div className="catering-form-group">
                            <label className="catering-form-label">City</label>
                            <input 
                              type="text" 
                              name="city"
                              className="catering-form-input"
                              value={formData.city}
                              onChange={handleInputChange}
                              placeholder="Enter city"
                            />
                          </div>
                          <div className="catering-form-group">
                            <label className="catering-form-label">State/Province</label>
                            <input 
                              type="text" 
                              name="state"
                              className="catering-form-input"
                              value={formData.state}
                              onChange={handleInputChange}
                              placeholder="Enter state/province"
                            />
                          </div>
                        </div>

                        <div className="catering-form-row">
                          <div className="catering-form-group">
                            <label className="catering-form-label">Postal Code</label>
                            <input 
                              type="text" 
                              name="postal_code"
                              className="catering-form-input"
                              value={formData.postal_code}
                              onChange={handleInputChange}
                              placeholder="Enter postal code"
                            />
                          </div>
                          <div className="catering-form-group">
                            <label className="catering-form-label">Country</label>
                            <input 
                              type="text" 
                              name="country"
                              className="catering-form-input"
                              value={formData.country}
                              onChange={handleInputChange}
                              placeholder="Enter country"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Step 2: Employment Details */}
                  {formStep === 2 && (
                    <div className="catering-form-section">
                      <h3><BankOutlined /> Employment Details</h3>
                      <div className="catering-form-row">
                        <div className="catering-form-group">
                          <label className="catering-form-label">Department *</label>
                          <select 
                            name="department_id"
                            className={`catering-form-select ${formErrors.department_id && touchedFields.department_id ? 'error' : ''}`}
                            value={formData.department_id}
                            onChange={handleInputChange}
                            onBlur={() => handleBlur('department_id')}
                          >
                            <option value="">Select department</option>
                            {departments.map(dept => (
                              <option key={dept.id} value={dept.id}>{dept.name}</option>
                            ))}
                          </select>
                          {formErrors.department_id && touchedFields.department_id && (
                            <span className="catering-form-error">{formErrors.department_id}</span>
                          )}
                        </div>
                        <div className="catering-form-group">
                          <label className="catering-form-label">Employee Type *</label>
                          <select 
                            name="employee_type"
                            className="catering-form-select"
                            value={formData.employee_type}
                            onChange={handleInputChange}
                          >
                            <option value="regular">Regular</option>
                            <option value="oncall">On-call</option>
                            <option value="probationary">Probationary</option>
                            <option value="contract">Contract</option>
                          </select>
                        </div>
                      </div>

                      <div className="catering-form-row">
                        <div className="catering-form-group">
                          <label className="catering-form-label">Status *</label>
                          <select 
                            name="status"
                            className="catering-form-select"
                            value={formData.status}
                            onChange={handleInputChange}
                          >
                            <option value="active">Active</option>
                            <option value="onleave">On Leave</option>
                          </select>
                          <small className="catering-form-hint">Note: Inactive status is for archived employees</small>
                        </div>
                        <div className="catering-form-group">
                          <label className="catering-form-label">Shift *</label>
                          <select 
                            name="shift_preference"
                            className="catering-form-select"
                            value={formData.shift_preference}
                            onChange={handleInputChange}
                          >
                            <option value="morning">Morning (6AM-2PM)</option>
                            <option value="afternoon">Afternoon (2PM-10PM)</option>
                            <option value="evening">Evening (6PM-2AM)</option>
                            <option value="night">Night (10PM-6AM)</option>
                            <option value="flexible">Flexible</option>
                          </select>
                        </div>
                      </div>

                      <div className="catering-form-row">
                        <div className="catering-form-group">
                          <label className="catering-form-label">Hire Date *</label>
                          <input 
                            type="date" 
                            name="hire_date"
                            className={`catering-form-input ${formErrors.hire_date && touchedFields.hire_date ? 'error' : ''}`}
                            value={formData.hire_date}
                            onChange={handleInputChange}
                            onBlur={() => handleBlur('hire_date')}
                          />
                          {formErrors.hire_date && touchedFields.hire_date && (
                            <span className="catering-form-error">{formErrors.hire_date}</span>
                          )}
                        </div>
                        <div className="catering-form-group">
                          <label className="catering-form-label">Monthly Salary (₱)</label>
                          <input 
                            type="number" 
                            name="monthly_salary"
                            className={`catering-form-input ${formErrors.monthly_salary && touchedFields.monthly_salary ? 'error' : ''}`}
                            value={formData.monthly_salary}
                            onChange={handleInputChange}
                            onBlur={() => handleBlur('monthly_salary')}
                            placeholder="Enter monthly salary"
                            min="0"
                            step="1000"
                          />
                          {formErrors.monthly_salary && touchedFields.monthly_salary && (
                            <span className="catering-form-error">{formErrors.monthly_salary}</span>
                          )}
                        </div>
                      </div>

                      <div className="catering-form-row">
                        <div className="catering-form-group">
                          <label className="catering-form-label">Bank Name</label>
                          <input 
                            type="text" 
                            name="bank_name"
                            className="catering-form-input"
                            value={formData.bank_name}
                            onChange={handleInputChange}
                            placeholder="Enter bank name"
                          />
                        </div>
                        <div className="catering-form-group">
                          <label className="catering-form-label">Bank Account</label>
                          <input 
                            type="text" 
                            name="bank_account"
                            className="catering-form-input"
                            value={formData.bank_account}
                            onChange={handleInputChange}
                            placeholder="Enter bank account"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Government IDs */}
                  {formStep === 3 && (
                    <div className="catering-form-section">
                      <h3><SafetyOutlined /> Government IDs</h3>
                      <div className="catering-form-row">
                        <div className="catering-form-group">
                          <label className="catering-form-label">SSS Number</label>
                          <input 
                            type="text" 
                            name="sss"
                            className={`catering-form-input ${formErrors.sss && touchedFields.sss ? 'error' : ''}`}
                            value={formData.sss}
                            onChange={handleInputChange}
                            onBlur={() => handleBlur('sss')}
                            placeholder="XX-XXXXXXX-X"
                          />
                          {formErrors.sss && touchedFields.sss && (
                            <span className="catering-form-error">{formErrors.sss}</span>
                          )}
                        </div>
                        <div className="catering-form-group">
                          <label className="catering-form-label">PhilHealth</label>
                          <input 
                            type="text" 
                            name="philhealth"
                            className={`catering-form-input ${formErrors.philhealth && touchedFields.philhealth ? 'error' : ''}`}
                            value={formData.philhealth}
                            onChange={handleInputChange}
                            onBlur={() => handleBlur('philhealth')}
                            placeholder="XX-XXXXXXXXX-X"
                          />
                          {formErrors.philhealth && touchedFields.philhealth && (
                            <span className="catering-form-error">{formErrors.philhealth}</span>
                          )}
                        </div>
                      </div>
                      <div className="catering-form-row">
                        <div className="catering-form-group">
                          <label className="catering-form-label">Pag-IBIG</label>
                          <input 
                            type="text" 
                            name="pagibig"
                            className={`catering-form-input ${formErrors.pagibig && touchedFields.pagibig ? 'error' : ''}`}
                            value={formData.pagibig}
                            onChange={handleInputChange}
                            onBlur={() => handleBlur('pagibig')}
                            placeholder="XXXX-XXXX-XXXX"
                          />
                          {formErrors.pagibig && touchedFields.pagibig && (
                            <span className="catering-form-error">{formErrors.pagibig}</span>
                          )}
                        </div>
                        <div className="catering-form-group">
                          <label className="catering-form-label">TIN</label>
                          <input 
                            type="text" 
                            name="tin"
                            className={`catering-form-input ${formErrors.tin && touchedFields.tin ? 'error' : ''}`}
                            value={formData.tin}
                            onChange={handleInputChange}
                            onBlur={() => handleBlur('tin')}
                            placeholder="XXX-XXX-XXX-XXX"
                          />
                          {formErrors.tin && touchedFields.tin && (
                            <span className="catering-form-error">{formErrors.tin}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Skills & Emergency Contact */}
                  {formStep === 4 && (
                    <>
                      <div className="catering-form-section">
                        <h3><HeartOutlined /> Emergency Contact</h3>
                        <div className="catering-form-row">
                          <div className="catering-form-group">
                            <label className="catering-form-label">Contact Name</label>
                            <input 
                              type="text" 
                              name="emergency_contact"
                              className="catering-form-input"
                              value={formData.emergency_contact}
                              onChange={handleInputChange}
                              placeholder="Full name"
                            />
                          </div>
                          <div className="catering-form-group">
                            <label className="catering-form-label">Relationship</label>
                            <input 
                              type="text" 
                              name="emergency_relation"
                              className="catering-form-input"
                              value={formData.emergency_relation}
                              onChange={handleInputChange}
                              placeholder="e.g., Spouse, Parent"
                            />
                          </div>
                        </div>
                        <div className="catering-form-group">
                          <label className="catering-form-label">Emergency Phone</label>
                          <input 
                            type="tel" 
                            name="emergency_phone"
                            className="catering-form-input"
                            value={formData.emergency_phone}
                            onChange={handleInputChange}
                            placeholder="Emergency contact number"
                          />
                        </div>
                      </div>

                      <div className="catering-form-section">
                        <h3><BookOutlined /> Skills & Certifications</h3>
                        <div className="catering-form-group">
                          <label className="catering-form-label">Skills (comma separated)</label>
                          <input 
                            type="text" 
                            name="skills"
                            className="catering-form-input"
                            value={formData.skills}
                            onChange={handleInputChange}
                            placeholder="e.g., Food Safety, Menu Planning, Leadership"
                          />
                          <small className="catering-form-hint">Separate skills with commas</small>
                        </div>
                        <div className="catering-form-group">
                          <label className="catering-form-label">Certifications</label>
                          <input 
                            type="text" 
                            name="certifications"
                            className="catering-form-input"
                            value={formData.certifications}
                            onChange={handleInputChange}
                            placeholder="e.g., ServSafe, Culinary Arts"
                          />
                          <small className="catering-form-hint">Separate certifications with commas</small>
                        </div>
                        <div className="catering-form-group">
                          <label className="catering-form-label">Achievements</label>
                          <input 
                            type="text" 
                            name="achievements"
                            className="catering-form-input"
                            value={formData.achievements}
                            onChange={handleInputChange}
                            placeholder="e.g., Employee of the Month"
                          />
                          <small className="catering-form-hint">Separate achievements with commas</small>
                        </div>
                      </div>

                      <div className="catering-form-section">
                        <h3><FileTextOutlined /> Additional Notes</h3>
                        <div className="catering-form-group">
                          <textarea 
                            name="notes"
                            className="catering-form-textarea"
                            value={formData.notes}
                            onChange={handleInputChange}
                            placeholder="Enter any additional notes about the staff member"
                            rows="4"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </form>
              )}
            </div>
            
            <div className="catering-modal-footer">
              {modalMode !== 'view' && formStep > 1 && (
                <button className="catering-btn" onClick={handlePrevStep} disabled={loading}>
                  Previous
                </button>
              )}
              <button className="catering-btn" onClick={closeModal} disabled={loading}>
                Cancel
              </button>
              {modalMode !== 'view' && formStep < 4 && (
                <button className="catering-btn catering-btn-primary" onClick={handleNextStep} disabled={loading}>
                  Next
                </button>
              )}
              {modalMode !== 'view' && formStep === 4 && (
                <button className="catering-btn catering-btn-primary" onClick={handleSaveEmployee} disabled={loading || isSubmitting}>
                  {loading ? <LoadingOutlined spin /> : (modalMode === 'add' ? 'Add Staff Member' : 'Save Changes')}
                </button>
              )}
              {modalMode === 'view' && (
                <>
                  <button className="catering-btn" onClick={() => setShowPrintModal(true)} disabled={loading}>
                    <PrinterOutlined /> Print Profile
                  </button>
                  <button className="catering-btn" onClick={() => handleBookmark(selectedEmployee.id || selectedEmployee.employee_id)} disabled={loading}>
                    <StarOutlined /> {selectedEmployee.is_bookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
                  </button>
                  <button className="catering-btn catering-btn-primary" onClick={() => handleEditEmployee(selectedEmployee)} disabled={loading}>
                    <EditOutlined /> Edit Profile
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="catering-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="catering-modal catering-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="catering-modal-header">
              <h2>Confirm Archive</h2>
              <button className="catering-modal-close" onClick={() => setShowDeleteConfirm(false)}>
                <CloseOutlined />
              </button>
            </div>
            <div className="catering-modal-body">
              <div className="catering-confirm-content">
                <InboxOutlined className="catering-confirm-icon" />
                <h3>Archive staff member?</h3>
                <p>
                  Are you sure you want to archive <strong>{employeeToDelete?.first_name} {employeeToDelete?.last_name}</strong>?<br />
                  The employee will be moved to the archive and can be restored later.
                </p>
              </div>
            </div>
            <div className="catering-modal-footer">
              <button className="catering-btn" onClick={() => setShowDeleteConfirm(false)} disabled={loading}>
                Cancel
              </button>
              <button className="catering-btn catering-btn-warning" onClick={confirmArchive} disabled={loading}>
                {loading ? <LoadingOutlined spin /> : <><InboxOutlined /> Archive</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="catering-modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="catering-modal catering-small-modal" onClick={(e) => e.stopPropagation()}>
            <div className="catering-modal-header">
              <h2>Export Data</h2>
              <button className="catering-modal-close" onClick={() => setShowExportModal(false)}>
                <CloseOutlined />
              </button>
            </div>
            <div className="catering-modal-body">
              <div className="catering-export-options">
                <button className="catering-export-option" onClick={() => handleExport('CSV')}><FileExcelOutlined /> CSV</button>
                <button className="catering-export-option" onClick={() => handleExport('Excel')}><BarChartOutlined /> Excel</button>
                <button className="catering-export-option" onClick={() => handleExport('PDF')}><FilePdfOutlined /> PDF</button>
                <button className="catering-export-option" onClick={() => handleExport('JSON')}><CodeOutlined /> JSON</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="catering-modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="catering-modal catering-small-modal" onClick={(e) => e.stopPropagation()}>
            <div className="catering-modal-header">
              <h2>Import Data</h2>
              <button className="catering-modal-close" onClick={() => setShowImportModal(false)}>
                <CloseOutlined />
              </button>
            </div>
            <div className="catering-modal-body">
              <div className="catering-upload-area large" onClick={() => document.getElementById('import-file').click()}>
                <UploadOutlined className="catering-upload-icon" />
                <p>Click to upload</p>
                <input type="file" id="import-file" accept=".csv,.xlsx,.xls,.json" onChange={(e) => setSelectedFile(e.target.files[0])} style={{ display: 'none' }} />
                {selectedFile && <p>Selected: {selectedFile.name}</p>}
              </div>
              <div className="catering-import-actions">
                <button className="catering-btn" onClick={() => setShowImportModal(false)}>Cancel</button>
                <button className="catering-btn catering-btn-primary" onClick={handleImport} disabled={!selectedFile}>Import</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {showPrintModal && (
        <div className="catering-modal-overlay" onClick={() => setShowPrintModal(false)}>
          <div className="catering-modal catering-small-modal" onClick={(e) => e.stopPropagation()}>
            <div className="catering-modal-header">
              <h2>Print Options</h2>
              <button className="catering-modal-close" onClick={() => setShowPrintModal(false)}>
                <CloseOutlined />
              </button>
            </div>
            <div className="catering-modal-body">
              <div className="catering-import-actions">
                <button className="catering-btn" onClick={() => setShowPrintModal(false)}>Cancel</button>
                <button className="catering-btn catering-btn-primary" onClick={handlePrint}><PrinterOutlined /> Print</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="catering-modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="catering-modal catering-small-modal" onClick={(e) => e.stopPropagation()}>
            <div className="catering-modal-header">
              <h2>Share</h2>
              <button className="catering-modal-close" onClick={() => setShowShareModal(false)}>
                <CloseOutlined />
              </button>
            </div>
            <div className="catering-modal-body">
              <div className="catering-share-options">
                <button className="catering-share-option" onClick={() => handleShare('Email')}><MailOutlined /> Email</button>
                <button className="catering-share-option" onClick={() => handleShare('WhatsApp')}><WhatsAppOutlined /> WhatsApp</button>
                <button className="catering-share-option" onClick={() => handleShare('Link')}><LinkOutlined /> Copy Link</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="catering-modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="catering-modal" onClick={(e) => e.stopPropagation()}>
            <div className="catering-modal-header">
              <h2>Schedule Management</h2>
              <button className="catering-modal-close" onClick={() => setShowScheduleModal(false)}>
                <CloseOutlined />
              </button>
            </div>
            <div className="catering-modal-body">
              <div className="catering-schedule-view">
                <div className="catering-schedule-header">
                  <button className="catering-schedule-nav">←</button>
                  <h3>{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                  <button className="catering-schedule-nav">→</button>
                </div>
                <div className="catering-schedule-weekdays">
                  <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                </div>
                <div className="catering-schedule-grid">
                  {scheduleData.length > 0 ? (
                    scheduleData.map((schedule, i) => (
                      <div key={i} className="catering-schedule-day">
                        <span className="catering-schedule-date">{new Date(schedule.date).getDate()}</span>
                        <div className="catering-schedule-event">{schedule.shift_type} Shift</div>
                      </div>
                    ))
                  ) : (
                    <div className="catering-schedule-empty">No schedules found</div>
                  )}
                </div>
              </div>
            </div>
            <div className="catering-modal-footer">
              <button className="catering-btn" onClick={() => setShowScheduleModal(false)}>Close</button>
              <button className="catering-btn catering-btn-primary" onClick={() => handleSchedule('created')}>New Schedule</button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Modal */}
      {showAttendanceModal && (
        <div className="catering-modal-overlay" onClick={() => setShowAttendanceModal(false)}>
          <div className="catering-modal" onClick={(e) => e.stopPropagation()}>
            <div className="catering-modal-header">
              <h2>Attendance Tracking</h2>
              <button className="catering-modal-close" onClick={() => setShowAttendanceModal(false)}>
                <CloseOutlined />
              </button>
            </div>
            <div className="catering-modal-body">
              <div className="catering-attendance-summary">
                <div className="catering-attendance-stat">
                  <span className="catering-attendance-label">Present Today</span>
                  <span className="catering-attendance-value">
                    {attendanceData.filter(a => a.status === 'present').length}
                  </span>
                </div>
                <div className="catering-attendance-stat">
                  <span className="catering-attendance-label">On Leave</span>
                  <span className="catering-attendance-value">
                    {attendanceData.filter(a => a.status === 'on-leave').length}
                  </span>
                </div>
                <div className="catering-attendance-stat">
                  <span className="catering-attendance-label">Late</span>
                  <span className="catering-attendance-value">
                    {attendanceData.filter(a => a.status === 'late').length}
                  </span>
                </div>
                <div className="catering-attendance-stat">
                  <span className="catering-attendance-label">Absent</span>
                  <span className="catering-attendance-value">
                    {attendanceData.filter(a => a.status === 'absent').length}
                  </span>
                </div>
              </div>

              <table className="catering-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceData.slice(0, 5).map(att => (
                    <tr key={att.id}>
                      <td>{att.employee?.first_name} {att.employee?.last_name}</td>
                      <td>{att.check_in}</td>
                      <td>{att.check_out}</td>
                      <td>
                        <span className={`catering-tag ${
                          att.status === 'present' ? 'green' :
                          att.status === 'late' ? 'orange' : 'gray'
                        }`}>
                          {att.status === 'present' && <CheckCircleOutlined />}
                          {att.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="catering-modal-footer">
              <button className="catering-btn" onClick={() => setShowAttendanceModal(false)}>Close</button>
              <button className="catering-btn catering-btn-primary" onClick={() => handleAttendance('marked')}>Mark Attendance</button>
            </div>
          </div>
        </div>
      )}

      {/* Payroll Modal */}
      {showPayrollModal && (
        <div className="catering-modal-overlay" onClick={() => setShowPayrollModal(false)}>
          <div className="catering-modal" onClick={(e) => e.stopPropagation()}>
            <div className="catering-modal-header">
              <h2>Payroll Processing</h2>
              <button className="catering-modal-close" onClick={() => setShowPayrollModal(false)}><CloseOutlined /></button>
            </div>
            <div className="catering-modal-body">
              <div className="catering-payroll-summary">
                <div className="catering-payroll-total">
                  <span>Total Payroll</span>
                  <h2>₱{payrollData.reduce((sum, p) => sum + (p.net_pay || 0), 0).toLocaleString()}</h2>
                </div>
              </div>
              <table className="catering-table">
                <thead>
                  <tr><th>Employee</th><th>Base</th><th>Overtime</th><th>Deductions</th><th>Net Pay</th> </tr>
                </thead>
                <tbody>
                  {payrollData.map(pay => (
                    <tr key={pay.id}>
                      <td>{pay.employee?.first_name} {pay.employee?.last_name}</td>
                      <td>₱{pay.base_pay?.toLocaleString()}</td>
                      <td>₱{pay.overtime_pay?.toLocaleString()}</td>
                      <td>₱{pay.total_deductions?.toLocaleString()}</td>
                      <td>₱{pay.net_pay?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="catering-modal-footer">
              <button className="catering-btn" onClick={() => setShowPayrollModal(false)}>Close</button>
              <button className="catering-btn catering-btn-primary" onClick={() => handlePayroll('processed')}>Process Payroll</button>
            </div>
          </div>
        </div>
      )}

      {/* Compliance Modal */}
      {showComplianceModal && (
        <div className="catering-modal-overlay" onClick={() => setShowComplianceModal(false)}>
          <div className="catering-modal" onClick={(e) => e.stopPropagation()}>
            <div className="catering-modal-header">
              <h2>Compliance Management</h2>
              <button className="catering-modal-close" onClick={() => setShowComplianceModal(false)}><CloseOutlined /></button>
            </div>
            <div className="catering-modal-body">
              <div className="catering-compliance-stats">
                <div><span>SSS Contributions</span><span className="green">Up to Date</span></div>
                <div><span>PhilHealth</span><span className="green">Up to Date</span></div>
                <div><span>Pag-IBIG</span><span className="green">Up to Date</span></div>
                <div><span>Tax Withholding</span><span className="green">Up to Date</span></div>
              </div>
            </div>
            <div className="catering-modal-footer">
              <button className="catering-btn" onClick={() => setShowComplianceModal(false)}>Close</button>
              <button className="catering-btn catering-btn-primary" onClick={() => handleCompliance('updated')}>Update Compliance</button>
            </div>
          </div>
        </div>
      )}

      {/* Benefits Modal */}
      {showBenefitsModal && (
        <div className="catering-modal-overlay" onClick={() => setShowBenefitsModal(false)}>
          <div className="catering-modal" onClick={(e) => e.stopPropagation()}>
            <div className="catering-modal-header">
              <h2>Benefits Administration</h2>
              <button className="catering-modal-close" onClick={() => setShowBenefitsModal(false)}><CloseOutlined /></button>
            </div>
            <div className="catering-modal-body">
              <div className="catering-benefits-grid">
                <div><HeartOutlined /><h3>Health Insurance</h3><p>15 employees enrolled</p><span className="active">Active</span></div>
                <div><CoffeeOutlined /><h3>Meal Allowance</h3><p>₱350 per day</p><span className="active">Active</span></div>
                <div><FundOutlined /><h3>Retirement Plan</h3><p>8 employees enrolled</p><span className="active">Active</span></div>
                <div><WalletOutlined /><h3>Transportation</h3><p>₱150 per day</p><span className="active">Active</span></div>
              </div>
            </div>
            <div className="catering-modal-footer">
              <button className="catering-btn" onClick={() => setShowBenefitsModal(false)}>Close</button>
              <button className="catering-btn catering-btn-primary" onClick={() => handleBenefits('updated')}>Update Benefits</button>
            </div>
          </div>
        </div>
      )}

      {/* Reports Modal */}
      {showReportsModal && (
        <div className="catering-modal-overlay" onClick={() => setShowReportsModal(false)}>
          <div className="catering-modal" onClick={(e) => e.stopPropagation()}>
            <div className="catering-modal-header">
              <h2>Generate Reports</h2>
              <button className="catering-modal-close" onClick={() => setShowReportsModal(false)}><CloseOutlined /></button>
            </div>
            <div className="catering-modal-body">
              <div className="catering-reports-grid">
                <button onClick={() => handleReports('Staff Report')}><TeamOutlined /><h3>Staff Report</h3></button>
                <button onClick={() => handleReports('Attendance Report')}><ClockCircleOutlined /><h3>Attendance Report</h3></button>
                <button onClick={() => handleReports('Payroll Report')}><DollarOutlined /><h3>Payroll Report</h3></button>
                <button onClick={() => handleReports('Performance Report')}><RiseOutlined /><h3>Performance Report</h3></button>
              </div>
            </div>
            <div className="catering-modal-footer">
              <button className="catering-btn" onClick={() => setShowReportsModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Shifts Modal */}
      {showShiftsModal && (
        <div className="catering-modal-overlay" onClick={() => setShowShiftsModal(false)}>
          <div className="catering-modal" onClick={(e) => e.stopPropagation()}>
            <div className="catering-modal-header">
              <h2>Shift Management</h2>
              <button className="catering-modal-close" onClick={() => setShowShiftsModal(false)}><CloseOutlined /></button>
            </div>
            <div className="catering-modal-body">
              <div className="catering-shifts-list">
                <div><h3>Morning Shift</h3><p>6:00 AM - 2:00 PM</p><span>{employees.filter(e => e.shift_preference === 'morning').length} staff</span></div>
                <div><h3>Afternoon Shift</h3><p>2:00 PM - 10:00 PM</p><span>{employees.filter(e => e.shift_preference === 'afternoon').length} staff</span></div>
                <div><h3>Night Shift</h3><p>10:00 PM - 6:00 AM</p><span>{employees.filter(e => e.shift_preference === 'night').length} staff</span></div>
                <div><h3>Flexible Shift</h3><p>Variable hours</p><span>{employees.filter(e => e.shift_preference === 'flexible').length} staff</span></div>
              </div>
            </div>
            <div className="catering-modal-footer">
              <button className="catering-btn" onClick={() => setShowShiftsModal(false)}>Close</button>
              <button className="catering-btn catering-btn-primary" onClick={() => handleShifts('created')}>Create New Shift</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staff_Management;
                        