// src/utils/rememberedAccounts.js

const STORAGE_KEY = 'dearbabs_remembered_accounts';
const MAX_ACCOUNTS = 5;

/**
 * Returns array of remembered accounts:
 * [{ user_id, username, full_name, email, profile_photo_url, role, last_login }]
 */
export const getRememberedAccounts = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((a) => a && a.username);
  } catch {
    return [];
  }
};

/**
 * Add or update an account in the remembered list.
 * Puts most-recent first, dedupes by username, caps at MAX_ACCOUNTS.
 */
export const rememberAccount = (user) => {
  if (!user || !user.username) return;

  const entry = {
    user_id: user.user_id ?? user.id ?? null,
    username: user.username,
    full_name: user.full_name || user.username,
    email: user.email || null,
    profile_photo_url: user.profile_photo_url || null,
    role: user.role || user.primary_role || null,
    last_login: new Date().toISOString(),
  };

  const existing = getRememberedAccounts().filter(
    (a) => a.username.toLowerCase() !== entry.username.toLowerCase()
  );
  const next = [entry, ...existing].slice(0, MAX_ACCOUNTS);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
};

/**
 * Remove a single account.
 */
export const forgetAccount = (username) => {
  if (!username) return;
  const next = getRememberedAccounts().filter(
    (a) => a.username.toLowerCase() !== username.toLowerCase()
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
};

/**
 * Remove all remembered accounts.
 */
export const forgetAllAccounts = () => {
  localStorage.removeItem(STORAGE_KEY);
};