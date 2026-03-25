import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import moment from 'moment';

const CameraScreen = ({ navigation, route }) => {
  const { attendanceType } = route.params;
  const [hasPermission, setHasPermission] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [location, setLocation] = useState(null);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationStep, setVerificationStep] = useState(0);
  const cameraRef = useRef(null);

  const verificationMessages = [
    "🔍 Analyzing facial features...",
    "✅ Face detected!",
    "👀 Checking liveness...",
    "🔄 Blink detected!",
    "✨ Face match successful!"
  ];

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
      
      if (status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Camera Permission Required',
          text2: 'Please grant camera access to take selfie',
        });
      }
      
      getLocation();
    })();
  }, []);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    } catch (error) {
      console.error('Location error:', error);
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.5,
        });
        setCapturedImage(photo.uri);
        startVerification();
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to capture photo',
        });
      }
    }
  };

  const startVerification = () => {
    setShowVerification(true);
    let step = 0;
    
    const interval = setInterval(() => {
      if (step < verificationMessages.length - 1) {
        step++;
        setVerificationStep(step);
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setShowVerification(false);
          handleConfirm();
        }, 1000);
      }
    }, 800);
  };

  const handleConfirm = async () => {
    const employee = await AsyncStorage.getItem('currentEmployee');
    const empData = JSON.parse(employee);
    
    const attendanceRecord = {
      id: Date.now().toString(),
      employeeId: empData.id,
      name: empData.name,
      type: attendanceType,
      timestamp: new Date().toISOString(),
      selfie: capturedImage,
      location: location,
      date: moment().format('YYYY-MM-DD'),
    };
    
    const existingLogs = await AsyncStorage.getItem('attendanceLogs');
    const logs = existingLogs ? JSON.parse(existingLogs) : [];
    logs.push(attendanceRecord);
    await AsyncStorage.setItem('attendanceLogs', JSON.stringify(logs));
    
    navigation.replace('Success', { record: attendanceRecord });
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setShowVerification(false);
    setVerificationStep(0);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    camera: {
      flex: 1,
    },
    captureContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 32,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
    },
    captureButton: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
        },
        android: {
          elevation: 5,
        },
      }),
    },
    captureText: {
      color: '#FFFFFF',
      fontSize: 14,
      textAlign: 'center',
    },
    previewContainer: {
      flex: 1,
      position: 'relative',
    },
    previewImage: {
      flex: 1,
      resizeMode: 'cover',
    },
    verificationOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.95)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    verificationCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      padding: 32,
      width: '100%',
      alignItems: 'center',
    },
    verificationIcon: {
      marginBottom: 20,
    },
    verificationTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#111827',
      marginBottom: 12,
    },
    verificationMessage: {
      fontSize: 14,
      color: '#6B7280',
      textAlign: 'center',
      marginBottom: 24,
    },
    buttonContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 24,
      backgroundColor: 'rgba(0,0,0,0.6)',
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 16,
    },
    retakeButton: {
      flex: 1,
      backgroundColor: '#EF4444',
      paddingVertical: 14,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmButton: {
      flex: 1,
      backgroundColor: '#10B981',
      paddingVertical: 14,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
  });

  if (hasPermission === null) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#FFFFFF' }}>No access to camera</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!capturedImage ? (
        <>
          <Camera
            ref={cameraRef}
            style={styles.camera}
            type={Camera.Constants.Type.front}
          />
          <View style={styles.captureContainer}>
            <TouchableOpacity
              onPress={takePicture}
              style={styles.captureButton}
            >
              <Icon name="camera" size={40} color="#3B82F6" />
            </TouchableOpacity>
            <Text style={styles.captureText}>
              Taking {attendanceType === 'IN' ? 'Time In' : 'Time Out'} Selfie
            </Text>
          </View>
        </>
      ) : (
        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedImage }} style={styles.previewImage} />
          
          {showVerification && (
            <View style={styles.verificationOverlay}>
              <View style={styles.verificationCard}>
                <Icon 
                  name="scan-outline" 
                  size={60} 
                  color="#3B82F6" 
                  style={styles.verificationIcon} 
                />
                <Text style={styles.verificationTitle}>Face Verification</Text>
                <Text style={styles.verificationMessage}>
                  {verificationMessages[verificationStep]}
                </Text>
                <ActivityIndicator size="large" color="#3B82F6" />
              </View>
            </View>
          )}
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={retakePhoto} style={styles.retakeButton}>
              <Icon name="refresh-outline" size={20} color="white" />
              <Text style={styles.buttonText}>Retake</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={handleConfirm} style={styles.confirmButton}>
              <Icon name="checkmark-outline" size={20} color="white" />
              <Text style={styles.buttonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

export default CameraScreen;