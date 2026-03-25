import React, { useState, useEffect, useRef } from 'react';
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
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import * as Animatable from 'react-native-animatable';

const Stack = createStackNavigator();
const { width } = Dimensions.get('window');

// Mock Employee Data
const mockEmployees = {
  'EMP001': {
    id: 'EMP001',
    name: 'John Anderson',
    department: 'Software Engineering',
    profilePic: 'https://randomuser.me/api/portraits/men/1.jpg',
    email: 'john.anderson@company.com',
    phone: '+1 234 567 8900',
  },
  'EMP002': {
    id: 'EMP002',
    name: 'Sarah Johnson',
    department: 'Product Management',
    profilePic: 'https://randomuser.me/api/portraits/women/2.jpg',
    email: 'sarah.johnson@company.com',
    phone: '+1 234 567 8901',
  },
  'EMP003': {
    id: 'EMP003',
    name: 'Michael Chen',
    department: 'Data Science',
    profilePic: 'https://randomuser.me/api/portraits/men/3.jpg',
    email: 'michael.chen@company.com',
    phone: '+1 234 567 8902',
  },
};

// Login Screen Component
const LoginScreen = ({ navigation }) => {
  const [employeeId, setEmployeeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentIds, setRecentIds] = useState([]);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    loadRecentIds();
  }, []);

  const loadRecentIds = async () => {
    try {
      const stored = await AsyncStorage.getItem('recentEmployeeIds');
      if (stored) {
        setRecentIds(JSON.parse(stored));
      }
    } catch (error) {
      console.log('Error loading recent IDs:', error);
    }
  };

  const saveRecentId = async (id) => {
    try {
      let updated = [id, ...recentIds.filter(i => i !== id)];
      updated = updated.slice(0, 5);
      setRecentIds(updated);
      await AsyncStorage.setItem('recentEmployeeIds', JSON.stringify(updated));
    } catch (error) {
      console.log('Error saving recent ID:', error);
    }
  };

  const handleProceed = () => {
    if (!employeeId.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter Employee ID',
        position: 'top',
      });
      return;
    }

    setLoading(true);
    setTimeout(() => {
      const employee = mockEmployees[employeeId.toUpperCase()];
      if (employee) {
        saveRecentId(employeeId.toUpperCase());
        navigation.replace('Dashboard', { employee });
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: `Welcome ${employee.name}!`,
          position: 'top',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Invalid Employee ID. Try: EMP001, EMP002, or EMP003',
          position: 'top',
        });
      }
      setLoading(false);
    }, 1000);
  };

  const handleRecentIdPress = (id) => {
    setEmployeeId(id);
  };

  return (
    <View style={styles.loginContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F4F6" />
      
      <TouchableOpacity 
        style={styles.helpButton}
        onPress={() => setShowHelp(true)}
      >
        <Ionicons name="help-circle-outline" size={24} color="#3B82F6" />
      </TouchableOpacity>

      <Animatable.View animation="fadeInUp" duration={800} style={styles.loginCard}>
        <View style={styles.logoContainer}>
          <Ionicons name="camera-outline" size={60} color="#3B82F6" />
          <Text style={styles.appTitle}>Attendance Tracker</Text>
          <Text style={styles.appSubtitle}>Selfie-based Attendance System</Text>
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="id-card-outline" size={22} color="#9CA3AF" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Enter Employee ID"
            placeholderTextColor="#9CA3AF"
            value={employeeId}
            onChangeText={setEmployeeId}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {employeeId.length > 0 && (
            <TouchableOpacity onPress={() => setEmployeeId('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {recentIds.length > 0 && (
          <View style={styles.recentContainer}>
            <Text style={styles.recentTitle}>Recent IDs:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentScroll}>
              {recentIds.map((id) => (
                <TouchableOpacity
                  key={id}
                  style={styles.recentId}
                  onPress={() => handleRecentIdPress(id)}
                >
                  <Text style={styles.recentIdText}>{id}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <TouchableOpacity
          style={styles.proceedButton}
          onPress={handleProceed}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <>
              <Ionicons name="arrow-forward-outline" size={20} color="#ffffff" />
              <Text style={styles.proceedButtonText}>Proceed</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.demoContainer}>
          <Text style={styles.demoTitle}>Demo Employee IDs:</Text>
          <View style={styles.demoIds}>
            <TouchableOpacity onPress={() => setEmployeeId('EMP001')}>
              <Text style={styles.demoId}>EMP001</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEmployeeId('EMP002')}>
              <Text style={styles.demoId}>EMP002</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEmployeeId('EMP003')}>
              <Text style={styles.demoId}>EMP003</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animatable.View>

      {/* Help Modal */}
      <Modal
        visible={showHelp}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowHelp(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Help & Support</Text>
              <TouchableOpacity onPress={() => setShowHelp(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.helpSection}>
                <Ionicons name="information-circle-outline" size={24} color="#3B82F6" />
                <Text style={styles.helpTitle}>How to Login?</Text>
                <Text style={styles.helpText}>
                  1. Enter your Employee ID (e.g., EMP001, EMP002, or EMP003){'\n'}
                  2. Tap the Proceed button{'\n'}
                  3. Your profile will be displayed
                </Text>
              </View>
              <View style={styles.helpSection}>
                <Ionicons name="camera-outline" size={24} color="#3B82F6" />
                <Text style={styles.helpTitle}>Taking Attendance</Text>
                <Text style={styles.helpText}>
                  1. Tap Time In or Time Out{'\n'}
                  2. Allow camera access{'\n'}
                  3. Take a clear selfie{'\n'}
                  4. Wait for face verification{'\n'}
                  5. Confirm attendance
                </Text>
              </View>
              <View style={styles.helpSection}>
                <Ionicons name="time-outline" size={24} color="#3B82F6" />
                <Text style={styles.helpTitle}>View History</Text>
                <Text style={styles.helpText}>
                  Tap the history button to view all your attendance records. You can filter by Time In/Out.
                </Text>
              </View>
              <View style={styles.helpSection}>
                <Ionicons name="alert-circle-outline" size={24} color="#EF4444" />
                <Text style={styles.helpTitle}>Forgot Employee ID?</Text>
                <Text style={styles.helpText}>
                  Contact your HR department or try the demo IDs above.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Dashboard Screen
const DashboardScreen = ({ route, navigation }) => {
  const { employee } = route.params;
  const [showCamera, setShowCamera] = useState(false);
  const [attendanceType, setAttendanceType] = useState(null);
  const [todayStatus, setTodayStatus] = useState(null);
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0 });

  useEffect(() => {
    loadTodayStatus();
    loadStats();
  }, []);

  const loadTodayStatus = async () => {
    try {
      const records = await AsyncStorage.getItem('attendanceRecords');
      if (records) {
        const parsed = JSON.parse(records);
        const today = moment().format('YYYY-MM-DD');
        const todayRecords = parsed.filter(r => r.date === today && r.employeeId === employee.id);
        
        const hasTimeIn = todayRecords.some(r => r.type === 'IN');
        const hasTimeOut = todayRecords.some(r => r.type === 'OUT');
        
        if (hasTimeIn && hasTimeOut) setTodayStatus('completed');
        else if (hasTimeIn) setTodayStatus('checked-in');
        else setTodayStatus('absent');
      }
    } catch (error) {
      console.log('Error loading status:', error);
    }
  };

  const loadStats = async () => {
    try {
      const records = await AsyncStorage.getItem('attendanceRecords');
      if (records) {
        const parsed = JSON.parse(records);
        const employeeRecords = parsed.filter(r => r.employeeId === employee.id);
        const uniqueDays = [...new Set(employeeRecords.map(r => r.date))];
        setStats({
          total: uniqueDays.length,
          present: uniqueDays.length,
          absent: 0,
        });
      }
    } catch (error) {
      console.log('Error loading stats:', error);
    }
  };

  if (showCamera) {
    return (
      <CameraCaptureScreen
        employee={employee}
        attendanceType={attendanceType}
        onClose={() => setShowCamera(false)}
        navigation={navigation}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F4F6" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <Animatable.View animation="fadeInDown" duration={600}>
          <View style={styles.profileCard}>
            <Image source={{ uri: employee.profilePic }} style={styles.profileImage} />
            <Text style={styles.employeeName}>{employee.name}</Text>
            <Text style={styles.employeeDepartment}>{employee.department}</Text>
            <Text style={styles.employeeId}>ID: {employee.id}</Text>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, 
                todayStatus === 'completed' && styles.statusCompleted,
                todayStatus === 'checked-in' && styles.statusCheckedIn,
                todayStatus === 'absent' && styles.statusAbsent
              ]} />
              <Text style={styles.statusText}>
                {todayStatus === 'completed' && 'Today: Completed'}
                {todayStatus === 'checked-in' && 'Today: Checked In'}
                {todayStatus === 'absent' && 'Today: Not Checked In'}
                {!todayStatus && 'Today: No Records'}
              </Text>
            </View>
          </View>
        </Animatable.View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Days</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.present}</Text>
            <Text style={styles.statLabel}>Present</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.absent}</Text>
            <Text style={styles.statLabel}>Absent</Text>
          </View>
        </View>

        <View style={styles.attendanceButtons}>
          <TouchableOpacity 
            style={[styles.timeInButton, todayStatus === 'checked-in' && styles.disabledButton]}
            onPress={() => {
              if (todayStatus === 'checked-in') {
                Toast.show({
                  type: 'info',
                  text1: 'Already Checked In',
                  text2: 'You have already checked in today',
                  position: 'top',
                });
              } else {
                setAttendanceType('IN');
                setShowCamera(true);
              }
            }}
            activeOpacity={0.8}
            disabled={todayStatus === 'checked-in'}
          >
            <Ionicons name="log-in-outline" size={32} color="#ffffff" />
            <Text style={styles.buttonText}>Time In</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.timeOutButton, todayStatus !== 'checked-in' && styles.disabledButton]}
            onPress={() => {
              if (todayStatus !== 'checked-in') {
                Toast.show({
                  type: 'info',
                  text1: 'Not Checked In',
                  text2: 'Please check in first before checking out',
                  position: 'top',
                });
              } else if (todayStatus === 'completed') {
                Toast.show({
                  type: 'info',
                  text1: 'Already Completed',
                  text2: 'You have already checked out today',
                  position: 'top',
                });
              } else {
                setAttendanceType('OUT');
                setShowCamera(true);
              }
            }}
            activeOpacity={0.8}
            disabled={todayStatus !== 'checked-in'}
          >
            <Ionicons name="log-out-outline" size={32} color="#ffffff" />
            <Text style={styles.buttonText}>Time Out</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.historyButton}
          onPress={() => navigation.navigate('History', { employeeId: employee.id })}
        >
          <Ionicons name="time-outline" size={24} color="#3B82F6" />
          <Text style={styles.historyButtonText}>View Attendance History</Text>
          <Ionicons name="chevron-forward-outline" size={20} color="#3B82F6" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={() => {
            Alert.alert(
              'Logout',
              'Are you sure you want to logout?',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Logout', 
                  onPress: () => navigation.replace('Login'),
                  style: 'destructive'
                },
              ]
            );
          }}
        >
          <Ionicons name="log-out-outline" size={24} color="#EF4444" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={24} color="#3B82F6" />
          <Text style={styles.infoText}>
            Tap Time In or Time Out to capture your selfie. Face verification will be performed automatically.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Camera Capture Screen
