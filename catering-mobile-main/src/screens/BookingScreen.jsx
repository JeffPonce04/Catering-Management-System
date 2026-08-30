// src/screens/BookingScreen.js - FIXED KEYBOARD BEHAVIOR
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
    SafeAreaView,
    findNodeHandle
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { bookingAPI } from '../services/api';
import { menuService } from '../services/menuService';
import { packageService } from '../services/packageService';
import { promotionService } from '../services/promotionService';

const { width, height } = Dimensions.get('window');

// ============================================================
// CONSTANTS
// ============================================================

const MEAL_TYPES = [
    { id: 'breakfast', label: 'Breakfast', icon: 'coffee', time: '7:00 AM - 9:00 AM', color: '#FF6B9D' },
    { id: 'snack1', label: 'Morning Snack', icon: 'food-apple', time: '10:00 AM - 11:00 AM', color: '#4CAF50' },
    { id: 'lunch', label: 'Lunch', icon: 'food', time: '12:00 PM - 2:00 PM', color: '#FF6B9D' },
    { id: 'snack2', label: 'Afternoon Snack', icon: 'food-apple', time: '3:00 PM - 4:00 PM', color: '#2196F3' },
    { id: 'dinner', label: 'Dinner', icon: 'food-variant', time: '6:00 PM - 8:00 PM', color: '#9C27B0' },
];

const SERVICE_TYPES = [
    { id: 'buffet', label: 'Buffet Service', icon: 'silverware-fork-knife', description: 'Full buffet setup with equipment', color: '#FF6B9D' },
    { id: 'packed', label: 'Packed Meals', icon: 'food', description: 'Individual packed meals', color: '#4CAF50' },
    { id: 'tray', label: 'Tray Service', icon: 'tray', description: 'Family-style food trays', color: '#FF9800' },
];

const DEFAULT_MEAL_SERVICE = {
    id: null,
    meal_type: 'lunch',
    day_number: 1,
    pax: 0,
    price_per_head: 0,
    serving_time: '12:00 PM',
    menu_items: [],
    notes: '',
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const getCategoryName = (category) => {
    if (!category) return 'Uncategorized';
    if (typeof category === 'string') return category;
    return category.name || category.category_name || category.slug || 'Uncategorized';
};

const normalizeMenuForSelector = (item, index = 0) => ({
    ...item,
    id: `menu-${item.menu_item_id || item.id || index}`,
    menu_item_id: item.menu_item_id || item.id,
    source_type: 'menu',
    item_type: 'menu_item',
    name: item.name || 'Unnamed Item',
    price: parseFloat(item.price) || 0,
    category: getCategoryName(item.category || item.category_name),
});

const normalizePackageForSelector = (item, index = 0) => ({
    ...item,
    id: `package-${item.package_id || item.id || index}`,
    package_id: item.package_id || item.id,
    source_type: 'package',
    item_type: 'package',
    name: item.name || 'Package',
    price: parseFloat(item.base_price_per_pax || item.price_per_head || item.price) || 0,
    category: 'Packages',
});

const normalizePromotionForSelector = (item, index = 0) => ({
    ...item,
    id: `promotion-${item.promotion_id || item.id || index}`,
    promotion_id: item.promotion_id || item.id,
    source_type: 'promotion',
    item_type: 'promotion',
    name: item.name || 'Promotion',
    price: parseFloat(item.discounted_price || item.promo_price || item.price) || 0,
    category: 'Promotions',
});

// ============================================================
// ENHANCED STEP INDICATOR COMPONENT
// ============================================================
const StepIndicator = ({ currentStep, steps }) => {
    const labels = ['Event Details', 'Meal Services', 'Confirmation'];
    const icons = ['calendar-edit', 'food', 'check-circle'];
    
    return (
        <View style={stepStyles.container}>
            <LinearGradient
                colors={['#FFF5F8', '#FFFFFF']}
                style={stepStyles.gradientBackground}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />
            {steps.map((step, index) => {
                const isActive = step === currentStep;
                const isCompleted = step < currentStep;
                const isUpcoming = step > currentStep;
                
                return (
                    <View key={step} style={stepStyles.stepWrapper}>
                        {index > 0 && (
                            <View style={stepStyles.connectorWrapper}>
                                <View style={[
                                    stepStyles.connectorLine,
                                    isCompleted && stepStyles.connectorLineCompleted,
                                    isActive && stepStyles.connectorLineActive
                                ]} />
                            </View>
                        )}
                        <TouchableOpacity 
                            style={stepStyles.stepContent}
                            activeOpacity={0.7}
                            disabled={isUpcoming}
                        >
                            <View style={[
                                stepStyles.circle,
                                isActive && stepStyles.circleActive,
                                isCompleted && stepStyles.circleCompleted,
                                isUpcoming && stepStyles.circleUpcoming
                            ]}>
                                {isCompleted ? (
                                    <Feather name="check" size={14} color="#FFF" />
                                ) : isActive ? (
                                    <MaterialCommunityIcons 
                                        name={icons[index]} 
                                        size={14} 
                                        color="#FFF" 
                                    />
                                ) : (
                                    <Text style={stepStyles.stepNumber}>{step}</Text>
                                )}
                            </View>
                            <View style={stepStyles.labelContainer}>
                                <Text style={[
                                    stepStyles.label,
                                    isActive && stepStyles.labelActive,
                                    isCompleted && stepStyles.labelCompleted,
                                    isUpcoming && stepStyles.labelUpcoming
                                ]}>
                                    {labels[index]}
                                </Text>
                                {isActive && (
                                    <View style={stepStyles.activeIndicator}>
                                        <LinearGradient
                                            colors={['#FF6B9D', '#FF8FB1']}
                                            style={stepStyles.activeDot}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                        />
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                    </View>
                );
            })}
        </View>
    );
};

const stepStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
        paddingVertical: 18,
        paddingTop: 14,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F5EEF0',
        position: 'relative',
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        zIndex: 10,
    },
    gradientBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.5,
    },
    stepWrapper: {
        flex: 1,
        alignItems: 'center',
        position: 'relative',
    },
    connectorWrapper: {
        position: 'absolute',
        top: 18,
        left: -20,
        right: 20,
        height: 2,
        zIndex: 0,
    },
    connectorLine: {
        flex: 1,
        height: 2,
        backgroundColor: '#E8E0E3',
        marginHorizontal: 5,
        borderRadius: 1,
    },
    connectorLineCompleted: {
        backgroundColor: '#FF6B9D',
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
    },
    connectorLineActive: {
        backgroundColor: '#FF6B9D',
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
    },
    stepContent: {
        alignItems: 'center',
        zIndex: 1,
    },
    circle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F0E8EB',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2.5,
        borderColor: '#F0E8EB',
        marginBottom: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    circleActive: {
        backgroundColor: '#FF6B9D',
        borderColor: '#FF6B9D',
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 5,
        transform: [{ scale: 1.05 }],
    },
    circleCompleted: {
        backgroundColor: '#4CAF50',
        borderColor: '#4CAF50',
        shadowColor: '#4CAF50',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 3,
    },
    circleUpcoming: {
        backgroundColor: '#FFFFFF',
        borderColor: '#E0D8DB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
    },
    stepNumber: {
        fontSize: 13,
        fontWeight: '700',
        color: '#8E8E93',
    },
    labelContainer: {
        alignItems: 'center',
        position: 'relative',
    },
    label: {
        fontSize: 9,
        fontWeight: '500',
        color: '#8E8E93',
        textAlign: 'center',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    labelActive: {
        color: '#FF6B9D',
        fontWeight: '700',
        letterSpacing: 0.6,
    },
    labelCompleted: {
        color: '#4CAF50',
        fontWeight: '600',
    },
    labelUpcoming: {
        color: '#B0B0B0',
        fontWeight: '400',
    },
    activeIndicator: {
        marginTop: 3,
        height: 3,
        borderRadius: 1.5,
        overflow: 'hidden',
        width: 20,
    },
    activeDot: {
        width: 20,
        height: 3,
        borderRadius: 1.5,
    },
});

// ============================================================
// SCROLL INDICATOR COMPONENT
// ============================================================
const ScrollIndicator = ({ visible, animated }) => {
    const bounceValue = useRef(new Animated.Value(0)).current;
    
    useEffect(() => {
        if (visible && animated) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(bounceValue, {
                        toValue: 1,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                    Animated.timing(bounceValue, {
                        toValue: 0,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            bounceValue.setValue(0);
        }
    }, [visible, animated]);
    
    if (!visible) return null;
    
    const translateY = bounceValue.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, -8, 0],
    });
    
    return (
        <TouchableWithoutFeedback>
            <Animated.View style={[scrollIndicatorStyles.container, { transform: [{ translateY }] }]}>
                <View style={scrollIndicatorStyles.arrowContainer}>
                    <Feather name="chevron-down" size={20} color="#FF6B9D" />
                </View>
                <Text style={scrollIndicatorStyles.text}>Scroll for more</Text>
            </Animated.View>
        </TouchableWithoutFeedback>
    );
};

const scrollIndicatorStyles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingVertical: 12,
        marginBottom: 4,
    },
    arrowContainer: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#FFF5F8',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#FFE8EE',
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    text: {
        fontSize: 10,
        color: '#B0B0B0',
        marginTop: 4,
        fontWeight: '500',
        letterSpacing: 0.3,
    },
});

// ============================================================
// EVENT TYPE SCROLL INDICATOR
// ============================================================
const EventTypeScrollIndicator = ({ visible, canScrollLeft, canScrollRight, onScrollLeft, onScrollRight }) => {
    const pulseValue = useRef(new Animated.Value(0)).current;
    
    useEffect(() => {
        if (visible && (canScrollLeft || canScrollRight)) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseValue, {
                        toValue: 1,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseValue, {
                        toValue: 0,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            pulseValue.setValue(0);
        }
    }, [visible, canScrollLeft, canScrollRight]);
    
    if (!visible || (!canScrollLeft && !canScrollRight)) return null;
    
    const opacity = pulseValue.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.3, 1, 0.3],
    });
    
    return (
        <View style={eventTypeScrollStyles.container}>
            {canScrollLeft && (
                <Animated.View style={[eventTypeScrollStyles.arrowButton, { opacity }]}>
                    <TouchableOpacity 
                        onPress={onScrollLeft}
                        activeOpacity={0.7}
                        style={eventTypeScrollStyles.touchable}
                    >
                        <Feather name="chevron-left" size={16} color="#FF6B9D" />
                    </TouchableOpacity>
                </Animated.View>
            )}
            <View style={eventTypeScrollStyles.scrollHint}>
                <Text style={eventTypeScrollStyles.scrollHintText}>Scroll to see more</Text>
            </View>
            {canScrollRight && (
                <Animated.View style={[eventTypeScrollStyles.arrowButton, eventTypeScrollStyles.arrowRight, { opacity }]}>
                    <TouchableOpacity 
                        onPress={onScrollRight}
                        activeOpacity={0.7}
                        style={eventTypeScrollStyles.touchable}
                    >
                        <Feather name="chevron-right" size={16} color="#FF6B9D" />
                    </TouchableOpacity>
                </Animated.View>
            )}
        </View>
    );
};

const eventTypeScrollStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 2,
        paddingVertical: 4,
        marginTop: -2,
        marginBottom: 4,
        backgroundColor: '#FFF5F8',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FFE8EE',
        borderStyle: 'dashed',
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    scrollHint: {
        flex: 1,
        alignItems: 'center',
    },
    scrollHintText: {
        fontSize: 9,
        color: '#FF6B9D',
        fontWeight: '500',
        letterSpacing: 0.3,
    },
    arrowButton: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#FFE8EE',
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    arrowRight: {
        alignSelf: 'center',
    },
    touchable: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

// ============================================================
// MAIN COMPONENT
// ============================================================

