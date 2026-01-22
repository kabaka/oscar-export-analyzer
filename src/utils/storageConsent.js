/**
 * Storage consent management utilities for IndexedDB opt-in flow.
 * Handles user consent for saving health data to browser's local storage.
 */

const CONSENT_KEY = 'oscar_storage_consent';
const SESSION_DENIAL_KEY = 'oscar_storage_consent_session';

/**
 * Get current storage consent status.
 * @returns {boolean|null} true if allowed, false if denied this session, null if not yet decided
 */
export function getStorageConsent() {
  // Check sessionStorage for denial (temporary for this session)
  const sessionDenial = sessionStorage.getItem(SESSION_DENIAL_KEY);
  if (sessionDenial === 'denied') {
    return false;
  }

  // Check localStorage for permanent consent
  const consent = localStorage.getItem(CONSENT_KEY);
  if (consent === 'allow') {
    return true;
  }

  // Not yet decided (first time or "ask later")
  return null;
}

/**
 * Set storage consent preference.
 * @param {'allow' | 'deny-session' | 'ask-later'} choice - User's consent choice
 */
export function setStorageConsent(choice) {
  if (choice === 'allow') {
    // User consented: save to localStorage, clear session denial
    localStorage.setItem(CONSENT_KEY, 'allow');
    sessionStorage.removeItem(SESSION_DENIAL_KEY);
  } else if (choice === 'deny-session') {
    // User denied for this session: mark in sessionStorage
    sessionStorage.setItem(SESSION_DENIAL_KEY, 'denied');
    // Clear any previous consent from localStorage
    localStorage.removeItem(CONSENT_KEY);
  } else if (choice === 'ask-later') {
    // User dismissed: clear both (will ask again next auto-save attempt)
    localStorage.removeItem(CONSENT_KEY);
    sessionStorage.removeItem(SESSION_DENIAL_KEY);
  }
}

/**
 * Revoke storage consent (clear all consent keys).
 * Used when user wants to reset their consent preference.
 */
export function revokeStorageConsent() {
  localStorage.removeItem(CONSENT_KEY);
  sessionStorage.removeItem(SESSION_DENIAL_KEY);
}
