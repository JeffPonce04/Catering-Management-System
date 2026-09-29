// src/components/layout/Navigation.jsx - Fixed

import React, { useState, useEffect, useMemo } from 'react';import { motion, AnimatePresence } from 'framer-motion';
import './styles/Navigation.css';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { API_BASE_URL } from '../../config/env';

// Import your logo image
import companyLogo from '../../assets/images/logo.png';

// Professional icon imports - All outlined 2px stroke style
import {
  FiMail, FiHome, FiPieChart, FiCalendar, FiClock,
  FiShoppingBag, FiTruck, FiPackage, FiFileText, FiUsers,
  FiDollarSign, FiUserCheck, FiUserPlus, FiSettings, FiBell, FiUser,
  FiLock, FiLogOut, FiChevronDown, FiSun, FiMoon,
  FiGrid, FiTrash2, FiCheck, FiShield, FiEye, FiEyeOff,
  FiMessageSquare, FiInfo, FiRefreshCw, FiShoppingCart,
  FiPlus, FiLayers, FiExternalLink, FiPhone, FiEdit2, FiX,
  FiCamera, FiSave, FiAlertCircle, FiCreditCard, FiBox,
  FiTool, FiArchive, FiInbox,
} from 'react-icons/fi';

import {
  BsCalendarEvent, BsArrowRepeat, BsCheckCircle,
} from 'react-icons/bs';

import { MdError, MdWarning } from 'react-icons/md';

import { GoSidebarCollapse, GoSidebarExpand } from 'react-icons/go';

