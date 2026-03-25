import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import moment from 'moment';

const SuccessScreen = ({ navigation, route }) => {
  const { record } = route.params;
  const scaleAnim = new Animated.Value(0);

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    iconContainer: {
      width: 96,
      height: 96,
      backgroundColor: '#10B981',
      borderRadius: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      textAlign: 'center',
      color: '#111827',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      textAlign: 'center',
      color: '#6B7280',
      marginBottom: 32,
    },
    card: {
      backgroundColor: '#F9FAFB',
      borderRadius: 20,
      padding: 24,
      width: '100%',
      marginBottom: 24,
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    selfieImage: {
      width: 120,
      height: 120,
      borderRadius: 60,
      marginBottom: 20,
      borderWidth: 3,
      borderColor: '#3B82F6',
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      width: '100%',
    },
    infoIcon: {
      width: 24,
      marginRight: 12,
    },
    infoText: {
      flex: 1,
      fontSize: 14,
      color: '#111827',
    },
    infoTextSecondary: {
      flex: 1,
      fontSize: 14,
      color: '#6B7280',
    },
    button: {
      backgroundColor: '#3B82F6',
      borderRadius: 12,
      padding: 16,
      width: '100%',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    buttonText: {
      color: '#FFFFFF',
      textAlign: 'center',
      fontWeight: '600',
      fontSize: 16,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }], alignItems: 'center', width: '100%' }}>
          <View style={styles.iconContainer}>
            <Icon name="checkmark" size={60} color="white" />
          </View>
          
          <Text style={styles.title}>
            {record.type === 'IN' ? 'Time In' : 'Time Out'} Recorded!
          </Text>
          
          <Text style={styles.subtitle}>
            Your attendance has been successfully recorded
          </Text>
          
          <View style={styles.card}>
            <Image source={{ uri: record.selfie }} style={styles.selfieImage} />
            
            <View style={styles.infoRow}>
              <Icon name="person-outline" size={20} color="#3B82F6" style={styles.infoIcon} />
              <Text style={styles.infoText}>{record.name}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Icon name="time-outline" size={20} color="#3B82F6" style={styles.infoIcon} />
              <Text style={styles.infoTextSecondary}>
                {moment(record.timestamp).format('MMMM Do YYYY, h:mm:ss a')}
              </Text>
            </View>
            
            {record.location && (
              <View style={styles.infoRow}>
                <Icon name="location-outline" size={20} color="#3B82F6" style={styles.infoIcon} />
                <Text style={styles.infoTextSecondary}>
                  {record.location.latitude.toFixed(4)}, {record.location.longitude.toFixed(4)}
                </Text>
              </View>
            )}
          </View>
          
          <TouchableOpacity
            onPress={() => navigation.navigate('Main')}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

export default SuccessScreen;