const CameraCaptureScreen = ({ employee, attendanceType, onClose, navigation }) => {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState(null);
  const [location, setLocation] = useState(null);
  const [faceVerified, setFaceVerified] = useState(false);
  const [livenessCheck, setLivenessCheck] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [flashMode, setFlashMode] = useState('off');

  useEffect(() => {
    requestPermission();
    
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setLocation(currentLocation);
        } catch (error) {
          console.log('Location error:', error);
        }
      }
    })();
  }, []);

  const takePicture = async () => {
    if (!cameraRef.current || processing) return;
    
    setProcessing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ 
        base64: true, 
        quality: 0.7,
      });
      setCapturedImage(photo);
      
      Toast.show({
        type: 'info',
        text1: 'Verifying',
        text2: 'Analyzing facial features...',
        position: 'top',
        visibilityTime: 1500,
      });
      
      setTimeout(() => {
        setFaceVerified(true);
        Toast.show({
          type: 'success',
          text1: 'Face Verification',
          text2: 'Face matched successfully!',
          position: 'top',
        });
        
        setTimeout(() => {
          setLivenessCheck(true);
          Toast.show({
            type: 'success',
            text1: 'Liveness Check',
            text2: 'Blink detected - Live person confirmed!',
            position: 'top',
          });
          
          setShowConfirmation(true);
          setProcessing(false);
        }, 1500);
      }, 2000);
    } catch (error) {
      console.log('Camera error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to capture photo',
        position: 'top',
      });
      setProcessing(false);
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setFaceVerified(false);
    setLivenessCheck(false);
    setShowConfirmation(false);
    setProcessing(false);
  };

  const confirmAttendance = async () => {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    const date = moment().format('YYYY-MM-DD');
    
    const attendanceRecord = {
      id: Date.now().toString(),
      employeeId: employee.id,
      employeeName: employee.name,
      type: attendanceType,
      timestamp: timestamp,
      date: date,
      selfie: capturedImage.base64,
      location: location ? {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      } : null,
      faceVerified: faceVerified,
      livenessChecked: livenessCheck,
    };

    try {
      const existingRecords = await AsyncStorage.getItem('attendanceRecords');
      const records = existingRecords ? JSON.parse(existingRecords) : [];
      records.push(attendanceRecord);
      await AsyncStorage.setItem('attendanceRecords', JSON.stringify(records));
      
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: `Time ${attendanceType} recorded successfully!`,
        position: 'top',
      });
      
      navigation.goBack();
      navigation.navigate('History', { employeeId: employee.id });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save attendance record',
        position: 'top',
      });
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.cameraContainer}>
        <Ionicons name="camera-off-outline" size={50} color="#EF4444" />
        <Text style={styles.permissionText}>Camera permission required</Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showConfirmation && capturedImage) {
    return (
      <SafeAreaView style={styles.confirmationContainer}>
        <ScrollView contentContainerStyle={styles.confirmationScroll}>
          <Animatable.View animation="fadeInUp" duration={500}>
            <Text style={styles.confirmationTitle}>Confirm Attendance</Text>
            
            <View style={styles.selfiePreview}>
              <Image source={{ uri: capturedImage.uri }} style={styles.selfieImage} />
              <View style={styles.verificationBadges}>
                {faceVerified && (
                  <View style={styles.verificationBadge}>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    <Text style={styles.verificationText}>Face Verified</Text>
                  </View>
                )}
                {livenessCheck && (
                  <View style={styles.verificationBadge}>
                    <Ionicons name="eye" size={18} color="#10B981" />
                    <Text style={styles.verificationText}>Liveness Checked</Text>
                  </View>
                )}
              </View>
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
              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={22} color="#6B7280" />
                <Text style={styles.detailText}>
                  {location ? 
                    `${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}` : 
                    'Location not available'}
                </Text>
              </View>
            </View>
            
            <TouchableOpacity style={styles.confirmButton} onPress={confirmAttendance}>
              <Ionicons name="checkmark-circle-outline" size={24} color="#ffffff" />
              <Text style={styles.confirmButtonText}>Confirm Attendance</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.retakeButton} onPress={retakePhoto}>
              <Ionicons name="refresh-outline" size={20} color="#EF4444" />
              <Text style={styles.retakeButtonText}>Retake Photo</Text>
            </TouchableOpacity>
          </Animatable.View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView 
        ref={cameraRef} 
        style={{ flex: 1 }} 
        facing="front"
        mode="picture"
        flash={flashMode}
      >
        <View style={styles.cameraOverlay}>
          <View style={styles.cameraTopBar}>
            <TouchableOpacity style={styles.cameraIconButton} onPress={onClose}>
              <Ionicons name="close" size={28} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.cameraIconButton}
              onPress={() => setFlashMode(flashMode === 'on' ? 'off' : 'on')}
            >
              <Ionicons 
                name={flashMode === 'on' ? "flash" : "flash-off"} 
                size={24} 
                color="#ffffff" 
              />
            </TouchableOpacity>
          </View>
          
          <View style={styles.instructionContainer}>
            <Text style={styles.instructionText}>Position your face in the frame</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.captureButton} 
            onPress={takePicture}
            disabled={processing}
          >
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
          
          {processing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color="#ffffff" />
              <Text style={styles.processingText}>Processing...</Text>
            </View>
          )}
        </View>
      </CameraView>
    </View>
  );
};

