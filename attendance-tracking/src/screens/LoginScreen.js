import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';

const mockEmployees = [
  {
    id: 'EMP001',
    name: 'John Doe',
    department: 'Engineering',
    profilePic: 'https://randomuser.me/api/portraits/men/1.jpg',
  },
  {
    id: 'EMP002',
    name: 'Jane Smith',
    department: 'Marketing',
    profilePic: 'https://randomuser.me/api/portraits/women/2.jpg',
  },
  {
    id: 'EMP003',
    name: 'Mike Johnson',
    department: 'Sales',
    profilePic: 'https://randomuser.me/api/portraits/men/3.jpg',
  },
];

const LoginScreen = ({ navigation }) => {
  const [employeeId, setEmployeeId] = useState('');
  const [loading, setLoading] = useState(false);
  const theme = useTheme();

  const handleProceed = async () => {
    if (!employeeId.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter Employee ID',
      });
      return;
    }

    setLoading(true);
    
    setTimeout(async () => {
      const employee = mockEmployees.find(emp => emp.id === employeeId.toUpperCase());
      
      if (employee) {
        await AsyncStorage.setItem('currentEmployee', JSON.stringify(employee));
        Toast.show({
          type: 'success',
          text1: 'Welcome',
          text2: `Hello ${employee.name}`,
        });
        navigation.replace('Main');
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Invalid Employee ID',
        });
      }
      setLoading(false);
    }, 1000);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    logoContainer: {
      alignItems: 'center',
      marginBottom: 48,
    },
    logoCircle: {
      width: 96,
      height: 96,
      backgroundColor: '#3B82F6',
      borderRadius: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      textAlign: 'center',
      color: theme.colors.text,
    },
    subtitle: {
      textAlign: 'center',
      marginTop: 8,
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    inputContainer: {
      marginBottom: 24,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 8,
      color: theme.colors.text,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      backgroundColor: theme.colors.surface,
    },
    inputIcon: {
      marginRight: 8,
    },
    input: {
      flex: 1,
      paddingVertical: 16,
      fontSize: 16,
      color: theme.colors.text,
    },
    button: {
      backgroundColor: '#3B82F6',
      paddingVertical: 16,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 18,
      marginRight: 8,
    },
    demoText: {
      textAlign: 'center',
      marginTop: 32,
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Animated.View 
          entering={FadeInDown.delay(200).duration(1000)}
          style={styles.logoContainer}
        >
          <View style={styles.logoCircle}>
            <Icon name="camera" size={48} color="white" />
          </View>
          <Text style={styles.title}>
            Selfie Attendance
          </Text>
          <Text style={styles.subtitle}>
            Track your attendance with selfie verification
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(1000)}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              Employee ID
            </Text>
            <View style={styles.inputWrapper}>
              <Icon 
                name="id-card-outline" 
                size={20} 
                color={theme.colors.textSecondary} 
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter your Employee ID"
                placeholderTextColor={theme.colors.textSecondary}
                value={employeeId}
                onChangeText={setEmployeeId}
                autoCapitalize="characters"
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={handleProceed}
            disabled={loading}
            style={styles.button}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Text style={styles.buttonText}>Proceed</Text>
                <Icon name="arrow-forward" size={20} color="white" />
              </>
            )}
          </TouchableOpacity>

          <View style={{ marginTop: 32 }}>
            <Text style={styles.demoText}>
              Demo IDs: EMP001, EMP002, EMP003
            </Text>
          </View>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;