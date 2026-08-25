    // ============================================================
    // FILE: src/components/RescheduleModal.jsx
    // ============================================================

    import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
    import DateTimePicker from '@react-native-community/datetimepicker';
    import { LinearGradient } from 'expo-linear-gradient';
    import { useState } from 'react';
    import {
        ActivityIndicator,
        Alert,
        Modal,
        Platform,
        StyleSheet,
        Text,
        TextInput,
        TouchableOpacity,
        View,
    } from 'react-native';

    const RescheduleModal = ({
        visible,
        booking,
        onClose,
        onRescheduleConfirmed,
        onCancelConfirmed,
        loading,
    }) => {
        const [newDate, setNewDate] = useState(new Date());
        const [newTime, setNewTime] = useState(new Date());
        const [reason, setReason] = useState('');
        const [showDatePicker, setShowDatePicker] = useState(false);
        const [showTimePicker, setShowTimePicker] = useState(false);
        const [step, setStep] = useState(1);

        if (!booking) return null;

        const handleConfirmReschedule = () => {
            if (step === 1) {
                setStep(2);
                return;
            }
            
            if (!reason.trim()) {
                Alert.alert('Required', 'Please provide a reason for rescheduling.');
                return;
            }
            
            const dateStr = newDate.toISOString().split('T')[0];
            const timeStr = newTime.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: true 
            });
            
            onRescheduleConfirmed(dateStr, timeStr);
        };

        const handleCancelBooking = () => {
            Alert.alert(
                'Cancel Booking',
                'Are you sure you want to cancel this booking? This action cannot be undone.',
                [
                    { text: 'No', style: 'cancel' },
                    { 
                        text: 'Yes, Cancel', 
                        style: 'destructive',
                        onPress: onCancelConfirmed
                    }
                ]
            );
        };

        const formatDateDisplay = (date) => {
            const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
            return date.toLocaleDateString('en-US', options);
        };

        const formatTimeDisplay = (date) => {
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        };

        return (
            <Modal
                visible={visible}
                transparent
                animationType="slide"
                onRequestClose={onClose}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity 
                        style={styles.modalBackdrop} 
                        activeOpacity={1} 
                        onPress={onClose} 
                    />
                    <View style={styles.modalContent}>
                        <LinearGradient
                            colors={['#2196F3', '#64B5F6']}
                            style={styles.modalHeader}
                        >
                            <Text style={styles.modalTitle}>
                                {step === 1 ? 'Reschedule Booking' : 'Confirm Reschedule'}
                            </Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Feather name="x" size={22} color="#FFF" />
                            </TouchableOpacity>
                        </LinearGradient>

                        <View style={styles.modalBody}>
                            {/* Booking Info */}
                            <View style={styles.bookingInfo}>
                                <Text style={styles.bookingId}>{booking.id}</Text>
                                <Text style={styles.bookingType}>{booking.eventType}</Text>
                                <View style={styles.bookingDetails}>
                                    <Text style={styles.bookingDetail}>
                                        📅 {booking.date} at {booking.timeSlot}
                                    </Text>
                                    <Text style={styles.bookingDetail}>
                                        👥 {booking.pax} guests · ₱{booking.total.toLocaleString()}
                                    </Text>
                                </View>
                            </View>

                            {step === 1 ? (
                                // Step 1: Select New Date & Time
                                <View>
                                    <Text style={styles.stepLabel}>Select New Date & Time</Text>
                                    
                                    <TouchableOpacity 
                                        style={styles.dateTimeSelector}
                                        onPress={() => setShowDatePicker(true)}
                                    >
                                        <MaterialCommunityIcons name="calendar-today" size={22} color="#2196F3" />
                                        <Text style={styles.dateTimeText}>{formatDateDisplay(newDate)}</Text>
                                        <Feather name="chevron-down" size={18} color="#B0B0B0" />
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        style={styles.dateTimeSelector}
                                        onPress={() => setShowTimePicker(true)}
                                    >
                                        <MaterialCommunityIcons name="clock-outline" size={22} color="#2196F3" />
                                        <Text style={styles.dateTimeText}>{formatTimeDisplay(newTime)}</Text>
                                        <Feather name="chevron-down" size={18} color="#B0B0B0" />
                                    </TouchableOpacity>

                                    <Text style={styles.noteText}>
                                        <MaterialCommunityIcons name="information" size={14} color="#2196F3" />
                                        {' '}The new date/time is subject to availability confirmation.
                                    </Text>
                                </View>
                            ) : (
                                // Step 2: Provide Reason
                                <View>
                                    <Text style={styles.stepLabel}>Reason for Reschedule</Text>
                                    <TextInput
                                        style={styles.reasonInput}
                                        placeholder="Please explain why you need to reschedule..."
                                        placeholderTextColor="#B0B0B0"
                                        value={reason}
                                        onChangeText={setReason}
                                        multiline
                                        numberOfLines={4}
                                        textAlignVertical="top"
                                    />
                                    
                                    <View style={styles.confirmationDetails}>
                                        <Text style={styles.confirmationLabel}>New Schedule:</Text>
                                        <Text style={styles.confirmationValue}>
                                            {formatDateDisplay(newDate)} at {formatTimeDisplay(newTime)}
                                        </Text>
                                    </View>

                                    <Text style={styles.warningText}>
                                        <Feather name="alert-triangle" size={14} color="#FF9800" />
                                        {' '}Once confirmed, your booking will be updated to the new schedule.
                                    </Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.modalFooter}>
                            {step === 2 && (
                                <TouchableOpacity 
                                    style={styles.backButton}
                                    onPress={() => setStep(1)}
                                >
                                    <Feather name="arrow-left" size={18} color="#8E8E93" />
                                    <Text style={styles.backButtonText}>Back</Text>
                                </TouchableOpacity>
                            )}
                            
                            <TouchableOpacity 
                                style={[styles.cancelButton, step === 1 && styles.cancelButtonFull]}
                                onPress={handleCancelBooking}
                                disabled={loading}
                            >
                                <Feather name="x" size={18} color="#F44336" />
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[styles.confirmButton, step === 1 && styles.confirmButtonFull]}
                                onPress={handleConfirmReschedule}
                                disabled={loading}
                            >
                                <LinearGradient
                                    colors={['#2196F3', '#64B5F6']}
                                    style={styles.confirmGradient}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#FFF" size="small" />
                                    ) : (
                                        <>
                                            <Text style={styles.confirmButtonText}>
                                                {step === 1 ? 'Next' : 'Confirm Reschedule'}
                                            </Text>
                                            <Feather name="arrow-right" size={18} color="#FFF" />
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>

                        {/* Date/Time Pickers */}
                        {showDatePicker && (
                            <DateTimePicker
                                value={newDate}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={(event, selectedDate) => {
                                    setShowDatePicker(false);
                                    if (selectedDate) setNewDate(selectedDate);
                                }}
                                minimumDate={new Date()}
                            />
                        )}
                        {showTimePicker && (
                            <DateTimePicker
                                value={newTime}
                                mode="time"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={(event, selectedTime) => {
                                    setShowTimePicker(false);
                                    if (selectedTime) setNewTime(selectedTime);
                                }}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        );
    };

    const styles = StyleSheet.create({
        modalOverlay: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        modalBackdrop: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
        },
        modalContent: {
            backgroundColor: '#FFF',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '85%',
            overflow: 'hidden',
        },
        modalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 16,
        },
        modalTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: '#FFF',
        },
        closeButton: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.2)',
            justifyContent: 'center',
            alignItems: 'center',
        },
        modalBody: {
            padding: 20,
            maxHeight: 400,
        },
        bookingInfo: {
            backgroundColor: '#F5F9FF',
            borderRadius: 16,
            padding: 16,
            marginBottom: 20,
        },
        bookingId: {
            fontSize: 12,
            color: '#2196F3',
            fontWeight: '600',
        },
        bookingType: {
            fontSize: 16,
            fontWeight: '700',
            color: '#2D2D2D',
            marginTop: 2,
        },
        bookingDetails: {
            marginTop: 8,
        },
        bookingDetail: {
            fontSize: 13,
            color: '#5A5A5E',
            marginTop: 2,
        },
        stepLabel: {
            fontSize: 14,
            fontWeight: '600',
            color: '#2D2D2D',
            marginBottom: 12,
        },
        dateTimeSelector: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#F5F5F5',
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            marginBottom: 10,
            gap: 10,
        },
        dateTimeText: {
            flex: 1,
            fontSize: 14,
            color: '#2D2D2D',
        },
        noteText: {
            fontSize: 12,
            color: '#8A8A8E',
            marginTop: 8,
            lineHeight: 18,
        },
        reasonInput: {
            backgroundColor: '#F5F5F5',
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 14,
            color: '#2D2D2D',
            minHeight: 80,
            textAlignVertical: 'top',
        },
        confirmationDetails: {
            flexDirection: 'row',
            backgroundColor: '#E3F2FD',
            borderRadius: 12,
            padding: 12,
            marginTop: 12,
            gap: 8,
        },
        confirmationLabel: {
            fontSize: 13,
            fontWeight: '600',
            color: '#1565C0',
        },
        confirmationValue: {
            fontSize: 13,
            fontWeight: '500',
            color: '#0D47A1',
            flex: 1,
        },
        warningText: {
            fontSize: 12,
            color: '#FF9800',
            marginTop: 12,
            lineHeight: 18,
            backgroundColor: '#FFF3E0',
            padding: 10,
            borderRadius: 10,
        },
        modalFooter: {
            flexDirection: 'row',
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderTopWidth: 1,
            borderTopColor: '#F0F0F0',
            gap: 10,
        },
        backButton: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            gap: 4,
        },
        backButtonText: {
            fontSize: 14,
            color: '#8E8E93',
        },
        cancelButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FFEBEE',
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 28,
            gap: 6,
            flex: 1,
        },
        cancelButtonFull: {
            flex: 1,
        },
        cancelButtonText: {
            fontSize: 14,
            fontWeight: '600',
            color: '#F44336',
        },
        confirmButton: {
            borderRadius: 28,
            overflow: 'hidden',
            flex: 2,
        },
        confirmButtonFull: {
            flex: 2,
        },
        confirmGradient: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 12,
            gap: 8,
        },
        confirmButtonText: {
            fontSize: 14,
            fontWeight: '600',
            color: '#FFF',
        },
    });

    export default RescheduleModal;