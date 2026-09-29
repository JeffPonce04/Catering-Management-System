// src/pages/components/RememberedAccounts.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  FaTimes,
  FaPlus,
  FaCheckCircle,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaSignInAlt,
  FaExclamationCircle,
  FaArrowLeft,
  FaShieldAlt,
} from 'react-icons/fa';

const RememberedAccounts = ({
  accounts = [],
  onLogin,
  onForget,
  onUseAnother,
  loading = false,
  lockoutData = {},
}) => {
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordRef = useRef(null);

  // Reset password form when modal opens/closes
  useEffect(() => {
    if (!selectedAccount) {
      setPassword('');
      setShowPassword(false);
      setError('');
      setIsSubmitting(false);
    } else {
      const timer = setTimeout(() => {
        passwordRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedAccount]);

  // ESC key closes the modal
  useEffect(() => {
    if (!selectedAccount) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape' && !isSubmitting) {
        setSelectedAccount(null);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [selectedAccount, isSubmitting]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (selectedAccount) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedAccount]);

  if (!accounts || accounts.length === 0) return null;

  const getRoleLabel = (role) => {
    if (!role) return null;
    return role.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getRoleClass = (role) => {
    if (!role) return 'role-default';
    const r = role.toLowerCase();
    if (r.includes('admin')) return 'role-admin';
    if (r.includes('cashier') || r.includes('finance')) return 'role-cashier';
    if (r.includes('chef')) return 'role-chef';
    if (r.includes('manager')) return 'role-manager';
    if (r.includes('employee') || r.includes('staff')) return 'role-employee';
    if (r.includes('customer')) return 'role-customer';
    return 'role-default';
  };

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const formatLockoutTime = (totalSeconds) => {
    const s = Math.max(0, Math.floor(totalSeconds));
    if (s >= 3600) {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      return `${h}h ${m}m`;
    }
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const getLockout = (username) => lockoutData?.[username] || null;

  const handleSelectAccount = (acc) => {
    const locked = getLockout(acc.username);
    if (locked && locked.seconds_left > 0) {
      setSelectedAccount(acc);
      setPassword('');
      setShowPassword(false);
      setError(
        `Account temporarily locked. Please try again in ${formatLockoutTime(
          locked.seconds_left
        )}.`
      );
      return;
    }

    setSelectedAccount(acc);
    setPassword('');
    setShowPassword(false);
    setError('');
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setSelectedAccount(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAccount || isSubmitting) return;

    const trimmed = password.trim();
    if (!trimmed) {
      setError('Please enter your password.');
      passwordRef.current?.focus();
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await onLogin?.({
        username: selectedAccount.username,
        password: trimmed,
        account: selectedAccount,
      });
    } catch (err) {
      const resp = err?.response?.data;
      const status = err?.response?.status;
      let msg = resp?.message;

      if (!msg) {
        if (status === 429 || resp?.error_code === 'ACCOUNT_LOCKED') {
          msg = 'Too many failed attempts. Account temporarily locked.';
        } else if (resp?.error_code === 'INVALID_EMAIL') {
          msg = 'Account not found. Please use another account.';
        } else if (resp?.error_code === 'INVALID_PASSWORD') {
          msg = 'Incorrect password. Please try again.';
        } else {
          msg = 'Sign in failed. Please try again.';
        }
      }

      setError(msg);
      setPassword('');
      setTimeout(() => passwordRef.current?.focus(), 100);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="remembered-accounts">
        {/* Header */}
        <div className="remembered-header">
          <div className="remembered-header-icon">
            <FaShieldAlt />
          </div>
          <h3 className="remembered-title">Choose an account</h3>
          <p className="remembered-subtitle">
            Continue to Dear Ba'bs with a saved profile
          </p>
        </div>

        {/* Account list */}
        <div className="remembered-list">
          {accounts.map((acc) => {
            const locked = getLockout(acc.username);
            const isLocked = locked && locked.seconds_left > 0;

            return (
              <div
                key={acc.username}
                className={`remembered-row ${isLocked ? 'is-locked' : ''}`}
              >
                <button
                  type="button"
                  className="remembered-row-btn"
                  onClick={() => handleSelectAccount(acc)}
                  disabled={loading}
                >
                  {/* Avatar */}
                  <div className="remembered-row-avatar">
                    {acc.profile_photo_url || acc.profile_photo ? (
                      <img
                        src={acc.profile_photo_url || acc.profile_photo}
                        alt={acc.full_name || acc.username}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (e.target.nextSibling) {
                            e.target.nextSibling.style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    <span
                      className="remembered-row-initials"
                      style={{
                        display:
                          acc.profile_photo_url || acc.profile_photo
                            ? 'none'
                            : 'flex',
                      }}
                    >
                      {getInitials(acc.full_name || acc.username)}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="remembered-row-body">
                    <div className="remembered-row-name-line">
                      <span
                        className="remembered-row-name"
                        title={acc.full_name || acc.username}
                      >
                        {acc.full_name || acc.username}
                      </span>
                      {acc.is_verified ? (
                        <FaCheckCircle
                          className="remembered-row-verified"
                          title="Verified account"
                        />
                      ) : null}
                      {isLocked && (
                        <span className="remembered-row-locked-badge">
                          <FaLock />
                        </span>
                      )}
                    </div>
                    {acc.email && (
                      <div className="remembered-row-email" title={acc.email}>
                        {acc.email}
                      </div>
                    )}
                  </div>

                  {/* Role chip */}
                  {acc.role && (
                    <div
                      className={`remembered-row-role ${getRoleClass(acc.role)}`}
                    >
                      {getRoleLabel(acc.role)}
                    </div>
                  )}
                </button>

                              {/* Remove button — top-right corner */}
                <button
                  type="button"
                  className="remembered-row-forget"
                  title={`Remove ${acc.full_name || acc.username}`}
                  aria-label={`Remove ${acc.full_name || acc.username}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onForget?.(acc.username);
                  }}
                  disabled={loading}
                >
                  <FaTimes />
                </button>
              </div>
            );
          })}

          {/* Add another account */}
          <div className="remembered-row remembered-row--add">
            <button
              type="button"
              className="remembered-row-btn remembered-row-btn--add"
              onClick={onUseAnother}
              disabled={loading}
            >
              <div className="remembered-row-avatar remembered-row-avatar--add">
                <FaPlus />
              </div>
              <div className="remembered-row-body">
                <div className="remembered-row-name-line">
                  <span className="remembered-row-name">Use another account</span>
                </div>
                <div className="remembered-row-email">
                  Sign in with a different profile
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* PASSWORD MODAL                                               */}
      {/* ============================================================ */}
      {selectedAccount && (
        <div
          className="remembered-password-overlay"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-label="Enter password"
        >
          <div
            className="remembered-password-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              type="button"
              className="remembered-password-close"
              onClick={closeModal}
              disabled={isSubmitting}
              aria-label="Close"
            >
              <FaTimes />
            </button>

            {/* Profile header */}
            <div className="remembered-password-profile">
              <div className="remembered-password-avatar">
                {selectedAccount.profile_photo_url ||
                selectedAccount.profile_photo ? (
                  <img
                    src={
                      selectedAccount.profile_photo_url ||
                      selectedAccount.profile_photo
                    }
                    alt={selectedAccount.full_name || selectedAccount.username}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.nextSibling) {
                        e.target.nextSibling.style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                <span
                  className="remembered-password-initials"
                  style={{
                    display:
                      selectedAccount.profile_photo_url ||
                      selectedAccount.profile_photo
                        ? 'none'
                        : 'flex',
                  }}
                >
                  {getInitials(
                    selectedAccount.full_name || selectedAccount.username
                  )}
                </span>
              </div>

              <h3 className="remembered-password-name">
                {selectedAccount.full_name || selectedAccount.username}
              </h3>
              <p className="remembered-password-email">
                {selectedAccount.email || selectedAccount.username}
              </p>
              {selectedAccount.role && (
                <span
                  className={`remembered-password-role ${getRoleClass(
                    selectedAccount.role
                  )}`}
                >
                  {getRoleLabel(selectedAccount.role)}
                </span>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="remembered-password-form">
              <label className="remembered-password-label">
                Password
              </label>

              <div className="remembered-password-input-wrapper">
                <FaLock className="remembered-password-input-icon" />
                <input
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  className={`remembered-password-input ${
                    error ? 'error' : ''
                  }`}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  autoFocus
                />
                <button
                  type="button"
                  className="remembered-password-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  disabled={isSubmitting}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>

              {error && (
                <div className="remembered-password-error">
                  <FaExclamationCircle />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="remembered-password-submit"
                disabled={isSubmitting || !password.trim()}
              >
                {isSubmitting ? (
                  <>
                    <span className="login-btn-loader">
                      <span className="login-btn-loader-dot" />
                      <span className="login-btn-loader-dot" />
                      <span className="login-btn-loader-dot" />
                    </span>
                    Signing in...
                  </>
                ) : (
                  <>
                    <FaSignInAlt />
                    Sign In
                  </>
                )}
              </button>

              <button
                type="button"
                className="remembered-password-back"
                onClick={closeModal}
                disabled={isSubmitting}
              >
                <FaArrowLeft />
                Back to accounts
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default RememberedAccounts;