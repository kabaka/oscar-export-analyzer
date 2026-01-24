import { describe, it, expect } from 'vitest';
import {
  CRYPTO_CONFIG,
  generateSalt,
  generateIV,
  deriveKey,
  encryptData,
  decryptData,
  clearMemory,
} from './encryption';

describe('encryption utilities', () => {
  describe('CRYPTO_CONFIG', () => {
    it('should define secure crypto parameters', () => {
      expect(CRYPTO_CONFIG.algorithm).toBe('AES-GCM');
      expect(CRYPTO_CONFIG.keyLength).toBe(256);
      expect(CRYPTO_CONFIG.kdf.name).toBe('PBKDF2');
      expect(CRYPTO_CONFIG.kdf.iterations).toBe(100000); // OWASP 2023 minimum
      expect(CRYPTO_CONFIG.kdf.hash).toBe('SHA-256');
      expect(CRYPTO_CONFIG.saltSize).toBe(16);
      expect(CRYPTO_CONFIG.ivSize).toBe(12);
    });
  });

  describe('generateSalt', () => {
    it('should generate 16-byte salt', () => {
      const salt = generateSalt();
      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(16);
    });

    it('should generate unique salts', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      expect(Array.from(salt1)).not.toEqual(Array.from(salt2));
    });
  });

  describe('generateIV', () => {
    it('should generate 12-byte IV', () => {
      const iv = generateIV();
      expect(iv).toBeInstanceOf(Uint8Array);
      expect(iv.length).toBe(12);
    });

    it('should generate unique IVs', () => {
      const iv1 = generateIV();
      const iv2 = generateIV();
      expect(Array.from(iv1)).not.toEqual(Array.from(iv2));
    });
  });

  describe('deriveKey', () => {
    it('should derive a CryptoKey from passphrase and salt', async () => {
      const passphrase = 'test-passphrase-123';
      const salt = generateSalt();

      const key = await deriveKey(passphrase, salt);

      expect(key).toBeInstanceOf(CryptoKey);
      expect(key.type).toBe('secret');
      expect(key.algorithm.name).toBe('AES-GCM');
    });

    it('should derive same key for same passphrase and salt', async () => {
      const passphrase = 'test-passphrase-123';
      const salt = generateSalt();

      const key1 = await deriveKey(passphrase, salt);
      const key2 = await deriveKey(passphrase, salt);

      // Keys should be CryptoKey objects with same algorithm
      expect(key1).toBeInstanceOf(CryptoKey);
      expect(key2).toBeInstanceOf(CryptoKey);
      expect(key1.algorithm.name).toBe(key2.algorithm.name);

      // Test that they encrypt to the same result
      const iv = generateIV();
      const testData = new TextEncoder().encode('test');

      const encrypted1 = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key1,
        testData,
      );
      const encrypted2 = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key2,
        testData,
      );

      expect(new Uint8Array(encrypted1)).toEqual(new Uint8Array(encrypted2));
    });

    it('should derive different keys for different salts', async () => {
      const passphrase = 'test-passphrase-123';
      const salt1 = generateSalt();
      const salt2 = generateSalt();

      const key1 = await deriveKey(passphrase, salt1);
      const key2 = await deriveKey(passphrase, salt2);

      // Test that they encrypt to different results
      const iv = generateIV();
      const testData = new TextEncoder().encode('test');

      const encrypted1 = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key1,
        testData,
      );
      const encrypted2 = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key2,
        testData,
      );

      expect(new Uint8Array(encrypted1)).not.toEqual(
        new Uint8Array(encrypted2),
      );
    });
  });

  describe('encryptData', () => {
    it('should encrypt data successfully', async () => {
      const data = { test: 'data', value: 123 };
      const passphrase = 'strong-passphrase';

      const result = await encryptData(data, passphrase);

      expect(result.encrypted).toBeInstanceOf(Uint8Array);
      expect(result.salt).toBeInstanceOf(Uint8Array);
      expect(result.iv).toBeInstanceOf(Uint8Array);
      expect(result.salt.length).toBe(16);
      expect(result.iv.length).toBe(12);
      expect(result.encrypted.length).toBeGreaterThan(0);
    });

    it('should reject weak passphrases', async () => {
      const data = { test: 'data' };

      await expect(encryptData(data, '1234567')).rejects.toThrow(
        'Passphrase must be at least 8 characters',
      );
    });

    it('should generate unique salt and IV for each encryption', async () => {
      const data = { test: 'data' };
      const passphrase = 'strong-passphrase';

      const result1 = await encryptData(data, passphrase);
      const result2 = await encryptData(data, passphrase);

      expect(Array.from(result1.salt)).not.toEqual(Array.from(result2.salt));
      expect(Array.from(result1.iv)).not.toEqual(Array.from(result2.iv));
      expect(Array.from(result1.encrypted)).not.toEqual(
        Array.from(result2.encrypted),
      );
    });
  });

  describe('decryptData', () => {
    it('should decrypt data with correct passphrase', async () => {
      const originalData = { test: 'sensitive data', value: 42 };
      const passphrase = 'strong-passphrase';

      const { encrypted, salt, iv } = await encryptData(
        originalData,
        passphrase,
      );
      const decrypted = await decryptData(encrypted, salt, iv, passphrase);

      expect(decrypted).toEqual(originalData);
    });

    it('should fail with incorrect passphrase', async () => {
      const originalData = { test: 'sensitive data' };
      const passphrase = 'correct-passphrase';
      const wrongPassphrase = 'wrong-passphrase';

      const { encrypted, salt, iv } = await encryptData(
        originalData,
        passphrase,
      );

      await expect(
        decryptData(encrypted, salt, iv, wrongPassphrase),
      ).rejects.toThrow('Incorrect passphrase or corrupted file');
    });

    it('should fail with tampered data', async () => {
      const originalData = { test: 'sensitive data' };
      const passphrase = 'strong-passphrase';

      const { encrypted, salt, iv } = await encryptData(
        originalData,
        passphrase,
      );

      // Tamper with encrypted data
      encrypted[0] ^= 0xff;

      await expect(
        decryptData(encrypted, salt, iv, passphrase),
      ).rejects.toThrow('Incorrect passphrase or corrupted file');
    });

    it('should reject weak passphrases', async () => {
      const encrypted = new Uint8Array([1, 2, 3]);
      const salt = generateSalt();
      const iv = generateIV();

      await expect(decryptData(encrypted, salt, iv, 'short')).rejects.toThrow(
        'Passphrase must be at least 8 characters',
      );
    });
  });

  describe('clearMemory', () => {
    it('should clear Uint8Array data', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const result = clearMemory(data);

      expect(result).toBe(null);
      expect(Array.from(data)).toEqual([0, 0, 0, 0, 0]);
    });

    it('should handle ArrayBuffer', () => {
      const buffer = new ArrayBuffer(8);
      const view = new Uint8Array(buffer);
      view.set([1, 2, 3, 4, 5, 6, 7, 8]);

      const result = clearMemory(buffer);

      expect(result).toBe(null);
      expect(Array.from(view)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    });

    it('should handle string data', () => {
      const result = clearMemory('sensitive string');
      expect(result).toBe(null);
    });
  });

  describe('end-to-end encryption workflow', () => {
    it('should successfully encrypt and decrypt complex data', async () => {
      const complexData = {
        sessions: [
          { date: '2026-01-23', ahi: 3.2, usage: 7.5 },
          { date: '2026-01-24', ahi: 4.1, usage: 8.0 },
        ],
        metadata: {
          exportDate: '2026-01-24T12:00:00Z',
          version: '1.0.0',
        },
      };
      const passphrase = 'very-strong-passphrase-12345';

      const { encrypted, salt, iv } = await encryptData(
        complexData,
        passphrase,
      );
      const decrypted = await decryptData(encrypted, salt, iv, passphrase);

      expect(decrypted).toEqual(complexData);
    });

    it('should handle unicode data', async () => {
      const unicodeData = {
        message: 'Hello 世界 🌍',
        emoji: '🔒🔐',
      };
      const passphrase = 'strong-passphrase';

      const { encrypted, salt, iv } = await encryptData(
        unicodeData,
        passphrase,
      );
      const decrypted = await decryptData(encrypted, salt, iv, passphrase);

      expect(decrypted).toEqual(unicodeData);
    });
  });
});
