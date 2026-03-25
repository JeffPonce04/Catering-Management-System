// src/screens/DashboardScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Switch,
  StyleSheet,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';

const DashboardScreen = ({ navigation }) => {
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const theme = useTheme();

  useEffect(() => {
    loadEmployeeData();
  }, []);

  useEffect(() => {
    if (employee) {
      checkTodayAttendance();
    }
  }, [employee]);

  const loadEmployeeData = async () => {
    try {
      const emp = await SecureStore.getItemAsync('currentEmployee');
      if (emp) {
        setEmployee(JSON.parse(emp));
      }
    } catch (error) {
      console.error('Error loading employee:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkTodayAttendance = async () => {
    try {
      if (employee) {
        const logs = await SecureStore.getItemAsync('attendanceLogs');
        if (logs) {
          const parsedLogs = JSON.parse(logs);
          const today = new Date().toDateString();
          const todayLog = parsedLogs.find(log => 
            new Date(log.timestamp).toDateString() === today && log.employeeId === employee?.id
          );
          setTodayAttendance(todayLog);
        }
      }
    } catch (error) {
      console.error('Error checking attendance:', error);
    }
  };

  const handleAttendance = (type) => {
    navigation.navigate('Camera', { attendanceType: type });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },
    welcomeText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    nameText: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    themeToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    employeeCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 20,
      marginHorizontal: 16,
      marginBottom: 24,
      flexDirection: 'row',
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    profileImage: {
      width: 80,
      height: 80,
      borderRadius: 40,
      marginRight: 16,
    },
    employeeInfo: {
      flex: 1,
    },
    employeeName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    employeeDept: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    employeeId: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginHorizontal: 16,
      marginBottom: 12,
    },
    statusContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginHorizontal: 16,
      marginBottom: 24,
      gap: 12,
    },
    statusCard: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
    },
    statusCardIn: {
      backgroundColor: '#D1FAE5',
    },
    statusCardOut: {
      backgroundColor: '#FEE2E2',
    },
    statusText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginTop: 8,
    },
    statusTime: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    actionButton: {
      backgroundColor: '#3B82F6',
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 16,
      marginBottom: 12,
    },
    actionButtonDisabled: {
      backgroundColor: '#9CA3AF',
    },
    actionButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    infoText: {
      textAlign: 'center',
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 16,
      marginBottom: 20,
      paddingHorizontal: 16,
    },
  });

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.nameText}>{employee?.name}</Text>
        </View>
        <View style={styles.themeToggle}>
          <Icon name="moon-outline" size={20} color={theme.colors.textSecondary} />
          <Switch
            value={theme.isDarkMode}
            onValueChange={theme.toggleTheme}
            trackColor={{ false: '#767577', true: '#3B82F6' }}
            thumbColor={theme.isDarkMode ? '#fff' : '#f4f3f4'}
          />
          <Icon name="sunny-outline" size={20} color={theme.colors.textSecondary} />
        </View>
      </View>

      <View style={styles.employeeCard}>
        <Image source={{ uri: employee?.profilePic }} style={styles.profileImage} />
        <View style={styles.employeeInfo}>
          <Text style={styles.employeeName}>{employee?.name}</Text>
          <Text style={styles.employeeDept}>{employee?.department}</Text>
          <Text style={styles.employeeId}>ID: {employee?.id}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Today's Status</Text>
      <View style={styles.statusContainer}>
        <View style={[styles.statusCard, todayAttendance?.type === 'IN' && styles.statusCardIn]}>
          <Icon 
            name="log-in-outline" 
            size={24} 
            color={todayAttendance?.type === 'IN' ? '#10B981' : theme.colors.textSecondary} 
          />
          <Text style={styles.statusText}>Time In</Text>
          <Text style={styles.statusTime}>
            {todayAttendance?.type === 'IN' 
              ? new Date(todayAttendance.timestamp).toLocaleTimeString() 
              : 'Not recorded'}
          </Text>
        </View>
        
        <View style={[styles.statusCard, todayAttendance?.type === 'OUT' && styles.statusCardOut]}>
          <Icon 
            name="log-out-outline" 
            size={24} 
            color={todayAttendance?.type === 'OUT' ? '#EF4444' : theme.colors.textSecondary} 
          />
          <Text style={styles.statusText}>Time Out</Text>
          <Text style={styles.statusTime}>
            {todayAttendance?.type === 'OUT' 
              ? new Date(todayAttendance.timestamp).toLocaleTimeString() 
              : 'Not recorded'}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Mark Attendance</Text>
      
      <TouchableOpacity
        onPress={() => handleAttendance('IN')}
        style={[
          styles.actionButton,
          (todayAttendance?.type === 'IN') && styles.actionButtonDisabled
        ]}
        disabled={todayAttendance?.type === 'IN'}
      >
        <Icon name="camera-outline" size={24} color="white" />
        <Text style={styles.actionButtonText}>Time In with Selfie</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        onPress={() => handleAttendance('OUT')}
        style={[
          styles.actionButton,
          (todayAttendance?.type !== 'IN' || todayAttendance?.type === 'OUT') && styles.actionButtonDisabled
        ]}
        disabled={todayAttendance?.type !== 'IN' || todayAttendance?.type === 'OUT'}
      >
        <Icon name="camera-outline" size={24} color="white" />
        <Text style={styles.actionButtonText}>Time Out with Selfie</Text>
      </TouchableOpacity>

      <Text style={styles.infoText}>
        ⚡ AI-powered face verification & liveness detection
      </Text>
    </ScrollView>
  );
};

export default DashboardScreen;