const BookingScreen = ({ navigation, route }) => {
    const { user, isAuthenticated, isGuest } = useAuth();
    const { cartItems, getTotalAmount, clearCart } = useCart();
    
    // Route params
    const routePackage = route?.params?.packageData || route?.params?.package || null;
    const routePackageId = route?.params?.packageId || route?.params?.id || null;
    const routePromotion = route?.params?.promotionData || route?.params?.promotion || null;
    const routePromotionId = route?.params?.promotionId || null;
    
    // State
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [focusedInput, setFocusedInput] = useState(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);
    const [showMenuSelector, setShowMenuSelector] = useState(false);
    const [selectedMealForMenu, setSelectedMealForMenu] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [viewMode, setViewMode] = useState('grid');
    const [tempSelectedItems, setTempSelectedItems] = useState([]);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [showScrollIndicator, setShowScrollIndicator] = useState(false);
    const [scrollEnabled, setScrollEnabled] = useState(true);
    
    // Event type scroll state
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const eventTypeScrollRef = useRef(null);
    const [eventTypeScrollX, setEventTypeScrollX] = useState(0);
    const [eventTypeContentWidth, setEventTypeContentWidth] = useState(0);
    const [eventTypeContainerWidth, setEventTypeContainerWidth] = useState(0);
    const [showEventTypeScrollHint, setShowEventTypeScrollHint] = useState(false);
    
    // Data from API
    const [eventTypes, setEventTypes] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [packages, setPackages] = useState([]);
    const [promotions, setPromotions] = useState([]);
    const [categories, setCategories] = useState(['All']);
    
    // Selection state
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [selectedPromotion, setSelectedPromotion] = useState(null);
    const [isPackageBooking, setIsPackageBooking] = useState(false);
    const [isPromoBooking, setIsPromoBooking] = useState(false);
    
    // Animations
    const fadeAnim = useRef(new Animated.Value(1)).current;
    
    // Refs
    const inputRefs = useRef({});
    const scrollViewRef = useRef(null);
    const mealIdCounter = useRef(1);
    const isMounted = useRef(true);
    const scrollPosition = useRef(0);
    const focusedFieldRef = useRef(null);
    const scrollViewHeightRef = useRef(0);
    const contentHeightRef = useRef(0);
    const scrollTimerRef = useRef(null);
    const contentMeasured = useRef(false);
    const keyboardShowListener = useRef(null);
    const keyboardHideListener = useRef(null);

    // ============================================================
    // FORM STATE
    // ============================================================
    const [formData, setFormData] = useState({
        customer_name: user?.full_name || user?.name || '',
        customer_email: user?.email || '',
        customer_phone: user?.phone_number || '',
        event_type_id: null,
        event_date: new Date(),
        event_end_date: null,
        event_time: new Date(),
        venue: '',
        guests_count: '',
        service_type: 'buffet',
        event_scope: 'regular',
        total_days: 1,
        meal_services: [],
        multi_events: [{ id: 1 }],
        transportation_fee: 0,
        setup_fee: 0,
        service_crew_fee: 0,
        equipment_rental: 0,
        extra_food_fee: 0,
        discount: 0,
        delivery_method: 'delivery',
        delivery_address: '',
        delivery_contact_person: '',
        delivery_contact_phone: '',
        delivery_fee: 0,
        has_waiters: false,
        special_requests: '',
        menu_selection_type: 'custom',
        package_id: null,
        promotion_id: null,
        total_amount: 0,
        required_deposit: 0,
        down_payment: 0,
        payment_method: 'cash',
        payment_reference: '',
        transaction_id: '',
    });

    // ============================================================
    // KEYBOARD HANDLING
    // ============================================================
    const dismissKeyboard = useCallback(() => {
        Keyboard.dismiss();
        setFocusedInput(null);
        focusedFieldRef.current = null;
    }, []);

    const handleFocus = useCallback((fieldName) => {
        setFocusedInput(fieldName);
        focusedFieldRef.current = fieldName;
        
        // Scroll to the focused input with a delay to ensure keyboard is shown
        setTimeout(() => {
            if (scrollViewRef.current && inputRefs.current[fieldName]) {
                const inputRef = inputRefs.current[fieldName];
                const nodeHandle = findNodeHandle(inputRef);
                
                if (nodeHandle) {
                    try {
                        const UIManager = require('react-native').UIManager;
                        UIManager.measureLayout(
                            nodeHandle,
                            findNodeHandle(scrollViewRef.current),
                            () => {
                                // Fallback scroll
                                scrollViewRef.current?.scrollTo({
                                    y: scrollPosition.current + 120,
                                    animated: true
                                });
                            },
                            (x, y, width, height) => {
                                // Scroll to make input visible above keyboard
                                const targetY = Math.max(0, y - 150);
                                scrollViewRef.current?.scrollTo({
                                    y: targetY,
                                    animated: true
                                });
                            }
                        );
                    } catch (e) {
                        // Fallback scroll
                        scrollViewRef.current?.scrollTo({
                            y: scrollPosition.current + 120,
                            animated: true
                        });
                    }
                }
            }
        }, 400);
    }, []);

    const handleBlur = useCallback(() => {
        setFocusedInput(null);
        focusedFieldRef.current = null;
    }, []);

    const handleNextInput = useCallback((currentField, nextField) => {
        if (nextField && inputRefs.current[nextField]) {
            setTimeout(() => {
                inputRefs.current[nextField]?.focus();
                handleFocus(nextField);
            }, 150);
        }
    }, [handleFocus]);

    // ============================================================
    // KEYBOARD LISTENERS
    // ============================================================
    useEffect(() => {
        keyboardShowListener.current = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (event) => {
                setKeyboardVisible(true);
                setKeyboardHeight(event.endCoordinates.height);
                setScrollEnabled(false);
            }
        );
        keyboardHideListener.current = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => {
                setKeyboardVisible(false);
                setKeyboardHeight(0);
                setScrollEnabled(true);
            }
        );

        return () => {
            keyboardShowListener.current?.remove();
            keyboardHideListener.current?.remove();
        };
    }, []);

    // ============================================================
    // UPDATE FORM FIELD
    // ============================================================
    const updateFormField = useCallback((field, value) => {
        setFormData(prev => {
            const next = { ...prev, [field]: value };

            if (field === 'guests_count') {
                const guestCount = parseInt(value, 10) || 0;
                next.meal_services = (prev.meal_services || []).map(meal => ({
                    ...meal,
                    pax: !meal.pax || Number(meal.pax) <= 0 ? guestCount : meal.pax,
                }));
            }

            if (field === 'event_scope') {
                if (value === 'regular') {
                    next.total_days = 1;
                    next.event_end_date = null;
                } else {
                    next.total_days = 2;
                    const endDate = new Date(next.event_date);
                    endDate.setDate(endDate.getDate() + 1);
                    next.event_end_date = endDate;
                }
                setTimeout(() => {
                    initializeMealServices();
                }, 100);
            }

            if (field === 'event_end_date') {
                if (value && next.event_date) {
                    const days = Math.ceil((value - next.event_date) / (1000 * 60 * 60 * 24)) + 1;
                    next.total_days = Math.max(1, days);
                }
            }

            return next;
        });
    }, []);

    // ============================================================
    // MEAL SERVICES FUNCTIONS
    // ============================================================
    const initializeMealServices = useCallback(() => {
        const totalDays = formData.total_days || 1;
        const guestCount = parseInt(formData.guests_count) || 0;
        const meals = [];
        
        for (let day = 1; day <= totalDays; day++) {
            meals.push({
                ...DEFAULT_MEAL_SERVICE,
                id: mealIdCounter.current++,
                day_number: day,
                meal_type: 'lunch',
                serving_time: '12:00 PM',
                pax: guestCount,
                menu_items: [],
            });
        }
        
        setFormData(prev => ({ ...prev, meal_services: meals }));
    }, [formData.total_days, formData.guests_count]);

    const addMealService = useCallback(() => {
        const totalDays = formData.total_days || 1;
        const guestCount = parseInt(formData.guests_count) || 0;
        
        if (formData.meal_services.length === 0) {
            initializeMealServices();
            return;
        }
        
        const totalSlots = totalDays * MEAL_TYPES.length;
        if (formData.meal_services.length >= totalSlots) {
            Alert.alert('Maximum Reached', `You've added all meal types for all ${totalDays} day(s).`);
            return;
        }
        
        let foundSlot = false;
        let newDay = 1;
        let newMealType = 'lunch';
        
        for (let day = 1; day <= totalDays; day++) {
            const mealsForDay = formData.meal_services.filter(m => m.day_number === day);
            const mealTypesForDay = mealsForDay.map(m => m.meal_type);
            
            const availableMeals = MEAL_TYPES.filter(m => !mealTypesForDay.includes(m.id));
            
            if (availableMeals.length > 0) {
                newDay = day;
                newMealType = availableMeals[0].id;
                foundSlot = true;
                break;
            }
        }
        
        if (!foundSlot) {
            Alert.alert('Maximum Reached', `All meal slots are filled for ${totalDays} day(s).`);
            return;
        }
        
        const newMeal = {
            ...DEFAULT_MEAL_SERVICE,
            id: mealIdCounter.current++,
            day_number: newDay,
            meal_type: newMealType,
            serving_time: '12:00 PM',
            pax: guestCount,
            menu_items: [],
        };
        
        setFormData(prev => ({
            ...prev,
            meal_services: [...prev.meal_services, newMeal]
        }));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        setTimeout(() => {
            if (scrollViewRef.current) {
                scrollViewRef.current.scrollToEnd({ animated: true });
            }
        }, 300);
    }, [formData.total_days, formData.guests_count, formData.meal_services, initializeMealServices]);

    const removeMealService = useCallback((mealId) => {
        if (formData.meal_services.length <= 1) {
            Alert.alert('Cannot Remove', 'You need at least one meal service.');
            return;
        }
        
        Alert.alert(
            'Remove Meal',
            'Remove this meal service?',
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Remove', 
                    style: 'destructive',
                    onPress: () => {
                        setFormData(prev => ({
                            ...prev,
                            meal_services: prev.meal_services.filter(m => m.id !== mealId)
                        }));
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                }
            ]
        );
    }, [formData.meal_services]);

    const updateMealService = useCallback((mealId, updates) => {
        setFormData(prev => {
            const mealIndex = prev.meal_services.findIndex(m => m.id === mealId);
            if (mealIndex === -1) return prev;
            
            const meal = prev.meal_services[mealIndex];
            const updatedMeal = { ...meal, ...updates };
            
            if (updates.meal_type && updates.meal_type !== meal.meal_type) {
                const dayNumber = updates.day_number || meal.day_number;
                const duplicateExists = prev.meal_services.some((m, index) => 
                    index !== mealIndex && 
                    m.day_number === dayNumber && 
                    m.meal_type === updates.meal_type
                );
                
                if (duplicateExists) {
                    Alert.alert('Duplicate Meal', `This meal type is already added for Day ${dayNumber}.`);
                    return prev;
                }
            }
            
            if (updates.day_number && updates.day_number !== meal.day_number) {
                const mealType = updates.meal_type || meal.meal_type;
                const duplicateExists = prev.meal_services.some((m, index) => 
                    index !== mealIndex && 
                    m.day_number === updates.day_number && 
                    m.meal_type === mealType
                );
                
                if (duplicateExists) {
                    Alert.alert('Duplicate Meal', `This meal type is already added for Day ${updates.day_number}.`);
                    return prev;
                }
            }
            
            const newMeals = [...prev.meal_services];
            newMeals[mealIndex] = updatedMeal;
            return { ...prev, meal_services: newMeals };
        });
    }, []);

    // ============================================================
    // MENU SELECTION FUNCTIONS
    // ============================================================
    const openMenuSelector = useCallback((mealId) => {
        dismissKeyboard();
        setSelectedMealForMenu(mealId);
        const meal = formData.meal_services.find(m => m.id === mealId);
        setTempSelectedItems(meal?.menu_items || []);
        setShowMenuSelector(true);
        setSearchQuery('');
        setSelectedCategory('All');
    }, [formData.meal_services, dismissKeyboard]);

    const toggleMenuItem = useCallback((menuItem) => {
        setTempSelectedItems(prev => {
            const exists = prev.some(item => item.id === menuItem.id);
            if (exists) {
                return prev.filter(item => item.id !== menuItem.id);
            } else {
                return [...prev, { ...menuItem, quantity: 1 }];
            }
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    const confirmMenuSelection = useCallback(() => {
        if (selectedMealForMenu) {
            updateMealService(selectedMealForMenu, { menu_items: tempSelectedItems });
        }
        setShowMenuSelector(false);
        setSelectedMealForMenu(null);
        setTempSelectedItems([]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [selectedMealForMenu, tempSelectedItems, updateMealService]);

    const updateMenuItemQuantity = useCallback((mealId, itemId, quantity) => {
        const newQuantity = Math.max(1, quantity);
        setFormData(prev => ({
            ...prev,
            meal_services: prev.meal_services.map(meal => {
                if (meal.id === mealId) {
                    return {
                        ...meal,
                        menu_items: meal.menu_items.map(item =>
                            item.id === itemId ? { ...item, quantity: newQuantity } : item
                        )
                    };
                }
                return meal;
            })
        }));
    }, []);

    // ============================================================
    // CALCULATION FUNCTIONS
    // ============================================================
    const getMealTotal = useCallback((meal) => {
        const menuTotal = (meal.menu_items || []).reduce(
            (sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 
            0
        );
        const paxTotal = (meal.pax || 0) * (meal.price_per_head || 0);
        return menuTotal + paxTotal;
    }, []);

    const getTotalMealServices = useCallback(() => {
        return (formData.meal_services || []).reduce(
            (sum, meal) => sum + getMealTotal(meal), 
            0
        );
    }, [formData.meal_services, getMealTotal]);

    const calculateAdditionalCharges = useCallback(() => {
        let total = 0;
        total += parseFloat(formData.transportation_fee || 0);
        total += parseFloat(formData.setup_fee || 0);
        total += parseFloat(formData.service_crew_fee || 0);
        total += parseFloat(formData.equipment_rental || 0);
        total += parseFloat(formData.extra_food_fee || 0);
        total += parseFloat(formData.delivery_fee || 0);
        return total;
    }, [formData]);

    const calculateDiscount = useCallback(() => {
        return parseFloat(formData.discount || 0);
    }, [formData]);

    const calculateTotal = useCallback(() => {
        let total = getTotalMealServices() + calculateAdditionalCharges();
        const discount = calculateDiscount();
        total = Math.max(0, total - discount);
        
        if (isPromoBooking && selectedPromotion) {
            if (selectedPromotion.discount_type === 'percentage') {
                total = total * (1 - selectedPromotion.discount_value / 100);
            } else {
                total = Math.max(0, total - selectedPromotion.discount_value);
            }
        }
        
        return total;
    }, [getTotalMealServices, calculateAdditionalCharges, calculateDiscount, isPromoBooking, selectedPromotion]);

    // ============================================================
    // LOAD DATA FUNCTIONS
    // ============================================================
    const loadEventTypes = useCallback(async () => {
        try {
            const response = await bookingAPI.getEventTypes();
            if (response.data?.success) {
                const types = response.data.data?.data || response.data.data || [];
                setEventTypes(types.map(t => ({
                    ...t,
                    value: t.event_type_id || t.id,
                    label: t.name || t.label || 'Event',
                    color: t.color || '#FF6B9D'
                })));
                setTimeout(() => {
                    if (types.length > 3) {
                        setShowEventTypeScrollHint(true);
                    }
                }, 500);
            }
        } catch (error) {
            setEventTypes([
                { event_type_id: 1, name: 'Wedding', label: 'Wedding', color: '#FF6B9D' },
                { event_type_id: 2, name: 'Birthday', label: 'Birthday', color: '#FF9800' },
                { event_type_id: 3, name: 'Corporate', label: 'Corporate', color: '#4CAF50' },
                { event_type_id: 4, name: 'Seminar', label: 'Seminar', color: '#2196F3' },
                { event_type_id: 5, name: 'Fiesta', label: 'Fiesta', color: '#FF5722' },
                { event_type_id: 6, name: 'Other', label: 'Other', color: '#795548' },
            ]);
            setShowEventTypeScrollHint(true);
        }
    }, []);

    const loadMenuItems = useCallback(async () => {
        try {
            const result = await menuService.getPublicMenuItems({ is_available: true });
            if (result.success && result.data) {
                const formattedItems = result.data.map((item, index) => 
                    normalizeMenuForSelector(item, index)
                );
                setMenuItems(formattedItems);
                
                const uniqueCategories = ['All', ...new Set(
                    formattedItems.map(item => item.category || 'Uncategorized')
                )];
                setCategories(uniqueCategories);
            }
        } catch (error) {
            console.log('Error loading menu items:', error);
        }
    }, []);

    const loadPackages = useCallback(async () => {
        try {
            const result = await packageService.getPublicPackages();
            if (result.success && result.data) {
                setPackages(result.data.map((item, index) => 
                    normalizePackageForSelector(item, index)
                ));
            }
        } catch (error) {
            console.log('Error loading packages:', error);
        }
    }, []);

    const loadPromotions = useCallback(async () => {
        try {
            const result = await promotionService.getPublicPromotions();
            if (result.success && result.data) {
                setPromotions(result.data.map((item, index) => 
                    normalizePromotionForSelector(item, index)
                ));
            }
        } catch (error) {
            console.log('Error loading promotions:', error);
        }
    }, []);

    // ============================================================
    // VALIDATION FUNCTIONS
    // ============================================================
    const validateStep1 = useCallback(() => {
        if (!formData.customer_name?.trim()) {
            Alert.alert('Required', 'Please enter your full name');
            return false;
        }
        if (!formData.customer_email?.includes('@')) {
            Alert.alert('Required', 'Please enter a valid email');
            return false;
        }
        if (!formData.customer_phone?.trim()) {
            Alert.alert('Required', 'Please enter your phone number');
            return false;
        }
        if (!formData.event_type_id) {
            Alert.alert('Required', 'Please select an event type');
            return false;
        }
        if (!formData.event_date) {
            Alert.alert('Required', 'Please select an event date');
            return false;
        }
        if (formData.event_scope === 'multi' && !formData.event_end_date) {
            Alert.alert('Required', 'Please select an end date for multi-day event');
            return false;
        }
        if (formData.event_scope === 'multi' && formData.event_end_date <= formData.event_date) {
            Alert.alert('Invalid Date', 'End date must be after start date');
            return false;
        }
        if (!formData.venue?.trim()) {
            Alert.alert('Required', 'Please enter event location');
            return false;
        }
        const guestCount = parseInt(formData.guests_count);
        if (!guestCount || guestCount < 10) {
            Alert.alert('Required', 'Minimum of 10 guests required');
            return false;
        }
        return true;
    }, [formData]);

    const validateStep2 = useCallback(() => {
        const hasMeals = (formData.meal_services || []).some(m => 
            (m.menu_items || []).length > 0 || (m.pax > 0 && m.price_per_head > 0)
        );
        if (!hasMeals) {
            Alert.alert('Required', 'Please configure at least one meal service');
            return false;
        }
        return true;
    }, [formData.meal_services]);

    // ============================================================
    // NAVIGATION FUNCTIONS
    // ============================================================
    const handleNextStep = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        dismissKeyboard();
        
        if (currentStep === 1 && validateStep1()) {
            setCurrentStep(2);
            setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                setShowScrollIndicator(false);
            }, 100);
        } else if (currentStep === 2 && validateStep2()) {
            setCurrentStep(3);
            setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                setShowScrollIndicator(false);
            }, 100);
        } else if (currentStep === 3) {
            handleSubmit();
        }
    }, [currentStep, validateStep1, validateStep2, dismissKeyboard]);

    const handlePreviousStep = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        dismissKeyboard();
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
            setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                setShowScrollIndicator(false);
            }, 100);
        }
    }, [currentStep, dismissKeyboard]);

    // ============================================================
    // SUBMIT FUNCTION
    // ============================================================
    const handleSubmit = useCallback(async () => {
        if (isGuest || !isAuthenticated) {
            Alert.alert(
                'Login Required',
                'Please login to submit a booking',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Login', onPress: () => navigation.navigate('Login') }
                ]
            );
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSubmitting(true);

        try {
            const guestCount = parseInt(formData.guests_count) || 0;
            const totalAmount = calculateTotal();
            
            const selectedMeals = (formData.meal_services || []).filter(m => {
                const hasMenuItems = Array.isArray(m.menu_items) && m.menu_items.length > 0;
                const hasManualMealCharge = Number(m.price_per_head || 0) > 0;
                return hasMenuItems || hasManualMealCharge;
            });

            if (selectedMeals.length === 0) {
                Alert.alert('Required', 'Please select at least one menu item.');
                setSubmitting(false);
                return;
            }

            const mealServices = selectedMeals.map(m => {
                const normalizedPax = Math.max(1, parseInt(m.pax, 10) || guestCount || 1);
                const normalizedItems = Array.isArray(m.menu_items) ? m.menu_items : [];
                const customItems = normalizedItems.map(item => ({
                    menu_item_id: item.menu_item_id || null,
                    item_name: item.name,
                    name: item.name,
                    quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
                    unit_price: parseFloat(item.price) || 0,
                    price: parseFloat(item.price) || 0,
                    notes: item.source_type ? `Selected from ${item.source_type}` : '',
                }));

                return {
                    day_number: Math.max(1, parseInt(m.day_number, 10) || 1),
                    meal_type: m.meal_type || 'lunch',
                    serving_time: m.serving_time || '12:00 PM',
                    pax: normalizedPax,
                    price_per_head: parseFloat(m.price_per_head) || 0,
                    menu_source: 'custom',
                    menu_mode: 'custom',
                    package_id: null,
                    menu_item_id: null,
                    menu_name: normalizedItems.map(item => item.name).filter(Boolean).join(', '),
                    custom_items: customItems,
                    menu_items: normalizedItems.map(item => ({
                        id: item.id,
                        menu_item_id: item.menu_item_id || null,
                        package_id: item.package_id || null,
                        promotion_id: item.promotion_id || null,
                        source_type: item.source_type || 'menu',
                        name: item.name,
                        price: parseFloat(item.price) || 0,
                        quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
                    })),
                    total_meal_amount: getMealTotal({ ...m, pax: normalizedPax, menu_items: normalizedItems }),
                    notes: m.notes || '',
                };
            });

            const bookingData = {
                customer_name: formData.customer_name.trim(),
                customer_email: formData.customer_email.trim(),
                customer_phone: formData.customer_phone.trim(),
                event_type_id: formData.event_type_id,
                event_date: formData.event_date.toISOString().split('T')[0],
                event_end_date: formData.event_end_date ? formData.event_end_date.toISOString().split('T')[0] : null,
                event_time: formData.event_time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
                venue: formData.venue.trim(),
                guests_count: guestCount,
                service_type: formData.service_type,
                booking_scope: formData.event_scope,
                total_days: formData.total_days,
                has_waiters: formData.has_waiters,
                meal_services: mealServices,
                transportation_fee: parseFloat(formData.transportation_fee) || 0,
                setup_fee: parseFloat(formData.setup_fee) || 0,
                service_crew_fee: parseFloat(formData.service_crew_fee) || 0,
                equipment_rental: parseFloat(formData.equipment_rental) || 0,
                extra_food_fee: parseFloat(formData.extra_food_fee) || 0,
                discount: parseFloat(formData.discount) || 0,
                delivery_method: formData.delivery_method,
                delivery_address: formData.delivery_method === 'delivery' ? formData.delivery_address : null,
                delivery_contact_person: formData.delivery_method === 'delivery' ? formData.delivery_contact_person : null,
                delivery_contact_phone: formData.delivery_method === 'delivery' ? formData.delivery_contact_phone : null,
                delivery_fee: formData.delivery_method === 'delivery' ? parseFloat(formData.delivery_fee) || 0 : 0,
                special_requests: formData.special_requests || null,
                menu_selection_type: isPackageBooking ? 'package' : 'custom',
                package_id: isPackageBooking ? (selectedPackage?.package_id || selectedPackage?.id) : null,
                promotion_id: isPromoBooking ? (selectedPromotion?.promotion_id || selectedPromotion?.id) : null,
                total_amount: totalAmount,
                required_deposit: totalAmount * 0.3,
                down_payment: parseFloat(formData.down_payment) || 0,
                payment_method: formData.payment_method,
                payment_reference: formData.payment_reference || null,
                transaction_id: formData.transaction_id || null,
            };

            const response = await bookingAPI.createBooking(bookingData);
            
            if (response.data?.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert(
                    'Booking Submitted!',
                    `Your booking has been submitted for approval.\n\n📅 ${formData.event_date.toLocaleDateString()}\n👥 ${guestCount} guests\n💰 ₱${totalAmount.toLocaleString()}`,
                    [
                        { 
                            text: 'View Orders', 
                            onPress: () => {
                                clearCart();
                                navigation.navigate('OrdersTab');
                            } 
                        },
                        { 
                            text: 'Home', 
                            onPress: () => {
                                clearCart();
                                navigation.navigate('HomeTab');
                            } 
                        }
                    ]
                );
            } else {
                Alert.alert('Error', response.data?.message || 'Failed to submit booking');
            }
        } catch (error) {
            console.log('Booking error:', error);
            Alert.alert(
                'Error', 
                error.response?.data?.message || error.message || 'Failed to submit booking'
            );
        } finally {
            setSubmitting(false);
        }
    }, [formData, isGuest, isAuthenticated, navigation, clearCart, calculateTotal, getMealTotal, isPackageBooking, selectedPackage, isPromoBooking, selectedPromotion]);

    // ============================================================
    // HELPER FUNCTIONS
    // ============================================================
    const formatDateDisplay = useCallback((date) => {
        if (!date) return 'Select Date';
        return date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
    }, []);

    const formatDateRangeDisplay = useCallback((startDate, endDate) => {
        if (!startDate) return 'Select Date Range';
        if (!endDate) return formatDateDisplay(startDate);
        return `${formatDateDisplay(startDate)} - ${formatDateDisplay(endDate)}`;
    }, []);

    const formatTimeDisplay = useCallback((date) => {
        if (!date) return 'Select Time';
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: true 
        });
    }, []);

    const getMealTypeColor = useCallback((type) => {
        return MEAL_TYPES.find(m => m.id === type)?.color || '#FF6B9D';
    }, []);

    const getFilteredMenuItems = useCallback(() => {
        const allItems = [...menuItems, ...packages, ...promotions];
        let items = allItems;
        
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            items = items.filter(item => 
                (item.name || '').toLowerCase().includes(query) ||
                getCategoryName(item.category).toLowerCase().includes(query)
            );
        }
        
        if (selectedCategory !== 'All') {
            items = items.filter(item => 
                getCategoryName(item.category) === selectedCategory
            );
        }
        
        return items;
    }, [menuItems, packages, promotions, searchQuery, selectedCategory]);

    // ============================================================
    // EVENT TYPE SCROLL HANDLING
    // ============================================================
    const handleEventTypeScroll = (event) => {
        const x = event.nativeEvent.contentOffset.x;
        const contentWidth = event.nativeEvent.contentSize.width;
        const containerWidth = event.nativeEvent.layoutMeasurement.width;
        
        setEventTypeScrollX(x);
        setEventTypeContentWidth(contentWidth);
        setEventTypeContainerWidth(containerWidth);
        
        const left = x > 5;
        const right = x + containerWidth < contentWidth - 5;
        
        setCanScrollLeft(left);
        setCanScrollRight(right);
        setShowEventTypeScrollHint(left || right);
    };

    const handleEventTypeLayout = (event) => {
        setEventTypeContainerWidth(event.nativeEvent.layout.width);
    };

    const scrollEventTypeLeft = () => {
        if (eventTypeScrollRef.current && canScrollLeft) {
            const scrollAmount = Math.max(60, eventTypeContainerWidth * 0.6);
            eventTypeScrollRef.current.scrollTo({
                x: Math.max(0, eventTypeScrollX - scrollAmount),
                animated: true,
            });
        }
    };

    const scrollEventTypeRight = () => {
        if (eventTypeScrollRef.current && canScrollRight) {
            const scrollAmount = Math.max(60, eventTypeContainerWidth * 0.6);
            eventTypeScrollRef.current.scrollTo({
                x: Math.min(eventTypeContentWidth - eventTypeContainerWidth, eventTypeScrollX + scrollAmount),
                animated: true,
            });
        }
    };

    // ============================================================
    // SCROLL HANDLING
    // ============================================================
    const handleScroll = useCallback((event) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        const contentHeight = event.nativeEvent.contentSize.height;
        const scrollViewHeight = event.nativeEvent.layoutMeasurement.height;
        
        contentHeightRef.current = contentHeight;
        scrollViewHeightRef.current = scrollViewHeight;
        
        const hasMoreContent = contentHeight > scrollViewHeight + 30;
        const isAtBottom = offsetY + scrollViewHeight >= contentHeight - 20;
        
        const shouldShowIndicator = hasMoreContent && !isAtBottom;
        
        setShowScrollIndicator(shouldShowIndicator);
        scrollPosition.current = offsetY;
        
        if (scrollTimerRef.current) {
            clearTimeout(scrollTimerRef.current);
        }
        
        scrollTimerRef.current = setTimeout(() => {
            const currentOffset = scrollPosition.current;
            const currentContentHeight = contentHeightRef.current;
            const currentViewHeight = scrollViewHeightRef.current;
            
            const stillHasMore = currentContentHeight > currentViewHeight + 30;
            const stillNotAtBottom = currentOffset + currentViewHeight < currentContentHeight - 20;
            
            setShowScrollIndicator(stillHasMore && stillNotAtBottom);
        }, 300);
    }, []);

    const handleContentSizeChange = useCallback((contentWidth, contentHeight) => {
        contentHeightRef.current = contentHeight;
        const needsScroll = contentHeight > scrollViewHeightRef.current + 30;
        setShowScrollIndicator(needsScroll);
        contentMeasured.current = true;
    }, []);

    const handleLayout = useCallback((event) => {
        const { height } = event.nativeEvent.layout;
        scrollViewHeightRef.current = height;
        if (contentHeightRef.current > 0) {
            const needsScroll = contentHeightRef.current > height + 30;
            setShowScrollIndicator(needsScroll);
        }
    }, []);

    // ============================================================
    // EVENT SCOPE RENDER
    // ============================================================
    const renderEventScope = useCallback(() => {
        const isRegular = formData.event_scope === 'regular';
        
        return (
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Event Scope <Text style={styles.required}>*</Text></Text>
                <View style={styles.scopeContainer}>
                    <TouchableOpacity
                        style={[
                            styles.scopeOption,
                            isRegular && styles.scopeOptionActive
                        ]}
                        onPress={() => {
                            dismissKeyboard();
                            updateFormField('event_scope', 'regular');
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons 
                            name="calendar-today" 
                            size={18} 
                            color={isRegular ? '#FF6B9D' : '#B0B0B0'} 
                        />
                        <Text style={[
                            styles.scopeOptionText,
                            isRegular && styles.scopeOptionTextActive
                        ]}>
                            Regular Event
                        </Text>
                        <Text style={styles.scopeSubtext}>1 day event</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                        style={[
                            styles.scopeOption,
                            !isRegular && styles.scopeOptionActive
                        ]}
                        onPress={() => {
                            dismissKeyboard();
                            updateFormField('event_scope', 'multi');
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons 
                            name="calendar-multiple" 
                            size={18} 
                            color={!isRegular ? '#FF6B9D' : '#B0B0B0'} 
                        />
                        <Text style={[
                            styles.scopeOptionText,
                            !isRegular && styles.scopeOptionTextActive
                        ]}>
                            Multi-Event
                        </Text>
                        <Text style={styles.scopeSubtext}>More than 1 day</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }, [formData.event_scope, updateFormField, dismissKeyboard]);

    // ============================================================
    // DELIVERY METHOD RENDER
    // ============================================================
    const renderDeliveryMethod = useCallback(() => {
        const isDelivery = formData.delivery_method === 'delivery';
        
        return (
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: '#FF9800' }]}>
                        <MaterialCommunityIcons name="truck-delivery" size={18} color="#FFF" />
                    </View>
                    <Text style={styles.sectionTitle}>Delivery Method</Text>
                </View>
                
                <View style={styles.deliveryContainer}>
                    <TouchableOpacity
                        style={[
                            styles.deliveryOption,
                            !isDelivery && styles.deliveryOptionActive
                        ]}
                        onPress={() => {
                            dismissKeyboard();
                            updateFormField('delivery_method', 'pickup');
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        activeOpacity={0.7}
                    >
                        <Feather 
                            name="shopping-bag" 
                            size={18} 
                            color={!isDelivery ? '#FF6B9D' : '#B0B0B0'} 
                        />
                        <Text style={[
                            styles.deliveryOptionText,
                            !isDelivery && styles.deliveryOptionTextActive
                        ]}>
                            Pickup
                        </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                        style={[
                            styles.deliveryOption,
                            isDelivery && styles.deliveryOptionActive
                        ]}
                        onPress={() => {
                            dismissKeyboard();
                            updateFormField('delivery_method', 'delivery');
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        activeOpacity={0.7}
                    >
                        <Feather 
                            name="truck" 
                            size={18} 
                            color={isDelivery ? '#FF6B9D' : '#B0B0B0'} 
                        />
                        <Text style={[
                            styles.deliveryOptionText,
                            isDelivery && styles.deliveryOptionTextActive
                        ]}>
                            Delivery
                        </Text>
                    </TouchableOpacity>
                </View>
                
                {isDelivery && (
                    <View style={styles.deliveryFields}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Delivery Address <Text style={styles.required}>*</Text></Text>
                            <View style={[styles.inputContainer, focusedInput === 'delivery_address' && styles.inputContainerFocused]}>
                                <Feather name="map-pin" size={16} color="#FF6B9D" style={styles.inputIcon} />
                                <TextInput 
                                    ref={ref => inputRefs.current.delivery_address = ref}
                                    style={styles.input} 
                                    value={formData.delivery_address} 
                                    onChangeText={(text) => updateFormField('delivery_address', text)}
                                    onFocus={() => handleFocus('delivery_address')}
                                    onBlur={handleBlur}
                                    placeholder="Enter delivery address" 
                                    placeholderTextColor="#c0c0c0" 
                                    returnKeyType="next"
                                    blurOnSubmit={false}
                                    onSubmitEditing={() => handleNextInput('delivery_address', 'delivery_contact_person')}
                                />
                            </View>
                        </View>
                        
                        <View style={styles.row}>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                <Text style={styles.label}>Contact Person</Text>
                                <View style={[styles.inputContainer, focusedInput === 'delivery_contact_person' && styles.inputContainerFocused]}>
                                    <Feather name="user" size={16} color="#FF6B9D" style={styles.inputIcon} />
                                    <TextInput 
                                        ref={ref => inputRefs.current.delivery_contact_person = ref}
                                        style={styles.input} 
                                        value={formData.delivery_contact_person} 
                                        onChangeText={(text) => updateFormField('delivery_contact_person', text)}
                                        onFocus={() => handleFocus('delivery_contact_person')}
                                        onBlur={handleBlur}
                                        placeholder="Contact person" 
                                        placeholderTextColor="#c0c0c0" 
                                        returnKeyType="next"
                                        blurOnSubmit={false}
                                        onSubmitEditing={() => handleNextInput('delivery_contact_person', 'delivery_contact_phone')}
                                    />
                                </View>
                            </View>
                            <View style={[styles.inputGroup, { flex: 1 }]}>
                                <Text style={styles.label}>Contact Phone</Text>
                                <View style={[styles.inputContainer, focusedInput === 'delivery_contact_phone' && styles.inputContainerFocused]}>
                                    <Feather name="phone" size={16} color="#FF6B9D" style={styles.inputIcon} />
                                    <TextInput 
                                        ref={ref => inputRefs.current.delivery_contact_phone = ref}
                                        style={styles.input} 
                                        value={formData.delivery_contact_phone} 
                                        onChangeText={(text) => updateFormField('delivery_contact_phone', text)}
                                        onFocus={() => handleFocus('delivery_contact_phone')}
                                        onBlur={handleBlur}
                                        placeholder="Phone" 
                                        placeholderTextColor="#c0c0c0" 
                                        keyboardType="phone-pad"
                                        returnKeyType="done"
                                        onSubmitEditing={dismissKeyboard}
                                    />
                                </View>
                            </View>
                        </View>
                        
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Delivery Fee</Text>
                            <View style={[styles.inputContainer, focusedInput === 'delivery_fee' && styles.inputContainerFocused]}>
                                <Text style={styles.currencySymbol}>₱</Text>
                                <TextInput 
                                    ref={ref => inputRefs.current.delivery_fee = ref}
                                    style={styles.input} 
                                    value={String(formData.delivery_fee || '')} 
                                    onChangeText={(text) => updateFormField('delivery_fee', parseFloat(text) || 0)}
                                    onFocus={() => handleFocus('delivery_fee')}
                                    onBlur={handleBlur}
                                    placeholder="0.00" 
                                    placeholderTextColor="#c0c0c0" 
                                    keyboardType="numeric"
                                    returnKeyType="done"
                                    onSubmitEditing={dismissKeyboard}
                                />
                            </View>
                        </View>
                    </View>
                )}
            </View>
        );
    }, [formData.delivery_method, formData.delivery_address, formData.delivery_contact_person, 
        formData.delivery_contact_phone, formData.delivery_fee, focusedInput, updateFormField, 
        handleFocus, handleBlur, handleNextInput, dismissKeyboard]);

    // ============================================================
    // RENDER STEP 1
    // ============================================================
    const renderStep1 = useCallback(() => {
        const isMultiDay = formData.event_scope === 'multi';
        
        return (
            <Animated.View style={{ opacity: fadeAnim }}>
                {/* Customer Information - FIRST */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionIcon}>
                            <MaterialCommunityIcons name="account" size={18} color="#FFF" />
                        </View>
                        <Text style={styles.sectionTitle}>Customer Information</Text>
                    </View>
                    
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Full Name <Text style={styles.required}>*</Text></Text>
                        <View style={[styles.inputContainer, focusedInput === 'customer_name' && styles.inputContainerFocused]}>
                            <Feather name="user" size={16} color="#FF6B9D" style={styles.inputIcon} />
                            <TextInput 
                                ref={ref => inputRefs.current.customer_name = ref}
                                style={styles.input} 
                                value={formData.customer_name} 
                                onChangeText={(text) => updateFormField('customer_name', text)}
                                onFocus={() => handleFocus('customer_name')}
                                onBlur={handleBlur}
                                placeholder="Enter your full name" 
                                placeholderTextColor="#c0c0c0" 
                                returnKeyType="next"
                                blurOnSubmit={false}
                                onSubmitEditing={() => handleNextInput('customer_name', 'customer_email')}
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email Address <Text style={styles.required}>*</Text></Text>
                        <View style={[styles.inputContainer, focusedInput === 'customer_email' && styles.inputContainerFocused]}>
                            <Feather name="mail" size={16} color="#FF6B9D" style={styles.inputIcon} />
                            <TextInput 
                                ref={ref => inputRefs.current.customer_email = ref}
                                style={styles.input} 
                                value={formData.customer_email} 
                                onChangeText={(text) => updateFormField('customer_email', text)}
                                onFocus={() => handleFocus('customer_email')}
                                onBlur={handleBlur}
                                placeholder="Enter your email address" 
                                placeholderTextColor="#c0c0c0" 
                                keyboardType="email-address"
                                autoCapitalize="none"
                                returnKeyType="next"
                                blurOnSubmit={false}
                                onSubmitEditing={() => handleNextInput('customer_email', 'customer_phone')}
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Phone Number <Text style={styles.required}>*</Text></Text>
                        <View style={[styles.inputContainer, focusedInput === 'customer_phone' && styles.inputContainerFocused]}>
                            <Feather name="phone" size={16} color="#FF6B9D" style={styles.inputIcon} />
                            <TextInput 
                                ref={ref => inputRefs.current.customer_phone = ref}
                                style={styles.input} 
                                value={formData.customer_phone} 
                                onChangeText={(text) => updateFormField('customer_phone', text)}
                                onFocus={() => handleFocus('customer_phone')}
                                onBlur={handleBlur}
                                placeholder="Enter your phone number" 
                                placeholderTextColor="#c0c0c0" 
                                keyboardType="phone-pad"
                                returnKeyType="next"
                                blurOnSubmit={false}
                                onSubmitEditing={() => handleNextInput('customer_phone', 'event_scope')}
                            />
                        </View>
                    </View>
                </View>

                {/* Event Scope - SECOND */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={[styles.sectionIcon, { backgroundColor: '#FF9800' }]}>
                            <MaterialCommunityIcons name="calendar-range" size={18} color="#FFF" />
                        </View>
                        <Text style={styles.sectionTitle}>Event Scope</Text>
                    </View>
                    {renderEventScope()}
                </View>

                {/* Event Details */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={[styles.sectionIcon, { backgroundColor: '#FF6B9D' }]}>
                            <MaterialCommunityIcons name="calendar" size={18} color="#FFF" />
                        </View>
                        <Text style={styles.sectionTitle}>Event Details</Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Event Type <Text style={styles.required}>*</Text></Text>
                        <View style={styles.eventTypesWrapper}>
                            <ScrollView 
                                ref={eventTypeScrollRef}
                                horizontal 
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.eventTypesScrollContent}
                                nestedScrollEnabled={true}
                                keyboardShouldPersistTaps="handled"
                                onScroll={handleEventTypeScroll}
                                scrollEventThrottle={16}
                                onLayout={handleEventTypeLayout}
                                onContentSizeChange={(w, h) => {
                                    setEventTypeContentWidth(w);
                                    setTimeout(() => {
                                        if (eventTypeScrollRef.current && eventTypeContainerWidth > 0) {
                                            const canScroll = w > eventTypeContainerWidth;
                                            setCanScrollRight(canScroll);
                                            setShowEventTypeScrollHint(canScroll);
                                        }
                                    }, 100);
                                }}
                            >
                                {eventTypes.map((type) => (
                                    <TouchableOpacity
                                        key={type.event_type_id || type.id}
                                        style={[
                                            styles.eventTypeCard,
                                            formData.event_type_id === (type.event_type_id || type.id) && styles.eventTypeCardActive
                                        ]}
                                        onPress={() => {
                                            dismissKeyboard();
                                            updateFormField('event_type_id', type.event_type_id || type.id);
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[
                                            styles.eventTypeLabel,
                                            formData.event_type_id === (type.event_type_id || type.id) && styles.eventTypeLabelActive
                                        ]}>
                                            {type.name || type.label || 'Event'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                        <EventTypeScrollIndicator 
                            visible={showEventTypeScrollHint}
                            canScrollLeft={canScrollLeft}
                            canScrollRight={canScrollRight}
                            onScrollLeft={scrollEventTypeLeft}
                            onScrollRight={scrollEventTypeRight}
                        />
                    </View>

                    {/* Event Date - Range picker with separate start and end selection */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            {isMultiDay ? 'Event Date Range' : 'Event Date'} <Text style={styles.required}>*</Text>
                        </Text>
                        {isMultiDay ? (
                            <View>
                                <TouchableOpacity 
                                    style={[styles.dateTimeSelector, focusedInput === 'event_date' && styles.inputContainerFocused]} 
                                    onPress={() => {
                                        dismissKeyboard();
                                        setFocusedInput('event_date');
                                        setShowDatePicker(true);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <MaterialCommunityIcons name="calendar-start" size={16} color="#FF6B9D" style={styles.inputIcon} />
                                    <Text style={styles.dateTimeValue}>
                                        {formatDateDisplay(formData.event_date)} 
                                        <Text style={styles.dateRangeLabel}> → </Text>
                                        {formData.event_end_date ? formatDateDisplay(formData.event_end_date) : 'Select End Date'}
                                    </Text>
                                </TouchableOpacity>
                                <View style={styles.dateRangeHint}>
                                    <Text style={styles.dateRangeHintText}>
                                        {formData.event_end_date 
                                            ? `${Math.ceil((formData.event_end_date - formData.event_date) / (1000 * 60 * 60 * 24)) + 1} days total`
                                            : 'Tap to select start and end dates'}
                                    </Text>
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity 
                                style={[styles.dateTimeSelector, focusedInput === 'event_date' && styles.inputContainerFocused]} 
                                onPress={() => {
                                    dismissKeyboard();
                                    setFocusedInput('event_date');
                                    setShowDatePicker(true);
                                }}
                                activeOpacity={0.7}
                            >
                                <Feather name="calendar" size={16} color="#FF6B9D" style={styles.inputIcon} />
                                <Text style={styles.dateTimeValue}>{formatDateDisplay(formData.event_date)}</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Event Time */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Event Time <Text style={styles.required}>*</Text></Text>
                        <TouchableOpacity 
                            style={[styles.dateTimeSelector, focusedInput === 'event_time' && styles.inputContainerFocused]} 
                            onPress={() => {
                                dismissKeyboard();
                                setFocusedInput('event_time');
                                setShowTimePicker(true);
                            }}
                            activeOpacity={0.7}
                        >
                            <Feather name="clock" size={16} color="#FF6B9D" style={styles.inputIcon} />
                            <Text style={styles.dateTimeValue}>{formatTimeDisplay(formData.event_time)}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Event Location <Text style={styles.required}>*</Text></Text>
                        <View style={[styles.inputContainer, focusedInput === 'venue' && styles.inputContainerFocused]}>
                            <Feather name="map-pin" size={16} color="#FF6B9D" style={styles.inputIcon} />
                            <TextInput 
                                ref={ref => inputRefs.current.venue = ref}
                                style={styles.input} 
                                value={formData.venue} 
                                onChangeText={(text) => updateFormField('venue', text)}
                                onFocus={() => handleFocus('venue')}
                                onBlur={handleBlur}
                                placeholder="Enter complete event address" 
                                placeholderTextColor="#c0c0c0" 
                                returnKeyType="next"
                                blurOnSubmit={false}
                                onSubmitEditing={() => handleNextInput('venue', 'guests')}
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Number of Guests <Text style={styles.required}>*</Text></Text>
                        {isPackageBooking && selectedPackage && (
                            <View style={styles.packageHintContainer}>
                                <Feather name="info" size={12} color="#FF6B9D" />
                                <Text style={styles.packageHint}>
                                    {selectedPackage.min_pax || 0} - {selectedPackage.max_pax || 100} guests
                                </Text>
                            </View>
                        )}
                        <View style={styles.guestSelector}>
                            <TouchableOpacity 
                                style={styles.stepperButton} 
                                onPress={() => {
                                    dismissKeyboard();
                                    const current = parseInt(formData.guests_count) || 10;
                                    const min = isPackageBooking ? (selectedPackage?.min_pax || 10) : 10;
                                    updateFormField('guests_count', Math.max(min, current - 10).toString());
                                }}
                                activeOpacity={0.7}
                            >
                                <Feather name="minus" size={16} color="#FF6B9D" />
                            </TouchableOpacity>
                            <View style={[styles.guestInputContainer, focusedInput === 'guests' && styles.inputContainerFocused]}>
                                <TextInput 
                                    ref={ref => inputRefs.current.guests = ref}
                                    style={styles.guestInput} 
                                    keyboardType="numeric" 
                                    value={String(formData.guests_count)} 
                                    onChangeText={(text) => updateFormField('guests_count', text)}
                                    onFocus={() => handleFocus('guests')}
                                    onBlur={handleBlur}
                                    placeholder="0" 
                                    placeholderTextColor="#c0c0c0" 
                                    textAlign="center" 
                                    returnKeyType="done"
                                    onSubmitEditing={dismissKeyboard}
                                />
                            </View>
                            <TouchableOpacity 
                                style={styles.stepperButton} 
                                onPress={() => {
                                    dismissKeyboard();
                                    const current = parseInt(formData.guests_count) || 0;
                                    const max = isPackageBooking ? (selectedPackage?.max_pax || 999) : 999;
                                    updateFormField('guests_count', Math.min(max, current + 10).toString());
                                }}
                                activeOpacity={0.7}
                            >
                                <Feather name="plus" size={16} color="#FF6B9D" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.hint}>
                            {isPackageBooking 
                                ? `Minimum ${selectedPackage?.min_pax || 10} guests required`
                                : 'Minimum 10 guests required'}
                        </Text>
                    </View>
                </View>

                {/* Service Type */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={[styles.sectionIcon, { backgroundColor: '#4CAF50' }]}>
                            <MaterialCommunityIcons name="food" size={18} color="#FFF" />
                        </View>
                        <Text style={styles.sectionTitle}>Service Type</Text>
                    </View>

                    <View style={styles.serviceTypeGrid}>
                        {SERVICE_TYPES.map((type) => (
                            <TouchableOpacity
                                key={type.id}
                                style={[
                                    styles.serviceTypeCard,
                                    formData.service_type === type.id && styles.serviceTypeCardActive
                                ]}
                                onPress={() => {
                                    dismissKeyboard();
                                    updateFormField('service_type', type.id);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.serviceTypeIcon, { backgroundColor: type.color + '15' }]}>
                                    <MaterialCommunityIcons name={type.icon} size={22} color={type.color} />
                                </View>
                                <Text style={[
                                    styles.serviceTypeLabel,
                                    formData.service_type === type.id && styles.serviceTypeLabelActive
                                ]}>
                                    {type.label}
                                </Text>
                                {formData.service_type === type.id && (
                                    <View style={styles.serviceTypeCheck}>
                                        <Feather name="check" size={12} color="#FFF" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Date Pickers */}
                {showDatePicker && (
                    <DateTimePicker 
                        value={formData.event_date} 
                        mode="date" 
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'} 
                        onChange={(event, selectedDate) => {
                            if (selectedDate) {
                                if (isMultiDay) {
                                    if (!formData.event_end_date) {
                                        const endDate = new Date(selectedDate);
                                        endDate.setDate(endDate.getDate() + 1);
                                        updateFormField('event_end_date', endDate);
                                    }
                                    updateFormField('event_date', selectedDate);
                                    setShowDatePicker(false);
                                    setFocusedInput(null);
                                    setTimeout(() => {
                                        setShowEndDatePicker(true);
                                    }, 300);
                                } else {
                                    updateFormField('event_date', selectedDate);
                                    setShowDatePicker(false);
                                    setFocusedInput(null);
                                }
                            } else {
                                setShowDatePicker(false);
                                setFocusedInput(null);
                            }
                        }} 
                        minimumDate={new Date()} 
                    />
                )}
                {showEndDatePicker && (
                    <DateTimePicker 
                        value={formData.event_end_date || formData.event_date} 
                        mode="date" 
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'} 
                        onChange={(event, selectedDate) => {
                            setShowEndDatePicker(false);
                            setFocusedInput(null);
                            if (selectedDate && selectedDate >= formData.event_date) {
                                updateFormField('event_end_date', selectedDate);
                            } else if (selectedDate) {
                                Alert.alert('Invalid Date', 'End date must be after start date');
                            }
                        }} 
                        minimumDate={formData.event_date} 
                    />
                )}
                {showTimePicker && (
                    <DateTimePicker 
                        value={formData.event_time} 
                        mode="time" 
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'} 
                        onChange={(event, selectedTime) => { 
                            setShowTimePicker(false);
                            setFocusedInput(null);
                            if (selectedTime) updateFormField('event_time', selectedTime);
                        }} 
                    />
                )}
            </Animated.View>
        );
    }, [formData, focusedInput, eventTypes, showDatePicker, showEndDatePicker, showTimePicker, 
        isPackageBooking, selectedPackage, showEventTypeScrollHint, canScrollLeft, canScrollRight,
        renderEventScope, updateFormField, handleFocus, handleBlur, handleNextInput, 
        dismissKeyboard, formatDateDisplay, formatDateRangeDisplay, formatTimeDisplay]);

    // ============================================================
    // RENDER STEP 2
    // ============================================================
    const renderStep2 = useCallback(() => (
        <Animated.View style={{ opacity: fadeAnim }}>
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: '#9C27B0' }]}>
                        <MaterialCommunityIcons name="food-variant" size={18} color="#FFF" />
                    </View>
                    <Text style={styles.sectionTitle}>Meal Services</Text>
                    <TouchableOpacity 
                        style={styles.addMealButton} 
                        onPress={() => {
                            dismissKeyboard();
                            addMealService();
                        }}
                        activeOpacity={0.7}
                    >
                        <Feather name="plus" size={14} color="#FFF" />
                        <Text style={styles.addMealButtonText}>Add</Text>
                    </TouchableOpacity>
                </View>

                {(formData.meal_services || []).length === 0 ? (
                    <TouchableOpacity 
                        style={styles.emptyMealsContainer}
                        onPress={() => addMealService()}
                        activeOpacity={0.7}
                    >
                        <Feather name="plus-circle" size={32} color="#FF6B9D" />
                        <Text style={styles.emptyMealsText}>Add your first meal service</Text>
                    </TouchableOpacity>
                ) : (
                    <>
                        {(formData.meal_services || []).map((meal, index) => {
                            const isMultiDay = formData.event_scope === 'multi';
                            const totalDays = formData.total_days || 1;
                            const mealsForDay = formData.meal_services.filter(m => m.day_number === meal.day_number);
                            const mealTypesForDay = mealsForDay.map(m => m.meal_type);
                            
                            return (
                                <View key={meal.id} style={styles.mealCard}>
                                    <View style={styles.mealCardHeader}>
                                        <View style={styles.mealCardTitle}>
                                            <View style={[styles.mealTypeDot, { backgroundColor: getMealTypeColor(meal.meal_type) }]} />
                                            {isMultiDay ? (
                                                <Text style={styles.mealCardDay}>Day {meal.day_number}</Text>
                                            ) : (
                                                <Text style={styles.mealCardDay}>Meal {index + 1}</Text>
                                            )}
                                            <Text style={styles.mealCardType}>
                                                {MEAL_TYPES.find(m => m.id === meal.meal_type)?.label || meal.meal_type}
                                            </Text>
                                        </View>
                                        {formData.meal_services.length > 1 && (
                                            <TouchableOpacity 
                                                style={styles.mealCardRemove}
                                                onPress={() => removeMealService(meal.id)}
                                                activeOpacity={0.7}
                                            >
                                                <Feather name="x" size={16} color="#F44336" />
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    <View style={styles.mealCardBody}>
                                        {isMultiDay && (
                                            <View style={styles.mealRow}>
                                                <View style={styles.mealField}>
                                                    <Text style={styles.mealLabel}>DAY</Text>
                                                    <ScrollView 
                                                        horizontal 
                                                        showsHorizontalScrollIndicator={false}
                                                        contentContainerStyle={styles.daySelectorScroll}
                                                        nestedScrollEnabled={true}
                                                        keyboardShouldPersistTaps="handled"
                                                    >
                                                        {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => (
                                                            <TouchableOpacity
                                                                key={day}
                                                                style={[
                                                                    styles.dayOption,
                                                                    meal.day_number === day && styles.dayOptionActive
                                                                ]}
                                                                onPress={() => {
                                                                    dismissKeyboard();
                                                                    const mealType = meal.meal_type;
                                                                    const duplicateExists = formData.meal_services.some((m, idx) => 
                                                                        idx !== formData.meal_services.indexOf(meal) &&
                                                                        m.day_number === day &&
                                                                        m.meal_type === mealType
                                                                    );
                                                                    if (duplicateExists) {
                                                                        Alert.alert('Duplicate Meal', `${mealType} is already added for Day ${day}.`);
                                                                        return;
                                                                    }
                                                                    updateMealService(meal.id, { day_number: day });
                                                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                                }}
                                                                activeOpacity={0.7}
                                                            >
                                                                <Text style={[
                                                                    styles.dayOptionText,
                                                                    meal.day_number === day && styles.dayOptionTextActive
                                                                ]}>
                                                                    Day {day}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </ScrollView>
                                                </View>
                                            </View>
                                        )}

                                        <View style={styles.mealRow}>
                                            <View style={styles.mealField}>
                                                <Text style={styles.mealLabel}>MEAL TYPE</Text>
                                                <ScrollView 
                                                    horizontal 
                                                    showsHorizontalScrollIndicator={false}
                                                    contentContainerStyle={styles.mealTypeSelectorScroll}
                                                    nestedScrollEnabled={true}
                                                    keyboardShouldPersistTaps="handled"
                                                >
                                                    {MEAL_TYPES.map((type) => {
                                                        const isSelected = meal.meal_type === type.id;
                                                        const isDisabled = !isSelected && mealTypesForDay.includes(type.id);
                                                        
                                                        return (
                                                            <TouchableOpacity
                                                                key={type.id}
                                                                style={[
                                                                    styles.mealTypeOption,
                                                                    isSelected && styles.mealTypeOptionActive,
                                                                    isDisabled && styles.mealTypeOptionDisabled,
                                                                    { borderColor: isSelected ? type.color : isDisabled ? '#E8E0E3' : '#E8E0E3' }
                                                                ]}
                                                                onPress={() => {
                                                                    if (isDisabled) {
                                                                        Alert.alert('Duplicate Meal', `${type.label} is already added for Day ${meal.day_number}.`);
                                                                        return;
                                                                    }
                                                                    dismissKeyboard();
                                                                    updateMealService(meal.id, { meal_type: type.id });
                                                                }}
                                                                activeOpacity={0.7}
                                                                disabled={isDisabled}
                                                            >
                                                                <MaterialCommunityIcons 
                                                                    name={type.icon} 
                                                                    size={12} 
                                                                    color={isSelected ? type.color : isDisabled ? '#B0B0B0' : '#B0B0B0'} 
                                                                />
                                                                <Text style={[
                                                                    styles.mealTypeOptionText,
                                                                    isSelected && { color: type.color },
                                                                    isDisabled && styles.mealTypeOptionTextDisabled
                                                                ]}>
                                                                    {type.label}
                                                                </Text>
                                                                {isDisabled && (
                                                                    <Feather name="check" size={10} color="#B0B0B0" />
                                                                )}
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </ScrollView>
                                            </View>
                                        </View>

                                        <View style={styles.mealRow}>
                                            <View style={[styles.mealField, { flex: 1, marginRight: 8 }]}>
                                                <Text style={styles.mealLabel}>SERVING TIME</Text>
                                                <TextInput
                                                    ref={ref => inputRefs.current[`serving_time_${meal.id}`] = ref}
                                                    style={styles.mealInput}
                                                    value={meal.serving_time || '12:00 PM'}
                                                    onChangeText={(text) => updateMealService(meal.id, { serving_time: text })}
                                                    onFocus={() => handleFocus(`serving_time_${meal.id}`)}
                                                    onBlur={handleBlur}
                                                    placeholder="12:00 PM"
                                                    placeholderTextColor="#c0c0c0"
                                                />
                                            </View>
                                            <View style={[styles.mealField, { flex: 1 }]}>
                                                <Text style={styles.mealLabel}>PAX</Text>
                                                <TextInput
                                                    ref={ref => inputRefs.current[`pax_${meal.id}`] = ref}
                                                    style={styles.mealInput}
                                                    keyboardType="numeric"
                                                    value={String(meal.pax || '')}
                                                    onChangeText={(text) => updateMealService(meal.id, { pax: parseInt(text) || 0 })}
                                                    onFocus={() => handleFocus(`pax_${meal.id}`)}
                                                    onBlur={handleBlur}
                                                    placeholder="0"
                                                    placeholderTextColor="#c0c0c0"
                                                />
                                            </View>
                                        </View>

                                        <View style={styles.mealRow}>
                                            <View style={[styles.mealField, { flex: 1, marginRight: 8 }]}>
                                                <Text style={styles.mealLabel}>PRICE PER HEAD</Text>
                                                <TextInput
                                                    ref={ref => inputRefs.current[`price_${meal.id}`] = ref}
                                                    style={styles.mealInput}
                                                    keyboardType="numeric"
                                                    value={String(meal.price_per_head || '')}
                                                    onChangeText={(text) => updateMealService(meal.id, { price_per_head: parseFloat(text) || 0 })}
                                                    onFocus={() => handleFocus(`price_${meal.id}`)}
                                                    onBlur={handleBlur}
                                                    placeholder="0.00"
                                                    placeholderTextColor="#c0c0c0"
                                                />
                                            </View>
                                            <View style={[styles.mealField, { flex: 1 }]}>
                                                <Text style={styles.mealLabel}>TOTAL</Text>
                                                <Text style={styles.mealTotal}>₱{getMealTotal(meal).toLocaleString()}</Text>
                                            </View>
                                        </View>

                                        <View style={styles.menuSelectionSection}>
                                            <View style={styles.menuSelectionHeader}>
                                                <Text style={styles.mealLabel}>MENU ITEMS</Text>
                                                <TouchableOpacity 
                                                    style={styles.selectMenuButton}
                                                    onPress={() => openMenuSelector(meal.id)}
                                                    activeOpacity={0.7}
                                                >
                                                    <Feather name="plus-circle" size={14} color="#FF6B9D" />
                                                    <Text style={styles.selectMenuButtonText}>Select</Text>
                                                </TouchableOpacity>
                                            </View>

                                            {(meal.menu_items || []).length > 0 ? (
                                                <View style={styles.selectedMenuItems}>
                                                    {(meal.menu_items || []).map((item) => (
                                                        <View key={item.id} style={styles.selectedMenuItem}>
                                                            <View style={styles.selectedMenuItemInfo}>
                                                                <Text style={styles.selectedMenuItemName} numberOfLines={1}>{item.name || 'Item'}</Text>
                                                                <Text style={styles.selectedMenuItemPrice}>₱{parseFloat(item.price || 0).toFixed(2)}</Text>
                                                            </View>
                                                            <View style={styles.selectedMenuItemQty}>
                                                                <TouchableOpacity 
                                                                    style={styles.qtyButton}
                                                                    onPress={() => updateMenuItemQuantity(meal.id, item.id, (parseInt(item.quantity, 10) || 1) - 1)}
                                                                    activeOpacity={0.7}
                                                                >
                                                                    <Feather name="minus" size={10} color="#FF6B9D" />
                                                                </TouchableOpacity>
                                                                <Text style={styles.qtyText}>{item.quantity || 1}</Text>
                                                                <TouchableOpacity 
                                                                    style={styles.qtyButton}
                                                                    onPress={() => updateMenuItemQuantity(meal.id, item.id, (parseInt(item.quantity, 10) || 1) + 1)}
                                                                    activeOpacity={0.7}
                                                                >
                                                                    <Feather name="plus" size={10} color="#FF6B9D" />
                                                                </TouchableOpacity>
                                                            </View>
                                                        </View>
                                                    ))}
                                                </View>
                                            ) : (
                                                <TouchableOpacity 
                                                    style={styles.emptyMenuItems}
                                                    onPress={() => openMenuSelector(meal.id)}
                                                    activeOpacity={0.7}
                                                >
                                                    <Feather name="plus" size={18} color="#B0B0B0" />
                                                    <Text style={styles.emptyMenuItemsText}>No items selected</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>

                                        <View style={styles.mealRow}>
                                            <View style={styles.mealField}>
                                                <Text style={styles.mealLabel}>NOTES</Text>
                                                <TextInput
                                                    ref={ref => inputRefs.current[`notes_${meal.id}`] = ref}
                                                    style={[styles.mealInput, styles.mealNotesInput]}
                                                    value={meal.notes || ''}
                                                    onChangeText={(text) => updateMealService(meal.id, { notes: text })}
                                                    onFocus={() => handleFocus(`notes_${meal.id}`)}
                                                    onBlur={handleBlur}
                                                    placeholder="Special requests..." 
                                                    placeholderTextColor="#c0c0c0"
                                                    multiline
                                                    numberOfLines={2}
                                                    textAlignVertical="top"
                                                />
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}

                        <View style={styles.mealServicesTotal}>
                            <Text style={styles.mealServicesTotalLabel}>Meal Services Total</Text>
                            <Text style={styles.mealServicesTotalValue}>₱{getTotalMealServices().toLocaleString()}</Text>
                        </View>
                    </>
                )}
            </View>

            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: '#FF9800' }]}>
                        <MaterialCommunityIcons name="cash-multiple" size={18} color="#FFF" />
                    </View>
                    <Text style={styles.sectionTitle}>Additional Charges</Text>
                </View>

                <View style={styles.chargesGrid}>
                    {[
                        { key: 'transportation_fee', icon: 'truck', label: 'Transportation' },
                        { key: 'setup_fee', icon: 'tools', label: 'Setup Fee' },
                        { key: 'service_crew_fee', icon: 'account-group', label: 'Service Crew' },
                        { key: 'equipment_rental', icon: 'warehouse', label: 'Equipment Rental' },
                        { key: 'extra_food_fee', icon: 'food', label: 'Extra Food' },
                        { key: 'discount', icon: 'sale', label: 'Discount (-)', isDiscount: true },
                    ].map((charge) => (
                        <View key={charge.key} style={styles.chargeItem}>
                            <View style={styles.chargeLabelContainer}>
                                <MaterialCommunityIcons name={charge.icon} size={12} color="#FF6B9D" />
                                <Text style={styles.chargeLabel}>{charge.label}</Text>
                            </View>
                            <TextInput
                                ref={ref => inputRefs.current[charge.key] = ref}
                                style={[styles.chargeInput, charge.isDiscount && styles.chargeInputDiscount]}
                                keyboardType="numeric"
                                value={String(formData[charge.key] || 0)}
                                onChangeText={(text) => updateFormField(charge.key, parseFloat(text) || 0)}
                                onFocus={() => handleFocus(charge.key)}
                                onBlur={handleBlur}
                                placeholder="0"
                                placeholderTextColor="#c0c0c0"
                            />
                        </View>
                    ))}
                </View>
            </View>

            {renderDeliveryMethod()}

            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: '#2196F3' }]}>
                        <MaterialCommunityIcons name="message-text" size={18} color="#FFF" />
                    </View>
                    <Text style={styles.sectionTitle}>Special Requests</Text>
                </View>

                <View style={[styles.textAreaContainer, focusedInput === 'special_requests' && styles.inputContainerFocused]}>
                    <TextInput 
                        ref={ref => inputRefs.current.special_requests = ref}
                        style={styles.textArea} 
                        value={formData.special_requests || ''} 
                        onChangeText={(text) => updateFormField('special_requests', text)}
                        onFocus={() => handleFocus('special_requests')}
                        onBlur={handleBlur}
                        placeholder="Dietary restrictions, allergies, themes..." 
                        placeholderTextColor="#c0c0c0" 
                        multiline 
                        numberOfLines={3} 
                        textAlignVertical="top" 
                    />
                </View>
            </View>

            <ScrollIndicator visible={showScrollIndicator} animated={true} />

            {/* Menu Selector Modal */}
            <Modal
                visible={showMenuSelector}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowMenuSelector(false)}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowMenuSelector(false)} activeOpacity={0.7}>
                            <Feather name="x" size={22} color="#2D2D2D" />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Select Menu Items</Text>
                        <TouchableOpacity onPress={confirmMenuSelection} activeOpacity={0.7}>
                            <Text style={styles.modalDoneButtonText}>Done</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.modalSearch}>
                        <View style={styles.searchContainer}>
                            <Feather name="search" size={16} color="#B0B0B0" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search items..."
                                placeholderTextColor="#c0c0c0"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                    </View>

                    <View style={styles.modalCategories}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {categories.map((category) => (
                                <TouchableOpacity
                                    key={category}
                                    style={[
                                        styles.categoryChip,
                                        selectedCategory === category && styles.categoryChipActive
                                    ]}
                                    onPress={() => setSelectedCategory(category)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[
                                        styles.categoryChipText,
                                        selectedCategory === category && styles.categoryChipTextActive
                                    ]}>
                                        {category}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <View style={styles.modalViewToggle}>
                        <TouchableOpacity 
                            style={[styles.viewToggleButton, viewMode === 'grid' && styles.viewToggleActive]}
                            onPress={() => setViewMode('grid')}
                            activeOpacity={0.7}
                        >
                            <Feather name="grid" size={16} color={viewMode === 'grid' ? '#FFF' : '#FF6B9D'} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.viewToggleButton, viewMode === 'list' && styles.viewToggleActive]}
                            onPress={() => setViewMode('list')}
                            activeOpacity={0.7}
                        >
                            <Feather name="list" size={16} color={viewMode === 'list' ? '#FFF' : '#FF6B9D'} />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        key={`menu-${viewMode}`}
                        data={getFilteredMenuItems()}
                        keyExtractor={(item) => String(item.id)}
                        numColumns={viewMode === 'grid' ? 2 : 1}
                        contentContainerStyle={styles.menuItemsList}
                        initialNumToRender={8}
                        maxToRenderPerBatch={8}
                        windowSize={5}
                        removeClippedSubviews={true}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => {
                            const isSelected = tempSelectedItems.some(i => i.id === item.id);
                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[
                                        viewMode === 'grid' ? styles.menuItemGrid : styles.menuItemList,
                                        isSelected && (viewMode === 'grid' ? styles.menuItemGridSelected : styles.menuItemListSelected)
                                    ]}
                                    onPress={() => toggleMenuItem(item)}
                                    activeOpacity={0.7}
                                >
                                    {viewMode === 'grid' ? (
                                        <>
                                            <View style={styles.menuItemGridImage}>
                                                <MaterialCommunityIcons name="food" size={24} color="#FF6B9D" />
                                            </View>
                                            <Text style={styles.menuItemGridName} numberOfLines={2}>{item.name || 'Unnamed'}</Text>
                                            <Text style={styles.menuItemGridCategory}>{getCategoryName(item.category)}</Text>
                                            <Text style={styles.menuItemGridPrice}>₱{(item.price || 0).toLocaleString()}</Text>
                                            {isSelected && (
                                                <View style={styles.menuItemGridCheck}>
                                                    <Feather name="check" size={10} color="#FFF" />
                                                </View>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <View style={styles.menuItemListContent}>
                                                <View style={styles.menuItemListInfo}>
                                                    <Text style={styles.menuItemListName}>{item.name || 'Unnamed'}</Text>
                                                    <Text style={styles.menuItemListCategory}>{getCategoryName(item.category)}</Text>
                                                </View>
                                                <Text style={styles.menuItemListPrice}>₱{(item.price || 0).toLocaleString()}</Text>
                                                {isSelected && (
                                                    <View style={styles.menuItemListCheck}>
                                                        <Feather name="check" size={12} color="#FFF" />
                                                    </View>
                                                )}
                                            </View>
                                        </>
                                    )}
                                </TouchableOpacity>
                            );
                        }}
                        ListEmptyComponent={
                            <View style={styles.emptyListContainer}>
                                <MaterialCommunityIcons name="food-off" size={40} color="#B0B0B0" />
                                <Text style={styles.emptyListText}>No items found</Text>
                            </View>
                        }
                    />

                    <View style={styles.modalFooter}>
                        <Text style={styles.modalFooterText}>
                            {tempSelectedItems.length} items selected
                        </Text>
                        <TouchableOpacity 
                            style={styles.modalDoneButton}
                            onPress={confirmMenuSelection}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.modalDoneButtonText}>Confirm</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal>
        </Animated.View>
    ), [formData, focusedInput, showMenuSelector, tempSelectedItems, searchQuery, selectedCategory, 
        viewMode, categories, showScrollIndicator, getFilteredMenuItems, getMealTotal, getTotalMealServices, 
        addMealService, removeMealService, updateMealService, updateMenuItemQuantity, openMenuSelector, 
        toggleMenuItem, confirmMenuSelection, renderDeliveryMethod, handleFocus, handleBlur, updateFormField, dismissKeyboard]);

    // ============================================================
    // RENDER STEP 3 - Confirmation
    // ============================================================
    const renderStep3 = useCallback(() => {
        const total = calculateTotal();
        const mealTotal = getTotalMealServices();
        const additionalCharges = calculateAdditionalCharges();
        const discount = calculateDiscount();

        return (
            <Animated.View style={{ opacity: fadeAnim }}>
                <View style={styles.summaryCard}>
                    <View style={styles.summarySection}>
                        <View style={styles.summarySectionHeader}>
                            <MaterialCommunityIcons name="account" size={14} color="#FF6B9D" />
                            <Text style={styles.summarySectionTitle}>Customer</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Name:</Text>
                            <Text style={styles.summaryValue}>{formData.customer_name}</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Email:</Text>
                            <Text style={styles.summaryValue}>{formData.customer_email}</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Phone:</Text>
                            <Text style={styles.summaryValue}>{formData.customer_phone}</Text>
                        </View>
                    </View>

                    <View style={styles.summarySection}>
                        <View style={styles.summarySectionHeader}>
                            <MaterialCommunityIcons name="calendar" size={14} color="#FF6B9D" />
                            <Text style={styles.summarySectionTitle}>Event</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Scope:</Text>
                            <Text style={styles.summaryValue}>
                                {formData.event_scope === 'regular' ? 'Regular Event' : 'Multi-Event'}
                            </Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Type:</Text>
                            <Text style={styles.summaryValue}>
                                {eventTypes.find(t => (t.event_type_id || t.id) === formData.event_type_id)?.name || 'General'}
                            </Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Date:</Text>
                            <Text style={styles.summaryValue}>
                                {formData.event_scope === 'multi' && formData.event_end_date
                                    ? formatDateRangeDisplay(formData.event_date, formData.event_end_date)
                                    : formatDateDisplay(formData.event_date)}
                            </Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Time:</Text>
                            <Text style={styles.summaryValue}>{formatTimeDisplay(formData.event_time)}</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Venue:</Text>
                            <Text style={styles.summaryValue}>{formData.venue}</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Guests:</Text>
                            <Text style={styles.summaryValue}>{formData.guests_count} persons</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Service:</Text>
                            <Text style={styles.summaryValue}>
                                {SERVICE_TYPES.find(t => t.id === formData.service_type)?.label || formData.service_type}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.summarySection}>
                        <View style={styles.summarySectionHeader}>
                            <MaterialCommunityIcons name="food" size={14} color="#FF6B9D" />
                            <Text style={styles.summarySectionTitle}>Meal Services</Text>
                        </View>
                        {(formData.meal_services || []).map((meal) => (
                            <View key={meal.id} style={styles.summaryMealItem}>
                                <View style={styles.summaryMealHeader}>
                                    <Text style={styles.summaryMealTitle}>
                                        {formData.event_scope === 'multi' ? `Day ${meal.day_number} - ` : ''}
                                        {MEAL_TYPES.find(m => m.id === meal.meal_type)?.label || meal.meal_type}
                                    </Text>
                                    <Text style={styles.summaryMealAmount}>₱{getMealTotal(meal).toLocaleString()}</Text>
                                </View>
                                {(meal.menu_items || []).map((item) => (
                                    <View key={item.id} style={styles.summaryMenuItem}>
                                        <Text style={styles.summaryMenuItemName}>• {item.name} x{item.quantity || 1}</Text>
                                        <Text style={styles.summaryMenuItemPrice}>₱{(item.price * (item.quantity || 1)).toLocaleString()}</Text>
                                    </View>
                                ))}
                            </View>
                        ))}
                    </View>

                    <View style={styles.summarySection}>
                        <View style={styles.summarySectionHeader}>
                            <MaterialCommunityIcons name="cash" size={14} color="#FF6B9D" />
                            <Text style={styles.summarySectionTitle}>Charges</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Meal Services:</Text>
                            <Text style={styles.summaryValue}>₱{mealTotal.toLocaleString()}</Text>
                        </View>
                        {additionalCharges > 0 && (
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>Additional:</Text>
                                <Text style={styles.summaryValue}>₱{additionalCharges.toLocaleString()}</Text>
                            </View>
                        )}
                        {discount > 0 && (
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>Discount:</Text>
                                <Text style={[styles.summaryValue, styles.summaryDiscount]}>-₱{discount.toLocaleString()}</Text>
                            </View>
                        )}
                        <View style={styles.summaryDivider} />
                        <View style={[styles.summaryItem, styles.totalRow]}>
                            <Text style={styles.totalLabel}>Total:</Text>
                            <Text style={styles.totalAmount}>₱{total.toLocaleString()}</Text>
                        </View>
                        <View style={[styles.summaryItem, styles.totalRow]}>
                            <Text style={styles.totalLabel}>Deposit (30%):</Text>
                            <Text style={[styles.totalAmount, styles.depositAmount]}>₱{(total * 0.3).toLocaleString()}</Text>
                        </View>
                    </View>

                    {formData.delivery_method === 'delivery' && (
                        <View style={styles.summarySection}>
                            <View style={styles.summarySectionHeader}>
                                <MaterialCommunityIcons name="truck-delivery" size={14} color="#FF6B9D" />
                                <Text style={styles.summarySectionTitle}>Delivery</Text>
                            </View>
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>Address:</Text>
                                <Text style={styles.summaryValue}>{formData.delivery_address || 'N/A'}</Text>
                            </View>
                            {formData.delivery_contact_person && (
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>Contact:</Text>
                                    <Text style={styles.summaryValue}>{formData.delivery_contact_person}</Text>
                                </View>
                            )}
                            {formData.delivery_fee > 0 && (
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>Delivery Fee:</Text>
                                    <Text style={styles.summaryValue}>₱{formData.delivery_fee.toLocaleString()}</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {formData.special_requests && (
                        <View style={styles.summarySection}>
                            <View style={styles.summarySectionHeader}>
                                <MaterialCommunityIcons name="message-text" size={14} color="#FF6B9D" />
                                <Text style={styles.summarySectionTitle}>Requests</Text>
                            </View>
                            <Text style={styles.specialRequestsText}>{formData.special_requests}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.infoCard}>
                    <Feather name="info" size={14} color="#FF6B9D" />
                    <Text style={styles.infoText}>
                        30% downpayment required to confirm. Final pricing may vary.
                    </Text>
                </View>
            </Animated.View>
        );
    }, [formData, eventTypes, getMealTotal, getTotalMealServices, calculateTotal, 
        calculateAdditionalCharges, calculateDiscount, formatDateDisplay, formatDateRangeDisplay, formatTimeDisplay]);

    // ============================================================
    // INITIALIZATION
    // ============================================================
    useEffect(() => {
        isMounted.current = true;
        
        const init = async () => {
            setLoading(true);
            await Promise.all([
                loadEventTypes(),
                loadMenuItems(),
                loadPackages(),
                loadPromotions(),
            ]);
            initializeMealServices();
            setLoading(false);
        };
        
        init();

        if (routePackage || routePackageId) {
            const loadPackage = async () => {
                let packageData = routePackage;
                if (!packageData && routePackageId) {
                    const response = await packageService.getPackage(routePackageId);
                    if (response.success) packageData = response.data;
                }
                if (packageData) {
                    setSelectedPackage(packageData);
                    setIsPackageBooking(true);
                    setFormData(prev => ({
                        ...prev,
                        guests_count: String(packageData.min_pax || 50),
                        event_type_id: packageData.event_type_id || prev.event_type_id,
                        package_id: packageData.package_id || packageData.id,
                        menu_selection_type: 'package',
                    }));
                }
            };
            loadPackage();
        }

        if (routePromotion || routePromotionId) {
            const loadPromotion = async () => {
                let promotionData = routePromotion;
                if (!promotionData && routePromotionId) {
                    const response = await promotionService.getPromotion(routePromotionId);
                    if (response.success) promotionData = response.data;
                }
                if (promotionData) {
                    setSelectedPromotion(promotionData);
                    setIsPromoBooking(true);
                    setFormData(prev => ({
                        ...prev,
                        guests_count: '50',
                        event_type_id: promotionData.event_type_id || prev.event_type_id,
                        promotion_id: promotionData.promotion_id || promotionData.id,
                    }));
                }
            };
            loadPromotion();
        }

        return () => {
            isMounted.current = false;
            if (scrollTimerRef.current) {
                clearTimeout(scrollTimerRef.current);
            }
        };
    }, []);

    // ============================================================
    // MAIN RENDER
    // ============================================================
    if (loading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color="#FF6B9D" />
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    return (
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <View style={styles.container}>
                <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
                <LinearGradient colors={['#FFFFFF', '#FFF8FA', '#FFF5F8']} style={styles.gradient}>
                    <View style={styles.header}>
                        <View style={styles.headerPlaceholder} />
                        <Text style={styles.headerTitle}>
                            Plan Your Event
                        </Text>
                        <View style={styles.headerPlaceholder} />
                    </View>

                    <StepIndicator currentStep={currentStep} steps={[1, 2, 3]} />

                    <KeyboardAvoidingView 
                        style={styles.keyboardView}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
                    >
                        <ScrollView
                            ref={scrollViewRef}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="interactive"
                            contentContainerStyle={styles.scrollContent}
                            nestedScrollEnabled={true}
                            scrollEventThrottle={16}
                            bounces={true}
                            overScrollMode="always"
                            scrollEnabled={scrollEnabled}
                            automaticallyAdjustKeyboardInsets={true}
                            onScroll={handleScroll}
                            onContentSizeChange={handleContentSizeChange}
                            onLayout={handleLayout}
                            extraScrollHeight={Platform.OS === 'ios' ? 120 : 80}
                            enableOnAndroid={true}
                        >
                            <View style={styles.card}>
                                {currentStep === 1 && renderStep1()}
                                {currentStep === 2 && renderStep2()}
                                {currentStep === 3 && renderStep3()}
                            </View>
                            
                            <ScrollIndicator visible={showScrollIndicator} animated={true} />
                            <View style={{ height: 100 }} />
                        </ScrollView>
                    </KeyboardAvoidingView>

                    <View style={[
                        styles.buttonContainer, 
                        keyboardVisible && styles.buttonContainerWithKeyboard,
                        { paddingBottom: keyboardVisible ? keyboardHeight + 8 : 10 }
                    ]}>
                        {currentStep > 1 && (
                            <TouchableOpacity style={styles.backStepButton} onPress={handlePreviousStep} activeOpacity={0.7}>
                                <Feather name="arrow-left" size={16} color="#FF6B9D" />
                                <Text style={styles.backStepText}>Back</Text>
                            </TouchableOpacity>
                        )}
                        
                        <TouchableOpacity 
                            style={[styles.nextButton, currentStep > 1 ? styles.nextButtonWithBack : styles.nextButtonFull]} 
                            onPress={handleNextStep}
                            disabled={loading || submitting}
                            activeOpacity={0.7}
                        >
                            <LinearGradient
                                colors={['#FF6B9D', '#FF8FB1']}
                                style={styles.gradientButton}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                {loading || submitting ? (
                                    <ActivityIndicator color="#FFF" size="small" />
                                ) : (
                                    <>
                                        <Text style={styles.nextButtonText}>
                                            {currentStep === 3 ? 'Submit Booking' : 'Continue'}
                                        </Text>
                                        <Feather name="arrow-right" size={16} color="#FFF" />
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
            </View>
        </TouchableWithoutFeedback>
    );
};

// ============================================================
// STYLES - Continued
// ============================================================
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    centered: { justifyContent: 'center', alignItems: 'center' },
    gradient: { flex: 1 },
    scrollContent: { 
        paddingBottom: 10,
        paddingTop: 4,
        flexGrow: 1,
    },
    keyboardView: { flex: 1 },
    
    header: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        paddingHorizontal: 20,
        paddingBottom: 8,
        backgroundColor: '#FFFFFF',
        zIndex: 20,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#2D2D2D',
        letterSpacing: 0.5,
    },
    headerPlaceholder: { width: 30 },
    loadingText: { marginTop: 16, color: '#8E8E93' },
    
    card: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
        marginHorizontal: 16,
    },
    
    section: {
        backgroundColor: '#F9F6F7',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F0E8EB',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 6,
    },
    sectionIcon: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#FF6B9D',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#2D2D2D',
        flex: 1,
        letterSpacing: 0.3,
    },
    
    inputGroup: { marginBottom: 10 },
    label: { 
        fontSize: 11, 
        fontWeight: '600', 
        color: '#5A5A5E', 
        marginBottom: 3,
        letterSpacing: 0.2,
    },
    required: { color: '#F44336' },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#E8E0E3',
        paddingHorizontal: 10,
        height: 42,
        minHeight: 42,
    },
    inputContainerFocused: {
        borderColor: '#FF6B9D',
        borderWidth: 2,
        backgroundColor: '#FFF',
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    inputIcon: { marginRight: 8 },
    input: {
        flex: 1,
        fontSize: 13,
        color: '#2D2D2D',
        paddingVertical: 8,
        height: '100%',
    },
    row: { flexDirection: 'row', gap: 6 },
    currencySymbol: { fontSize: 13, fontWeight: '600', color: '#2D2D2D', marginRight: 4 },
    
    eventTypesWrapper: {
        flexDirection: 'row',
        position: 'relative',
    },
    eventTypesScrollContent: { 
        paddingRight: 12, 
        gap: 4,
        paddingVertical: 2,
    },
    eventTypeCard: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#E8E0E3',
        marginRight: 4,
    },
    eventTypeCardActive: {
        backgroundColor: '#FFF0F5',
        borderColor: '#FF6B9D',
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    eventTypeLabel: { fontSize: 11, fontWeight: '500', color: '#5A5A5E' },
    eventTypeLabelActive: { color: '#FF6B9D', fontWeight: '600' },
    
    dateTimeSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#E8E0E3',
        paddingHorizontal: 10,
        height: 42,
    },
    dateTimeValue: { fontSize: 12, fontWeight: '500', color: '#2D2D2D', flex: 1 },
    dateRangeLabel: { fontSize: 11, color: '#FF6B9D', fontWeight: '600' },
    dateRangeHint: {
        marginTop: 2,
        paddingHorizontal: 4,
    },
    dateRangeHintText: {
        fontSize: 9,
        color: '#B0B0B0',
        fontStyle: 'italic',
    },
    
    guestSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    stepperButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFF5F8',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#FFE8EE',
    },
    guestInputContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#E8E0E3',
        paddingHorizontal: 4,
        height: 42,
        justifyContent: 'center',
    },
    guestInput: {
        fontSize: 14,
        fontWeight: '600',
        color: '#2D2D2D',
        textAlign: 'center',
        paddingVertical: 8,
    },
    hint: { fontSize: 9, color: '#B0B0B0', marginTop: 2, marginLeft: 4 },
    packageHintContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF5F8',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 5,
        marginBottom: 3,
        gap: 3,
    },
    packageHint: { fontSize: 9, color: '#FF6B9D' },
    
    serviceTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    serviceTypeCard: {
        flex: 1,
        minWidth: 80,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        padding: 10,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#E8E0E3',
        position: 'relative',
    },
    serviceTypeCardActive: {
        borderColor: '#FF6B9D',
        borderWidth: 2,
        backgroundColor: '#FFF5F8',
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    serviceTypeIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
    serviceTypeLabel: { fontSize: 10, fontWeight: '500', color: '#2D2D2D', textAlign: 'center' },
    serviceTypeLabelActive: { color: '#FF6B9D', fontWeight: '600' },
    serviceTypeCheck: {
        position: 'absolute',
        top: 3,
        right: 3,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#FF6B9D',
        justifyContent: 'center',
        alignItems: 'center',
    },
    
    scopeContainer: {
        flexDirection: 'row',
        gap: 6,
    },
    scopeOption: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#E8E0E3',
        paddingVertical: 10,
        paddingHorizontal: 6,
        gap: 2,
    },
    scopeOptionActive: {
        borderColor: '#FF6B9D',
        backgroundColor: '#FFF5F8',
    },
    scopeOptionText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#8A8A8E',
        textAlign: 'center',
    },
    scopeOptionTextActive: {
        color: '#FF6B9D',
    },
    scopeSubtext: {
        fontSize: 8,
        color: '#B0B0B0',
        textAlign: 'center',
    },
    
    addMealButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FF6B9D',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 14,
        gap: 3,
    },
    addMealButtonText: { color: '#FFF', fontSize: 10, fontWeight: '600' },
    
    emptyMealsContainer: {
        padding: 30,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFF5F8',
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#FFE8EE',
        borderStyle: 'dashed',
    },
    emptyMealsText: {
        fontSize: 13,
        color: '#FF6B9D',
        fontWeight: '500',
        marginTop: 8,
    },
    
    mealCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E8E0E3',
        overflow: 'hidden',
    },
    mealCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 8,
        backgroundColor: '#F9F6F7',
        borderBottomWidth: 1,
        borderBottomColor: '#E8E0E3',
    },
    mealCardTitle: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, flexWrap: 'wrap' },
    mealTypeDot: { width: 5, height: 5, borderRadius: 2.5 },
    mealCardDay: { fontSize: 11, fontWeight: '700', color: '#2D2D2D' },
    mealCardType: { fontSize: 10, color: '#8A8A8E' },
    mealCardRemove: { padding: 3 },
    
    mealCardBody: { padding: 8 },
    mealRow: { flexDirection: 'row', marginBottom: 6 },
    mealField: { flex: 1 },
    mealLabel: { fontSize: 8, fontWeight: '600', color: '#8A8A8E', marginBottom: 2, letterSpacing: 0.3 },
    mealInput: {
        backgroundColor: '#F9F6F7',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 8,
        fontSize: 11,
        color: '#2D2D2D',
        borderWidth: 1,
        borderColor: '#E8E0E3',
        minHeight: 38,
    },
    mealNotesInput: { minHeight: 44, textAlignVertical: 'top' },
    mealTotal: { fontSize: 13, fontWeight: '700', color: '#FF6B9D', paddingVertical: 8 },
    
    daySelectorScroll: { 
        paddingRight: 4, 
        gap: 4,
        paddingVertical: 2,
    },
    dayOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9F6F7',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E8E0E3',
    },
    dayOptionActive: { 
        backgroundColor: '#FFF5F8',
        borderColor: '#FF6B9D',
    },
    dayOptionText: { 
        fontSize: 10, 
        fontWeight: '500', 
        color: '#8A8A8E' 
    },
    dayOptionTextActive: { 
        color: '#FF6B9D',
        fontWeight: '600',
    },
    
    mealTypeSelectorScroll: { 
        paddingRight: 4, 
        gap: 3,
        paddingVertical: 2,
    },
    mealTypeOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9F6F7',
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E8E0E3',
        gap: 2,
    },
    mealTypeOptionActive: { backgroundColor: '#FFF5F8' },
    mealTypeOptionDisabled: { opacity: 0.5, backgroundColor: '#F5F5F5' },
    mealTypeOptionText: { fontSize: 8, fontWeight: '500', color: '#8A8A8E' },
    mealTypeOptionTextDisabled: { color: '#B0B0B0' },
    
    menuSelectionSection: { marginTop: 2 },
    menuSelectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
    selectMenuButton: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 3 },
    selectMenuButtonText: { fontSize: 10, fontWeight: '600', color: '#FF6B9D' },
    
    selectedMenuItems: { gap: 2 },
    selectedMenuItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F9F6F7',
        paddingHorizontal: 6,
        paddingVertical: 5,
        borderRadius: 5,
    },
    selectedMenuItemInfo: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
    selectedMenuItemName: { fontSize: 11, color: '#2D2D2D', flex: 1 },
    selectedMenuItemPrice: { fontSize: 10, fontWeight: '600', color: '#FF6B9D' },
    selectedMenuItemQty: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    qtyButton: { 
        width: 20, 
        height: 20, 
        borderRadius: 10, 
        backgroundColor: '#FFF5F8', 
        justifyContent: 'center', 
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FFE8EE',
    },
    qtyText: { fontSize: 10, fontWeight: '600', color: '#2D2D2D', minWidth: 14, textAlign: 'center' },
    
    emptyMenuItems: {
        padding: 10,
        borderWidth: 1,
        borderColor: '#E8E0E3',
        borderRadius: 6,
        borderStyle: 'dashed',
        alignItems: 'center',
        backgroundColor: '#F9F6F7',
    },
    emptyMenuItemsText: { fontSize: 10, color: '#8A8A8E', marginTop: 1 },
    
    mealServicesTotal: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 8,
        borderTopWidth: 2,
        borderTopColor: '#FFE8EE',
        marginTop: 2,
    },
    mealServicesTotalLabel: { fontSize: 11, fontWeight: '600', color: '#2D2D2D' },
    mealServicesTotalValue: { fontSize: 15, fontWeight: '800', color: '#FF6B9D' },
    
    chargesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    chargeItem: { 
        flex: 1, 
        minWidth: '45%', 
        backgroundColor: '#FFFFFF', 
        borderRadius: 6, 
        padding: 6, 
        borderWidth: 1, 
        borderColor: '#E8E0E3' 
    },
    chargeLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        marginBottom: 1,
    },
    chargeLabel: { fontSize: 9, color: '#8A8A8E' },
    chargeInput: { 
        fontSize: 12, 
        fontWeight: '600', 
        color: '#2D2D2D', 
        paddingHorizontal: 0, 
        paddingVertical: 6, 
        borderBottomWidth: 2, 
        borderBottomColor: '#F0E8EB',
        backgroundColor: 'transparent',
        minHeight: 36,
    },
    chargeInputDiscount: { borderBottomColor: '#FF5722', color: '#FF5722' },
    
    deliveryContainer: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 8,
    },
    deliveryOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#E8E0E3',
        paddingVertical: 8,
        paddingHorizontal: 6,
        gap: 4,
    },
    deliveryOptionActive: {
        borderColor: '#FF6B9D',
        backgroundColor: '#FFF5F8',
    },
    deliveryOptionText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#8A8A8E',
    },
    deliveryOptionTextActive: {
        color: '#FF6B9D',
        fontWeight: '600',
    },
    deliveryFields: {
        marginTop: 2,
    },
    
    textAreaContainer: { 
        backgroundColor: '#FFFFFF', 
        borderRadius: 8, 
        borderWidth: 1.5, 
        borderColor: '#E8E0E3', 
        paddingHorizontal: 10, 
        paddingVertical: 6,
    },
    textArea: { fontSize: 12, color: '#2D2D2D', minHeight: 60, textAlignVertical: 'top' },
    
    modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingTop: Platform.OS === 'ios' ? 44 : 14,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F0E8EB',
    },
    modalTitle: { fontSize: 15, fontWeight: '700', color: '#2D2D2D' },
    modalDoneButtonText: { fontSize: 12, fontWeight: '600', color: '#FF6B9D', padding: 3 },
    modalSearch: { paddingHorizontal: 14, paddingVertical: 8 },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9F6F7',
        borderRadius: 8,
        paddingHorizontal: 8,
        gap: 4,
    },
    searchInput: { flex: 1, fontSize: 12, color: '#2D2D2D', paddingVertical: 8 },
    modalCategories: { paddingHorizontal: 14, paddingBottom: 6 },
    categoryChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: '#F9F6F7',
        marginRight: 4,
    },
    categoryChipActive: { backgroundColor: '#FF6B9D' },
    categoryChipText: { fontSize: 11, color: '#5A5A5E' },
    categoryChipTextActive: { color: '#FFFFFF' },
    
    modalViewToggle: {
        flexDirection: 'row',
        paddingHorizontal: 14,
        paddingBottom: 6,
        gap: 4,
    },
    viewToggleButton: {
        width: 32,
        height: 32,
        borderRadius: 6,
        backgroundColor: '#F9F6F7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    viewToggleActive: { backgroundColor: '#FF6B9D' },
    
    menuItemsList: { paddingHorizontal: 10, paddingBottom: 70 },
    menuItemGrid: {
        flex: 1,
        margin: 3,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        padding: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E8E0E3',
        position: 'relative',
    },
    menuItemGridSelected: { borderColor: '#FF6B9D', backgroundColor: '#FFF5F8' },
    menuItemGridImage: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFF5F8',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    menuItemGridName: { fontSize: 11, fontWeight: '600', color: '#2D2D2D', textAlign: 'center' },
    menuItemGridCategory: { fontSize: 9, color: '#8A8A8E', marginTop: 1 },
    menuItemGridPrice: { fontSize: 11, fontWeight: '700', color: '#FF6B9D', marginTop: 2 },
    menuItemGridCheck: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#4CAF50',
        justifyContent: 'center',
        alignItems: 'center',
    },
    
    menuItemList: {
        backgroundColor: '#FFFFFF',
        borderRadius: 6,
        marginBottom: 3,
        borderWidth: 1,
        borderColor: '#E8E0E3',
    },
    menuItemListSelected: { borderColor: '#FF6B9D', backgroundColor: '#FFF5F8' },
    menuItemListContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 10,
    },
    menuItemListInfo: { flex: 1 },
    menuItemListName: { fontSize: 12, fontWeight: '600', color: '#2D2D2D' },
    menuItemListCategory: { fontSize: 10, color: '#8A8A8E' },
    menuItemListPrice: { fontSize: 12, fontWeight: '700', color: '#FF6B9D', marginHorizontal: 4 },
    menuItemListCheck: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center' },
    
    emptyListContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 30,
    },
    emptyListText: { fontSize: 13, color: '#B0B0B0', marginTop: 6 },
    
    modalFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F0E8EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 4,
    },
    modalFooterText: { fontSize: 11, color: '#8A8A8E' },
    modalDoneButton: {
        backgroundColor: '#FF6B9D',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 18,
    },
    modalDoneButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
    
    summaryCard: {
        backgroundColor: '#FFF8FA',
        borderRadius: 14,
        padding: 12,
        marginBottom: 14,
        borderWidth: 1.5,
        borderColor: '#FFE8EE',
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    summarySection: { marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F0E0E8' },
    summarySectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
    summarySectionTitle: { fontSize: 12, fontWeight: '700', color: '#2D2D2D' },
    summaryItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    summaryLabel: { fontSize: 10, color: '#8A8A8E' },
    summaryValue: { fontSize: 10, fontWeight: '600', color: '#2D2D2D', textAlign: 'right', flex: 1, marginLeft: 6 },
    summaryDiscount: { color: '#4CAF50' },
    summaryMealItem: { marginBottom: 4 },
    summaryMealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 1 },
    summaryMealTitle: { fontSize: 11, fontWeight: '600', color: '#FF6B9D' },
    summaryMealAmount: { fontSize: 11, fontWeight: '700', color: '#2D2D2D' },
    summaryMenuItem: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 8, paddingVertical: 1 },
    summaryMenuItemName: { fontSize: 10, color: '#5A5A5E' },
    summaryMenuItemPrice: { fontSize: 10, fontWeight: '600', color: '#FF6B9D' },
    summaryDivider: { height: 2, backgroundColor: '#FFE8EE', marginVertical: 4 },
    totalRow: { marginTop: 1 },
    totalLabel: { fontSize: 12, fontWeight: '700', color: '#2D2D2D' },
    totalAmount: { fontSize: 15, fontWeight: '800', color: '#FF6B9D' },
    depositAmount: { fontSize: 13, color: '#FF8FB1' },
    specialRequestsText: { fontSize: 10, color: '#8A8A8E', marginTop: 2, lineHeight: 14 },
    
    infoCard: {
        flexDirection: 'row',
        backgroundColor: '#FFF5F8',
        borderRadius: 10,
        padding: 10,
        gap: 6,
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: '#FFE8EE',
    },
    infoText: { flex: 1, fontSize: 9, color: '#8A8A8E', lineHeight: 13 },
    
    buttonContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F0E8EB',
        gap: 8,
        zIndex: 1000,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 4,
    },
    buttonContainerWithKeyboard: {
        paddingBottom: Platform.OS === 'ios' ? 34 : 10,
    },
    backStepButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFF5F8',
        paddingVertical: 10,
        borderRadius: 20,
        gap: 3,
        borderWidth: 1.5,
        borderColor: '#FFE8EE',
        minHeight: 42,
    },
    backStepText: { fontSize: 12, fontWeight: '600', color: '#FF6B9D' },
    nextButton: { borderRadius: 20, overflow: 'hidden' },
    nextButtonWithBack: { flex: 2 },
    nextButtonFull: { flex: 1 },
    gradientButton: { 
        flexDirection: 'row', 
        paddingVertical: 10, 
        justifyContent: 'center', 
        alignItems: 'center', 
        gap: 4,
        paddingHorizontal: 14,
        minHeight: 42,
    },
    nextButtonText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
});

export default BookingScreen;


//Update 08/30/26