import { useAuth } from '../../contexts/AuthContext';
import {
  ADMIN_ROLES,
  CASHIER_ROLES,
  HEAD_CHEF_ROLES,
  INVENTORY_MANAGER_ROLES,
  OPERATIONAL_ADMIN_ROLES,
  STAFF_MANAGER_ROLES,
  SUPER_ADMIN_ROLES,
  canAccessPath,
  hasAllowedRole,
} from '../../utils/roleRoutes';
import { useUnreadCount } from '../../hooks/useNotificationQueries';
import { useCurrentUser } from '../../hooks/useCurrentUser';
const Navigation = () => {
  // ==================== PERSISTED UI STATE ====================
   const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return document.body.classList.contains('dark-mode');
  });
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [showTooltip, setShowTooltip] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [modalAnimation, setModalAnimation] = useState('idle');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorMessage, setShowErrorMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showWarningMessage, setShowWarningMessage] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');

  const queryClient = useQueryClient();

  // ==================== NOTIFICATION BADGE STATE ====================
  const { data: unreadCount = 0, error: unreadError } = useUnreadCount();

  useEffect(() => {
    if (unreadError) {
      console.warn('Failed to load unread count:', unreadError);
    }
  }, [unreadError]);

  const notificationBadge = unreadCount > 0;

  const { user, logout: authLogout } = useAuth();
  const isSuperAdminUser = hasAllowedRole(user, SUPER_ADMIN_ROLES);
  const isAdminUser = hasAllowedRole(user, OPERATIONAL_ADMIN_ROLES);
  const isCashierUser = hasAllowedRole(user, CASHIER_ROLES);
  const isInventoryManagerUser = hasAllowedRole(user, INVENTORY_MANAGER_ROLES);
  const isStaffManagerUser = hasAllowedRole(user, STAFF_MANAGER_ROLES);
  const isHeadChefOnly = hasAllowedRole(user, HEAD_CHEF_ROLES)
    && !hasAllowedRole(user, [...ADMIN_ROLES, ...INVENTORY_MANAGER_ROLES]);

  // ==================== USER PROFILE STATE ====================
  const [userProfile, setUserProfile] = useState({
    id: '',
    user_id: '',
    full_name: '',
    email: '',
    phone_number: '',
    country_code: '+63',
    role: '',
    is_verified: false,
    profile_photo: null,
    profile_photo_url: null,
    department: 'IT Department',
    location: '',
    joinDate: '',
    bio: '',
  });

  const [editFormData, setEditFormData] = useState({
    full_name: '',
    email: '',
    user_id: '',
    phone_number: '',
    location: '',
    bio: '',
    current_password: '',
    new_password: '',
    new_password_confirmation: '',
  });

  const [securityFormData, setSecurityFormData] = useState({
    current_password: '',
    new_password: '',
    new_password_confirmation: '',
  });

  const [formErrors, setFormErrors] = useState({});
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showSecurityPassword, setShowSecurityPassword] = useState(false);
  const [showSecurityNewPassword, setShowSecurityNewPassword] = useState(false);
  const [showSecurityConfirmPassword, setShowSecurityConfirmPassword] = useState(false);
  const [confirmDeleteAvatar, setConfirmDeleteAvatar] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  // ==================== CACHED USER DATA ====================
  // ⭐ Shared hook — dedupes with every other component that needs /auth/user.
  const { data: cachedUser } = useCurrentUser();

  // Sync cached user data into local profile state
  // FIXED: Properly handle profile_photo and profile_photo_url
  useEffect(() => {
    if (!cachedUser) return;
    setUserProfile((prev) => ({
      ...prev,
      id: cachedUser.id || cachedUser.user_id || '',
      user_id: String(cachedUser.username || cachedUser.user_id || ''),
      full_name: cachedUser.full_name || '',
      email: cachedUser.email || '',
      phone_number: cachedUser.phone_number || cachedUser.phone || '',
      country_code: cachedUser.country_code || '+63',
      role: cachedUser.primary_role || cachedUser.role || '',
      bio: cachedUser.bio || '',
      location: cachedUser.location || '',
      is_verified: Boolean(cachedUser.is_verified),
      // FIXED: Use profile_photo_url if available, otherwise profile_photo
      profile_photo: cachedUser.profile_photo_url || cachedUser.profile_photo || null,
      profile_photo_url: cachedUser.profile_photo_url || null,
      joinDate: cachedUser.created_at
        ? new Date(cachedUser.created_at).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })
        : '',
    }));
  }, [cachedUser]);

    // ==================== NOTIFICATION EVENTS ====================
  // We do NOT fetch here — useUnreadCount() owns the network call.
  // We only listen for server-pushed events and invalidate the cache.
  // (Read / delete / star already invalidate themselves inside their hooks.)
  useEffect(() => {
    const refresh = () =>
      queryClient.invalidateQueries({ queryKey: ['notifications'] });

    const handleBookingApproved = () => setTimeout(refresh, 1000);

    window.addEventListener('new-notification', refresh);
    window.addEventListener('booking-approved', handleBookingApproved);

    return () => {
      window.removeEventListener('new-notification', refresh);
      window.removeEventListener('booking-approved', handleBookingApproved);
    };
  }, [queryClient]);

  // Auto-hide messages
  useEffect(() => {
    if (showSuccessMessage) {
      const timer = setTimeout(() => setShowSuccessMessage(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessMessage]);

  useEffect(() => {
    if (showErrorMessage) {
      const timer = setTimeout(() => setShowErrorMessage(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showErrorMessage]);

  useEffect(() => {
    if (showWarningMessage) {
      const timer = setTimeout(() => setShowWarningMessage(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [showWarningMessage]);

  // Persist sidebar collapse state
  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(isCollapsed));
  }, [isCollapsed]);

  // Apply theme to <body> and persist whenever isDarkMode changes
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
      document.body.classList.add('bqm-dark-mode');
      document.documentElement.classList.add('bqm-dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode');
      document.body.classList.remove('bqm-dark-mode');
      document.documentElement.classList.remove('bqm-dark-mode');
      localStorage.setItem('theme', 'light');
    }

    // ⭐ Notify every mounted child (Booking page, etc.) — including on FIRST mount
    window.dispatchEvent(new CustomEvent('themeChange', {
      detail: { isDark: isDarkMode },
    }));
  }, [isDarkMode]);

  // ⭐ Listen for theme changes from other components (Booking page, etc.)
  useEffect(() => {
    const handleExternalThemeChange = (e) => {
      const nextDark = Boolean(e?.detail?.isDark);
      setIsDarkMode((prev) => (prev === nextDark ? prev : nextDark));
    };

    const handleStorage = (e) => {
      if (e.key === 'theme') {
        setIsDarkMode(e.newValue === 'dark');
      }
    };

    window.addEventListener('themeChange', handleExternalThemeChange);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('themeChange', handleExternalThemeChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);
  // Get current active item based on pathname
  useEffect(() => {
    const path = location.pathname;
    if (
      path === '/staff/directory' ||
      path === '/staff/schedule' ||
      path === '/staff/attendance' ||
      path === '/staff/payroll'
    ) {
      setOpenSubmenu('staff');
    } else if (
      path === '/orders&events/orders' ||
      path === '/orders&events/events'
    ) {
      setOpenSubmenu('order-events');
    } else if (
      path.startsWith('/inventory') ||
      path === '/stocklevels' ||
      path === '/movements' ||
      path === '/purchaseRequests' ||
      path === '/supplierManagement' ||
      path === '/wasteManagement' ||
      path === '/reservationManagement' ||
      path === '/maintenanceManagement' ||
      path === '/ingredientsManagement' ||
      path === '/equipmentManagement'
    ) {
      setOpenSubmenu('inventory');
    }
  }, [location]);

  // ⭐ NEW: Listen for modal state changes to blur the sidebar
  const [isSidebarBlurred, setIsSidebarBlurred] = useState(false);

  useEffect(() => {
    const handleModalStateChange = (e) => {
      const isOpen = e?.detail?.isOpen;
      setIsSidebarBlurred(Boolean(isOpen));
    };

    window.addEventListener('appModalStateChange', handleModalStateChange);
    return () => {
      window.removeEventListener('appModalStateChange', handleModalStateChange);
    };
  }, []);
  // ⭐ NEW: Listen for modal state changes from StaffAttendancePage
  useEffect(() => {
    const handleModalStateChange = (e) => {
      const isOpen = e?.detail?.isOpen;
      if (isOpen) {
        // Force the staff submenu to open so 'Attendance' is visible and highlighted
        setOpenSubmenu('staff');
      }
    };

    window.addEventListener('attendanceModalStateChange', handleModalStateChange);
    return () => {
      window.removeEventListener('attendanceModalStateChange', handleModalStateChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      setShowLogoutModal(false);
      setShowProfileModal(false);
      setShowEditProfileModal(false);
      setShowSecurityModal(false);
      setIsLoggingOut(false);
      setModalAnimation('idle');
    };
  }, []);

  // Handle escape key press
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape') {
        if (showLogoutModal) handleCloseModal();
        if (showProfileModal) setShowProfileModal(false);
        if (showEditProfileModal) setShowEditProfileModal(false);
        if (showSecurityModal) setShowSecurityModal(false);
        if (confirmDeleteAvatar) setConfirmDeleteAvatar(false);
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [
    showLogoutModal,
    showProfileModal,
    showEditProfileModal,
    showSecurityModal,
    confirmDeleteAvatar,
  ]);

  // Handle body scroll lock when modal is open
  useEffect(() => {
    if (
      showLogoutModal ||
      showProfileModal ||
      showEditProfileModal ||
      showSecurityModal ||
      confirmDeleteAvatar
    ) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [
    showLogoutModal,
    showProfileModal,
    showEditProfileModal,
    showSecurityModal,
    confirmDeleteAvatar,
  ]);

  // Initialize edit form with current user data
  const initializeEditForm = () => {
    setEditFormData({
      full_name: String(userProfile.full_name ?? ''),
      email: String(userProfile.email ?? ''),
      user_id: String(userProfile.user_id ?? ''),
      phone_number: String(userProfile.phone_number ?? ''),
      location: String(userProfile.location ?? ''),
      bio: String(userProfile.bio ?? ''),
      current_password: '',
      new_password: '',
      new_password_confirmation: '',
    });
    setFormErrors({});
    setShowPasswordFields(false);
  };

  // Initialize security form
  const initializeSecurityForm = () => {
    setSecurityFormData({
      current_password: '',
      new_password: '',
      new_password_confirmation: '',
    });
    setFormErrors({});
    setShowSecurityPassword(false);
    setShowSecurityNewPassword(false);
    setShowSecurityConfirmPassword(false);
  };

  // Show message helpers
  const showSuccess = (message) => {
    setSuccessMessage(message);
    setShowSuccessMessage(true);
  };

  const showError = (message) => {
    setErrorMessage(message);
    setShowErrorMessage(true);
  };

  const showWarning = (message) => {
    setWarningMessage(message);
    setShowWarningMessage(true);
  };

  // ==================== LOGOUT ====================
  const handleLogout = async () => {
    setIsLoggingOut(true);
    setModalAnimation('loggingOut');

    try {
      const token = localStorage.getItem('auth_token');

      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      localStorage.removeItem('userToken');
      localStorage.removeItem('userData');
      localStorage.removeItem('rememberMe');
      sessionStorage.clear();

      document.cookie.split(';').forEach((c) => {
        document.cookie = c
          .replace(/^ +/, '')
          .replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
      });

      authLogout();

           if (token) {
        fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }).catch((e) => console.log('Logout API error:', e));
      }

      // ⭐ Remove user-scoped caches only — DO NOT queryClient.clear().
      //    This keeps the dashboard + notification caches warm so the next
      //    login for the SAME user loads instantly (no refetch storm).
      queryClient.removeQueries({ queryKey: ['user'] });
      queryClient.removeQueries({ queryKey: ['auth'] });
      queryClient.removeQueries({ queryKey: ['session'] });
      queryClient.removeQueries({ queryKey: ['notifications'] });

      setShowLogoutModal(false);
      setModalAnimation('idle');
      setIsLoggingOut(false);
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      setModalAnimation('error');
      setIsLoggingOut(false);
      showError('An error occurred during logout. Please try again.');

      setTimeout(() => {
        setModalAnimation('idle');
        navigate('/login', { replace: true });
      }, 1500);
    }
  };

  const handleCloseModal = () => {
    if (isLoggingOut) return;

    setModalAnimation('closing');
    setTimeout(() => {
      setShowLogoutModal(false);
      setModalAnimation('idle');
    }, 200);
  };

  const handleProfileClick = () => {
    setShowProfileModal(true);
  };

  const handleEditProfile = () => {
    initializeEditForm();
    setFormErrors({});
    setShowPasswordFields(false);
    setShowProfileModal(false);
    setShowEditProfileModal(true);
  };

  const handleSecuritySettings = () => {
    initializeSecurityForm();
    setShowProfileModal(false);
    setShowSecurityModal(true);
  };

  // ==================== AVATAR UPLOAD ====================
  // FIXED: Removed file size limit (5MB) - now accepts any size
  // FIXED: Removed dimension limit (2000x2000) - now accepts any dimensions
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'image/gif',
      'image/webp',
    ];
    if (!allowedTypes.includes(file.type)) {
      showError('Please upload a valid image file (JPEG, PNG, GIF, or WEBP)');
      return;
    }

    // REMOVED: File size limit check (5MB)
    // REMOVED: Image dimension check (2000x2000)

    uploadAvatar(file);
  };

  const uploadAvatar = async (file) => {
    setIsUploading(true);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 100);

    const formData = new FormData();
    formData.append('profile_photo', file);

    try {
      const response = await api.post('/auth/profile-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        const updatedUser = response.data.data?.user || response.data.data || {};
        // FIXED: Use profile_photo_url if available from backend
        const profilePhotoUrl =
          updatedUser.profile_photo_url ||
          updatedUser.profile_photo ||
          URL.createObjectURL(file);

        setUserProfile((prev) => ({
          ...prev,
          profile_photo: profilePhotoUrl,
          profile_photo_url: updatedUser.profile_photo_url || null,
        }));

        queryClient.invalidateQueries({ queryKey: ['user'] });

        showSuccess('Profile photo updated successfully!');
      } else {
        showError(response.data.message || 'Failed to save profile photo');
      }
    } catch (error) {
      console.error('Failed to save profile photo:', error);
      showError(
        error.response?.data?.message ||
          'Failed to save profile photo. Please try again.'
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      clearInterval(interval);
    }
  };

  // Remove avatar
  const handleRemoveAvatar = () => {
    setConfirmDeleteAvatar(true);
  };

  const confirmRemoveAvatar = async () => {
    setConfirmDeleteAvatar(false);

    try {
      const response = await api.delete('/auth/profile-photo');

      if (response.data.success) {
        setUserProfile((prev) => ({
          ...prev,
          profile_photo: null,
          profile_photo_url: null,
        }));
        queryClient.invalidateQueries({ queryKey: ['user'] });
        showSuccess('Profile photo removed successfully!');
      } else {
        showError(response.data.message || 'Failed to remove profile photo');
      }
    } catch (error) {
      console.error('Failed to remove profile photo:', error);
      showError('Failed to remove profile photo. Please try again.');
    }
  };

  // ==================== VALIDATION ====================
  const validateEditForm = () => {
    const errors = {};

    const fullNameStr = String(editFormData.full_name ?? '').trim();
    if (!fullNameStr) {
      errors.full_name = 'Full name is required';
    } else if (fullNameStr.length < 2) {
      errors.full_name = 'Name must be at least 2 characters';
    } else if (fullNameStr.length > 100) {
      errors.full_name = 'Name must be less than 100 characters';
    }

    const emailStr = String(editFormData.email ?? '').trim();
    if (!emailStr) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
      errors.email = 'Please enter a valid email address';
    }

    const phoneStr = String(editFormData.phone_number ?? '').replace(/\s/g, '');
    if (phoneStr) {
      if (!/^[0-9]{10}$/.test(phoneStr)) {
        errors.phone_number = 'Please enter a valid 10-digit phone number';
      }
    }

    if (showPasswordFields) {
      if (!editFormData.current_password) {
        errors.current_password =
          'Current password is required to change password';
      }
      if (editFormData.new_password) {
        if (editFormData.new_password.length < 8) {
          errors.new_password = 'Password must be at least 8 characters';
        }
        if (!/(?=.*[a-z])/.test(editFormData.new_password)) {
          errors.new_password =
            'Password must contain at least one lowercase letter';
        }
        if (!/(?=.*[A-Z])/.test(editFormData.new_password)) {
          errors.new_password =
            'Password must contain at least one uppercase letter';
        }
        if (!/(?=.*\d)/.test(editFormData.new_password)) {
          errors.new_password = 'Password must contain at least one number';
        }
        if (
          editFormData.new_password !== editFormData.new_password_confirmation
        ) {
          errors.new_password_confirmation = 'Passwords do not match';
        }
      }
    }

    return errors;
  };

  const validateSecurityForm = () => {
    const errors = {};

    if (!securityFormData.current_password) {
      errors.current_password = 'Current password is required';
    }

    if (!securityFormData.new_password) {
      errors.new_password = 'New password is required';
    } else if (securityFormData.new_password.length < 8) {
      errors.new_password = 'Password must be at least 8 characters';
    }

    if (securityFormData.new_password) {
      if (!/(?=.*[a-z])/.test(securityFormData.new_password)) {
        errors.new_password =
          'Password must contain at least one lowercase letter';
      }
      if (!/(?=.*[A-Z])/.test(securityFormData.new_password)) {
        errors.new_password =
          'Password must contain at least one uppercase letter';
      }
      if (!/(?=.*\d)/.test(securityFormData.new_password)) {
        errors.new_password = 'Password must contain at least one number';
      }
    }

    if (
      securityFormData.new_password !==
      securityFormData.new_password_confirmation
    ) {
      errors.new_password_confirmation = 'Passwords do not match';
    }

    return errors;
  };

  // ==================== SAVE PROFILE ====================
  const handleSaveProfile = async () => {
    const normalize = (v) => String(v ?? '').trim();
    const hasChanges =
      normalize(editFormData.full_name) !== normalize(userProfile.full_name) ||
      normalize(editFormData.email) !== normalize(userProfile.email) ||
      normalize(editFormData.phone_number) !== normalize(userProfile.phone_number) ||
      normalize(editFormData.location) !== normalize(userProfile.location) ||
      normalize(editFormData.bio) !== normalize(userProfile.bio) ||
      (showPasswordFields && editFormData.new_password);

    if (!hasChanges) {
      showWarning('No changes to save.');
      return;
    }

    const errors = validateEditForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showWarning('Please fix the errors before saving');
      return;
    }

    setIsSaving(true);

    try {
      const updateData = {
        full_name: editFormData.full_name,
        email: editFormData.email,
        phone_number: editFormData.phone_number,
        location: editFormData.location,
        bio: editFormData.bio,
      };

      if (showPasswordFields && editFormData.new_password) {
        updateData.current_password = editFormData.current_password;
        updateData.password = editFormData.new_password;
        updateData.password_confirmation = editFormData.new_password_confirmation;
      }

      const response = await api.put('/auth/profile', updateData);

      if (response.data.success) {
        const updatedUser = response.data.data?.user;

        setUserProfile((prev) => ({
          ...prev,
          full_name: updatedUser?.full_name || editFormData.full_name,
          email: updatedUser?.email || editFormData.email,
          phone_number:
            updatedUser?.phone_number ||
            updatedUser?.phone ||
            editFormData.phone_number,
          location: updatedUser?.location ?? editFormData.location,
          bio: updatedUser?.bio ?? editFormData.bio,
          profile_photo: updatedUser?.profile_photo_url || updatedUser?.profile_photo || prev.profile_photo,
          profile_photo_url: updatedUser?.profile_photo_url || prev.profile_photo_url,
          is_verified: updatedUser?.is_verified ?? prev.is_verified,
        }));

        queryClient.invalidateQueries({ queryKey: ['user'] });

        showSuccess('Profile updated successfully!');

        setTimeout(() => {
          setShowEditProfileModal(false);
        }, 1500);

        setIsSaving(false);
      } else {
        showError(response.data.message || 'Failed to update profile');
        setIsSaving(false);
      }
    } catch (error) {
      console.error('Profile update error:', error);
      if (error.response?.data?.errors) {
        setFormErrors(error.response.data.errors);
        showWarning('Please fix the validation errors');
      } else {
        showError(error.response?.data?.message || 'Failed to update profile');
      }
      setIsSaving(false);
    }
  };

  // ==================== SAVE SECURITY (PASSWORD) ====================
  const handleSecuritySave = async () => {
    const errors = validateSecurityForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showWarning('Please fix the errors before changing password');
      return;
    }

    setIsSaving(true);

    try {
      const response = await api.put('/auth/change-password', {
        current_password: securityFormData.current_password,
        password: securityFormData.new_password,
        password_confirmation: securityFormData.new_password_confirmation,
      });

      if (response.data.success) {
        showSuccess('Password changed successfully!');

        setTimeout(() => {
          setShowSecurityModal(false);
          initializeSecurityForm();
        }, 2000);

        setIsSaving(false);
      } else {
        showError(response.data.message || 'Failed to change password');
        setIsSaving(false);
      }
    } catch (error) {
      console.error('Password change error:', error);
      showError(error.response?.data?.message || 'Failed to change password');
      setIsSaving(false);
    }
  };

  // Handle edit form input changes
  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));

    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // Handle security form input changes
  const handleSecurityInputChange = (e) => {
    const { name, value } = e.target;
    setSecurityFormData((prev) => ({ ...prev, [name]: value }));

    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const toggleTheme = (e) => {
    e.stopPropagation();
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);

    if (newDarkMode) {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
    } else {
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode');
    }

    localStorage.setItem('theme', newDarkMode ? 'dark' : 'light');

    const event = new CustomEvent('themeChange', {
      detail: { isDark: newDarkMode },
    });
    window.dispatchEvent(event);
  };

  const toggleSidebar = () => {
    setIsCollapsed((prev) => !prev);
  };

  const getModalAnimationClass = () => {
    switch (modalAnimation) {
      case 'loggingOut':
        return 'navigation-modal-pulse';
      case 'error':
        return 'navigation-modal-shake';
      case 'closing':
        return 'navigation-modal-fade-out';
      default:
        return '';
    }
  };

  // ==================== TOAST COMPONENTS ====================
  const SuccessMessage = () => {
    if (!showSuccessMessage) return null;
    return (
      <div className={`navigation-toast-message success ${isDarkMode ? 'dark' : ''}`}>
        <BsCheckCircle className="toast-icon" />
        <span>{successMessage}</span>
        <button onClick={() => setShowSuccessMessage(false)} className="toast-close">
          ×
        </button>
      </div>
    );
  };

  const ErrorMessage = () => {
    if (!showErrorMessage) return null;
    return (
      <div className={`navigation-toast-message error ${isDarkMode ? 'dark' : ''}`}>
        <MdError className="toast-icon" />
        <span>{errorMessage}</span>
        <button onClick={() => setShowErrorMessage(false)} className="toast-close">
          ×
        </button>
      </div>
    );
  };

  const WarningMessage = () => {
    if (!showWarningMessage) return null;
    return (
      <div className={`navigation-toast-message warning ${isDarkMode ? 'dark' : ''}`}>
        <MdWarning className="toast-icon" />
        <span>{warningMessage}</span>
        <button onClick={() => setShowWarningMessage(false)} className="toast-close">
          ×
        </button>
      </div>
    );
  };

  // ==================== NAVIGATION CATALOG ====================
  const navigationCatalog = useMemo(() => {
    const inventorySubmenu = [
      {
        id: 'ingredientsManagement',
        title: 'Ingredients Inventory',
        icon: FiLayers,
        secondaryIcon: FiGrid,
        path: '/ingredientsManagement',
        description: 'Manage ingredients',
      },
      {
        id: 'equipmentManagement',
        title: 'Equipment Inventory',
        icon: FiTool,
        secondaryIcon: FiSettings,
        path: '/equipmentManagement',
        description: 'Manage equipment',
      },
      {
        id: 'purchaseRequests',
        title: 'Purchase Requests',
        icon: FiShoppingCart,
        secondaryIcon: FiShoppingBag,
        path: '/purchaseRequests',
        description: 'Manage purchase requests',
      },
      {
        id: 'movements',
        title: 'Stock Movements',
        icon: FiRefreshCw,
        secondaryIcon: BsArrowRepeat,
        path: '/movements',
        description: 'Track stock movements',
      },
      {
        id: 'stocklevels',
        title: 'Stock Levels',
        icon: FiInbox,
        secondaryIcon: FiArchive,
        path: '/stocklevels',
        description: 'Monitor stock levels',
      },
      {
        id: 'supplierManagement',
        title: 'Suppliers',
        icon: FiTruck,
        secondaryIcon: FiExternalLink,
        path: '/supplierManagement',
        description: 'Manage suppliers',
      },
      {
        id: 'reservationManagement',
        title: 'Reservations',
        icon: FiCalendar,
        secondaryIcon: FiClock,
        path: '/reservationManagement',
        description: 'Manage reservations',
      },
      {
        id: 'maintenanceManagement',
        title: 'Maintenance',
        icon: FiTool,
        secondaryIcon: FiSettings,
        path: '/maintenanceManagement',
        description: 'Manage maintenance',
      },
      {
        id: 'wasteManagement',
        title: 'Waste & Spoilage',
        icon: FiTrash2,
        path: '/wasteManagement',
        description: 'Track waste and spoilage',
      },
    ];

    const staffSubmenu = [
      {
        id: 'staff-directory',
        title: 'Staff Directory',
        icon: FiUsers,
        secondaryIcon: FiUser,
        path: '/staff/directory',
        description: 'View all staff members',
      },
      {
        id: 'schedule',
        title: 'Schedule',
        icon: FiCalendar,
        secondaryIcon: FiClock,
        path: '/staff/schedule',
        description: 'Staff scheduling',
      },
      {
        id: 'attendance',
        title: 'Attendance',
        icon: FiUserCheck,
        secondaryIcon: FiUser,
        path: '/staff/attendance',
        description: 'Staff attendance tracking',
      },
      {
        id: 'payroll',
        title: 'Payroll',
        icon: FiDollarSign,
        secondaryIcon: FiCreditCard,
        path: '/staff/payroll',
        description: 'Salary management',
      },
    ];

    return {
      dashboard: {
        id: 'dashboard',
        title: 'Dashboard',
        icon: FiHome,
        secondaryIcon: FiPieChart,
        path: '/dashboard',
        description: 'Dashboard overview and insights',
      },
      bookings: {
        id: 'booking',
        title: 'Sales & Bookings',
        icon: FiCalendar,
        expandedIcon: BsCalendarEvent,
        path: '/booking',
        description: 'Bookings and quotation management',
      },
      inventory: {
        id: 'inventory',
        title: 'Inventory',
        icon: FiPackage,
        secondaryIcon: FiBox,
        path: '/inventory',
        description: 'Manage inventory',
        submenu: inventorySubmenu,
      },
      inventoryDashboard: {
        id: 'inventory-dashboard',
        title: 'Inventory',
        icon: FiPackage,
        secondaryIcon: FiBox,
        path: '/inventory',
        description: 'Inventory dashboard',
      },
      inventoryItems: inventorySubmenu,
      ordersEvents: {
        id: 'orders&events',
        title: 'Orders & Events',
        icon: FiFileText,
        secondaryIcon: FiPlus,
        path: '/orders&events',
        description: 'Manage orders and events',
      },
      menu: {
        id: 'Menu-management',
        title: 'Menu Management',
        icon: FiFileText,
        secondaryIcon: FiPlus,
        path: '/menu',
        description: 'Manage menu',
      },
      billing: {
        id: 'billing-invoicing',
        title: 'Billing & Invoicing',
        icon: FiCreditCard,
        secondaryIcon: FiDollarSign,
        path: '/billing',
        description: 'Financial transactions',
      },
      staff: {
        id: 'staff',
        title: 'Staff Management',
        icon: FiUsers,
        secondaryIcon: FiUserPlus,
        path: '/staff',
        description: 'Manage team',
        submenu: staffSubmenu,
      },
      staffDashboard: {
        id: 'staff-dashboard',
        title: 'Staff Management',
        icon: FiUsers,
        secondaryIcon: FiUserPlus,
        path: '/staff',
        description: 'Manage team',
      },
      staffItems: staffSubmenu,
      reports: {
        id: 'reports',
        title: 'Reports',
        icon: FiFileText,
        secondaryIcon: FiPieChart,
        path: '/reports',
        description: 'Manage business reports',
      },
      notifications: {
        id: 'notifications',
        title: 'Notifications',
        icon: FiBell,
        secondaryIcon: FiAlertCircle,
        path: '/notifications',
        description: 'Alerts & updates',
        badge: unreadCount,
        showBadge: notificationBadge,
        badgeColor: '#ff4d4f',
      },
      customers: {
        id: 'customer-feedback',
        title: 'Customer Feedback',
        icon: FiMessageSquare,
        secondaryIcon: FiInfo,
        path: '/customer-feedback',
        description: 'Manage customers and feedback',
      },
      settings: {
        id: 'settings',
        title: 'Settings',
        icon: FiSettings,
        secondaryIcon: FiLock,
        path: '/settings',
        description: 'System configuration',
      },
    };
  }, [notificationBadge, unreadCount]);

  // ==================== MENU SECTIONS ====================
  const menuSections = useMemo(() => {
    const c = navigationCatalog;

    if (isSuperAdminUser || isAdminUser) {
      return [
        { title: 'MAIN', items: [c.dashboard] },
        { title: 'SALES MANAGEMENT', items: [c.bookings] },
        { title: 'OPERATIONS', items: [ c.ordersEvents, c.billing,c.menu, c.inventory] },
        { title: 'STAFF MANAGEMENT', items: [c.staff] },
        { title: 'SYSTEM', items: [c.reports, c.notifications, c.customers, c.settings] },
      ];
    }

     if (isCashierUser) {
      return [
        { title: 'MAIN', items: [c.dashboard] },
        { title: 'SALES MANAGEMENT', items: [c.bookings] },
        // ⭐ Cashiers can now access Orders & Events (read-only view).
        { title: 'OPERATIONS', items: [c.ordersEvents, c.billing] },
        { title: 'SYSTEM', items: [c.reports, c.notifications, c.customers] },
      ];
    }

    if (isInventoryManagerUser) {
      return [
        { title: 'MAIN', items: [c.dashboard] },
        { title: 'OPERATIONS', items: [, ...c.inventoryItems] },
        { title: 'SYSTEM', items: [c.notifications] },
      ];
    }

    if (isStaffManagerUser) {
      return [
        { title: 'MAIN', items: [c.dashboard] },
        { title: 'TEAM', items: [c.staff] },
        { title: 'SYSTEM', items: [c.notifications] },
      ];
    }

    if (isHeadChefOnly) {
      return [
        { title: 'OPERATIONS', items: [c.menu] },
        { title: 'SYSTEM', items: [c.notifications] },
      ];
    }

    return [{ title: 'SYSTEM', items: [c.notifications] }];
  }, [
    isAdminUser,
    isCashierUser,
    isHeadChefOnly,
    isInventoryManagerUser,
    isStaffManagerUser,
    isSuperAdminUser,
    navigationCatalog,
  ]);

  const visibleMenuSections = useMemo(
    () =>
      menuSections
        .map((section) => ({
          ...section,
          items: section.items
            .map((item) => {
              if (!item) return null;

              const itemPath = item.path.split('?')[0];
              if (Array.isArray(item.submenu)) {
                const submenu = item.submenu.filter((subItem) =>
                  canAccessPath(user, subItem.path.split('?')[0])
                );
                if (!canAccessPath(user, itemPath) && submenu.length === 0)
                  return null;
                return { ...item, submenu };
              }

              return canAccessPath(user, itemPath) ? item : null;
            })
            .filter(Boolean),
        }))
        .filter((section) => section.items.length > 0),
    [menuSections, user]
  );

  const handleItemClick = (item) => {
    if (item.submenu) {
      setOpenSubmenu(openSubmenu === item.id ? null : item.id);
    } else {
      navigate(item.path);
    }
  };

  const handleSubmenuClick = (subItem, parentId) => {
    navigate(subItem.path);
    setOpenSubmenu(parentId);
  };

  const isNavigationPathActive = (targetPath) => {
    const [pathname, query = ''] = targetPath.split('?');
    if (location.pathname !== pathname) return false;
    if (!query) return true;

    const currentParams = new URLSearchParams(location.search);
    const targetParams = new URLSearchParams(query);
    return [...targetParams.entries()].every(
      ([key, value]) => currentParams.get(key) === value
    );
  };

  const isItemActive = (item) => {
    if (item.submenu) {
      return item.submenu.some((sub) => isNavigationPathActive(sub.path));
    }
    return isNavigationPathActive(item.path);
  };

   const isSubItemActive = (path) => {
    // If a modal is open, force the attendance submenu to look active
    // We check if the path is the attendance path and if the modal-open class is on body
    // or if the openSubmenu is 'staff' and the path is attendance
    if (path === '/staff/attendance') {
      const isModalOpen = document.querySelector('.attendance-container.modal-open');
      if (isModalOpen) return true;
    }
    return isNavigationPathActive(path);
  };

  // ==================== RENDER NAV ITEM ====================
  const renderNavItem = (item) => {
    const hasBadge = item.showBadge && item.badge > 0;
    const isActive = isItemActive(item) || (item.submenu && openSubmenu === item.id);

    return (
      <div key={item.id} className="nav-item-wrapper">
        <div
          className={`nav-item ${isActive ? 'active' : ''}`}
          onClick={() => handleItemClick(item)}
          onMouseEnter={() => {
            setHoveredItem(item.id);
            if (isCollapsed) setShowTooltip(item.id);
          }}
          onMouseLeave={() => {
            setHoveredItem(null);
            setShowTooltip(null);
          }}
        >
          <div className="nav-item-content">
            <div className="icon-container" style={{ position: 'relative' }}>
              <div className={`icon-primary ${isCollapsed ? 'collapsed-icon' : ''}`}>
                <item.icon />
              </div>

              {hasBadge && (
                <motion.div
                  className="nav-notification-badge"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-12px',
                    minWidth: '20px',
                    height: '20px',
                    padding: '0 5px',
                    background: item.badgeColor || '#ff4d4f',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 0 2px var(--nav-bg, #ffffff)',
                    zIndex: 10,
                    fontFamily: 'monospace',
                    letterSpacing: '0.5px',
                  }}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </motion.div>
              )}

              {item.secondaryIcon && (
                <div
                  className={`icon-secondary ${
                    isCollapsed ? 'collapsed-icon-secondary' : ''
                  }`}
                  style={{
                    opacity: hoveredItem === item.id ? 1 : 0,
                    transform: hoveredItem === item.id ? 'scale(1)' : 'scale(0)',
                  }}
                >
                  <item.secondaryIcon />
                </div>
              )}
            </div>

            {!isCollapsed && (
              <div className="item-text">
                <span className="item-title">{item.title}</span>
                {item.description && (
                  <span className="item-description">{item.description}</span>
                )}
              </div>
            )}
          </div>

          {item.submenu && !isCollapsed && (
            <div
              className="submenu-indicator"
              style={{
                transform:
                  openSubmenu === item.id ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            >
              <FiChevronDown />
            </div>
          )}
        </div>

        <AnimatePresence>
          {item.submenu && openSubmenu === item.id && !isCollapsed && (
            <motion.div
              className="submenu"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              {item.submenu.map((subItem) => (
                <div
                  key={subItem.id}
                  className={`submenu-item ${
                    isSubItemActive(subItem.path) ? 'active' : ''
                  }`}
                  onClick={() => handleSubmenuClick(subItem, item.id)}
                >
                  <div className="submenu-icon-wrapper">
                    <subItem.icon />
                  </div>
                  <div className="submenu-text">
                    <span className="submenu-title">{subItem.title}</span>
                    {subItem.description && (
                      <span className="submenu-description">
                        {subItem.description}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {isCollapsed && showTooltip === item.id && (
          <div className="tooltip">
            <strong>{item.title}</strong>
            {item.description && <span>{item.description}</span>}
            {hasBadge && <span className="tooltip-badge">{item.badge} unread</span>}
          </div>
        )}
      </div>
    );
  };

  // ==================== RENDER ====================
  return (
    <>
      <SuccessMessage />
      <ErrorMessage />
      <WarningMessage />

      <motion.div
        className={`navigation-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}
        initial={false}
        animate={{ width: isCollapsed ? '80px' : '360px' }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="nav-backdrop" />

        <div className="nav-header">
          <motion.div
            className="logo-container"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <AnimatePresence mode="wait">
              {!isCollapsed && (
                <motion.div
                  className="logo-content"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="logo-image-wrapper">
                    <img
                      src={companyLogo}
                      alt="Dear Bab's Catering"
                      className="logo-image"
                    />
                  </div>
                  <div className="logo-text">
                    <h4>
                      Dear Bab's <span>Catering</span>
                    </h4>
                    <p>Management System</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              className="nav-collapse-toggle"
              onClick={toggleSidebar}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <GoSidebarCollapse size={20} />
              ) : (
                <GoSidebarExpand size={20} />
              )}
            </motion.button>
          </motion.div>
        </div>

        <motion.div
          className="theme-toggle-container"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <motion.button
            className="theme-toggle"
            onClick={toggleTheme}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <motion.div
              animate={{ rotate: isDarkMode ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              {isDarkMode ? <FiSun size={18} /> : <FiMoon size={18} />}
            </motion.div>
          </motion.button>
          {!isCollapsed && (
            <span className="theme-label">
              {isDarkMode ? 'Light Mode' : 'Dark Mode'}
            </span>
          )}
        </motion.div>

        <nav className="nav-menu">
          {visibleMenuSections.map((section, sectionIndex) => (
            <div key={section.title} className="nav-section">
              {!isCollapsed && (
                <motion.div
                  className="section-title"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: sectionIndex * 0.1 }}
                >
                  {section.title}
                </motion.div>
              )}

              {section.items.map((item) => renderNavItem(item))}
            </div>
          ))}
        </nav>

        <div
          className="navigation-user-profile"
          onClick={handleProfileClick}
          style={{ cursor: 'pointer' }}
        >
          <div className="navigation-profile-avatar">
            {userProfile.profile_photo ? (
              <img
                src={userProfile.profile_photo}
                alt="Profile"
                className="navigation-avatar-image"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className="navigation-avatar-content"
              style={{ display: userProfile.profile_photo ? 'none' : 'flex' }}
            >
              <FiUser size={18} />
            </div>
            <div className="navigation-status-indicator" />
          </div>

          {!isCollapsed && (
            <div className="navigation-profile-info">
              <h4>{userProfile.full_name}</h4>
              <p>
                {userProfile.role === 'admin'
                  ? 'Administrator'
                  : userProfile.role === 'user'
                  ? 'Staff Member'
                  : userProfile.role}
              </p>
            </div>
          )}

          <button
            className="navigation-logout-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowLogoutModal(true);
            }}
            disabled={isLoggingOut}
          >
            <FiLogOut size={18} />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </motion.div>

      {/* Logout Confirmation Modal */}
      <AnimatePresence mode="wait">
        {showLogoutModal && (
          <>
            <div className="navigation-modal-overlay" onClick={handleCloseModal} />
            <div className="navigation-modal-center-wrapper">
              <div className={`navigation-logout-modal ${getModalAnimationClass()}`}>
                <div className="navigation-modal-header">
                  <div className="navigation-modal-icon">
                    <FiAlertCircle size={24} />
                  </div>
                  <button
                    className="navigation-modal-close-btn"
                    onClick={handleCloseModal}
                    disabled={isLoggingOut}
                  >
                    ×
                  </button>
                </div>
                <h3 className="navigation-modal-title">
                  {modalAnimation === 'loggingOut'
                    ? 'Logging Out...'
                    : modalAnimation === 'error'
                    ? 'Logout Failed'
                    : 'Confirm Logout'}
                </h3>
                <p className="navigation-modal-message">
                  {modalAnimation === 'loggingOut'
                    ? 'Please wait while we securely log you out...'
                    : modalAnimation === 'error'
                    ? 'An error occurred during logout. Please try again.'
                    : 'Are you sure you want to logout? Any unsaved changes will be lost.'}
                </p>
                {modalAnimation !== 'loggingOut' && modalAnimation !== 'error' && (
                  <div className="navigation-session-info">
                    <FiShield size={18} />
                    <div className="navigation-session-details">
                      <strong>Current Session</strong>
                      <span>Logged in as: {userProfile.email}</span>
                      <span>Session started: {new Date().toLocaleString()}</span>
                    </div>
                  </div>
                )}
                {modalAnimation === 'error' && (
                  <p className="navigation-error-message">
                    Please check your connection and try again
                  </p>
                )}
                <div className="navigation-modal-actions">
                  <button
                    className="navigation-cancel-btn"
                    onClick={handleCloseModal}
                    disabled={isLoggingOut}
                  >
                    {modalAnimation === 'loggingOut' ? 'Please Wait...' : 'Cancel'}
                  </button>
                  <button
                    className={`navigation-confirm-btn ${
                      modalAnimation === 'loggingOut' ? 'logging-out' : ''
                    }`}
                    onClick={handleLogout}
                    disabled={isLoggingOut || modalAnimation === 'error'}
                  >
                    {modalAnimation === 'loggingOut' ? (
                      <>
                        <span className="navigation-spinner" />
                        Logging out...
                      </>
                    ) : modalAnimation === 'error' ? (
                      'Try Again'
                    ) : (
                      'Yes, Logout'
                    )}
                  </button>
                </div>
                {modalAnimation === 'loggingOut' && (
                  <div className="navigation-logout-progress" />
                )}
              </div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence mode="wait">
        {showProfileModal && (
          <>
            <div
              className="navigation-modal-overlay"
              onClick={() => setShowProfileModal(false)}
            />
            <div className="navigation-modal-center-wrapper">
              <div className="navigation-profile-modal">
                <div className="navigation-profile-modal-header">
                  <div className="navigation-profile-modal-avatar">
                    {userProfile.profile_photo ? (
                      <img
                        src={userProfile.profile_photo}
                        alt="Profile"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      className="navigation-avatar-placeholder"
                      style={{ display: userProfile.profile_photo ? 'none' : 'flex' }}
                    >
                      <FiUser size={32} />
                    </div>
                    {userProfile.is_verified && (
                      <div className="navigation-verified-badge">
                        <FiCheck size={14} />
                      </div>
                    )}
                  </div>
                  <button
                    className="navigation-profile-modal-close"
                    onClick={() => setShowProfileModal(false)}
                  >
                    ×
                  </button>
                </div>
                <h3 className="navigation-profile-modal-name">
                  {userProfile.full_name}
                </h3>
                <p className="navigation-profile-modal-role">
                  {userProfile.role === 'admin'
                    ? 'Administrator'
                    : userProfile.role === 'user'
                    ? 'Staff Member'
                    : userProfile.role}
                </p>
                <div className="navigation-profile-modal-info">
                  <div className="navigation-profile-info-item">
                    <FiMail size={16} />
                    <span>{userProfile.email}</span>
                  </div>
                  <div className="navigation-profile-info-item">
                    <FiUser size={16} />
                    <span>User ID: {userProfile.user_id}</span>
                  </div>
                  {userProfile.phone_number && (
                    <div className="navigation-profile-info-item">
                      <FiPhone size={16} />
                      <span>
                        {userProfile.country_code} {userProfile.phone_number}
                      </span>
                    </div>
                  )}
                  <div className="navigation-profile-info-item">
                    <FiCalendar size={16} />
                    <span>Member since: {userProfile.joinDate}</span>
                  </div>
                </div>
                <div className="navigation-profile-modal-actions">
                  <button
                    className="navigation-profile-edit-btn"
                    onClick={handleEditProfile}
                  >
                    <FiEdit2 size={16} /> Edit Profile
                  </button>
                  <button
                    className="navigation-profile-security-btn"
                    onClick={handleSecuritySettings}
                  >
                    <FiLock size={16} /> Security
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Edit Profile Modal */}
      <AnimatePresence mode="wait">
        {showEditProfileModal && (
          <>
            <div
              className="navigation-modal-overlay"
              onClick={() => setShowEditProfileModal(false)}
            />
            <div className="navigation-modal-center-wrapper">
              <div className="navigation-edit-profile-modal">
                <div className="navigation-edit-profile-header">
                  <h3>Edit Profile</h3>
                  <button
                    className="navigation-edit-profile-close"
                    onClick={() => setShowEditProfileModal(false)}
                  >
                    <FiX size={20} />
                  </button>
                </div>
                {formErrors.general && (
                  <div className="navigation-error-message-modal">
                    <FiAlertCircle size={16} />
                    <span>{formErrors.general}</span>
                  </div>
                )}
                <div className="navigation-edit-profile-body">
                  <div className="navigation-avatar-upload-section">
                    <div className="navigation-avatar-preview">
                      {userProfile.profile_photo ? (
                        <img
                          src={userProfile.profile_photo}
                          alt="Profile"
                          className="navigation-avatar-img"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className="navigation-avatar-placeholder"
                        style={{ display: userProfile.profile_photo ? 'none' : 'flex' }}
                      >
                        <FiUser size={32} />
                      </div>
                      {isUploading && (
                        <div className="navigation-upload-overlay">
                          <div className="navigation-upload-progress">
                            <div
                              className="navigation-upload-progress-bar"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="navigation-avatar-actions">
                      <label className="navigation-upload-btn">
                        <FiCamera size={14} />
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/jpg,image/gif,image/webp"
                          onChange={handleAvatarUpload}
                          style={{ display: 'none' }}
                        />
                        Upload Photo
                      </label>
                      {userProfile.profile_photo && (
                        <button
                          className="navigation-remove-avatar-btn"
                          onClick={handleRemoveAvatar}
                        >
                          <FiTrash2 size={14} /> Remove
                        </button>
                      )}
                    </div>
                    {formErrors.avatar && (
                      <span className="navigation-error-text">
                        {formErrors.avatar}
                      </span>
                    )}
                    <p className="navigation-avatar-hint">
                      Supported formats: JPEG, PNG, GIF, WEBP
                    </p>
                  </div>
                  <div className="navigation-edit-form">
                    <div className="navigation-form-row">
                      <div className="navigation-form-group">
                        <label>
                          Full Name <span className="required">*</span>
                        </label>
                        <input
                          type="text"
                          name="full_name"
                          value={editFormData.full_name}
                          onChange={handleEditInputChange}
                          className={formErrors.full_name ? 'error' : ''}
                        />
                        {formErrors.full_name && (
                          <span className="navigation-error-text">
                            {formErrors.full_name}
                          </span>
                        )}
                      </div>
                      <div className="navigation-form-group">
                        <label>
                          Email Address <span className="required">*</span>
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={editFormData.email}
                          onChange={handleEditInputChange}
                          className={formErrors.email ? 'error' : ''}
                        />
                        {formErrors.email && (
                          <span className="navigation-error-text">
                            {formErrors.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="navigation-form-row">
                      <div className="navigation-form-group">
                        <label>
                          User ID <span className="required">*</span>
                        </label>
                        <input
                          type="text"
                          name="user_id"
                          value={editFormData.user_id ?? ''}
                          readOnly
                          tabIndex={-1}
                          className="navigation-readonly-input"
                        />
                        <small className="navigation-field-hint">
                          User ID cannot be changed
                        </small>
                      </div>
                      <div className="navigation-form-group">
                        <label>Phone Number</label>
                        <div className="navigation-phone-input">
                          <span className="navigation-country-code">+63</span>
                          <input
                            type="tel"
                            name="phone_number"
                            value={editFormData.phone_number}
                            onChange={handleEditInputChange}
                            className={formErrors.phone_number ? 'error' : ''}
                          />
                        </div>
                        {formErrors.phone_number && (
                          <span className="navigation-error-text">
                            {formErrors.phone_number}
                          </span>
                        )}
                        <small className="navigation-field-hint">
                          10-digit mobile number
                        </small>
                      </div>
                    </div>
                    <div className="navigation-form-group">
                      <label>Location</label>
                      <input
                        type="text"
                        name="location"
                        value={editFormData.location}
                        onChange={handleEditInputChange}
                        placeholder="e.g. Manila, Philippines"
                      />
                    </div>
                    <div className="navigation-form-group">
                      <label>Bio</label>
                      <textarea
                        name="bio"
                        value={editFormData.bio}
                        onChange={handleEditInputChange}
                        rows="3"
                      />
                      <small className="navigation-field-hint">
                        Maximum 500 characters
                      </small>
                    </div>
                    <div className="navigation-password-section">
                      <button
                        type="button"
                        className="navigation-toggle-password-btn"
                        onClick={() => setShowPasswordFields(!showPasswordFields)}
                      >
                        <FiLock size={14} />
                        {showPasswordFields
                          ? 'Cancel Password Change'
                          : 'Change Password'}
                      </button>
                      {showPasswordFields && (
                        <div className="navigation-password-fields">
                          <div className="navigation-form-group">
                            <label>
                              Current Password{' '}
                              <span className="required">*</span>
                            </label>
                            <input
                              type="password"
                              name="current_password"
                              value={editFormData.current_password}
                              onChange={handleEditInputChange}
                              className={
                                formErrors.current_password ? 'error' : ''
                              }
                            />
                            {formErrors.current_password && (
                              <span className="navigation-error-text">
                                {formErrors.current_password}
                              </span>
                            )}
                          </div>
                          <div className="navigation-form-row">
                            <div className="navigation-form-group">
                              <label>New Password</label>
                              <input
                                type="password"
                                name="new_password"
                                value={editFormData.new_password}
                                onChange={handleEditInputChange}
                                className={formErrors.new_password ? 'error' : ''}
                              />
                              {formErrors.new_password && (
                                <span className="navigation-error-text">
                                  {formErrors.new_password}
                                </span>
                              )}
                            </div>
                            <div className="navigation-form-group">
                              <label>Confirm New Password</label>
                              <input
                                type="password"
                                name="new_password_confirmation"
                                value={editFormData.new_password_confirmation}
                                onChange={handleEditInputChange}
                                className={
                                  formErrors.new_password_confirmation
                                    ? 'error'
                                    : ''
                                }
                              />
                              {formErrors.new_password_confirmation && (
                                <span className="navigation-error-text">
                                  {formErrors.new_password_confirmation}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="navigation-password-requirements">
                            <p>Password requirements:</p>
                            <ul>
                              <li
                                className={
                                  editFormData.new_password.length >= 8
                                    ? 'valid'
                                    : ''
                                }
                              >
                                ✓ At least 8 characters
                              </li>
                              <li
                                className={
                                  /(?=.*[a-z])/.test(editFormData.new_password)
                                    ? 'valid'
                                    : ''
                                }
                              >
                                ✓ Contains lowercase letter
                              </li>
                              <li
                                className={
                                  /(?=.*[A-Z])/.test(editFormData.new_password)
                                    ? 'valid'
                                    : ''
                                }
                              >
                                ✓ Contains uppercase letter
                              </li>
                              <li
                                className={
                                  /(?=.*\d)/.test(editFormData.new_password)
                                    ? 'valid'
                                    : ''
                                }
                              >
                                ✓ Contains a number
                              </li>
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="navigation-edit-profile-footer">
                  <button
                    className="navigation-cancel-edit-btn"
                    onClick={() => setShowEditProfileModal(false)}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    className="navigation-save-edit-btn"
                    onClick={handleSaveProfile}
                    disabled={
                      isSaving ||
                      (
                        String(editFormData.full_name ?? '').trim() === String(userProfile.full_name ?? '').trim() &&
                        String(editFormData.email ?? '').trim() === String(userProfile.email ?? '').trim() &&
                        String(editFormData.phone_number ?? '').trim() === String(userProfile.phone_number ?? '').trim() &&
                        String(editFormData.location ?? '').trim() === String(userProfile.location ?? '').trim() &&
                        String(editFormData.bio ?? '').trim() === String(userProfile.bio ?? '').trim() &&
                        !showPasswordFields
                      )
                    }
                  >
                    {isSaving ? (
                      <>
                        <span className="navigation-spinner-small" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <FiSave size={16} /> Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Security Modal */}
      <AnimatePresence mode="wait">
        {showSecurityModal && (
          <>
            <div
              className="navigation-modal-overlay"
              onClick={() => setShowSecurityModal(false)}
            />
            <div className="navigation-modal-center-wrapper">
              <div className="navigation-security-modal">
                <div className="navigation-edit-profile-header">
                  <h3>Security Settings</h3>
                  <button
                    className="navigation-edit-profile-close"
                    onClick={() => setShowSecurityModal(false)}
                  >
                    <FiX size={20} />
                  </button>
                </div>
                <div className="navigation-security-body">
                  <div className="navigation-security-icon">
                    <FiLock size={28} />
                  </div>
                  <h4>Change Password</h4>
                  <p>Update your password to keep your account secure</p>
                  <div className="navigation-security-form">
                    <div className="navigation-form-group">
                      <label>
                        Current Password <span className="required">*</span>
                      </label>
                      <div className="navigation-password-input-wrapper">
                        <input
                          type={showSecurityPassword ? 'text' : 'password'}
                          name="current_password"
                          value={securityFormData.current_password}
                          onChange={handleSecurityInputChange}
                          className={
                            formErrors.current_password ? 'error' : ''
                          }
                        />
                        <button
                          type="button"
                          className="navigation-password-eye"
                          onClick={() => setShowSecurityPassword(!showSecurityPassword)}
                        >
                          {showSecurityPassword ? (
                            <FiEyeOff size={18} />
                          ) : (
                            <FiEye size={18} />
                          )}
                        </button>
                      </div>
                      {formErrors.current_password && (
                        <span className="navigation-error-text">
                          {formErrors.current_password}
                        </span>
                      )}
                    </div>
                    <div className="navigation-form-group">
                      <label>
                        New Password <span className="required">*</span>
                      </label>
                      <div className="navigation-password-input-wrapper">
                        <input
                          type={showSecurityNewPassword ? 'text' : 'password'}
                          name="new_password"
                          value={securityFormData.new_password}
                          onChange={handleSecurityInputChange}
                          className={formErrors.new_password ? 'error' : ''}
                        />
                        <button
                          type="button"
                          className="navigation-password-eye"
                          onClick={() =>
                            setShowSecurityNewPassword(!showSecurityNewPassword)
                          }
                        >
                          {showSecurityNewPassword ? (
                            <FiEyeOff size={18} />
                          ) : (
                            <FiEye size={18} />
                          )}
                        </button>
                      </div>
                      {formErrors.new_password && (
                        <span className="navigation-error-text">
                          {formErrors.new_password}
                        </span>
                      )}
                    </div>
                    <div className="navigation-form-group">
                      <label>
                        Confirm New Password{' '}
                        <span className="required">*</span>
                      </label>
                      <div className="navigation-password-input-wrapper">
                        <input
                          type={
                            showSecurityConfirmPassword ? 'text' : 'password'
                          }
                          name="new_password_confirmation"
                          value={securityFormData.new_password_confirmation}
                          onChange={handleSecurityInputChange}
                          className={
                            formErrors.new_password_confirmation ? 'error' : ''
                          }
                        />
                        <button
                          type="button"
                          className="navigation-password-eye"
                          onClick={() =>
                            setShowSecurityConfirmPassword(
                              !showSecurityConfirmPassword
                            )
                          }
                        >
                          {showSecurityConfirmPassword ? (
                            <FiEyeOff size={18} />
                          ) : (
                            <FiEye size={18} />
                          )}
                        </button>
                      </div>
                      {formErrors.new_password_confirmation && (
                        <span className="navigation-error-text">
                          {formErrors.new_password_confirmation}
                        </span>
                      )}
                    </div>
                    <div className="navigation-password-requirements">
                      <p>Password requirements:</p>
                      <ul>
                        <li
                          className={
                            securityFormData.new_password.length >= 8
                              ? 'valid'
                              : ''
                          }
                        >
                          ✓ At least 8 characters
                        </li>
                        <li
                          className={
                            /(?=.*[a-z])/.test(securityFormData.new_password)
                              ? 'valid'
                              : ''
                          }
                        >
                          ✓ Contains lowercase letter
                        </li>
                        <li
                          className={
                            /(?=.*[A-Z])/.test(securityFormData.new_password)
                              ? 'valid'
                              : ''
                          }
                        >
                          ✓ Contains uppercase letter
                        </li>
                        <li
                          className={
                            /(?=.*\d)/.test(securityFormData.new_password)
                              ? 'valid'
                              : ''
                          }
                        >
                          ✓ Contains a number
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="navigation-edit-profile-footer">
                  <button
                    className="navigation-cancel-edit-btn"
                    onClick={() => setShowSecurityModal(false)}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    className="navigation-save-edit-btn"
                    onClick={handleSecuritySave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <span className="navigation-spinner-small" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <FiSave size={16} /> Update Password
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Confirm Delete Avatar Modal */}
      <AnimatePresence mode="wait">
        {confirmDeleteAvatar && (
          <>
            <div
              className="navigation-modal-overlay navigation-confirm-overlay"
              onClick={() => setConfirmDeleteAvatar(false)}
            />
            <div className="navigation-modal-center-wrapper navigation-confirm-wrapper">
              <div className="navigation-confirm-modal">
                <div className="navigation-confirm-header">
                  <div className="navigation-confirm-icon warning">
                    <FiAlertCircle size={24} />
                  </div>
                  <h3>Confirm Remove Photo</h3>
                </div>
                <p className="navigation-confirm-message">
                  Are you sure you want to remove your profile photo?
                </p>
                <div className="navigation-confirm-actions">
                  <button
                    className="navigation-confirm-cancel"
                    onClick={() => setConfirmDeleteAvatar(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="navigation-confirm-danger"
                    onClick={confirmRemoveAvatar}
                  >
                    Yes, Remove
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navigation;