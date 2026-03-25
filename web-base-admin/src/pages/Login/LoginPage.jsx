import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaLock, FaMoon, FaSun, FaUser, FaPhone, FaArrowLeft,
  FaIdCard, FaCheckCircle, FaClock, FaRedo, FaEnvelope,
  FaShieldAlt, FaEye, FaEyeSlash, FaGoogle, FaFacebook,
  FaArrowRight, FaSpinner, FaExclamationCircle,
  FaCheckCircle as FaSuccessCircle
} from 'react-icons/fa';
import api from '../../services/api';
import { useAuth } from '../../Components/Context/AuthContext';
import './style/LoginPage.css';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login: authLogin } = useAuth(); // IMPORTANT: Get the login function from auth context
  const [darkMode, setDarkMode] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [currentStep, setCurrentStep] = useState('signup');
  const [formData, setFormData] = useState({
    userId: '',
    password: '',
    fullName: '',
    confirmPassword: '',
    phoneNumber: '',
    email: ''
  });
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [focusedField, setFocusedField] = useState('');
  const [otpTimer, setOtpTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState(false);
  const [countryCode] = useState('+63');
  const [verificationToken, setVerificationToken] = useState('');
  const [otpId, setOtpId] = useState(null);
  
  // State for login feedback
  const [loginStatus, setLoginStatus] = useState({
    show: false,
    type: '', // 'error', 'success', 'info'
    message: ''
  });

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
      // Verify token with backend
      const verifyToken = async () => {
        try {
          await api.get('/auth/user');
          navigate('/'); // Redirect to MainLayout if token is valid
        } catch (error) {
          // Token is invalid, clear storage
          localStorage.removeItem('auth_token');
          localStorage.removeItem('session_token');
          localStorage.removeItem('user');
        }
      };
      verifyToken();
    }

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.body.classList.add('dark-mode');
    }
  }, [navigate]);

  useEffect(() => {
    let interval;
    if (currentStep === 'verify' && otpTimer > 0 && !canResend) {
      interval = setInterval(() => {
        setOtpTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [currentStep, otpTimer, canResend]);

  // Auto-hide login status after 5 seconds
  useEffect(() => {
    if (loginStatus.show) {
      const timer = setTimeout(() => {
        setLoginStatus({ ...loginStatus, show: false });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [loginStatus]);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setCurrentStep('signup');
    setErrors({});
    setLoginStatus({ show: false, type: '', message: '' });
    setFormData({
      userId: '', password: '', fullName: '',
      confirmPassword: '', phoneNumber: '', email: ''
    });
    setOtp(['', '', '', '', '', '']);
    setVerifiedPhone(false);
    setVerificationToken('');
    setOtpId(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'userId') {
      const sanitizedValue = value.replace(/[^a-zA-Z0-9_.-]/g, '');
      setFormData(prev => ({ ...prev, [name]: sanitizedValue }));
    } else if (name === 'phoneNumber') {
      const sanitizedValue = value.replace(/[^0-9]/g, '').slice(0, 10);
      setFormData(prev => ({ ...prev, [name]: sanitizedValue }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    // Hide login status when user starts typing
    if (loginStatus.show) {
      setLoginStatus({ show: false, type: '', message: '' });
    }
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) {
      const pastedOtp = value.slice(0, 6).split('');
      const newOtp = [...otp];
      pastedOtp.forEach((digit, i) => {
        if (i < 6) newOtp[i] = digit.replace(/[^0-9]/g, '');
      });
      setOtp(newOtp);
      
      if (pastedOtp.length === 6) {
        document.getElementById(`otp-5`)?.focus();
      }
    } else {
      const newOtp = [...otp];
      newOtp[index] = value.replace(/[^0-9]/g, '');
      setOtp(newOtp);

      if (value && index < 5) {
        document.getElementById(`otp-${index + 1}`)?.focus();
      }
    }

    if (errors.otp) {
      setErrors(prev => ({ ...prev, otp: '' }));
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const validateLoginForm = () => {
    const newErrors = {};
    if (!formData.userId) newErrors.userId = 'User ID or Email is required';
    if (!formData.password) newErrors.password = 'Password is required';
    return newErrors;
  };

  const validateSignupForm = () => {
    const newErrors = {};
    
    if (!formData.fullName) newErrors.fullName = 'Full name is required';
    else if (formData.fullName.length < 2) newErrors.fullName = 'Full name must be at least 2 characters';
    
    if (!formData.email) newErrors.email = 'Email address is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Please enter a valid email address';
    
    if (!formData.userId) newErrors.userId = 'User ID is required';
    else if (formData.userId.length < 3) newErrors.userId = 'User ID must be at least 3 characters';
    else if (!/^[a-zA-Z0-9_.-]+$/.test(formData.userId)) {
      newErrors.userId = 'User ID can only contain letters, numbers, underscores (_), dots (.), and hyphens (-)';
    }
    
    if (!formData.phoneNumber) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (!/^[0-9]{10}$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Please enter a valid 10-digit Philippine mobile number';
    }
    
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain uppercase, lowercase and numbers';
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    return newErrors;
  };

  const getFullPhoneNumber = () => {
    return `${countryCode}${formData.phoneNumber}`;
  };

  const handleSendOtp = async () => {
    const phoneErrors = {};
    if (!formData.phoneNumber) {
      phoneErrors.phoneNumber = 'Phone number is required';
    } else if (!/^[0-9]{10}$/.test(formData.phoneNumber)) {
      phoneErrors.phoneNumber = 'Please enter a valid 10-digit Philippine mobile number';
    }

    if (Object.keys(phoneErrors).length > 0) {
      setErrors(phoneErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await api.post('/auth/send-otp', {
        phone_number: formData.phoneNumber,
        country_code: countryCode,
        type: 'registration'
      });

      if (response.data.success) {
        setOtpId(response.data.data.otp_id);
        setCurrentStep('verify');
        setOtpTimer(60);
        setCanResend(false);
        
        // Show success message
        setLoginStatus({
          show: true,
          type: 'success',
          message: 'OTP sent successfully to your phone!'
        });
        
        // For development - auto-fill OTP in console
        if (response.data.data.debug_otp) {
          console.log('Development OTP:', response.data.data.debug_otp);
        }
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to send OTP. Please try again.';
      setErrors({
        general: errorMessage
      });
      setLoginStatus({
        show: true,
        type: 'error',
        message: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      setErrors({ otp: 'Please enter complete 6-digit OTP' });
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post('/auth/verify-otp', {
        phone_number: formData.phoneNumber,
        country_code: countryCode,
        otp_code: otpValue,
        type: 'registration'
      });

      if (response.data.success) {
        setVerifiedPhone(true);
        setVerificationToken(response.data.data.verification_token);
        setCurrentStep('success');
        setErrors({});
        
        setLoginStatus({
          show: true,
          type: 'success',
          message: 'Phone number verified successfully!'
        });
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      const errorMessage = error.response?.data?.message || 'Invalid OTP. Please try again.';
      setErrors({
        otp: errorMessage
      });
      setLoginStatus({
        show: true,
        type: 'error',
        message: errorMessage
      });
      
      // Clear OTP inputs on error
      setOtp(['', '', '', '', '', '']);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;
    
    setIsLoading(true);

    try {
      const response = await api.post('/auth/resend-otp', {
        phone_number: formData.phoneNumber,
        country_code: countryCode,
        type: 'registration'
      });

      if (response.data.success) {
        setOtpTimer(60);
        setCanResend(false);
        setOtp(['', '', '', '', '', '']);
        setErrors({});
        
        setLoginStatus({
          show: true,
          type: 'success',
          message: 'OTP resent successfully!'
        });
        
        // For development - auto-fill OTP in console
        if (response.data.data?.debug_otp) {
          console.log('Development OTP:', response.data.data.debug_otp);
        }
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to resend OTP. Please try again.';
      setErrors({
        general: errorMessage
      });
      setLoginStatus({
        show: true,
        type: 'error',
        message: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    setIsLoading(true);

    try {
      const response = await api.post('/auth/register', {
        full_name: formData.fullName,
        email: formData.email,
        phone_number: formData.phoneNumber,
        country_code: countryCode,
        user_id: formData.userId,
        password: formData.password,
        password_confirmation: formData.confirmPassword,
        verification_token: verificationToken
      });

      if (response.data.success) {
        // Use the auth context login function
        authLogin(response.data.data.token, response.data.data.user);
        
        // Show success message
        setLoginStatus({
          show: true,
          type: 'success',
          message: 'Account created successfully! Redirecting...'
        });
        
        // Navigate to MainLayout after short delay
        setTimeout(() => {
          navigate('/');
        }, 1500);
      }
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = error.response?.data?.message || 'Registration failed. Please try again.';
      setErrors({
        general: errorMessage
      });
      setLoginStatus({
        show: true,
        type: 'error',
        message: errorMessage
      });
      
      // Go back to signup form on error
      setCurrentStep('signup');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const newErrors = validateLoginForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setLoginStatus({ show: false, type: '', message: '' });

    try {
      console.log('Attempting login with:', formData.userId);
      
      const response = await api.post('/auth/login', {
        userId: formData.userId,
        password: formData.password,
        remember_me: rememberMe
      });

      console.log('Login response:', response.data);

      if (response.data.success) {
        // Use the auth context login function
        authLogin(response.data.data.token, response.data.data.user);
        
        // Show success message
        setLoginStatus({
          show: true,
          type: 'success',
          message: 'Login successful! Redirecting...'
        });
        
        // Navigate to dashboard after short delay
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      }
    } catch (error) {
      console.error('Login error:', error);
      
      // Handle different error types
      const status = error.response?.status;
      const errorMessage = error.response?.data?.message || 'Login failed. Please try again.';
      
      let userMessage = errorMessage;
      if (status === 401) {
        userMessage = 'Invalid username or password. Please try again.';
      } else if (status === 403) {
        userMessage = 'Your account is not active. Please contact support.';
      } else if (status === 500) {
        userMessage = 'Server error. Please try again later.';
      }
      
      setErrors({
        general: userMessage
      });
      
      setLoginStatus({
        show: true,
        type: 'error',
        message: userMessage
      });
      
      // Clear password field on error
      setFormData(prev => ({ ...prev, password: '' }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLogin) {
      handleLogin(e);
    } else if (currentStep === 'signup') {
      const newErrors = validateSignupForm();
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }
      handleSendOtp();
    }
  };

  // Login Status Component
  const LoginStatusMessage = () => {
    if (!loginStatus.show) return null;
    
    return (
      <div className={`login-status ${loginStatus.type}`}>
        <div className="status-icon">
          {loginStatus.type === 'success' ? <FaSuccessCircle /> : <FaExclamationCircle />}
        </div>
        <div className="status-message">{loginStatus.message}</div>
        <button 
          className="status-close"
          onClick={() => setLoginStatus({ show: false, type: '', message: '' })}
        >
          ×
        </button>
      </div>
    );
  };

  return (
    <div className={`login-container ${darkMode ? 'dark' : 'light'}`}>
      {/* Background Pattern */}
      <div className="background-pattern">
        <div className="pattern-circle circle-1"></div>
        <div className="pattern-circle circle-2"></div>
        <div className="pattern-circle circle-3"></div>
      </div>

      {/* Theme Toggle */}
      <button 
        className={`theme-toggle-btn ${darkMode ? 'dark' : 'light'}`}
        onClick={toggleTheme}
        aria-label="Toggle theme"
      >
        {darkMode ? <FaSun /> : <FaMoon />}
        <span className="toggle-tooltip">
          Switch to {darkMode ? 'Light' : 'Dark'} Mode
        </span>
      </button>

      {/* Back Button */}
      {!isLogin && currentStep !== 'signup' && (
        <button 
          className={`back-btn ${darkMode ? 'dark' : 'light'}`}
          onClick={() => setCurrentStep('signup')}
          aria-label="Back"
        >
          <FaArrowLeft />
          <span>Back</span>
        </button>
      )}

      <div className="login-wrapper">
        <div className={`login-card ${darkMode ? 'dark' : 'light'}`}>
          {/* Logo/Brand */}
          <div className="brand-section">
            <div className="logo">
              <span className="logo-text">Dear Bab's</span>
              <span className="logo-accent">Catering</span>
            </div>
          </div>

          {/* Header */}
          <div className="login-header">
            <h1>
              {isLogin ? 'Welcome Back' : 
               currentStep === 'verify' ? 'Verification' :
               currentStep === 'success' ? 'Success!' : 'Create Account'}
            </h1>
            <p>
              {isLogin 
                ? 'Sign in to access your account' 
                : currentStep === 'verify' 
                  ? 'Enter the verification code sent to your phone'
                  : currentStep === 'success'
                    ? 'Your phone has been verified'
                    : 'Fill in your details to get started'}
            </p>
          </div>

          {/* Login Status Message */}
          <LoginStatusMessage />

          {/* Error Message (legacy) */}
          {errors.general && !loginStatus.show && (
            <div className="error-message">
              <FaExclamationCircle className="error-icon" />
              <span>{errors.general}</span>
            </div>
          )}

          {/* OTP Verification */}
          {!isLogin && currentStep === 'verify' && (
            <div className="otp-verification-container">
              <div className="otp-header">
                <div className="otp-icon-wrapper">
                  <FaShieldAlt className="otp-icon" />
                </div>
                <h2>Verify Your Phone Number</h2>
                <p>We've sent a 6-digit verification code to</p>
                <div className="phone-display">
                  <FaPhone className="small-icon" />
                  <span className="phone-number">{getFullPhoneNumber()}</span>
                  <button 
                    className="edit-phone-btn"
                    onClick={() => setCurrentStep('signup')}
                    disabled={isLoading}
                  >
                    Edit
                  </button>
                </div>
              </div>

              <div className="otp-input-group">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-${index}`}
                    type="text"
                    className={`otp-input ${darkMode ? 'dark' : 'light'} ${errors.otp ? 'error' : ''}`}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    maxLength="1"
                    disabled={isLoading}
                    autoFocus={index === 0}
                  />
                ))}
              </div>

              {errors.otp && <span className="otp-error">{errors.otp}</span>}

              <div className="otp-timer">
                {canResend ? (
                  <button 
                    className="resend-btn"
                    onClick={handleResendOtp}
                    disabled={isLoading}
                  >
                    <FaRedo className={`resend-icon ${isLoading ? 'spinning' : ''}`} />
                    Resend Code
                  </button>
                ) : (
                  <div className="timer">
                    <FaClock className="timer-icon" />
                    <span>Resend in {otpTimer} seconds</span>
                  </div>
                )}
              </div>

              <button
                className={`verify-btn ${darkMode ? 'dark' : 'light'} ${isLoading ? 'loading' : ''}`}
                onClick={handleVerifyOtp}
                disabled={isLoading || otp.join('').length !== 6}
              >
                {isLoading ? <FaSpinner className="spinner" /> : 'Verify Phone Number'}
              </button>
            </div>
          )}
          
          {/* Success Screen */}
          {!isLogin && currentStep === 'success' && (
            <div className="success-container">
              <div className="success-icon-wrapper">
                <FaCheckCircle className="success-icon" />
              </div>
              <h2>Verification Successful!</h2>
              <p>Your phone number has been verified successfully.</p>
              <p className="success-message">You can now proceed to create your account.</p>
              <button
                className={`continue-btn ${darkMode ? 'dark' : 'light'}`}
                onClick={handleCreateAccount}
                disabled={isLoading}
              >
                {isLoading ? <FaSpinner className="spinner" /> : 'Continue to Account Setup'}
                {!isLoading && <FaArrowRight className="btn-icon" />}
              </button>
            </div>
          )}
          
          {/* Signup Form */}
          {(!isLogin && currentStep === 'signup') && (
            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-row">
                <div className="form-group full-width">
                  <label htmlFor="fullName">Full Name</label>
                  <div className={`input-wrapper ${focusedField === 'fullName' ? 'focused' : ''} ${errors.fullName ? 'error' : ''}`}>
                    <FaUser className="input-icon" />
                    <input
                      type="text"
                      id="fullName"
                      name="fullName"
                      placeholder="Enter your full name"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      onFocus={() => setFocusedField('fullName')}
                      onBlur={() => setFocusedField('')}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.fullName && <span className="field-error">{errors.fullName}</span>}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group half-width">
                  <label htmlFor="email">Email Address</label>
                  <div className={`input-wrapper ${focusedField === 'email' ? 'focused' : ''} ${errors.email ? 'error' : ''}`}>
                    <FaEnvelope className="input-icon" />
                    <input
                      type="email"
                      id="email"
                      name="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={handleInputChange}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField('')}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.email && <span className="field-error">{errors.email}</span>}
                </div>

                <div className="form-group half-width">
                  <label htmlFor="phoneNumber">Mobile Number</label>
                  <div className={`phone-input-wrapper ${focusedField === 'phoneNumber' ? 'focused' : ''} ${errors.phoneNumber ? 'error' : ''}`}>
                    <div className="country-code">
                      <FaPhone className="phone-icon" />
                      <span className="code">+63</span>
                    </div>
                    <input
                      type="tel"
                      id="phoneNumber"
                      name="phoneNumber"
                      placeholder="9123456789"
                      value={formData.phoneNumber}
                      onChange={handleInputChange}
                      onFocus={() => setFocusedField('phoneNumber')}
                      onBlur={() => setFocusedField('')}
                      maxLength="10"
                      disabled={isLoading}
                    />
                  </div>
                  {errors.phoneNumber && <span className="field-error">{errors.phoneNumber}</span>}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group full-width">
                  <label htmlFor="userId">User ID</label>
                  <div className={`input-wrapper ${focusedField === 'userId' ? 'focused' : ''} ${errors.userId ? 'error' : ''}`}>
                    <FaIdCard className="input-icon" />
                    <input
                      type="text"
                      id="userId"
                      name="userId"
                      placeholder="Choose a user ID"
                      value={formData.userId}
                      onChange={handleInputChange}
                      onFocus={() => setFocusedField('userId')}
                      onBlur={() => setFocusedField('')}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.userId && <span className="field-error">{errors.userId}</span>}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group half-width">
                  <label htmlFor="password">Password</label>
                  <div className={`input-wrapper ${focusedField === 'password' ? 'focused' : ''} ${errors.password ? 'error' : ''}`}>
                    <FaLock className="input-icon" />
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      placeholder="Create password"
                      value={formData.password}
                      onChange={handleInputChange}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField('')}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                    >
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  {errors.password && <span className="field-error">{errors.password}</span>}
                </div>

                <div className="form-group half-width">
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <div className={`input-wrapper ${focusedField === 'confirmPassword' ? 'focused' : ''} ${errors.confirmPassword ? 'error' : ''}`}>
                    <FaLock className="input-icon" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      id="confirmPassword"
                      name="confirmPassword"
                      placeholder="Confirm password"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      onFocus={() => setFocusedField('confirmPassword')}
                      onBlur={() => setFocusedField('')}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={isLoading}
                    >
                      {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
                </div>
              </div>

              <button
                type="submit"
                className={`submit-btn ${darkMode ? 'dark' : 'light'} ${isLoading ? 'loading' : ''}`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <FaSpinner className="spinner" />
                    Sending Verification Code...
                  </>
                ) : (
                  <>
                    Send Verification Code
                    <FaArrowRight className="btn-icon" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Login Form */}
          {isLogin && (
            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group full-width">
                <label htmlFor="userId">User ID or Email</label>
                <div className={`input-wrapper ${focusedField === 'userId' ? 'focused' : ''} ${errors.userId ? 'error' : ''}`}>
                  <FaUser className="input-icon" />
                  <input
                    type="text"
                    id="userId"
                    name="userId"
                    placeholder="Enter your user ID or email"
                    value={formData.userId}
                    onChange={handleInputChange}
                    onFocus={() => setFocusedField('userId')}
                    onBlur={() => setFocusedField('')}
                    disabled={isLoading}
                  />
                </div>
                {errors.userId && <span className="field-error">{errors.userId}</span>}
              </div>

              <div className="form-group full-width">
                <label htmlFor="password">Password</label>
                <div className={`input-wrapper ${focusedField === 'password' ? 'focused' : ''} ${errors.password ? 'error' : ''}`}>
                  <FaLock className="input-icon" />
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleInputChange}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField('')}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                {errors.password && <span className="field-error">{errors.password}</span>}
              </div>

              <div className="form-options">
                <label className={`remember-me ${darkMode ? 'dark' : 'light'}`}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={isLoading}
                  />
                  <span className="checkmark"></span>
                  <span>Remember me</span>
                </label>
                <button 
                  type="button"
                  className="forgot-link"
                  onClick={() => navigate('/forgot-password')}
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                className={`submit-btn ${darkMode ? 'dark' : 'light'} ${isLoading ? 'loading' : ''}`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <FaSpinner className="spinner" />
                    Signing In...
                  </>
                ) : (
                  <>
                    Sign In
                    <FaArrowRight className="btn-icon" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Social Login */}
          <div className="social-login">
            <div className="divider">
              <span>or continue with</span>
            </div>
            <div className="social-buttons">
              <button className={`social-btn google ${darkMode ? 'dark' : 'light'}`}>
                <FaGoogle className="social-icon" />
                <span>Google</span>
              </button>
              <button className={`social-btn facebook ${darkMode ? 'dark' : 'light'}`}>
                <FaFacebook className="social-icon" />
                <span>Facebook</span>
              </button>
            </div>
          </div>

          {/* Toggle between Login/Signup */}
          {currentStep === 'signup' && (
            <div className="toggle-prompt">
              <p>
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <button 
                  className="toggle-link"
                  onClick={toggleMode}
                  disabled={isLoading}
                >
                  {isLogin ? 'Create Account' : 'Sign In'}
                </button>
              </p>
            </div>
          )}

          {/* Terms and Privacy */}
          <div className="legal-links">
            <a href="/terms" className="legal-link">Terms of Service</a>
            <span className="separator">•</span>
            <a href="/privacy" className="legal-link">Privacy Policy</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;