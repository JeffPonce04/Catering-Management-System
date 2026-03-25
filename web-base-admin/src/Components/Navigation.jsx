// Navigation.jsx - Updated with minimized spacing
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../Components/styles/Navigation.css';
import { useLocation, useNavigate } from 'react-router-dom';

// Import your logo image - adjust the path based on where you store your logo
import companyLogo from '../Components/images/logo.png'; // Update this path to your actual logo location

// Professional icon imports with better organization
import { 
  // Dashboard & Analytics
  FiHome, 
  FiPieChart,
  FiTrendingUp,
  
  // Booking & Calendar
  FiCalendar,
  FiClock,
  FiStar,
  FiShoppingBag,
  FiTruck,
  
  // Business Operations
  FiPackage,
  FiClipboard,  
  FiUsers,
  FiDollarSign,
  FiUserCheck,
  FiUserPlus,

  // System & Settings
  FiSettings,
  FiBell,
  FiUser,
  FiLock,
  FiHelpCircle,
  FiLogOut,
  
  // Navigation Controls
  FiChevronLeft,
  FiChevronRight,
  FiChevronDown,
  
  // Theme
  FiSun,
  FiMoon,
  
  // Additional
  FiBarChart2,
  FiActivity,
  FiGrid,
  FiFileText,
  FiDownload,
  FiPrinter,
  FiCalendar as FiCalendarIcon,
  FiCopy,
  FiCreditCard,
  FiBox,
  FiAlertCircle
} from 'react-icons/fi';

import { 
  BsCalendarCheck, 
  BsCalendarEvent,
  BsCalendarWeek,
  BsCalendarDate,
  BsCalendarMonth,
  BsClockHistory,
  BsCashStack,
  BsReceipt,
  BsTruck,
  BsCart3,
  BsPeople,
  BsShieldLock
} from 'react-icons/bs';

import { 
  MdOutlineInventory,
  MdOutlinePayments,
  MdOutlineNotificationsActive,
  MdOutlineReport,
  MdOutlineAssessment,
  MdOutlineSchedule,
  MdOutlineDateRange,
  MdOutlineEvent,
  MdHistory,
  MdOutlineRestaurantMenu,
  MdOutlineEventNote,
  MdOutlinePointOfSale,
  MdOutlineReceipt,
  MdOutlineLocalShipping,
  MdOutlineGroup,
  MdOutlinePersonAdd,
  MdOutlineAttachMoney,
  MdOutlineTimer,
  MdOutlineCalendarToday,
  MdOutlineLogout,
  MdOutlineSecurity
} from 'react-icons/md';

import { 
  RiTeamLine,
  RiSettings4Line,
  RiDashboardLine,
  RiFilePaperLine,
  RiCalendarScheduleLine,
  RiLineChartLine,
  RiCalendarEventLine,
  RiHistoryLine,
  RiBillLine,
  RiWalletLine,
  RiShoppingCartLine,
  RiTruckLine,
  RiGroupLine,
  RiUserSettingsLine,
  RiUserStarLine
} from 'react-icons/ri';

import {
  HiOutlineDocumentReport,
  HiOutlineChartBar,
  HiOutlineCalendar,
  HiOutlineCash,
  HiOutlineShoppingCart,
  HiOutlineTruck
} from 'react-icons/hi';

