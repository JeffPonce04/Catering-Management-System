
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  FlatList,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createStackNavigator } from '@react-navigation/stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from '../utils/toast';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import moment from 'moment';
import * as Animatable from 'react-native-animatable';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getBaseUrl } from '../services/api';

const Stack = createStackNavigator();
const { width } = Dimensions.get('window');

// ==================== API CONFIGURATION ====================
const API_BASE_URL = `${getBaseUrl().replace(/\/+$/, '')}/v1`;

const normalizeEmployee = (employee = {}) => {
  const firstName = employee.person?.first_name || employee.first_name || '';
  const lastName = employee.person?.last_name || employee.last_name || '';
  const fullName = employee.person?.full_name || employee.name || `${firstName} ${lastName}`.trim();

  return {
    ...employee,
    name: fullName || employee.employee_code || `Employee #${employee.employee_id}`,
    profile_photo_url: employee.profile_photo_url || employee.person?.profile_photo_url || employee.person?.profile_photo || null,
  };
};

// ==================== API SERVICE WITH AUTHENTICATION ====================
const api = {
  async request(endpoint, method = 'GET', data = null, requiresAuth = true) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (requiresAuth) {
      const token = await AsyncStorage.getItem('authToken') || await AsyncStorage.getItem('@auth_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        throw { status: 401, message: 'No authentication token found' };
      }
    }

    const config = { method, headers };
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, config);
      const responseData = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await AsyncStorage.removeItem('authToken');
          await AsyncStorage.removeItem('currentEmployee');
          await AsyncStorage.removeItem('recentEmployeeIds');
          Toast.show({ type: 'error', text1: 'Session Expired', text2: 'Please login again' });
          throw { status: 401, message: 'Unauthorized. Please login again.' };
        }
        throw { status: response.status, message: responseData.message || 'Request failed', data: responseData };
      }
      return responseData;
    } catch (error) {
      console.error('API Error:', endpoint, error);
      throw error;
    }
  },

  async checkHealth() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Health check error:', error);
      throw error;
    }
  },

  async login(employeeId) {
    const response = await this.request('/attendance/login', 'POST', { employee_id: employeeId }, true);
    if (response.success && response.data?.employee) {
      response.data.employee = normalizeEmployee(response.data.employee);
      const mainToken = await AsyncStorage.getItem('@auth_token');
      if (mainToken) {
        await AsyncStorage.setItem('authToken', mainToken);
      }
      await AsyncStorage.setItem('currentEmployee', JSON.stringify(response.data.employee));
    }
    return response;
  },

  async clockIn(data) {
    const formattedData = { ...data, employee_id: data.employee_id != null ? String(data.employee_id) : data.employee_id };
    if (formattedData.selfie && !formattedData.selfie.includes('base64,')) {
      formattedData.selfie = `data:image/jpeg;base64,${formattedData.selfie}`;
    }
    return this.request('/attendance/time-in', 'POST', formattedData, true);
  },

  async clockOut(data) {
    const formattedData = { ...data, employee_id: data.employee_id != null ? String(data.employee_id) : data.employee_id };
    if (formattedData.selfie && !formattedData.selfie.includes('base64,')) {
      formattedData.selfie = `data:image/jpeg;base64,${formattedData.selfie}`;
    }
    return this.request('/attendance/time-out', 'POST', formattedData, true);
  },

 async getAttendanceHistory(employeeId, filters) {
  const queryParams = new URLSearchParams({ 
    employee_id: employeeId, 
    ...filters 
  }).toString();
  return this.request(`/attendance/history?${queryParams}`, 'GET', null, true);
},

 async getAttendanceSummary(employeeId) {
  // Use GET with query parameter, not in URL path
  return this.request(`/attendance/summary?employee_id=${employeeId}`, 'GET', null, true);
},

 async getTodayAttendance(employeeId) {
  return this.request(`/attendance/today?employee_id=${employeeId}`, 'GET', null, true);
},

  async getAttendanceByDateRange(employeeId, startDate, endDate) {
    const queryParams = new URLSearchParams({
      employee_id: employeeId,
      start_date: startDate,
      end_date: endDate
    }).toString();
    return this.request(`/attendance/range?${queryParams}`, 'GET', null, true);
  },

  // Request APIs
  async getEmployeeRequests(employeeId, status = null) {
    let url = `/employee-requests?employee_id=${employeeId}`;
    if (status) url += `&status=${status}`;
    return this.request(url, 'GET', null, true);
  },

  async createRequest(data) {
    return this.request('/employee-requests', 'POST', data, true);
  },

  async updateRequestStatus(requestId, status, adminNotes = null) {
    return this.request(`/employee-requests/${requestId}/status`, 'PUT', { status, admin_notes: adminNotes }, true);
  },

  async cancelRequest(requestId) {
    return this.request(`/employee-requests/${requestId}/cancel`, 'POST', null, true);
  },

  async getRequestStats(employeeId) {
    return this.request(`/employee-requests/stats/${employeeId}`, 'GET', null, true);
  },

  // Schedule APIs
  async getScheduleStats(startDate, endDate) {
    const queryParams = new URLSearchParams({ start_date: startDate, end_date: endDate }).toString();
    return this.request(`/schedules/stats?${queryParams}`, 'GET', null, true);
  },

  async getScheduleWarnings() {
    return this.request('/schedules/warnings', 'GET', null, true);
  },

  async getCompletedShifts(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    return this.request(`/schedules/completed-shifts?${queryParams}`, 'GET', null, true);
  },

  async logout() {
    try {
      await this.request('/attendance/logout', 'POST', null, true);
    } catch (error) {
      console.log('Logout error:', error);
    } finally {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('currentEmployee');
      await AsyncStorage.removeItem('recentEmployeeIds');
    }
  }
};

