// src/pages/components/RememberedAccounts.jsx
import React from 'react';
import { FaTimes, FaPlus, FaCheckCircle } from 'react-icons/fa';

const RememberedAccounts = ({
  accounts = [],
  onSelect,
  onForget,
  onUseAnother,
  loading = false,
}) => {
  if (!accounts || accounts.length === 0) return null;

  const getRoleLabel = (role) => {
    if (!role) return null;
    return role
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
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

  return (
    <div className="remembered-accounts">
      {/* Header */}
      <div className="remembered-header">
        <h3 className="remembered-title">Choose an account</h3>
        <p className="remembered-subtitle">
          Continue to Dear Ba'bs with a saved profile
        </p>
      </div>

      {/* Vertical stacked rows */}
      <div className="remembered-list">
        {accounts.map((acc) => (
          <div key={acc.username} className="remembered-row">
            <button
              type="button"
              className="remembered-row-btn"
              onClick={() => onSelect?.(acc)}
              disabled={loading}
            >
              {/* Avatar */}
              <div className="remembered-row-avatar">
                {acc.profile_photo_url ? (
                  <img src={acc.profile_photo_url} alt={acc.full_name} />
                ) : (
                  <span className="remembered-row-initials">
                    {getInitials(acc.full_name)}
                  </span>
                )}
              </div>

              {/* Text block */}
              <div className="remembered-row-body">
                <div className="remembered-row-name-line">
                  <span className="remembered-row-name" title={acc.full_name}>
                    {acc.full_name}
                  </span>
                  <FaCheckCircle
                    className="remembered-row-verified"
                    title="Saved account"
                  />
                </div>
                {acc.email && (
                  <div className="remembered-row-email" title={acc.email}>
                    {acc.email}
                  </div>
                )}
              </div>

              {/* Role chip */}
              {acc.role && (
                <div className={`remembered-row-role ${getRoleClass(acc.role)}`}>
                  {getRoleLabel(acc.role)}
                </div>
              )}
            </button>

            {/* Remove button */}
            <button
              type="button"
              className="remembered-row-forget"
              title={`Remove ${acc.full_name}`}
              aria-label={`Remove ${acc.full_name}`}
              onClick={(e) => {
                e.stopPropagation();
                onForget?.(acc.username);
              }}
              disabled={loading}
            >
              <FaTimes />
            </button>
          </div>
        ))}

        {/* Add another account */}
        <div className="remembered-row">
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
              <div className="remembered-row-email">Sign in with a different profile</div>
            </div>
          </button>
        </div>
      </div>

      {/* Footer divider */}
      <div className="remembered-footer">
        <span className="remembered-footer-line" />
        <span className="remembered-footer-text">or</span>
        <span className="remembered-footer-line" />
      </div>
    </div>
  );
};

export default RememberedAccounts;