const Navigation = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [showTooltip, setShowTooltip] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [modalAnimation, setModalAnimation] = useState('idle');
  
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    document.body.className = isDarkMode ? 'dark-mode' : 'light-mode';
  }, [isDarkMode]);

  // Get current active item based on pathname
  useEffect(() => {
    const path = location.pathname;
    
    // Check if current path matches any item or submenu
    menuSections.forEach(section => {
      section.items.forEach(item => {
        if (item.submenu) {
          item.submenu.forEach(subItem => {
            if (subItem.path === path) {
              setOpenSubmenu(item.id);
            }
          });
        }
      });
    });
  }, [location]);

  // Clean up modal state on unmount
  useEffect(() => {
    return () => {
      setShowLogoutModal(false);
      setIsLoggingOut(false);
      setModalAnimation('idle');
    };
  }, []);

  // Handle escape key press
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape' && showLogoutModal) {
        handleCloseModal();
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [showLogoutModal]);

  // Handle body scroll lock when modal is open
  useEffect(() => {
    if (showLogoutModal) {
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = '15px'; // Prevent layout shift
    } else {
      document.body.style.overflow = 'unset';
      document.body.style.paddingRight = '0px';
    }

    return () => {
      document.body.style.overflow = 'unset';
      document.body.style.paddingRight = '0px';
    };
  }, [showLogoutModal]);

  // Logout handler with improved flow
  const handleLogout = async () => {
    setIsLoggingOut(true);
    setModalAnimation('loggingOut');
    
    // Simulate logout process (you can replace with actual API call)
    try {
      // Clear all storage
      localStorage.removeItem('userToken');
      localStorage.removeItem('userData');
      localStorage.removeItem('rememberMe');
      sessionStorage.clear();
      
      // Clear any cookies if you're using them
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      
      // Small delay to show the logging out animation
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Close modal first
      setShowLogoutModal(false);
      setModalAnimation('idle');
      
      // Then navigate to login
      navigate('/login', { 
        state: { 
          message: 'You have been successfully logged out',
          timestamp: Date.now()
        },
        replace: true 
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Handle error gracefully
      setModalAnimation('error');
      setTimeout(() => {
        setShowLogoutModal(false);
        setModalAnimation('idle');
        setIsLoggingOut(false);
      }, 1500);
    }
  };

  // Clean close modal handler
  const handleCloseModal = () => {
    if (isLoggingOut) return; // Prevent closing while logging out
    
    setModalAnimation('closing');
    setTimeout(() => {
      setShowLogoutModal(false);
      setModalAnimation('idle');
      setIsLoggingOut(false);
    }, 200);
  };

  // Organized menu structure with categories - ALL PATHS WITHOUT /app/ PREFIX
  const menuSections = [
    {
      title: 'MAIN',
      items: [
        {
          id: 'dashboard',
          title: 'Dashboard',
          icon: RiDashboardLine,
          secondaryIcon: FiPieChart,
          path: '/dashboard',
          description: 'Overview & Analytics'
        },
        {
          id: 'reports',
          title: 'Reports',
          icon: HiOutlineDocumentReport,
          secondaryIcon: MdOutlineReport,
          path: '/reports',
          description: 'Reports & Analytics',
        },
      ]
    },
    {
      title: 'BOOKING MANAGEMENT',
      items: [
        {
          id: 'booking',
          title: 'Booking Center',
          icon: BsCalendarCheck,
          expandedIcon: BsCalendarEvent,
          path: '/booking',
          description: 'Manage all bookings',
        }
      ]
    },
    {
      title: 'OPERATIONS',
      items: [
        {
          id: 'inventory',
          title: 'Inventory',
          icon: MdOutlineInventory,
          secondaryIcon: FiPackage,
          path: '/inventory',
          description: 'Stock management'
        },
        {
          id: 'event-management',
          title: 'Event Management',
          icon: MdOutlineEventNote,
          secondaryIcon: BsCalendarEvent,
          path: '/events',
          description: 'Manage events',
          submenu: [
            {
              id: 'event-planning',
              title: 'Event Planning',
              icon: MdOutlineRestaurantMenu,
              path: '/events/planning',
              description: 'Plan and organize events'
            },
            {
              id: 'event-calendar',
              title: 'Event Calendar',
              icon: BsCalendarMonth,
              path: '/events/calendar',
              description: 'View event schedule'
            },
            {
              id: 'event-setup',
              title: 'Event Setup',
              icon: FiTruck,
              path: '/events/setup',
              description: 'Event logistics and setup'
            }
          ]
        },
        {
          id: 'order-management',
          title: 'Order Management',
          icon: BsCart3,
          secondaryIcon: FiShoppingBag,
          path: '/orders',
          description: 'Manage orders',
          submenu: [
            {
              id: 'active-orders',
              title: 'Active Orders',
              icon: FiClock,
              path: '/orders/active',
              description: 'Current orders'
            },
            {
              id: 'order-history',
              title: 'Order History',
              icon: MdHistory,
              path: '/orders/history',
              description: 'Past orders'
            },
            {
              id: 'order-tracking',
              title: 'Order Tracking',
              icon: BsTruck,
              path: '/orders/tracking',
              description: 'Track deliveries'
            }
          ]
        },
        {
          id: 'billing-invoicing',
          title: 'Billing & Invoicing',
          icon: RiBillLine,
          secondaryIcon: FiCreditCard,
          path: '/billing',
          description: 'Financial transactions',
          submenu: [
            {
              id: 'invoices',
              title: 'Invoices',
              icon: MdOutlineReceipt,
              path: '/billing/invoices',
              description: 'Manage invoices'
            },
            {
              id: 'payments',
              title: 'Payments',
              icon: BsCashStack,
              path: '/billing/payments',
              description: 'Payment processing'
            },
            {
              id: 'receipts',
              title: 'Receipts',
              icon: BsReceipt,
              path: '/billing/receipts',
              description: 'View receipts'
            }
          ]
        }
      ]
    },
    
    {
      title: 'TEAM',
      items: [
        {
          id: 'staff',
          title: 'Staff Management',
          icon: RiTeamLine,
          secondaryIcon: FiUserPlus,
          path: '/staff',
          description: 'Manage team',
          submenu: [
            {
              id: 'staff-directory',
              title: 'Staff Directory',
              icon: BsPeople,
              path: '/staff/directory',
              description: 'View all staff members'
            },
            {
              id: 'attendance',
              title: 'Attendance',
              icon: FiUserCheck,
              path: '/staff/attendance',
              description: 'Staff attendance tracking'
            },
            {
              id: 'payroll',
              title: 'Payroll',
              icon: MdOutlineAttachMoney,
              path: '/staff/payroll',
              description: 'Salary management'
            },
            {
              id: 'schedule',
              title: 'Schedule',
              icon: MdOutlineSchedule,
              path: '/staff/schedule',
              description: 'Staff scheduling'
            }
          ]
        }
      ]
    },
    {
      title: 'SYSTEM',
      items: [
        {
          id: 'notifications',
          title: 'Notifications',
          icon: MdOutlineNotificationsActive,
          secondaryIcon: FiBell,
          path: '/notifications',
          description: 'Alerts & updates'
        },
        {
          id: 'settings',
          title: 'Settings',
          icon: RiSettings4Line,
          secondaryIcon: FiLock,
          path: '/settings',
          description: 'System configuration'
        }
      ]
    }
  ];

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

  // Check if item is active
  const isItemActive = (item) => {
    if (item.submenu) {
      return item.submenu.some(sub => sub.path === location.pathname);
    }
    return item.path === location.pathname;
  };

  // Check if subitem is active
  const isSubItemActive = (path) => {
    return location.pathname === path;
  };

  // Toggle theme function
  const toggleTheme = (e) => {
    e.stopPropagation(); // Prevent triggering any parent click events
    setIsDarkMode(!isDarkMode);
  };

  // Get modal animation class
  const getModalAnimationClass = () => {
    switch(modalAnimation) {
      case 'loggingOut':
        return 'modal-pulse';
      case 'error':
        return 'modal-shake';
      case 'closing':
        return 'modal-fade-out';
      default:
        return '';
    }
  };

  return (
    <>
      <motion.div 
        className={`navigation-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}
        initial={false}
        animate={{ width: isCollapsed ? '98px' : '360px' }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Glass morphism effect background */}
        <div className="nav-backdrop" />
        
        {/* Header with logo only - click to collapse/expand */}
        <div className="nav-header">
          <motion.div 
            className="logo-container"
            onClick={() => setIsCollapsed(!isCollapsed)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{ cursor: 'pointer' }}
          >
            <div className="logo-image-wrapper">
              <img src={companyLogo} alt="Dear Bab's Catering" className="logo-image" />
            </div>
            
            <AnimatePresence>
              {!isCollapsed && (
                <motion.div 
                  className="logo-text"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <h4>Dear Bab's<span> Catering</span></h4>
                  <p>Management System</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Small indicator arrow that shows on hover */}
            <motion.div 
              className="collapse-hint"
              animate={{ rotate: isCollapsed ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              {isCollapsed ? <FiChevronRight /> : <FiChevronLeft />}
            </motion.div>
          </motion.div>
        </div>

        {/* Theme Toggle - positioned below logo */}
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
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            <motion.div
              animate={{ rotate: isDarkMode ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              {isDarkMode ? <FiSun /> : <FiMoon />}
            </motion.div>
          </motion.button>
          {!isCollapsed && <span className="theme-label">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
        </motion.div>

        {/* Navigation Menu with sections */}
        <nav className="nav-menu">
          {menuSections.map((section, sectionIndex) => (
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
              
              {section.items.map((item) => (
                <div key={item.id} className="nav-item-wrapper">
                  <motion.div
                    className={`nav-item ${isItemActive(item) || (item.submenu && openSubmenu === item.id) ? 'active' : ''}`}
                    onClick={() => handleItemClick(item)}
                    onHoverStart={() => {
                      setHoveredItem(item.id);
                      if (isCollapsed) setShowTooltip(item.id);
                    }}
                    onHoverEnd={() => {
                      setHoveredItem(null);
                      setShowTooltip(null);
                    }}
                    whileHover={{ x: isCollapsed ? 0 : 8 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  >
                    <div className="nav-item-content">
                      <div className="icon-container">
                        <motion.div 
                          className="icon-primary"
                          animate={{
                            scale: hoveredItem === item.id ? 1.1 : 1,
                          }}
                          transition={{ duration: 0.2 }}
                        >
                          <item.icon />
                        </motion.div>
                        
                        {item.secondaryIcon && (
                          <motion.div 
                            className="icon-secondary"
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ 
                              opacity: hoveredItem === item.id ? 1 : 0,
                              scale: hoveredItem === item.id ? 1 : 0
                            }}
                            transition={{ duration: 0.2 }}
                          >
                            <item.secondaryIcon />
                          </motion.div>
                        )}
                      </div>
                      
                      {!isCollapsed && (
                        <div className="item-text">
                          <motion.span 
                            className="item-title"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.1 }}
                          >
                            {item.title}
                          </motion.span>
                          {item.description && (
                            <motion.span 
                              className="item-description"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 0.7 }}
                              transition={{ delay: 0.15 }}
                            >
                              {item.description}
                            </motion.span>
                          )}
                        </div>
                      )}
                    </div>

                    {item.submenu && !isCollapsed && (
                      <motion.div
                        className="submenu-indicator"
                        animate={{ rotate: openSubmenu === item.id ? 180 : 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <FiChevronDown />
                      </motion.div>
                    )}
                  </motion.div>

                  {/* Submenu with staggered animations */}
                  <AnimatePresence>
                    {item.submenu && openSubmenu === item.id && !isCollapsed && (
                      <motion.div 
                        className="submenu"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        {item.submenu.map((subItem, index) => (
                          <motion.div
                            key={subItem.id}
                            className={`submenu-item ${isSubItemActive(subItem.path) ? 'active' : ''}`}
                            onClick={() => handleSubmenuClick(subItem, item.id)}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            whileHover={{ x: 5 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="submenu-icon-wrapper">
                              <subItem.icon />
                            </div>
                            <div className="submenu-text">
                              <span className="submenu-title">{subItem.title}</span>
                              {subItem.description && (
                                <span className="submenu-description">{subItem.description}</span>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Tooltip for collapsed mode */}
                  {isCollapsed && showTooltip === item.id && (
                    <motion.div 
                      className="tooltip"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                    >
                      <strong>{item.title}</strong>
                      {item.description && <span>{item.description}</span>}
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>

        {/* User Profile Section */}
        <motion.div 
          className="user-profile"
          whileHover={{ backgroundColor: 'var(--hover-bg)' }}
          transition={{ duration: 0.2 }}
        >
          <div className="profile-avatars">
            <div className="avatar-content">
              <FiUser />
            </div>
            <motion.div 
              className="status-indicator"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          
          {!isCollapsed && (
            <motion.div 
              className="profile-info"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <h4>Jefferson Ponce</h4>
              <p>System Programmer</p>
            </motion.div>
          )}
          
          {!isCollapsed && (
            <motion.button 
              className="logout-btn"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowLogoutModal(true)}
              disabled={isLoggingOut}
            >
              <FiLogOut />
            </motion.button>  
          )}
        </motion.div>
      </motion.div>

      {/* Logout Confirmation Modal */}
      <AnimatePresence mode="wait">
        {showLogoutModal && (
          <>
            <motion.div 
              className="modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handleCloseModal}
            />
            
            <motion.div 
              className={`logout-modal ${getModalAnimationClass()}`}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ 
                type: 'spring', 
                damping: 25, 
                stiffness: 300,
                duration: 0.3
              }}
            >
              <div className="modal-header">
                <motion.div 
                  className="modal-icon"
                  animate={modalAnimation === 'loggingOut' ? { 
                    rotate: [0, 360],
                    scale: [1, 1.2, 1]
                  } : {}}
                  transition={{ 
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                >
                  {modalAnimation === 'loggingOut' ? (
                    <FiLogOut />
                  ) : modalAnimation === 'error' ? (
                    <FiAlertCircle style={{ color: '#f44336' }} />
                  ) : (
                    <FiAlertCircle />
                  )}
                </motion.div>
                <button 
                  className="modal-close-btn"
                  onClick={handleCloseModal}
                  disabled={isLoggingOut}
                >
                  ×
                </button>
              </div>
              
              <h3>
                {modalAnimation === 'loggingOut' ? 'Logging Out...' : 
                 modalAnimation === 'error' ? 'Logout Failed' : 
                 'Confirm Logout'}
              </h3>
              
              <p>
                {modalAnimation === 'loggingOut' ? 
                  'Please wait while we securely log you out...' : 
                  modalAnimation === 'error' ? 
                  'An error occurred during logout. Please try again.' : 
                  'Are you sure you want to logout? Any unsaved changes will be lost.'}
              </p>
              
              {modalAnimation !== 'loggingOut' && modalAnimation !== 'error' && (
                <motion.div 
                  className="session-info"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <BsShieldLock />
                  <div className="session-details">
                    <strong>Current Session</strong>
                    <span>Logged in as: jefferson.ponce@dearbabs.com</span>
                    <span>Session started: {new Date().toLocaleString()}</span>
                  </div>
                </motion.div>
              )}
              
              {modalAnimation === 'error' && (
                <motion.p 
                  className="error-message"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  Please check your connection and try again
                </motion.p>
              )}
              
              <div className="modal-actions">
                <motion.button
                  className="cancel-btn"
                  onClick={handleCloseModal}
                  whileHover={!isLoggingOut ? { scale: 1.02 } : {}}
                  whileTap={!isLoggingOut ? { scale: 0.98 } : {}}
                  disabled={isLoggingOut}
                  style={{ 
                    opacity: isLoggingOut ? 0.5 : 1,
                    cursor: isLoggingOut ? 'not-allowed' : 'pointer'
                  }}
                >
                  {modalAnimation === 'loggingOut' ? 'Please Wait...' : 'Cancel'}
                </motion.button>
                
                <motion.button
                  className={`confirm-btn ${modalAnimation === 'loggingOut' ? 'logging-out' : ''}`}
                  onClick={handleLogout}
                  whileHover={!isLoggingOut && modalAnimation !== 'error' ? { scale: 1.02 } : {}}
                  whileTap={!isLoggingOut && modalAnimation !== 'error' ? { scale: 0.98 } : {}}
                  disabled={isLoggingOut || modalAnimation === 'error'}
                  style={{ 
                    opacity: isLoggingOut || modalAnimation === 'error' ? 0.5 : 1,
                    cursor: isLoggingOut || modalAnimation === 'error' ? 'not-allowed' : 'pointer'
                  }}
                >
                  {modalAnimation === 'loggingOut' ? (
                    <>
                      <span className="spinner" />
                      Logging out...
                    </>
                  ) : modalAnimation === 'error' ? (
                    'Try Again'
                  ) : (
                    'Yes, Logout'
                  )}
                </motion.button>
              </div>

              {/* Progress bar for logout animation */}
              {modalAnimation === 'loggingOut' && (
                <motion.div 
                  className="logout-progress"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                />
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navigation;