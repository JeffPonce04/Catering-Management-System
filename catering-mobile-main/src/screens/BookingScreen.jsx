// ============================================================
// FILE: src/screens/BookingScreen.jsx - COMPLETE FIXED VERSION
// ============================================================

import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
    SafeAreaView
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
    { id: 'buffet', label: 'Buffet Service', icon: 'food', description: 'Full buffet setup with equipment', color: '#FF6B9D' },
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

const buildSelectorId = (type, id, index) => {
    const safeId = id && typeof id !== 'object' ? id : index;
    return `${type}-${safeId}`;
};

const normalizeMenuForSelector = (item, index = 0) => {
    const menuItemId = item.menu_item_id || item.id;
    return {
        ...item,
        id: buildSelectorId('menu', menuItemId, index),
        menu_item_id: menuItemId,
        source_type: 'menu',
        item_type: 'menu_item',
        name: item.name || 'Unnamed Item',
        price: parseFloat(item.price) || 0,
        category: getCategoryName(item.category || item.category_name),
    };
};

const normalizePackageForSelector = (item, index = 0) => {
    const packageId = item.package_id || item.id;
    return {
        ...item,
        id: buildSelectorId('package', packageId, index),
        package_id: packageId,
        source_type: 'package',
        item_type: 'package',
        name: item.name || 'Package',
        price: parseFloat(item.base_price_per_pax || item.price_per_head || item.price) || 0,
        category: 'Packages',
    };
};

const normalizePromotionForSelector = (item, index = 0) => {
    const promotionId = item.promotion_id || item.id;
    return {
        ...item,
        id: buildSelectorId('promotion', promotionId, index),
        promotion_id: promotionId,
        source_type: 'promotion',
        item_type: 'promotion',
        name: item.name || 'Promotion',
        price: parseFloat(item.discounted_price || item.promo_price || item.price) || 0,
        category: 'Promotions',
    };
};

