// src/screens/CalendarScreen.jsx - COMPLETE WITH BACKEND INTEGRATION
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { bookingService } from '../services/bookingService';

const { width, height } = Dimensions.get('window');

const CalendarScreen = ({ navigation }) => {
  const { isGuest, user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [animateMonth, setAnimateMonth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bookedDates, setBookedDates] = useState([]);
  const [fullyBookedDates, setFullyBookedDates] = useState([]);
  const [unavailableDates, setUnavailableDates] = useState([]);
  const [limitedSlotsDates, setLimitedSlotsDates] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [availabilityData, setAvailabilityData] = useState({});
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Load calendar data
  const loadCalendarData = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading calendar data...');
      
      // Get event types
      const eventTypesResponse = await bookingService.getEventTypes();
      if (eventTypesResponse.success) {
        const types = eventTypesResponse.data?.data || eventTypesResponse.data || [];
        setEventTypes(types);
      }
      
      // ✅ Get calendar events (bookings)
      const response = await bookingService.getCalendarEvents();
      
      if (response.success) {
        const calendarEvents = response.data?.data || response.data || [];
        console.log(`✅ Loaded ${calendarEvents.length} calendar events`);
        
        // Extract booked dates
        const booked = calendarEvents.map(event => event.start || event.event_date);
        setBookedDates(booked);
        
        // Format events for display
        const formattedEvents = calendarEvents.map(event => ({
          date: event.start || event.event_date,
          title: event.title || event.event_type_name || 'Event',
          time: event.time || event.event_time || 'TBD',
          type: event.type || event.event_type || 'general',
          id: event.id || event.booking_id,
          status: event.status || event.booking_status,
          venue: event.venue || event.location || '',
        }));
        setEvents(formattedEvents);
      }
      
      // ✅ GET AVAILABILITY DATA from backend
      const availabilityResponse = await bookingService.getCalendarAvailability();
      console.log('📦 Availability response:', availabilityResponse);
      
      if (availabilityResponse.success) {
        const availData = availabilityResponse.data?.data || availabilityResponse.data || [];
        console.log(`✅ Loaded ${availData.length} availability records`);
        
        // Process availability data
        const bookedDatesList = [];
        const fullyBookedList = [];
        const unavailableList = [];
        const limitedSlotsList = [];
        const availMap = {};
        
        availData.forEach(item => {
          const date = item.availability_date || item.date;
          const status = item.status || 'available';
          const maxBookings = item.max_bookings || null;
          
          availMap[date] = {
            status: status,
            max_bookings: maxBookings,
            notes: item.notes || ''
          };
          
          if (status === 'fully_booked') {
            fullyBookedList.push(date);
          } else if (status === 'unavailable') {
            unavailableList.push(date);
          } else if (status === 'available' && maxBookings !== null && maxBookings > 0) {
            limitedSlotsList.push(date);
          }
          
          // Also add to booked dates if fully booked or has events
          if (status === 'fully_booked' || status === 'unavailable') {
            bookedDatesList.push(date);
          }
        });
        
        setFullyBookedDates(fullyBookedList);
        setUnavailableDates(unavailableList);
        setLimitedSlotsDates(limitedSlotsList);
        setAvailabilityData(availMap);
        
        console.log(`📊 Fully Booked: ${fullyBookedList.length}, Unavailable: ${unavailableList.length}, Limited Slots: ${limitedSlotsList.length}`);
      }
      
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data on focus
  useFocusEffect(
    useCallback(() => {
      if (!isGuest) {
        loadCalendarData();
      } else {
        setLoading(false);
      }
    }, [isGuest, loadCalendarData])
  );

  // Animation on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const getYear = () => currentDate.getFullYear();
  const getMonth = () => currentDate.getMonth();

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const formatDateKey = (year, month, day) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  // ✅ Check if date is booked (has events)
  const isBooked = (year, month, day) => {
    const dateKey = formatDateKey(year, month, day);
    return bookedDates.some(date => date && date.startsWith(dateKey));
  };

  // ✅ Check if date is fully booked (from availability settings)
  const isFullyBooked = (year, month, day) => {
    const dateKey = formatDateKey(year, month, day);
    return fullyBookedDates.some(date => date && date.startsWith(dateKey));
  };

  // ✅ Check if date is unavailable (from availability settings)
  const isUnavailable = (year, month, day) => {
    const dateKey = formatDateKey(year, month, day);
    return unavailableDates.some(date => date && date.startsWith(dateKey));
  };

  // ✅ Check if date has limited slots
  const hasLimitedSlots = (year, month, day) => {
    const dateKey = formatDateKey(year, month, day);
    return limitedSlotsDates.some(date => date && date.startsWith(dateKey));
  };

  // ✅ Get availability status for a date
  const getDateAvailability = (year, month, day) => {
    const dateKey = formatDateKey(year, month, day);
    return availabilityData[dateKey] || null;
  };

  const isToday = (year, month, day) => {
    const today = new Date();
    return today.getFullYear() === year && 
           today.getMonth() === month && 
           today.getDate() === day;
  };

  const isSelected = (year, month, day) => {
    if (!selectedDate) return false;
    return selectedDate.getFullYear() === year &&
           selectedDate.getMonth() === month &&
           selectedDate.getDate() === day;
  };

  const hasEvent = (year, month, day) => {
    const dateKey = formatDateKey(year, month, day);
    return events.some(e => e.date && e.date.startsWith(dateKey));
  };

  const getEventForDate = (year, month, day) => {
    const dateKey = formatDateKey(year, month, day);
    return events.filter(e => e.date && e.date.startsWith(dateKey));
  };

  const goToPreviousMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Vibration.vibrate(5);
    setAnimateMonth(true);
    setCurrentDate(new Date(getYear(), getMonth() - 1, 1));
    setTimeout(() => setAnimateMonth(false), 300);
  };

  const goToNextMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Vibration.vibrate(5);
    setAnimateMonth(true);
    setCurrentDate(new Date(getYear(), getMonth() + 1, 1));
    setTimeout(() => setAnimateMonth(false), 300);
  };

  const goToToday = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Vibration.vibrate(10);
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const handleDateSelect = (year, month, day) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Vibration.vibrate(5);
    const selected = new Date(year, month, day);
    setSelectedDate(selected);
  };

  // Build calendar days
  const buildCalendarDays = () => {
    const year = getYear();
    const month = getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const calendarDays = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      calendarDays.push({
        type: 'empty',
        key: `empty-${i}`,
      });
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const booked = isBooked(year, month, day);
      const fullyBooked = isFullyBooked(year, month, day);
      const unavailable = isUnavailable(year, month, day);
      const limitedSlots = hasLimitedSlots(year, month, day);
      const today = isToday(year, month, day);
      const selected = isSelected(year, month, day);
      const hasEventToday = hasEvent(year, month, day);
      const availability = getDateAvailability(year, month, day);

      calendarDays.push({
        type: 'day',
        key: `day-${day}`,
        day: day,
        booked: booked,
        fullyBooked: fullyBooked,
        unavailable: unavailable,
        limitedSlots: limitedSlots,
        today: today,
        selected: selected,
        hasEvent: hasEventToday,
        year: year,
        month: month,
        availability: availability,
        // Determine display status
        displayStatus: fullyBooked ? 'fully_booked' : 
                       unavailable ? 'unavailable' : 
                       booked ? 'booked' : 
                       limitedSlots ? 'limited' : 'available'
      });
    }

    return calendarDays;
  };

  const getEventStats = () => {
    const year = getYear();
    const month = getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    let bookedCount = 0;
    let availableCount = 0;
    let eventCount = 0;
    let fullyBookedCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      if (isBooked(year, month, day)) {
        bookedCount++;
      } else {
        availableCount++;
      }
      if (hasEvent(year, month, day)) {
        eventCount++;
      }
      if (isFullyBooked(year, month, day)) {
        fullyBookedCount++;
      }
    }

    return { bookedCount, availableCount, eventCount, fullyBookedCount };
  };

  const stats = getEventStats();

  const getEventTypeColor = (type) => {
    const found = eventTypes.find(t => t.slug === type || t.name === type);
    return found?.color || '#FF6B9D';
  };

  const getEventTypeIcon = (type) => {
    const found = eventTypes.find(t => t.slug === type || t.name === type);
    return found?.icon || 'calendar-star';
  };

  const renderEventsForSelectedDate = () => {
    if (!selectedDate) return null;
    
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const day = selectedDate.getDate();
    const dateKey = formatDateKey(year, month, day);
    const dayEvents = events.filter(e => e.date && e.date.startsWith(dateKey));
    const availability = getDateAvailability(year, month, day);

    // Show availability status
    let statusMessage = null;
    if (availability) {
      if (availability.status === 'fully_booked') {
        statusMessage = '📅 Fully Booked - No more slots available';
      } else if (availability.status === 'unavailable') {
        statusMessage = '🚫 Unavailable - Date is blocked';
      } else if (availability.status === 'available' && availability.max_bookings) {
        statusMessage = `✅ ${availability.max_bookings} slots available`;
      }
    }

    if (dayEvents.length === 0 && !statusMessage) {
      return (
        <View style={styles.noEventsCard}>
          <MaterialCommunityIcons name="calendar-blank" size={40} color="#C6C6C8" />
          <Text style={styles.noEventsText}>No events on this day</Text>
          <Text style={styles.noEventsSubtext}>Plan something special!</Text>
        </View>
      );
    }

    return (
      <View style={styles.eventsCard}>
        <Text style={styles.eventsTitle}>
          {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </Text>
        
        {statusMessage && (
          <View style={[styles.statusMessage, { 
            backgroundColor: availability?.status === 'fully_booked' ? '#FFEBEE' : 
                            availability?.status === 'unavailable' ? '#FFF3E0' : '#E8F5E9'
          }]}>
            <Text style={[styles.statusMessageText, {
              color: availability?.status === 'fully_booked' ? '#C62828' : 
                     availability?.status === 'unavailable' ? '#E65100' : '#2E7D32'
            }]}>
              {statusMessage}
            </Text>
          </View>
        )}
        
        {dayEvents.map((event, index) => (
          <TouchableOpacity 
            key={event.id || index}
            style={[styles.eventItem, { borderLeftColor: getEventTypeColor(event.type) }]}
            activeOpacity={0.7}
            onPress={() => {
              if (event.id) {
                navigation.navigate('OrderDetail', { bookingId: event.id });
              }
            }}
          >
            <View style={styles.eventItemLeft}>
              <View style={[styles.eventIcon, { backgroundColor: getEventTypeColor(event.type) + '15' }]}>
                <MaterialCommunityIcons 
                  name={getEventTypeIcon(event.type)} 
                  size={20} 
                  color={getEventTypeColor(event.type)} 
                />
              </View>
              <View>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.eventTime}>{event.time} • {event.venue || 'TBD'}</Text>
              </View>
            </View>
            <View style={[styles.eventTypeBadge, { backgroundColor: getEventTypeColor(event.type) + '15' }]}>
              <Text style={[styles.eventTypeText, { color: getEventTypeColor(event.type) }]}>
                {event.status || 'Booked'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const calendarDays = buildCalendarDays();

  // If guest, show login prompt
  if (isGuest) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <LinearGradient
          colors={['#FFFFFF', '#FFF8FA', '#FFF0F5', '#FFE8EE']}
          style={styles.gradient}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Feather name="arrow-left" size={22} color="#FF6B9D" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Calendar</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.guestContainer}>
            <MaterialCommunityIcons name="calendar-lock" size={60} color="#C6C6C8" />
            <Text style={styles.guestTitle}>Login to View Calendar</Text>
            <Text style={styles.guestText}>
              Please login to view your event calendar and schedule.
            </Text>
            <TouchableOpacity 
              style={styles.guestLoginButton}
              onPress={() => navigation.navigate('Login')}
            >
              <LinearGradient
                colors={['#FF6B9D', '#FF8FB1']}
                style={styles.guestLoginGradient}
              >
                <Text style={styles.guestLoginText}>Sign In</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FF6B9D" />
        <Text style={{ marginTop: 16, color: '#8E8E93' }}>Loading calendar...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['#FFFFFF', '#FFF8FA', '#FFF0F5', '#FFE8EE']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={22} color="#FF6B9D" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Calendar</Text>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{getYear()}</Text>
            </View>
          </View>
          
          <TouchableOpacity 
            onPress={goToToday} 
            style={styles.todayButton}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['#FF6B9D', '#FF8FB1']}
              style={styles.todayGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.todayButtonText}>Today</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Month Navigation */}
          <Animated.View 
            style={[
              styles.navigationCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
            <TouchableOpacity 
              onPress={goToPreviousMonth} 
              style={styles.navButton}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="chevron-left" size={28} color="#FF6B9D" />
            </TouchableOpacity>

            <View style={styles.monthYearContainer}>
              <Text style={styles.monthText}>{months[getMonth()]}</Text>
              <Text style={styles.yearText}>{getYear()}</Text>
            </View>

            <TouchableOpacity 
              onPress={goToNextMonth} 
              style={styles.navButton}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="chevron-right" size={28} color="#FF6B9D" />
            </TouchableOpacity>
          </Animated.View>

          {/* Stats Summary */}
          <Animated.View 
            style={[
              styles.statsCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
            <View style={styles.statItem}>
              <LinearGradient
                colors={['#E8F5E9', '#C8E6C9']}
                style={styles.statIconGradient}
              >
                <MaterialCommunityIcons name="calendar-check" size={22} color="#4CAF50" />
              </LinearGradient>
              <View>
                <Text style={styles.statNumber}>{stats.availableCount - stats.fullyBookedCount}</Text>
                <Text style={styles.statLabel}>Available</Text>
              </View>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <LinearGradient
                colors={['#FFEBEE', '#FFCDD2']}
                style={styles.statIconGradient}
              >
                <MaterialCommunityIcons name="calendar-remove" size={22} color="#FF4444" />
              </LinearGradient>
              <View>
                <Text style={styles.statNumber}>{stats.fullyBookedCount + stats.bookedCount}</Text>
                <Text style={styles.statLabel}>Booked / Full</Text>
              </View>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <LinearGradient
                colors={['#FFF3E0', '#FFE0B2']}
                style={styles.statIconGradient}
              >
                <MaterialCommunityIcons name="calendar-star" size={22} color="#FF9800" />
              </LinearGradient>
              <View>
                <Text style={styles.statNumber}>{stats.eventCount}</Text>
                <Text style={styles.statLabel}>Events</Text>
              </View>
            </View>
          </Animated.View>

          {/* Calendar Card */}
          <Animated.View 
            style={[
              styles.calendarCard,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              }
            ]}
          >
            {/* Weekday Headers */}
            <View style={styles.weekRow}>
              {weekDays.map((day, index) => (
                <Text
                  key={day}
                  style={[
                    styles.weekdayText,
                    (index === 0 || index === 6) && styles.weekendText
                  ]}
                >
                  {day}
                </Text>
              ))}
            </View>

            {/* Calendar Days Grid */}
            <View style={styles.calendarGrid}>
              {calendarDays.map((item) => {
                if (item.type === 'empty') {
                  return <View key={item.key} style={styles.calendarDay} />;
                }
                
                // Determine day styles based on status
                let dayStyle = styles.availableDay;
                let textStyle = styles.dayText;
                let showIndicator = null;
                
                if (item.fullyBooked) {
                  dayStyle = styles.fullyBookedDay;
                  textStyle = styles.fullyBookedText;
                  showIndicator = (
                    <View style={styles.fullyBookedIndicator}>
                      <MaterialCommunityIcons name="lock" size={10} color="#FFF" />
                    </View>
                  );
                } else if (item.unavailable) {
                  dayStyle = styles.unavailableDay;
                  textStyle = styles.unavailableText;
                  showIndicator = (
                    <View style={styles.unavailableIndicator}>
                      <MaterialCommunityIcons name="close" size={10} color="#FFF" />
                    </View>
                  );
                } else if (item.booked) {
                  dayStyle = styles.bookedDay;
                  textStyle = styles.bookedText;
                } else if (item.limitedSlots) {
                  dayStyle = styles.limitedSlotsDay;
                  textStyle = styles.dayText;
                  showIndicator = (
                    <View style={styles.limitedSlotsIndicator}>
                      <Text style={styles.limitedSlotsText}>Limited</Text>
                    </View>
                  );
                }
                
                if (item.today) {
                  dayStyle = styles.todayDay;
                  textStyle = styles.todayText;
                }
                
                if (item.selected) {
                  dayStyle = styles.selectedDay;
                  textStyle = styles.selectedText;
                }

                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.calendarDay, dayStyle]}
                    onPress={() => handleDateSelect(item.year, item.month, item.day)}
                    activeOpacity={0.7}
                    disabled={item.unavailable}
                  >
                    <Text style={textStyle}>
                      {item.day}
                    </Text>
                    
                    {showIndicator}
                    
                    {item.hasEvent && !item.fullyBooked && !item.unavailable && (
                      <View style={styles.eventDot} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>

          {/* Events for Selected Date */}
          {renderEventsForSelectedDate()}

          {/* Legend */}
          <Animated.View 
            style={[
              styles.legendCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
            <View style={styles.legendHeader}>
              <Text style={styles.legendTitle}>Legend</Text>
              <View style={styles.legendDivider} />
            </View>
            <View style={styles.legendItems}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotAvailable]} />
                <Text style={styles.legendText}>Available</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotBooked]} />
                <Text style={styles.legendText}>Booked</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotFullyBooked]} />
                <Text style={styles.legendText}>Fully Booked</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotUnavailable]} />
                <Text style={styles.legendText}>Unavailable</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotLimited]} />
                <Text style={styles.legendText}>Limited Slots</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotToday]} />
                <Text style={styles.legendText}>Today</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotEvent]} />
                <Text style={styles.legendText}>Has Event</Text>
              </View>
            </View>
          </Animated.View>

          {/* Quick Actions */}
          <Animated.View 
            style={[
              styles.quickActions,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
            <TouchableOpacity 
              style={styles.quickActionButton}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('BookingTab')}
            >
              <LinearGradient
                colors={['#FF6B9D', '#FF8FB1']}
                style={styles.quickActionGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <MaterialCommunityIcons name="calendar-plus" size={20} color="#FFF" />
                <Text style={styles.quickActionText}>New Booking</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickActionButton}
              activeOpacity={0.7}
              onPress={() => {
                loadCalendarData();
                Alert.alert('Refreshed', 'Calendar data has been refreshed');
              }}
            >
              <LinearGradient
                colors={['#4CAF50', '#66BB6A']}
                style={styles.quickActionGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <MaterialCommunityIcons name="refresh" size={20} color="#FFF" />
                <Text style={styles.quickActionText}>Refresh</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  headerBadge: {
    backgroundColor: '#FFF0F5',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FF6B9D',
  },
  todayButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  todayGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  navigationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthYearContainer: {
    alignItems: 'center',
  },
  monthText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  yearText: {
    fontSize: 14,
    color: '#8A8A8E',
    marginTop: 2,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statIconGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  statLabel: {
    fontSize: 10,
    color: '#8A8A8E',
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#F0F0F0',
  },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8A8E',
    letterSpacing: 0.5,
  },
  weekendText: {
    color: '#FF6B9D',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
    position: 'relative',
  },
  availableDay: {
    backgroundColor: 'transparent',
  },
  bookedDay: {
    backgroundColor: '#FFF3E0',
  },
  fullyBookedDay: {
    backgroundColor: '#FFEBEE',
  },
  unavailableDay: {
    backgroundColor: '#F5F5F5',
  },
  limitedSlotsDay: {
    backgroundColor: '#E8F5E9',
  },
  todayDay: {
    backgroundColor: '#FF6B9D',
  },
  selectedDay: {
    borderWidth: 2,
    borderColor: '#FF6B9D',
    backgroundColor: '#FFF0F5',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  bookedText: {
    color: '#E65100',
  },
  fullyBookedText: {
    color: '#C62828',
  },
  unavailableText: {
    color: '#757575',
  },
  todayText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  selectedText: {
    color: '#FF6B9D',
    fontWeight: '700',
  },
  bookedIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
  },
  fullyBookedIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#C62828',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  unavailableIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#757575',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  limitedSlotsIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#2E7D32',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  limitedSlotsText: {
    fontSize: 6,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  eventDot: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF6B9D',
  },
  eventsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  eventsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  statusMessage: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  statusMessageText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  eventItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  eventTime: {
    fontSize: 11,
    color: '#8A8A8E',
    marginTop: 2,
  },
  eventTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  eventTypeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  noEventsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  noEventsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 12,
  },
  noEventsSubtext: {
    fontSize: 12,
    color: '#8A8A8E',
    marginTop: 4,
  },
  legendCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  legendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  legendDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  legendDotAvailable: {
    borderWidth: 1,
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  legendDotBooked: {
    borderWidth: 1,
    borderColor: '#FF9800',
    backgroundColor: '#FFF3E0',
  },
  legendDotFullyBooked: {
    borderWidth: 1,
    borderColor: '#C62828',
    backgroundColor: '#FFEBEE',
  },
  legendDotUnavailable: {
    borderWidth: 1,
    borderColor: '#757575',
    backgroundColor: '#F5F5F5',
  },
  legendDotLimited: {
    borderWidth: 1,
    borderColor: '#2E7D32',
    backgroundColor: '#E8F5E9',
  },
  legendDotToday: {
    borderWidth: 1,
    borderColor: '#FF6B9D',
    backgroundColor: '#FF6B9D',
  },
  legendDotEvent: {
    borderWidth: 1,
    borderColor: '#FF6B9D',
    backgroundColor: '#FF6B9D',
  },
  legendText: {
    fontSize: 11,
    color: '#6B6B6E',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  quickActionButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Guest mode styles
  guestContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 16,
    marginBottom: 8,
  },
  guestText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
  },
  guestLoginButton: {
    borderRadius: 25,
    overflow: 'hidden',
    width: '100%',
  },
  guestLoginGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  guestLoginText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default CalendarScreen;