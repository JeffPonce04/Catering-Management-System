import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';

const HistoryScreen = () => {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const theme = useTheme();

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [filterDate, filterType, logs]);

  const loadLogs = async () => {
    const storedLogs = await AsyncStorage.getItem('attendanceLogs');
    if (storedLogs) {
      const parsedLogs = JSON.parse(storedLogs);
      setLogs(parsedLogs.reverse());
      setFilteredLogs(parsedLogs.reverse());
    }
  };

  const filterLogs = () => {
    let filtered = [...logs];
    
    if (filterDate) {
      filtered = filtered.filter(log => 
        moment(log.timestamp).format('YYYY-MM-DD') === filterDate
      );
    }
    
    if (filterType !== 'ALL') {
      filtered = filtered.filter(log => log.type === filterType);
    }
    
    setFilteredLogs(filtered);
  };

  const renderLogItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => {
        setSelectedLog(item);
        setModalVisible(true);
      }}
      style={[styles.logItem, { backgroundColor: theme.colors.surface }]}
    >
      <View style={styles.logItemContent}>
        <Image source={{ uri: item.selfie }} style={styles.thumbnail} />
        <View style={styles.logInfo}>
          <View style={styles.logHeader}>
            <Text style={[styles.logName, { color: theme.colors.text }]}>
              {item.name}
            </Text>
            <View style={[styles.typeBadge, { backgroundColor: item.type === 'IN' ? '#D1FAE5' : '#FEE2E2' }]}>
              <Text style={[styles.typeText, { color: item.type === 'IN' ? '#10B981' : '#EF4444' }]}>
                {item.type === 'IN' ? 'TIME IN' : 'TIME OUT'}
              </Text>
            </View>
          </View>
          <Text style={[styles.timestamp, { color: theme.colors.textSecondary }]}>
            {moment(item.timestamp).format('MMM DD, YYYY • hh:mm A')}
          </Text>
          {item.location && (
            <View style={styles.locationContainer}>
              <Icon name="location-outline" size={12} color={theme.colors.textSecondary} />
              <Text style={[styles.locationText, { color: theme.colors.textSecondary }]}>
                {item.location.latitude.toFixed(4)}, {item.location.longitude.toFixed(4)}
              </Text>
            </View>
          )}
        </View>
        <Icon name="chevron-forward" size={20} color={theme.colors.textSecondary} />
      </View>
    </TouchableOpacity>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    filterSection: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    sectionTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 12,
      color: theme.colors.text,
    },
    filterRow: {
      flexDirection: 'row',
      marginBottom: 12,
    },
    dateInputContainer: {
      flex: 1,
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
    },
    dateInput: {
      flex: 1,
      paddingVertical: 8,
      marginLeft: 8,
      color: theme.colors.text,
    },
    filterButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      marginRight: 8,
    },
    filterButtonAll: {
      backgroundColor: '#3B82F6',
    },
    filterButtonIn: {
      backgroundColor: '#10B981',
    },
    filterButtonOut: {
      backgroundColor: '#EF4444',
    },
    filterButtonInactive: {
      backgroundColor: '#E5E7EB',
    },
    filterButtonText: {
      fontWeight: '600',
    },
    filterButtonTextActive: {
      color: 'white',
    },
    filterButtonTextInactive: {
      color: '#374151',
    },
    clearButton: {
      alignSelf: 'flex-end',
      marginBottom: 8,
    },
    clearButtonText: {
      color: '#3B82F6',
      fontSize: 12,
    },
    logItem: {
      marginBottom: 12,
      borderRadius: 12,
      overflow: 'hidden',
    },
    logItemContent: {
      flexDirection: 'row',
      padding: 16,
    },
    thumbnail: {
      width: 64,
      height: 64,
      borderRadius: 8,
    },
    logInfo: {
      flex: 1,
      marginLeft: 12,
    },
    logHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    logName: {
      fontWeight: '600',
      fontSize: 16,
    },
    typeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 16,
    },
    typeText: {
      fontSize: 10,
      fontWeight: '600',
    },
    timestamp: {
      fontSize: 12,
      marginTop: 4,
    },
    locationContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    locationText: {
      fontSize: 10,
      marginLeft: 4,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 80,
    },
    emptyText: {
      marginTop: 12,
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.colors.background,
      borderRadius: 20,
      padding: 24,
      width: '90%',
      maxHeight: '80%',
    },
    modalImage: {
      width: '100%',
      height: 300,
      borderRadius: 12,
      marginBottom: 16,
    },
    modalInfo: {
      marginBottom: 12,
    },
    modalLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginBottom: 4,
    },
    modalValue: {
      fontSize: 16,
      color: theme.colors.text,
      marginBottom: 8,
    },
    closeButton: {
      backgroundColor: theme.colors.primary,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 16,
    },
    closeButtonText: {
      color: 'white',
      fontWeight: '600',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.filterSection}>
        <Text style={styles.sectionTitle}>Attendance History</Text>
        
        <View style={styles.filterRow}>
          <View style={styles.dateInputContainer}>
            <Icon name="calendar-outline" size={18} color={theme.colors.textSecondary} />
            <TextInput
              style={styles.dateInput}
              placeholder="Filter by date (YYYY-MM-DD)"
              placeholderTextColor={theme.colors.textSecondary}
              value={filterDate}
              onChangeText={setFilterDate}
            />
          </View>
        </View>
        
        <View style={styles.filterRow}>
          <TouchableOpacity
            onPress={() => setFilterType('ALL')}
            style={[
              styles.filterButton,
              filterType === 'ALL' ? styles.filterButtonAll : styles.filterButtonInactive
            ]}
          >
            <Text style={[
              styles.filterButtonText,
              filterType === 'ALL' ? styles.filterButtonTextActive : styles.filterButtonTextInactive
            ]}>All</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => setFilterType('IN')}
            style={[
              styles.filterButton,
              filterType === 'IN' ? styles.filterButtonIn : styles.filterButtonInactive
            ]}
          >
            <Text style={[
              styles.filterButtonText,
              filterType === 'IN' ? styles.filterButtonTextActive : styles.filterButtonTextInactive
            ]}>IN</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => setFilterType('OUT')}
            style={[
              styles.filterButton,
              filterType === 'OUT' ? styles.filterButtonOut : styles.filterButtonInactive
            ]}
          >
            <Text style={[
              styles.filterButtonText,
              filterType === 'OUT' ? styles.filterButtonTextActive : styles.filterButtonTextInactive
            ]}>OUT</Text>
          </TouchableOpacity>
        </View>
        
        {(filterDate || filterType !== 'ALL') && (
          <TouchableOpacity
            onPress={() => {
              setFilterDate('');
              setFilterType('ALL');
            }}
            style={styles.clearButton}
          >
            <Text style={styles.clearButtonText}>Clear Filters</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <FlatList
        data={filteredLogs}
        renderItem={renderLogItem}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="document-text-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={styles.emptyText}>No attendance records found</Text>
          </View>
        }
      />
      
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedLog && (
                <>
                  <Image source={{ uri: selectedLog.selfie }} style={styles.modalImage} />
                  
                  <View style={styles.modalInfo}>
                    <Text style={styles.modalLabel}>Employee Name</Text>
                    <Text style={styles.modalValue}>{selectedLog.name}</Text>
                  </View>
                  
                  <View style={styles.modalInfo}>
                    <Text style={styles.modalLabel}>Attendance Type</Text>
                    <Text style={[styles.modalValue, { color: selectedLog.type === 'IN' ? '#10B981' : '#EF4444' }]}>
                      {selectedLog.type === 'IN' ? 'TIME IN' : 'TIME OUT'}
                    </Text>
                  </View>
                  
                  <View style={styles.modalInfo}>
                    <Text style={styles.modalLabel}>Date & Time</Text>
                    <Text style={styles.modalValue}>
                      {moment(selectedLog.timestamp).format('MMMM Do YYYY, h:mm:ss a')}
                    </Text>
                  </View>
                  
                  {selectedLog.location && (
                    <View style={styles.modalInfo}>
                      <Text style={styles.modalLabel}>Location</Text>
                      <Text style={styles.modalValue}>
                        Latitude: {selectedLog.location.latitude.toFixed(6)}
                        {'\n'}Longitude: {selectedLog.location.longitude.toFixed(6)}
                      </Text>
                    </View>
                  )}
                </>
              )}
              
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default HistoryScreen;