const normalizeCartForSelector = (item, index = 0) => ({
    ...normalizeMenuForSelector(item, index),
    id: buildSelectorId('cart', item.menu_item_id || item.id, index),
    source_type: 'cart',
    category: 'Cart',
    quantity: parseInt(item.quantity, 10) || 1,
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
    const [focusedField, setFocusedField] = useState(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showMenuSelector, setShowMenuSelector] = useState(false);
    const [selectedMealForMenu, setSelectedMealForMenu] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [viewMode, setViewMode] = useState('grid');
    const [tempSelectedItems, setTempSelectedItems] = useState([]);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    
    // Data from API
    const [eventTypes, setEventTypes] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [packages, setPackages] = useState([]);
    const [promotions, setPromotions] = useState([]);
    const [categories, setCategories] = useState(['All']);
    
    // Selection state
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [selectedPromotion, setSelectedPromotion] = useState(null);
    const [selectedItems, setSelectedItems] = useState([]);
    const [isPackageBooking, setIsPackageBooking] = useState(false);
    const [isPromoBooking, setIsPromoBooking] = useState(false);
    
    // Animations
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const slideAnim = useRef(new Animated.Value(0)).current;
    
    // Refs
    const inputRefs = useRef({});
    const scrollViewRef = useRef(null);
    const mealIdCounter = useRef(1);

    // ============================================================
    // KEYBOARD_HANDLING - FIXED
    // ============================================================
    const dismissKeyboard = useCallback(() => {
        Keyboard.dismiss();
        setFocusedField(null);
    }, []);

    const handleFocus = useCallback((fieldName) => {
        setFocusedField(fieldName);
        // Use measure with callback pattern (async)
        setTimeout(() => {
            if (scrollViewRef.current && fieldName && inputRefs.current[fieldName]) {
                inputRefs.current[fieldName].measure((x, y, width, height, pageX, pageY) => {
                    if (scrollViewRef.current) {
                        scrollViewRef.current.scrollTo({
                            y: (pageY || 0) - 100,
                            animated: true
                        });
                    }
                });
            }
        }, 150);
    }, []);

    const handleBlur = useCallback(() => {
        setFocusedField(null);
    }, []);

    const handleNextInput = useCallback((currentField, nextField) => {
        if (nextField && inputRefs.current[nextField]) {
            setTimeout(() => {
                inputRefs.current[nextField]?.focus();
            }, 50);
        }
    }, []);

    // ============================================================
    // KEYBOARD LISTENERS
    // ============================================================
    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
            setKeyboardVisible(true);
        });
        const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
            setKeyboardVisible(false);
        });

        return () => {
            keyboardDidShowListener.remove();
            keyboardDidHideListener.remove();
        };
    }, []);

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
    // UPDATE FORM FIELD
    // ============================================================
    const updateFormField = useCallback((field, value) => {
        setFormData(prev => {
            const next = {
                ...prev,
                [field]: value,
            };

            if (field === 'guests_count') {
                const nextGuestCount = parseInt(value, 10) || 0;
                next.meal_services = (prev.meal_services || []).map(meal => ({
                    ...meal,
                    pax: !meal.pax || Number(meal.pax) <= 0 ? nextGuestCount : meal.pax,
                }));
            }

            return next;
        });
    }, []);

    // ============================================================
    // MEAL SERVICES FUNCTIONS
    // ============================================================
    const initializeMealServices = useCallback(() => {
        const days = formData.total_days || 1;
        const meals = [];
        
        for (let day = 1; day <= days; day++) {
            MEAL_TYPES.forEach(mealType => {
                meals.push({
                    ...DEFAULT_MEAL_SERVICE,
                    id: mealIdCounter.current++,
                    day_number: day,
                    meal_type: mealType.id,
                    serving_time: mealType.time.split(' - ')[0],
                    pax: parseInt(formData.guests_count) || 0,
                    menu_items: [],
                });
            });
        }
        
        setFormData(prev => ({ ...prev, meal_services: meals }));
    }, [formData.total_days, formData.guests_count]);

    const addMealService = useCallback(() => {
        const newMeal = {
            ...DEFAULT_MEAL_SERVICE,
            id: mealIdCounter.current++,
            day_number: formData.total_days,
            meal_type: 'lunch',
            serving_time: '12:00 PM',
            pax: parseInt(formData.guests_count) || 0,
            menu_items: [],
        };
        
        setFormData(prev => ({
            ...prev,
            meal_services: [...prev.meal_services, newMeal]
        }));
    }, [formData.total_days, formData.guests_count]);

    const removeMealService = useCallback((mealId) => {
        Alert.alert(
            'Remove Meal',
            'Are you sure you want to remove this meal service?',
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
                    }
                }
            ]
        );
    }, []);

    const updateMealService = useCallback((mealId, updates) => {
        setFormData(prev => ({
            ...prev,
            meal_services: prev.meal_services.map(meal =>
                meal.id === mealId ? { ...meal, ...updates } : meal
            )
        }));
    }, []);

    // ============================================================
    // MENU SELECTION FUNCTIONS
    // ============================================================
    const openMenuSelector = useCallback((mealId) => {
        setSelectedMealForMenu(mealId);
        const meal = formData.meal_services.find(m => m.id === mealId);
        setTempSelectedItems(meal?.menu_items || []);
        setShowMenuSelector(true);
        setSearchQuery('');
        setSelectedCategory('All');
    }, [formData.meal_services]);

    const toggleMenuItem = useCallback((menuItem) => {
        setTempSelectedItems(prev => {
            const exists = prev.some(item => item.id === menuItem.id);
            if (exists) {
                return prev.filter(item => item.id !== menuItem.id);
            } else {
                return [...prev, { ...menuItem, quantity: 1 }];
            }
        });
    }, []);

    const updateTempItemQuantity = useCallback((itemId, quantity) => {
        setTempSelectedItems(prev => 
            prev.map(item => 
                item.id === itemId ? { ...item, quantity: Math.max(1, quantity) } : item
            )
        );
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
        setFormData(prev => ({
            ...prev,
            meal_services: prev.meal_services.map(meal => {
                if (meal.id === mealId) {
                    return {
                        ...meal,
                        menu_items: meal.menu_items.map(item =>
                            item.id === itemId ? { ...item, quantity: Math.max(1, quantity) } : item
                        )
                    };
                }
                return meal;
            })
        }));
    }, []);

    const getMealTotal = useCallback((meal) => {
        const menuTotal = (meal.menu_items || []).reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
        const paxTotal = (meal.pax || 0) * (meal.price_per_head || 0);
        return menuTotal + paxTotal;
    }, []);

    const getTotalMealServices = useCallback(() => {
        return (formData.meal_services || []).reduce((sum, meal) => sum + getMealTotal(meal), 0);
    }, [formData.meal_services, getMealTotal]);

    // ============================================================
    // INITIALIZATION
    // ============================================================
    useEffect(() => {
        loadEventTypes();
        loadMenuItems();
        loadPackages();
        loadPromotions();
        initializeMealServices();
        
        if (routePackage || routePackageId) {
            loadPackageData();
        }
        if (routePromotion || routePromotionId) {
            loadPromotionData();
        }
    }, []);

    // ============================================================
    // LOAD DATA FUNCTIONS
    // ============================================================
    const loadEventTypes = async () => {
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
        }
    };

    const loadMenuItems = async () => {
        try {
            const result = await menuService.getPublicMenuItems({ is_available: true });
            if (result.success) {
                const items = result.data || [];
                const formattedItems = items.map((item, index) => normalizeMenuForSelector(item, index));
                setMenuItems(formattedItems);
                
                const uniqueCategories = ['All', ...new Set(formattedItems.map(item => item.category || 'Uncategorized'))];
                setCategories(uniqueCategories);
            }
        } catch (error) {
            console.log('Error loading menu items:', error);
        }
    };

    const loadPackages = async () => {
        try {
            const result = await packageService.getPublicPackages();
            if (result.success) {
                setPackages((result.data || []).map((item, index) => normalizePackageForSelector(item, index)));
            }
        } catch (error) {
            console.log('Error loading packages:', error);
        }
    };

    const loadPromotions = async () => {
        try {
            const result = await promotionService.getPublicPromotions();
            if (result.success) {
                setPromotions((result.data || []).map((item, index) => normalizePromotionForSelector(item, index)));
            }
        } catch (error) {
            console.log('Error loading promotions:', error);
        }
    };

    const loadPackageData = async () => {
        try {
            setLoading(true);
            let packageData = routePackage;
            
            if (!packageData && routePackageId) {
                const response = await packageService.getPackage(routePackageId);
                if (response.success) {
                    packageData = response.data;
                }
            }
            
            if (packageData) {
                setSelectedPackage(packageData);
                setIsPackageBooking(true);
                
                setFormData(prev => {
                    const nextGuestCount = parseInt(packageData.min_pax, 10) || 50;
                    return {
                        ...prev,
                        guests_count: nextGuestCount.toString(),
                        event_type_id: packageData.event_type_id || prev.event_type_id,
                        package_id: packageData.package_id || packageData.id,
                        menu_selection_type: 'package',
                        meal_services: (prev.meal_services || []).map(meal => ({
                            ...meal,
                            pax: !meal.pax || Number(meal.pax) <= 0 ? nextGuestCount : meal.pax,
                        })),
                    };
                });
                
                Alert.alert(
                    'Package Selected',
                    `You are booking "${packageData.name}" package. Please fill in the event details.`,
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            console.log('Error loading package:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadPromotionData = async () => {
        try {
            setLoading(true);
            let promotionData = routePromotion;
            
            if (!promotionData && routePromotionId) {
                const response = await promotionService.getPromotion(routePromotionId);
                if (response.success) {
                    promotionData = response.data;
                }
            }
            
            if (promotionData) {
                setSelectedPromotion(promotionData);
                setIsPromoBooking(true);
                
                setFormData(prev => {
                    const nextGuestCount = 50;
                    return {
                        ...prev,
                        guests_count: nextGuestCount.toString(),
                        event_type_id: promotionData.event_type_id || prev.event_type_id,
                        promotion_id: promotionData.promotion_id || promotionData.id,
                        meal_services: (prev.meal_services || []).map(meal => ({
                            ...meal,
                            pax: !meal.pax || Number(meal.pax) <= 0 ? nextGuestCount : meal.pax,
                        })),
                    };
                });
                
                Alert.alert(
                    'Promotion Applied',
                    `You are using "${promotionData.name}" promotion. ${promotionData.discount_type === 'percentage' ? `${promotionData.discount_value}% off` : `₱${promotionData.discount_value} off`}`,
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            console.log('Error loading promotion:', error);
        } finally {
            setLoading(false);
        }
    };

    // ============================================================
    // CALCULATION FUNCTIONS
    // ============================================================
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
    // VALIDATION FUNCTIONS
    // ============================================================
    const validateStep1 = useCallback(() => {
        if (!formData.customer_name || formData.customer_name.trim() === '') {
            Alert.alert('Required', 'Please enter your full name');
            return false;
        }
        if (!formData.customer_email || !formData.customer_email.includes('@')) {
            Alert.alert('Required', 'Please enter a valid email address');
            return false;
        }
        if (!formData.customer_phone || formData.customer_phone.trim() === '') {
            Alert.alert('Required', 'Please enter your phone number');
            return false;
        }
        if (!formData.event_type_id) {
            Alert.alert('Required', 'Please select an event type');
            return false;
        }
        if (!formData.venue || formData.venue.trim() === '') {
            Alert.alert('Required', 'Please enter event location');
            return false;
        }
        if (!formData.guests_count || parseInt(formData.guests_count) < 10) {
            Alert.alert('Required', 'Minimum of 10 guests required');
            return false;
        }
        return true;
    }, [formData]);

    const validateStep2 = useCallback(() => {
        const hasMeals = (formData.meal_services || []).some(m => (m.menu_items || []).length > 0 || (m.pax > 0 && m.price_per_head > 0));
        if (!hasMeals) {
            Alert.alert('Required', 'Please configure at least one meal service with menu items');
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
        
        if (currentStep === 1) {
            if (validateStep1()) {
                setCurrentStep(2);
            }
        } else if (currentStep === 2) {
            if (validateStep2()) {
                setCurrentStep(3);
            }
        } else if (currentStep === 3) {
            handleSubmit();
        }
    }, [currentStep, validateStep1, validateStep2]);

    const handlePreviousStep = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        dismissKeyboard();
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    }, [currentStep]);

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
                const hasNotes = !!(m.notes && String(m.notes).trim());
                return hasMenuItems || hasManualMealCharge || hasNotes;
            });

            if (selectedMeals.length === 0) {
                Alert.alert('Required', 'Please select at least one menu item for your booking.');
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

                const firstPackage = normalizedItems.find(item => item.package_id);
                const firstMenuItem = normalizedItems.find(item => item.menu_item_id);

                return {
                    day_number: Math.max(1, parseInt(m.day_number, 10) || 1),
                    meal_type: m.meal_type || 'lunch',
                    serving_time: m.serving_time || '12:00 PM',
                    pax: normalizedPax,
                    price_per_head: parseFloat(m.price_per_head) || 0,
                    menu_source: firstPackage ? 'package' : 'custom',
                    menu_mode: firstPackage ? 'package' : 'custom',
                    package_id: firstPackage?.package_id || null,
                    menu_item_id: firstMenuItem?.menu_item_id || null,
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
                customer_name: formData.customer_name,
                customer_email: formData.customer_email,
                customer_phone: formData.customer_phone,
                event_type_id: formData.event_type_id,
                event_date: formData.event_date.toISOString().split('T')[0],
                event_end_date: formData.event_end_date ? formData.event_end_date.toISOString().split('T')[0] : null,
                event_time: formData.event_time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
                venue: formData.venue,
                guests_count: guestCount,
                service_type: formData.service_type,
                booking_scope: formData.event_scope,
                total_days: formData.total_days,
                has_waiters: formData.has_waiters,
                meal_services: mealServices,
                transportation_fee: formData.transportation_fee,
                setup_fee: formData.setup_fee,
                service_crew_fee: formData.service_crew_fee,
                equipment_rental: formData.equipment_rental,
                extra_food_fee: formData.extra_food_fee,
                discount: formData.discount,
                delivery_method: formData.delivery_method,
                delivery_address: formData.delivery_method === 'delivery' ? formData.delivery_address : null,
                delivery_contact_person: formData.delivery_method === 'delivery' ? formData.delivery_contact_person : null,
                delivery_contact_phone: formData.delivery_method === 'delivery' ? formData.delivery_contact_phone : null,
                delivery_fee: formData.delivery_method === 'delivery' ? formData.delivery_fee : 0,
                special_requests: formData.special_requests || null,
                menu_selection_type: isPackageBooking ? 'package' : 'custom',
                package_id: isPackageBooking ? (selectedPackage?.package_id || selectedPackage?.id) : null,
                promotion_id: isPromoBooking ? (selectedPromotion?.promotion_id || selectedPromotion?.id) : null,
                total_amount: totalAmount,
                required_deposit: totalAmount * 0.3,
                down_payment: formData.down_payment || 0,
                payment_method: formData.payment_method,
                payment_reference: formData.payment_reference || null,
                transaction_id: formData.transaction_id || null,
            };

            const response = await bookingAPI.createBooking(bookingData);
            
            if (response.data?.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert(
                    'Booking Submitted!',
                    `Your booking has been submitted for approval.\n\n📅 Event: ${formData.event_date.toLocaleDateString()}\n👥 Guests: ${guestCount}\n💰 Total: ₱${totalAmount.toLocaleString()}`,
                    [
                        { 
                            text: 'View Orders', 
                            onPress: () => {
                                clearCart();
                                navigation.navigate('OrdersTab');
                            } 
                        },
                        { 
                            text: 'Back to Home', 
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
            console.log('Booking submission error:', error);
            Alert.alert(
                'Error', 
                error.response?.data?.message || error.message || 'Failed to submit booking. Please try again.'
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
        const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    }, []);

    const formatTimeDisplay = useCallback((date) => {
        if (!date) return 'Select Time';
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }, []);

    const getMealTypeIcon = useCallback((type) => {
        const meal = MEAL_TYPES.find(m => m.id === type);
        return meal?.icon || 'food';
    }, []);

    const getMealTypeColor = useCallback((type) => {
        const meal = MEAL_TYPES.find(m => m.id === type);
        return meal?.color || '#FF6B9D';
    }, []);

    const getSelectableMealItems = useCallback(() => {
        const cartSelectableItems = (cartItems || []).map((item, index) => normalizeCartForSelector(item, index));
        const seen = new Set();
        return [...cartSelectableItems, ...menuItems, ...packages, ...promotions].filter(item => {
            const key = item.id || `${item.source_type}-${item.menu_item_id || item.package_id || item.promotion_id || item.name}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [cartItems, menuItems, packages, promotions]);

    const getSelectorCategories = useCallback(() => {
        const dynamicCategories = getSelectableMealItems().map(item => getCategoryName(item.category));
        return ['All', ...new Set(dynamicCategories.filter(Boolean))];
    }, [getSelectableMealItems]);

    const getFilteredMenuItems = useCallback(() => {
        let items = getSelectableMealItems();
        
        if (searchQuery) {
            items = items.filter(item => {
                const name = item.name || '';
                const category = getCategoryName(item.category);
                return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    category.toLowerCase().includes(searchQuery.toLowerCase());
            });
        }
        
        if (selectedCategory !== 'All') {
            items = items.filter(item => getCategoryName(item.category) === selectedCategory);
        }
        
        return items;
    }, [getSelectableMealItems, searchQuery, selectedCategory]);

    // ============================================================
    // RENDER STEP 1 - Details
    // ============================================================
    const renderStep1 = useMemo(() => (
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {/* Customer Information */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionIcon}>
                        <MaterialCommunityIcons name="account" size={20} color="#FFF" />
                    </View>
                    <Text style={styles.sectionTitle}>Customer Information</Text>
                </View>
                
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Full Name <Text style={styles.required}>*</Text></Text>
                    <View style={[styles.inputContainer, focusedField === 'customer_name' && styles.inputContainerFocused]}>
                        <Feather name="user" size={18} color="#FF6B9D" />
                        <TextInput 
                            ref={ref => inputRefs.current.customer_name = ref}
                            style={styles.input} 
                            value={formData.customer_name} 
                            onChangeText={(text) => updateFormField('customer_name', text)}
                            onFocus={() => handleFocus('customer_name')}
                            onBlur={handleBlur}
                            placeholder="Enter your full name" 
                            placeholderTextColor="#B0B0B0" 
                            returnKeyType="next"
                            blurOnSubmit={false}
                            onSubmitEditing={() => handleNextInput('customer_name', 'customer_email')}
                        />
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email Address <Text style={styles.required}>*</Text></Text>
                    <View style={[styles.inputContainer, focusedField === 'customer_email' && styles.inputContainerFocused]}>
                        <Feather name="mail" size={18} color="#FF6B9D" />
                        <TextInput 
                            ref={ref => inputRefs.current.customer_email = ref}
                            style={styles.input} 
                            value={formData.customer_email} 
                            onChangeText={(text) => updateFormField('customer_email', text)}
                            onFocus={() => handleFocus('customer_email')}
                            onBlur={handleBlur}
                            placeholder="Enter your email address" 
                            placeholderTextColor="#B0B0B0" 
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
                    <View style={[styles.inputContainer, focusedField === 'customer_phone' && styles.inputContainerFocused]}>
                        <Feather name="phone" size={18} color="#FF6B9D" />
                        <TextInput 
                            ref={ref => inputRefs.current.customer_phone = ref}
                            style={styles.input} 
                            value={formData.customer_phone} 
                            onChangeText={(text) => updateFormField('customer_phone', text)}
                            onFocus={() => handleFocus('customer_phone')}
                            onBlur={handleBlur}
                            placeholder="Enter your phone number" 
                            placeholderTextColor="#B0B0B0" 
                            keyboardType="phone-pad"
                            returnKeyType="next"
                            blurOnSubmit={false}
                            onSubmitEditing={() => handleNextInput('customer_phone', 'venue')}
                        />
                    </View>
                </View>
            </View>

            {/* Event Details */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: '#FF9800' }]}>
                        <MaterialCommunityIcons name="calendar" size={20} color="#FFF" />
                    </View>
                    <Text style={styles.sectionTitle}>Event Details</Text>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Event Type <Text style={styles.required}>*</Text></Text>
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.eventTypesScrollContent}
                    >
                        {eventTypes.map((type) => (
                            <TouchableOpacity
                                key={type.event_type_id || type.id}
                                style={[
                                    styles.eventTypeCard,
                                    formData.event_type_id === (type.event_type_id || type.id) && styles.eventTypeCardActive
                                ]}
                                onPress={() => updateFormField('event_type_id', type.event_type_id || type.id)}
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

                <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                        <Text style={styles.label}>Event Date <Text style={styles.required}>*</Text></Text>
                        <TouchableOpacity 
                            style={[styles.dateTimeSelector]} 
                            onPress={() => setShowDatePicker(true)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.dateTimeIconWrapper}>
                                <MaterialCommunityIcons name="calendar-today" size={18} color="#FF6B9D" />
                            </View>
                            <View style={styles.dateTimeInfo}>
                                <Text style={styles.dateTimeValue}>{formatDateDisplay(formData.event_date)}</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.label}>Event Time <Text style={styles.required}>*</Text></Text>
                        <TouchableOpacity 
                            style={[styles.dateTimeSelector]} 
                            onPress={() => setShowTimePicker(true)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.dateTimeIconWrapper}>
                                <MaterialCommunityIcons name="clock-outline" size={18} color="#FF6B9D" />
                            </View>
                            <View style={styles.dateTimeInfo}>
                                <Text style={styles.dateTimeValue}>{formatTimeDisplay(formData.event_time)}</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Event Location <Text style={styles.required}>*</Text></Text>
                    <View style={[styles.inputContainer, focusedField === 'venue' && styles.inputContainerFocused]}>
                        <Feather name="map-pin" size={18} color="#FF6B9D" />
                        <TextInput 
                            ref={ref => inputRefs.current.venue = ref}
                            style={styles.input} 
                            value={formData.venue} 
                            onChangeText={(text) => updateFormField('venue', text)}
                            onFocus={() => handleFocus('venue')}
                            onBlur={handleBlur}
                            placeholder="Enter complete event address" 
                            placeholderTextColor="#B0B0B0" 
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
                            <MaterialCommunityIcons name="information" size={14} color="#FF6B9D" />
                            <Text style={styles.packageHint}>
                                Package allows {selectedPackage.min_pax || 0} to {selectedPackage.max_pax || 100} guests
                            </Text>
                        </View>
                    )}
                    <View style={styles.guestSelector}>
                        <TouchableOpacity 
                            style={styles.stepperButton} 
                            onPress={() => {
                                const current = parseInt(formData.guests_count) || 10;
                                const min = isPackageBooking ? (selectedPackage?.min_pax || 10) : 10;
                                updateFormField('guests_count', Math.max(min, current - 10).toString());
                            }}
                        >
                            <Feather name="minus" size={18} color="#FF6B9D" />
                        </TouchableOpacity>
                        <View style={styles.guestInputContainer}>
                            <TextInput 
                                ref={ref => inputRefs.current.guests = ref}
                                style={styles.guestInput} 
                                keyboardType="numeric" 
                                value={formData.guests_count} 
                                onChangeText={(text) => updateFormField('guests_count', text)}
                                onFocus={() => handleFocus('guests')}
                                onBlur={handleBlur}
                                placeholder="0" 
                                placeholderTextColor="#B0B0B0" 
                                textAlign="center" 
                                returnKeyType="done"
                                onSubmitEditing={dismissKeyboard}
                            />
                        </View>
                        <TouchableOpacity 
                            style={styles.stepperButton} 
                            onPress={() => {
                                const current = parseInt(formData.guests_count) || 0;
                                const max = isPackageBooking ? (selectedPackage?.max_pax || 999) : 999;
                                updateFormField('guests_count', Math.min(max, current + 10).toString());
                            }}
                        >
                            <Feather name="plus" size={18} color="#FF6B9D" />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.hint}>
                        {isPackageBooking 
                            ? `Minimum ${selectedPackage?.min_pax || 10} guests required for this package`
                            : 'Minimum 10 guests required'}
                    </Text>
                </View>
            </View>

            {/* Date Pickers */}
            {showDatePicker && (
                <DateTimePicker 
                    value={formData.event_date} 
                    mode="date" 
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'} 
                    onChange={(event, selectedDate) => {
                        setShowDatePicker(false);
                        setFocusedField(null);
                        if (selectedDate) {
                            updateFormField('event_date', selectedDate);
                        }
                    }} 
                    minimumDate={new Date()} 
                />
            )}
            {showTimePicker && (
                <DateTimePicker 
                    value={formData.event_time} 
                    mode="time" 
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'} 
                    onChange={(event, selectedTime) => { 
                        setShowTimePicker(false);
                        setFocusedField(null);
                        if (selectedTime) updateFormField('event_time', selectedTime);
                    }} 
                />
            )}
        </Animated.View>
    ), [formData, focusedField, eventTypes, showDatePicker, showTimePicker, isPackageBooking, selectedPackage, updateFormField, handleFocus, handleBlur, handleNextInput, dismissKeyboard, formatDateDisplay, formatTimeDisplay]);

    // ============================================================
    // RENDER STEP 2 - Meals
    // ============================================================
    const renderStep2 = useMemo(() => (
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {/* Service Type */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: '#4CAF50' }]}>
                        <MaterialCommunityIcons name="food" size={20} color="#FFF" />
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
                                updateFormField('service_type', type.id);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                        >
                            <View style={[styles.serviceTypeIcon, { backgroundColor: type.color + '20' }]}>
                                <MaterialCommunityIcons name={type.icon} size={28} color={type.color} />
                            </View>
                            <Text style={[styles.serviceTypeLabel, formData.service_type === type.id && styles.serviceTypeLabelActive]}>
                                {type.label}
                            </Text>
                            <Text style={styles.serviceTypeDesc}>{type.description}</Text>
                            {formData.service_type === type.id && (
                                <View style={styles.serviceTypeCheck}>
                                    <Feather name="check" size={14} color="#FFF" />
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Meal Services List */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: '#9C27B0' }]}>
                        <MaterialCommunityIcons name="food-variant" size={20} color="#FFF" />
                    </View>
                    <Text style={styles.sectionTitle}>Meals</Text>
                    <TouchableOpacity style={styles.addMealButton} onPress={addMealService}>
                        <Feather name="plus" size={16} color="#FFF" />
                        <Text style={styles.addMealButtonText}>Add Meal</Text>
                    </TouchableOpacity>
                </View>

                {(formData.meal_services || []).map((meal) => (
                    <View key={meal.id} style={styles.mealCard}>
                        <View style={styles.mealCardHeader}>
                            <View style={styles.mealCardTitle}>
                                <View style={[styles.mealTypeDot, { backgroundColor: getMealTypeColor(meal.meal_type) }]} />
                                <Text style={styles.mealCardDay}>Day {meal.day_number}</Text>
                                <Text style={styles.mealCardType}>
                                    {MEAL_TYPES.find(m => m.id === meal.meal_type)?.label || meal.meal_type}
                                </Text>
                            </View>
                            <TouchableOpacity 
                                style={styles.mealCardRemove}
                                onPress={() => removeMealService(meal.id)}
                            >
                                <Feather name="x" size={18} color="#F44336" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.mealCardBody}>
                            <View style={styles.mealRow}>
                                <View style={styles.mealField}>
                                    <Text style={styles.mealLabel}>MEAL TYPE</Text>
                                    <ScrollView 
                                        horizontal 
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.mealTypeSelectorScroll}
                                    >
                                        {MEAL_TYPES.map((type) => (
                                            <TouchableOpacity
                                                key={type.id}
                                                style={[
                                                    styles.mealTypeOption,
                                                    meal.meal_type === type.id && styles.mealTypeOptionActive,
                                                    { borderColor: meal.meal_type === type.id ? type.color : '#E8E8E8' }
                                                ]}
                                                onPress={() => updateMealService(meal.id, { meal_type: type.id })}
                                            >
                                                <MaterialCommunityIcons 
                                                    name={type.icon} 
                                                    size={16} 
                                                    color={meal.meal_type === type.id ? type.color : '#B0B0B0'} 
                                                />
                                                <Text style={[
                                                    styles.mealTypeOptionText,
                                                    meal.meal_type === type.id && { color: type.color }
                                                ]}>
                                                    {type.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            </View>

                            <View style={styles.mealRow}>
                                <View style={[styles.mealField, { flex: 1, marginRight: 8 }]}>
                                    <Text style={styles.mealLabel}>SERVING TIME</Text>
                                    <TextInput
                                        style={styles.mealInput}
                                        value={meal.serving_time || '12:00 PM'}
                                        onChangeText={(text) => updateMealService(meal.id, { serving_time: text })}
                                        placeholder="12:00 PM"
                                        placeholderTextColor="#B0B0B0"
                                    />
                                </View>
                                <View style={[styles.mealField, { flex: 1 }]}>
                                    <Text style={styles.mealLabel}>PAX</Text>
                                    <TextInput
                                        style={styles.mealInput}
                                        keyboardType="numeric"
                                        value={String(meal.pax || '')}
                                        onChangeText={(text) => updateMealService(meal.id, { pax: parseInt(text) || 0 })}
                                        placeholder="0"
                                        placeholderTextColor="#B0B0B0"
                                    />
                                </View>
                            </View>

                            <View style={styles.mealRow}>
                                <View style={[styles.mealField, { flex: 1, marginRight: 8 }]}>
                                    <Text style={styles.mealLabel}>PRICE PER HEAD</Text>
                                    <TextInput
                                        style={styles.mealInput}
                                        keyboardType="numeric"
                                        value={String(meal.price_per_head || '')}
                                        onChangeText={(text) => updateMealService(meal.id, { price_per_head: parseFloat(text) || 0 })}
                                        placeholder="0.00"
                                        placeholderTextColor="#B0B0B0"
                                    />
                                </View>
                                <View style={[styles.mealField, { flex: 1 }]}>
                                    <Text style={styles.mealLabel}>TOTAL</Text>
                                    <Text style={styles.mealTotal}>₱{getMealTotal(meal).toLocaleString()}</Text>
                                </View>
                            </View>

                            {/* Menu Items Selection */}
                            <View style={styles.menuSelectionSection}>
                                <View style={styles.menuSelectionHeader}>
                                    <Text style={styles.mealLabel}>MENU ITEMS</Text>
                                    <TouchableOpacity 
                                        style={styles.selectMenuButton}
                                        onPress={() => openMenuSelector(meal.id)}
                                    >
                                        <Feather name="plus-circle" size={16} color="#FF6B9D" />
                                        <Text style={styles.selectMenuButtonText}>Select Items</Text>
                                    </TouchableOpacity>
                                </View>

                                {(meal.menu_items || []).length > 0 ? (
                                    <View style={styles.selectedMenuItems}>
                                        {(meal.menu_items || []).map((item) => (
                                            <View key={item.id} style={styles.selectedMenuItem}>
                                                <View style={styles.selectedMenuItemInfo}>
                                                    <Text style={styles.selectedMenuItemName}>{item.name || 'Item'}</Text>
                                                    <Text style={styles.selectedMenuItemPrice}>₱{parseFloat(item.price || 0).toFixed(2)}</Text>
                                                </View>
                                                <View style={styles.selectedMenuItemQty}>
                                                    <TouchableOpacity 
                                                        style={styles.qtyButton}
                                                        onPress={() => updateMenuItemQuantity(meal.id, item.id, (parseInt(item.quantity, 10) || 1) - 1)}
                                                    >
                                                        <Feather name="minus" size={14} color="#FF6B9D" />
                                                    </TouchableOpacity>
                                                    <Text style={styles.qtyText}>{item.quantity || 1}</Text>
                                                    <TouchableOpacity 
                                                        style={styles.qtyButton}
                                                        onPress={() => updateMenuItemQuantity(meal.id, item.id, (parseInt(item.quantity, 10) || 1) + 1)}
                                                    >
                                                        <Feather name="plus" size={14} color="#FF6B9D" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                ) : (
                                    <TouchableOpacity 
                                        style={styles.emptyMenuItems}
                                        onPress={() => openMenuSelector(meal.id)}
                                    >
                                        <Feather name="plus" size={24} color="#B0B0B0" />
                                        <Text style={styles.emptyMenuItemsText}>No items selected</Text>
                                        <Text style={styles.emptyMenuItemsSubtext}>Tap to add menu items</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View style={styles.mealRow}>
                                <View style={styles.mealField}>
                                    <Text style={styles.mealLabel}>NOTES</Text>
                                    <TextInput
                                        style={[styles.mealInput, styles.mealNotesInput]}
                                        value={meal.notes || ''}
                                        onChangeText={(text) => updateMealService(meal.id, { notes: text })}
                                        placeholder="Special requests or notes..."
                                        placeholderTextColor="#B0B0B0"
                                        multiline
                                        numberOfLines={2}
                                        textAlignVertical="top"
                                    />
                                </View>
                            </View>
                        </View>
                    </View>
                ))}

                <View style={styles.mealServicesTotal}>
                    <Text style={styles.mealServicesTotalLabel}>Meal Services Total</Text>
                    <Text style={styles.mealServicesTotalValue}>₱{getTotalMealServices().toLocaleString()}</Text>
                </View>
            </View>

            {/* Additional Charges */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: '#FF9800' }]}>
                        <MaterialCommunityIcons name="cash-multiple" size={20} color="#FFF" />
                    </View>
                    <Text style={styles.sectionTitle}>Additional Charges</Text>
                </View>

                <View style={styles.chargesGrid}>
                    <View style={styles.chargeItem}>
                        <View style={styles.chargeLabelContainer}>
                            <MaterialCommunityIcons name="truck" size={14} color="#FF6B9D" />
                            <Text style={styles.chargeLabel}>Transportation</Text>
                        </View>
                        <TextInput
                            ref={ref => inputRefs.current.transportation_fee = ref}
                            style={styles.chargeInput}
                            keyboardType="numeric"
                            value={String(formData.transportation_fee || 0)}
                            onChangeText={(text) => updateFormField('transportation_fee', parseFloat(text) || 0)}
                            onFocus={() => handleFocus('transportation_fee')}
                            onBlur={handleBlur}
                            placeholder="0"
                            placeholderTextColor="#B0B0B0"
                        />
                    </View>
                    <View style={styles.chargeItem}>
                        <View style={styles.chargeLabelContainer}>
                            <MaterialCommunityIcons name="tools" size={14} color="#FF6B9D" />
                            <Text style={styles.chargeLabel}>Setup Fee</Text>
                        </View>
                        <TextInput
                            ref={ref => inputRefs.current.setup_fee = ref}
                            style={styles.chargeInput}
                            keyboardType="numeric"
                            value={String(formData.setup_fee || 0)}
                            onChangeText={(text) => updateFormField('setup_fee', parseFloat(text) || 0)}
                            onFocus={() => handleFocus('setup_fee')}
                            onBlur={handleBlur}
                            placeholder="0"
                            placeholderTextColor="#B0B0B0"
                        />
                    </View>
                    <View style={styles.chargeItem}>
                        <View style={styles.chargeLabelContainer}>
                            <MaterialCommunityIcons name="account-group" size={14} color="#FF6B9D" />
                            <Text style={styles.chargeLabel}>Service Crew</Text>
                        </View>
                        <TextInput
                            ref={ref => inputRefs.current.service_crew_fee = ref}
                            style={styles.chargeInput}
                            keyboardType="numeric"
                            value={String(formData.service_crew_fee || 0)}
                            onChangeText={(text) => updateFormField('service_crew_fee', parseFloat(text) || 0)}
                            onFocus={() => handleFocus('service_crew_fee')}
                            onBlur={handleBlur}
                            placeholder="0"
                            placeholderTextColor="#B0B0B0"
                        />
                    </View>
                    <View style={styles.chargeItem}>
                        <View style={styles.chargeLabelContainer}>
                            <MaterialCommunityIcons name="warehouse" size={14} color="#FF6B9D" />
                            <Text style={styles.chargeLabel}>Equipment Rental</Text>
                        </View>
                        <TextInput
                            ref={ref => inputRefs.current.equipment_rental = ref}
                            style={styles.chargeInput}
                            keyboardType="numeric"
                            value={String(formData.equipment_rental || 0)}
                            onChangeText={(text) => updateFormField('equipment_rental', parseFloat(text) || 0)}
                            onFocus={() => handleFocus('equipment_rental')}
                            onBlur={handleBlur}
                            placeholder="0"
                            placeholderTextColor="#B0B0B0"
                        />
                    </View>
                    <View style={styles.chargeItem}>
                        <View style={styles.chargeLabelContainer}>
                            <MaterialCommunityIcons name="food" size={14} color="#FF6B9D" />
                            <Text style={styles.chargeLabel}>Extra Food</Text>
                        </View>
                        <TextInput
                            ref={ref => inputRefs.current.extra_food_fee = ref}
                            style={styles.chargeInput}
                            keyboardType="numeric"
                            value={String(formData.extra_food_fee || 0)}
                            onChangeText={(text) => updateFormField('extra_food_fee', parseFloat(text) || 0)}
                            onFocus={() => handleFocus('extra_food_fee')}
                            onBlur={handleBlur}
                            placeholder="0"
                            placeholderTextColor="#B0B0B0"
                        />
                    </View>
                    <View style={styles.chargeItem}>
                        <View style={styles.chargeLabelContainer}>
                            <MaterialCommunityIcons name="sale" size={14} color="#FF5722" />
                            <Text style={styles.chargeLabel}>Discount (-)</Text>
                        </View>
                        <TextInput
                            ref={ref => inputRefs.current.discount = ref}
                            style={[styles.chargeInput, styles.chargeInputDiscount]}
                            keyboardType="numeric"
                            value={String(formData.discount || 0)}
                            onChangeText={(text) => updateFormField('discount', parseFloat(text) || 0)}
                            onFocus={() => handleFocus('discount')}
                            onBlur={handleBlur}
                            placeholder="0"
                            placeholderTextColor="#B0B0B0"
                        />
                    </View>
                </View>
            </View>

            {/* Special Requests */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: '#2196F3' }]}>
                        <MaterialCommunityIcons name="message-text" size={20} color="#FFF" />
                    </View>
                    <Text style={styles.sectionTitle}>Special Requests</Text>
                </View>

                <View style={styles.textAreaContainer}>
                    <TextInput 
                        ref={ref => inputRefs.current.special_requests = ref}
                        style={styles.textArea} 
                        value={formData.special_requests || ''} 
                        onChangeText={(text) => updateFormField('special_requests', text)}
                        onFocus={() => handleFocus('special_requests')}
                        onBlur={handleBlur}
                        placeholder="Dietary restrictions, vegetarian meals, halal preparation, allergy warnings, event themes..." 
                        placeholderTextColor="#B0B0B0" 
                        multiline 
                        numberOfLines={4} 
                        textAlignVertical="top" 
                    />
                </View>
            </View>

            {/* Menu Selector Modal */}
            <Modal
                visible={showMenuSelector}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowMenuSelector(false)}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowMenuSelector(false)}>
                            <Feather name="x" size={24} color="#2D2D2D" />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Select Menu Items</Text>
                        <TouchableOpacity onPress={confirmMenuSelection}>
                            <Text style={styles.modalDoneButtonText}>Done</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.modalSearch}>
                        <View style={styles.searchContainer}>
                            <Feather name="search" size={18} color="#B0B0B0" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search menu items..."
                                placeholderTextColor="#B0B0B0"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                    </View>

                    <View style={styles.modalCategories}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {getSelectorCategories().map((category) => (
                                <TouchableOpacity
                                    key={`selector-category-${category}`}
                                    style={[
                                        styles.categoryChip,
                                        selectedCategory === category && styles.categoryChipActive
                                    ]}
                                    onPress={() => setSelectedCategory(category)}
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
                        >
                            <Feather name="grid" size={18} color={viewMode === 'grid' ? '#FFF' : '#FF6B9D'} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.viewToggleButton, viewMode === 'list' && styles.viewToggleActive]}
                            onPress={() => setViewMode('list')}
                        >
                            <Feather name="list" size={18} color={viewMode === 'list' ? '#FFF' : '#FF6B9D'} />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        key={`meal-selector-${viewMode}`}
                        data={getFilteredMenuItems()}
                        keyExtractor={(item) => String(item.id)}
                        numColumns={viewMode === 'grid' ? 2 : 1}
                        contentContainerStyle={styles.menuItemsList}
                        initialNumToRender={10}
                        maxToRenderPerBatch={10}
                        windowSize={5}
                        removeClippedSubviews={true}
                        renderItem={({ item }) => {
                            const isSelected = tempSelectedItems.some(i => i.id === item.id);
                            
                            if (viewMode === 'grid') {
                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={[styles.menuItemGrid, isSelected && styles.menuItemGridSelected]}
                                        onPress={() => toggleMenuItem(item)}
                                    >
                                        <View style={styles.menuItemGridImage}>
                                            <MaterialCommunityIcons name="food" size={32} color="#FF6B9D" />
                                        </View>
                                        <Text style={styles.menuItemGridName} numberOfLines={2}>{item.name || 'Unnamed'}</Text>
                                        <Text style={styles.menuItemGridCategory}>{getCategoryName(item.category)}</Text>
                                        <Text style={styles.menuItemGridPrice}>₱{(item.price || 0).toLocaleString()}</Text>
                                        {isSelected && (
                                            <View style={styles.menuItemGridCheck}>
                                                <Feather name="check" size={12} color="#FFF" />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            } else {
                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={[styles.menuItemList, isSelected && styles.menuItemListSelected]}
                                        onPress={() => toggleMenuItem(item)}
                                    >
                                        <View style={styles.menuItemListContent}>
                                            <View style={styles.menuItemListInfo}>
                                                <Text style={styles.menuItemListName}>{item.name || 'Unnamed'}</Text>
                                                <Text style={styles.menuItemListCategory}>{getCategoryName(item.category)}</Text>
                                            </View>
                                            <Text style={styles.menuItemListPrice}>₱{(item.price || 0).toLocaleString()}</Text>
                                            {isSelected && (
                                                <View style={styles.menuItemListCheck}>
                                                    <Feather name="check" size={14} color="#FFF" />
                                                </View>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            }
                        }}
                    />

                    <View style={styles.modalFooter}>
                        <Text style={styles.modalFooterText}>
                            {tempSelectedItems.length} items selected
                        </Text>
                        <TouchableOpacity 
                            style={styles.modalDoneButton}
                            onPress={confirmMenuSelection}
                        >
                            <Text style={styles.modalDoneButtonText}>Confirm Selection</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal>
        </Animated.View>
    ), [formData, focusedField, showMenuSelector, tempSelectedItems, searchQuery, selectedCategory, viewMode, getMealTotal, getTotalMealServices, getSelectorCategories, getFilteredMenuItems, toggleMenuItem, confirmMenuSelection, openMenuSelector, addMealService, removeMealService, updateMealService, updateMenuItemQuantity, handleFocus, handleBlur, updateFormField]);

    // ============================================================
    // RENDER STEP 3 - Review
    // ============================================================
    const renderStep3 = useMemo(() => {
        const total = calculateTotal();
        const mealTotal = getTotalMealServices();
        const additionalCharges = calculateAdditionalCharges();
        const discount = calculateDiscount();

        return (
            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                <View style={styles.summaryCard}>
                    <View style={styles.summarySection}>
                        <View style={styles.summarySectionHeader}>
                            <MaterialCommunityIcons name="account" size={16} color="#FF6B9D" />
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
                            <MaterialCommunityIcons name="calendar" size={16} color="#FF6B9D" />
                            <Text style={styles.summarySectionTitle}>Event</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Type:</Text>
                            <Text style={styles.summaryValue}>{eventTypes.find(t => (t.event_type_id || t.id) === formData.event_type_id)?.name || 'General'}</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Date:</Text>
                            <Text style={styles.summaryValue}>{formatDateDisplay(formData.event_date)}</Text>
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
                    </View>

                    <View style={styles.summarySection}>
                        <View style={styles.summarySectionHeader}>
                            <MaterialCommunityIcons name="food" size={16} color="#FF6B9D" />
                            <Text style={styles.summarySectionTitle}>Meal Services</Text>
                        </View>
                        {(formData.meal_services || []).map((meal) => (
                            <View key={meal.id} style={styles.summaryMealItem}>
                                <View style={styles.summaryMealHeader}>
                                    <Text style={styles.summaryMealTitle}>
                                        Day {meal.day_number} - {MEAL_TYPES.find(m => m.id === meal.meal_type)?.label || meal.meal_type}
                                    </Text>
                                    <Text style={styles.summaryMealAmount}>₱{getMealTotal(meal).toLocaleString()}</Text>
                                </View>
                                {(meal.menu_items || []).map((item) => (
                                    <View key={item.id} style={styles.summaryMenuItem}>
                                        <Text style={styles.summaryMenuItemName}>• {item.name} x{item.quantity || 1}</Text>
                                        <Text style={styles.summaryMenuItemPrice}>₱{(item.price * (item.quantity || 1)).toLocaleString()}</Text>
                                    </View>
                                ))}
                                {meal.pax > 0 && meal.price_per_head > 0 && (
                                    <Text style={styles.summaryMealPax}>
                                        {meal.pax} pax × ₱{meal.price_per_head} = ₱{(meal.pax * meal.price_per_head).toLocaleString()}
                                    </Text>
                                )}
                            </View>
                        ))}
                    </View>

                    <View style={styles.summarySection}>
                        <View style={styles.summarySectionHeader}>
                            <MaterialCommunityIcons name="cash" size={16} color="#FF6B9D" />
                            <Text style={styles.summarySectionTitle}>Charges</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Meal Services:</Text>
                            <Text style={styles.summaryValue}>₱{mealTotal.toLocaleString()}</Text>
                        </View>
                        {additionalCharges > 0 && (
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>Additional Charges:</Text>
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
                            <Text style={styles.totalLabel}>Total Estimated Cost:</Text>
                            <Text style={styles.totalAmount}>₱{total.toLocaleString()}</Text>
                        </View>
                        <View style={[styles.summaryItem, styles.totalRow]}>
                            <Text style={styles.totalLabel}>Required Deposit (30%):</Text>
                            <Text style={[styles.totalAmount, styles.depositAmount]}>₱{(total * 0.3).toLocaleString()}</Text>
                        </View>
                    </View>

                    {formData.special_requests && (
                        <View style={styles.summarySection}>
                            <View style={styles.summarySectionHeader}>
                                <MaterialCommunityIcons name="message-text" size={16} color="#FF6B9D" />
                                <Text style={styles.summarySectionTitle}>Special Requests</Text>
                            </View>
                            <Text style={styles.specialRequestsText}>{formData.special_requests}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.infoCard}>
                    <MaterialCommunityIcons name="information" size={20} color="#FF6B9D" />
                    <Text style={styles.infoText}>
                        A 30% downpayment is required to confirm the booking. Final pricing may vary based on actual requirements.
                    </Text>
                </View>
            </Animated.View>
        );
    }, [formData, eventTypes, getMealTotal, getTotalMealServices, calculateTotal, calculateAdditionalCharges, calculateDiscount, formatDateDisplay, formatTimeDisplay]);

    // ============================================================
    // MAIN RENDER
    // ============================================================
    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#FF6B9D" />
                <Text style={{ marginTop: 16, color: '#8E8E93' }}>Loading...</Text>
            </View>
        );
    }

    return (
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <View style={styles.container}>
                <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
                <LinearGradient colors={['#FFFFFF', '#FFF8FA', '#FFF0F5']} style={styles.gradient}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <Feather name="arrow-left" size={22} color="#FF6B9D" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>
                            {isPackageBooking ? 'Book Package' : isPromoBooking ? 'Book with Promotion' : 'Plan Your Event'}
                        </Text>
                        <View style={{ width: 40 }} />
                    </View>

                    <ProgressIndicator currentStep={currentStep} />

                    <KeyboardAvoidingView 
                        style={{ flex: 1 }}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
                    >
                        <ScrollView
                            ref={scrollViewRef}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                            contentContainerStyle={styles.scrollContent}
                            nestedScrollEnabled={true}
                        >
                            <View style={styles.card}>
                                {currentStep === 1 && renderStep1}
                                {currentStep === 2 && renderStep2}
                                {currentStep === 3 && renderStep3}
                            </View>
                        </ScrollView>
                    </KeyboardAvoidingView>

                    <View style={[styles.buttonContainer, keyboardVisible && styles.buttonContainerWithKeyboard]}>
                        {currentStep > 1 ? (
                            <TouchableOpacity style={styles.backStepButton} onPress={handlePreviousStep}>
                                <Feather name="arrow-left" size={18} color="#FF6B9D" />
                                <Text style={styles.backStepText}>Back</Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.backStepButtonDisabled} />
                        )}
                        
                        <TouchableOpacity 
                            style={[styles.nextButton, currentStep > 1 ? styles.nextButtonWithBack : styles.nextButtonFull]} 
                            onPress={handleNextStep}
                            disabled={loading || submitting}
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
                                        <Feather name="arrow-right" size={18} color="#FFF" />
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
// PROGRESS INDICATOR COMPONENT
// ============================================================
const ProgressIndicator = ({ currentStep }) => (
    <View style={styles.progressContainer}>
        <View style={styles.stepsContainer}>
            {[1, 2, 3].map((step) => (
                <View key={step} style={styles.stepWrapper}>
                    <View style={[styles.stepCircle, currentStep >= step && styles.stepCircleActive]}>
                        <Text style={[styles.stepNumber, currentStep >= step && styles.stepNumberActive]}>
                            {step}
                        </Text>
                        {currentStep > step && (
                            <View style={styles.stepCheck}>
                                <Feather name="check" size={12} color="#FFF" />
                            </View>
                        )}
                    </View>
                    <Text style={[styles.stepLabel, currentStep >= step && styles.stepLabelActive]}>
                        {step === 1 ? 'Details' : step === 2 ? 'Meals' : 'Review'}
                    </Text>
                    {step < 3 && (
                        <View style={[styles.stepLine, currentStep > step && styles.stepLineActive]} />
                    )}
                </View>
            ))}
        </View>
    </View>
);

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    gradient: { flex: 1 },
    scrollContent: { 
        paddingBottom: 100,
        paddingTop: 8,
    },
    
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        paddingHorizontal: 20,
        paddingBottom: 12,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#2D2D2D',
    },
    
    progressContainer: { paddingHorizontal: 20, marginBottom: 12 },
    stepsContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    stepWrapper: { alignItems: 'center', flex: 1, position: 'relative' },
    stepCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F0F0F0',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
        borderWidth: 2,
        borderColor: '#F0F0F0',
    },
    stepCircleActive: {
        backgroundColor: '#FF6B9D',
        borderColor: '#FF6B9D',
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    stepNumber: { fontSize: 14, fontWeight: '700', color: '#B0B0B0' },
    stepNumberActive: { color: '#FFF' },
    stepCheck: { position: 'absolute', top: -4, right: -4, backgroundColor: '#4CAF50', borderRadius: 8, width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
    stepLabel: { fontSize: 10, fontWeight: '500', color: '#B0B0B0', marginTop: 2 },
    stepLabelActive: { color: '#FF6B9D' },
    stepLine: {
        position: 'absolute',
        top: 18,
        left: '50%',
        right: '-50%',
        height: 2,
        backgroundColor: '#F0F0F0'
    },
    stepLineActive: { backgroundColor: '#FF6B9D' },
    
    card: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 20,
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 20,
        elevation: 6,
        marginBottom: 16,
        marginHorizontal: 16,
    },
    
    section: {
        backgroundColor: '#F8F9FA',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
        gap: 10,
    },
    sectionIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FF6B9D',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#2D2D2D',
        flex: 1,
    },
    
    inputGroup: { marginBottom: 14 },
    label: { fontSize: 13, fontWeight: '600', color: '#5A5A5E', marginBottom: 6 },
    required: { color: '#F44336' },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        paddingHorizontal: 14,
        height: 48,
        gap: 10,
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
    input: {
        flex: 1,
        fontSize: 14,
        color: '#2D2D2D',
        paddingVertical: 10,
    },
    row: { 
        flexDirection: 'row',
        gap: 8,
    },
    
    eventTypesScrollContent: { paddingRight: 20, gap: 8 },
    eventTypeCard: {
        backgroundColor: '#FFF',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        marginRight: 6,
    },
    eventTypeCardActive: {
        backgroundColor: '#FFF0F5',
        borderColor: '#FF6B9D',
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
    },
    eventTypeLabel: { fontSize: 13, fontWeight: '600', color: '#5A5A5E', textAlign: 'center' },
    eventTypeLabelActive: { color: '#FF6B9D' },
    
    dateTimeSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 10,
    },
    dateTimeIconWrapper: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFF0F5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateTimeInfo: { flex: 1 },
    dateTimeValue: { 
        fontSize: 13, 
        fontWeight: '600', 
        color: '#2D2D2D',
    },
    
    guestSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    stepperButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFF0F5',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FFE0ED',
    },
    guestInputContainer: {
        flex: 1,
        backgroundColor: '#FFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        paddingHorizontal: 4,
    },
    guestInput: {
        fontSize: 16,
        fontWeight: '700',
        color: '#2D2D2D',
        textAlign: 'center',
        paddingVertical: 10,
    },
    hint: { fontSize: 10, color: '#B0B0B0', marginTop: 4, marginLeft: 4 },
    packageHintContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF0F5',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        marginBottom: 6,
        gap: 4,
    },
    packageHint: { fontSize: 11, color: '#FF6B9D' },
    
    serviceTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    serviceTypeCard: {
        flex: 1,
        minWidth: 100,
        backgroundColor: '#FFF',
        borderRadius: 14,
        padding: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E8E8E8',
        position: 'relative',
    },
    serviceTypeCardActive: {
        borderColor: '#FF6B9D',
        borderWidth: 2,
        backgroundColor: '#FFF0F5',
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 2,
    },
    serviceTypeIcon: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    serviceTypeLabel: { fontSize: 13, fontWeight: '600', color: '#2D2D2D', textAlign: 'center' },
    serviceTypeLabelActive: { color: '#FF6B9D' },
    serviceTypeDesc: { fontSize: 10, color: '#8A8A8E', textAlign: 'center', marginTop: 2 },
    serviceTypeCheck: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#FF6B9D',
        justifyContent: 'center',
        alignItems: 'center',
    },
    
    addMealButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FF6B9D',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 4,
    },
    addMealButtonText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
    
    mealCard: {
        backgroundColor: '#FFF',
        borderRadius: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F0F0F0',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    mealCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F8F9FA',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    mealCardTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    mealTypeDot: { width: 8, height: 8, borderRadius: 4 },
    mealCardDay: { fontSize: 14, fontWeight: '700', color: '#2D2D2D' },
    mealCardType: { fontSize: 12, color: '#8A8A8E' },
    mealCardRemove: { padding: 4 },
    
    mealCardBody: { padding: 12 },
    mealRow: { flexDirection: 'row', marginBottom: 10 },
    mealField: { flex: 1 },
    mealLabel: { fontSize: 10, fontWeight: '600', color: '#8A8A8E', marginBottom: 4, letterSpacing: 0.5 },
    mealInput: {
        backgroundColor: '#F8F9FA',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 14,
        color: '#2D2D2D',
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    mealNotesInput: { minHeight: 50, textAlignVertical: 'top' },
    mealTotal: { fontSize: 16, fontWeight: '700', color: '#FF6B9D', paddingVertical: 8 },
    
    mealTypeSelectorScroll: { paddingRight: 8, gap: 4 },
    mealTypeOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        gap: 4,
    },
    mealTypeOptionActive: { backgroundColor: '#FFF0F5' },
    mealTypeOptionText: { fontSize: 10, fontWeight: '500', color: '#8A8A8E' },
    
    menuSelectionSection: { marginTop: 4 },
    menuSelectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    selectMenuButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    selectMenuButtonText: { fontSize: 12, fontWeight: '600', color: '#FF6B9D' },
    
    selectedMenuItems: { gap: 4 },
    selectedMenuItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    selectedMenuItemInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    selectedMenuItemName: { fontSize: 13, color: '#2D2D2D' },
    selectedMenuItemPrice: { fontSize: 12, fontWeight: '600', color: '#FF6B9D' },
    selectedMenuItemQty: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    qtyButton: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF0F5', justifyContent: 'center', alignItems: 'center' },
    qtyText: { fontSize: 13, fontWeight: '600', color: '#2D2D2D', minWidth: 20, textAlign: 'center' },
    
    emptyMenuItems: {
        padding: 16,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        borderRadius: 10,
        borderStyle: 'dashed',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
    },
    emptyMenuItemsText: { fontSize: 13, color: '#8A8A8E', marginTop: 4 },
    emptyMenuItemsSubtext: { fontSize: 11, color: '#B0B0B0' },
    
    mealServicesTotal: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 2,
        borderTopColor: '#FFE0ED',
        marginTop: 4,
    },
    mealServicesTotalLabel: { fontSize: 14, fontWeight: '600', color: '#2D2D2D' },
    mealServicesTotalValue: { fontSize: 18, fontWeight: '800', color: '#FF6B9D' },
    
    chargesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chargeItem: { 
        flex: 1, 
        minWidth: '45%', 
        backgroundColor: '#FFF', 
        borderRadius: 10, 
        padding: 10, 
        borderWidth: 1, 
        borderColor: '#E8E8E8' 
    },
    chargeLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
    },
    chargeLabel: { fontSize: 11, color: '#8A8A8E' },
    chargeInput: { 
        fontSize: 14, 
        fontWeight: '600', 
        color: '#2D2D2D', 
        paddingHorizontal: 0, 
        paddingVertical: 4, 
        borderBottomWidth: 2, 
        borderBottomColor: '#F0F0F0',
        backgroundColor: 'transparent',
    },
    chargeInputDiscount: { borderBottomColor: '#FF5722', color: '#FF5722' },
    
    textAreaContainer: { 
        backgroundColor: '#FFF', 
        borderRadius: 12, 
        borderWidth: 1, 
        borderColor: '#E8E8E8', 
        paddingHorizontal: 14, 
        paddingVertical: 10,
    },
    textArea: { fontSize: 14, color: '#2D2D2D', minHeight: 80, textAlignVertical: 'top' },
    
    modalContainer: { flex: 1, backgroundColor: '#FFF' },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#2D2D2D' },
    modalDoneButtonText: { fontSize: 14, fontWeight: '600', color: '#FF6B9D' },
    modalSearch: { paddingHorizontal: 20, paddingVertical: 12 },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        paddingHorizontal: 12,
        gap: 8,
    },
    searchInput: { flex: 1, fontSize: 14, color: '#2D2D2D', paddingVertical: 10 },
    modalCategories: { paddingHorizontal: 20, paddingBottom: 12 },
    categoryChip: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#F5F5F5',
        marginRight: 8,
    },
    categoryChipActive: { backgroundColor: '#FF6B9D' },
    categoryChipText: { fontSize: 13, color: '#5A5A5E' },
    categoryChipTextActive: { color: '#FFF' },
    
    modalViewToggle: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingBottom: 12,
        gap: 8,
    },
    viewToggleButton: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    viewToggleActive: { backgroundColor: '#FF6B9D' },
    
    menuItemsList: { paddingHorizontal: 16, paddingBottom: 80 },
    menuItemGrid: {
        flex: 1,
        margin: 4,
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F0F0F0',
        position: 'relative',
    },
    menuItemGridSelected: { borderColor: '#FF6B9D', backgroundColor: '#FFF0F5' },
    menuItemGridImage: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FFF0F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    menuItemGridName: { fontSize: 13, fontWeight: '600', color: '#2D2D2D', textAlign: 'center' },
    menuItemGridCategory: { fontSize: 11, color: '#8A8A8E', marginTop: 2 },
    menuItemGridPrice: { fontSize: 13, fontWeight: '700', color: '#FF6B9D', marginTop: 4 },
    menuItemGridCheck: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#4CAF50',
        justifyContent: 'center',
        alignItems: 'center',
    },
    
    menuItemList: {
        backgroundColor: '#FFF',
        borderRadius: 10,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    menuItemListSelected: { borderColor: '#FF6B9D', backgroundColor: '#FFF0F5' },
    menuItemListContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
    },
    menuItemListInfo: { flex: 1 },
    menuItemListName: { fontSize: 14, fontWeight: '600', color: '#2D2D2D' },
    menuItemListCategory: { fontSize: 12, color: '#8A8A8E' },
    menuItemListPrice: { fontSize: 14, fontWeight: '700', color: '#FF6B9D', marginHorizontal: 8 },
    menuItemListCheck: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center' },
    
    modalFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: '#FFF',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    modalFooterText: { fontSize: 14, color: '#8A8A8E' },
    modalDoneButton: {
        backgroundColor: '#FF6B9D',
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 24,
    },
    
    summaryCard: {
        backgroundColor: '#FFF8FA',
        borderRadius: 20,
        padding: 16,
        marginBottom: 20,
        borderWidth: 2,
        borderColor: '#FFE0ED',
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
    },
    summarySection: { marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F0E0E8' },
    summarySectionHeader: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 6, 
        marginBottom: 8 
    },
    summarySectionTitle: { fontSize: 14, fontWeight: '700', color: '#2D2D2D' },
    summaryItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    summaryLabel: { fontSize: 12, color: '#8A8A8E' },
    summaryValue: { fontSize: 12, fontWeight: '600', color: '#2D2D2D', textAlign: 'right', flex: 1, marginLeft: 8 },
    summaryDiscount: { color: '#4CAF50' },
    summaryMealItem: { marginBottom: 8 },
    summaryMealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    summaryMealTitle: { fontSize: 13, fontWeight: '600', color: '#FF6B9D' },
    summaryMealAmount: { fontSize: 13, fontWeight: '700', color: '#2D2D2D' },
    summaryMenuItem: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 12, paddingVertical: 2 },
    summaryMenuItemName: { fontSize: 12, color: '#5A5A5E' },
    summaryMenuItemPrice: { fontSize: 12, fontWeight: '600', color: '#FF6B9D' },
    summaryMealPax: { fontSize: 12, color: '#8A8A8E', paddingLeft: 12, marginTop: 2 },
    summaryDivider: { height: 2, backgroundColor: '#FFE0ED', marginVertical: 8 },
    totalRow: { marginTop: 4 },
    totalLabel: { fontSize: 14, fontWeight: '700', color: '#2D2D2D' },
    totalAmount: { fontSize: 18, fontWeight: '800', color: '#FF6B9D' },
    depositAmount: { fontSize: 16, color: '#FF8FB1' },
    specialRequestsText: { fontSize: 12, color: '#8A8A8E', marginTop: 4, lineHeight: 16 },
    
    infoCard: {
        flexDirection: 'row',
        backgroundColor: '#FFF0F5',
        borderRadius: 14,
        padding: 14,
        gap: 10,
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: '#FFE0ED',
    },
    infoText: { flex: 1, fontSize: 11, color: '#8A8A8E', lineHeight: 16 },
    
    buttonContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: '#FFF',
        borderTopWidth: 1,
        borderTopColor: '#F0E0E8',
        gap: 12
    },
    buttonContainerWithKeyboard: {
        paddingBottom: Platform.OS === 'ios' ? 34 : 14,
    },
    backStepButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFF0F5',
        paddingVertical: 12,
        borderRadius: 28,
        gap: 6,
        borderWidth: 1,
        borderColor: '#FFE0ED',
    },
    backStepButtonDisabled: { flex: 1 },
    backStepText: { fontSize: 14, fontWeight: '600', color: '#FF6B9D' },
    nextButton: { borderRadius: 28, overflow: 'hidden' },
    nextButtonWithBack: { flex: 2 },
    nextButtonFull: { flex: 1 },
    gradientButton: { 
        flexDirection: 'row', 
        paddingVertical: 14, 
        justifyContent: 'center', 
        alignItems: 'center', 
        gap: 8,
        paddingHorizontal: 20,
    },
    nextButtonText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});

export default BookingScreen;