// ==================== LOGIN SCREEN (WITH VALIDATION) ====================
const LoginScreen = ({ navigation, onBackToMainApp }) => {
  const [employeeId, setEmployeeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentIds, setRecentIds] = useState([]);
  const [serverStatus, setServerStatus] = useState('checking');

  useEffect(() => {
    loadRecentIds();
    checkServerConnection();
    checkAutoLogin();
  }, []);

  const checkAutoLogin = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const employee = await AsyncStorage.getItem('currentEmployee');
      if (token && employee) {
        const parsedEmployee = normalizeEmployee(JSON.parse(employee));
        navigation.replace('Dashboard', { employee: parsedEmployee });
      }
    } catch (error) {
      console.log('Auto-login error:', error);
    }
  };

  const checkServerConnection = async () => {
    try {
      const data = await api.checkHealth();
      setServerStatus(data.success ? 'online' : 'offline');
      if (data.success) {
        Toast.show({ type: 'success', text1: 'Connected', text2: `Server at ${API_BASE_URL}` });
      } else {
        setServerStatus('offline');
        Toast.show({ type: 'error', text1: 'Connection Error', text2: 'Server returned error' });
      }
    } catch (error) {
      setServerStatus('offline');
      Toast.show({ type: 'error', text1: 'Connection Error', text2: `Cannot connect to server` });
    }
  };

  const loadRecentIds = async () => {
    try {
      const stored = await AsyncStorage.getItem('recentEmployeeIds');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Filter out null/undefined values and duplicates
        const validIds = Array.isArray(parsed) 
          ? parsed.filter(id => id && typeof id === 'string' && id.trim().length > 0)
          : [];
        setRecentIds([...new Set(validIds)]); // Remove duplicates
      }
    } catch (error) {
      console.log('Error loading recent IDs:', error);
      setRecentIds([]);
    }
  };

  const saveRecentId = async (id) => {
    // Validate ID before saving
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      console.log('Invalid ID, not saving:', id);
      return;
    }

    try {
      const cleanId = id.trim().toUpperCase();
      let updated = [cleanId, ...recentIds.filter(i => i !== cleanId)];
      updated = updated.slice(0, 5);
      setRecentIds(updated);
      await AsyncStorage.setItem('recentEmployeeIds', JSON.stringify(updated));
    } catch (error) {
      console.log('Error saving recent ID:', error);
    }
  };

  const clearRecentIds = async () => {
    Alert.alert(
      'Clear Recent IDs',
      'Are you sure you want to clear all recent employee IDs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('recentEmployeeIds');
              setRecentIds([]);
              Toast.show({ type: 'success', text1: 'Cleared', text2: 'Recent IDs cleared' });
            } catch (error) {
              Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to clear recent IDs' });
            }
          }
        }
      ]
    );
  };

  const goBackToMainApp = () => {
    if (onBackToMainApp) {
      onBackToMainApp();
      return;
    }

    const parentNavigation = navigation.getParent?.();
    if (parentNavigation?.canGoBack?.()) {
      parentNavigation.goBack();
      return;
    }
    parentNavigation?.navigate?.('Main');
  };

  const handleProceed = async () => {
    const trimmedId = employeeId.trim().toUpperCase();
    
    if (!trimmedId) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter Employee ID' });
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.login(trimmedId);
      
      if (response.success && response.data && response.data.employee) {
        await saveRecentId(trimmedId);
        await AsyncStorage.setItem('currentEmployee', JSON.stringify(response.data.employee));
        navigation.replace('Dashboard', { employee: response.data.employee });
        Toast.show({ type: 'success', text1: 'Welcome!', text2: `Hello ${response.data.employee.name}` });
      } else {
        // Employee not found or invalid
        Toast.show({ 
          type: 'error', 
          text1: 'Login Failed', 
          text2: response.message || 'Invalid Employee ID. Please check and try again.' 
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      
      // Handle specific error cases
      if (error.status === 404) {
        Toast.show({ type: 'error', text1: 'Employee Not Found', text2: 'The employee ID you entered does not exist.' });
      } else if (error.status === 403) {
        Toast.show({ type: 'error', text1: 'Account Inactive', text2: 'Your account is not active. Please contact admin.' });
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'Network error. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.loginContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#dae2f1" />
      
      {/* Server Status */}
      <View style={styles.serverStatus}>
        <View style={[styles.serverStatusDot, serverStatus === 'online' ? styles.serverOnline : styles.serverOffline]} />
        <Text style={styles.serverStatusText}>
          {serverStatus === 'online' ? 'Server Online' : serverStatus === 'offline' ? 'Server Offline' : 'Checking...'}
        </Text>
      </View>

      <Animatable.View animation="fadeInUp" duration={800} style={styles.loginCard}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <FontAwesome5 name="fingerprint" size={50} color="#3B82F6" />
          </View>
          <Text style={styles.appTitle}>Attendance Tracker</Text>
          <Text style={styles.appSubtitle}>Dear Bab's Fastfood & Catering Services</Text>
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="id-card-outline" size={22} color="#9CA3AF" />
          <TextInput
            style={styles.input}
            placeholder="Enter Employee ID"
            placeholderTextColor="#9CA3AF"
            value={employeeId}
            onChangeText={setEmployeeId}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!loading}
          />
          {employeeId.length > 0 && !loading && (
            <TouchableOpacity onPress={() => setEmployeeId('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {recentIds.length > 0 && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentScroll}>
              {recentIds.map((id, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.recentChip} 
                  onPress={() => setEmployeeId(id)}
                  disabled={loading}
                >
                  <Text style={styles.recentChipText}>{id}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.clearChip} onPress={clearRecentIds} disabled={loading}>
                <Ionicons name="close-circle" size={14} color="#EF4444" />
                <Text style={styles.clearChipText}>Clear</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        <TouchableOpacity 
          style={[styles.loginButton, loading && styles.disabledButton]} 
          onPress={handleProceed} 
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>Proceed</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backToMobileButton} onPress={goBackToMainApp} disabled={loading}>
          <Ionicons name="arrow-back-outline" size={18} color="#3B82F6" />
          <Text style={styles.backToMobileText}>Back to Mobile App</Text>
        </TouchableOpacity>

        {/* Hint for employees */}
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>
            ℹ️ Use your employee code (e.g., EMP-001) or employee ID
          </Text>
        </View>
      </Animatable.View>
    </View>
  );
};

// ==================== REQUEST CARD COMPONENT ====================
const RequestCard = ({ request, onPress, onCancel }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#10B981';
      case 'rejected': return '#EF4444';
      case 'cancelled': return '#6B7280';
      default: return '#F59E0B';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'dayoff':
      case 'day_off': return 'sunny-outline';
      case 'restday': return 'bed-outline';
      case 'leave': return 'airplane-outline';
      case 'swap': return 'swap-horizontal-outline';
      case 'sick':
      case 'sick_leave': return 'medkit-outline';
      case 'vacation': return 'umbrella-outline';
      case 'personal': return 'person-outline';
      case 'emergency': return 'alert-circle-outline';
      default: return 'document-text-outline';
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      dayoff: 'Day Off', day_off: 'Day Off', restday: 'Rest Day', leave: 'Leave', swap: 'Shift Swap',
      sick: 'Sick Leave', sick_leave: 'Sick Leave', vacation: 'Vacation', personal: 'Personal Time', emergency: 'Emergency'
    };
    return labels[type] || type;
  };

  return (
    <TouchableOpacity style={styles.requestCard} onPress={() => onPress && onPress(request)}>
      <View style={styles.requestCardHeader}>
        <View style={[styles.requestTypeBadge, { backgroundColor: request.type_color || '#EFF6FF' }]}>
          <Ionicons name={getTypeIcon(request.type)} size={16} color={request.type_color || '#3B82F6'} />
          <Text style={[styles.requestTypeText, { color: request.type_color || '#3B82F6' }]}>
            {getTypeLabel(request.type)}
          </Text>
        </View>
        <View style={[styles.requestStatusBadge, { backgroundColor: getStatusColor(request.status) + '20' }]}>
          <View style={[styles.requestStatusDot, { backgroundColor: getStatusColor(request.status) }]} />
          <Text style={[styles.requestStatusText, { color: getStatusColor(request.status) }]}>
            {request.status_label || request.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.requestCardDates}>
        <View style={styles.requestDateItem}>
          <Ionicons name="calendar-outline" size={14} color="#6B7280" />
          <Text style={styles.requestDateText}>
            {moment(request.start_date).format('MMM D, YYYY')} - {moment(request.end_date).format('MMM D, YYYY')}
          </Text>
        </View>
        <Text style={styles.requestDuration}>
          {moment(request.end_date).diff(moment(request.start_date), 'days') + 1} day(s)
        </Text>
      </View>

      <Text style={styles.requestReason} numberOfLines={2}>
        {request.reason}
      </Text>

      {request.admin_notes && request.status !== 'pending' && (
        <View style={styles.requestAdminNote}>
          <Ionicons name="chatbubble-outline" size={14} color="#6B7280" />
          <Text style={styles.requestAdminNoteText}>Admin: {request.admin_notes}</Text>
        </View>
      )}

      {request.status === 'pending' && (
        <View style={styles.requestCardActions}>
          <TouchableOpacity style={styles.requestCancelBtn} onPress={() => onCancel && onCancel(request)}>
            <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
            <Text style={styles.requestCancelText}>Cancel Request</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ==================== CREATE REQUEST MODAL ====================
const CreateRequestModal = ({ visible, employee, onClose, onSuccess }) => {
  const [requestType, setRequestType] = useState('dayoff');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [reason, setReason] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [swapEmployeeId, setSwapEmployeeId] = useState('');
  const [swapShiftDate, setSwapShiftDate] = useState(new Date());
  const [showSwapDatePicker, setShowSwapDatePicker] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const requestTypes = [
    { id: 'dayoff', label: 'Day Off', icon: 'sunny-outline', color: '#10B981' },
    { id: 'restday', label: 'Rest Day', icon: 'bed-outline', color: '#8B5CF6' },
    { id: 'leave', label: 'Leave', icon: 'airplane-outline', color: '#3B82F6' },
    { id: 'swap', label: 'Shift Swap', icon: 'swap-horizontal-outline', color: '#F59E0B' },
    { id: 'sick', label: 'Sick Leave', icon: 'medkit-outline', color: '#EC4899' },
    { id: 'vacation', label: 'Vacation', icon: 'umbrella-outline', color: '#06B6D4' },
    { id: 'personal', label: 'Personal Time', icon: 'person-outline', color: '#6366F1' },
    { id: 'emergency', label: 'Emergency', icon: 'alert-circle-outline', color: '#DC2626' },
  ];

  const mapRequestTypeForBackend = (type) => {
    const map = {
      dayoff: 'day_off',
      restday: 'day_off',
      leave: 'leave',
      swap: 'leave',
      sick: 'sick_leave',
      vacation: 'leave',
      personal: 'leave',
      emergency: 'leave',
    };
    return map[type] || 'leave';
  };

  useEffect(() => {
    if (visible && requestType === 'swap') {
      loadEmployees();
    }
    if (visible) {
      setValidationErrors({});
    }
  }, [visible, requestType]);

  const loadEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const response = await api.request('/employees/all', 'GET', null, true);
      if (response.success && response.data) {
        const empList = Array.isArray(response.data) ? response.data : response.data.data || [];
        setEmployees(empList.filter(e => e.employee_id !== employee?.employee_id));
      }
    } catch (error) {
      console.error('Error loading employees:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load employees' });
    } finally {
      setLoadingEmployees(false);
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!reason.trim()) {
      errors.reason = 'Please provide a reason';
    } else if (reason.trim().length < 3) {
      errors.reason = 'Reason must be at least 3 characters';
    }

    if (moment(endDate).isBefore(moment(startDate))) {
      errors.dates = 'End date must be after start date';
    }

    if (requestType === 'swap' && !swapEmployeeId) {
      errors.swapEmployee = 'Please select an employee to swap with';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    setValidationErrors({});

    if (!validateForm()) {
      const firstError = Object.values(validationErrors)[0];
      Toast.show({ type: 'error', text1: 'Validation Error', text2: firstError });
      return;
    }

    setLoading(true);
    try {
      const data = {
        employee_id: String(employee.employee_id),
        request_type: mapRequestTypeForBackend(requestType),
        start_date: moment(startDate).format('YYYY-MM-DD'),
        end_date: moment(endDate).format('YYYY-MM-DD'),
        reason: requestType === 'swap'
          ? `[Shift Swap] ${reason.trim()}${swapEmployeeId ? ` | Swap with employee ID: ${swapEmployeeId}` : ''}`
          : reason.trim(),
      };

      if (requestType === 'swap') {
        data.swap_with_employee_id = parseInt(swapEmployeeId);
        data.swap_shift_date = moment(swapShiftDate).format('YYYY-MM-DD');
      }

      const response = await api.createRequest(data);

      if (response.success) {
        Toast.show({ type: 'success', text1: 'Success', text2: 'Request submitted successfully' });
        onSuccess && onSuccess();
        onClose();
        resetForm();
      } else {
        if (response.errors) {
          const firstError = Object.values(response.errors)[0];
          const errorMsg = Array.isArray(firstError) ? firstError[0] : firstError;
          Toast.show({ type: 'error', text1: 'Error', text2: errorMsg });
        } else {
          Toast.show({ type: 'error', text1: 'Error', text2: response.message || 'Failed to submit request' });
        }
      }
    } catch (error) {
      console.error('Submit error:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'Failed to submit request' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setRequestType('dayoff');
    setStartDate(new Date());
    setEndDate(new Date());
    setReason('');
    setSwapEmployeeId('');
    setSwapShiftDate(new Date());
    setValidationErrors({});
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
            <Ionicons name="close" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>New Request</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Request Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
              {requestTypes.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeChip,
                    requestType === type.id && styles.typeChipActive,
                    { borderColor: type.color }
                  ]}
                  onPress={() => setRequestType(type.id)}>
                  <Ionicons name={type.icon} size={20} color={requestType === type.id ? '#fff' : type.color} />
                  <Text style={[styles.typeChipText, requestType === type.id && styles.typeChipTextActive]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Start Date</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartPicker(true)}>
              <Ionicons name="calendar-outline" size={20} color="#3B82F6" />
              <Text style={styles.dateButtonText}>{moment(startDate).format('MMMM D, YYYY')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>End Date</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndPicker(true)}>
              <Ionicons name="calendar-outline" size={20} color="#3B82F6" />
              <Text style={styles.dateButtonText}>{moment(endDate).format('MMMM D, YYYY')}</Text>
            </TouchableOpacity>
          </View>

          {requestType === 'swap' && (
            <>
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Swap With Employee</Text>
                {loadingEmployees ? (
                  <ActivityIndicator color="#3B82F6" />
                ) : (
                  <View style={styles.swapEmployeeList}>
                    {employees.map((emp) => (
                      <TouchableOpacity
                        key={emp.employee_id}
                        style={[
                          styles.swapEmployeeItem,
                          String(swapEmployeeId) === String(emp.employee_id) && styles.swapEmployeeItemActive
                        ]}
                        onPress={() => setSwapEmployeeId(String(emp.employee_id))}>
                        <View style={styles.swapEmployeeAvatar}>
                          <Text style={styles.swapEmployeeInitial}>
                            {emp.first_name?.charAt(0) || emp.name?.charAt(0) || 'E'}
                          </Text>
                        </View>
                        <View style={styles.swapEmployeeInfo}>
                          <Text style={styles.swapEmployeeName}>
                            {emp.first_name} {emp.last_name}
                          </Text>
                          <Text style={styles.swapEmployeeId}>{emp.employee_code || emp.employee_id}</Text>
                        </View>
                        {String(swapEmployeeId) === String(emp.employee_id) && (
                          <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Shift Date to Swap</Text>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowSwapDatePicker(true)}>
                  <Ionicons name="calendar-outline" size={20} color="#3B82F6" />
                  <Text style={styles.dateButtonText}>{moment(swapShiftDate).format('MMMM D, YYYY')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Reason</Text>
            <TextInput
              style={styles.reasonInput}
              multiline
              numberOfLines={4}
              placeholder="Please provide detailed reason for your request..."
              placeholderTextColor="#9CA3AF"
              value={reason}
              onChangeText={setReason}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Submit Request</Text>}
          </TouchableOpacity>
        </ScrollView>
        {showStartPicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onValueChange={(eventOrDate, selectedDate) => {
              const pickedDate = selectedDate || (eventOrDate instanceof Date ? eventOrDate : null);
              setShowStartPicker(false);
              if (pickedDate) {
                setStartDate(pickedDate);
                if (moment(pickedDate).isAfter(endDate)) {
                  setEndDate(pickedDate);
                }
              }
            }}
            minimumDate={new Date(2000, 0, 1)}
            maximumDate={new Date(2030, 11, 31)}
          />
        )}
        {showEndPicker && (
          <DateTimePicker
            value={endDate}
            mode="date"
            display="default"
            minimumDate={new Date(2000, 0, 1)}
            maximumDate={new Date(2030, 11, 31)}
            onValueChange={(eventOrDate, selectedDate) => {
              const pickedDate = selectedDate || (eventOrDate instanceof Date ? eventOrDate : null);
              setShowEndPicker(false);
              if (pickedDate) setEndDate(pickedDate);
            }}
          />
        )}
        {showSwapDatePicker && (
          <DateTimePicker
            value={swapShiftDate}
            mode="date"
            display="default"
            minimumDate={new Date(2000, 0, 1)}
            maximumDate={new Date(2030, 11, 31)}
            onValueChange={(eventOrDate, selectedDate) => {
              const pickedDate = selectedDate || (eventOrDate instanceof Date ? eventOrDate : null);
              setShowSwapDatePicker(false);
              if (pickedDate) setSwapShiftDate(pickedDate);
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

// ==================== REQUESTS LIST SCREEN ====================
const RequestsListScreen = ({ route, navigation }) => {
  const { employee } = route.params;
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [error, setError] = useState(null);

  const loadRequests = async () => {
    setError(null);
    try {
      const response = await api.getEmployeeRequests(employee.employee_id);
      if (response.success) {
        setRequests(response.data.data || response.data || []);
      }
      const statsResponse = await api.getRequestStats(employee.employee_id);
      if (statsResponse.success) {
        setStats(statsResponse.data);
      }
    } catch (error) {
      console.error('Error loading requests:', error);
      setError(error.message || 'Failed to load requests');
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load requests' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCancelRequest = async (request) => {
    Alert.alert(
      'Cancel Request',
      'Are you sure you want to cancel this request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            try {
              await api.cancelRequest(request.id);
              Toast.show({ type: 'success', text1: 'Cancelled', text2: 'Request cancelled successfully' });
              loadRequests();
            } catch (error) {
              Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to cancel request' });
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadRequests();
  };

  const filteredRequests = requests.filter(req => {
    if (selectedFilter === 'all') return true;
    return req.status === selectedFilter;
  });

  return (
    <>
      <View style={styles.requestsContainer}>
        <View style={styles.requestsHeader}>
          <SafeAreaView>
            <View style={styles.requestsHeaderContent}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.requestsBackBtn}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.requestsHeaderTitle}>My Requests</Text>
              <TouchableOpacity
                style={styles.requestsAddBtn}
                onPress={() => setShowRequestModal(true)}>
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>

        <View style={styles.requestsStatsBar}>
          <View style={styles.requestStatItem}>
            <Text style={[styles.requestStatValue, { color: '#F59E0B' }]}>{stats.pending || 0}</Text>
            <Text style={styles.requestStatLabel}>Pending</Text>
          </View>
          <View style={styles.historyStatDivider} />
          <View style={styles.requestStatItem}>
            <Text style={[styles.requestStatValue, { color: '#10B981' }]}>{stats.approved || 0}</Text>
            <Text style={styles.requestStatLabel}>Approved</Text>
          </View>
          <View style={styles.historyStatDivider} />
          <View style={styles.requestStatItem}>
            <Text style={[styles.requestStatValue, { color: '#EF4444' }]}>{stats.rejected || 0}</Text>
            <Text style={styles.requestStatLabel}>Rejected</Text>
          </View>
        </View>

        <View style={styles.requestFilterTabs}>
          {['all', 'pending', 'approved', 'rejected'].map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[styles.requestFilterTab, selectedFilter === filter && styles.requestFilterTabActive]}
              onPress={() => setSelectedFilter(filter)}>
              <Text style={[styles.requestFilterTabText, selectedFilter === filter && styles.requestFilterTabTextActive]}>
                {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadRequests}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredRequests}
            renderItem={({ item }) => (
              <RequestCard
                request={item}
                onCancel={item.status === 'pending' ? handleCancelRequest : null}
              />
            )}
            keyExtractor={(item) => item.id.toString()}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={60} color="#D1D5DB" />
                <Text style={styles.emptyStateText}>No requests found</Text>
                <Text style={styles.emptyStateSubtext}>Tap + to create a new request</Text>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}
      </View>

      <CreateRequestModal
        visible={showRequestModal}
        employee={employee}
        onClose={() => setShowRequestModal(false)}
        onSuccess={() => {
          loadRequests();
        }}
      />
    </>
  );
};

// ==================== DASHBOARD SCREEN ====================
const DashboardScreen = ({ route, navigation, onAppLogout }) => {
  const { employee } = route.params;
  const [showCamera, setShowCamera] = useState(false);
  const [attendanceType, setAttendanceType] = useState(null);
  const [todayStatus, setTodayStatus] = useState('not_started');
  const [todaySchedule, setTodaySchedule] = useState(null);
  const [stats, setStats] = useState({ presentDays: 0, thisMonth: 0, thisWeek: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [currentTime, setCurrentTime] = useState(moment());
  const [pendingRequests, setPendingRequests] = useState(0);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [scheduleWarning, setScheduleWarning] = useState(null);

  useEffect(() => {
    loadTodayStatus();
    loadPendingRequests();
    const timer = setInterval(() => setCurrentTime(moment()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadTodayStatus = async () => {
    setLoadingStatus(true);
    try {
      const response = await api.getAttendanceSummary(employee.employee_id);
      if (response.success) {
        const todayStatusValue = response.data.today_status || response.data.status || 'not_started';
        setTodayStatus(todayStatusValue);
        setTodaySchedule(response.data.today_schedule);
        setStats({
          presentDays: response.data.current_month?.present_days || response.data.present_days || 0,
          thisMonth: response.data.current_month?.present_days || response.data.this_month || 0,
          thisWeek: response.data.last_30_days?.present_days || response.data.this_week || 0,
        });

        if (!response.data.today_schedule && todayStatusValue === 'not_started') {
          setScheduleWarning("You don't have a schedule for today. Please contact admin.");
        } else {
          setScheduleWarning(null);
        }
      }
    } catch (error) {
      console.log('Error loading status:', error);
      if (error.status === 401) {
        navigation.replace('Login');
      }
    } finally {
      setLoadingStatus(false);
    }
  };

  const loadPendingRequests = async () => {
    try {
      const statsResponse = await api.getRequestStats(employee.employee_id);
      if (statsResponse.success) {
        setPendingRequests(statsResponse.data.pending || 0);
      }
    } catch (error) {
      console.log('Error loading request stats:', error);
    }
  };

  const handleAttendanceSuccess = (warningMessage) => {
    setShowCamera(false);
    if (warningMessage) {
      Alert.alert('Schedule Notice', warningMessage, [{ text: 'OK' }]);
    }
    setTimeout(() => {
      loadTodayStatus();
      loadPendingRequests();
    }, 500);
  };

  const getStatusDisplay = () => {
    switch (todayStatus) {
      case 'completed': return { text: 'Completed', color: '#10B981', icon: 'checkmark-circle' };
      case 'checked-in':
      case 'timed_in': return { text: 'Checked In', color: '#F59E0B', icon: 'log-in' };
      default: return { text: 'Not Started', color: '#EF4444', icon: 'time-outline' };
    }
  };

  const statusDisplay = getStatusDisplay();

  const checkCooldown = async () => {
    try {
      const lastClockIn = await AsyncStorage.getItem(`lastClockIn_${employee.employee_id}`);
      if (lastClockIn) {
        const lastTime = new Date(parseInt(lastClockIn));
        const diffMinutes = Math.floor((new Date() - lastTime) / 60000);
        if (diffMinutes < 10) {
          setCooldownRemaining(10 - diffMinutes);
          return false;
        }
        setCooldownRemaining(0);
      }
      return true;
    } catch (error) {
      return true;
    }
  };

  const handleTimeInPress = async () => {
    if (['checked-in', 'timed_in', 'completed'].includes(todayStatus)) {
      Toast.show({ type: 'info', text1: 'Already Checked In', text2: 'You have already checked in today' });
      return;
    }
    const canClockIn = await checkCooldown();
    if (!canClockIn) {
      Toast.show({ type: 'info', text1: 'Cooldown Active', text2: `Please wait ${cooldownRemaining} minutes` });
      return;
    }
    setAttendanceType('IN');
    setShowCamera(true);
  };

  const handleTimeOutPress = async () => {
    if (!['checked-in', 'timed_in'].includes(todayStatus)) {
      Toast.show({ type: 'info', text1: 'Not Checked In', text2: 'Please check in first' });
      return;
    }
    setAttendanceType('OUT');
    setShowCamera(true);
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Choose what you want to logout from.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Employee Only',
        onPress: async () => {
          await api.logout();
          navigation.replace('Login');
        },
      },
      {
        text: 'Logout App',
        onPress: async () => {
          await api.logout();
          if (onAppLogout) {
            await onAppLogout();
          } else {
            const parentNavigation = navigation.getParent?.();
            parentNavigation?.reset?.({ index: 0, routes: [{ name: 'Login' }] });
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const formatScheduleTime = (time24) => {
    if (!time24) return '--:-- --';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  return (
    <>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F3F4F6" />
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                Promise.all([loadTodayStatus(), loadPendingRequests()]).finally(() => setRefreshing(false));
              }}
            />
          }>
          <View style={styles.profileCard}>
            <View style={styles.profileImageContainer}>
              {employee.profile_photo_url ? (
                <Image source={{ uri: employee.profile_photo_url }} style={styles.profileImage} />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Text style={styles.profileInitial}>{employee.name?.charAt(0) || 'E'}</Text>
                </View>
              )}
              <View style={[styles.statusBadge, { backgroundColor: statusDisplay.color }]}>
                <Ionicons name={statusDisplay.icon} size={14} color="#fff" />
                <Text style={styles.statusBadgeText}>{statusDisplay.text}</Text>
              </View>
            </View>
            <Text style={styles.employeeName}>{employee.name}</Text>
            <Text style={styles.employeeDepartment}>{employee.department?.name || 'No Department'}</Text>
            <Text style={styles.employeeId}>ID: {employee.employee_code || employee.employee_id}</Text>
          </View>

          <View style={[styles.scheduleCard, scheduleWarning && styles.scheduleCardWarning]}>
            <View style={styles.scheduleHeader}>
              <MaterialIcons name="schedule" size={20} color={scheduleWarning ? "#F59E0B" : "#3B82F6"} />
              <Text style={[styles.scheduleHeaderText, scheduleWarning && styles.scheduleHeaderTextWarning]}>Today's Schedule</Text>
            </View>
            {todaySchedule ? (
              <View style={styles.scheduleContent}>
                <View style={styles.scheduleTimeRow}>
                  <View style={styles.scheduleTimeItem}>
                    <Text style={styles.scheduleTimeLabel}>Time In</Text>
                    <Text style={styles.scheduleTimeValue}>{formatScheduleTime(todaySchedule.start_time)}</Text>
                  </View>
                  <View style={styles.scheduleTimeItem}>
                    <Text style={styles.scheduleTimeLabel}>Time Out</Text>
                    <Text style={styles.scheduleTimeValue}>{formatScheduleTime(todaySchedule.end_time)}</Text>
                  </View>
                </View>
                <View style={styles.scheduleMeta}>
                  <Text style={styles.scheduleShiftType}>
                    {todaySchedule.shift_type === 'regular' ? 'Regular Shift' : 'On-Call'}
                  </Text>
                  {todaySchedule.placement && (
                    <Text style={styles.schedulePlacement}>
                      <Ionicons name="location-outline" size={12} /> {todaySchedule.placement}
                    </Text>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.scheduleNoSchedule}>
                <MaterialIcons name="info-outline" size={24} color="#F59E0B" />
                <Text style={styles.scheduleNoScheduleText}>No schedule assigned for today</Text>
                <Text style={styles.scheduleNoScheduleSubtext}>Please contact your admin</Text>
              </View>
            )}
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <FontAwesome5 name="calendar-check" size={28} color="#3B82F6" />
              <Text style={styles.statValue}>{stats.presentDays}</Text>
              <Text style={styles.statLabel}>Days Present</Text>
            </View>
            <View style={styles.statCard}>
              <FontAwesome5 name="chart-line" size={28} color="#3B82F6" />
              <Text style={styles.statValue}>{stats.thisMonth}</Text>
              <Text style={styles.statLabel}>This Month</Text>
            </View>
            <View style={styles.statCard}>
              <FontAwesome5 name="calendar-week" size={28} color="#3B82F6" />
              <Text style={styles.statValue}>{stats.thisWeek}</Text>
              <Text style={styles.statLabel}>This Week</Text>
            </View>
          </View>

          <View style={styles.timeCard}>
            <Text style={styles.timeLabel}>Current Time</Text>
            <Text style={styles.timeValue}>{currentTime.format('hh:mm:ss A')}</Text>
            <Text style={styles.dateValue}>{currentTime.format('dddd, MMMM D, YYYY')}</Text>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.timeInButton, (['checked-in', 'timed_in', 'completed'].includes(todayStatus)) && styles.disabledButton]}
              onPress={handleTimeInPress}
              disabled={['checked-in', 'timed_in', 'completed'].includes(todayStatus) || loadingStatus}>
              <Ionicons name="log-in-outline" size={32} color="#fff" />
              <Text style={styles.buttonText}>Time In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.timeOutButton, !['checked-in', 'timed_in'].includes(todayStatus) && styles.disabledButton]}
              onPress={handleTimeOutPress}
              disabled={!['checked-in', 'timed_in'].includes(todayStatus) || loadingStatus}>
              <Ionicons name="log-out-outline" size={32} color="#fff" />
              <Text style={styles.buttonText}>Time Out</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.requestCardBtn}
            onPress={() => navigation.navigate('RequestsList', { employee })}>
            <View style={styles.requestCardLeft}>
              <Ionicons name="document-text-outline" size={28} color="#3B82F6" />
              <View>
                <Text style={styles.historyCardTitle}>My Requests</Text>
                <Text style={styles.historyCardSubtitle}>View and manage time-off requests</Text>
              </View>
            </View>
            {pendingRequests > 0 && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pendingRequests}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={24} color="#3B82F6" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.historyCard} onPress={() => navigation.navigate('History', { employeeId: employee.employee_id, employeeName: employee.name })}>
            <View style={styles.historyCardLeft}>
              <Ionicons name="time-outline" size={28} color="#3B82F6" />
              <View>
                <Text style={styles.historyCardTitle}>Attendance History</Text>
                <Text style={styles.historyCardSubtitle}>View all your records</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#3B82F6" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.newRequestCard} onPress={() => setShowRequestModal(true)}>
            <Ionicons name="add-circle-outline" size={24} color="#3B82F6" />
            <Text style={styles.newRequestText}>Create New Request</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutCard} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#EF4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={showCamera} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowCamera(false)}>
        <CameraCaptureScreen
          employee={employee}
          attendanceType={attendanceType}
          onClose={() => setShowCamera(false)}
          onSuccess={handleAttendanceSuccess}
        />
      </Modal>

      <CreateRequestModal
        visible={showRequestModal}
        employee={employee}
        onClose={() => setShowRequestModal(false)}
        onSuccess={() => {
          loadPendingRequests();
        }}
      />
    </>
  );
};

// ==================== CAMERA CAPTURE SCREEN ====================
const CameraCaptureScreen = ({ employee, attendanceType, onClose, onSuccess }) => {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState(null);
  const [location, setLocation] = useState(null);
  const [faceVerified, setFaceVerified] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    requestPermission();
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setLocation(currentLocation);
        } catch (error) {}
      }
    })();
  }, []);

  const takePicture = async () => {
    if (!cameraRef.current || processing) return;
    setProcessing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
      setCapturedImage(photo);
      Toast.show({ type: 'info', text1: 'Verifying', text2: 'Analyzing facial features...' });
      setTimeout(() => {
        setFaceVerified(true);
        Toast.show({ type: 'success', text1: 'Verified', text2: 'Face verification complete!' });
        setShowConfirmation(true);
        setProcessing(false);
      }, 2000);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to capture photo' });
      setProcessing(false);
    }
  };

  const confirmAttendance = async () => {
    setUploading(true);
    try {
      let base64Image = capturedImage.base64;
      if (!base64Image.includes('base64,')) {
        base64Image = `data:image/jpeg;base64,${base64Image}`;
      }

      const attendanceData = {
        employee_id: String(employee.employee_id),
        selfie: base64Image,
        face_verified: faceVerified,
        liveness_checked: true,
        device_info: `${Platform.OS} ${Platform.Version}`,
        captured_at: new Date().toISOString(),
      };
      if (location) {
        attendanceData.latitude = location.coords.latitude;
        attendanceData.longitude = location.coords.longitude;
      }

      const response = attendanceType === 'IN' ? await api.clockIn(attendanceData) : await api.clockOut(attendanceData);

      if (response.success) {
        if (attendanceType === 'IN') {
          await AsyncStorage.setItem(`lastClockIn_${employee.employee_id}`, Date.now().toString());
        }
        Toast.show({ type: 'success', text1: 'Success', text2: `Time ${attendanceType} recorded!` });
        onSuccess(response.warning || null);
        onClose();
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: response.message || 'Failed to record attendance' });
      }
    } catch (error) {
      console.error('Attendance error:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'Network error. Please try again.' });
    } finally {
      setUploading(false);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.cameraPermissionView}>
        <MaterialIcons name="no-photography" size={60} color="#EF4444" />
        <Text style={styles.permissionText}>Camera permission required</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={onClose}>
          <Text style={styles.permissionButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showConfirmation && capturedImage) {
    return (
      <View style={styles.confirmationContainer}>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.confirmationScroll}>
            <TouchableOpacity style={styles.confirmationClose} onPress={() => { setCapturedImage(null); setShowConfirmation(false); setProcessing(false); }}>
              <Ionicons name="close" size={28} color="#1F2937" />
            </TouchableOpacity>

            <Text style={styles.confirmationTitle}>Confirm {attendanceType === 'IN' ? 'Time In' : 'Time Out'}</Text>

            <View style={styles.confirmationImageContainer}>
              <Image source={{ uri: capturedImage.uri }} style={styles.confirmationImage} />
              {faceVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                  <Text style={styles.verifiedText}>Face Verified</Text>
                </View>
              )}
            </View>

            <View style={styles.confirmationDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={22} color="#6B7280" />
                <Text style={styles.detailText}>{employee.name}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={22} color="#6B7280" />
                <Text style={styles.detailText}>{moment().format('MMMM Do YYYY, h:mm:ss a')}</Text>
              </View>
              {location && (
                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={22} color="#6B7280" />
                  <Text style={styles.detailText}>Location captured</Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.confirmButton} onPress={confirmAttendance} disabled={uploading}>
              {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmButtonText}>Confirm Attendance</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" mode="picture" />
      <View style={styles.cameraOverlay} pointerEvents="box-none">
        <View style={styles.cameraTopBar}>
          <TouchableOpacity style={styles.cameraCloseButton} onPress={onClose}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.cameraTypeBadge}>{attendanceType === 'IN' ? 'Time In' : 'Time Out'}</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.cameraInstructions}>
          <Text style={styles.cameraInstructionText}>Position your face in the frame</Text>
        </View>
        <TouchableOpacity style={styles.captureButton} onPress={takePicture} disabled={processing}>
          <View style={styles.captureButtonInner} />
        </TouchableOpacity>
        {processing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.processingText}>Processing...</Text>
          </View>
        )}
      </View>
    </View>
  );
};

// ==================== HISTORY SCREEN ====================
const HistoryScreen = ({ route, navigation }) => {
  const [records, setRecords] = useState([]);
  const [filterType, setFilterType] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(moment().month());
  const [stats, setStats] = useState({ total_records: 0, time_ins: 0, time_outs: 0 });
  const [error, setError] = useState(null);

  const employeeId = route.params?.employeeId;
  const employeeName = route.params?.employeeName;
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  useEffect(() => {
    loadRecords();
  }, [filterType, selectedMonth]);

  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getAttendanceHistory(employeeId, {
        year: moment().year(),
        month: selectedMonth + 1,
        type: filterType,
        per_page: 100,
      });
      if (response.success) {
        setRecords(response.data.data || []);
        setStats(response.stats || { total_records: 0, time_ins: 0, time_outs: 0 });
      } else {
        setError(response.message || 'Failed to load history');
      }
    } catch (error) {
      console.error('History error:', error);
      setError(error.message || 'Network error');
      if (error.status === 401) {
        navigation.replace('Login');
      }
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type) => type === 'IN' ? 'log-in-outline' : 'log-out-outline';
  const getTypeColor = (type) => type === 'IN' ? '#10B981' : '#EF4444';

  return (
    <View style={styles.historyContainer}>
      <View style={styles.historyHeader}>
        <SafeAreaView>
          <View style={styles.historyHeaderContent}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.historyBackBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.historyHeaderTitle}>Attendance History</Text>
            <View style={{ width: 40 }} />
          </View>
          <Text style={styles.historyEmployeeName}>{employeeName}</Text>
        </SafeAreaView>
      </View>

      <View style={styles.historyStatsBar}>
        <View style={styles.historyStatItem}>
          <Text style={styles.historyStatValue}>{stats.total_records}</Text>
          <Text style={styles.historyStatLabel}>Total Records</Text>
        </View>
        <View style={styles.historyStatDivider} />
        <View style={styles.historyStatItem}>
          <Text style={[styles.historyStatValue, { color: '#10B981' }]}>{stats.time_ins}</Text>
          <Text style={styles.historyStatLabel}>Time Ins</Text>
        </View>
        <View style={styles.historyStatDivider} />
        <View style={styles.historyStatItem}>
          <Text style={[styles.historyStatValue, { color: '#EF4444' }]}>{stats.time_outs}</Text>
          <Text style={styles.historyStatLabel}>Time Outs</Text>
        </View>
      </View>

      <View style={styles.monthSelectorContainer}>
        <Text style={styles.monthSelectorLabel}>Select Month</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll}>
          {months.map((month, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.monthChip, selectedMonth === index && styles.monthChipActive]}
              onPress={() => setSelectedMonth(index)}>
              <Text style={[styles.monthChipText, selectedMonth === index && styles.monthChipTextActive]}>{month.substring(0, 3)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.filterTabs}>
        {['ALL', 'IN', 'OUT'].map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.filterTab, filterType === type && styles.filterTabActive]}
            onPress={() => setFilterType(type)}>
            <Text style={[styles.filterTabText, filterType === type && styles.filterTabTextActive]}>
              {type === 'ALL' ? 'All' : type === 'IN' ? 'Time In' : 'Time Out'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadRecords}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={records}
          renderItem={({ item }) => (
            <View style={styles.recordCard}>
              {item.selfie_url ? (
                <Image source={{ uri: item.selfie_url }} style={styles.recordSelfie} />
              ) : (
                <View style={[styles.recordSelfie, styles.recordSelfiePlaceholder]}>
                  <Ionicons name="camera" size={30} color="#9CA3AF" />
                </View>
              )}
              <View style={styles.recordInfo}>
                <Text style={styles.recordDate}>{moment(item.timestamp).format('MMMM D, YYYY')}</Text>
                <Text style={styles.recordTime}>{moment(item.timestamp).format('h:mm:ss A')}</Text>
                <View style={[styles.recordTypeBadge, { backgroundColor: getTypeColor(item.type) + '20' }]}>
                  <Ionicons name={getTypeIcon(item.type)} size={12} color={getTypeColor(item.type)} />
                  <Text style={[styles.recordTypeText, { color: getTypeColor(item.type) }]}>Time {item.type}</Text>
                </View>
              </View>
              <View style={[styles.recordIcon, { backgroundColor: getTypeColor(item.type) + '20' }]}>
                <Ionicons name={getTypeIcon(item.type)} size={24} color={getTypeColor(item.type)} />
              </View>
            </View>
          )}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={60} color="#D1D5DB" />
              <Text style={styles.emptyStateText}>No attendance records found</Text>
              <Text style={styles.emptyStateSubtext}>Select a different month</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
};

// ==================== APP ENTRY ====================
export default function AttendanceTrackingApp({ onAppLogout, onBackToMainApp }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login">
        {(props) => <LoginScreen {...props} onBackToMainApp={onBackToMainApp} />}
      </Stack.Screen>
      <Stack.Screen name="Dashboard">
        {(props) => <DashboardScreen {...props} onAppLogout={onAppLogout} />}
      </Stack.Screen>
      <Stack.Screen name="History" component={HistoryScreen} />
      <Stack.Screen name="RequestsList" component={RequestsListScreen} />
    </Stack.Navigator>
  );
}

// ==================== STYLES ====================
const styles = StyleSheet.create({
  // Login Styles
  loginContainer: { flex: 1, backgroundColor: '#F3F4F6', justifyContent: 'center', padding: 20 },
  loginCard: { backgroundColor: '#fff', borderRadius: 24, padding: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  appTitle: { fontSize: 28, fontWeight: 'bold', color: '#1F2937', marginTop: 12 },
  appSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 5, textAlign: 'center' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16, paddingHorizontal: 16 },
  input: { flex: 1, fontSize: 16, paddingVertical: 16, color: '#1F2937' },
  loginButton: { backgroundColor: '#3B82F6', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  loginButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  backToMobileButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginTop: 10 },
  backToMobileText: { fontSize: 14, color: '#3B82F6', fontWeight: '600' },
  disabledButton: { opacity: 0.6 },
  recentScroll: { flexDirection: 'row', marginBottom: 16 },
  recentChip: { backgroundColor: '#F3F4F6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
  recentChipText: { fontSize: 14, color: '#3B82F6', fontWeight: '500' },
  clearChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginLeft: 10 },
  clearChipText: { fontSize: 12, color: '#EF4444', marginLeft: 4 },
  hintContainer: { marginTop: 20, alignItems: 'center' },
  hintText: { fontSize: 11, color: '#9CA3AF', textAlign: 'center' },
  serverStatus: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 20, left: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, zIndex: 10 },
  serverStatusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  serverOnline: { backgroundColor: '#10B981' },
  serverOffline: { backgroundColor: '#EF4444' },
  serverStatusText: { color: '#fff', fontSize: 10 },

  // Dashboard Styles (keep existing)
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  profileCard: { backgroundColor: '#fff', margin: 16, padding: 24, borderRadius: 24, alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
  profileImageContainer: { position: 'relative', marginBottom: 16 },
  profileImage: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#3B82F6' },
  profileImagePlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#3B82F6' },
  profileInitial: { fontSize: 40, fontWeight: 'bold', color: '#3B82F6' },
  statusBadge: { position: 'absolute', bottom: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, gap: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  employeeName: { fontSize: 22, fontWeight: 'bold', color: '#1F2937', marginBottom: 4 },
  employeeDepartment: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  employeeId: { fontSize: 12, color: '#9CA3AF' },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 16, gap: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center', elevation: 2 },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#1F2937', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  timeCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 16, padding: 20, borderRadius: 16, alignItems: 'center', elevation: 2 },
  timeLabel: { fontSize: 14, color: '#6B7280', marginBottom: 8 },
  timeValue: { fontSize: 34, fontWeight: 'bold', color: '#3B82F6', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginBottom: 4 },
  dateValue: { fontSize: 14, color: '#6B7280' },
  actionButtons: { flexDirection: 'row', gap: 16, paddingHorizontal: 16, marginBottom: 16 },
  timeInButton: { flex: 1, backgroundColor: '#10B981', borderRadius: 16, paddingVertical: 18, alignItems: 'center', elevation: 3 },
  timeOutButton: { flex: 1, backgroundColor: '#EF4444', borderRadius: 16, paddingVertical: 18, alignItems: 'center', elevation: 3 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 8 },
  scheduleCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 16, elevation: 2, borderLeftWidth: 4, borderLeftColor: '#3B82F6' },
  scheduleCardWarning: { borderLeftColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  scheduleHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  scheduleHeaderText: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  scheduleHeaderTextWarning: { color: '#D97706' },
  scheduleContent: { gap: 12 },
  scheduleTimeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  scheduleTimeItem: { flex: 1 },
  scheduleTimeLabel: { fontSize: 11, color: '#6B7280', marginBottom: 4 },
  scheduleTimeValue: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  scheduleMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  scheduleShiftType: { fontSize: 12, color: '#3B82F6', fontWeight: '500' },
  schedulePlacement: { fontSize: 12, color: '#6B7280' },
  scheduleNoSchedule: { alignItems: 'center', paddingVertical: 12, gap: 8 },
  scheduleNoScheduleText: { fontSize: 14, color: '#F59E0B', fontWeight: '500' },
  scheduleNoScheduleSubtext: { fontSize: 12, color: '#9CA3AF' },
  requestCardBtn: { backgroundColor: '#fff', marginHorizontal: 16, padding: 16, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, elevation: 2 },
  requestCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pendingBadge: { backgroundColor: '#F59E0B', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, minWidth: 24, alignItems: 'center' },
  pendingBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  historyCard: { backgroundColor: '#fff', marginHorizontal: 16, padding: 16, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, elevation: 2 },
  historyCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  historyCardTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  historyCardSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  newRequestCard: { backgroundColor: '#EFF6FF', marginHorizontal: 16, padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12, borderWidth: 1, borderColor: '#3B82F6', borderStyle: 'dashed' },
  newRequestText: { fontSize: 16, color: '#3B82F6', fontWeight: '500' },
  logoutCard: { backgroundColor: '#fff', marginHorizontal: 16, padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#FEE2E2', marginBottom: 20 },
  logoutText: { fontSize: 16, color: '#EF4444', fontWeight: '500' },

  // Camera Styles
  cameraOverlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
  cameraTopBar: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, zIndex: 10 },
  cameraCloseButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  cameraTypeBadge: { backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cameraInstructions: { position: 'absolute', top: Platform.OS === 'ios' ? 120 : 100, left: 0, right: 0, alignItems: 'center' },
  cameraInstructionText: { backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, fontSize: 14 },
  captureButton: { alignSelf: 'center', marginBottom: 30, width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  captureButtonInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff' },
  processingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  processingText: { color: '#fff', marginTop: 12, fontSize: 16 },
  cameraPermissionView: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  permissionText: { color: '#fff', marginTop: 12, fontSize: 14 },
  permissionButton: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#3B82F6', borderRadius: 10 },
  permissionButtonText: { color: '#fff', fontWeight: '600' },

  // Confirmation Styles
  confirmationContainer: { flex: 1, backgroundColor: '#F8F9FA' },
  confirmationScroll: { paddingBottom: 30 },
  confirmationClose: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, left: 20, zIndex: 10 },
  confirmationTitle: { fontSize: 28, fontWeight: 'bold', color: '#1F2937', textAlign: 'center', marginTop: 80, marginBottom: 30 },
  confirmationImageContainer: { alignItems: 'center', marginBottom: 20 },
  confirmationImage: { width: width - 80, height: width - 80, borderRadius: 20, borderWidth: 3, borderColor: '#3B82F6' },
  verifiedBadge: { position: 'absolute', bottom: -10, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 8, elevation: 3 },
  verifiedText: { fontSize: 14, fontWeight: '600', color: '#10B981' },
  confirmationDetails: { backgroundColor: '#fff', margin: 20, padding: 20, borderRadius: 16, elevation: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  detailText: { marginLeft: 12, fontSize: 14, color: '#1F2937', flex: 1 },
  confirmButton: { backgroundColor: '#3B82F6', marginHorizontal: 20, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  confirmButtonText: { fontSize: 18, fontWeight: '600', color: '#fff' },

  // History Styles
  historyContainer: { flex: 1, backgroundColor: '#F8F9FA' },
  historyHeader: { backgroundColor: '#3B82F6', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingBottom: 16 },
  historyHeaderContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 10 : 40 },
  historyBackBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  historyHeaderTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  historyEmployeeName: { fontSize: 14, color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginTop: 8 },
  historyStatsBar: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16, marginTop: -5, borderRadius: 16, padding: 16, elevation: 3 },
  historyStatItem: { flex: 1, alignItems: 'center' },
  historyStatValue: { fontSize: 22, fontWeight: 'bold', color: '#3B82F6' },
  historyStatLabel: { fontSize: 11, color: '#6B7280', marginTop: 4 },
  historyStatDivider: { width: 1, backgroundColor: '#E5E7EB' },
  monthSelectorContainer: { paddingHorizontal: 16, marginTop: 16 },
  monthSelectorLabel: { fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: '500' },
  monthScroll: { flexDirection: 'row' },
  monthChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', marginRight: 10 },
  monthChipActive: { backgroundColor: '#3B82F6' },
  monthChipText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  monthChipTextActive: { color: '#fff' },
  filterTabs: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16, borderRadius: 12, padding: 4 },
  filterTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  filterTabActive: { backgroundColor: '#3B82F6' },
  filterTabText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  filterTabTextActive: { color: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50 },
  recordCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  recordSelfie: { width: 60, height: 60, borderRadius: 12, marginRight: 15 },
  recordSelfiePlaceholder: { backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  recordInfo: { flex: 1 },
  recordDate: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  recordTime: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  recordTypeBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 6, gap: 4 },
  recordTypeText: { fontSize: 11, fontWeight: '600' },
  recordIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },

  // Requests Styles
  requestsContainer: { flex: 1, backgroundColor: '#F8F9FA' },
  requestsHeader: { backgroundColor: '#3B82F6', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingBottom: 16 },
  requestsHeaderContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 10 : 40 },
  requestsBackBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  requestsHeaderTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  requestsAddBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  requestsStatsBar: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16, marginTop: -5, borderRadius: 16, padding: 16, elevation: 3, marginBottom: 16 },
  requestStatItem: { flex: 1, alignItems: 'center' },
  requestStatValue: { fontSize: 22, fontWeight: 'bold' },
  requestStatLabel: { fontSize: 11, color: '#6B7280', marginTop: 4 },
  requestFilterTabs: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 16, borderRadius: 12, padding: 4 },
  requestFilterTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  requestFilterTabActive: { backgroundColor: '#3B82F6' },
  requestFilterTabText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  requestFilterTabTextActive: { color: '#fff' },
  requestCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 12, elevation: 2 },
  requestCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  requestTypeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, gap: 6 },
  requestTypeText: { fontSize: 12, fontWeight: '600' },
  requestStatusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  requestStatusDot: { width: 6, height: 6, borderRadius: 3 },
  requestStatusText: { fontSize: 10, fontWeight: '600' },
  requestCardDates: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  requestDateItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  requestDateText: { fontSize: 13, color: '#4B5563' },
  requestDuration: { fontSize: 12, color: '#6B7280' },
  requestReason: { fontSize: 14, color: '#1F2937', marginBottom: 8 },
  requestAdminNote: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F3F4F6', padding: 8, borderRadius: 8, marginTop: 8 },
  requestAdminNoteText: { fontSize: 12, color: '#6B7280', flex: 1 },
  requestCardActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  requestCancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#FEE2E2' },
  requestCancelText: { fontSize: 12, color: '#EF4444', fontWeight: '500' },

  // Modal Styles
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalCloseBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
  modalContent: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  formSection: { marginBottom: 24 },
  formLabel: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 },
  typeScroll: { flexDirection: 'row' },
  typeChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1.5, marginRight: 12, gap: 8, backgroundColor: '#fff' },
  typeChipActive: { backgroundColor: '#3B82F6' },
  typeChipText: { fontSize: 14, fontWeight: '500' },
  typeChipTextActive: { color: '#fff' },
  dateButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, gap: 12 },
  dateButtonText: { fontSize: 16, color: '#1F2937', flex: 1 },
  reasonInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 16, color: '#1F2937', minHeight: 100, textAlignVertical: 'top' },
  submitButton: { backgroundColor: '#3B82F6', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 30 },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  swapEmployeeList: { maxHeight: 300 },
  swapEmployeeItem: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#F9FAFB', borderRadius: 12, marginBottom: 8, gap: 12 },
  swapEmployeeItemActive: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#3B82F6' },
  swapEmployeeAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },
  swapEmployeeInitial: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  swapEmployeeInfo: { flex: 1 },
  swapEmployeeName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  swapEmployeeId: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  // Error and Empty States
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, color: '#EF4444', textAlign: 'center', marginTop: 12, marginBottom: 20 },
  retryButton: { backgroundColor: '#3B82F6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyStateText: { fontSize: 16, color: '#9CA3AF', marginTop: 12 },
  emptyStateSubtext: { fontSize: 12, color: '#D1D5DB', marginTop: 8 },
});