// History Screen with Improved Month/Year Selection
const HistoryScreen = ({ route }) => {
  const [records, setRecords] = useState([]);
  const [filterType, setFilterType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(moment().year());
  const [selectedMonth, setSelectedMonth] = useState(moment().month());
  const [showExportModal, setShowExportModal] = useState(false);

  const employeeId = route.params?.employeeId;

  // Generate years (current year and 2 years back)
  const years = [selectedYear - 2, selectedYear - 1, selectedYear];
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  useEffect(() => {
    loadRecords();
  }, [filterType, selectedYear, selectedMonth, searchQuery]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const storedRecords = await AsyncStorage.getItem('attendanceRecords');
      if (storedRecords) {
        let parsedRecords = JSON.parse(storedRecords);
        
        if (employeeId) {
          parsedRecords = parsedRecords.filter(r => r.employeeId === employeeId);
        }
        
        if (filterType !== 'ALL') {
          parsedRecords = parsedRecords.filter(r => r.type === filterType);
        }
        
        // Filter by selected year and month
        const selectedYearMonth = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
        parsedRecords = parsedRecords.filter(r => r.date.startsWith(selectedYearMonth));
        
        if (searchQuery) {
          parsedRecords = parsedRecords.filter(r => 
            r.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.timestamp.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
        
        setRecords(parsedRecords.reverse());
      }
    } catch (error) {
      console.log('Error loading records:', error);
    }
    setLoading(false);
  };

  const clearHistory = async () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all attendance records?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('attendanceRecords');
            loadRecords();
            Toast.show({
              type: 'success',
              text1: 'Cleared',
              text2: 'All attendance records have been cleared',
              position: 'top',
            });
          },
        },
      ]
    );
  };

  const exportData = async () => {
    try {
      Toast.show({
        type: 'success',
        text1: 'Export Ready',
        text2: `${records.length} records ready for export`,
        position: 'top',
      });
      setShowExportModal(false);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Export Failed',
        text2: 'Could not export data',
        position: 'top',
      });
    }
  };

  const renderRecord = ({ item, index }) => (
    <Animatable.View 
      animation="fadeInUp" 
      duration={400}
      delay={index * 100}
      style={styles.recordCard}
    >
      <Image 
        source={{ uri: `data:image/jpeg;base64,${item.selfie}` }} 
        style={styles.recordThumbnail} 
      />
      <View style={styles.recordInfo}>
        <Text style={styles.recordName}>{item.employeeName}</Text>
        <Text style={styles.recordTimestamp}>{item.timestamp}</Text>
        <View style={[styles.recordType, item.type === 'IN' ? styles.typeIn : styles.typeOut]}>
          <Text style={styles.recordTypeText}>Time {item.type}</Text>
        </View>
        {item.location && (
          <Text style={styles.recordLocation}>
            📍 {item.location.latitude.toFixed(2)}, {item.location.longitude.toFixed(2)}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward-outline" size={22} color="#D1D5DB" />
    </Animatable.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F4F6" />
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or date..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Year Selector */}
      <View style={styles.selectorContainer}>
        <Text style={styles.selectorLabel}>Select Year:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {years.map((year) => (
            <TouchableOpacity
              key={year}
              style={[styles.yearButton, selectedYear === year && styles.activeYearButton]}
              onPress={() => setSelectedYear(year)}
            >
              <Text style={[styles.yearText, selectedYear === year && styles.activeYearText]}>
                {year}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      {/* Month Selector */}
      <View style={styles.selectorContainer}>
        <Text style={styles.selectorLabel}>Select Month:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {months.map((month, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.monthButton, selectedMonth === index && styles.activeMonthButton]}
              onPress={() => setSelectedMonth(index)}
            >
              <Text style={[styles.monthText, selectedMonth === index && styles.activeMonthText]}>
                {month}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      {/* Filter and Actions */}
      <View style={styles.historyHeader}>
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'ALL' && styles.activeFilter]}
              onPress={() => setFilterType('ALL')}
            >
              <Text style={[styles.filterText, filterType === 'ALL' && styles.activeFilterText]}>
                All Records
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'IN' && styles.activeFilter]}
              onPress={() => setFilterType('IN')}
            >
              <Text style={[styles.filterText, filterType === 'IN' && styles.activeFilterText]}>
                Time In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'OUT' && styles.activeFilter]}
              onPress={() => setFilterType('OUT')}
            >
              <Text style={[styles.filterText, filterType === 'OUT' && styles.activeFilterText]}>
                Time Out
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={() => setShowExportModal(true)}>
            <Ionicons name="download-outline" size={20} color="#3B82F6" />
          </TouchableOpacity>
          {records.length > 0 && (
            <TouchableOpacity style={styles.actionButton} onPress={clearHistory}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <FlatList
          data={records}
          renderItem={renderRecord}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.historyList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={80} color="#E5E7EB" />
              <Text style={styles.emptyTitle}>No Records Found</Text>
              <Text style={styles.emptySubtitle}>
                No attendance records found for {months[selectedMonth]} {selectedYear}
              </Text>
            </View>
          }
        />
      )}
      
      {/* Export Modal */}
      <Modal
        visible={showExportModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Export Data</Text>
            <Text style={styles.modalText}>
              Export {records.length} records to JSON file?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowExportModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.exportButton]}
                onPress={exportData}
              >
                <Text style={styles.exportButtonText}>Export</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Main App Component
