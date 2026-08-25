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

const { width } = Dimensions.get('window');

const MenuScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { addToCart, cartItems, getItemQuantity } = useCart();
  const { isGuest } = useAuth();

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
  
  const scrollY = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef(null);
  const scaleValue = useRef(new Animated.Value(1)).current;

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

  const handleAddToCart = (item) => {
    if (isGuest) {
      Alert.alert(
        'Guest Mode',
        'Please login to add items to your cart',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Login', onPress: () => navigation.navigate('Login') }
        ]
      );
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addToCart({
      id: item.menu_item_id || item.id,
      name: item.name,
      price: item.price,
      image: item.image_url || item.image,
    }, 1);
    
    Animated.sequence([
      Animated.timing(scaleValue, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();
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

  const getCartCount = (itemId) => {
    return getItemQuantity(itemId);
  };

  // Grid View Menu Item
  const GridMenuItem = ({ item }) => {
    const imageUrl = imageErrors[item.id] 
      ? getRandomBannerImage()
      : (item.image_url || item.image || getRandomBannerImage());
    
    const isFavorite = favorites.includes(item.menu_item_id || item.id);
    const cartCount = getCartCount(item.menu_item_id || item.id);

    return (
      <TouchableOpacity 
        activeOpacity={0.9}
        style={[styles.gridCard, { backgroundColor: colors.card }]}
        onPress={() => navigation.navigate('MenuItemDetail', { id: item.menu_item_id || item.id })}
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
          <TouchableOpacity 
            style={styles.gridFavoriteButton}
            onPress={() => toggleFavorite(item.menu_item_id || item.id)}
          >
            <Ionicons 
              name={isFavorite ? 'heart' : 'heart-outline'} 
              size={18} 
              color={isFavorite ? '#FF6B9D' : '#fff'} 
            />
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
            <TouchableOpacity
              style={[styles.gridAddButton, cartCount > 0 && styles.gridAddButtonActive]}
              onPress={() => handleAddToCart(item)}
            >
              {cartCount > 0 ? (
                <Text style={styles.gridAddButtonText}>{cartCount}</Text>
              ) : (
                <Feather name="plus" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // List View Menu Item
  const ListMenuItem = ({ item }) => {
    const imageUrl = imageErrors[item.id] 
      ? getRandomBannerImage()
      : (item.image_url || item.image || getRandomBannerImage());
    
    const isFavorite = favorites.includes(item.menu_item_id || item.id);
    const cartCount = getCartCount(item.menu_item_id || item.id);

    return (
      <TouchableOpacity 
        activeOpacity={0.9}
        style={[styles.listCard, { backgroundColor: colors.card }]}
        onPress={() => navigation.navigate('MenuItemDetail', { id: item.menu_item_id || item.id })}
      >
        <View style={styles.listImageContainer}>
          <Image source={{ uri: imageUrl }} style={styles.listImage} />
          {item.is_popular && (
            <View style={styles.listPopularBadge}>
              <MaterialCommunityIcons name="fire" size={10} color="#FF6B9D" />
              <Text style={styles.listPopularText}>Popular</Text>
            </View>
          )}
        </View>
        
        <View style={styles.listInfo}>
          <View style={styles.listHeader}>
            <Text style={[styles.listName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
            <TouchableOpacity onPress={() => toggleFavorite(item.menu_item_id || item.id)}>
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
            <TouchableOpacity
              style={[styles.listAddButton, cartCount > 0 && styles.listAddButtonActive]}
              onPress={() => handleAddToCart(item)}
            >
              {cartCount > 0 ? (
                <Text style={styles.listAddButtonText}>{cartCount}</Text>
              ) : (
                <>
                  <Feather name="plus" size={14} color="#fff" />
                  <Text style={styles.listAddButtonText}>Add</Text>
                </>
              )}
            </TouchableOpacity>
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
        onPress={() => navigation.navigate('PackageDetail', { packageId: item.package_id || item.id })}
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

  const CategoryItem = ({ item, isSelected, onPress }) => (
    <TouchableOpacity
      style={[
        styles.categoryItem,
        isSelected && styles.categoryItemActive,
        { backgroundColor: isSelected ? '#FF6B9D' : 'transparent' }
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
    </TouchableOpacity>
  );

  // Tab Item
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
      {isSelected && <View style={styles.tabIndicator} />}
    </TouchableOpacity>
  );

  const HeaderComponent = () => (
    <View style={styles.headerContainer}>
      <View style={styles.heroSection}>
        <View>
          <Text style={styles.heroTitle}>Our Menu</Text>
          <Text style={styles.heroSubtitle}>Discover our signature dishes</Text>
        </View>
        <TouchableOpacity 
          style={styles.cartIconButton}
          onPress={() => {
            if (isGuest) {
              Alert.alert(
                'Guest Mode',
                'Please login to view your cart',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Login', onPress: () => navigation.navigate('Login') }
                ]
              );
            } else {
              navigation.navigate('Cart');
            }
          }}
        >
          <LinearGradient
            colors={['#FF6B9D', '#FF8FB1']}
            style={styles.cartIconGradient}
          >
            <Feather name="shopping-bag" size={22} color="#fff" />
            {cartItems.length > 0 && (
              <View style={styles.cartIconBadge}>
                <Text style={styles.cartIconBadgeText}>{cartItems.length}</Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
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

      {/* Tabs */}
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

      {/* Categories - Only show for Menu tab */}
      {selectedTab === 'menu' && categories.length > 0 && (
        <View style={styles.categoriesWrapper}>
          <FlatList
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
          />
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

      <FilterModal />
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
  
  cartIconButton: { position: 'relative' },
  cartIconGradient: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  cartIconBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF4444',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  cartIconBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  
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
  
  // Tabs Styles
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    position: 'relative',
  },
  tabItemActive: {
    backgroundColor: 'transparent',
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 24,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#FF6B9D',
  },
  
  // Categories Styles - Text Only
  categoriesWrapper: { marginBottom: 16 },
  categoriesList: { gap: 8, paddingRight: 16 },
  categoryItem: { 
    paddingHorizontal: 20, 
    paddingVertical: 8, 
    borderRadius: 20, 
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  categoryItemActive: { 
    borderWidth: 0,
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryName: { fontSize: 13, fontWeight: '600' },
  
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
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridInfo: { padding: 10 },
  gridName: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  gridRating: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  gridRatingText: { fontSize: 10, color: '#B0B0B0' },
  gridPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gridPrice: { fontSize: 16, fontWeight: '700', color: '#FF6B9D' },
  gridPriceContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gridOriginalPrice: { fontSize: 12, textDecorationLine: 'line-through', color: '#B0B0B0' },
  gridAddButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF6B9D',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  gridAddButtonActive: { backgroundColor: '#4CAF50' },
  gridAddButtonText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  
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
  listAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B9D',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  listAddButtonActive: { backgroundColor: '#4CAF50' },
  listAddButtonText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  
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