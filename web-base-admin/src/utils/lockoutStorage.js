// src/utils/lockoutStorage.js

const KEY = 'dearbabs_login_lockout';

/**
 * Save the lockout state. `lockedUntilIso` is the ISO time the lock expires.
 * Stored per-identifier so multiple accounts don't collide.
 */
export const saveLockout = (identifier, lockedUntilIso, lockLevel = 1, maxAttempts = 5) => {
  if (!identifier || !lockedUntilIso) return;
  try {
    const raw = localStorage.getItem(KEY);
    const store = raw ? JSON.parse(raw) : {};
    store[identifier.toLowerCase()] = {
      locked_until: lockedUntilIso,
      lock_level: lockLevel,
      max_attempts: maxAttempts,
      saved_at: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
};

/**
 * Get stored lockout info for an identifier, or null if none/expired.
 */
export const getLockout = (identifier) => {
  if (!identifier) return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const store = JSON.parse(raw);
    const entry = store[identifier.toLowerCase()];
    if (!entry) return null;

    const until = new Date(entry.locked_until);
    if (Number.isNaN(until.getTime())) return null;

    if (until.getTime() <= Date.now()) {
      // Expired — clean it up
      delete store[identifier.toLowerCase()];
      localStorage.setItem(KEY, JSON.stringify(store));
      return null;
    }

    const secondsLeft = Math.ceil((until.getTime() - Date.now()) / 1000);
    return {
      locked_until: entry.locked_until,
      lock_level: entry.lock_level ?? 1,
      max_attempts: entry.max_attempts ?? 5,
      seconds_left: secondsLeft,
    };
  } catch {
    return null;
  }
};

/**
 * Clear lockout for an identifier (called on successful login or reset).
 */
export const clearLockout = (identifier) => {
  if (!identifier) return;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const store = JSON.parse(raw);
    delete store[identifier.toLowerCase()];
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
};

/**
 * Clear all lockout records.
 */
export const clearAllLockouts = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};