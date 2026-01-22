import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getStorageConsent,
  setStorageConsent,
  revokeStorageConsent,
} from './storageConsent';

describe('storageConsent utilities', () => {
  beforeEach(() => {
    // Clear storage before each test
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    // Clean up after each test
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('getStorageConsent', () => {
    it('returns null when no consent has been set (first time)', () => {
      expect(getStorageConsent()).toBe(null);
    });

    it('returns true when user has allowed storage', () => {
      localStorage.setItem('oscar_storage_consent', 'allow');
      expect(getStorageConsent()).toBe(true);
    });

    it('returns false when user has denied storage for this session', () => {
      sessionStorage.setItem('oscar_storage_consent_session', 'denied');
      expect(getStorageConsent()).toBe(false);
    });

    it('prioritizes session denial over localStorage consent', () => {
      localStorage.setItem('oscar_storage_consent', 'allow');
      sessionStorage.setItem('oscar_storage_consent_session', 'denied');
      expect(getStorageConsent()).toBe(false);
    });

    it('returns null when consent has been revoked', () => {
      localStorage.setItem('oscar_storage_consent', 'allow');
      localStorage.removeItem('oscar_storage_consent');
      expect(getStorageConsent()).toBe(null);
    });
  });

  describe('setStorageConsent', () => {
    it('sets localStorage and clears sessionStorage when allowing', () => {
      sessionStorage.setItem('oscar_storage_consent_session', 'denied');
      setStorageConsent('allow');

      expect(localStorage.getItem('oscar_storage_consent')).toBe('allow');
      expect(sessionStorage.getItem('oscar_storage_consent_session')).toBe(
        null,
      );
    });

    it('sets sessionStorage and clears localStorage when denying for session', () => {
      localStorage.setItem('oscar_storage_consent', 'allow');
      setStorageConsent('deny-session');

      expect(sessionStorage.getItem('oscar_storage_consent_session')).toBe(
        'denied',
      );
      expect(localStorage.getItem('oscar_storage_consent')).toBe(null);
    });

    it('clears both storages when asking later', () => {
      localStorage.setItem('oscar_storage_consent', 'allow');
      sessionStorage.setItem('oscar_storage_consent_session', 'denied');
      setStorageConsent('ask-later');

      expect(localStorage.getItem('oscar_storage_consent')).toBe(null);
      expect(sessionStorage.getItem('oscar_storage_consent_session')).toBe(
        null,
      );
    });
  });

  describe('revokeStorageConsent', () => {
    it('clears both localStorage and sessionStorage', () => {
      localStorage.setItem('oscar_storage_consent', 'allow');
      sessionStorage.setItem('oscar_storage_consent_session', 'denied');
      revokeStorageConsent();

      expect(localStorage.getItem('oscar_storage_consent')).toBe(null);
      expect(sessionStorage.getItem('oscar_storage_consent_session')).toBe(
        null,
      );
    });

    it('works when nothing is set', () => {
      expect(() => revokeStorageConsent()).not.toThrow();
      expect(getStorageConsent()).toBe(null);
    });
  });

  describe('consent flow scenarios', () => {
    it('allows user to change mind from deny to allow', () => {
      setStorageConsent('deny-session');
      expect(getStorageConsent()).toBe(false);

      setStorageConsent('allow');
      expect(getStorageConsent()).toBe(true);
    });

    it('allows user to change mind from allow to deny', () => {
      setStorageConsent('allow');
      expect(getStorageConsent()).toBe(true);

      setStorageConsent('deny-session');
      expect(getStorageConsent()).toBe(false);
    });

    it('respects "ask later" by resetting to undecided state', () => {
      setStorageConsent('allow');
      setStorageConsent('ask-later');
      expect(getStorageConsent()).toBe(null);
    });
  });
});
