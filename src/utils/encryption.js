/**
 * Encryption utilities for secure cross-device data export/import.
 *
 * Uses Web Crypto API with AES-256-GCM for authenticated encryption
 * and PBKDF2 for key derivation from user passphrase.
 *
 * Security parameters:
 * - Algorithm: AES-256-GCM (authenticated encryption with associated data)
 * - Key derivation: PBKDF2-SHA256 with 100,000 iterations
 * - Salt: 16 bytes (128 bits), cryptographically random
 * - IV/Nonce: 12 bytes (96 bits), cryptographically random
 *
 * @module utils/encryption
 */

/**
 * Crypto configuration constants.
 * CRITICAL: These parameters are security-critical and must not be changed
 * without thorough security review.
 */
export const CRYPTO_CONFIG = {
  algorithm: 'AES-GCM',
  keyLength: 256,
  kdf: {
    name: 'PBKDF2',
    iterations: 100000, // OWASP 2023 minimum recommendation
    hash: 'SHA-256',
  },
  saltSize: 16, // bytes
  ivSize: 12, // bytes (GCM standard)
};

/**
 * Generate a cryptographically random salt for key derivation.
 *
 * @returns {Uint8Array} 16-byte random salt
 */
export function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(CRYPTO_CONFIG.saltSize));
}

/**
 * Generate a cryptographically random IV (initialization vector) for AES-GCM.
 *
 * @returns {Uint8Array} 12-byte random IV
 */
export function generateIV() {
  return crypto.getRandomValues(new Uint8Array(CRYPTO_CONFIG.ivSize));
}

/**
 * Derive an AES-256-GCM encryption key from a passphrase using PBKDF2.
 *
 * @param {string} passphrase - User-provided passphrase
 * @param {Uint8Array} salt - Random salt (must be unique per export)
 * @returns {Promise<CryptoKey>} Derived AES-256 key
 */
export async function deriveKey(passphrase, salt) {
  const encoder = new TextEncoder();

  // Import passphrase as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  );

  // Derive AES-256-GCM key from passphrase
  const key = await crypto.subtle.deriveKey(
    {
      name: CRYPTO_CONFIG.kdf.name,
      salt,
      iterations: CRYPTO_CONFIG.kdf.iterations,
      hash: CRYPTO_CONFIG.kdf.hash,
    },
    keyMaterial,
    {
      name: CRYPTO_CONFIG.algorithm,
      length: CRYPTO_CONFIG.keyLength,
    },
    false,
    ['encrypt', 'decrypt'],
  );

  return key;
}

/**
 * Encrypt data using AES-256-GCM with passphrase-derived key.
 *
 * @param {Object} data - Plain data object to encrypt (will be JSON serialized)
 * @param {string} passphrase - User-provided passphrase (min 8 chars recommended)
 * @returns {Promise<{encrypted: Uint8Array, salt: Uint8Array, iv: Uint8Array}>}
 *   Encrypted data bundle containing ciphertext, salt, and IV
 * @throws {Error} If encryption fails or passphrase is invalid
 */
export async function encryptData(data, passphrase) {
  if (!passphrase || passphrase.length < 8) {
    throw new Error('Passphrase must be at least 8 characters');
  }

  const encoder = new TextEncoder();

  // Generate random salt and IV
  const salt = generateSalt();
  const iv = generateIV();

  // Derive encryption key from passphrase
  const key = await deriveKey(passphrase, salt);

  // Serialize data to JSON
  const plaintext = encoder.encode(JSON.stringify(data));

  // Encrypt with AES-256-GCM
  const encrypted = await crypto.subtle.encrypt(
    {
      name: CRYPTO_CONFIG.algorithm,
      iv,
    },
    key,
    plaintext,
  );

  return {
    encrypted: new Uint8Array(encrypted),
    salt,
    iv,
  };
}

/**
 * Decrypt data using AES-256-GCM with passphrase-derived key.
 *
 * @param {Uint8Array} encrypted - Encrypted data from encryptData()
 * @param {Uint8Array} salt - Salt used during encryption
 * @param {Uint8Array} iv - IV used during encryption
 * @param {string} passphrase - User-provided passphrase (must match encryption passphrase)
 * @returns {Promise<Object>} Decrypted data object
 * @throws {Error} If decryption fails (wrong passphrase, corrupted data, or tampering)
 */
export async function decryptData(encrypted, salt, iv, passphrase) {
  if (!passphrase || passphrase.length < 8) {
    throw new Error('Passphrase must be at least 8 characters');
  }

  const decoder = new TextDecoder();

  // Derive decryption key from passphrase (same process as encryption)
  const key = await deriveKey(passphrase, salt);

  // Decrypt with AES-256-GCM
  // This will throw if authentication tag verification fails (wrong passphrase or tampered data)
  let decrypted;
  try {
    decrypted = await crypto.subtle.decrypt(
      {
        name: CRYPTO_CONFIG.algorithm,
        iv,
      },
      key,
      encrypted,
    );
  } catch {
    // GCM authentication failure - wrong passphrase or corrupted data
    // Don't expose internal error details
    throw new Error('Incorrect passphrase or corrupted file');
  }

  // Parse decrypted JSON
  const json = decoder.decode(decrypted);
  return JSON.parse(json);
}

/**
 * Securely clear sensitive data from memory.
 *
 * Note: JavaScript doesn't provide guaranteed memory wiping, but this
 * helps ensure the garbage collector can reclaim the memory.
 *
 * @param {string | Uint8Array | ArrayBuffer} data - Data to clear
 * @returns {null} Always returns null
 */
export function clearMemory(data) {
  if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
    // Overwrite typed arrays with zeros
    if (data instanceof ArrayBuffer) {
      data = new Uint8Array(data);
    }
    data.fill(0);
  }
  // Return null to signal data is cleared
  return null;
}
