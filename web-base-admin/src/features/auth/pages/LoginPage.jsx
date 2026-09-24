// src/pages/LoginPage.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FaEye, FaEyeSlash, FaExclamationCircle, FaLock,
  FaEnvelope, FaArrowLeft, FaCheck, FaTimes, FaClock,
  FaMapMarkerAlt, FaClipboardList, FaUsers, FaChartBar,
  FaUserCircle
} from 'react-icons/fa';
import { useLogin, useForgotPassword, useVerifyResetOtp, useResetPassword } from '../../../hooks/useAuth';
import { useAuth } from '../../../contexts/AuthContext';
import { getDefaultRouteForUser } from '../../../utils/roleRoutes';
import {
  getRememberedAccounts,
  rememberAccount,
  forgetAccount,
} from '../../../utils/rememberedAccounts';
import {
  saveLockout,
  getLockout,
  clearLockout,
} from '../../../utils/lockoutStorage';
import RememberedAccounts from '../../../components/RememberedAccounts';
import posterImage from '../../../assets/images/poster2.png';
import logoImage from '../../../assets/images/logo.png';
import '../styles/LoginPage.css';

const OTP_LENGTH = 6;

const PASSWORD_RULES = [
  { id: 'length',    label: 'At least 8 characters',         test: (p) => p.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter (A–Z)',    test: (p) => /[A-Z]/.test(p) },
  { id: 'lowercase', label: 'One lowercase letter (a–z)',    test: (p) => /[a-z]/.test(p) },
  { id: 'number',    label: 'One number (0–9)',              test: (p) => /[0-9]/.test(p) },
  { id: 'special',   label: 'One special character (!@#$…)', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const formatMMSS = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const formatLockout = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  }
  return formatMMSS(s);
};

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated: isAuth, loading: authLoading, user } = useAuth();

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loginError, setLoginError] = useState('');
  const [errorField, setErrorField] = useState(null); // 'username' | 'password' | null

  // Lockout
  const [lockSecondsLeft, setLockSecondsLeft] = useState(0);
  const [lockLevel, setLockLevel] = useState(0);
  const [lockIdentifier, setLockIdentifier] = useState(null);
  const isLocked = lockSecondsLeft > 0;

  // Remembered accounts
  const [rememberedAccounts, setRememberedAccounts] = useState([]);
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  const [showSplash, setShowSplash] = useState(true);
  const [splashStage, setSplashStage] = useState('enter');

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState('email');
  const [forgotData, setForgotData] = useState({ userId: '', email: '' });
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const otpRefs = useRef([]);

  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const loginMutation = useLogin();
  const forgotPasswordMutation = useForgotPassword();
  const verifyResetOtpMutation = useVerifyResetOtp();
  const resetPasswordMutation = useResetPassword();

  const isLoading = loginMutation.isPending || forgotPasswordMutation.isPending;

  const passwordChecks = useMemo(
    () => PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(newPassword) })),
    [newPassword]
  );
  const passwordAllPassed = passwordChecks.every((c) => c.passed);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  // ==================== SPLASH ====================
  useEffect(() => {
    const t1 = setTimeout(() => setSplashStage('active'), 300);
    const t2 = setTimeout(() => setSplashStage('exit'), 2200);
    const t3 = setTimeout(() => { setSplashStage('hidden'); setShowSplash(false); }, 2750);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // ==================== LOAD REMEMBERED + RESTORE LOCKOUT ====================
  useEffect(() => {
    const list = getRememberedAccounts();
    setRememberedAccounts(list);
    if (list.length > 0) setShowAccountPicker(true);
  }, []);

  // Restore lockout whenever username changes
  useEffect(() => {
    const identifier = formData.username.trim();
    if (!identifier) return;
    const saved = getLockout(identifier);
    if (saved) {
      setLockSecondsLeft(saved.seconds_left);
      setLockLevel(saved.lock_level);
      setLockIdentifier(identifier);
      setLoginError('Account temporarily locked. Please wait.');
      setErrorField(null);
    } else {
      // Only clear if the current lock was for this identifier
      if (lockIdentifier && lockIdentifier.toLowerCase() === identifier.toLowerCase()) {
        setLockSecondsLeft(0);
        setLockLevel(0);
        setLockIdentifier(null);
        setLoginError('');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.username]);

  // ==================== REDIRECT IF AUTH ====================
  useEffect(() => {
    if (!authLoading && isAuth) {
      const from = location.state?.from?.pathname;
      const target = from && from !== '/' ? from : getDefaultRouteForUser(user);
      if (location.pathname !== target) navigate(target, { replace: true });
    }
  }, [isAuth, authLoading, user, location.pathname, location.state, navigate]);

  // ==================== LOGIN SUCCESS ====================
  useEffect(() => {
    if (loginMutation.isSuccess) {
      const loggedInUser = loginMutation.data?.user || user;

      if (loggedInUser?.username) {
        rememberAccount(loggedInUser);
        clearLockout(loggedInUser.username);
      }

      setLoginError('');
      setErrorField(null);
      setErrors({});
      setLockSecondsLeft(0);
      setLockLevel(0);
      setLockIdentifier(null);

      setTimeout(() => {
        const target = getDefaultRouteForUser(loggedInUser);
        navigate(target, { replace: true });
      }, 500);
    }
  }, [loginMutation.isSuccess, navigate, user, loginMutation.data]);

  // ==================== LOGIN ERROR ====================
  useEffect(() => {
    if (!loginMutation.isError) return;
    const resp = loginMutation.error?.response?.data;
    const status = loginMutation.error?.response?.status;
    const identifier = formData.username.trim();

    // Lockout (429)
    if (status === 429 || resp?.error_code === 'ACCOUNT_LOCKED') {
      const secs = Number(resp?.seconds_left ?? 0);
      const level = Number(resp?.lock_level ?? 1);
      const lockedUntil = resp?.locked_until || new Date(Date.now() + secs * 1000).toISOString();
      const resolvedSecs = secs > 0 ? secs : 600;

      setLockSecondsLeft(resolvedSecs);
      setLockLevel(level);
      setLockIdentifier(identifier);
      setLoginError(resp?.message || 'Too many failed attempts. Please wait.');
      setErrorField(null);

      // Persist so refresh keeps the lock
      if (identifier) {
        saveLockout(identifier, lockedUntil, level, resp?.max_attempts ?? 5);
      }
      return;
    }

    // Incorrect email
    if (resp?.error_code === 'INVALID_EMAIL') {
      setLoginError(resp?.message || 'Incorrect Email or Username.');
      setErrorField('username');
      setErrors({ username: resp?.message || 'Incorrect Email or Username.' });
      return;
    }

    // Incorrect password — DON'T show attempts left
    if (resp?.error_code === 'INVALID_PASSWORD') {
      setLoginError(resp?.message || 'Incorrect Password.');
      setErrorField('password');
      setErrors({ password: 'Incorrect Password.' });
      return;
    }

    setLoginError(resp?.message || 'Login failed. Please try again.');
    setErrorField(null);
  }, [loginMutation.isError, loginMutation.error, formData.username]);

  // ==================== LOCKOUT COUNTDOWN ====================
  useEffect(() => {
    if (lockSecondsLeft <= 0) return;
    const t = setInterval(() => {
      setLockSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          setLoginError('');
          setErrorField(null);
          if (lockIdentifier) clearLockout(lockIdentifier);
          setLockLevel(0);
          setLockIdentifier(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [lockSecondsLeft, lockIdentifier]);

  // ==================== OTP COOLDOWN ====================
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // ==================== VERIFY OTP SUCCESS ====================
  useEffect(() => {
    if (verifyResetOtpMutation.isSuccess) {
      const token =
        verifyResetOtpMutation.data?.data?.data?.reset_token ||
        verifyResetOtpMutation.data?.data?.reset_token ||
        verifyResetOtpMutation.data?.reset_token;
      if (token) setResetToken(token);
      setForgotStep('password');
      setErrors({});
    }
  }, [verifyResetOtpMutation.isSuccess, verifyResetOtpMutation.data]);

  useEffect(() => {
    if (verifyResetOtpMutation.isError) {
      const resp = verifyResetOtpMutation.error?.response?.data;
      setErrors({
        fp_otp: resp?.errors?.otp_code?.[0] || resp?.message || 'Invalid or expired OTP.'
      });
    }
  }, [verifyResetOtpMutation.isError]);

  // ==================== RESET PASSWORD SUCCESS ====================
  useEffect(() => {
    if (resetPasswordMutation.isSuccess) {
      setForgotStep('success');
      setTimeout(() => closeForgotModal(), 3000);
    }
  }, [resetPasswordMutation.isSuccess]);

  useEffect(() => {
    if (resetPasswordMutation.isError) {
      const resp = resetPasswordMutation.error?.response?.data;
      setErrors({
        fp_password: resp?.errors?.new_password?.[0]
          || resp?.errors?.reset_token?.[0]
          || resp?.message
          || 'Password reset failed. Please try again.'
      });
    }
  }, [resetPasswordMutation.isError]);

  // ==================== BLOCK ESC ON FORGOT MODAL ====================
  useEffect(() => {
    if (!showForgotModal) return;
    const blockEsc = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); }
    };
    document.addEventListener('keydown', blockEsc, true);
    return () => document.removeEventListener('keydown', blockEsc, true);
  }, [showForgotModal]);

  // ==================== HANDLERS ====================
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    if (loginError && !isLocked) {
      setLoginError('');
      setErrorField(null);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (isLocked) return;
    setLoginError('');
    setErrorField(null);
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
      remember_me: rememberMe,
    });
  };

  // ==================== REMEMBERED ACCOUNT ACTIONS ====================
  const handlePickRemembered = (acc) => {
    setFormData({ username: acc.username, password: '' });
    setShowAccountPicker(false);
    setErrorField(null);
    setLoginError('');
    setErrors({});

    // Restore lockout state for this account if any
    const saved = getLockout(acc.username);
    if (saved) {
      setLockSecondsLeft(saved.seconds_left);
      setLockLevel(saved.lock_level);
      setLockIdentifier(acc.username);
      setLoginError('Account temporarily locked. Please wait.');
    } else {
      setLockSecondsLeft(0);
      setLockLevel(0);
      setLockIdentifier(null);
    }

    setTimeout(() => {
      document.querySelector('input[name="password"]')?.focus();
    }, 100);
  };

  const handleForgetAccount = (username) => {
    forgetAccount(username);
    const next = getRememberedAccounts();
    setRememberedAccounts(next);
    if (next.length === 0) setShowAccountPicker(false);
  };

  const handleUseAnotherAccount = () => {
    setFormData({ username: '', password: '' });
    setShowAccountPicker(false);
    setErrorField(null);
    setLoginError('');
    setErrors({});
    setLockSecondsLeft(0);
    setLockLevel(0);
    setLockIdentifier(null);
  };

  const handleShowPicker = () => {
    const list = getRememberedAccounts();
    setRememberedAccounts(list);
    if (list.length > 0) setShowAccountPicker(true);
  };

  // ==================== FORGOT PASSWORD ====================
  const handleForgotPasswordClick = () => {
    const accountIdentifier = formData.username.trim();
    if (!accountIdentifier) {
      setErrors({ username: 'Please enter your Username or Email first' });
      return;
    }
    setForgotData({
      userId: accountIdentifier,
      email: accountIdentifier.includes('@') ? accountIdentifier : '',
    });
    setForgotStep('email');
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    setResetToken('');
    setNewPassword('');
    setConfirmPassword('');
    setErrors({});
    setShowForgotModal(true);
  };

  const handleForgotSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    const { userId, email } = forgotData;

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors({ fp_email: 'Please enter a valid email address' });
      return;
    }

    forgotPasswordMutation.mutate(
      { user_id: userId, email: email.trim().toLowerCase() },
      {
        onSuccess: () => {
          setForgotStep('otp');
          setCooldown(60);
          setTimeout(() => otpRefs.current[0]?.focus(), 100);
        },
        onError: (error) => {
          const resp = error?.response?.data;
          setErrors({
            fp_email: resp?.errors?.email?.[0]
              || resp?.errors?.user_id?.[0]
              || resp?.message
              || 'Failed to send reset code. Please check your details.'
          });
        },
      }
    );
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otpDigits];

    if (value.length > 1) {
      const digits = value.slice(0, OTP_LENGTH).split('');
      digits.forEach((d, i) => {
        if (index + i < OTP_LENGTH) next[index + i] = d;
      });
      setOtpDigits(next);
      const lastIdx = Math.min(index + digits.length, OTP_LENGTH - 1);
      otpRefs.current[lastIdx]?.focus();
      return;
    }

    next[index] = value;
    setOtpDigits(next);
    if (value && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
    if (errors.fp_otp) setErrors((prev) => ({ ...prev, fp_otp: '' }));
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowLeft' && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
    if (!paste) return;
    const digits = paste.slice(0, OTP_LENGTH).split('');
    const next = Array(OTP_LENGTH).fill('');
    digits.forEach((d, i) => { next[i] = d; });
    setOtpDigits(next);
    otpRefs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    setErrors({});
    const code = otpDigits.join('');
    if (code.length !== OTP_LENGTH) {
      setErrors({ fp_otp: `Please enter the ${OTP_LENGTH}-digit code` });
      return;
    }
    verifyResetOtpMutation.mutate(
      { user_id: forgotData.userId, otp_code: code },
      {
        onError: (error) => {
          const resp = error?.response?.data;
          setErrors({
            fp_otp: resp?.errors?.otp_code?.[0] || resp?.message || 'Invalid or expired OTP.'
          });
        },
      }
    );
  };

  const handleResetPassword = (e) => {
    e.preventDefault();
    setErrors({});

    if (!passwordAllPassed) {
      setErrors({
        fp_password:
          'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
      });
      return;
    }
    if (!passwordsMatch) {
      setErrors({ fp_password: 'Passwords do not match' });
      return;
    }
    if (!resetToken) {
      setErrors({ fp_password: 'Reset session expired. Please start over.' });
      return;
    }

    resetPasswordMutation.mutate(
      {
        user_id: forgotData.userId,
        new_password: newPassword,
        password_confirmation: confirmPassword,
        reset_token: resetToken,
      },
      {
        onSuccess: () => {
          // Clear any lockout for this account after a successful reset
          clearLockout(forgotData.userId);
        },
        onError: (error) => {
          const resp = error?.response?.data;
          setErrors({
            fp_password: resp?.errors?.new_password?.[0]
              || resp?.errors?.reset_token?.[0]
              || resp?.message
              || 'Password reset failed. Please try again.'
          });
        },
      }
    );
  };

  const handleResendOtp = () => {
    if (cooldown > 0) return;
    setErrors({});
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    forgotPasswordMutation.mutate(
      { user_id: forgotData.userId, email: forgotData.email },
      {
        onSuccess: () => {
          setCooldown(60);
          setTimeout(() => otpRefs.current[0]?.focus(), 100);
        },
        onError: (error) => {
          const resp = error?.response?.data;
          setErrors({
            fp_otp: resp?.errors?.email?.[0] || resp?.message || 'Failed to resend code.'
          });
        },
      }
    );
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotStep('email');
    setForgotData({ userId: '', email: '' });
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    setResetToken('');
    setNewPassword('');
    setConfirmPassword('');
    setErrors({});
    setCooldown(0);
  };

  const goBackToEmailStep = () => {
    setForgotStep('email');
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    setErrors({});
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

  // ==================== SPLASH SCREEN ====================
  if (showSplash) {
    const isActive = splashStage === 'active' || splashStage === 'exit';
    return (
      <div className={`login-splash ${splashStage === 'exit' ? 'is-exiting' : ''}`}>
        <div className="login-splash-content">
          <div className="login-splash-glow" aria-hidden="true" />
          <div className={`login-splash-logo ${isActive ? 'is-active' : ''}`}>
            <span className="login-splash-ring" aria-hidden="true" />
            <span className="login-splash-ring login-splash-ring--delay" aria-hidden="true" />
            <img src={logoImage} alt="Dear Ba'bs" />
          </div>
          <div className={`login-splash-brand ${isActive ? 'is-visible' : ''}`}>
            <h1 className="login-splash-brand-name">Dear Ba'bs</h1>
            <p className="login-splash-brand-sub">Catering Management System</p>
          </div>
          <div className={`login-splash-progress ${isActive ? 'is-active' : ''}`}>
            <span className="login-splash-progress-bar" />
          </div>
          <p className={`login-splash-caption ${isActive ? 'is-visible' : ''}`}>
            Preparing your workspace…
          </p>
        </div>
      </div>
    );
  }

  // ==================== SESSION LOADING ====================
  if (authLoading) {
    return (
      <div className="login-loading">
        <div className="login-loading-orbit">
          <span className="login-loading-orbit-ring"></span>
          <span className="login-loading-orbit-ring login-loading-orbit-ring--delay"></span>
          <div className="login-loading-logo">
            <img src={logoImage} alt="Loading" />
          </div>
        </div>
        <div className="login-loading-text">
          <span>Verifying session</span>
          <span className="login-loading-dots">
            <span>.</span><span>.</span><span>.</span>
          </span>
        </div>
      </div>
    );
  }

  if (isAuth) return null;

  // ==================== MAIN LOGIN UI ====================
  return (
    <div className="login-container">
      <div className="login-main">
        {/* LEFT SECTION */}
        <div className="login-left-section">
          <div className="login-headline">
            <h1>
              <span className="headline-black">Streamline your</span>
              <span className="headline-blue">catering operations</span>
              <span className="headline-black">with ease.</span>
            </h1>
          </div>

          <div className="login-features">
            <div className="feature-item">
              <div className="feature-icon-wrapper"><FaMapMarkerAlt /></div>
              <div className="feature-text">
                <h4>Real-Time Order Tracking</h4>
                <p>Track bookings, orders, and event progress</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon-wrapper"><FaUsers /></div>
              <div className="feature-text">
                <h4>Employee Management</h4>
                <p>Manage staff schedules and assignments</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon-wrapper"><FaClipboardList /></div>
              <div className="feature-text">
                <h4>Menu & Inventory Management</h4>
                <p>Manage menus, ingredients, and inventory</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon-wrapper"><FaChartBar /></div>
              <div className="feature-text">
                <h4>Reports & Business Insights</h4>
                <p>Monitor operations and business performance</p>
              </div>
            </div>
          </div>

          <div className="login-poster-container">
            <img src={posterImage} alt="Dear Ba'bs Staff" className="login-poster-image" />
          </div>
        </div>

        <div className="login-divider"></div>

        {/* RIGHT SECTION */}
        <div className="login-right-section">
          <div className="login-logo">
            <img src={logoImage} alt="Dear Ba'bs Logo" />
          </div>

          <div className="login-form-container">
            {showAccountPicker && rememberedAccounts.length > 0 ? (
              <RememberedAccounts
                accounts={rememberedAccounts}
                onSelect={handlePickRemembered}
                onForget={handleForgetAccount}
                onUseAnother={handleUseAnotherAccount}
                loading={isLoading}
              />
            ) : (
              <>
                <div className="login-header">
                  <h2>Welcome back</h2>
                  <p>Sign in to your account to continue.</p>
                </div>

                {/* ===== LOCKOUT BANNER (10-min / 1-hr countdown) ===== */}
                {isLocked && (
                  <div className="login-locked-banner">
                    <div className="login-locked-icon"><FaLock /></div>
                    <div className="login-locked-body">
                      <div className="login-locked-title">
                        Account temporarily locked
                      </div>
                      <div className="login-locked-text">
                        Too many failed login attempts. Please try again in:
                      </div>
                      <div className="login-locked-timer">
                        <FaClock className="login-locked-timer-icon" />
                        {formatLockout(lockSecondsLeft)}
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== INLINE ERROR (only when not locked) ===== */}
                {!isLocked && loginError && !errorField && (
                  <div className="login-error-global">
                    <FaExclamationCircle />
                    <span>{loginError}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="login-form" noValidate>
                  {rememberedAccounts.length > 0 && (
                    <button
                      type="button"
                      className="login-show-accounts"
                      onClick={handleShowPicker}
                      disabled={isLoading}
                    >
                      <FaUserCircle />
                      <span>Saved accounts ({rememberedAccounts.length})</span>
                    </button>
                  )}

                  <div className="login-field-group">
                    <label className="login-field-label">Username or Email</label>
                    <div className="login-input-wrapper">
                      <input
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleInputChange}
                        disabled={isLoading || isLocked}
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
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        disabled={isLoading || isLocked}
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
                        disabled={isLocked}
                      />
                      <span>Remember me</span>
                    </label>
                    <button
                      type="button"
                      className="login-forgot-link"
                      onClick={handleForgotPasswordClick}
                      disabled={isLocked}
                    >
                      Forgot password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="login-submit-btn"
                    disabled={isLoading || isLocked}
                  >
                    {loginMutation.isPending ? (
                      <>
                        <span className="login-btn-loader">
                          <span className="login-btn-loader-dot"></span>
                          <span className="login-btn-loader-dot"></span>
                          <span className="login-btn-loader-dot"></span>
                        </span>
                        Signing In...
                      </>
                    ) : isLocked ? (
                      `Locked — Try again in ${formatLockout(lockSecondsLeft)}`
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
              </>
            )}
          </div>
        </div>
      </div>

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
        <div className="forgot-modal-overlay">
          <div className="forgot-modal-content">
            {forgotStep !== 'success' && (
              <button className="forgot-modal-close" onClick={closeForgotModal}>×</button>
            )}

            {forgotStep !== 'success' && (
              <div className="forgot-steps">
                <div className={`forgot-step-dot ${forgotStep === 'email' ? 'active' : 'done'}`}>1</div>
                <div className={`forgot-step-line ${forgotStep !== 'email' ? 'done' : ''}`} />
                <div className={`forgot-step-dot ${forgotStep === 'otp' ? 'active' : (forgotStep === 'password' ? 'done' : '')}`}>2</div>
                <div className={`forgot-step-line ${forgotStep === 'password' ? 'done' : ''}`} />
                <div className={`forgot-step-dot ${forgotStep === 'password' ? 'active' : ''}`}>3</div>
              </div>
            )}

            {forgotStep === 'email' && (
              <>
                <h3 className="forgot-modal-title">Reset Password</h3>
                <p className="forgot-modal-desc">
                  Enter your registered email to receive a 6-digit verification code.
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
                      <>
                        <span className="login-btn-loader">
                          <span className="login-btn-loader-dot"></span>
                          <span className="login-btn-loader-dot"></span>
                          <span className="login-btn-loader-dot"></span>
                        </span>
                        Sending Code...
                      </>
                    ) : (
                      'Send Verification Code'
                    )}
                  </button>
                </form>
              </>
            )}

            {forgotStep === 'otp' && (
              <>
                <h3 className="forgot-modal-title">Enter Verification Code</h3>
                <p className="forgot-modal-desc">
                  We sent a 6-digit code to <strong>{forgotData.email}</strong>.
                  It expires in 10 minutes.
                </p>
                <form onSubmit={handleVerifyOtp} noValidate>
                  <div className="forgot-otp-row" onPaste={handleOtpPaste}>
                    {otpDigits.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => (otpRefs.current[i] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className={`forgot-otp-input ${errors.fp_otp ? 'error' : ''}`}
                        autoComplete="one-time-code"
                      />
                    ))}
                  </div>
                  {errors.fp_otp && <span className="forgot-error forgot-otp-error">{errors.fp_otp}</span>}

                  <button
                    type="submit"
                    className="forgot-submit-btn"
                    disabled={verifyResetOtpMutation.isPending}
                  >
                    {verifyResetOtpMutation.isPending ? (
                      <>
                        <span className="login-btn-loader">
                          <span className="login-btn-loader-dot"></span>
                          <span className="login-btn-loader-dot"></span>
                          <span className="login-btn-loader-dot"></span>
                        </span>
                        Verifying...
                      </>
                    ) : (
                      'Verify Code'
                    )}
                  </button>

                  <div className="forgot-otp-actions">
                    <button
                      type="button"
                      className="forgot-text-btn"
                      onClick={goBackToEmailStep}
                    >
                      <FaArrowLeft /> Change email
                    </button>
                    <button
                      type="button"
                      className="forgot-text-btn"
                      onClick={handleResendOtp}
                      disabled={cooldown > 0 || forgotPasswordMutation.isPending}
                    >
                      {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {forgotStep === 'password' && (
              <>
                <h3 className="forgot-modal-title">Set New Password</h3>
                <p className="forgot-modal-desc">
                  Your new password must meet all the requirements below.
                </p>

                {/* <div className="forgot-no-limit-note">
                  <FaClock className="forgot-no-limit-icon" />
                  <span>Take your time — this step has no time limit.</span>
                </div> */}

                <form onSubmit={handleResetPassword} noValidate>
                  <div className="forgot-field-group">
                    <label>New Password</label>
                    <div className="forgot-input-wrapper">
                      <FaLock className="forgot-input-icon" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className={`forgot-input ${errors.fp_password ? 'error' : ''}`}
                        autoComplete="new-password"
                        autoFocus
                      />
                      <button
                        type="button"
                        className="forgot-eye-toggle"
                        onClick={() => setShowNewPassword((v) => !v)}
                        tabIndex="-1"
                      >
                        {showNewPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                  </div>

                  {newPassword.length > 0 && (
                    <ul className="forgot-password-rules">
                      {passwordChecks.map((rule) => (
                        <li
                          key={rule.id}
                          className={`forgot-password-rule ${rule.passed ? 'passed' : 'failed'}`}
                        >
                          <span className="rule-icon">
                            {rule.passed ? <FaCheck /> : <FaTimes />}
                          </span>
                          <span>{rule.label}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="forgot-field-group">
                    <label>Confirm Password</label>
                    <div className="forgot-input-wrapper">
                      <FaLock className="forgot-input-icon" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className={`forgot-input ${
                          errors.fp_password || (confirmPassword.length > 0 && !passwordsMatch)
                            ? 'error' : ''
                        }`}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="forgot-eye-toggle"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        tabIndex="-1"
                      >
                        {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                    {confirmPassword.length > 0 && !passwordsMatch && (
                      <span className="forgot-error">Passwords do not match</span>
                    )}
                    {errors.fp_password && (
                      <span className="forgot-error">{errors.fp_password}</span>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="forgot-submit-btn"
                    disabled={
                      resetPasswordMutation.isPending ||
                      !passwordAllPassed ||
                      !passwordsMatch
                    }
                  >
                    {resetPasswordMutation.isPending ? (
                      <>
                        <span className="login-btn-loader">
                          <span className="login-btn-loader-dot"></span>
                          <span className="login-btn-loader-dot"></span>
                          <span className="login-btn-loader-dot"></span>
                        </span>
                        Resetting...
                      </>
                    ) : (
                      'Reset Password'
                    )}
                  </button>
                </form>
              </>
            )}

            {forgotStep === 'success' && (
              <div className="forgot-success">
                <div className="forgot-success-checkmark">
                  <svg viewBox="0 0 52 52">
                    <circle className="forgot-success-circle" cx="26" cy="26" r="25" fill="none" />
                    <path className="forgot-success-tick" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                  </svg>
                </div>
                <h3 className="forgot-modal-title">Password Reset!</h3>
                <p className="forgot-modal-desc">
                  Your password has been updated successfully.
                  You can now sign in with your new password.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TERMS MODAL */}
      {showTermsModal && (
        <div className="terms-modal-overlay">
          <div className="terms-modal-content">
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
        <div className="terms-modal-overlay">
          <div className="terms-modal-content">
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
                <li><strong>Deletion:</strong> You may request deletion of your personal data, subject to legal obligations.</li>
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