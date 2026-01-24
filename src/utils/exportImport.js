/**
 * Export and import functionality for cross-device data portability.
 *
 * Provides encrypted export/import of CPAP session data with strong security:
 * - AES-256-GCM encryption with user passphrase
 * - File format validation to prevent injection attacks
 * - Safe error handling (no sensitive data in error messages)
 * - Cross-device detection and metadata
 *
 * @module utils/exportImport
 */

import { encryptData, decryptData } from './encryption';

/**
 * Export file format version.
 * Increment this when making breaking changes to the file format.
 */
export const EXPORT_FORMAT_VERSION = 1;

/**
 * Maximum file size for imports (50 MB).
 * Protects against denial-of-service attacks.
 */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/**
 * Validate passphrase strength and return feedback.
 *
 * @param {string} passphrase - Passphrase to validate
 * @returns {{isValid: boolean, strength: string, suggestions: string[]}}
 *   Validation result with strength level and improvement suggestions
 */
export function validatePassphrase(passphrase) {
  const result = {
    isValid: false,
    strength: 'weak',
    suggestions: [],
  };

  if (!passphrase) {
    result.suggestions.push('Passphrase is required');
    return result;
  }

  if (passphrase.length < 8) {
    result.suggestions.push('Must be at least 8 characters');
    return result;
  }

  result.isValid = true;

  // Calculate strength score
  let score = 0;

  if (passphrase.length >= 12) score += 1;
  if (passphrase.length >= 16) score += 1;
  if (/[a-z]/.test(passphrase)) score += 1;
  if (/[A-Z]/.test(passphrase)) score += 1;
  if (/[0-9]/.test(passphrase)) score += 1;
  if (/[^a-zA-Z0-9]/.test(passphrase)) score += 1;

  // Determine strength level
  if (score >= 5) {
    result.strength = 'strong';
  } else if (score >= 3) {
    result.strength = 'moderate';
  } else {
    result.strength = 'weak';
  }

  // Provide suggestions for improvement
  if (passphrase.length < 12) {
    result.suggestions.push('Use 12+ characters for better security');
  }
  if (!/[A-Z]/.test(passphrase)) {
    result.suggestions.push('Add uppercase letters');
  }
  if (!/[0-9]/.test(passphrase)) {
    result.suggestions.push('Add numbers');
  }
  if (!/[^a-zA-Z0-9]/.test(passphrase)) {
    result.suggestions.push('Add symbols (!@#$%^&*)');
  }

  return result;
}

/**
 * Hash a string using SHA-256 (for device fingerprinting, not security).
 *
 * @param {string} str - String to hash
 * @returns {Promise<string>} Hex-encoded hash
 */
async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get device metadata for cross-device detection.
 *
 * @returns {Promise<Object>} Device metadata (non-identifiable)
 */
async function getDeviceMetadata() {
  const userAgentSlice = navigator.userAgent.slice(0, 100);
  const userAgentHash = await hashString(userAgentSlice);

  return {
    platform: navigator.platform,
    userAgentHash,
    language: navigator.language,
  };
}

/**
 * Export session data as encrypted file.
 *
 * @param {Object} sessionData - Session data to export (from IndexedDB)
 * @param {string} passphrase - User-provided passphrase (min 8 chars)
 * @param {Object} [metadata={}] - Optional additional metadata
 * @returns {Promise<{success: boolean, filename: string}>}
 *   Export result with generated filename
 * @throws {Error} If export fails or passphrase is invalid
 */
export async function exportEncryptedData(
  sessionData,
  passphrase,
  metadata = {},
) {
  // Validate passphrase
  const validation = validatePassphrase(passphrase);
  if (!validation.isValid) {
    throw new Error(validation.suggestions[0] || 'Invalid passphrase');
  }

  // Add export metadata
  const deviceMetadata = await getDeviceMetadata();
  const exportData = {
    ...sessionData,
    metadata: {
      exportDate: new Date().toISOString(),
      appVersion: import.meta.env.VITE_APP_VERSION || 'dev',
      deviceInfo: deviceMetadata,
      ...metadata,
    },
  };

  // Encrypt data
  const { encrypted, salt, iv } = await encryptData(exportData, passphrase);

  // Create export file structure
  const exportFile = {
    version: EXPORT_FORMAT_VERSION,
    salt: Array.from(salt),
    iv: Array.from(iv),
    data: Array.from(encrypted),
    metadata: {
      exportDate: exportData.metadata.exportDate,
      appVersion: exportData.metadata.appVersion,
    },
  };

  // Convert to JSON
  const json = JSON.stringify(exportFile);
  const blob = new Blob([json], { type: 'application/json' });

  // Generate filename
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `OSCAR_Export_${dateStr}.json.enc`;

  // Trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  return { success: true, filename };
}