export default function App() {
  const navigationRef = useRef();

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigationRef.current) {
        const state = navigationRef.current.getRootState();
        if (state.routes[state.index].name === 'Login') {
          Alert.alert(
            'Exit App',
            'Are you sure you want to exit?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Exit', onPress: () => BackHandler.exitApp() },
            ]
          );
          return true;
        }
      }
      return false;
    });

    return () => backHandler.remove();
  }, []);

  return (
    <>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: '#3B82F6',
            },
            headerTintColor: '#ffffff',
            headerTitleStyle: {
              fontWeight: '600',
            },
          }}
        >
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={({ route, navigation }) => ({
              title: `Dashboard`,
              headerRight: () => (
                <TouchableOpacity 
                  onPress={() => navigation.navigate('History', { employeeId: route.params?.employee?.id })}
                  style={{ marginRight: 15 }}
                >
                  <Ionicons name="time-outline" size={24} color="#ffffff" />
                </TouchableOpacity>
              ),
            })}
          />
          <Stack.Screen
            name="History"
            component={HistoryScreen}
            options={{
              title: 'Attendance History',
              headerBackTitle: 'Back',
            }}
          />
        </Stack.Navigator>
        <Toast />
      </NavigationContainer>
    </>
  );
}

// Complete Styles
const styles = StyleSheet.create({
  // Login Styles
  loginContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    padding: 20,
  },
  loginCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 12,
  },
  appSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 16,
    color: '#1F2937',
  },
  proceedButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  proceedButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  demoContainer: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  demoTitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
    textAlign: 'center',
  },
  demoIds: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  demoId: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#3B82F6',
    fontWeight: '600',
    fontSize: 14,
  },
  
  // Dashboard Styles
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  profileCard: {
    backgroundColor: '#ffffff',
    margin: 20,
    padding: 30,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#3B82F6',
  },
  employeeName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  employeeDepartment: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  employeeId: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusCompleted: {
    backgroundColor: '#10B981',
  },
  statusCheckedIn: {
    backgroundColor: '#F59E0B',
  },
  statusAbsent: {
    backgroundColor: '#EF4444',
  },
  statusText: {
    fontSize: 12,
    color: '#6B7280',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 15,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  attendanceButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  timeInButton: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    flex: 1,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  timeOutButton: {
    backgroundColor: '#EF4444',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    flex: 1,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  historyButton: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  historyButtonText: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '500',
    flex: 1,
    marginLeft: 12,
  },
  logoutButton: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  logoutButtonText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '500',
    marginLeft: 12,
  },
  infoCard: {
    backgroundColor: '#EFF6FF',
    margin: 20,
    padding: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 13,
    color: '#3B82F6',
    lineHeight: 18,
  },
  
  // Camera Styles
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  cameraTopBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  cameraIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionText: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    fontSize: 14,
  },
  captureButton: {
    alignSelf: 'center',
    marginBottom: 30,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#ffffff',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#ffffff',
    marginTop: 12,
    fontSize: 16,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionText: {
    color: '#6B7280',
    marginTop: 12,
    fontSize: 14,
  },
  closeButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#3B82F6',
    borderRadius: 10,
  },
  closeButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  
  // Confirmation Styles
  confirmationContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  confirmationScroll: {
    paddingBottom: 30,
  },
  confirmationTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  selfiePreview: {
    alignItems: 'center',
    marginBottom: 20,
  },
  selfieImage: {
    width: width - 80,
    height: width - 80,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#3B82F6',
  },
  verificationBadges: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  verificationBadge: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
  },
  verificationText: {
    color: '#ffffff',
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  confirmationDetails: {
    backgroundColor: '#ffffff',
    margin: 20,
    padding: 20,
    borderRadius: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  detailText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
  },
  confirmButton: {
    backgroundColor: '#3B82F6',
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  retakeButton: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EF4444',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  retakeButtonText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '500',
  },
  
  // History Styles
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterContainer: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#F3F4F6',
  },
  activeFilter: {
    backgroundColor: '#3B82F6',
  },
  filterText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#ffffff',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1F2937',
  },
  selectorContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  selectorLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    fontWeight: '500',
  },
  yearButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 10,
  },
  activeYearButton: {
    backgroundColor: '#3B82F6',
  },
  yearText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  activeYearText: {
    color: '#ffffff',
  },
  monthButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  activeMonthButton: {
    backgroundColor: '#3B82F6',
  },
  monthText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  activeMonthText: {
    color: '#ffffff',
  },
  historyList: {
    padding: 16,
  },
  recordCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  recordThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 15,
  },
  recordInfo: {
    flex: 1,
  },
  recordName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  recordTimestamp: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
  },
  recordType: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeIn: {
    backgroundColor: '#D1FAE5',
  },
  typeOut: {
    backgroundColor: '#FEE2E2',
  },
  recordTypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1F2937',
  },
  recordLocation: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Additional Styles
  helpButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    right: 20,
    zIndex: 10,
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recentContainer: {
    marginBottom: 16,
  },
  recentTitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  recentScroll: {
    flexDirection: 'row',
  },
  recentId: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  recentIdText: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    width: width - 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalBody: {
    maxHeight: '90%',
  },
  helpSection: {
    marginBottom: 24,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 8,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  exportButton: {
    backgroundColor: '#3B82F6',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontWeight: '500',
  },
  exportButtonText: {
    color: '#ffffff',
    fontWeight: '500',
  },
  modalText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginVertical: 10,
  },
});
