// src/screens/MenuScreen.jsx
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useTheme } from '../contexts/ThemeContext';
import { categoryService } from '../services/categoryService';
import { menuService } from '../services/menuService';
import { packageService } from '../services/packageService';
import { promotionService } from '../services/promotionService';
import { getRandomBannerImage, getThemedBannerImage } from '../utils/imageHelper';

// Safe width with fallback
const SCREEN_WIDTH = Dimensions.get('window')?.width || 375;

const MenuScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { isGuest } = useAuth();
  const { addToCart, getItemQuantity, cartItems, removeFromCart, updateQuantity } = useCart();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [packages, setPackages] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTab, setSelectedTab] = useState('menu');
  const [sortBy, setSortBy] = useState('popular');
  const [showFilters, setShowFilters] = useState(false);
  const [imageErrors, setImageErrors] = useState({});
  const [favorites, setFavorites] = useState([]);
  const [viewMode, setViewMode] = useState('grid');
  
  // Detail modals
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [packageItems, setPackageItems] = useState([]);
  const [loadingPackageItems, setLoadingPackageItems] = useState(false);
  
  // Custom alert modal
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    icon: null,
    confirmText: 'OK',
    cancelText: 'Cancel',
    onConfirm: null,
    onCancel: null,
    type: 'info' // 'info', 'success', 'warning', 'error'
  });
  
  const scrollY = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef(null);
  const categoryScrollRef = useRef(null);
  const [categoryScrollOffset, setCategoryScrollOffset] = useState(0);
  const [categoryContentWidth, setCategoryContentWidth] = useState(0);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading menu data...');
      
      // Load categories
      const categoriesResult = await categoryService.getPublicCategories();
      if (categoriesResult.success) {
        const cats = categoriesResult.data || [];
        const formattedCats = cats.map(cat => ({
          ...cat,
          category_id: cat.category_id || cat.id,
        }));
        setCategories([{ category_id: 'all', name: 'All' }, ...formattedCats]);
        console.log(`✅ Loaded ${formattedCats.length} categories`);
      }
      
      // Load menu items
      const menuResult = await menuService.getPublicMenuItems({ is_available: true });
      if (menuResult.success) {
        setMenuItems(menuResult.data || []);
        console.log(`✅ Loaded ${menuResult.data?.length || 0} menu items`);
      }
      
      // Load packages
      const packageResult = await packageService.getPublicPackages();
      if (packageResult.success) {
        setPackages(packageResult.data || []);
        console.log(`✅ Loaded ${packageResult.data?.length || 0} packages`);
      }
      
      // Load promotions
      const promoResult = await promotionService.getPublicPromotions();
      if (promoResult.success) {
        setPromotions(promoResult.data || []);
        console.log(`✅ Loaded ${promoResult.data?.length || 0} promotions`);
      }
    } catch (error) {
      console.error('❌ Error loading menu:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const getThemedImage = (name) => {
    const nameLower = name?.toLowerCase() || '';
    if (nameLower.includes('wedding')) {
      return 'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=400&fit=crop';
    }
    if (nameLower.includes('birthday')) {
      return 'https://images.unsplash.com/photo-1555244162-803834f70033?w=400&h=400&fit=crop';
    }
    if (nameLower.includes('corporate') || nameLower.includes('company')) {
      return 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=400&h=400&fit=crop';
    }
    return 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=400&fit=crop';
  };

  // Filter menu items
  const filteredMenuItems = menuItems.filter(item => {
    const matchesSearch = item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || 
                           item.category_id === parseInt(selectedCategory) || 
                           item.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Filter packages
  const filteredPackages = packages.filter(item => {
    return item.name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Filter promotions
  const filteredPromotions = promotions.filter(item => {
    return item.name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Sort items
  const sortedItems = [...filteredMenuItems].sort((a, b) => {
    switch(sortBy) {
      case 'popular':
        return (b.is_popular ? 1 : 0) - (a.is_popular ? 1 : 0);
      case 'price_low':
        return (a.price || 0) - (b.price || 0);
      case 'price_high':
        return (b.price || 0) - (a.price || 0);
      case 'rating':
        return (b.rating || 0) - (a.rating || 0);
      default:
        return 0;
    }
  });

  const renderStars = (rating, size = 14) => {
    const stars = [];
    const fullStars = Math.floor(rating || 0);
    const hasHalfStar = (rating || 0) % 1 >= 0.5;
    
    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        stars.push(
          <Ionicons key={`star-${i}`} name="star" size={size} color="#FFB800" />
        );
      } else if (i === fullStars + 1 && hasHalfStar) {
        stars.push(
          <Ionicons key={`star-${i}`} name="star-half" size={size} color="#FFB800" />
        );
      } else {
        stars.push(
          <Ionicons key={`star-${i}`} name="star-outline" size={size} color="#ccc" />
        );
      }
    }
    return <View style={styles.starsRow}>{stars}</View>;
  };

  const handleImageError = (itemId) => {
    setImageErrors(prev => ({ ...prev, [itemId]: true }));
  };

  const toggleFavorite = (itemId) => {
    setFavorites(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Open menu item detail modal
  const openMenuItemDetail = (item) => {
    setSelectedMenuItem(item);
  };

  // Close menu item detail modal
  const closeMenuItemDetail = () => {
    setSelectedMenuItem(null);
  };

  // Open package detail modal
  const openPackageDetail = async (pkg) => {
    setSelectedPackage(pkg);
    setLoadingPackageItems(true);
    
    try {
      // Fetch package items from the backend
      const packageId = pkg.package_id || pkg.id;
      const result = await packageService.getPackageItems(packageId);
      
      if (result.success) {
        setPackageItems(result.data || []);
        console.log(`✅ Loaded ${result.data?.length || 0} items for package ${packageId}`);
      } else {
        console.warn('⚠️ No items found for package:', packageId);
        setPackageItems([]);
      }
    } catch (error) {
      console.error('❌ Error loading package items:', error);
      setPackageItems([]);
    } finally {
      setLoadingPackageItems(false);
    }
  };

  // Close package detail modal
  const closePackageDetail = () => {
    setSelectedPackage(null);
    setPackageItems([]);
  };

  // Custom Alert Modal
  const showCustomAlert = (config) => {
    setAlertConfig({
      ...config,
      onConfirm: config.onConfirm || null,
      onCancel: config.onCancel || null,
    });
    setAlertVisible(true);
  };

  const closeAlert = () => {
    setAlertVisible(false);
    setAlertConfig({
      title: '',
      message: '',
      icon: null,
      confirmText: 'OK',
      cancelText: 'Cancel',
      onConfirm: null,
      onCancel: null,
      type: 'info'
    });
  };

  const handleAlertConfirm = () => {
    if (alertConfig.onConfirm) {
      alertConfig.onConfirm();
    }
    closeAlert();
  };

  const handleAlertCancel = () => {
    if (alertConfig.onCancel) {
      alertConfig.onCancel();
    }
    closeAlert();
  };

  // Get icon for alert type
  const getAlertIcon = (type) => {
    switch(type) {
      case 'success':
        return <Ionicons name="checkmark-circle" size={56} color="#4CAF50" />;
      case 'warning':
        return <Ionicons name="warning" size={56} color="#FF9800" />;
      case 'error':
        return <Ionicons name="close-circle" size={56} color="#F44336" />;
      default:
        return <Ionicons name="information-circle" size={56} color="#2196F3" />;
    }
  };

  // Get colors for alert type
  const getAlertColors = (type) => {
    switch(type) {
      case 'success':
        return { main: '#4CAF50', light: '#E8F5E9' };
      case 'warning':
        return { main: '#FF9800', light: '#FFF3E0' };
      case 'error':
        return { main: '#F44336', light: '#FFEBEE' };
      default:
        return { main: '#2196F3', light: '#E3F2FD' };
    }
  };

  // Add to cart function with validation using custom modal
  const handleAddToCart = (item, fromModal = false) => {
    if (isGuest) {
      showCustomAlert({
        title: 'Guest Mode',
        message: 'Please login to add items to your cart',
        icon: 'lock',
        confirmText: 'Login',
        cancelText: 'Cancel',
        type: 'warning',
        onConfirm: () => navigation.navigate('Login')
      });
      return;
    }
    
    const itemId = item.menu_item_id || item.id;
    const currentQuantity = getItemQuantity(itemId);
    
    // Check if item already exists in cart
    if (currentQuantity > 0) {
      showCustomAlert({
        title: 'Item Already in Cart',
        message: `${item.name} is already in your cart (${currentQuantity} item${currentQuantity > 1 ? 's' : ''}). Would you like to add another?`,
        icon: 'cart',
        confirmText: 'Add Another',
        cancelText: 'Cancel',
        type: 'warning',
        onConfirm: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          addToCart({
            id: itemId,
            name: item.name,
            price: item.price,
            image: item.image_url || item.image,
          }, 1);
          showCustomAlert({
            title: 'Added to Cart',
            message: `${item.name} has been added to your cart.`,
            icon: 'checkmark',
            confirmText: 'OK',
            type: 'success'
          });
        }
      });
      return;
    }
    
    // Add new item
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addToCart({
      id: itemId,
      name: item.name,
      price: item.price,
      image: item.image_url || item.image,
    }, 1);
    
    showCustomAlert({
      title: 'Added to Cart',
      message: `${item.name} has been added to your cart.`,
      icon: 'checkmark',
      confirmText: 'Continue Shopping',
      type: 'success'
    });
  };

  // Remove from cart
  const handleRemoveFromCart = (itemId, itemName) => {
    showCustomAlert({
      title: 'Remove from Cart',
      message: `Are you sure you want to remove ${itemName} from your cart?`,
      icon: 'trash',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      type: 'warning',
      onConfirm: () => {
        removeFromCart(itemId);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        showCustomAlert({
          title: 'Removed',
          message: `${itemName} has been removed from your cart.`,
          icon: 'checkmark',
          confirmText: 'OK',
          type: 'success'
        });
      }
    });
  };

  // Grid View Menu Item with cart button outside modal
  const GridMenuItem = ({ item }) => {
    const imageUrl = imageErrors[item.id] 
      ? getRandomBannerImage()
      : (item.image_url || item.image || getRandomBannerImage());
    
    const isFavorite = favorites.includes(item.menu_item_id || item.id);
    const cartQuantity = getItemQuantity(item.menu_item_id || item.id);
    const itemId = item.menu_item_id || item.id;

    return (
      <TouchableOpacity 
        activeOpacity={0.9}
        style={[styles.gridCard, { backgroundColor: colors.card }]}
        onPress={() => openMenuItemDetail(item)}
      >
        <View style={styles.gridImageContainer}>
          <Image source={{ uri: imageUrl }} style={styles.gridImage} />
          {item.is_popular && (
            <View style={styles.gridPopularBadge}>
              <MaterialCommunityIcons name="fire" size={10} color="#FF6B9D" />
              <Text style={styles.gridPopularText}>Popular</Text>
            </View>
          )}
          {item.discounted_price && (
            <View style={styles.gridDiscountBadge}>
              <Text style={styles.gridDiscountText}>
                {Math.round((1 - item.discounted_price / item.price) * 100)}% OFF
              </Text>
            </View>
          )}
          {/* Heart button */}
          <TouchableOpacity 
            style={styles.gridFavoriteButton}
            onPress={() => toggleFavorite(itemId)}
          >
            <Ionicons 
              name={isFavorite ? 'heart' : 'heart-outline'} 
              size={18} 
              color={isFavorite ? '#FF6B9D' : '#fff'} 
            />
          </TouchableOpacity>
          {/* Cart button outside modal */}
          <TouchableOpacity 
            style={[styles.gridCartButton, cartQuantity > 0 && styles.gridCartButtonActive]}
            onPress={() => handleAddToCart(item)}
          >
            {cartQuantity > 0 ? (
              <View style={styles.gridCartQuantity}>
                <Feather name="shopping-bag" size={14} color="#fff" />
                <Text style={styles.gridCartQuantityText}>{cartQuantity}</Text>
              </View>
            ) : (
              <Feather name="shopping-bag" size={16} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
        
        <View style={styles.gridInfo}>
          <Text style={[styles.gridName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
          <View style={styles.gridRating}>
            {renderStars(item.rating || 0, 12)}
            <Text style={styles.gridRatingText}>({item.rating || 0})</Text>
          </View>
          <View style={styles.gridPriceRow}>
            <View>
              {item.discounted_price ? (
                <View style={styles.gridPriceContainer}>
                  <Text style={styles.gridOriginalPrice}>₱{item.price}</Text>
                  <Text style={styles.gridPrice}>₱{item.discounted_price}</Text>
                </View>
              ) : (
                <Text style={styles.gridPrice}>₱{item.price}</Text>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // List View Menu Item with cart button outside modal
  const ListMenuItem = ({ item }) => {
    const imageUrl = imageErrors[item.id] 
      ? getRandomBannerImage()
      : (item.image_url || item.image || getRandomBannerImage());
    
    const isFavorite = favorites.includes(item.menu_item_id || item.id);
    const cartQuantity = getItemQuantity(item.menu_item_id || item.id);
    const itemId = item.menu_item_id || item.id;

    return (
      <TouchableOpacity 
        activeOpacity={0.9}
        style={[styles.listCard, { backgroundColor: colors.card }]}
        onPress={() => openMenuItemDetail(item)}
      >
        <View style={styles.listImageContainer}>
          <Image source={{ uri: imageUrl }} style={styles.listImage} />
          {item.is_popular && (
            <View style={styles.listPopularBadge}>
              <MaterialCommunityIcons name="fire" size={10} color="#FF6B9D" />
              <Text style={styles.listPopularText}>Popular</Text>
            </View>
          )}
          {/* Cart button outside modal - List view */}
          <TouchableOpacity 
            style={[styles.listCartButton, cartQuantity > 0 && styles.listCartButtonActive]}
            onPress={() => handleAddToCart(item)}
          >
            {cartQuantity > 0 ? (
              <View style={styles.listCartQuantity}>
                <Feather name="shopping-bag" size={12} color="#fff" />
                <Text style={styles.listCartQuantityText}>{cartQuantity}</Text>
              </View>
            ) : (
              <Feather name="shopping-bag" size={14} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
        
        <View style={styles.listInfo}>
          <View style={styles.listHeader}>
            <Text style={[styles.listName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
            <TouchableOpacity onPress={() => toggleFavorite(itemId)}>
              <Ionicons 
                name={isFavorite ? 'heart' : 'heart-outline'} 
                size={20} 
                color={isFavorite ? '#FF6B9D' : '#ccc'} 
              />
            </TouchableOpacity>
          </View>
          
          <Text style={[styles.listDescription, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.description || 'Delicious dish prepared with love'}
          </Text>
          
          <View style={styles.listMeta}>
            <View style={styles.listMetaItem}>
              <Feather name="clock" size={12} color="#B0B0B0" />
              <Text style={styles.listMetaText}>{item.prep_time_minutes || 0} min</Text>
            </View>
            <View style={styles.listMetaItem}>
              {renderStars(item.rating || 0, 12)}
            </View>
          </View>
          
          <View style={styles.listPriceRow}>
            <View>
              {item.discounted_price ? (
                <View style={styles.listPriceContainer}>
                  <Text style={styles.listOriginalPrice}>₱{item.price}</Text>
                  <Text style={styles.listPrice}>₱{item.discounted_price}</Text>
                </View>
              ) : (
                <Text style={styles.listPrice}>₱{item.price}</Text>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Package Card
  const PackageCard = ({ item }) => {
    const imageUrl = getThemedBannerImage(item.name);
    
    return (
      <TouchableOpacity 
        activeOpacity={0.9}
        style={[styles.packageCard, { backgroundColor: colors.card }]}
        onPress={() => openPackageDetail(item)}
      >
        <Image source={{ uri: imageUrl }} style={styles.packageImage} />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.packageOverlay}
        >
          <Text style={styles.packageName}>{item.name}</Text>
          <Text style={styles.packagePrice}>₱{item.base_price_per_pax || 0}/pax</Text>
          <View style={styles.packageFeatures}>
            <Text style={styles.packageFeature}>{item.min_pax || 0} - {item.max_pax || 0} pax</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  // Promotion Card
  const PromotionCard = ({ item }) => {
    return (
      <TouchableOpacity 
        activeOpacity={0.9}
        style={[styles.promotionCard, { backgroundColor: colors.card }]}
        onPress={() => navigation.navigate('PromotionDetail', { promotionId: item.promotion_id || item.id })}
      >
        <Image 
          source={{ uri: getRandomBannerImage() }} 
          style={styles.promotionImage}
        />
        <View style={styles.promotionInfo}>
          <View style={styles.promotionDiscountBadge}>
            <Text style={styles.promotionDiscountText}>
              {item.discount_type === 'percentage' ? `${item.discount_value}% OFF` : `₱${item.discount_value} OFF`}
            </Text>
          </View>
          <Text style={[styles.promotionName, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.promotionDescription, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.description || 'Special promotion available now'}
          </Text>
          <Text style={styles.promotionValidity}>
            Valid until: {item.valid_until ? new Date(item.valid_until).toLocaleDateString() : 'Ongoing'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Category Item with improved design
  const CategoryItem = ({ item, isSelected, onPress }) => (
    <TouchableOpacity
      style={[
        styles.categoryItem,
        isSelected && styles.categoryItemActive,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text 
        style={[
          styles.categoryName,
          { color: isSelected ? '#FFF' : colors.textSecondary }
        ]}
      >
        {typeof item.name === 'string' ? item.name : item.name?.name || 'Category'}
      </Text>
      {isSelected && <View style={styles.categoryActiveIndicator} />}
    </TouchableOpacity>
  );

  // Enhanced Tab Item - WITHOUT pink underline
  const TabItem = ({ label, value, isSelected, onPress }) => (
    <TouchableOpacity
      style={[
        styles.tabItem,
        isSelected && styles.tabItemActive
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.tabLabel,
        { color: isSelected ? '#FF6B9D' : colors.textSecondary }
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const HeaderComponent = () => {
    // Calculate if categories can scroll (safe check)
    const canScrollLeft = categoryScrollOffset > 10;
    const canScrollRight = categoryContentWidth > 0 && categoryScrollOffset < categoryContentWidth - SCREEN_WIDTH + 40;

    return (
      <View style={styles.headerContainer}>
        <View style={styles.heroSection}>
          <View>
            <Text style={styles.heroTitle}>Our Menu</Text>
            <Text style={styles.heroSubtitle}>Discover our signature dishes</Text>
          </View>
        </View>

        <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
          <Feather name="search" size={20} color="#B0B0B0" />
          <TextInput
            ref={searchInputRef}
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search..."
            placeholderTextColor="#B0B0B0"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={20} color="#B0B0B0" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setShowFilters(true)}>
            <Feather name="sliders" size={20} color="#FF6B9D" />
          </TouchableOpacity>
        </View>

        {/* Enhanced Tabs - WITHOUT pink underline */}
        <View style={styles.tabsContainer}>
          <TabItem
            label="Menu"
            value="menu"
            isSelected={selectedTab === 'menu'}
            onPress={() => setSelectedTab('menu')}
          />
          <TabItem
            label="Packages"
            value="packages"
            isSelected={selectedTab === 'packages'}
            onPress={() => setSelectedTab('packages')}
          />
          <TabItem
            label="Promotions"
            value="promotions"
            isSelected={selectedTab === 'promotions'}
            onPress={() => setSelectedTab('promotions')}
          />
        </View>

        {/* Categories with scroll indicators */}
        {selectedTab === 'menu' && categories.length > 0 && (
          <View style={styles.categoriesWrapper}>
            <View style={styles.categoriesContainer}>
              {/* Left scroll indicator */}
              {canScrollLeft && (
                <View style={[styles.scrollIndicator, styles.scrollIndicatorLeft]}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']}
                    style={styles.scrollIndicatorGradient}
                  >
                    <Feather name="chevron-left" size={16} color="#FF6B9D" />
                  </LinearGradient>
                </View>
              )}
              
              <FlatList
                ref={categoryScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                data={categories}
                keyExtractor={(item, index) => {
                  const rawId = item.category_id || item.id;
                  return `category-${rawId && typeof rawId !== 'object' ? rawId : index}`;
                }}
                contentContainerStyle={styles.categoriesList}
                renderItem={({ item, index }) => {
                  const rawId = item.category_id || item.id;
                  const categoryId = rawId && typeof rawId !== 'object' ? rawId : (index === 0 ? 'all' : `category-${index}`);
                  return (
                    <CategoryItem
                      item={item}
                      isSelected={selectedCategory === categoryId}
                      onPress={() => setSelectedCategory(categoryId)}
                    />
                  );
                }}
                onScroll={(event) => {
                  const offsetX = event.nativeEvent.contentOffset.x;
                  setCategoryScrollOffset(offsetX);
                }}
                onContentSizeChange={(contentWidth) => {
                  setCategoryContentWidth(contentWidth);
                }}
                scrollEventThrottle={16}
              />
              
              {/* Right scroll indicator */}
              {canScrollRight && (
                <View style={[styles.scrollIndicator, styles.scrollIndicatorRight]}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.9)']}
                    style={styles.scrollIndicatorGradient}
                  >
                    <Feather name="chevron-right" size={16} color="#FF6B9D" />
                  </LinearGradient>
                </View>
              )}
            </View>
          </View>
        )}

        {selectedTab === 'menu' && filteredMenuItems.length > 0 && (
          <View style={styles.resultInfo}>
            <Text style={styles.resultCount}>{filteredMenuItems.length} items found</Text>
            <View style={styles.viewToggle}>
              <TouchableOpacity
                style={[styles.viewToggleButton, viewMode === 'grid' && styles.viewToggleActive]}
                onPress={() => setViewMode('grid')}
              >
                <Feather name="grid" size={16} color={viewMode === 'grid' ? '#FF6B9D' : '#B0B0B0'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewToggleButton, viewMode === 'list' && styles.viewToggleActive]}
                onPress={() => setViewMode('list')}
              >
                <Feather name="list" size={16} color={viewMode === 'list' ? '#FF6B9D' : '#B0B0B0'} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {(selectedTab === 'packages' && filteredPackages.length > 0) && (
          <View style={styles.resultInfo}>
            <Text style={styles.resultCount}>{filteredPackages.length} packages found</Text>
          </View>
        )}

        {(selectedTab === 'promotions' && filteredPromotions.length > 0) && (
          <View style={styles.resultInfo}>
            <Text style={styles.resultCount}>{filteredPromotions.length} promotions found</Text>
          </View>
        )}
      </View>
    );
  };

  // Custom Alert Modal Component
  const CustomAlertModal = () => {
    const colors = getAlertColors(alertConfig.type);
    
    return (
      <Modal
        visible={alertVisible}
        transparent
        animationType="fade"
        onRequestClose={closeAlert}
      >
        <View style={styles.alertOverlay}>
          <View style={[styles.alertContainer, { backgroundColor: '#fff' }]}>
            {/* Icon */}
            <View style={[styles.alertIconContainer, { backgroundColor: colors.light }]}>
              {alertConfig.icon === 'checkmark' ? (
                <Ionicons name="checkmark-circle" size={56} color={colors.main} />
              ) : alertConfig.icon === 'warning' ? (
                <Ionicons name="warning" size={56} color={colors.main} />
              ) : alertConfig.icon === 'error' ? (
                <Ionicons name="close-circle" size={56} color={colors.main} />
              ) : alertConfig.icon === 'lock' ? (
                <Ionicons name="lock-closed" size={56} color={colors.main} />
              ) : alertConfig.icon === 'cart' ? (
                <Ionicons name="cart" size={56} color={colors.main} />
              ) : alertConfig.icon === 'trash' ? (
                <Ionicons name="trash" size={56} color={colors.main} />
              ) : (
                <Ionicons name="information-circle" size={56} color={colors.main} />
              )}
            </View>

            {/* Title */}
            <Text style={[styles.alertTitle, { color: '#333' }]}>
              {alertConfig.title}
            </Text>

            {/* Message */}
            <Text style={[styles.alertMessage, { color: '#666' }]}>
              {alertConfig.message}
            </Text>

            {/* Buttons */}
            <View style={styles.alertButtons}>
              {alertConfig.cancelText && (
                <TouchableOpacity
                  style={[styles.alertButton, styles.alertCancelButton]}
                  onPress={handleAlertCancel}
                >
                  <Text style={[styles.alertButtonText, { color: '#666' }]}>
                    {alertConfig.cancelText}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.alertButton, styles.alertConfirmButton, { backgroundColor: colors.main }]}
                onPress={handleAlertConfirm}
              >
                <Text style={[styles.alertButtonText, { color: '#fff' }]}>
                  {alertConfig.confirmText}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Menu Item Detail Modal with Add to Cart inside
  const MenuItemDetailModal = () => {
    if (!selectedMenuItem) return null;

    const item = selectedMenuItem;
    const imageUrl = imageErrors[item.id] 
      ? getRandomBannerImage()
      : (item.image_url || item.image || getRandomBannerImage());

    // Format dietary information
    const dietaryInfo = item.dietary_info || item.dietary_information || item.dietary;
    const allergyInfo = item.allergy_info || item.allergy_information || item.allergies || item.food_allergy;
    
    // Get pax info from description or other fields
    const paxInfo = item.good_for || item.pax_info || '';
    const cartQuantity = getItemQuantity(item.menu_item_id || item.id);

    return (
      <Modal
        visible={!!selectedMenuItem}
        transparent
        animationType="slide"
        onRequestClose={closeMenuItemDetail}
      >
        <View style={styles.detailModalOverlay}>
          <View style={[styles.detailModalContent, { backgroundColor: colors.background }]}>
            {/* Close button */}
            <TouchableOpacity style={styles.detailCloseButton} onPress={closeMenuItemDetail}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {/* Image */}
              <View style={styles.detailImageContainer}>
                <Image source={{ uri: imageUrl }} style={styles.detailImage} />
                {item.is_popular && (
                  <View style={styles.detailPopularBadge}>
                    <MaterialCommunityIcons name="fire" size={14} color="#FF6B9D" />
                    <Text style={styles.detailPopularText}>Popular</Text>
                  </View>
                )}
              </View>

              {/* Content */}
              <View style={styles.detailContent}>
                <Text style={[styles.detailName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.detailPrice, { color: '#FF6B9D' }]}>
                  ₱{item.discounted_price || item.price}
                </Text>
                {item.discounted_price && (
                  <Text style={styles.detailOriginalPrice}>₱{item.price}</Text>
                )}

                {/* Description */}
                <View style={styles.detailSection}>
                  <Text style={[styles.detailSectionTitle, { color: colors.text }]}>Description</Text>
                  <Text style={[styles.detailDescription, { color: colors.textSecondary }]}>
                    {item.description || 'No description available.'}
                  </Text>
                  {paxInfo && (
                    <Text style={[styles.detailPaxInfo, { color: '#FF6B9D' }]}>
                      {paxInfo}
                    </Text>
                  )}
                </View>

                {/* Dietary Information */}
                <View style={styles.detailSection}>
                  <Text style={[styles.detailSectionTitle, { color: colors.text }]}>Dietary</Text>
                  {dietaryInfo ? (
                    <View style={styles.detailDietaryContainer}>
                      {typeof dietaryInfo === 'string' ? (
                        <View style={styles.detailDietaryTag}>
                          <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                          <Text style={styles.detailDietaryText}>{dietaryInfo}</Text>
                        </View>
                      ) : Array.isArray(dietaryInfo) ? (
                        dietaryInfo.map((diet, index) => (
                          <View key={index} style={styles.detailDietaryTag}>
                            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                            <Text style={styles.detailDietaryText}>{diet}</Text>
                          </View>
                        ))
                      ) : (
                        <Text style={[styles.detailFallback, { color: colors.textSecondary }]}>
                          Not specified
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Text style={[styles.detailFallback, { color: colors.textSecondary }]}>
                      Not specified
                    </Text>
                  )}
                </View>

                {/* Food Allergy Information */}
                <View style={styles.detailSection}>
                  <Text style={[styles.detailSectionTitle, { color: colors.text }]}>Food Allergy</Text>
                  {allergyInfo ? (
                    <View style={styles.detailAllergyContainer}>
                      {typeof allergyInfo === 'string' ? (
                        <View style={styles.detailAllergyTag}>
                          <Ionicons name="warning" size={16} color="#FF4444" />
                          <Text style={styles.detailAllergyText}>{allergyInfo}</Text>
                        </View>
                      ) : Array.isArray(allergyInfo) ? (
                        allergyInfo.map((allergy, index) => (
                          <View key={index} style={styles.detailAllergyTag}>
                            <Ionicons name="warning" size={16} color="#FF4444" />
                            <Text style={styles.detailAllergyText}>{allergy}</Text>
                          </View>
                        ))
                      ) : (
                        <Text style={[styles.detailFallback, { color: colors.textSecondary }]}>
                          No information available
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Text style={[styles.detailFallback, { color: colors.textSecondary }]}>
                      No information available
                    </Text>
                  )}
                </View>

                {/* Add to Cart Button inside Modal */}
                <View style={styles.detailAddToCartWrapper}>
                  {cartQuantity > 0 && (
                    <View style={styles.detailCartQuantityInfo}>
                      <Ionicons name="cart" size={20} color="#4CAF50" />
                      <Text style={styles.detailCartQuantityText}>
                        {cartQuantity} in cart
                      </Text>
                      <TouchableOpacity 
                        onPress={() => handleRemoveFromCart(item.menu_item_id || item.id, item.name)}
                        style={styles.detailRemoveButton}
                      >
                        <Ionicons name="close-circle" size={20} color="#F44336" />
                      </TouchableOpacity>
                    </View>
                  )}
                  
                  <TouchableOpacity
                    style={[
                      styles.detailAddToCartButton,
                      cartQuantity > 0 && styles.detailAddToCartButtonActive
                    ]}
                    onPress={() => handleAddToCart(item, true)}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={cartQuantity > 0 ? ['#4CAF50', '#66BB6A'] : ['#FF6B9D', '#FF8FB1']}
                      style={styles.detailAddToCartGradient}
                    >
                      <Feather name={cartQuantity > 0 ? "check" : "shopping-bag"} size={20} color="#fff" />
                      <Text style={styles.detailAddToCartText}>
                        {cartQuantity > 0 ? 'Add Another' : 'Add to Cart'}
                      </Text>
                      <Text style={styles.detailAddToCartPrice}>₱{item.discounted_price || item.price}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // Package Detail Modal
  const PackageDetailModal = () => {
    if (!selectedPackage) return null;

    const pkg = selectedPackage;

    return (
      <Modal
        visible={!!selectedPackage}
        transparent
        animationType="slide"
        onRequestClose={closePackageDetail}
      >
        <View style={styles.detailModalOverlay}>
          <View style={[styles.detailModalContent, { backgroundColor: colors.background }]}>
            {/* Close button */}
            <TouchableOpacity style={styles.detailCloseButton} onPress={closePackageDetail}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {/* Package Header */}
              <View style={styles.packageDetailHeader}>
                <Image 
                  source={{ uri: getThemedBannerImage(pkg.name) }} 
                  style={styles.packageDetailImage}
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.6)']}
                  style={styles.packageDetailOverlay}
                >
                  <Text style={styles.packageDetailName}>{pkg.name}</Text>
                  <Text style={styles.packageDetailPrice}>₱{pkg.base_price_per_pax || 0}/pax</Text>
                  <Text style={styles.packageDetailPax}>
                    {pkg.min_pax || 0} - {pkg.max_pax || 0} persons
                  </Text>
                </LinearGradient>
              </View>

              <View style={styles.detailContent}>
                {/* Description */}
                <View style={styles.detailSection}>
                  <Text style={[styles.detailSectionTitle, { color: colors.text }]}>Description</Text>
                  <Text style={[styles.detailDescription, { color: colors.textSecondary }]}>
                    {pkg.description || 'No description available.'}
                  </Text>
                  {/* Pax info for package */}
                  {(pkg.min_pax || pkg.max_pax) && (
                    <Text style={[styles.detailPaxInfo, { color: '#FF6B9D' }]}>
                      Good for {pkg.min_pax || 0} - {pkg.max_pax || 0} persons
                    </Text>
                  )}
                </View>

                {/* Included Menu Items */}
                <View style={styles.detailSection}>
                  <Text style={[styles.detailSectionTitle, { color: colors.text }]}>
                    Included Menu Items
                  </Text>
                  
                  {loadingPackageItems ? (
                    <View style={styles.packageItemsLoader}>
                      <ActivityIndicator size="small" color="#FF6B9D" />
                      <Text style={[styles.packageItemsLoaderText, { color: colors.textSecondary }]}>
                        Loading items...
                      </Text>
                    </View>
                  ) : packageItems.length > 0 ? (
                    <View style={styles.packageItemsList}>
                      {packageItems.map((item, index) => {
                        const menuItem = item.menu_item || item;
                        const itemId = menuItem.menu_item_id || menuItem.id;
                        const imageUrl = imageErrors[itemId] 
                          ? getRandomBannerImage()
                          : (menuItem.image_url || menuItem.image || getRandomBannerImage());
                        
                        const dietaryInfo = menuItem.dietary_info || menuItem.dietary_information || menuItem.dietary;
                        const allergyInfo = menuItem.allergy_info || menuItem.allergy_information || menuItem.allergies || menuItem.food_allergy;

                        return (
                          <View key={index} style={[styles.packageMenuItem, { borderBottomColor: colors.border || '#eee' }]}>
                            <View style={styles.packageMenuItemHeader}>
                              <Image source={{ uri: imageUrl }} style={styles.packageMenuItemImage} />
                              <View style={styles.packageMenuItemInfo}>
                                <Text style={[styles.packageMenuItemName, { color: colors.text }]}>
                                  {menuItem.name || 'Menu Item'}
                                </Text>
                                <Text style={[styles.packageMenuItemPrice, { color: '#FF6B9D' }]}>
                                  ₱{menuItem.discounted_price || menuItem.price || 0}
                                </Text>
                              </View>
                            </View>
                            
                            {menuItem.description && (
                              <Text style={[styles.packageMenuItemDescription, { color: colors.textSecondary }]}>
                                {menuItem.description}
                              </Text>
                            )}
                            
                            <View style={styles.packageMenuItemTags}>
                              <View style={styles.packageMenuItemTag}>
                                <Ionicons name="restaurant-outline" size={12} color="#B0B0B0" />
                                <Text style={styles.packageMenuItemTagText}>
                                  Dietary: {dietaryInfo || 'Not specified'}
                                </Text>
                              </View>
                              <View style={[styles.packageMenuItemTag, styles.packageMenuItemAllergyTag]}>
                                <Ionicons name="warning-outline" size={12} color="#FF6B9D" />
                                <Text style={[styles.packageMenuItemTagText, styles.packageMenuItemAllergyText]}>
                                  Allergy: {allergyInfo || 'No information'}
                                </Text>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={[styles.detailFallback, { color: colors.textSecondary }]}>
                      No items included in this package.
                    </Text>
                  )}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // Filter Modal
  const FilterModal = () => (
    <Modal
      visible={showFilters}
      transparent
      animationType="slide"
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Filter & Sort</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Feather name="x" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: colors.text }]}>Sort By</Text>
              <View style={styles.sortOptions}>
                {['popular', 'price_low', 'price_high', 'rating'].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.sortOption,
                      sortBy === option && styles.sortOptionActive
                    ]}
                    onPress={() => setSortBy(option)}
                  >
                    <Text style={[
                      styles.sortOptionText,
                      sortBy === option && styles.sortOptionTextActive
                    ]}>
                      {option === 'popular' && 'Popular'}
                      {option === 'price_low' && 'Price: Low to High'}
                      {option === 'price_high' && 'Price: High to Low'}
                      {option === 'rating' && 'Top Rated'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={styles.applyFilterButton}
              onPress={() => setShowFilters(false)}
            >
              <LinearGradient
                colors={['#FF6B9D', '#FF8FB1']}
                style={styles.applyFilterGradient}
              >
                <Text style={styles.applyFilterText}>Apply Filters</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Render content based on selected tab
  const renderContent = () => {
    switch(selectedTab) {
      case 'packages':
        return (
          <FlatList
            data={filteredPackages}
            renderItem={({ item }) => <PackageCard item={item} />}
            keyExtractor={(item, index) => `package-${item.package_id || item.id || index}`}
            contentContainerStyle={styles.packagesList}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B9D']} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="package-variant" size={60} color="#B0B0B0" />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No packages found</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Try adjusting your search
                </Text>
              </View>
            }
          />
        );
      
      case 'promotions':
        return (
          <FlatList
            data={filteredPromotions}
            renderItem={({ item }) => <PromotionCard item={item} />}
            keyExtractor={(item, index) => `promotion-${item.promotion_id || item.id || index}`}
            contentContainerStyle={styles.promotionsList}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B9D']} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="tag" size={60} color="#B0B0B0" />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No promotions found</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Try adjusting your search
                </Text>
              </View>
            }
          />
        );
      
      default: // menu
        return (
          <FlatList
            data={sortedItems}
            renderItem={({ item }) => (
              viewMode === 'grid' 
                ? <GridMenuItem item={item} />
                : <ListMenuItem item={item} />
            )}
            keyExtractor={(item, index) => `menu-${item.menu_item_id || item.id || index}`}
            contentContainerStyle={[
              styles.menuList,
              viewMode === 'grid' && styles.menuListGrid
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B9D']} />}
            numColumns={viewMode === 'grid' ? 2 : 1}
            key={viewMode}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="food-off" size={60} color="#B0B0B0" />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No items found</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Try adjusting your search or filters
                </Text>
              </View>
            }
          />
        );
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FF6B9D" />
        <Text style={{ marginTop: 16, color: colors.textSecondary }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      
      <HeaderComponent />
      <Animated.View style={{ flex: 1 }}>
        {renderContent()}
      </Animated.View>

      {/* Modals */}
      <MenuItemDetailModal />
      <PackageDetailModal />
      <FilterModal />
      <CustomAlertModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  
  // Header Styles
  headerContainer: { paddingHorizontal: 16, paddingTop: 8 },
  heroSection: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 20,
  },
  heroTitle: { fontSize: 32, fontWeight: '800', color: '#FF6B9D', letterSpacing: -0.5 },
  heroSubtitle: { fontSize: 14, color: '#8A8A8E', fontWeight: '500', marginTop: 2 },
  
  searchContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 16, 
    paddingHorizontal: 14, 
    paddingVertical: 12, 
    borderRadius: 16, 
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 4 },
  
  // Enhanced Tabs Styles - WITHOUT pink underline
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    position: 'relative',
  },
  tabItemActive: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Categories Styles with Scroll Indicators
  categoriesWrapper: { marginBottom: 16 },
  categoriesContainer: { 
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoriesList: { 
    gap: 8, 
    paddingHorizontal: 16,
  },
  categoryItem: { 
    paddingHorizontal: 18, 
    paddingVertical: 8, 
    borderRadius: 20, 
    backgroundColor: '#F5F5F5',
    position: 'relative',
  },
  categoryItemActive: { 
    backgroundColor: '#FF6B9D',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryName: { fontSize: 13, fontWeight: '600' },
  categoryActiveIndicator: {
    position: 'absolute',
    bottom: -4,
    left: '25%',
    right: '25%',
    height: 3,
    backgroundColor: '#FF6B9D',
    borderRadius: 1.5,
  },
  
  // Scroll Indicators
  scrollIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  scrollIndicatorLeft: {
    left: 0,
  },
  scrollIndicatorRight: {
    right: 0,
  },
  scrollIndicatorGradient: {
    width: 32,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  resultInfo: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16,
  },
  resultCount: { fontSize: 13, color: '#8A8A8E', fontWeight: '500' },
  viewToggle: { flexDirection: 'row', gap: 4 },
  viewToggleButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  viewToggleActive: { backgroundColor: '#FFF0F5' },
  
  // Grid View Styles
  menuList: { paddingHorizontal: 16, paddingBottom: 20 },
  menuListGrid: { paddingHorizontal: 8 },
  
  gridCard: { 
    flex: 1,
    margin: 6,
    borderRadius: 16, 
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  gridImageContainer: { position: 'relative' },
  gridImage: { width: '100%', height: 160 },
  gridPopularBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  gridPopularText: { fontSize: 8, fontWeight: '700', color: '#FF6B9D' },
  gridDiscountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  gridDiscountText: { color: '#FFF', fontSize: 8, fontWeight: 'bold' },
  gridFavoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridCartButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF6B9D',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  gridCartButtonActive: {
    backgroundColor: '#4CAF50',
    shadowColor: '#4CAF50',
  },
  gridCartQuantity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  gridCartQuantityText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  gridInfo: { padding: 10 },
  gridName: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  gridRating: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  gridRatingText: { fontSize: 10, color: '#B0B0B0' },
  gridPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gridPrice: { fontSize: 16, fontWeight: '700', color: '#FF6B9D' },
  gridPriceContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gridOriginalPrice: { fontSize: 12, textDecorationLine: 'line-through', color: '#B0B0B0' },
  
  // List View Styles
  listCard: { 
    flexDirection: 'row', 
    borderRadius: 16, 
    marginBottom: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  listImageContainer: { position: 'relative' },
  listImage: { width: 100, height: 100, borderRadius: 12 },
  listPopularBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  listPopularText: { fontSize: 8, fontWeight: '700', color: '#FF6B9D' },
  listCartButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF6B9D',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  listCartButtonActive: {
    backgroundColor: '#4CAF50',
    shadowColor: '#4CAF50',
  },
  listCartQuantity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  listCartQuantityText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  listInfo: { flex: 1, marginLeft: 12 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  listName: { fontSize: 16, fontWeight: '600', flex: 1 },
  listDescription: { fontSize: 12, lineHeight: 16, marginBottom: 6 },
  listMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  listMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  listMetaText: { fontSize: 10, color: '#B0B0B0' },
  listPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listPrice: { fontSize: 18, fontWeight: '700', color: '#FF6B9D' },
  listPriceContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  listOriginalPrice: { fontSize: 14, textDecorationLine: 'line-through', color: '#B0B0B0' },
  
  // Package Styles
  packagesList: { paddingHorizontal: 16, paddingBottom: 20 },
  packageCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    height: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  packageImage: { width: '100%', height: '100%' },
  packageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  packageName: { fontSize: 18, fontWeight: '700', color: '#fff' },
  packagePrice: { fontSize: 16, fontWeight: '600', color: '#FF6B9D', marginTop: 2 },
  packageFeatures: { flexDirection: 'row', marginTop: 4 },
  packageFeature: { fontSize: 12, color: '#fff', opacity: 0.8 },
  
  // Promotion Styles
  promotionsList: { paddingHorizontal: 16, paddingBottom: 20 },
  promotionCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  promotionImage: { width: '100%', height: 120 },
  promotionInfo: { padding: 12 },
  promotionDiscountBadge: {
    backgroundColor: '#FF4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  promotionDiscountText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  promotionName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  promotionDescription: { fontSize: 12, marginBottom: 4 },
  promotionValidity: { fontSize: 10, opacity: 0.6 },
  
  starsRow: { flexDirection: 'row', gap: 2 },
  
  // Empty State
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 12, marginBottom: 4 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  
  // Detail Modal Styles
  detailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  detailModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    maxHeight: '90%',
  },
  detailCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  detailImageContainer: {
    position: 'relative',
    height: 220,
    marginHorizontal: -4,
  },
  detailImage: {
    width: '100%',
    height: '100%',
  },
  detailPopularBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
    alignItems: 'center',
  },
  detailPopularText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF6B9D',
  },
  detailContent: {
    padding: 20,
  },
  detailName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  detailPrice: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 2,
  },
  detailOriginalPrice: {
    fontSize: 16,
    textDecorationLine: 'line-through',
    color: '#B0B0B0',
    marginBottom: 8,
  },
  detailSection: {
    marginTop: 16,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  detailDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  detailPaxInfo: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  detailDietaryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailDietaryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  detailDietaryText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '500',
  },
  detailAllergyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailAllergyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  detailAllergyText: {
    fontSize: 13,
    color: '#C62828',
    fontWeight: '500',
  },
  detailFallback: {
    fontSize: 14,
    fontStyle: 'italic',
  },

  // Add to Cart inside Modal
  detailAddToCartWrapper: {
    marginTop: 20,
    marginBottom: 10,
  },
  detailCartQuantityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    marginBottom: 8,
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
  },
  detailCartQuantityText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '500',
  },
  detailRemoveButton: {
    padding: 4,
  },
  detailAddToCartButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  detailAddToCartButtonActive: {
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  detailAddToCartGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  detailAddToCartText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  detailAddToCartPrice: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.9,
  },

  // Custom Alert Modal Styles
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertContainer: {
    width: SCREEN_WIDTH - 48,
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  alertIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  alertMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  alertButtons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  alertButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertCancelButton: {
    backgroundColor: '#F5F5F5',
  },
  alertConfirmButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  alertButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Package Detail Styles
  packageDetailHeader: {
    position: 'relative',
    height: 200,
  },
  packageDetailImage: {
    width: '100%',
    height: '100%',
  },
  packageDetailOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  packageDetailName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  packageDetailPrice: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FF6B9D',
  },
  packageDetailPax: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
  },
  packageItemsLoader: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  packageItemsLoaderText: {
    marginTop: 8,
    fontSize: 14,
  },
  packageItemsList: {
    gap: 12,
  },
  packageMenuItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  packageMenuItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  packageMenuItemImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  packageMenuItemInfo: {
    marginLeft: 12,
    flex: 1,
  },
  packageMenuItemName: {
    fontSize: 15,
    fontWeight: '600',
  },
  packageMenuItemPrice: {
    fontSize: 14,
    fontWeight: '500',
  },
  packageMenuItemDescription: {
    fontSize: 13,
    marginBottom: 6,
    lineHeight: 18,
  },
  packageMenuItemTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  packageMenuItemTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  packageMenuItemAllergyTag: {
    backgroundColor: '#FFF0F0',
  },
  packageMenuItemTagText: {
    fontSize: 11,
    color: '#666',
  },
  packageMenuItemAllergyText: {
    color: '#C62828',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  filterSection: { marginBottom: 24 },
  filterLabel: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  sortOptions: { gap: 8 },
  sortOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  sortOptionActive: { backgroundColor: '#FF6B9D' }, 
  sortOptionText: { fontSize: 14, color: '#333' },
  sortOptionTextActive: { color: '#FFF' },
  applyFilterButton: { marginTop: 8 },
  applyFilterGradient: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  applyFilterText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});

export default MenuScreen;