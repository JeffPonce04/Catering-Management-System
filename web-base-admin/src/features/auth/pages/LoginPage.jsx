// src/pages/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { 
  FaEye, FaEyeSlash, FaSpinner, FaExclamationCircle,
  FaEnvelope, FaCheckCircle,
  FaMapMarkerAlt, FaClipboardList, FaUsers, FaChartBar
} from 'react-icons/fa';
import { useLogin, useForgotPassword } from '../../../hooks/useAuth';
import { useAuth } from '../../../contexts/AuthContext';
import { getDefaultRouteForUser } from '../../../utils/roleRoutes';
import posterImage from '../../../assets/images/poster2.png';
import logoImage from '../../../assets/images/logo.png';
import '../styles/LoginPage.css';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated: isAuth, loading: authLoading, user } = useAuth();

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loginError, setLoginError] = useState('');
  
  const [showSplash, setShowSplash] = useState(true);
  const [splashStage, setSplashStage] = useState('dots');

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotData, setForgotData] = useState({ userId: '', email: '' });
  const [resetSent, setResetSent] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const loginMutation = useLogin();
  const forgotPasswordMutation = useForgotPassword();
  const isLoading = loginMutation.isPending || forgotPasswordMutation.isPending;

  useEffect(() => {
    const dotsTimer = setTimeout(() => {
      setSplashStage('logo');
    }, 1000);

    const logoTimer = setTimeout(() => {
      setSplashStage('hidden');
      setShowSplash(false);
    }, 2200);

    return () => {
      clearTimeout(dotsTimer);
      clearTimeout(logoTimer);
    };
  }, []);

  useEffect(() => {
    if (!authLoading && isAuth) {
      const from = location.state?.from?.pathname;
      const target = from && from !== '/login' ? from : getDefaultRouteForUser(user);
      if (location.pathname !== target) {
        navigate(target, { replace: true });
      }
    }
  }, [isAuth, authLoading, user, location.pathname, location.state, navigate]);

  useEffect(() => {
    if (loginMutation.isSuccess) {
      setLoginError('');
      setErrors({});
      
      setTimeout(() => {
        const target = getDefaultRouteForUser(loginMutation.data?.user || user);
        navigate(target, { replace: true });
      }, 500);
    }
  }, [loginMutation.isSuccess, navigate, user]);

  useEffect(() => {
    if (loginMutation.isError) {
      const error = loginMutation.error;
      const errorData = error.response?.data;
      setLoginError(errorData?.message || 'Invalid credentials. Please try again.');
    }
  }, [loginMutation.isError, loginMutation.error]);

  useEffect(() => {
    if (forgotPasswordMutation.isSuccess) {
      setResetSent(true);
      setTimeout(() => {
        closeForgotModal();
        setResetSent(false);
      }, 3000);
    }
  }, [forgotPasswordMutation.isSuccess]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    if (loginError) setLoginError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setErrors({});

    if (!formData.username.trim()) {
      setErrors({ username: 'Username or Email is required' });
      return;
    }
    if (!formData.password) {
      setErrors({ password: 'Password is required' });
      return;
    }

    loginMutation.mutate({
      userId: formData.username.trim(),
      password: formData.password,
      remember_me: rememberMe
    });
  };

  const handleForgotPasswordClick = () => {
    const accountIdentifier = formData.username.trim();
    if (!accountIdentifier) {
      setErrors({ username: 'Please enter your Username or Email first' });
      return;
    }
    setForgotData({
      userId: accountIdentifier,
      email: accountIdentifier.includes('@') ? accountIdentifier : ''
    });
    setShowForgotModal(true);
    setResetSent(false);
  };

  const handleForgotSubmit = (e) => {
    e.preventDefault();
    const { userId, email } = forgotData;
    if (!userId.trim() || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors({ fp_email: 'Please enter a valid email address' });
      return;
    }
    forgotPasswordMutation.mutate({ user_id: userId, email });
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotData({ userId: '', email: '' });
    setErrors({});
    setResetSent(false);
  };

  const openTerms = () => {
    setShowTermsModal(true);
    document.body.style.overflow = 'hidden';
  };

  const closeTerms = () => {
    setShowTermsModal(false);
    document.body.style.overflow = 'unset';
  };

  const openPrivacy = () => {
    setShowPrivacyModal(true);
    document.body.style.overflow = 'hidden';
  };

  const closePrivacy = () => {
    setShowPrivacyModal(false);
    document.body.style.overflow = 'unset';
  };

  if (showSplash) {
    return (
      <div className="login-splash">
        <div className="login-splash-content">
          {splashStage === 'dots' && (
            <>
              <div className="login-dots-loader">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
              <p className="login-splash-text">Loading</p>
            </>
          )}
          {splashStage === 'logo' && (
            <>
              <div className="login-splash-brand-large">Dear Ba'bs</div>
              <p className="login-splash-sub">Catering Management System</p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="login-loading">
        <div className="login-loading-spinner">
          <FaSpinner className="login-spinner" />
        </div>
        <span>Loading...</span>
      </div>
    );
  }

  if (isAuth) return null;

  return (
    <div className="login-container">
      <div className="login-main">
        {/* ===== LEFT SECTION ===== */}
        <div className="login-left-section">
          {/* Headline */}
          <div className="login-headline">
            <h1>
              <span className="headline-black">Streamline your</span>
              <span className="headline-blue">catering operations</span>
              <span className="headline-black">with ease.</span>
            </h1>
          </div>

          {/* Features */}
          <div className="login-features">
            <div className="feature-item">
              <div className="feature-icon-wrapper">
                <FaMapMarkerAlt />
              </div>
              <div className="feature-text">
                <h4>Real-Time Order Tracking</h4>
                <p>Track bookings, orders, and event progress</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon-wrapper">
                <FaUsers />
              </div>
              <div className="feature-text">
                <h4>Employee Management</h4>
                <p>Manage staff schedules and assignments</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon-wrapper">
                <FaClipboardList />
              </div>
              <div className="feature-text">
                <h4>Menu & Inventory Management</h4>
                <p>Manage menus, ingredients, and inventory</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon-wrapper">
                <FaChartBar />
              </div>
              <div className="feature-text">
                <h4>Reports & Business Insights</h4>
                <p>Monitor operations and business performance</p>
              </div>
            </div>
          </div>

          {/* Staff Image */}
          <div className="login-poster-container">
            <img src={posterImage} alt="Dear Ba'bs Staff" className="login-poster-image" />
          </div>
        </div>

        {/* ===== VERTICAL DIVIDER ===== */}
        <div className="login-divider"></div>

        {/* ===== RIGHT SECTION ===== */}
        <div className="login-right-section">
          {/* Logo */}
          <div className="login-logo">
            <img src={logoImage} alt="Dear Ba'bs Logo" />
          </div>

          {/* Login Form */}
          <div className="login-form-container">
            <div className="login-header">
              <h2>Welcome back</h2>
              <p>Sign in to your account to continue.</p>
            </div>

            {loginError && (
              <div className="login-error-global">
                <FaExclamationCircle />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="login-form" noValidate>
              <div className="login-field-group">
                <label className="login-field-label">Username or Email</label>
                <div className="login-input-wrapper">
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className={`login-input ${errors.username ? 'error' : ''}`}
                    autoComplete="username"
                    placeholder="Enter your username or email"
                  />
                </div>
                {errors.username && <span className="login-field-error">{errors.username}</span>}
              </div>

              <div className="login-field-group">
                <label className="login-field-label">Password</label>
                <div className="login-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className={`login-input ${errors.password ? 'error' : ''}`}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                  />
                  <button 
                    type="button" 
                    className="login-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex="-1"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                {errors.password && <span className="login-field-error">{errors.password}</span>}
              </div>

              <div className="login-options-row">
                <label className="login-remember">
                  <input 
                    type="checkbox" 
                    checked={rememberMe} 
                    onChange={(e) => setRememberMe(e.target.checked)} 
                  />
                  <span>Remember me</span>
                </label>
                <button 
                  type="button" 
                  className="login-forgot-link"
                  onClick={handleForgotPasswordClick}
                >
                  Forgot password?
                </button>
              </div>

              <button type="submit" className="login-submit-btn" disabled={isLoading}>
                {loginMutation.isPending ? (
                  <>
                    <FaSpinner className="login-spinner" /> 
                    Signing In...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>

              <div className="login-security">
                <div className="login-security-text">
                  Restricted to authorized personnel only.
                </div>
                <div className="login-security-badges">
                  <span>PROTECTED</span>
                  <span>SECURED</span>
                  <span>TRUSTED</span>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* ===== FOOTER ===== */}
      <footer className="login-footer">
        <div className="login-footer-links">
          <button className="login-footer-link" onClick={openTerms}>Terms of Use</button>
          <span className="login-footer-sep">and</span>
          <button className="login-footer-link" onClick={openPrivacy}>Privacy Policy</button>
        </div>
        <div className="login-footer-copyright">
          © 2026 Dear Ba'bs Management System
        </div>
      </footer>

      {/* FORGOT PASSWORD MODAL */}
      {showForgotModal && (
        <div className="forgot-modal-overlay" onClick={closeForgotModal}>
          <div className="forgot-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="forgot-modal-close" onClick={closeForgotModal}>×</button>
            
            {resetSent ? (
              <div className="forgot-success">
                <FaCheckCircle className="forgot-success-icon" />
                <h3 className="forgot-modal-title">Reset Link Sent!</h3>
                <p className="forgot-modal-desc">
                  We've sent a password reset link to your email. 
                  Please check your inbox.
                </p>
              </div>
            ) : (
              <>
                <h3 className="forgot-modal-title">Reset Password</h3>
                <p className="forgot-modal-desc">
                  Enter your registered email to receive a reset link.
                </p>
                <form onSubmit={handleForgotSubmit} noValidate>
                  <div className="forgot-field-group">
                    <label>Account</label>
                    <input 
                      type="text" 
                      value={forgotData.userId} 
                      readOnly 
                      className="forgot-input disabled" 
                    />
                  </div>
                  <div className="forgot-field-group">
                    <label>Registered Email</label>
                    <div className="forgot-input-wrapper">
                      <FaEnvelope className="forgot-input-icon" />
                      <input 
                        type="email" 
                        value={forgotData.email}
                        onChange={(e) => setForgotData({ ...forgotData, email: e.target.value })}
                        placeholder="Enter your email address"
                        className={`forgot-input ${errors.fp_email ? 'error' : ''}`}
                        autoFocus
                      />
                    </div>
                    {errors.fp_email && <span className="forgot-error">{errors.fp_email}</span>}
                  </div>
                  <button 
                    type="submit" 
                    className="forgot-submit-btn" 
                    disabled={forgotPasswordMutation.isPending}
                  >
                    {forgotPasswordMutation.isPending ? (
                      <><FaSpinner className="forgot-spinner" /> Sending...</>
                    ) : (
                      'Send Reset Link'
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* TERMS MODAL */}
      {showTermsModal && (
        <div className="terms-modal-overlay" onClick={closeTerms}>
          <div className="terms-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="terms-modal-close" onClick={closeTerms}>×</button>
            <div className="terms-modal-body">
              <h2>Terms of Use</h2>
              <p className="terms-date">Effective Date: January 1, 2026</p>
              
              <h3>1. Use of the System</h3>
              <p>The system provides catering-related services, including menu browsing, menu customization, quotations, event booking, payment processing, booking status tracking, event updates, customer communication, and feedback.</p>
              <p>Customers may browse available menus and packages without an account. However, an account is required before submitting a booking request, making certain transactions, or accessing account-specific information.</p>
              <p>Users agree to provide accurate, complete, and updated information when using the system.</p>

              <h3>2. User Accounts</h3>
              <p>Customers are responsible for maintaining the confidentiality of their login credentials and for all activities performed through their accounts.</p>
              <p>Staff members may access the system only through credentials or employee authentication methods provided by the organization.</p>
              <p>Administrative accounts are created and managed only by authorized administrators. Users must not attempt to access another person's account, bypass authentication, or access features outside their assigned permissions.</p>
              <p>The organization reserves the right to suspend or deactivate an account when there is reasonable evidence of unauthorized use, fraud, abuse, or violation of these Terms.</p>

              <h3>3. Data and Privacy</h3>
              <p>Your use of the system is also governed by our <strong>Privacy Policy</strong>, which explains how personal information is collected, used, stored, protected, and disclosed.</p>

              <h3>4. Prohibited Activities</h3>
              <p>Users must not:</p>
              <ul>
                <li>Provide false or misleading information.</li>
                <li>Access another user's account without authorization.</li>
                <li>Attempt to bypass system security.</li>
                <li>Manipulate bookings, payments, inventory, attendance, payroll, or other records without authorization.</li>
                <li>Upload malicious or harmful content.</li>
                <li>Use the system for fraudulent activities.</li>
                <li>Interfere with the normal operation of the system.</li>
              </ul>

              <h3>5. Contact Us</h3>
              <p><strong>Email:</strong> info@dearbabs.com</p>
              <p><strong>Phone:</strong> +63 (2) 8123 4567</p>
              <p><strong>Address:</strong> 123 Catering Street, Metro Manila, Philippines</p>
            </div>
          </div>
        </div>
      )}

      {/* PRIVACY MODAL */}
      {showPrivacyModal && (
        <div className="terms-modal-overlay" onClick={closePrivacy}>
          <div className="terms-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="terms-modal-close" onClick={closePrivacy}>×</button>
            <div className="terms-modal-body">
              <h2>Privacy Policy</h2>
              <p className="terms-date">Effective Date: January 1, 2026</p>

              <h3>1. Information We Collect</h3>
              <p><strong>Account Information:</strong> When you create an account, we collect your name, email address, phone number, and other details you provide during registration.</p>
              <p><strong>Booking Information:</strong> When you make a booking, we collect event details including date, time, location, number of guests, menu selections, special requests, and payment information.</p>
              <p><strong>Usage Data:</strong> We collect information about how you use our system, including pages visited, features used, and interactions with our services.</p>
              <p><strong>Device Information:</strong> We may collect information about the device you use to access our system, including IP address, browser type, and operating system.</p>

              <h3>2. How We Use Your Information</h3>
              <ul>
                <li>To create and manage your account.</li>
                <li>To process and manage your catering bookings.</li>
                <li>To process payments and manage transactions.</li>
                <li>To communicate with you about your bookings, updates, and promotional offers.</li>
                <li>To improve our services and user experience.</li>
                <li>To comply with legal and regulatory requirements.</li>
              </ul>

              <h3>3. Data Storage and Security</h3>
              <p>We implement appropriate technical and organizational measures to protect your personal information from unauthorized access, alteration, disclosure, or destruction. This includes encryption of sensitive data, access controls, regular security assessments, and staff training.</p>

              <h3>4. Your Rights</h3>
              <ul>
                <li><strong>Access:</strong> You may request access to your personal information.</li>
                <li><strong>Correction:</strong> You may request corrections to inaccurate or incomplete information.</li>
                <li><strong>Deletion:</strong> You may request deletion of your personal information, subject to legal obligations.</li>
                <li><strong>Objection:</strong> You may object to the processing of your information under certain circumstances.</li>
              </ul>

              <h3>5. Contact Us</h3>
              <p><strong>Email:</strong> privacy@dearbabs.com</p>
              <p><strong>Phone:</strong> +63 (2) 8123 4567</p>
              <p><strong>Address:</strong> 123 Catering Street, Metro Manila, Philippines</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;