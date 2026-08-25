// src/screens/CartScreen.jsx - COMPLETE WITH WORKING ADD, MINUS, REMOVE
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  GestureHandlerRootView,
  Image,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';

const { width, height } = Dimensions.get('window');

// ✅ Safe number formatter
const formatPrice = (value) => {
  const num = Number(value);
  if (isNaN(num) || num === 0) return '₱0.00';
  return `₱${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// ✅ Safe number getter
const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return isNaN(num) ? fallback : num;
};

const CartScreen = () => {
  const navigation = useNavigation();
  const { 
    cartItems, 
    totalAmount, 
    clearCart, 
    updateQuantity, 
    removeItem,
    addToCart,
    getItemQuantity 
  } = useCart();
  const { isAuthenticated, isGuest } = useAuth();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [removingItemId, setRemovingItemId] = useState(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [savedForLater, setSavedForLater] = useState([]);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Animate on mount
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
    ]).start();
  }, []);

  // ✅ Safe total calculation
  const subtotal = safeNumber(totalAmount);
  const tax = subtotal * 0.12;
  const serviceFee = 50;
  const deliveryFee = subtotal > 1000 ? 0 : 100;
  const grandTotal = subtotal + tax + serviceFee + deliveryFee;
  const itemCount = cartItems.reduce((sum, item) => sum + safeNumber(item.quantity), 0);

  // ✅ Fixed: Checkout with guest mode handling
  const handleCheckout = () => {
    if (isGuest || !isAuthenticated) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        'Login Required',
        'Please login to proceed with checkout',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Login', onPress: () => navigation.navigate('Login') },
        ]
      );
      return;
    }

    if (cartItems.length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Cart Empty', 'Please add items to your cart before checkout');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsCheckingOut(true);
    setTimeout(() => {
      setIsCheckingOut(false);
      navigation.navigate('Payment');
    }, 500);
  };

  // ✅ Fixed: Remove item with animation
  const handleRemoveItem = (itemId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive', 
          onPress: () => {
            setRemovingItemId(itemId);
            // Animate removal
            Animated.sequence([
              Animated.timing(scaleAnim, {
                toValue: 0.95,
                duration: 150,
                useNativeDriver: true,
              }),
              Animated.timing(scaleAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }),
            ]).start(() => {
              removeItem(itemId);
              setRemovingItemId(null);
              scaleAnim.setValue(1);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            });
          }
        }
      ]
    );
  };

  // ✅ Fixed: Update quantity with proper validation
  const handleUpdateQuantity = (itemId, delta) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Get current quantity
    const currentQty = getItemQuantity(itemId);
    const newQty = safeNumber(currentQty) + delta;
    
    // Don't allow going below 1
    if (newQty < 1) {
      // If trying to go below 1, ask if they want to remove
      Alert.alert(
        'Remove Item',
        'Do you want to remove this item from your cart?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => handleRemoveItem(itemId) }
        ]
      );
      return;
    }
    
    // Animate quantity change
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
    updateQuantity(itemId, delta);
  };

  // ✅ Fixed: Clear cart with confirmation
  const handleClearCart = () => {
    if (cartItems.length === 0) return;
    if (isGuest) {
      Alert.alert('Guest Mode', 'Please login to manage your cart');
      return;
    }
    setShowClearModal(true);
  };

  const confirmClearCart = () => {
    setShowClearModal(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    clearCart();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ✅ Fixed: Save for later
  const handleSaveForLater = (item) => {
    if (isGuest) {
      Alert.alert('Guest Mode', 'Please login to save items for later');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSavedForLater([...savedForLater, { ...item, savedAt: new Date() }]);
    removeItem(item.id);
    Alert.alert('Saved for Later', `${item.name || 'Item'} has been saved for later`);
  };

  // ✅ Fixed: Move back to cart
  const handleMoveToCart = (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addToCart({
      id: item.id,
      name: item.name || 'Item',
      price: safeNumber(item.price),
      image: item.image || null,
    }, 1);
    setSavedForLater(savedForLater.filter(i => i.id !== item.id));
    Alert.alert('Moved to Cart', `${item.name || 'Item'} has been moved back to your cart`);
  };

  const getDeliveryEstimate = () => {
    const baseTime = 30;
    const additionalTime = Math.floor(cartItems.length / 3) * 5;
    return baseTime + additionalTime;
  };

  // Render right swipe actions
  const renderRightActions = (item) => {
    return (
      <View style={styles.swipeContainer}>
        <RectButton
          style={[styles.swipeAction, styles.swipeSave]}
          onPress={() => handleSaveForLater(item)}
        >
          <Feather name="clock" size={20} color="#FFF" />
          <Text style={styles.swipeActionText}>Save</Text>
        </RectButton>
        <RectButton
          style={[styles.swipeAction, styles.swipeDelete]}
          onPress={() => handleRemoveItem(item.id)}
        >
          <Feather name="trash-2" size={20} color="#FFF" />
          <Text style={styles.swipeActionText}>Remove</Text>
        </RectButton>
      </View>
    );
  };

  // ✅ Fixed: Cart Item Card with working buttons and safe price handling
  const CartItemCard = ({ item }) => {
    const isRemoving = removingItemId === item.id;
    const quantity = getItemQuantity(item.id) || safeNumber(item.quantity, 0);
    const price = safeNumber(item.price);
    const itemTotal = price * quantity;

    return (
      <Swipeable
        renderRightActions={() => renderRightActions(item)}
        overshootRight={false}
        friction={2}
        rightThreshold={40}
      >
        <Animated.View 
          style={[
            styles.cartItemCard,
            isRemoving && styles.cartItemRemoving,
            { transform: [{ scale: isRemoving ? scaleAnim : 1 }] }
          ]}
        >
          <View style={styles.itemImageContainer}>
            <Image 
              source={{ uri: item.image || 'https://via.placeholder.com/80x80/FF6B9D/FFFFFF?text=Food' }} 
              style={styles.itemImage} 
            />
            {quantity > 1 && (
              <View style={styles.quantityBadge}>
                <Text style={styles.quantityBadgeText}>{quantity}</Text>
              </View>
            )}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.3)']}
              style={styles.imageOverlay}
            />
          </View>
          
          <View style={styles.itemDetails}>
            <Text style={styles.itemName} numberOfLines={2}>{item.name || 'Menu Item'}</Text>
            
            <View style={styles.itemMetaRow}>
              <View style={styles.dietaryBadge}>
                <MaterialCommunityIcons name="leaf" size={10} color="#4CAF50" />
                <Text style={styles.dietaryText}>Regular</Text>
              </View>
              <View style={styles.itemMetaDivider} />
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={10} color="#FFB800" />
                <Text style={styles.ratingText}>4.5</Text>
              </View>
            </View>
            
            <Text style={styles.itemPrice}>{formatPrice(price)}</Text>
          </View>
          
          <View style={styles.itemRightSection}>
            <View style={styles.quantityControl}>
              {/* ✅ MINUS BUTTON */}
              <TouchableOpacity 
                style={[styles.quantityButton, quantity <= 1 && styles.quantityButtonDisabled]}
                onPress={() => handleUpdateQuantity(item.id, -1)}
                disabled={quantity <= 1}
                activeOpacity={0.7}
              >
                <Feather name="minus" size={14} color={quantity <= 1 ? '#C6C6C8' : '#FF6B9D'} />
              </TouchableOpacity>
              
              <Text style={styles.quantityText}>{quantity}</Text>
              
              {/* ✅ PLUS BUTTON */}
              <TouchableOpacity 
                style={styles.quantityButton}
                onPress={() => handleUpdateQuantity(item.id, 1)}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={14} color="#FF6B9D" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.itemTotalPrice}>{formatPrice(itemTotal)}</Text>
          </View>
        </Animated.View>
      </Swipeable>
    );
  };

  // ✅ Fixed: Saved Item Card with safe price
  const SavedItemCard = ({ item }) => (
    <View style={styles.savedItemCard}>
      <Image 
        source={{ uri: item.image || 'https://via.placeholder.com/40x40/FF6B9D/FFFFFF?text=Food' }} 
        style={styles.savedItemImage} 
      />
      <View style={styles.savedItemDetails}>
        <Text style={styles.savedItemName}>{item.name || 'Item'}</Text>
        <Text style={styles.savedItemPrice}>{formatPrice(safeNumber(item.price))}</Text>
      </View>
      <TouchableOpacity 
        style={styles.moveToCartButton}
        onPress={() => handleMoveToCart(item)}
        activeOpacity={0.7}
      >
        <Feather name="shopping-bag" size={16} color="#FF6B9D" />
        <Text style={styles.moveToCartText}>Move</Text>
      </TouchableOpacity>
    </View>
  );

  // ✅ Fixed: Empty Cart with guest mode handling
  const EmptyCart = () => {
    // If guest, show different message
    if (isGuest) {
      return (
        <Animated.View 
          style={[
            styles.emptyContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          <LinearGradient
            colors={['#FFF0F5', '#FFE8EE', '#FFDCE6']}
            style={styles.emptyGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.emptyIconContainer}>
              <MaterialCommunityIcons name="cart-outline" size={72} color="#FF6B9D" />
              <View style={styles.emptyIconPulse} />
            </View>
            <Text style={styles.emptyTitle}>Login to View Cart</Text>
            <Text style={styles.emptyText}>
              Please login to view and manage your cart items.
              {'\n'}Create an account to save your favorites!
            </Text>
            <TouchableOpacity
              style={styles.shopButton}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#FF6B9D', '#FF8FB1', '#FFA0C0']}
                style={styles.shopGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Feather name="log-in" size={18} color="#FFF" />
                <Text style={styles.shopButtonText}>Sign In</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      );
    }

    return (
      <Animated.View 
        style={[
          styles.emptyContainer,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}
      >
        <LinearGradient
          colors={['#FFF0F5', '#FFE8EE', '#FFDCE6']}
          style={styles.emptyGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.emptyIconContainer}>
            <MaterialCommunityIcons name="cart-outline" size={72} color="#FF6B9D" />
            <View style={styles.emptyIconPulse} />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyText}>
            Looks like you haven't added any items to your cart yet.
            {'\n'}Browse our menu and find something delicious!
          </Text>
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => navigation.navigate('MenuTab')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#FF6B9D', '#FF8FB1', '#FFA0C0']}
              style={styles.shopGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Feather name="shopping-bag" size={18} color="#FFF" />
              <Text style={styles.shopButtonText}>Start Shopping</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <View style={styles.emptyFeatures}>
            <View style={styles.emptyFeature}>
              <MaterialCommunityIcons name="truck-delivery" size={20} color="#FF6B9D" />
              <Text style={styles.emptyFeatureText}>Free delivery over ₱1000</Text>
            </View>
            <View style={styles.emptyFeature}>
              <MaterialCommunityIcons name="shield-check" size={20} color="#FF6B9D" />
              <Text style={styles.emptyFeatureText}>Secure payment</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  if (cartItems.length === 0) {
    return <EmptyCart />;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      
      {/* Background Gradient */}
      <LinearGradient
        colors={['#FFFFFF', '#FFF8FA', '#FFF0F5']}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={22} color="#FF6B9D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Cart</Text>
        <TouchableOpacity 
          onPress={handleClearCart}
          style={styles.clearHeaderButton}
          activeOpacity={0.7}
        >
          <Feather name="trash-2" size={18} color="#FF3B30" />
        </TouchableOpacity>
      </View>

      {/* Delivery Info Bar */}
      <View style={styles.deliveryBar}>
        <View style={styles.deliveryInfo}>
          <MaterialCommunityIcons name="truck-fast" size={18} color="#FF6B9D" />
          <Text style={styles.deliveryText}>
            Delivery in ~{getDeliveryEstimate()} min
          </Text>
        </View>
        {subtotal < 1000 && (
          <View style={styles.deliveryInfo}>
            <MaterialCommunityIcons name="alert-circle" size={18} color="#FF9800" />
            <Text style={styles.deliveryWarning}>
              Add ₱{(1000 - subtotal).toLocaleString()} more for free delivery
            </Text>
          </View>
        )}
      </View>

      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{itemCount}</Text>
          <Text style={styles.statLabel}>Items</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatPrice(subtotal)}</Text>
          <Text style={styles.statLabel}>Subtotal</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{cartItems.length}</Text>
          <Text style={styles.statLabel}>Products</Text>
        </View>
      </View>

      <FlatList
        data={cartItems}
        renderItem={({ item }) => <CartItemCard item={item} />}
        keyExtractor={(item, index) => `${item.cart_item_id || item.menu_item_id || item.id || item.name || 'cart-item'}-${index}`}
        contentContainerStyle={styles.cartList}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={
          savedForLater.length > 0 ? (
            <View style={styles.savedSection}>
              <View style={styles.savedHeader}>
                <Feather name="clock" size={18} color="#8E8E93" />
                <Text style={styles.savedTitle}>Saved for Later</Text>
                <Text style={styles.savedCount}>{savedForLater.length}</Text>
              </View>
              {savedForLater.map(item => (
                <SavedItemCard key={item.id} item={item} />
              ))}
            </View>
          ) : null
        }
      />

      <View style={styles.footer}>
        <View style={styles.summarySection}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Order Summary</Text>
            <Text style={styles.summarySubtitle}>{itemCount} items</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatPrice(subtotal)}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax (12%)</Text>
            <Text style={styles.summaryValue}>{formatPrice(tax)}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Service Fee</Text>
            <Text style={styles.summaryValue}>{formatPrice(serviceFee)}</Text>
          </View>
          
          {deliveryFee > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery Fee</Text>
              <Text style={styles.summaryValue}>{formatPrice(deliveryFee)}</Text>
            </View>
          )}
          
          <View style={styles.summaryDivider} />
          
          <View style={[styles.summaryRow, styles.totalRow]}>
            <View>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalSubtext}>Including all fees</Text>
            </View>
            <Text style={styles.totalAmount}>{formatPrice(grandTotal)}</Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.checkoutButton} 
            onPress={handleCheckout}
            disabled={isCheckingOut}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#FF6B9D', '#FF8FB1']}
              style={styles.checkoutGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isCheckingOut ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
                  <Feather name="arrow-right" size={18} color="#FFF" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
        
        <View style={styles.footerFeatures}>
          <View style={styles.footerFeature}>
            <MaterialCommunityIcons name="shield-check" size={14} color="#4CAF50" />
            <Text style={styles.footerFeatureText}>Secure payment</Text>
          </View>
          <View style={styles.footerFeature}>
            <MaterialCommunityIcons name="headset" size={14} color="#4CAF50" />
            <Text style={styles.footerFeatureText}>24/7 Support</Text>
          </View>
          <View style={styles.footerFeature}>
            <MaterialCommunityIcons name="refresh" size={14} color="#4CAF50" />
            <Text style={styles.footerFeatureText}>Easy returns</Text>
          </View>
        </View>
      </View>

      {/* Clear Cart Modal */}
      <Modal
        visible={showClearModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClearModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <MaterialCommunityIcons name="alert" size={48} color="#FF3B30" />
            </View>
            <Text style={styles.modalTitle}>Clear Cart?</Text>
            <Text style={styles.modalText}>
              This action will remove all items from your cart. Are you sure you want to continue?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowClearModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalDeleteButton]}
                onPress={confirmClearCart}
              >
                <Text style={styles.modalDeleteText}>Clear All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  clearHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  deliveryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deliveryText: {
    fontSize: 12,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  deliveryWarning: {
    fontSize: 11,
    color: '#FF9800',
    fontWeight: '500',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  statLabel: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E5E5EA',
  },
  cartList: {
    padding: 16,
    paddingBottom: 20,
  },
  separator: {
    height: 8,
  },
  cartItemCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cartItemRemoving: {
    opacity: 0.5,
  },
  itemImageContainer: {
    position: 'relative',
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  quantityBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF6B9D',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  quantityBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dietaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  dietaryText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#4CAF50',
  },
  itemMetaDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#E5E5EA',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#8E8E93',
  },
  itemRightSection: {
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    padding: 4,
    gap: 8,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonDisabled: {
    backgroundColor: '#F5F5F5',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    minWidth: 24,
    textAlign: 'center',
  },
  itemTotalPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF6B9D',
    marginTop: 6,
  },
  swipeContainer: {
    flexDirection: 'row',
    height: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    height: '100%',
  },
  swipeSave: {
    backgroundColor: '#4CAF50',
  },
  swipeDelete: {
    backgroundColor: '#FF3B30',
  },
  swipeActionText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  footer: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 8,
  },
  summarySection: {
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  summarySubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#8E8E93',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 12,
  },
  totalRow: {
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  totalSubtext: {
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 2,
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FF6B9D',
  },
  buttonContainer: {
    gap: 12,
  },
  checkoutButton: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  checkoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  checkoutButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footerFeatures: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 12,
  },
  footerFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerFeatureText: {
    fontSize: 10,
    color: '#8E8E93',
  },
  savedSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  savedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  savedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  savedCount: {
    fontSize: 12,
    color: '#8E8E93',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  savedItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  savedItemImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  savedItemDetails: {
    flex: 1,
    marginLeft: 10,
  },
  savedItemName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  savedItemPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B9D',
  },
  moveToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  moveToCartText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF6B9D',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  emptyGradient: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyIconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  emptyIconPulse: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: '#FF6B9D',
    opacity: 0.2,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  shopButton: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  shopGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 14,
    gap: 8,
  },
  shopButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyFeatures: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 20,
  },
  emptyFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyFeatureText: {
    fontSize: 11,
    color: '#8E8E93',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: width - 40,
    alignItems: 'center',
  },
  modalIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#F5F5F5',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  modalDeleteButton: {
    backgroundColor: '#FF3B30',
  },
  modalDeleteText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default CartScreen;