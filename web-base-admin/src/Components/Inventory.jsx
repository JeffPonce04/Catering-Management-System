// src/pages/Inventory/Inventory.jsx

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { productAPI, equipmentAPI, eventAPI, historyAPI, dashboardAPI, handleApiError } from '../services/api';
import './styles/Inventory.css';

import {
  FiPackage, FiSearch, FiFilter, FiPlus, FiEdit2, FiTrash2, FiDownload,
  FiRefreshCw, FiChevronLeft, FiChevronRight, FiEye, FiAlertCircle,
  FiCheckCircle, FiXCircle, FiClock, FiTrendingUp, FiTrendingDown,
  FiGrid, FiList, FiTag, FiBox, FiMapPin, FiShoppingBag, FiCalendar,
  FiUser, FiSettings, FiArchive, FiTool, FiLayers, FiPrinter, FiTruck,  
  FiInfo, FiCheck, FiAlertTriangle,FiBell
} from 'react-icons/fi';

import { AiFillProduct } from "react-icons/ai";
import {
  BsArrowReturnLeft, BsCartPlus, BsCartDash, BsCalendarEvent,
  BsGeoAlt, BsTelephone, BsFileText
} from 'react-icons/bs';
import { MdHistory } from 'react-icons/md';
import { GiSpoon } from 'react-icons/gi';