/**
 * Validate imported file format before decryption.
 *
 * CRITICAL SECURITY FUNCTION: Validates file structure to prevent:
 * - Prototype pollution attacks
 * - Type confusion attacks
 * - Size-based denial of service
 * - Malformed data injection
 *
 * @param {Object} fileData - Parsed JSON from import file
 * @throws {Error} If file format is invalid (safe error messages only)
 */
function validateFileFormat(fileData) {
  // Check basic structure
  if (!fileData || typeof fileData !== 'object' || Array.isArray(fileData)) {
    throw new Error('Invalid file format - missing required structure');
  }

  // Check required fields exist
  const requiredFields = ['version', 'salt', 'iv', 'data'];
  for (const field of requiredFields) {
    if (!(field in fileData)) {
      throw new Error('Invalid file format - missing required fields');
    }
  }

  // Validate field types
  if (typeof fileData.version !== 'number') {
    throw new Error('Invalid file format - incorrect version type');
  }

  if (
    !Array.isArray(fileData.salt) ||
    !Array.isArray(fileData.iv) ||
    !Array.isArray(fileData.data)
  ) {
    throw new Error('Invalid file format - incorrect field types');
  }

  // Validate array sizes (crypto parameters)
  if (fileData.salt.length !== 16) {
    throw new Error('Invalid file format - incorrect salt size');
  }

  if (fileData.iv.length !== 12) {
    throw new Error('Invalid file format - incorrect IV size');
  }

  // Validate array contents are numbers
  const validateNumberArray = (arr, name) => {
    if (!arr.every((n) => typeof n === 'number' && n >= 0 && n <= 255)) {
      throw new Error(`Invalid file format - incorrect ${name} format`);
    }
  };

  validateNumberArray(fileData.salt, 'salt');
  validateNumberArray(fileData.iv, 'IV');
  validateNumberArray(fileData.data, 'data');

  // Check version compatibility
  if (fileData.version !== EXPORT_FORMAT_VERSION) {
    throw new Error(
      `Unsupported export version ${fileData.version} - please update OSCAR Analyzer`,
    );
  }

  // Prevent prototype pollution
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  for (const key of dangerousKeys) {
    if (Object.prototype.hasOwnProperty.call(fileData, key)) {
      throw new Error('Invalid file format - security violation detected');
    }
  }
}

/**
 * Validate decrypted session data structure.
 *
 * @param {Object} sessionData - Decrypted session data
 * @throws {Error} If session data structure is invalid
 */
function validateSessionData(sessionData) {
  if (!sessionData || typeof sessionData !== 'object') {
    throw new Error('Invalid session data structure');
  }

  // Check for required session fields (basic validation)
  // Note: Full validation happens in the app's data loading logic
  if (!sessionData.summary && !sessionData.details && !sessionData.sessions) {
    throw new Error('Invalid session data structure - no data found');
  }
}

/**
 * Detect if imported data came from a different device.
 *
 * @param {Object} sessionData - Decrypted session data with metadata
 * @returns {boolean} True if from different device
 */
export async function detectCrossDeviceImport(sessionData) {
  if (!sessionData.metadata?.deviceInfo) {
    return false; // No device info available
  }

  const currentDevice = await getDeviceMetadata();
  const importedDevice = sessionData.metadata.deviceInfo;

  // Compare device fingerprints
  return (
    currentDevice.platform !== importedDevice.platform ||
    currentDevice.userAgentHash !== importedDevice.userAgentHash
  );
}

/**
 * Import encrypted session data from file.
 *
 * @param {File} file - Imported file (.json.enc)
 * @param {string} passphrase - User-provided passphrase
 * @returns {Promise<{success: boolean, sessionData: Object, crossDevice: boolean}>}
 *   Import result with session data and cross-device flag
 * @throws {Error} If import fails (safe error messages only - no sensitive data)
 */
export async function importEncryptedData(file, passphrase) {
  // 1. Validate file size BEFORE reading
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('File too large (maximum 50MB)');
  }

  // 2. Read and parse JSON
  let fileData;
  try {
    const fileText = await file.text();
    fileData = JSON.parse(fileText);
  } catch {
    throw new Error('Invalid file format - not valid JSON');
  }

  // 3. Validate file format (BEFORE decryption - security critical)
  validateFileFormat(fileData);

  // 4. Convert arrays back to Uint8Array
  const salt = new Uint8Array(fileData.salt);
  const iv = new Uint8Array(fileData.iv);
  const encrypted = new Uint8Array(fileData.data);

  // 5. Decrypt data
  // Decryption errors are already safe (from encryption.js)
  const sessionData = await decryptData(encrypted, salt, iv, passphrase);

  // 6. Validate decrypted session data structure
  validateSessionData(sessionData);

  // 7. Detect cross-device import
  const crossDevice = await detectCrossDeviceImport(sessionData);

  // 8. Remove metadata before returning (not part of session data)
  const { metadata, ...cleanSessionData } = sessionData;

  return {
    success: true,
    sessionData: cleanSessionData,
    crossDevice,
    importMetadata: metadata,
  };
}
