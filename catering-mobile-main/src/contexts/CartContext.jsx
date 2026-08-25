// src/contexts/CartContext.jsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { cartAPI, apiHelpers } from '../services/api';
import { useAuth } from './AuthContext';

const CartContext = createContext();

const normalizeCartPayload = (payload) => {
  const data = payload?.data?.data || payload?.data || payload || {};
  const items = Array.isArray(data.items) ? data.items : [];

  return items.map((item) => ({
    ...item,
    id: item.menu_item_id || item.id,
    menu_item_id: item.menu_item_id || item.id,
    cart_item_id: item.cart_item_id,
    name: item.name || 'Menu Item',
    price: parseFloat(item.price) || 0,
    quantity: parseInt(item.quantity, 10) || 1,
    image: item.image || item.image_url,
  }));
};

export const CartProvider = ({ children }) => {
  const { isGuest, user, getUserId } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const getCartKey = () => {
    if (isGuest) return '@guest_cart_items';
    const userId = getUserId();
    return userId ? `@cart_items_${userId}` : '@cart_items';
  };

  const isCustomerAccount = () => {
    if (isGuest || !user) return false;
    const role = String(user.role || user.primary_role || user.user_role || '').toLowerCase();
    return Boolean(user.customer_id) || role === 'customer' || role === 'client';
  };

  useEffect(() => {
    loadCart();
  }, [isGuest, user?.id, user?.user_id, user?.customer_id]);

  useEffect(() => {
    if (!isLoading && !isGuest) saveCart();
  }, [cartItems, isLoading, isGuest]);

  const loadCart = async () => {
    try {
      setIsLoading(true);
      const key = getCartKey();

      if (!isCustomerAccount()) {
        setCartItems([]);
        await AsyncStorage.setItem(key, JSON.stringify([]));
        return;
      }

      try {
        const response = await cartAPI.getCart();
        const backendItems = normalizeCartPayload(response);
        setCartItems(backendItems);
        await AsyncStorage.setItem(key, JSON.stringify(backendItems));
        return;
      } catch (backendError) {
        console.log('Cart backend unavailable, using local cache:', backendError?.message || backendError);
      }

      const stored = await AsyncStorage.getItem(key);
      setCartItems(stored ? JSON.parse(stored) : []);
    } catch (error) {
      console.log('Error loading cart:', error);
      setCartItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const saveCart = async () => {
    try {
      if (!isCustomerAccount()) return;
      await AsyncStorage.setItem(getCartKey(), JSON.stringify(cartItems));
    } catch (error) {
      console.log('Error saving cart:', error);
    }
  };

  const syncAdd = async (item, quantity) => {
    const menuItemId = item.menu_item_id || item.id;
    if (!menuItemId) return;

    try {
      const response = await cartAPI.addItem({ menu_item_id: menuItemId, quantity });
      const backendItems = normalizeCartPayload(response);
      if (backendItems.length) setCartItems(backendItems);
    } catch (error) {
      console.log('Error syncing cart add:', apiHelpers.handleError(error));
    }
  };

  const syncUpdate = async (item, quantity) => {
    try {
      if (item.cart_item_id) {
        const response = quantity <= 0
          ? await cartAPI.removeItem(item.cart_item_id)
          : await cartAPI.updateItem(item.cart_item_id, { quantity });
        const backendItems = normalizeCartPayload(response);
        setCartItems(backendItems);
      } else if (quantity > 0) {
        await syncAdd(item, quantity);
      }
    } catch (error) {
      console.log('Error syncing cart update:', apiHelpers.handleError(error));
    }
  };

  const clearUserCart = async (userId) => {
    try {
      await AsyncStorage.removeItem(`@cart_items_${userId}`);
    } catch (error) {
      console.log('Error clearing user cart:', error);
    }
  };

  const clearGuestCart = async () => {
    try {
      await AsyncStorage.removeItem('@guest_cart_items');
    } catch (error) {
      console.log('Error clearing guest cart:', error);
    }
  };

  const addToCart = (item, quantity = 1) => {
    if (!isCustomerAccount()) {
      Alert.alert('Customer Account Required', 'Please login using a customer account to add items to your cart.');
      return;
    }

    const itemId = item.menu_item_id || item.id;
    const normalized = {
      ...item,
      id: itemId,
      menu_item_id: item.menu_item_id || itemId,
      price: parseFloat(item.price) || 0,
    };

    setCartItems(prev => {
      const existing = prev.find(i => (i.menu_item_id || i.id) === itemId);
      if (existing) {
        return prev.map(i => (i.menu_item_id || i.id) === itemId
          ? { ...i, quantity: (parseInt(i.quantity, 10) || 0) + quantity }
          : i
        );
      }
      return [...prev, { ...normalized, quantity }];
    });

    syncAdd(normalized, quantity);
  };

  const updateQuantity = (itemId, delta) => {
    if (!isCustomerAccount()) {
      Alert.alert('Customer Account Required', 'Please login using a customer account to update your cart.');
      return;
    }

    let changedItem = null;
    let nextQuantity = 0;

    setCartItems(prev => prev.map(item => {
      if ((item.menu_item_id || item.id) === itemId || item.id === itemId) {
        nextQuantity = (parseInt(item.quantity, 10) || 0) + delta;
        changedItem = item;
        if (nextQuantity <= 0) return null;
        return { ...item, quantity: nextQuantity };
      }
      return item;
    }).filter(Boolean));

    if (changedItem) syncUpdate(changedItem, nextQuantity);
  };

  const removeItem = (itemId) => {
    if (!isCustomerAccount()) {
      Alert.alert('Customer Account Required', 'Please login using a customer account to remove items from your cart.');
      return;
    }

    const item = cartItems.find(i => (i.menu_item_id || i.id) === itemId || i.id === itemId);
    setCartItems(prev => prev.filter(i => (i.menu_item_id || i.id) !== itemId && i.id !== itemId));
    if (item) syncUpdate(item, 0);
  };

  const clearCart = () => {
    if (!isCustomerAccount()) {
      Alert.alert('Customer Account Required', 'Please login using a customer account to clear your cart.');
      return;
    }

    setCartItems([]);
    cartAPI.clearCart().catch(error => console.log('Error clearing backend cart:', error));
  };

  const getCartCount = () => !isCustomerAccount() ? 0 : cartItems.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 0), 0);
  const getTotalAmount = () => !isCustomerAccount() ? 0 : cartItems.reduce((sum, item) => sum + ((parseFloat(item.price) || 0) * (parseInt(item.quantity, 10) || 0)), 0);
  const isItemInCart = (itemId) => isCustomerAccount() && cartItems.some(item => (item.menu_item_id || item.id) === itemId || item.id === itemId);
  const getItemQuantity = (itemId) => {
    if (!isCustomerAccount()) return 0;
    const item = cartItems.find(i => (i.menu_item_id || i.id) === itemId || i.id === itemId);
    return item ? (parseInt(item.quantity, 10) || 0) : 0;
  };

  const transferGuestCartToUser = async (userId) => {
    try {
      if (!userId) return false;
      const guestCart = await AsyncStorage.getItem('@guest_cart_items');
      if (!guestCart) return false;
      const guestItems = JSON.parse(guestCart);
      if (!guestItems.length) return false;
      await AsyncStorage.setItem(`@cart_items_${userId}`, guestCart);
      await AsyncStorage.removeItem('@guest_cart_items');
      setCartItems(guestItems);
      return true;
    } catch (error) {
      console.log('Error transferring guest cart:', error);
      return false;
    }
  };

  const value = {
    cartItems,
    isLoading,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
    getCartCount,
    getTotalAmount,
    isItemInCart,
    getItemQuantity,
    clearUserCart,
    clearGuestCart,
    transferGuestCartToUser,
    getCartKey,
    reloadCart: loadCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