const Inventory = () => {
  // Module state
  const [activeModule, setActiveModule] = useState('products');
  
  // Sub-tabs state
  const [activeProductTab, setActiveProductTab] = useState('all');
  const [activeEquipmentTab, setActiveEquipmentTab] = useState('all');
  const [activeEventTab, setActiveEventTab] = useState('ongoing');
  
  // View state
  const [viewMode, setViewMode] = useState('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedItems, setSelectedItems] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showItemDetails, setShowItemDetails] = useState(false);
  const [showStockOutModal, setShowStockOutModal] = useState(false);
  const [showStockInModal, setShowStockInModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddEquipmentModal, setShowAddEquipmentModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // Data states
  const [products, setProducts] = useState([]);
  const [equipment, setEquipment] = useState([]);  const [events, setEvents] = useState([]);
  const [productHistory, setProductHistory] = useState([]);
  const [equipmentHistory, setEquipmentHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState(null);
  
  // Stats state
  const [stats, setStats] = useState({
    products: { total: 0, lowStock: 0, outOfStock: 0, expiring: 0, totalQuantity: 0 },
    equipment: { total: 0, inUse: 0, available: 0, damaged: 0, missing: 0, totalQuantity: 0 },
    events: { ongoing: 0, upcoming: 0, completed: 0, overdue: 0, equipmentOut: 0, equipmentReturned: 0 }
  });

  // Refs for debouncing
  const searchTimeout = useRef(null);
  const fetchTimeout = useRef(null);
  const containerRef = useRef(null);

  // Items per page - fixed to 6 rows
  const ITEMS_PER_PAGE = 6;

  // Form states
  const [newStockOut, setNewStockOut] = useState({
    eventName: '',
    eventLocation: '',
    dateOut: new Date().toISOString().slice(0, 16),
    expectedDateIn: '',
    personResponsible: '',
    contactNumber: '',
    notes: '',
    equipment: []
  });
  
  const [equipmentSelector, setEquipmentSelector] = useState({
    equipmentId: '',
    quantityOut: 1
  });

  const [returnFormData, setReturnFormData] = useState({});

  // Listen for sidebar changes and update CSS variable
  useEffect(() => {
    const updateSidebarWidth = () => {
      const sidebar = document.querySelector('.navigation-container');
      if (sidebar) {
        const isCollapsed = sidebar.classList.contains('collapsed') || 
                           window.getComputedStyle(sidebar).width === '98px';
        
        if (isCollapsed) {
          document.documentElement.style.setProperty('--sidebar-width', '98px');
          document.body.classList.add('sidebar-collapsed');
        } else {
          const width = sidebar.offsetWidth;
          document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
          document.body.classList.remove('sidebar-collapsed');
        }
      }
    };

    // Initial update
    updateSidebarWidth();

    // Create observer for sidebar class changes
    const observer = new MutationObserver(updateSidebarWidth);
    const sidebar = document.querySelector('.navigation-container');
    
    if (sidebar) {
      observer.observe(sidebar, { 
        attributes: true, 
        attributeFilter: ['class', 'style'],
        childList: false,
        subtree: false
      });
    }

    // Also listen for window resize
    window.addEventListener('resize', updateSidebarWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSidebarWidth);
    };
  }, []);

  // Categories state (memoized)
  const categories = useMemo(() => [
    // Product Categories
    { id: 'GRN', name: 'Grains', type: 'product', icon: '🌾', count: 0 },
    { id: 'MET', name: 'Meat', type: 'product', icon: '🥩', count: 0 },
    { id: 'VEG', name: 'Vegetables', type: 'product', icon: '🥕', count: 0 },
    { id: 'FRZ', name: 'Frozen Products', type: 'product', icon: '❄️', count: 0 },
    { id: 'DRK', name: 'Drinks', type: 'product', icon: '🥤', count: 0 },
    { id: 'SAU', name: 'Sauces', type: 'product', icon: '🥫', count: 0 },
    { id: 'DAI', name: 'Dairy', type: 'product', icon: '🥛', count: 0 },
    { id: 'BAK', name: 'Bakery', type: 'product', icon: '🥖', count: 0 },
    
    // Equipment Categories
    { id: 'EAT-UTENSIL', name: 'Eating Utensils', type: 'equipment', category: 'Eating Utensils', icon: '🍴', count: 0 },
    { id: 'TABLEWARE', name: 'Tableware', type: 'equipment', category: 'Tableware', icon: '🍽️', count: 0 },
    { id: 'SRV-EQUIP', name: 'Serving Equipment', type: 'equipment', category: 'Serving Equipment', icon: '🥄', count: 0 },
    { id: 'COOK-EQUIP', name: 'Cooking Equipment', type: 'equipment', category: 'Cooking Equipment', icon: '🍳', count: 0 },
    { id: 'FOOD-STOR', name: 'Food Storage', type: 'equipment', category: 'Food Storage', icon: '📦', count: 0 },
    { id: 'FURNITURE', name: 'Furniture', type: 'equipment', category: 'Furniture', icon: '🪑', count: 0 },
    { id: 'CLEAN-HYG', name: 'Cleaning & Hygiene', type: 'equipment', category: 'Cleaning & Hygiene', icon: '🧹', count: 0 },
    { id: 'EXTRA-ESS', name: 'Extra Essentials', type: 'equipment', category: 'Extra Essentials', icon: '🔌', count: 0 },
    
    // Sub-categories
    { id: 'EAT-SPOON', name: 'Spoons', type: 'equipment', category: 'Eating Utensils', icon: '🥄', count: 0 },
    { id: 'EAT-FORK', name: 'Forks', type: 'equipment', category: 'Eating Utensils', icon: '🍴', count: 0 },
    { id: 'EAT-KNIFE', name: 'Knives', type: 'equipment', category: 'Eating Utensils', icon: '🔪', count: 0 },
    { id: 'EAT-PLATE', name: 'Plates', type: 'equipment', category: 'Tableware', icon: '🍽️', count: 0 },
    { id: 'EAT-BOWL', name: 'Bowls', type: 'equipment', category: 'Tableware', icon: '🥣', count: 0 },
    { id: 'EAT-GLASS', name: 'Glasses', type: 'equipment', category: 'Tableware', icon: '🥃', count: 0 },
    { id: 'SRV-SPOON', name: 'Serving Spoons', type: 'equipment', category: 'Serving Equipment', icon: '🥄', count: 0 },
    { id: 'SRV-TRAY', name: 'Serving Trays', type: 'equipment', category: 'Serving Equipment', icon: '🍱', count: 0 },
    { id: 'COOK-POT', name: 'Pots & Pans', type: 'equipment', category: 'Cooking Equipment', icon: '🍳', count: 0 },
    { id: 'COOK-KNIFE', name: 'Chef Knives', type: 'equipment', category: 'Cooking Equipment', icon: '🔪', count: 0 },
    { id: 'STOR-CONTAINER', name: 'Storage Containers', type: 'equipment', category: 'Food Storage', icon: '📦', count: 0 },
    { id: 'FURN-TABLE', name: 'Tables', type: 'equipment', category: 'Furniture', icon: '🪑', count: 0 },
    { id: 'FURN-CHAIR', name: 'Chairs', type: 'equipment', category: 'Furniture', icon: '🪑', count: 0 }
  ], []);

  // New Product Form State
  const [newProduct, setNewProduct] = useState({
    name: '',
    sku: '',
    category: '',
    quantity: '',
    unit: 'kg',
    minStock: '',
    maxStock: '',
    reorderPoint: '',
    location: '',
    supplier: '',
    expiryDate: '',
    leadTime: '',
    notes: ''
  });

  // Edit Product Form State
  const [editProduct, setEditProduct] = useState({
    name: '',
    sku: '',
    category: '',
    quantity: '',
    unit: 'kg',
    minStock: '',
    maxStock: '',
    reorderPoint: '',
    location: '',
    supplier: '',
    expiryDate: '',
    leadTime: '',
    notes: '',
    active: true
  });

  // New Equipment Form State
  const [newEquipment, setNewEquipment] = useState({
    name: '',
    category: '',
    sub_category: '',
    total_quantity: '',
    location: '',
    supplier: '',
    last_maintenance: '',
    condition: 'Good',
    notes: '',
    model: '',
    serial_number: ''
  });

  // Edit Equipment Form State
  const [editEquipment, setEditEquipment] = useState({
    name: '',
    category: '',
    sub_category: '',
    total_quantity: '',
    location: '',
    supplier: '',
    last_maintenance: '',
    condition: 'Good',
    notes: '',
    model: '',
    serial_number: '',
    active: true
  });

  // Category filter states
  const [selectedProductCategory, setSelectedProductCategory] = useState('all');
  const [selectedEquipmentCategory, setSelectedEquipmentCategory] = useState('all');
  const [selectedEquipmentSubCategory, setSelectedEquipmentSubCategory] = useState('all');

  // Show active/inactive items
  const [showActive, setShowActive] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  // Add this state at the top of your Inventory component (after other useState declarations)
const [currentDateTime, setCurrentDateTime] = useState(new Date());

// Add this useEffect to update the time every second
useEffect(() => {
  const timer = setInterval(() => {
    setCurrentDateTime(new Date());
  }, 1000);
  
  return () => clearInterval(timer);
}, []);


{/* Add this state for notifications */}
const [notifications, setNotifications] = useState([
  { id: 1, message: 'Low stock alert: Rice (5 units left)', time: '2 min ago', read: false, type: 'warning' },
  { id: 2, message: 'Equipment maintenance due: 3 items', time: '1 hour ago', read: false, type: 'info' },
  { id: 3, message: 'Expiring soon: Milk (2 days left)', time: '3 hours ago', read: true, type: 'danger' },
  { id: 4, message: 'New product added: Organic Vegetables', time: '5 hours ago', read: true, type: 'success' },
]);
const [showNotifications, setShowNotifications] = useState(false);
const [unreadCount, setUnreadCount] = useState(2);

// Add this useEffect to update unread count
useEffect(() => {
  setUnreadCount(notifications.filter(n => !n.read).length);
}, [notifications]);

// Add this function to mark notification as read
const markAsRead = (id) => {
  setNotifications(notifications.map(notif => 
    notif.id === id ? { ...notif, read: true } : notif
  ));
};

// Add this function to mark all as read
const markAllAsRead = () => {
  setNotifications(notifications.map(notif => ({ ...notif, read: true })));
};

  // Memoized filter functions
  const productCounts = useMemo(() => {
    return {
      all: products.length,
      inStock: products.filter(p => p?.status === 'in-stock').length,
      lowStock: products.filter(p => p?.status === 'low-stock').length,
      outOfStock: products.filter(p => p?.status === 'out-of-stock').length,
      overStock: products.filter(p => p?.status === 'over-stock').length,
      expiring: products.filter(p => {
        if (!p?.expiry_date) return false;
        const days = (new Date(p.expiry_date) - new Date()) / (1000 * 60 * 60 * 24);
        return days <= 7 && days > 0;
      }).length,
      active: products.filter(p => p?.active).length,
      inactive: products.filter(p => !p?.active).length
    };
  }, [products]);

  const equipmentCounts = useMemo(() => {
    return {
      all: equipment.length,
      available: equipment.filter(e => e?.status === 'available').length,
      inUse: equipment.filter(e => e?.in_use > 0).length,
      damaged: equipment.filter(e => e?.damaged > 0).length,
      missing: equipment.filter(e => e?.missing > 0).length,
      maintenance: equipment.filter(e => e?.condition === 'Fair' || e?.condition === 'Poor' || e?.under_maintenance > 0).length
    };
  }, [equipment]);

  // Optimized fetch function with debounce
  const fetchData = useCallback(async (isInitial = false) => {
    if (fetchTimeout.current) {
      clearTimeout(fetchTimeout.current);
    }

    if (!isInitial) {
      setLoading(true);
    }
    setError(null);
    
    try {
      if (activeModule === 'products') {
        const params = {
          search: searchTerm || undefined,
          per_page: 100
        };
        
        const response = await productAPI.getProducts(params);
        let productsData = response.data.data?.data || [];
        
        if (!showActive && showInactive) {
          productsData = productsData.filter(p => !p.active);
        } else if (showActive && !showInactive) {
          productsData = productsData.filter(p => p.active);
        }
        
        setProducts(productsData);
        
      } else if (activeModule === 'equipment') {
        const params = {
          search: searchTerm || undefined,
          per_page: 100
        };
        
        const response = await equipmentAPI.getEquipment(params);
        let equipmentData = response.data.data?.data || [];
        
        if (!showActive && showInactive) {
          equipmentData = equipmentData.filter(e => !e.active);
        } else if (showActive && !showInactive) {
          equipmentData = equipmentData.filter(e => e.active);
        }
        
        setEquipment(equipmentData);
        
      } else if (activeModule === 'events') {
        const params = {
          status: activeEventTab !== 'all' ? activeEventTab : undefined,
          search: searchTerm || undefined
        };
        
        const response = await eventAPI.getEvents(params);
        setEvents(response.data.data?.data || []);
      }
      
      fetchStats();
      
    } catch (error) {
      const apiError = handleApiError(error);
      setError(apiError.message);
    } finally {
      setLoading(false);
      if (isInitial) {
        setInitialLoad(false);
      }
    }
  }, [activeModule, activeEventTab, searchTerm, showActive, showInactive]);

  // Optimized stats fetch
  const fetchStats = useCallback(async () => {
    try {
      const [inventoryStats, eventStats] = await Promise.all([
        dashboardAPI.getStats().catch(() => ({ data: { data: { products: {}, equipment: {} } } })),
        eventAPI.getStats().catch(() => ({ data: { data: {} } }))
      ]);
      
      setStats({
        products: {
          total: inventoryStats.data.data.products.total_items || products.length,
          totalQuantity: inventoryStats.data.data.products.total_quantity || 0,
          lowStock: inventoryStats.data.data.products.low_stock || productCounts.lowStock,
          outOfStock: inventoryStats.data.data.products.out_of_stock || productCounts.outOfStock,
          expiring: inventoryStats.data.data.products.expiring_soon || productCounts.expiring
        },
        equipment: {
          total: inventoryStats.data.data.equipment.total_items || equipment.length,
          totalQuantity: inventoryStats.data.data.equipment.total_quantity || 0,
          inUse: inventoryStats.data.data.equipment.in_use || 0,
          available: inventoryStats.data.data.equipment.available || 0,
          damaged: inventoryStats.data.data.equipment.damaged || 0,
          missing: inventoryStats.data.data.equipment.missing || 0
        },
        events: {
          ongoing: eventStats.data.data.ongoing || 0,
          upcoming: eventStats.data.data.upcoming || 0,
          completed: eventStats.data.data.completed || 0,
          overdue: eventStats.data.data.overdue || 0,
          equipmentOut: eventStats.data.data.equipment_out || 0,
          equipmentReturned: eventStats.data.data.equipment_returned || 0
        }
      });
      
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [products.length, equipment.length, productCounts]);

  // Initial load
  useEffect(() => {
    fetchData(true);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(() => {
      fetchData();
    }, 500);

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [searchTerm, activeModule, activeEventTab, showActive, showInactive, fetchData]);

  // Fetch history when item is selected
  useEffect(() => {
    if (selectedItem) {
      const fetchHistory = async () => {
        try {
          const type = activeModule === 'products' ? 'product' : 'equipment';
          const id = selectedItem?.product_id || selectedItem?.equipment_id;
          if (!id) return;
          
          const response = await historyAPI.getItemHistory(type, id);
          if (activeModule === 'products') {
            setProductHistory(response.data.data || []);
          } else {
            setEquipmentHistory(response.data.data || []);
          }
        } catch (error) {
          console.error('Error fetching history:', error);
        }
      };
      fetchHistory();
    }
  }, [selectedItem, activeModule]);

  // Get unique main categories for equipment (memoized)
  const getEquipmentMainCategories = useCallback(() => {
    const mainCats = [...new Set(categories
      .filter(c => c.type === 'equipment' && c.category)
      .map(c => c.category))];
    return mainCats;
  }, [categories]);

  // Get subcategories by main category (memoized)
  const getSubCategoriesByMain = useCallback((mainCategory) => {
    return categories.filter(c => c.type === 'equipment' && c.category === mainCategory);
  }, [categories]);

  // Update category counts
  const updateCategoryCounts = useCallback((items, type) => {
    const updatedCategories = categories.map(cat => {
      if (cat.type === type) {
        return {
          ...cat,
          count: (items || []).filter(item => 
            type === 'product' ? item?.category === cat.name : item?.sub_category === cat.name
          ).length || 0
        };
      }
      return cat;
    });
    return updatedCategories;
  }, [categories]);

  // Filter functions (memoized)
  const getFilteredProducts = useCallback(() => {
    let filtered = products;
    
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'in-stock') {
        filtered = filtered.filter(p => p?.status === 'in-stock');
      } else if (selectedCategory === 'low-stock') {
        filtered = filtered.filter(p => p?.status === 'low-stock');
      } else if (selectedCategory === 'out-of-stock') {
        filtered = filtered.filter(p => p?.status === 'out-of-stock');
      } else if (selectedCategory === 'over-stock') {
        filtered = filtered.filter(p => p?.status === 'over-stock');
      } else if (selectedCategory === 'expiring') {
        filtered = filtered.filter(p => {
          if (!p?.expiry_date) return false;
          const days = (new Date(p.expiry_date) - new Date()) / (1000 * 60 * 60 * 24);
          return days <= 7 && days > 0;
        });
      } else if (selectedCategory === 'active') {
        filtered = filtered.filter(p => p?.active);
      } else if (selectedCategory === 'inactive') {
        filtered = filtered.filter(p => !p?.active);
      } else {
        filtered = filtered.filter(p => p?.category === selectedCategory);
      }
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(product => 
        product?.name?.toLowerCase().includes(term) ||
        product?.product_id?.toLowerCase().includes(term) ||
        product?.sku?.toLowerCase().includes(term) ||
        product?.category?.toLowerCase().includes(term)
      );
    }

    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') comparison = (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'quantity') comparison = (a.quantity || 0) - (b.quantity || 0);
      if (sortBy === 'status') comparison = (a.status || '').localeCompare(b.status || '');
      if (sortBy === 'expiry') {
        if (!a.expiry_date) return 1;
        if (!b.expiry_date) return -1;
        comparison = new Date(a.expiry_date) - new Date(b.expiry_date);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [products, selectedCategory, searchTerm, sortBy, sortOrder]);

  const getFilteredEquipment = useCallback(() => {
    let filtered = equipment;
    
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'available') {
        filtered = filtered.filter(e => e?.status === 'available');
      } else if (selectedCategory === 'in-use') {
        filtered = filtered.filter(e => e?.in_use > 0);
      } else if (selectedCategory === 'damaged') {
        filtered = filtered.filter(e => e?.damaged > 0);
      } else if (selectedCategory === 'missing') {
        filtered = filtered.filter(e => e?.missing > 0);
      } else if (selectedCategory === 'maintenance') {
        filtered = filtered.filter(e => e?.condition === 'Fair' || e?.condition === 'Poor' || e?.under_maintenance > 0);
      } else {
        filtered = filtered.filter(e => e?.sub_category === selectedCategory);
      }
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item?.name?.toLowerCase().includes(term) ||
        item?.equipment_id?.toLowerCase().includes(term) ||
        item?.category?.toLowerCase().includes(term) ||
        item?.sub_category?.toLowerCase().includes(term) ||
        item?.model?.toLowerCase().includes(term) ||
        item?.serial_number?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [equipment, selectedCategory, searchTerm]);

  const getFilteredEvents = useCallback(() => {
    let filtered = events;
    
    if (activeEventTab !== 'all') {
      filtered = filtered.filter(e => e?.status === activeEventTab);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(event => 
        event?.name?.toLowerCase().includes(term) ||
        event?.event_id?.toLowerCase().includes(term) ||
        event?.location?.toLowerCase().includes(term) ||
        event?.person_responsible?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [events, activeEventTab, searchTerm]);

  // Memoized current items and pagination
  const currentItems = useMemo(() => {
    if (activeModule === 'products') return getFilteredProducts();
    if (activeModule === 'equipment') return getFilteredEquipment();
    return getFilteredEvents();
  }, [activeModule, getFilteredProducts, getFilteredEquipment, getFilteredEvents]);

  const totalPages = useMemo(() => Math.ceil(currentItems.length / ITEMS_PER_PAGE), [currentItems.length]);
  
  const paginatedItems = useMemo(() => {
    return currentItems.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );
  }, [currentItems, currentPage]);

  // Reset page when changing filters
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, activeModule, activeEventTab, showActive, showInactive]);

  // Status details (memoized)
  const getStatusDetails = useCallback((status) => {
    const statusMap = {
      'in-stock': { color: '#10b981', icon: FiCheckCircle, text: 'In Stock', bg: 'rgba(16, 185, 129, 0.1)' },
      'low-stock': { color: '#f59e0b', icon: FiAlertCircle, text: 'Low Stock', bg: 'rgba(245, 158, 11, 0.1)' },
      'out-of-stock': { color: '#ef4444', icon: FiXCircle, text: 'Out of Stock', bg: 'rgba(239, 68, 68, 0.1)' },
      'over-stock': { color: '#8b5cf6', icon: FiTrendingUp, text: 'Over Stock', bg: 'rgba(139, 92, 246, 0.1)' },
      'available': { color: '#10b981', icon: FiCheckCircle, text: 'Available', bg: 'rgba(16, 185, 129, 0.1)' },
      'in-use': { color: '#f59e0b', icon: FiClock, text: 'In Use', bg: 'rgba(245, 158, 11, 0.1)' },
      'damaged': { color: '#ef4444', icon: FiXCircle, text: 'Damaged', bg: 'rgba(239, 68, 68, 0.1)' },
      'maintenance': { color: '#8b5cf6', icon: FiTool, text: 'Under Maintenance', bg: 'rgba(139, 92, 246, 0.1)' },
      'ongoing': { color: '#3b82f6', icon: FiClock, text: 'Ongoing', bg: 'rgba(59, 130, 246, 0.1)' },
      'upcoming': { color: '#8b5cf6', icon: FiCalendar, text: 'Upcoming', bg: 'rgba(139, 92, 246, 0.1)' },
      'completed': { color: '#10b981', icon: FiCheckCircle, text: 'Completed', bg: 'rgba(16, 185, 129, 0.1)' },
      'overdue': { color: '#ef4444', icon: FiAlertCircle, text: 'Overdue', bg: 'rgba(239, 68, 68, 0.1)' }
    };
    return statusMap[status] || { color: '#6b7280', icon: FiCheckCircle, text: status, bg: 'rgba(107, 114, 128, 0.1)' };
  }, []);

  // Function to check if expiry date is within 7 days
  const isExpiringSoon = useCallback((expiryDate) => {
    if (!expiryDate) return false;
    const days = (new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24);
    return days <= 7 && days > 0;
  }, []);

  // Handle View Details
  const handleViewDetails = useCallback((item) => {
    setSelectedItem(item);
    setShowItemDetails(true);
  }, []);

  // Handle Edit
  const handleEdit = useCallback((item) => {
    setEditingItem(item);
    if (activeModule === 'products') {
      setEditProduct({
        name: item.name || '',
        sku: item.sku || '',
        category: item.category || '',
        quantity: item.quantity || '',
        unit: item.unit || 'kg',
        minStock: item.min_stock || '',
        maxStock: item.max_stock || '',
        reorderPoint: item.reorder_point || '',
        location: item.location || '',
        supplier: item.supplier || '',
        expiryDate: item.expiry_date || '',
        leadTime: item.lead_time || '',
        notes: item.notes || '',
        active: item.active !== false
      });
    } else {
      setEditEquipment({
        name: item.name || '',
        category: item.category || '',
        sub_category: item.sub_category || '',
        total_quantity: item.total_quantity || '',
        location: item.location || '',
        supplier: item.supplier || '',
        last_maintenance: item.last_maintenance || '',
        condition: item.condition || 'Good',
        model: item.model || '',
        serial_number: item.serial_number || '',
        notes: item.notes || '',
        active: item.active !== false
      });
    }
    setShowEditModal(true);
  }, [activeModule]);

  // Handle Update Item
  const handleUpdateItem = async () => {
    if (!editingItem) return;
    
    setLoading(true);
    
    try {
      let response;
      if (activeModule === 'products') {
        const updateData = {
          name: editProduct.name,
          sku: editProduct.sku,
          category: editProduct.category,
          quantity: parseInt(editProduct.quantity) || 0,
          unit: editProduct.unit,
          min_stock: parseInt(editProduct.minStock) || 10,
          max_stock: parseInt(editProduct.maxStock) || 100,
          reorder_point: parseInt(editProduct.reorderPoint) || 15,
          location: editProduct.location,
          supplier: editProduct.supplier,
          expiry_date: editProduct.expiryDate,
          lead_time: parseInt(editProduct.leadTime),
          notes: editProduct.notes,
          active: editProduct.active
        };
        response = await productAPI.updateProduct(editingItem.product_id, updateData);
      } else {
        const updateData = {
          name: editEquipment.name.trim(),
          category: editEquipment.category,
          sub_category: editEquipment.sub_category || '',
          total_quantity: parseInt(editEquipment.total_quantity) || 0,
          location: editEquipment.location || '',
          supplier: editEquipment.supplier || '',
          last_maintenance: editEquipment.last_maintenance || null,
          condition: editEquipment.condition || 'Good',
          model: editEquipment.model || '',
          serial_number: editEquipment.serial_number || '',
          notes: editEquipment.notes || '',
          active: editEquipment.active
        };
        
        response = await equipmentAPI.updateEquipment(editingItem.equipment_id, updateData);
      }

      if (response.data.success) {
        await fetchData();
        setShowEditModal(false);
        setEditingItem(null);
        alert(`${activeModule === 'products' ? 'Product' : 'Equipment'} updated successfully!`);
      }
    } catch (error) {
      console.error('Update error:', error);
      
      if (error.response?.data?.errors) {
        const validationErrors = error.response.data.errors;
        const errorMessages = Object.values(validationErrors).flat().join('\n');
        alert(`Validation failed:\n${errorMessages}`);
      } else {
        const apiError = handleApiError(error);
        alert(apiError.message || `Failed to update ${activeModule === 'products' ? 'product' : 'equipment'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Archive
  const handleArchive = async (itemId) => {
    if (!window.confirm('Are you sure you want to archive this item?')) return;
    
    setLoading(true);
    
    try {
      let response;
      if (activeModule === 'products') {
        response = await productAPI.updateProduct(itemId, { active: false });
      } else {
        response = await equipmentAPI.updateEquipment(itemId, { active: false });
      }

      if (response.data.success) {
        await fetchData();
        alert('Item archived successfully');
      }
    } catch (error) {
      const apiError = handleApiError(error);
      alert(apiError.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Restore
  const handleRestore = async (itemId) => {
    if (!window.confirm('Restore this item to active inventory?')) return;
    
    setLoading(true);
    
    try {
      let response;
      if (activeModule === 'products') {
        response = await productAPI.updateProduct(itemId, { active: true });
      } else {
        response = await equipmentAPI.updateEquipment(itemId, { active: true });
      }

      if (response.data.success) {
        await fetchData();
        alert('Item restored successfully');
      }
    } catch (error) {
      const apiError = handleApiError(error);
      alert(apiError.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Add Product
  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.category || !newProduct.quantity) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    
    try {
      const response = await productAPI.createProduct({
        name: newProduct.name,
        sku: newProduct.sku,
        category: newProduct.category,
        quantity: parseInt(newProduct.quantity) || 0,
        unit: newProduct.unit,
        min_stock: parseInt(newProduct.minStock) || 10,
        max_stock: parseInt(newProduct.maxStock) || 100,
        reorder_point: parseInt(newProduct.reorderPoint) || 15,
        location: newProduct.location,
        supplier: newProduct.supplier,
        expiry_date: newProduct.expiryDate,
        lead_time: parseInt(newProduct.leadTime),
        notes: newProduct.notes
      });

      if (response.data.success) {
        await fetchData();
        setShowAddProductModal(false);
        resetNewProductForm();
        alert('Product added successfully!');
      }
    } catch (error) {
      const apiError = handleApiError(error);
      alert(apiError.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Add Equipment
  const handleAddEquipment = async () => {
    if (!newEquipment.name || !newEquipment.name.trim()) {
      alert('Equipment name is required');
      return;
    }
    
    if (!newEquipment.category) {
      alert('Please select a main category');
      return;
    }
    
    if (!newEquipment.total_quantity || parseInt(newEquipment.total_quantity) <= 0) {
      alert('Total quantity must be greater than 0');
      return;
    }

    setLoading(true);
    
    try {
      const equipmentData = {
        name: newEquipment.name.trim(),
        category: newEquipment.category,
        sub_category: newEquipment.sub_category || '',
        total_quantity: parseInt(newEquipment.total_quantity),
        location: newEquipment.location || '',
        supplier: newEquipment.supplier || '',
        last_maintenance: newEquipment.last_maintenance || null,
        condition: newEquipment.condition || 'Good',
        model: newEquipment.model || '',
        serial_number: newEquipment.serial_number || '',
        notes: newEquipment.notes || ''
      };
      
      Object.keys(equipmentData).forEach(key => {
        if (equipmentData[key] === undefined || equipmentData[key] === null) {
          delete equipmentData[key];
        }
      });
      
      const response = await equipmentAPI.createEquipment(equipmentData);

      if (response.data.success) {
        await fetchData();
        setShowAddEquipmentModal(false);
        resetNewEquipmentForm();
        alert('Equipment added successfully!');
      }
    } catch (error) {
      console.error('Add equipment error:', error);
      
      if (error.response?.data?.errors) {
        const validationErrors = error.response.data.errors;
        let errorMessage = 'Validation failed:\n';
        Object.keys(validationErrors).forEach(field => {
          errorMessage += `\n${field}: ${validationErrors[field].join(', ')}`;
        });
        alert(errorMessage);
      } else {
        const apiError = handleApiError(error);
        alert(apiError.message || 'Failed to add equipment. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Stock Out (Create Event)
  const handleStockOut = async () => {
    if (!newStockOut.eventName) {
      alert('Event name is required');
      return;
    }
    if (!newStockOut.eventLocation) {
      alert('Event location is required');
      return;
    }
    if (!newStockOut.dateOut) {
      alert('Date out is required');
      return;
    }
    if (!newStockOut.expectedDateIn) {
      alert('Expected return date is required');
      return;
    }
    if (!newStockOut.personResponsible) {
      alert('Person responsible is required');
      return;
    }
    if (!newStockOut.equipment || newStockOut.equipment.length === 0) {
      alert('Please add at least one equipment item');
      return;
    }

    setLoading(true);
    
    try {
      const equipmentItems = newStockOut.equipment.map(item => ({
        id: item.id,
        quantityOut: item.quantityOut
      }));

      const eventData = {
        eventName: newStockOut.eventName,
        eventLocation: newStockOut.eventLocation,
        dateOut: newStockOut.dateOut,
        expectedDateIn: newStockOut.expectedDateIn,
        personResponsible: newStockOut.personResponsible,
        contactNumber: newStockOut.contactNumber || '',
        notes: newStockOut.notes || '',
        equipment: equipmentItems
      };
      
      const response = await eventAPI.createEvent(eventData);

      if (response.data.success) {
        await fetchData();
        setShowStockOutModal(false);
        resetStockOutForm();
        alert('Event created successfully!');
      }
    } catch (error) {
      console.error('Create event error:', error);
      
      if (error.response?.data?.errors) {
        const validationErrors = error.response.data.errors;
        let errorMessage = 'Validation failed:\n';
        Object.keys(validationErrors).forEach(field => {
          errorMessage += `\n${field}: ${validationErrors[field].join(', ')}`;
        });
        alert(errorMessage);
      } else {
        const apiError = handleApiError(error);
        alert(apiError.message || 'Failed to create event');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Stock In - SIMPLIFIED VERSION
  const handleStockIn = async () => {
    if (!selectedEvent) {
      alert('No event selected');
      return;
    }
    
    // Check if equipment exists
    if (!selectedEvent.equipment || selectedEvent.equipment.length === 0) {
      alert('No equipment found for this event');
      return;
    }

    setLoading(true);
    
    try {
      // Create returns array manually
      const returns = [];
      
      for (let i = 0; i < selectedEvent.equipment.length; i++) {
        const item = selectedEvent.equipment[i];
        
        // Skip if item is invalid
        if (!item) continue;
        
        // Get the equipment ID - could be in different places
        const equipmentId = item.id || item.equipment_id;
        if (!equipmentId) {
          console.warn('⚠️ Skipping item without ID:', item);
          continue;
        }
        
        // Get values from form data
        const returned = parseInt(returnFormData?.[`${equipmentId}_returned`]) || 0;
        const damaged = parseInt(returnFormData?.[`${equipmentId}_damaged`]) || 0;
        const missing = parseInt(returnFormData?.[`${equipmentId}_missing`]) || 0;
        
        // Get quantity out
        const quantityOut = item.quantityOut || item.quantity_out || 0;
        
        // Validate
        if (returned + damaged + missing > quantityOut) {
          alert(`Warning: Total for item exceeds quantity out`);
          setLoading(false);
          return;
        }
        
        // Add to returns array
        returns.push({
          equipment_id: equipmentId,
          returned: returned,
          damaged: damaged,
          missing: missing
        });
      }
      
      console.log('📤 Sending returns:', returns);

      // Make the API call
      const response = await fetch(`http://127.0.0.1:8000/api/v1/events/${selectedEvent.event_id}/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ returns: returns })
      });
      
      const data = await response.json();
      console.log('📥 Response:', data);
      
      if (response.ok && data.success) {
        await fetchData();
        setShowStockInModal(false);
        setSelectedEvent(null);
        setReturnFormData({});
        alert('Equipment returned successfully!');
      } else {
        let errorMessage = 'Failed to return equipment';
        if (data.errors) {
          errorMessage = 'Validation failed:\n';
          Object.keys(data.errors).forEach(field => {
            errorMessage += `\n${field}: ${data.errors[field].join(', ')}`;
          });
        } else if (data.message) {
          errorMessage = data.message;
        }
        alert(errorMessage);
      }
    } catch (error) {
      console.error('❌ Error:', error);
      alert('Failed to return equipment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Reset forms
  const resetNewProductForm = () => {
    setNewProduct({
      name: '', sku: '', category: '', quantity: '', unit: 'kg',
      minStock: '', maxStock: '', reorderPoint: '', location: '',
      supplier: '', expiryDate: '', leadTime: '', notes: ''
    });
  };

  const resetNewEquipmentForm = () => {
    setNewEquipment({
      name: '',
      category: '',
      sub_category: '',
      total_quantity: '',
      location: '',
      supplier: '',
      last_maintenance: '',
      condition: 'Good',
      model: '',
      serial_number: '',
      notes: ''
    });
    setSelectedEquipmentCategory('all');
    setSelectedEquipmentSubCategory('all');
  };

  const resetStockOutForm = () => {
    setNewStockOut({
      eventName: '', eventLocation: '',
      dateOut: new Date().toISOString().slice(0, 16),
      expectedDateIn: '', personResponsible: '', contactNumber: '',
      notes: '', equipment: []
    });
    setEquipmentSelector({ equipmentId: '', quantityOut: 1 });
  };

  // Show loading skeleton for initial load
  if (initialLoad) {
    return (
      <div className="inventory-container" ref={containerRef}>
        <div className="inventory-skeleton-header"></div>
        <div className="inventory-skeleton-stats">
          {[1,2,3,4].map(i => <div key={i} className="inventory-skeleton-card"></div>)}
        </div>
        <div className="inventory-skeleton-table"></div>
      </div>
    );
  }

  return (
    <div className="inventory-container" ref={containerRef}>
      {/* Loading Overlay */}
      {loading && !initialLoad && (
        <div className="inventory-loading-overlay">
          <div className="inventory-spinner"></div>
          <p>Loading...</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="inventory-error-banner">
          <FiAlertCircle />
          <span>{error}</span>
          <button onClick={() => fetchData()}>Retry</button>
        </div>
      )}
{/* Header - Payroll Management Style */}
<motion.div 
  className="inventory-header"
  initial={{ opacity: 0, y: -20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  <div className="inventory-header-left">
    <div className="inventory-header-icon">
      <FiPackage className="inventory-main-icon" />
    </div>
    <div className="inventory-header-title">
      <h1>Inventory Management</h1>
      <p>Track ingredients, food items, and supplies</p>
    </div>
  </div>

  <div className="inventory-header-right">
    <div className="inventory-header-datetime">
      <div className="inventory-datetime-item">
        <FiCalendar className="inventory-datetime-icon" />
        <span className="inventory-datetime-value">
          {currentDateTime.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
          })}
        </span>
      </div>
      <div className="inventory-datetime-divider"></div>
      <div className="inventory-datetime-item">
        <FiClock className="inventory-datetime-icon" />
        <span className="inventory-datetime-value inventory-datetime-time">
          {currentDateTime.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
          })}
        </span>
      </div>
    </div>

    {/* Refresh Button */}
    <motion.button
      className="inventory-refresh-btn"
      whileHover={{ scale: 1.05, rotate: 180 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => fetchData()}
      title="Refresh"
    >
      <FiRefreshCw className={loading ? 'spinning' : ''} />
    </motion.button>

    {/* Notification Bell */}
    <div className="inventory-notification-wrapper">
      <motion.button
        className="inventory-notification-btn"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowNotifications(!showNotifications)}
      >
        <FiBell className="inventory-notification-icon" />
        {unreadCount > 0 && (
          <span className="inventory-notification-badge">{unreadCount}</span>
        )}
      </motion.button>

      {/* Notification Dropdown */}
      <AnimatePresence>
        {showNotifications && (
          <motion.div 
            className="inventory-notification-dropdown"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className="inventory-notification-header">
              <h3>Notifications</h3>
              {unreadCount > 0 && (
                <button className="inventory-mark-all-read" onClick={markAllAsRead}>
                  Mark all as read
                </button>
              )}
            </div>
            <div className="inventory-notification-list">
              {notifications.length > 0 ? (
                notifications.map(notif => (
                  <div
                    key={notif.id}
                    className={`inventory-notification-item ${notif.read ? 'read' : 'unread'} ${notif.type}`}
                    onClick={() => markAsRead(notif.id)}
                  >
                    <div className="inventory-notification-content">
                      <div className="inventory-notification-icon-wrapper">
                        {notif.type === 'warning' && <FiAlertCircle />}
                        {notif.type === 'info' && <FiInfo />}
                        {notif.type === 'danger' && <FiAlertTriangle />}
                        {notif.type === 'success' && <FiCheckCircle />}
                      </div>
                      <div className="inventory-notification-text">
                        <p>{notif.message}</p>
                        <span className="inventory-notification-time">{notif.time}</span>
                      </div>
                    </div>
                    {!notif.read && <div className="inventory-notification-unread-dot"></div>}
                  </div>
                ))
              ) : (
                <div className="inventory-notification-empty">
                  <FiBell />
                  <p>No notifications</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

    {/* Dynamic Action Button based on active module */}
    <div className="inventory-header-buttons">
      {activeModule === 'products' && (
        <motion.button
          className="inventory-action-btn inventory-action-btn-primary"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddProductModal(true)}
        >
          <FiPlus />
          <span>Add Product</span>
        </motion.button>
      )}
      
      {activeModule === 'equipment' && (
        <motion.button
          className="inventory-action-btn inventory-action-btn-primary"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddEquipmentModal(true)}
        >
          <FiPlus />
          <span>Add Equipment</span>
        </motion.button>
      )}
      
      {activeModule === 'events' && (
        <motion.button
          className="inventory-action-btn inventory-action-btn-primary"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowStockOutModal(true)}
        >
          <FiPlus />
          <span>Add Event</span>
        </motion.button>
      )}
    </div>
  </div>
</motion.div>

      {/* Quick Actions */}
      <motion.div 
        className="inventory-quick-actions"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1, type: 'spring' }}
      >
        <AnimatePresence>
          {selectedItems.length > 0 && (
            <motion.div 
              className="inventory-batch-actions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <span className="inventory-selected-count">{selectedItems.length} selected</span>
              {activeModule === 'equipment' && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  title="Stock Out Selected"
                >
                  <BsCartDash />
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                title="Export Selected"
              >
                <FiDownload />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Module Navigation */}
      <div className="inventory-module-nav">
        <motion.button
          className={`inventory-module-btn inventory-module-btn-product ${activeModule === 'products' ? 'active' : ''}`}
          onClick={() => {
            setActiveModule('products');
            setCurrentPage(1);
            setSearchTerm('');
            setSelectedCategory('all');
          }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.95 }}
        >
          <FiPackage />
          <span>Products</span>
          <span className="inventory-module-badge">{stats.products.total}</span>
        </motion.button>
        
        <motion.button
          className={`inventory-module-btn inventory-module-btn-equipment ${activeModule === 'equipment' ? 'active' : ''}`}
          onClick={() => {
            setActiveModule('equipment');
            setCurrentPage(1);
            setSearchTerm('');
            setSelectedCategory('all');
          }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.95 }}
        >
          <AiFillProduct />
          <span>Equipment</span>
          <span className="inventory-module-badge">{stats.equipment.total}</span>
        </motion.button>
        
        <motion.button
          className={`inventory-module-btn inventory-module-btn-event ${activeModule === 'events' ? 'active' : ''}`}
          onClick={() => {
            setActiveModule('events');
            setCurrentPage(1);
            setSearchTerm('');
            setActiveEventTab('ongoing');
          }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.95 }}
        >
          <BsCalendarEvent />
          <span>Events</span>
          <span className="inventory-module-badge">{events.length}</span>
        </motion.button>
      </div>

      {/* Active/Inactive Toggle */}
      {activeModule !== 'events' && (
        <div className="inventory-toggle-section">
          <div className="inventory-toggle-buttons">
            <motion.button
              className={`inventory-toggle-btn ${showActive ? 'active' : ''}`}
              onClick={() => {
                setShowActive(true);
                setShowInactive(false);
                setCurrentPage(1);
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FiCheckCircle />
              <span>Active Items</span>
            </motion.button>
            <motion.button
              className={`inventory-toggle-btn ${showInactive ? 'active' : ''}`}
              onClick={() => {
                setShowActive(false);
                setShowInactive(true);
                setCurrentPage(1);
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FiArchive />
              <span>Archived Items</span>
            </motion.button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <motion.div 
        className="inventory-stats-grid"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        {activeModule === 'products' && (
          <>
            <motion.div className="inventory-stat-card inventory-stat-card-product" whileHover={{ scale: 1.02, y: -5 }}>
              <div className="inventory-stat-icon inventory-stat-icon-total">
                <FiPackage />
              </div>
              <div className="inventory-stat-info">
                <h3>Total Items</h3>
                <p className="inventory-stat-value">{stats.products.total}</p>
                <p className="inventory-stat-label">product types</p>
              </div>
              <div className="inventory-stat-trend inventory-stat-trend-up">
                <FiTrendingUp />
                <span>+5%</span>
              </div>
            </motion.div>

            <motion.div className="inventory-stat-card" whileHover={{ scale: 1.02, y: -5 }}>
              <div className="inventory-stat-icon inventory-stat-icon-warning">
                <FiAlertCircle />
              </div>
              <div className="inventory-stat-info">
                <h3>Low Stock</h3>
                <p className="inventory-stat-value">{stats.products.lowStock}</p>
                <p className="inventory-stat-label">items need reorder</p>
              </div>
              <div className="inventory-stat-trend inventory-stat-trend-down">
                <FiTrendingDown />
                <span>+2%</span>
              </div>
            </motion.div>

            <motion.div className="inventory-stat-card" whileHover={{ scale: 1.02, y: -5 }}>
              <div className="inventory-stat-icon inventory-stat-icon-danger">
                <FiXCircle />
              </div>
              <div className="inventory-stat-info">
                <h3>Out of Stock</h3>
                <p className="inventory-stat-value">{stats.products.outOfStock}</p>
                <p className="inventory-stat-label">items unavailable</p>
              </div>
              <div className="inventory-stat-trend inventory-stat-trend-down">
                <FiTrendingDown />
                <span>-1%</span>
              </div>
            </motion.div>

            <motion.div className="inventory-stat-card" whileHover={{ scale: 1.02, y: -5 }}>
              <div className="inventory-stat-icon inventory-stat-icon-expiring">
                <FiClock />
              </div>
              <div className="inventory-stat-info">
                <h3>Expiring Soon</h3>
                <p className="inventory-stat-value">{stats.products.expiring}</p>
                <p className="inventory-stat-label">items within 7 days</p>
              </div>
              <div className="inventory-stat-trend inventory-stat-trend-down">
                <FiTrendingDown />
                <span>+3</span>
              </div>
            </motion.div>
          </>
        )}

        {activeModule === 'equipment' && (
          <>
            <motion.div className="inventory-stat-card inventory-stat-card-equipment" whileHover={{ scale: 1.02, y: -5 }}>
              <div className="inventory-stat-icon inventory-stat-icon-equipment">
                <AiFillProduct />
              </div>
              <div className="inventory-stat-info">
                <h3>Total Equipment</h3>
                <p className="inventory-stat-value">{stats.equipment.total}</p>
                <p className="inventory-stat-label">equipment types</p>
              </div>
              <div className="inventory-stat-trend inventory-stat-trend-up">
                <FiTrendingUp />
                <span>+2%</span>
              </div>
            </motion.div>

            <motion.div className="inventory-stat-card" whileHover={{ scale: 1.02, y: -5 }}>
              <div className="inventory-stat-icon inventory-stat-icon-inuse">
                <FiClock />
              </div>
              <div className="inventory-stat-info">
                <h3>In Use</h3>
                <p className="inventory-stat-value">{stats.equipment.inUse}</p>
                <p className="inventory-stat-label">pieces currently used</p>
              </div>
              <div className="inventory-stat-trend inventory-stat-trend-up">
                <FiTrendingUp />
                <span>+12</span>
              </div>
            </motion.div>

            <motion.div className="inventory-stat-card" whileHover={{ scale: 1.02, y: -5 }}>
              <div className="inventory-stat-icon inventory-stat-icon-available">
                <FiCheckCircle />
              </div>
              <div className="inventory-stat-info">
                <h3>Available</h3>
                <p className="inventory-stat-value">{stats.equipment.available}</p>
                <p className="inventory-stat-label">pieces ready to use</p>
              </div>
              <div className="inventory-stat-trend inventory-stat-trend-up">
                <FiTrendingUp />
                <span>+5%</span>
              </div>
            </motion.div>

            <motion.div className="inventory-stat-card" whileHover={{ scale: 1.02, y: -5 }}>
              <div className="inventory-stat-icon inventory-stat-icon-danger">
                <FiAlertCircle />
              </div>
              <div className="inventory-stat-info">
                <h3>Damaged/Missing</h3>
                <p className="inventory-stat-value">{stats.equipment.damaged + stats.equipment.missing}</p>
                <p className="inventory-stat-label">needs attention</p>
              </div>
              <div className="inventory-stat-trend inventory-stat-trend-down">
                <FiTrendingDown />
                <span>+3</span>
              </div>
            </motion.div>
          </>
        )}

        {activeModule === 'events' && (
          <>
            <motion.div className="inventory-stat-card inventory-stat-card-event" whileHover={{ scale: 1.02, y: -5 }}>
              <div className="inventory-stat-icon inventory-stat-icon-event">
                <FiClock />
              </div>
              <div className="inventory-stat-info">
                <h3>Ongoing</h3>
                <p className="inventory-stat-value">{stats.events.ongoing}</p>
                <p className="inventory-stat-label">active events</p>
              </div>
              <div className="inventory-stat-trend inventory-stat-trend-up">
                <FiTrendingUp />
                <span>+2</span>
              </div>
            </motion.div>

            <motion.div className="inventory-stat-card" whileHover={{ scale: 1.02, y: -5 }}>
              <div className="inventory-stat-icon inventory-stat-icon-upcoming">
                <FiCalendar />
              </div>
              <div className="inventory-stat-info">
                <h3>Upcoming</h3>
                <p className="inventory-stat-value">{stats.events.upcoming}</p>
                <p className="inventory-stat-label">scheduled events</p>
              </div>
              <div className="inventory-stat-trend inventory-stat-trend-up">
                <FiTrendingUp />
                <span>+3</span>
              </div>
            </motion.div>

            <motion.div className="inventory-stat-card" whileHover={{ scale: 1.02, y: -5 }}>
              <div className="inventory-stat-icon inventory-stat-icon-completed">
                <FiCheckCircle />
              </div>
              <div className="inventory-stat-info">
                <h3>Completed</h3>
                <p className="inventory-stat-value">{stats.events.completed}</p>
                <p className="inventory-stat-label">this month</p>
              </div>
              <div className="inventory-stat-trend inventory-stat-trend-up">
                <FiTrendingUp />
                <span>+5</span>
              </div>
            </motion.div>

            <motion.div className="inventory-stat-card" whileHover={{ scale: 1.02, y: -5 }}>
              <div className="inventory-stat-icon inventory-stat-icon-danger">
                <FiAlertCircle />
              </div>
              <div className="inventory-stat-info">
                <h3>Overdue</h3>
                <p className="inventory-stat-value">{stats.events.overdue}</p>
                <p className="inventory-stat-label">need return</p>
              </div>
              <div className="inventory-stat-trend inventory-stat-trend-down">
                <FiTrendingDown />
                <span>-1</span>
              </div>
            </motion.div>
          </>
        )}
      </motion.div>

      {/* Sub Navigation Tabs */}
      {activeModule === 'products' && (
        <div className="inventory-sub-tabs">
          {[
            { id: 'all', name: 'All Products', count: productCounts.all },
            { id: 'in-stock', name: 'In Stock', count: productCounts.inStock },
            { id: 'low-stock', name: 'Low Stock', count: productCounts.lowStock },
            { id: 'out-of-stock', name: 'Out of Stock', count: productCounts.outOfStock },
            { id: 'over-stock', name: 'Over Stock', count: productCounts.overStock },
            { id: 'expiring', name: 'Expiring Soon', count: productCounts.expiring },
            { id: 'active', name: 'Active', count: productCounts.active },
            { id: 'inactive', name: 'Inactive', count: productCounts.inactive }
          ].map(cat => (
            <motion.button
              key={cat.id}
              className={`inventory-sub-tab-btn ${activeProductTab === cat.id ? 'active' : ''}`}
              onClick={() => {
                setActiveProductTab(cat.id);
                setSelectedCategory(cat.id);
                setCurrentPage(1);
              }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <span>{cat.name}</span>
              <span className="inventory-sub-tab-count">{cat.count}</span>
            </motion.button>
          ))}
        </div>
      )}

      {activeModule === 'equipment' && (
        <div className="inventory-sub-tabs">
          {[
            { id: 'all', name: 'All Equipment', count: equipmentCounts.all },
            { id: 'available', name: 'Available', count: equipmentCounts.available },
            { id: 'in-use', name: 'In Use', count: equipmentCounts.inUse },
            { id: 'damaged', name: 'Damaged', count: equipmentCounts.damaged },
            { id: 'missing', name: 'Missing', count: equipmentCounts.missing },
            { id: 'maintenance', name: 'Needs Maintenance', count: equipmentCounts.maintenance }
          ].map(cat => (
            <motion.button
              key={cat.id}
              className={`inventory-sub-tab-btn ${activeEquipmentTab === cat.id ? 'active' : ''}`}
              onClick={() => {
                setActiveEquipmentTab(cat.id);
                setSelectedCategory(cat.id);
                setCurrentPage(1);
              }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <span>{cat.name}</span>
              <span className="inventory-sub-tab-count">{cat.count}</span>
            </motion.button>
          ))}
        </div>
      )}

      {activeModule === 'events' && (
        <div className="inventory-sub-tabs">
          <motion.button
            className={`inventory-sub-tab-btn ${activeEventTab === 'ongoing' ? 'active' : ''}`}
            onClick={() => {
              setActiveEventTab('ongoing');
              setCurrentPage(1);
            }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <FiClock />
            <span>Ongoing</span>
            <span className="inventory-sub-tab-count">{stats.events.ongoing}</span>
          </motion.button>
          <motion.button
            className={`inventory-sub-tab-btn ${activeEventTab === 'upcoming' ? 'active' : ''}`}
            onClick={() => {
              setActiveEventTab('upcoming');
              setCurrentPage(1);
            }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <FiCalendar />
            <span>Upcoming</span>
            <span className="inventory-sub-tab-count">{stats.events.upcoming}</span>
          </motion.button>
          <motion.button
            className={`inventory-sub-tab-btn ${activeEventTab === 'completed' ? 'active' : ''}`}
            onClick={() => {
              setActiveEventTab('completed');
              setCurrentPage(1);
            }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <FiCheckCircle />
            <span>Completed</span>
            <span className="inventory-sub-tab-count">{stats.events.completed}</span>
          </motion.button>
          <motion.button
            className={`inventory-sub-tab-btn ${activeEventTab === 'overdue' ? 'active' : ''}`}
            onClick={() => {
              setActiveEventTab('overdue');
              setCurrentPage(1);
            }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <FiAlertCircle />
            <span>Overdue</span>
            <span className="inventory-sub-tab-count">{stats.events.overdue}</span>
          </motion.button>
        </div>
      )}

      {/* Search and Filter Bar */}
      <motion.div 
        className="inventory-search-filter-bar"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="inventory-search-wrapper">
          <FiSearch className="inventory-search-icon" />
          <input
            type="text"
            placeholder={
              activeModule === 'products' ? "Search by ID, name, SKU, or category..." :
              activeModule === 'equipment' ? "Search by ID, name, category, or sub-category..." :
              "Search by event ID, name, location, or person..."
            }
            value={searchTerm || ''}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="inventory-search-input"
          />
          {searchTerm && (
            <motion.button
              className="inventory-clear-search"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              onClick={() => setSearchTerm('')}
            >
              <FiXCircle />
            </motion.button>
          )}
        </div>

        <div className="inventory-filter-actions">
          <motion.button
            className={`inventory-filter-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FiFilter />
            <span>Filters</span>
            {selectedCategory !== 'all' && (
              <motion.span 
                className="inventory-filter-badge"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                1
              </motion.span>
            )}
          </motion.button>

          {activeModule !== 'events' && (
            <div className="inventory-view-toggle">
              <motion.button
                className={`inventory-view-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <FiList />
              </motion.button>
              <motion.button
                className={`inventory-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <FiGrid />
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Category Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div 
            className="inventory-filters-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="inventory-filters-header">
              <h3>Filter by Category</h3>
              <motion.button
                className="inventory-close-filters"
                onClick={() => setShowFilters(false)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <FiXCircle />
              </motion.button>
            </div>

            <div className="inventory-filters-content">
              {activeModule === 'products' && (
                <div className="inventory-category-grid">
                  <motion.button
                    className={`inventory-category-chip ${selectedProductCategory === 'all' ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedProductCategory('all');
                      setSelectedCategory('all');
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className="inventory-category-icon">📦</span>
                    <span className="inventory-category-name">All Products</span>
                    <span className="inventory-category-count">{products.length}</span>
                  </motion.button>
                  {updateCategoryCounts(products, 'product')
                    .filter(c => c.type === 'product')
                    .map(cat => (
                      <motion.button
                        key={cat.id}
                        className={`inventory-category-chip ${selectedProductCategory === cat.id ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedProductCategory(cat.id);
                          setSelectedCategory(cat.name);
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <span className="inventory-category-icon">{cat.icon}</span>
                        <span className="inventory-category-name">{cat.name}</span>
                        <span className="inventory-category-count">{cat.count}</span>
                      </motion.button>
                    ))}
                </div>
              )}

              {activeModule === 'equipment' && (
                <div className="inventory-category-tree">
                  <motion.button
                    className={`inventory-category-chip ${selectedEquipmentCategory === 'all' ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedEquipmentCategory('all');
                      setSelectedCategory('all');
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className="inventory-category-icon">🔧</span>
                    <span className="inventory-category-name">All Equipment</span>
                    <span className="inventory-category-count">{equipment.length}</span>
                  </motion.button>
                  {getEquipmentMainCategories().map(mainCat => (
                    <div key={mainCat} className="inventory-main-category">
                      <h4>{mainCat}</h4>
                      <div className="inventory-sub-category-grid">
                        {getSubCategoriesByMain(mainCat).map(subCat => (
                          <motion.button
                            key={subCat.id}
                            className={`inventory-category-chip ${selectedEquipmentSubCategory === subCat.id ? 'active' : ''}`}
                            onClick={() => {
                              setSelectedEquipmentSubCategory(subCat.id);
                              setSelectedCategory(subCat.name);
                            }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <span className="inventory-category-icon">{subCat.icon}</span>
                            <span className="inventory-category-name">{subCat.name}</span>
                            <span className="inventory-category-count">{subCat.count}</span>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="inventory-table-container">
        {/* Products Table View */}
        {activeModule === 'products' && viewMode === 'table' && (
          <div className="inventory-list">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th style={{ width: '30px' }}>
                    <input 
                      type="checkbox"
                      checked={selectedItems.length === paginatedItems.length && paginatedItems.length > 0}
                      onChange={() => {
                        if (selectedItems.length === paginatedItems.length) {
                          setSelectedItems([]);
                        } else {
                          setSelectedItems(paginatedItems.map(item => item?.product_id).filter(Boolean));
                        }
                      }}
                    />
                  </th>
                  <th>Product ID</th>
                  <th>Product Name</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Quantity</th>
                  <th>Expiration Date</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item, index) => {
                  if (!item) return null;
                  const status = getStatusDetails(item.status);
                  const StatusIcon = status.icon;
                  const expiringSoon = isExpiringSoon(item.expiry_date);
                  
                  return (
                    <motion.tr
                      key={item.product_id || index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ backgroundColor: 'var(--hover-bg)' }}
                      className={selectedItems.includes(item.product_id) ? 'inventory-selected' : ''}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox"
                          checked={selectedItems.includes(item.product_id)}
                          onChange={() => {
                            if (selectedItems.includes(item.product_id)) {
                              setSelectedItems(selectedItems.filter(id => id !== item.product_id));
                            } else {
                              setSelectedItems([...selectedItems, item.product_id]);
                            }
                          }}
                        />
                      </td>
                      <td><span className="inventory-item-id">{item.product_id}</span></td>
                      <td>
                        <div className="inventory-list-item-name">
                          <span>{item.name}</span>
                          {!item.active && <span className="inventory-status-badge inventory-status-badge-inactive">Archived</span>}
                        </div>
                      </td>
                      <td>{item.sku || '-'}</td>
                      <td>{item.category}</td>
                      <td>
                        <div className="inventory-quantity-badge">
                          <span className="inventory-quantity-value">{item.quantity || 0}</span>
                          <span className="inventory-quantity-unit">{item.unit}</span>
                        </div>
                        <div className="inventory-table-progress">
                          <motion.div 
                            className={`inventory-progress-fill ${item.status}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(((item.quantity || 0) / (item.max_stock || 100)) * 100, 100)}%` }}
                            transition={{ duration: 1 }}
                          />
                        </div>
                      </td>
                      <td>
                        {item.expiry_date ? (
                          <span style={{ color: expiringSoon ? '#ef4444' : 'inherit' }}>
                            {new Date(item.expiry_date).toLocaleDateString()}
                            {expiringSoon && <FiAlertCircle style={{ marginLeft: 4, color: '#ef4444' }} />}
                          </span>
                        ) : '-'}
                      </td>
                      <td>{item.location || '-'}</td>
                      <td>
                        <div className={`inventory-status-badge ${item.active ? item.status : 'inactive'}`}>
                          <StatusIcon />
                          <span>{item.active ? status.text : 'Archived'}</span>
                        </div>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="inventory-action-buttons">
                          <motion.button
                            className="inventory-action-icon-btn"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleViewDetails(item)}
                            data-tooltip="View Details"
                          >
                            <FiEye />
                          </motion.button>
                          <motion.button
                            className="inventory-action-icon-btn"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleEdit(item)}
                            data-tooltip="Edit"
                          >
                            <FiEdit2 />
                          </motion.button>
                          {item.active ? (
                            <motion.button
                              className="inventory-action-icon-btn inventory-action-icon-btn-archive"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleArchive(item.product_id)}
                              data-tooltip="Archive"
                            >
                              <FiArchive />
                            </motion.button>
                          ) : (
                            <motion.button
                              className="inventory-action-icon-btn inventory-action-icon-btn-restore"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleRestore(item.product_id)}
                              data-tooltip="Restore"
                            >
                              <FiRefreshCw />
                            </motion.button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Equipment Table View */}
        {activeModule === 'equipment' && viewMode === 'table' && (
          <div className="inventory-list">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th style={{ width: '30px' }}>
                    <input 
                      type="checkbox"
                      checked={selectedItems.length === paginatedItems.length && paginatedItems.length > 0}
                      onChange={() => {
                        if (selectedItems.length === paginatedItems.length) {
                          setSelectedItems([]);
                        } else {
                          setSelectedItems(paginatedItems.map(item => item?.equipment_id).filter(Boolean));
                        }
                      }}
                    />
                  </th>
                  <th>Equipment ID</th>
                  <th>Equipment Name</th>
                  <th>Category</th>
                  <th>Total</th>
                  <th>In Use</th>
                  <th>Available</th>
                  <th>Damaged</th>
                  <th>Missing</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item, index) => {
                  if (!item) return null;
                  const status = getStatusDetails(item.status);
                  const StatusIcon = status.icon;
                  
                  return (
                    <motion.tr
                      key={item.equipment_id || index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ backgroundColor: 'var(--hover-bg)' }}
                      className={selectedItems.includes(item.equipment_id) ? 'inventory-selected' : ''}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox"
                          checked={selectedItems.includes(item.equipment_id)}
                          onChange={() => {
                            if (selectedItems.includes(item.equipment_id)) {
                              setSelectedItems(selectedItems.filter(id => id !== item.equipment_id));
                            } else {
                              setSelectedItems([...selectedItems, item.equipment_id]);
                            }
                          }}
                        />
                      </td>
                      <td><span className="inventory-item-id">{item.equipment_id}</span></td>
                      <td>
                        <div className="inventory-list-item-name">
                          <span>{item.name}</span>
                          {item.sub_category && <span className="inventory-item-id" style={{ marginLeft: 8 }}>{item.sub_category}</span>}
                          {!item.active && <span className="inventory-status-badge inventory-status-badge-inactive">Archived</span>}
                        </div>
                      </td>
                      <td>{item.category}</td>
                      <td>{item.total_quantity || 0}</td>
                      <td style={{ color: '#f59e0b' }}>{item.in_use || 0}</td>
                      <td style={{ color: '#10b981' }}>{item.available || 0}</td>
                      <td style={{ color: '#ef4444' }}>{item.damaged || 0}</td>
                      <td style={{ color: '#f59e0b' }}>{item.missing || 0}</td>
                      <td>
                        <div className={`inventory-status-badge ${item.active ? item.status : 'inactive'}`}>
                          <StatusIcon />
                          <span>{item.active ? status.text : 'Archived'}</span>
                        </div>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="inventory-action-buttons">
                          <motion.button
                            className="inventory-action-icon-btn"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleViewDetails(item)}
                            data-tooltip="View Details"
                          >
                            <FiEye />
                          </motion.button>
                          <motion.button
                            className="inventory-action-icon-btn"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleEdit(item)}
                            data-tooltip="Edit"
                          >
                            <FiEdit2 />
                          </motion.button>
                          <motion.button
                            className="inventory-action-icon-btn"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => {
                              if (item.status === 'available') {
                                const date = prompt('Enter maintenance date (YYYY-MM-DD):');
                                if (date) {
                                  equipmentAPI.scheduleMaintenance(item.equipment_id, {
                                    maintenance_date: date,
                                    quantity: 1
                                  }).then(() => {
                                    fetchData();
                                    alert('Maintenance scheduled');
                                  }).catch(() => {
                                    alert('Failed to schedule maintenance');
                                  });
                                }
                              }
                            }}
                            data-tooltip="Schedule Maintenance"
                          >
                            <FiTool />
                          </motion.button>
                          {item.active ? (
                            <motion.button
                              className="inventory-action-icon-btn inventory-action-icon-btn-archive"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleArchive(item.equipment_id)}
                              data-tooltip="Archive"
                            >
                              <FiArchive />
                            </motion.button>
                          ) : (
                            <motion.button
                              className="inventory-action-icon-btn inventory-action-icon-btn-restore"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleRestore(item.equipment_id)}
                              data-tooltip="Restore"
                            >
                              <FiRefreshCw />
                            </motion.button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Events Grid View */}
        {activeModule === 'events' && (
          <div className="inventory-event-grid">
            {paginatedItems.map((event, index) => {
              if (!event) return null;
              const status = getStatusDetails(event.status);
              const StatusIcon = status.icon;
              
              return (
                <motion.div
                  key={event.event_id || index}
                  className="inventory-event-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02, y: -5 }}
                >
                  <div className="inventory-event-header">
                    <span className="inventory-event-id">{event.event_id}</span>
                    <div className={`inventory-status-badge ${event.status}`}>
                      <StatusIcon />
                      <span>{status.text}</span>
                    </div>
                  </div>
                  
                  <h3 className="inventory-event-name">{event.name}</h3>
                  
                  <div className="inventory-event-details">
                    <div className="inventory-event-detail-item">
                      <BsGeoAlt />
                      <span>{event.location}</span>
                    </div>
                    <div className="inventory-event-detail-item">
                      <FiCalendar />
                      <span>Out: {event.date_out ? new Date(event.date_out).toLocaleString() : 'N/A'}</span>
                    </div>
                    <div className="inventory-event-detail-item">
                      <FiClock />
                      <span>Expected: {event.expected_date_in ? new Date(event.expected_date_in).toLocaleString() : 'N/A'}</span>
                    </div>
                    {event.actual_date_in && (
                      <div className="inventory-event-detail-item">
                        <FiCheckCircle style={{ color: '#10b981' }} />
                        <span>Returned: {new Date(event.actual_date_in).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="inventory-event-detail-item">
                      <FiUser />
                      <span>{event.person_responsible}</span>
                    </div>
                  </div>

                  <div className="inventory-event-meta">
                    <div className="inventory-event-items-count">
                      <FiPackage />
                      <span>{event.equipment?.length || 0} items</span>
                    </div>
                    <div className="inventory-event-actions">
                      <motion.button
                        className="inventory-action-icon-btn"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          setSelectedEvent(event);
                          setShowItemDetails(true);
                        }}
                        data-tooltip="View Details"
                      >
                        <FiEye />
                      </motion.button>
                      {event.status === 'ongoing' && (
                        <motion.button
                          className="inventory-action-icon-btn"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => {
                            setSelectedEvent(event);
                            setShowStockInModal(true);
                          }}
                          data-tooltip="Return Equipment"
                        >
                          <BsArrowReturnLeft />
                        </motion.button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {paginatedItems.length === 0 && (
          <motion.div 
            className="inventory-empty-state"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            {activeModule === 'products' && <FiPackage className="inventory-empty-icon" />}
            {activeModule === 'equipment' && <AiFillProduct className="inventory-empty-icon" />}
            {activeModule === 'events' && <BsCalendarEvent className="inventory-empty-icon" />}
            <h3>No items found</h3>
            <p>Try adjusting your search or filter criteria</p>
            <motion.button
              className="inventory-clear-filters-btn"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
                setCurrentPage(1);
              }}
            >
              Clear Filters
            </motion.button>
          </motion.div>
        )}
      </div>

      {/* Pagination */}
      {currentItems.length > 0 && (
        <motion.div 
          className="inventory-pagination"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="inventory-pagination-info">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, currentItems.length)} of {currentItems.length} items
          </div>
          
          <div className="inventory-pagination-controls">
            <motion.button
              className="inventory-pagination-btn"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <FiChevronLeft />
            </motion.button>
            
            {[...Array(Math.min(totalPages, 5))].map((_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <motion.button
                  key={i}
                  className={`inventory-pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {pageNum}
                </motion.button>
              );
            })}
            
            <motion.button
              className="inventory-pagination-btn"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <FiChevronRight />
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Add Product Modal */}
      <AnimatePresence>
        {showAddProductModal && (
          <motion.div 
            className="inventory-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAddProductModal(false)}
          >
            <motion.div 
              className="inventory-modal-content inventory-add-modal"
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="inventory-modal-header">
                <h2><FiPackage /> Add New Product</h2>
                <motion.button
                  className="inventory-close-modal"
                  onClick={() => setShowAddProductModal(false)}
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <FiXCircle />
                </motion.button>
              </div>

              <div className="inventory-modal-body">
                <div className="inventory-add-form">
                  <div className="inventory-form-row">
                    <div className="inventory-form-group">
                      <label><FiPackage /> Product Name *</label>
                      <input
                        type="text"
                        className="inventory-form-control"
                        value={newProduct.name || ''}
                        onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                        placeholder="Enter product name"
                      />
                    </div>
                    <div className="inventory-form-group">
                      <label><FiTag /> SKU</label>
                      <input
                        type="text"
                        className="inventory-form-control"
                        value={newProduct.sku || ''}
                        onChange={(e) => setNewProduct({...newProduct, sku: e.target.value})}
                        placeholder="Stock keeping unit"
                      />
                    </div>
                  </div>

                  <div className="inventory-form-row">
                    <div className="inventory-form-group">
                      <label><FiLayers /> Category *</label>
                      <select
                        className="inventory-form-control"
                        value={newProduct.category || ''}
                        onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                      >
                        <option value="">Select Category</option>
                        {categories
                          .filter(c => c.type === 'product')
                          .map(cat => (
                            <option key={cat.id} value={cat.name}>
                              {cat.icon} {cat.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="inventory-form-group">
                      <label><FiBox /> Unit</label>
                      <select
                        className="inventory-form-control"
                        value={newProduct.unit || 'kg'}
                        onChange={(e) => setNewProduct({...newProduct, unit: e.target.value})}
                      >
                        <option value="kg">Kilograms (kg)</option>
                        <option value="g">Grams (g)</option>
                        <option value="L">Liters (L)</option>
                        <option value="ml">Milliliters (ml)</option>
                        <option value="pcs">Pieces (pcs)</option>
                        <option value="boxes">Boxes</option>
                        <option value="bags">Bags</option>
                      </select>
                    </div>
                  </div>

                  <div className="inventory-form-row">
                    <div className="inventory-form-group">
                      <label><FiPackage /> Quantity *</label>
                      <input
                        type="number"
                        className="inventory-form-control"
                        value={newProduct.quantity || ''}
                        onChange={(e) => setNewProduct({...newProduct, quantity: e.target.value})}
                        placeholder="Enter quantity"
                        min="0"
                      />
                    </div>
                    <div className="inventory-form-group">
                      <label><FiMapPin /> Location</label>
                      <input
                        type="text"
                        className="inventory-form-control"
                        value={newProduct.location || ''}
                        onChange={(e) => setNewProduct({...newProduct, location: e.target.value})}
                        placeholder="e.g., Aisle A, Shelf 3"
                      />
                    </div>
                  </div>

                  <div className="inventory-form-row">
                    <div className="inventory-form-group">
                      <label><FiAlertCircle /> Min Stock</label>
                      <input
                        type="number"
                        className="inventory-form-control"
                        value={newProduct.minStock || ''}
                        onChange={(e) => setNewProduct({...newProduct, minStock: e.target.value})}
                        placeholder="Minimum stock level"
                        min="0"
                      />
                    </div>
                    <div className="inventory-form-group">
                      <label><FiTrendingUp /> Max Stock</label>
                      <input
                        type="number"
                        className="inventory-form-control"
                        value={newProduct.maxStock || ''}
                        onChange={(e) => setNewProduct({...newProduct, maxStock: e.target.value})}
                        placeholder="Maximum stock level"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="inventory-form-row">
                    <div className="inventory-form-group">
                      <label><FiShoppingBag /> Reorder Point</label>
                      <input
                        type="number"
                        className="inventory-form-control"
                        value={newProduct.reorderPoint || ''}
                        onChange={(e) => setNewProduct({...newProduct, reorderPoint: e.target.value})}
                        placeholder="Reorder at"
                        min="0"
                      />
                    </div>
                    <div className="inventory-form-group">
                      <label><FiTruck /> Supplier</label>
                      <input
                        type="text"
                        className="inventory-form-control"
                        value={newProduct.supplier || ''}
                        onChange={(e) => setNewProduct({...newProduct, supplier: e.target.value})}
                        placeholder="Supplier name"
                      />
                    </div>
                  </div>

                  <div className="inventory-form-row">
                    <div className="inventory-form-group">
                      <label><FiCalendar /> Expiry Date</label>
                      <input
                        type="date"
                        className="inventory-form-control"
                        value={newProduct.expiryDate || ''}
                        onChange={(e) => setNewProduct({...newProduct, expiryDate: e.target.value})}
                      />
                    </div>
                    <div className="inventory-form-group">
                      <label><FiClock /> Lead Time (days)</label>
                      <input
                        type="number"
                        className="inventory-form-control"
                        value={newProduct.leadTime || ''}
                        onChange={(e) => setNewProduct({...newProduct, leadTime: e.target.value})}
                        placeholder="Lead time in days"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="inventory-form-group">
                    <label><BsFileText /> Notes</label>
                    <textarea
                      className="inventory-form-control"
                      rows="3"
                      value={newProduct.notes || ''}
                      onChange={(e) => setNewProduct({...newProduct, notes: e.target.value})}
                      placeholder="Additional notes..."
                    />
                  </div>
                </div>
              </div>

              <div className="inventory-modal-footer">
                <motion.button
                  className="inventory-modal-btn inventory-modal-btn-secondary"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowAddProductModal(false)}
                >
                  Cancel
                </motion.button>
                <motion.button
                  className="inventory-modal-btn inventory-modal-btn-primary"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAddProduct}
                  disabled={loading}
                >
                  {loading ? 'Adding...' : 'Add Product'}
                  {!loading && <FiPlus />}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Equipment Modal */}
      <AnimatePresence>
        {showAddEquipmentModal && (
          <motion.div 
            className="inventory-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAddEquipmentModal(false)}
          >
            <motion.div 
              className="inventory-modal-content inventory-add-modal"
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="inventory-modal-header">
                <h2><GiSpoon /> Add New Equipment</h2>
                <motion.button
                  className="inventory-close-modal"
                  onClick={() => setShowAddEquipmentModal(false)}
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <FiXCircle />
                </motion.button>
              </div>

              <div className="inventory-modal-body">
                <div className="inventory-add-form">
                  <div className="inventory-form-row">
                    <div className="inventory-form-group">
                      <label><FiPackage /> Equipment Name *</label>
                      <input
                        type="text"
                        className="inventory-form-control"
                        value={newEquipment.name || ''}
                        onChange={(e) => setNewEquipment({...newEquipment, name: e.target.value})}
                        placeholder="Enter equipment name"
                      />
                    </div>
                    <div className="inventory-form-group">
                      <label>Model</label>
                      <input
                        type="text"
                        className="inventory-form-control"
                        value={newEquipment.model || ''}
                        onChange={(e) => setNewEquipment({...newEquipment, model: e.target.value})}
                        placeholder="Model (optional)"
                      />
                    </div>
                  </div>

                  <div className="inventory-form-row">
                    <div className="inventory-form-group">
                      <label><FiLayers /> Main Category *</label>
                      <select
                        className="inventory-form-control"
                        value={newEquipment.category || ''}
                        onChange={(e) => {
                          setNewEquipment({...newEquipment, category: e.target.value, sub_category: ''});
                        }}
                      >
                        <option value="">Select Category</option>
                        {getEquipmentMainCategories().map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div className="inventory-form-group">
                      <label><FiLayers /> Sub Category</label>
                      <select
                        className="inventory-form-control"
                        value={newEquipment.sub_category || ''}
                        onChange={(e) => setNewEquipment({...newEquipment, sub_category: e.target.value})}
                        disabled={!newEquipment.category}
                      >
                        <option value="">Select Sub Category</option>
                        {getSubCategoriesByMain(newEquipment.category).map(cat => (
                          <option key={cat.id} value={cat.name}>
                            {cat.icon} {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="inventory-form-row">
                    <div className="inventory-form-group">
                      <label>Serial Number</label>
                      <input
                        type="text"
                        className="inventory-form-control"
                        value={newEquipment.serial_number || ''}
                        onChange={(e) => setNewEquipment({...newEquipment, serial_number: e.target.value})}
                        placeholder="Serial number (optional)"
                      />
                    </div>
                    <div className="inventory-form-group">
                      <label><FiBox /> Total Quantity *</label>
                      <input
                        type="number"
                        className="inventory-form-control"
                        value={newEquipment.total_quantity || ''}
                        onChange={(e) => setNewEquipment({...newEquipment, total_quantity: e.target.value})}
                        placeholder="Total quantity"
                        min="1"
                      />
                    </div>
                  </div>

                  <div className="inventory-form-row">
                    <div className="inventory-form-group">
                      <label><FiMapPin /> Location</label>
                      <input
                        type="text"
                        className="inventory-form-control"
                        value={newEquipment.location || ''}
                        onChange={(e) => setNewEquipment({...newEquipment, location: e.target.value})}
                        placeholder="Storage location"
                      />
                    </div>
                    <div className="inventory-form-group">
                      <label><FiTruck /> Supplier</label>
                      <input
                        type="text"
                        className="inventory-form-control"
                        value={newEquipment.supplier || ''}
                        onChange={(e) => setNewEquipment({...newEquipment, supplier: e.target.value})}
                        placeholder="Supplier name"
                      />
                    </div>
                  </div>

                  <div className="inventory-form-row">
                    <div className="inventory-form-group">
                      <label><FiCalendar /> Last Maintenance</label>
                      <input
                        type="date"
                        className="inventory-form-control"
                        value={newEquipment.last_maintenance || ''}
                        onChange={(e) => setNewEquipment({...newEquipment, last_maintenance: e.target.value})}
                      />
                    </div>
                    <div className="inventory-form-group">
                      <label><FiCheckCircle /> Condition</label>
                      <select
                        className="inventory-form-control"
                        value={newEquipment.condition || 'Good'}
                        onChange={(e) => setNewEquipment({...newEquipment, condition: e.target.value})}
                      >
                        <option value="Excellent">Excellent</option>
                        <option value="Good">Good</option>
                        <option value="Fair">Fair</option>
                        <option value="Poor">Poor</option>
                      </select>
                    </div>
                  </div>

                  <div className="inventory-form-group">
                    <label><BsFileText /> Notes</label>
                    <textarea
                      className="inventory-form-control"
                      rows="3"
                      value={newEquipment.notes || ''}
                      onChange={(e) => setNewEquipment({...newEquipment, notes: e.target.value})}
                      placeholder="Additional notes..."
                    />
                  </div>
                </div>
              </div>

              <div className="inventory-modal-footer">
                <motion.button
                  className="inventory-modal-btn inventory-modal-btn-secondary"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowAddEquipmentModal(false)}
                >
                  Cancel
                </motion.button>
                <motion.button
                  className="inventory-modal-btn inventory-modal-btn-primary"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAddEquipment}
                  disabled={loading}
                >
                  {loading ? 'Adding...' : 'Add Equipment'}
                  {!loading && <FiPlus />}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stock Out Modal */}
      <AnimatePresence>
        {showStockOutModal && (
          <motion.div 
            className="inventory-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowStockOutModal(false);
              resetStockOutForm();
            }}
          >
            <motion.div 
              className="inventory-modal-content"
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="inventory-modal-header">
                <h2>Equipment Stock Out - New Event</h2>
                <motion.button
                  className="inventory-close-modal"
                  onClick={() => {
                    setShowStockOutModal(false);
                    resetStockOutForm();
                  }}
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <FiXCircle />
                </motion.button>
              </div>

              <div className="inventory-modal-body">
                <div className="inventory-stock-out-form">
                  <div className="inventory-form-row">
                    <div className="inventory-form-group">
                      <label><BsCalendarEvent /> Event Name *</label>
                      <input
                        type="text"
                        className="inventory-form-control"
                        value={newStockOut.eventName || ''}
                        onChange={(e) => setNewStockOut({...newStockOut, eventName: e.target.value})}
                        placeholder="Enter event name"
                      />
                    </div>
                    <div className="inventory-form-group">
                      <label><BsGeoAlt /> Event Location *</label>
                      <input
                        type="text"
                        className="inventory-form-control"
                        value={newStockOut.eventLocation || ''}
                        onChange={(e) => setNewStockOut({...newStockOut, eventLocation: e.target.value})}
                        placeholder="Enter location"
                      />
                    </div>
                  </div>

                  <div className="inventory-form-row">
                    <div className="inventory-form-group">
                      <label><FiClock /> Date Out *</label>
                      <input
                        type="datetime-local"
                        className="inventory-form-control"
                        value={newStockOut.dateOut || new Date().toISOString().slice(0, 16)}
                        onChange={(e) => setNewStockOut({...newStockOut, dateOut: e.target.value})}
                      />
                    </div>
                    <div className="inventory-form-group">
                      <label><FiClock /> Expected Date In *</label>
                      <input
                        type="datetime-local"
                        className="inventory-form-control"
                        value={newStockOut.expectedDateIn || ''}
                        onChange={(e) => setNewStockOut({...newStockOut, expectedDateIn: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="inventory-form-row">
                    <div className="inventory-form-group">
                      <label><FiUser /> Person Responsible *</label>
                      <input
                        type="text"
                        className="inventory-form-control"
                        value={newStockOut.personResponsible || ''}
                        onChange={(e) => setNewStockOut({...newStockOut, personResponsible: e.target.value})}
                        placeholder="Name"
                      />
                    </div>
                    <div className="inventory-form-group">
                      <label><BsTelephone /> Contact Number</label>
                      <input
                        type="tel"
                        className="inventory-form-control"
                        value={newStockOut.contactNumber || ''}
                        onChange={(e) => setNewStockOut({...newStockOut, contactNumber: e.target.value})}
                        placeholder="Phone number"
                      />
                    </div>
                  </div>

                  <div className="inventory-form-group">
                    <label><BsFileText /> Notes</label>
                    <input
                      type="text"
                      className="inventory-form-control"
                      value={newStockOut.notes || ''}
                      onChange={(e) => setNewStockOut({...newStockOut, notes: e.target.value})}
                      placeholder="Additional notes"
                    />
                  </div>

                  <div className="inventory-equipment-selector">
                    <h4>Equipment List</h4>
                    <div className="inventory-selector-header">
                      <span>Equipment</span>
                      <span>Available</span>
                      <span>Quantity Out</span>
                      <span>Remaining</span>
                      <span></span>
                    </div>

                    {/* Display selected equipment */}
                    {newStockOut.equipment && newStockOut.equipment.length > 0 ? (
                      newStockOut.equipment.map((item, index) => {
                        if (!item || !item.id) return null;
                        const eq = equipment?.find(e => e?.equipment_id === item.id);
                        const available = eq?.available || 0;
                        const quantityOut = item?.quantityOut || 0;
                        
                        return (
                          <div key={item.id || index} className="inventory-selector-row">
                            <span>{item.name || 'Unknown'}</span>
                            <span>{available}</span>
                            <span>{quantityOut}</span>
                            <span>{Math.max(0, available - quantityOut)}</span>
                            <motion.button
                              className="inventory-action-icon-btn inventory-action-icon-btn-delete"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => {
                                setNewStockOut({
                                  ...newStockOut,
                                  equipment: newStockOut.equipment.filter((_, i) => i !== index)
                                });
                              }}
                            >
                              <FiTrash2 />
                            </motion.button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="inventory-no-items">No equipment added yet</div>
                    )}

                    {/* Equipment selector row */}
                    <div className="inventory-selector-row">
                      <select
                        className="inventory-form-control"
                        value={equipmentSelector.equipmentId || ''}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          if (!selectedId) {
                            setEquipmentSelector({ equipmentId: '', quantityOut: 1 });
                            return;
                          }
                          
                          const eq = equipment?.find(e => e?.equipment_id === selectedId);
                          const maxAvailable = eq?.available || 0;
                          
                          setEquipmentSelector({
                            equipmentId: selectedId,
                            quantityOut: Math.min(1, maxAvailable)
                          });
                        }}
                      >
                        <option value="">Select Equipment</option>
                        {equipment
                          ?.filter(e => e && e.available > 0 && e.active)
                          .map(e => (
                            <option key={e.equipment_id} value={e.equipment_id}>
                              {e.name} - {e.available} available
                            </option>
                          ))}
                      </select>
                      
                      <input
                        type="number"
                        className="inventory-quantity-out-input"
                        min="1"
                        max={(() => {
                          if (!equipmentSelector.equipmentId) return 1;
                          const eq = equipment?.find(e => e && e.equipment_id === equipmentSelector.equipmentId);
                          return eq?.available || 1;
                        })()}
                        value={equipmentSelector.quantityOut || 1}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 1;
                          const max = equipmentSelector.equipmentId ? 
                            (equipment?.find(e => e && e.equipment_id === equipmentSelector.equipmentId)?.available || 1) : 1;
                          
                          setEquipmentSelector({
                            ...equipmentSelector,
                            quantityOut: Math.min(value, max)
                          });
                        }}
                      />
                      
                      <motion.button
                        className="inventory-action-btn"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          if (!equipmentSelector.equipmentId) {
                            alert('Please select equipment');
                            return;
                          }
                          
                          const eq = equipment?.find(e => e && e.equipment_id === equipmentSelector.equipmentId);
                          if (!eq) {
                            alert('Equipment not found');
                            return;
                          }
                          
                          if (newStockOut.equipment?.some(item => item?.id === eq.equipment_id)) {
                            alert('Equipment already added');
                            return;
                          }
                          
                          setNewStockOut({
                            ...newStockOut,
                            equipment: [
                              ...(newStockOut.equipment || []),
                              {
                                id: eq.equipment_id,
                                name: eq.name,
                                quantityOut: equipmentSelector.quantityOut
                              }
                            ]
                          });
                          
                          setEquipmentSelector({ equipmentId: '', quantityOut: 1 });
                        }}
                      >
                        Add
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="inventory-modal-footer">
                <motion.button
                  className="inventory-modal-btn inventory-modal-btn-secondary"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowStockOutModal(false);
                    resetStockOutForm();
                  }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  className="inventory-modal-btn inventory-modal-btn-primary"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleStockOut}
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create Event'}
                  {!loading && <BsCartDash />}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stock In Modal */}
      <AnimatePresence>
        {showStockInModal && selectedEvent && (
          <motion.div 
            className="inventory-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowStockInModal(false);
              setSelectedEvent(null);
              setReturnFormData({});
            }}
          >
            <motion.div 
              className="inventory-modal-content"
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="inventory-modal-header">
                <h2>Return Equipment - {selectedEvent?.event_id || 'Event'}</h2>
                <motion.button
                  className="inventory-close-modal"
                  onClick={() => {
                    setShowStockInModal(false);
                    setSelectedEvent(null);
                    setReturnFormData({});
                  }}
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <FiXCircle />
                </motion.button>
              </div>

              <div className="inventory-modal-body">
                <div className="inventory-return-form">
                  <div className="inventory-form-group">
                    <label><FiCalendar /> Return Date & Time</label>
                    <input
                      type="datetime-local"
                      className="inventory-form-control"
                      value={new Date().toISOString().slice(0, 16)}
                      readOnly
                    />
                  </div>

                  <h4>Equipment Return Details</h4>
                  
                  {selectedEvent?.equipment && Array.isArray(selectedEvent.equipment) && selectedEvent.equipment.length > 0 ? (
                    selectedEvent.equipment.map((item, index) => {
                      if (!item || !item.id) return null;
                      
                      return (
                        <div key={item.id || index} className="inventory-return-item">
                          <div className="inventory-return-item-header">
                            <span className="inventory-return-item-name">{item.name || 'Unknown Item'}</span>
                            <span className="inventory-return-item-quantity">
                              Out: {item.quantityOut || 0} pcs
                            </span>
                          </div>
                          <div className="inventory-return-inputs">
                            <div className="inventory-return-input-group">
                              <label>Returned</label>
                              <input
                                type="number"
                                defaultValue={item.quantityOut || 0}
                                min="0"
                                max={item.quantityOut || 0}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0;
                                  setReturnFormData(prev => ({
                                    ...(prev || {}),
                                    [`${item.id}_returned`]: value
                                  }));
                                }}
                              />
                            </div>
                            <div className="inventory-return-input-group">
                              <label>Damaged</label>
                              <input
                                type="number"
                                defaultValue="0"
                                min="0"
                                max={item.quantityOut || 0}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0;
                                  setReturnFormData(prev => ({
                                    ...(prev || {}),
                                    [`${item.id}_damaged`]: value
                                  }));
                                }}
                              />
                            </div>
                            <div className="inventory-return-input-group">
                              <label>Missing</label>
                              <input
                                type="number"
                                defaultValue="0"
                                min="0"
                                max={item.quantityOut || 0}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0;
                                  setReturnFormData(prev => ({
                                    ...(prev || {}),
                                    [`${item.id}_missing`]: value
                                  }));
                                }}
                              />
                            </div>
                          </div>
                          <div className="inventory-return-total">
                            Total: {
                              ((returnFormData?.[`${item.id}_returned`] !== undefined ? returnFormData[`${item.id}_returned`] : (item.quantityOut || 0)) || 0) + 
                              (returnFormData?.[`${item.id}_damaged`] || 0) + 
                              (returnFormData?.[`${item.id}_missing`] || 0)
                            } / {item.quantityOut || 0}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="inventory-no-items">No equipment found for this event</p>
                  )}

                  <div className="inventory-form-group">
                    <label><BsFileText /> Condition Notes</label>
                    <textarea
                      className="inventory-form-control"
                      rows="3"
                      placeholder="Describe any damages or issues..."
                      onChange={(e) => setReturnFormData(prev => ({
                        ...(prev || {}),
                        notes: e.target.value
                      }))}
                    />
                  </div>
                </div>
              </div>

              <div className="inventory-modal-footer">
                <motion.button
                  className="inventory-modal-btn inventory-modal-btn-secondary"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowStockInModal(false);
                    setSelectedEvent(null);
                    setReturnFormData({});
                  }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  className="inventory-modal-btn inventory-modal-btn-primary"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleStockIn}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Complete Return'}
                  {!loading && <BsArrowReturnLeft />}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && editingItem && (
          <motion.div 
            className="inventory-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowEditModal(false);
              setEditingItem(null);
            }}
          >
            <motion.div 
              className="inventory-modal-content inventory-edit-modal"
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="inventory-modal-header">
                <h2>
                  {activeModule === 'products' ? <FiPackage /> : <GiSpoon />} 
                  Edit {activeModule === 'products' ? 'Product' : 'Equipment'}
                </h2>
                <motion.button
                  className="inventory-close-modal"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingItem(null);
                  }}
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <FiXCircle />
                </motion.button>
              </div>

              <div className="inventory-modal-body">
                <div className="inventory-edit-form">
                  {activeModule === 'products' ? (
                    // Product Edit Form
                    <>
                      <div className="inventory-form-row">
                        <div className="inventory-form-group">
                          <label>Product Name *</label>
                          <input
                            type="text"
                            className="inventory-form-control"
                            value={editProduct.name || ''}
                            onChange={(e) => setEditProduct({...editProduct, name: e.target.value})}
                          />
                        </div>
                        <div className="inventory-form-group">
                          <label>SKU</label>
                          <input
                            type="text"
                            className="inventory-form-control"
                            value={editProduct.sku || ''}
                            onChange={(e) => setEditProduct({...editProduct, sku: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="inventory-form-row">
                        <div className="inventory-form-group">
                          <label>Category *</label>
                          <select
                            className="inventory-form-control"
                            value={editProduct.category || ''}
                            onChange={(e) => setEditProduct({...editProduct, category: e.target.value})}
                          >
                            {categories
                              .filter(c => c.type === 'product')
                              .map(cat => (
                                <option key={cat.id} value={cat.name}>
                                  {cat.icon} {cat.name}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div className="inventory-form-group">
                          <label>Unit</label>
                          <select
                            className="inventory-form-control"
                            value={editProduct.unit || 'kg'}
                            onChange={(e) => setEditProduct({...editProduct, unit: e.target.value})}
                          >
                            <option value="kg">Kilograms (kg)</option>
                            <option value="g">Grams (g)</option>
                            <option value="L">Liters (L)</option>
                            <option value="ml">Milliliters (ml)</option>
                            <option value="pcs">Pieces (pcs)</option>
                            <option value="boxes">Boxes</option>
                            <option value="bags">Bags</option>
                          </select>
                        </div>
                      </div>

                      <div className="inventory-form-row">
                        <div className="inventory-form-group">
                          <label>Quantity *</label>
                          <input
                            type="number"
                            className="inventory-form-control"
                            value={editProduct.quantity || ''}
                            onChange={(e) => setEditProduct({...editProduct, quantity: e.target.value})}
                            min="0"
                          />
                        </div>
                        <div className="inventory-form-group">
                          <label>Location</label>
                          <input
                            type="text"
                            className="inventory-form-control"
                            value={editProduct.location || ''}
                            onChange={(e) => setEditProduct({...editProduct, location: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="inventory-form-row">
                        <div className="inventory-form-group">
                          <label>Min Stock</label>
                          <input
                            type="number"
                            className="inventory-form-control"
                            value={editProduct.minStock || ''}
                            onChange={(e) => setEditProduct({...editProduct, minStock: e.target.value})}
                            min="0"
                          />
                        </div>
                        <div className="inventory-form-group">
                          <label>Max Stock</label>
                          <input
                            type="number"
                            className="inventory-form-control"
                            value={editProduct.maxStock || ''}
                            onChange={(e) => setEditProduct({...editProduct, maxStock: e.target.value})}
                            min="0"
                          />
                        </div>
                      </div>

                      <div className="inventory-form-row">
                        <div className="inventory-form-group">
                          <label>Reorder Point</label>
                          <input
                            type="number"
                            className="inventory-form-control"
                            value={editProduct.reorderPoint || ''}
                            onChange={(e) => setEditProduct({...editProduct, reorderPoint: e.target.value})}
                            min="0"
                          />
                        </div>
                        <div className="inventory-form-group">
                          <label>Supplier</label>
                          <input
                            type="text"
                            className="inventory-form-control"
                            value={editProduct.supplier || ''}
                            onChange={(e) => setEditProduct({...editProduct, supplier: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="inventory-form-row">
                        <div className="inventory-form-group">
                          <label>Expiry Date</label>
                          <input
                            type="date"
                            className="inventory-form-control"
                            value={editProduct.expiryDate || ''}
                            onChange={(e) => setEditProduct({...editProduct, expiryDate: e.target.value})}
                          />
                        </div>
                        <div className="inventory-form-group">
                          <label>Lead Time (days)</label>
                          <input
                            type="number"
                            className="inventory-form-control"
                            value={editProduct.leadTime || ''}
                            onChange={(e) => setEditProduct({...editProduct, leadTime: e.target.value})}
                            min="0"
                          />
                        </div>
                      </div>

                      <div className="inventory-form-group">
                        <label>Notes</label>
                        <textarea
                          className="inventory-form-control"
                          rows="3"
                          value={editProduct.notes || ''}
                          onChange={(e) => setEditProduct({...editProduct, notes: e.target.value})}
                        />
                      </div>

                      <div className="inventory-form-group">
                        <label className="inventory-checkbox-label">
                          <input
                            type="checkbox"
                            checked={editProduct.active || false}
                            onChange={(e) => setEditProduct({...editProduct, active: e.target.checked})}
                          />
                          <span>Active (visible in inventory)</span>
                        </label>
                      </div>
                    </>
                  ) : (
                    // Equipment Edit Form
                    <>
                      <div className="inventory-form-row">
                        <div className="inventory-form-group">
                          <label>Equipment Name *</label>
                          <input
                            type="text"
                            className="inventory-form-control"
                            value={editEquipment.name || ''}
                            onChange={(e) => setEditEquipment({...editEquipment, name: e.target.value})}
                          />
                        </div>
                        <div className="inventory-form-group">
                          <label>Model</label>
                          <input
                            type="text"
                            className="inventory-form-control"
                            value={editEquipment.model || ''}
                            onChange={(e) => setEditEquipment({...editEquipment, model: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="inventory-form-row">
                        <div className="inventory-form-group">
                          <label>Main Category *</label>
                          <select
                            className="inventory-form-control"
                            value={editEquipment.category || ''}
                            onChange={(e) => {
                              setEditEquipment({
                                ...editEquipment, 
                                category: e.target.value, 
                                sub_category: ''
                              });
                            }}
                          >
                            <option value="">Select Category</option>
                            {getEquipmentMainCategories().map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>
                        <div className="inventory-form-group">
                          <label>Sub Category</label>
                          <select
                            className="inventory-form-control"
                            value={editEquipment.sub_category || ''}
                            onChange={(e) => setEditEquipment({...editEquipment, sub_category: e.target.value})}
                            disabled={!editEquipment.category}
                          >
                            <option value="">Select Sub Category</option>
                            {getSubCategoriesByMain(editEquipment.category).map(cat => (
                              <option key={cat.id} value={cat.name}>
                                {cat.icon} {cat.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="inventory-form-row">
                        <div className="inventory-form-group">
                          <label>Serial Number</label>
                          <input
                            type="text"
                            className="inventory-form-control"
                            value={editEquipment.serial_number || ''}
                            onChange={(e) => setEditEquipment({...editEquipment, serial_number: e.target.value})}
                          />
                        </div>
                        <div className="inventory-form-group">
                          <label>Total Quantity *</label>
                          <input
                            type="number"
                            className="inventory-form-control"
                            value={editEquipment.total_quantity || ''}
                            onChange={(e) => setEditEquipment({...editEquipment, total_quantity: e.target.value})}
                            min="0"
                          />
                        </div>
                      </div>

                      <div className="inventory-form-row">
                        <div className="inventory-form-group">
                          <label>Location</label>
                          <input
                            type="text"
                            className="inventory-form-control"
                            value={editEquipment.location || ''}
                            onChange={(e) => setEditEquipment({...editEquipment, location: e.target.value})}
                          />
                        </div>
                        <div className="inventory-form-group">
                          <label>Supplier</label>
                          <input
                            type="text"
                            className="inventory-form-control"
                            value={editEquipment.supplier || ''}
                            onChange={(e) => setEditEquipment({...editEquipment, supplier: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="inventory-form-row">
                        <div className="inventory-form-group">
                          <label>Last Maintenance</label>
                          <input
                            type="date"
                            className="inventory-form-control"
                            value={editEquipment.last_maintenance || ''}
                            onChange={(e) => setEditEquipment({...editEquipment, last_maintenance: e.target.value})}
                          />
                        </div>
                        <div className="inventory-form-group">
                          <label>Condition</label>
                          <select
                            className="inventory-form-control"
                            value={editEquipment.condition || 'Good'}
                            onChange={(e) => setEditEquipment({...editEquipment, condition: e.target.value})}
                          >
                            <option value="Excellent">Excellent</option>
                            <option value="Good">Good</option>
                            <option value="Fair">Fair</option>
                            <option value="Poor">Poor</option>
                          </select>
                        </div>
                      </div>

                      <div className="inventory-form-group">
                        <label>Notes</label>
                        <textarea
                          className="inventory-form-control"
                          rows="3"
                          value={editEquipment.notes || ''}
                          onChange={(e) => setEditEquipment({...editEquipment, notes: e.target.value})}
                        />
                      </div>

                      <div className="inventory-form-group">
                        <label className="inventory-checkbox-label">
                          <input
                            type="checkbox"
                            checked={editEquipment.active || false}
                            onChange={(e) => setEditEquipment({...editEquipment, active: e.target.checked})}
                          />
                          <span>Active (visible in inventory)</span>
                        </label>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="inventory-modal-footer">
                <motion.button
                  className="inventory-modal-btn inventory-modal-btn-secondary"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingItem(null);
                  }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  className="inventory-modal-btn inventory-modal-btn-primary"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleUpdateItem}
                  disabled={loading}
                >
                  {loading ? 'Updating...' : 'Update'}
                  {!loading && <FiEdit2 />}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Item Details Modal */}
      <AnimatePresence>
        {showItemDetails && selectedItem && (
          <motion.div 
            className="inventory-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowItemDetails(false)}
          >
            <motion.div 
              className="inventory-modal-content"
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="inventory-modal-header">
                <h2>Item Details - {selectedItem?.product_id || selectedItem?.equipment_id}</h2>
                <motion.button
                  className="inventory-close-modal"
                  onClick={() => setShowItemDetails(false)}
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <FiXCircle />
                </motion.button>
              </div>

              <div className="inventory-modal-body">
                {/* Basic Information */}
                <div className="inventory-modal-section">
                  <h3><FiBox /> Basic Information</h3>
                  <div className="inventory-detail-grid">
                    <div className="inventory-detail-item">
                      <span className="inventory-detail-label">ID</span>
                      <span className="inventory-detail-value inventory-detail-value-highlight">
                        {selectedItem?.product_id || selectedItem?.equipment_id}
                      </span>
                    </div>
                    <div className="inventory-detail-item">
                      <span className="inventory-detail-label">Name</span>
                      <span className="inventory-detail-value">{selectedItem?.name}</span>
                    </div>
                    {'sku' in selectedItem && (
                      <div className="inventory-detail-item">
                        <span className="inventory-detail-label">SKU</span>
                        <span className="inventory-detail-value">{selectedItem?.sku || '-'}</span>
                      </div>
                    )}
                    <div className="inventory-detail-item">
                      <span className="inventory-detail-label">Category</span>
                      <span className="inventory-detail-value">{selectedItem?.category}</span>
                    </div>
                    {'sub_category' in selectedItem && selectedItem?.sub_category && (
                      <div className="inventory-detail-item">
                        <span className="inventory-detail-label">Sub Category</span>
                        <span className="inventory-detail-value">{selectedItem?.sub_category}</span>
                      </div>
                    )}
                    <div className="inventory-detail-item">
                      <span className="inventory-detail-label">Location</span>
                      <span className="inventory-detail-value">{selectedItem?.location || '-'}</span>
                    </div>
                    <div className="inventory-detail-item">
                      <span className="inventory-detail-label">Status</span>
                      <span className={`inventory-detail-value ${selectedItem?.status}`}>
                        {getStatusDetails(selectedItem?.status).text}
                      </span>
                    </div>
                    <div className="inventory-detail-item">
                      <span className="inventory-detail-label">Active</span>
                      <span className={`inventory-detail-value ${selectedItem?.active ? 'inventory-detail-value-success' : 'inventory-detail-value-danger'}`}>
                        {selectedItem?.active ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stock/Quantity Information */}
                <div className="inventory-modal-section">
                  <h3><FiPackage /> Stock Information</h3>
                  <div className="inventory-detail-grid">
                    {'quantity' in selectedItem && (
                      <>
                        <div className="inventory-detail-item">
                          <span className="inventory-detail-label">Current Stock</span>
                          <span className={`inventory-detail-value ${selectedItem?.status}`}>
                            {selectedItem?.quantity} {selectedItem?.unit}
                          </span>
                        </div>
                        <div className="inventory-detail-item">
                          <span className="inventory-detail-label">Min Stock</span>
                          <span className="inventory-detail-value">{selectedItem?.min_stock || 0}</span>
                        </div>
                        <div className="inventory-detail-item">
                          <span className="inventory-detail-label">Max Stock</span>
                          <span className="inventory-detail-value">{selectedItem?.max_stock || 0}</span>
                        </div>
                        <div className="inventory-detail-item">
                          <span className="inventory-detail-label">Reorder Point</span>
                          <span className="inventory-detail-value">{selectedItem?.reorder_point || 0}</span>
                        </div>
                        <div className="inventory-detail-item">
                          <span className="inventory-detail-label">Reserved</span>
                          <span className="inventory-detail-value">{selectedItem?.reserved || 0}</span>
                        </div>
                      </>
                    )}
                    
                    {'total_quantity' in selectedItem && (
                      <>
                        <div className="inventory-detail-item">
                          <span className="inventory-detail-label">Total Quantity</span>
                          <span className="inventory-detail-value">{selectedItem?.total_quantity}</span>
                        </div>
                        <div className="inventory-detail-item">
                          <span className="inventory-detail-label">In Use</span>
                          <span className="inventory-detail-value inventory-detail-value-warning">{selectedItem?.in_use}</span>
                        </div>
                        <div className="inventory-detail-item">
                          <span className="inventory-detail-label">Available</span>
                          <span className="inventory-detail-value inventory-detail-value-success">{selectedItem?.available}</span>
                        </div>
                        <div className="inventory-detail-item">
                          <span className="inventory-detail-label">Damaged</span>
                          <span className="inventory-detail-value inventory-detail-value-danger">{selectedItem?.damaged}</span>
                        </div>
                        <div className="inventory-detail-item">
                          <span className="inventory-detail-label">Missing</span>
                          <span className="inventory-detail-value inventory-detail-value-warning">{selectedItem?.missing}</span>
                        </div>
                        <div className="inventory-detail-item">
                          <span className="inventory-detail-label">Under Maintenance</span>
                          <span className="inventory-detail-value">{selectedItem?.under_maintenance || 0}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Additional Information */}
                <div className="inventory-modal-section">
                  <h3><FiSettings /> Additional Information</h3>
                  <div className="inventory-detail-grid">
                    {'supplier' in selectedItem && (
                      <div className="inventory-detail-item">
                        <span className="inventory-detail-label">Supplier</span>
                        <span className="inventory-detail-value">{selectedItem?.supplier || '-'}</span>
                      </div>
                    )}
                    {'last_updated' in selectedItem && (
                      <div className="inventory-detail-item">
                        <span className="inventory-detail-label">Last Updated</span>
                        <span className="inventory-detail-value">
                          {selectedItem?.last_updated ? new Date(selectedItem.last_updated).toLocaleDateString() : '-'}
                        </span>
                      </div>
                    )}
                    {'expiry_date' in selectedItem && selectedItem?.expiry_date && (
                      <div className="inventory-detail-item">
                        <span className="inventory-detail-label">Expiry Date</span>
                        <span className={`inventory-detail-value ${
                          isExpiringSoon(selectedItem.expiry_date) ? 'inventory-detail-value-danger' : ''
                        }`}>
                          {new Date(selectedItem.expiry_date).toLocaleDateString()}
                          {isExpiringSoon(selectedItem.expiry_date) && (
                            <FiAlertCircle style={{ marginLeft: 4, color: '#ef4444' }} />
                          )}
                        </span>
                      </div>
                    )}
                    {'lead_time' in selectedItem && (
                      <div className="inventory-detail-item">
                        <span className="inventory-detail-label">Lead Time</span>
                        <span className="inventory-detail-value">{selectedItem?.lead_time || 0} days</span>
                      </div>
                    )}
                    {'last_maintenance' in selectedItem && (
                      <div className="inventory-detail-item">
                        <span className="inventory-detail-label">Last Maintenance</span>
                        <span className="inventory-detail-value">
                          {selectedItem?.last_maintenance ? new Date(selectedItem.last_maintenance).toLocaleDateString() : '-'}
                        </span>
                      </div>
                    )}
                    {'next_maintenance' in selectedItem && (
                      <div className="inventory-detail-item">
                        <span className="inventory-detail-label">Next Maintenance</span>
                        <span className="inventory-detail-value">
                          {selectedItem?.next_maintenance ? new Date(selectedItem.next_maintenance).toLocaleDateString() : '-'}
                        </span>
                      </div>
                    )}
                    {'condition' in selectedItem && (
                      <div className="inventory-detail-item">
                        <span className="inventory-detail-label">Condition</span>
                        <span className="inventory-detail-value">{selectedItem?.condition}</span>
                      </div>
                    )}
                    {'usage_count' in selectedItem && (
                      <div className="inventory-detail-item">
                        <span className="inventory-detail-label">Usage Count</span>
                        <span className="inventory-detail-value">{selectedItem?.usage_count || 0}</span>
                      </div>
                    )}
                    {'model' in selectedItem && (
                      <div className="inventory-detail-item">
                        <span className="inventory-detail-label">Model</span>
                        <span className="inventory-detail-value">{selectedItem?.model || '-'}</span>
                      </div>
                    )}
                    {'serial_number' in selectedItem && (
                      <div className="inventory-detail-item">
                        <span className="inventory-detail-label">Serial Number</span>
                        <span className="inventory-detail-value">{selectedItem?.serial_number || '-'}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {'notes' in selectedItem && selectedItem?.notes && (
                  <div className="inventory-modal-section">
                    <h3><BsFileText /> Notes</h3>
                    <p className="inventory-detail-notes">{selectedItem.notes}</p>
                  </div>
                )}

                {/* Recent History */}
                <div className="inventory-modal-section">
                  <h3><MdHistory /> Recent History</h3>
                  <div className="inventory-history-timeline">
                    {activeModule === 'products' && productHistory.length > 0 ? (
                      productHistory.slice(0, 5).map(history => (
                        <div key={history.id} className={`inventory-history-entry ${history.type}`}>
                          <div className={`inventory-history-icon ${history.type}`}>
                            {history.type === 'out' && <BsCartDash />}
                            {history.type === 'in' && <BsCartPlus />}
                            {history.type === 'adjustment' && <FiSettings />}
                          </div>
                          <div className="inventory-history-details">
                            <div className="inventory-history-date">{new Date(history.date).toLocaleString()}</div>
                            <div className="inventory-history-action">
                              {history.type === 'out' && `Out: ${history.quantity} ${history.unit}`}
                              {history.type === 'in' && `In: ${history.quantity} ${history.unit}`}
                              {history.type === 'adjustment' && `Adjustment: ${history.quantity} ${history.unit}`}
                            </div>
                            <div className="inventory-history-meta">
                              <span>{history.reason}</span>
                              <span>By: {history.performed_by}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : activeModule === 'equipment' && equipmentHistory.length > 0 ? (
                      equipmentHistory.slice(0, 5).map(history => (
                        <div key={history.id} className={`inventory-history-entry ${history.type}`}>
                          <div className={`inventory-history-icon ${history.type}`}>
                            {history.type === 'out' && <BsCartDash />}
                            {history.type === 'in' && <BsArrowReturnLeft />}
                            {history.type === 'damaged' && <FiAlertCircle />}
                          </div>
                          <div className="inventory-history-details">
                            <div className="inventory-history-date">{new Date(history.date).toLocaleString()}</div>
                            <div className="inventory-history-action">
                              {history.type === 'out' && `Out: ${history.quantity} pcs - ${history.event_name}`}
                              {history.type === 'in' && `Returned: ${history.quantity} pcs - ${history.event_name}`}
                              {history.type === 'damaged' && `Damaged: ${history.quantity} pcs`}
                            </div>
                            <div className="inventory-history-meta">
                              {history.damaged > 0 && <span style={{ color: '#ef4444' }}>Damaged: {history.damaged}</span>}
                              {history.missing > 0 && <span style={{ color: '#f59e0b' }}>Missing: {history.missing}</span>}
                              <span>By: {history.performed_by}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="inventory-no-history">No recent history for this item</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="inventory-modal-footer">
                <motion.button
                  className="inventory-modal-btn inventory-modal-btn-secondary"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowItemDetails(false)}
                >
                  Close
                </motion.button>
                <motion.button
                  className="inventory-modal-btn inventory-modal-btn-primary"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowItemDetails(false);
                    handleEdit(selectedItem);
                  }}
                >
                  <FiEdit2 />
                  Edit
                </motion.button>
                {activeModule === 'equipment' && 'in_use' in selectedItem && selectedItem?.in_use > 0 && (
                  <motion.button
                    className="inventory-modal-btn inventory-modal-btn-primary"
                    style={{ background: 'var(--event-gradient)' }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setShowItemDetails(false);
                      const eventForItem = events.find(e => 
                        e?.equipment?.some(eq => eq?.id === selectedItem?.equipment_id) && e.status === 'ongoing'
                      );
                      if (eventForItem) {
                        setSelectedEvent(eventForItem);
                        setShowStockInModal(true);
                      } else {
                        alert('No active event found for this equipment');
                      }
                    }}
                  >
                    <BsArrowReturnLeft />
                    Return
                  </motion.button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Inventory;