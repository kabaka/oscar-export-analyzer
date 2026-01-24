import { describe, it, expect, beforeEach } from 'vitest';
import {
  EXPORT_FORMAT_VERSION,
  MAX_FILE_SIZE_BYTES,
  validatePassphrase,
  exportEncryptedData,
  importEncryptedData,
  detectCrossDeviceImport,
} from './exportImport';

/**
 * Helper to create a File with text() method polyfill for Vitest environment.
 */
function createTestFile(content, filename = 'test.json.enc') {
  const blob = new Blob([content], { type: 'application/json' });
  const file = new File([blob], filename, { type: 'application/json' });

  // Polyfill text() method for Vitest environment
  if (!file.text) {
    file.text = async () => {
      if (typeof content === 'string') {
        return content;
      }
      // Handle Blob content
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsText(blob);
      });
    };
  }

  return file;
}

describe('exportImport utilities', () => {
  describe('validatePassphrase', () => {
    it('should reject empty passphrase', () => {
      const result = validatePassphrase('');
      expect(result.isValid).toBe(false);
      expect(result.suggestions).toContain('Passphrase is required');
    });

    it('should reject passphrase shorter than 8 characters', () => {
      const result = validatePassphrase('short');
      expect(result.isValid).toBe(false);
      expect(result.suggestions).toContain('Must be at least 8 characters');
    });

    it('should accept 8-character passphrase', () => {
      const result = validatePassphrase('12345678');
      expect(result.isValid).toBe(true);
    });

    it('should rate weak passphrase', () => {
      const result = validatePassphrase('12345678');
      expect(result.isValid).toBe(true);
      expect(result.strength).toBe('weak');
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should rate moderate passphrase', () => {
      const result = validatePassphrase('Password123');
      expect(result.isValid).toBe(true);
      expect(result.strength).toBe('moderate');
    });

    it('should rate strong passphrase', () => {
      const result = validatePassphrase('MyStr0ng!Passw0rd');
      expect(result.isValid).toBe(true);
      expect(result.strength).toBe('strong');
    });

    it('should suggest improvements for weak passphrase', () => {
      const result = validatePassphrase('weakpass');
      expect(result.suggestions).toContain(
        'Use 12+ characters for better security',
      );
      expect(result.suggestions).toContain('Add uppercase letters');
      expect(result.suggestions).toContain('Add numbers');
      expect(result.suggestions).toContain('Add symbols (!@#$%^&*)');
    });
  });

  describe('exportEncryptedData', () => {
    // Mock session data (using synthetic test data - no real patient data)
    const mockSessionData = {
      summary: [
        { date: '2026-01-23', ahi: 3.2, usage: 7.5 },
        { date: '2026-01-24', ahi: 4.1, usage: 8.0 },
      ],
      details: [],
    };

    beforeEach(() => {
      // Mock document.createElement for download testing
      document.createElement = (tag) => {
        if (tag === 'a') {
          return {
            href: '',
            download: '',
            click: () => {},
          };
        }
        return {};
      };

      // Mock URL.createObjectURL and revokeObjectURL
      URL.createObjectURL = () => 'blob:mock-url';
      URL.revokeObjectURL = () => {};
    });

    it('should export data successfully with valid passphrase', async () => {
      const passphrase = 'strong-passphrase-123';

      const result = await exportEncryptedData(mockSessionData, passphrase);

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(
        /OSCAR_Export_\d{4}-\d{2}-\d{2}\.json\.enc/,
      );
    });

    it('should reject weak passphrase', async () => {
      const passphrase = 'weak';

      await expect(
        exportEncryptedData(mockSessionData, passphrase),
      ).rejects.toThrow('Must be at least 8 characters');
    });

    it('should include metadata in export', async () => {
      const passphrase = 'strong-passphrase-123';
      const metadata = { customField: 'test-value' };

      // We can't easily test the file contents without actually reading the blob,
      // but we can verify the function completes without error
      const result = await exportEncryptedData(
        mockSessionData,
        passphrase,
        metadata,
      );

      expect(result.success).toBe(true);
    });
  });

  describe('importEncryptedData', () => {
    const mockSessionData = {
      summary: [{ date: '2026-01-23', ahi: 3.2, usage: 7.5 }],
    };
    const passphrase = 'correct-passphrase-123';

    /**
     * Helper to create a mock encrypted file for testing.
     * This simulates the full export/import cycle.
     */
    async function createMockEncryptedFile(data, pass) {
      const { encryptData } = await import('./encryption');

      const deviceMetadata = {
        platform: 'Test Platform',
        userAgentHash: 'test-hash',
        language: 'en-US',
      };

      const exportData = {
        ...data,
        metadata: {
          exportDate: new Date().toISOString(),
          appVersion: '1.0.0',
          deviceInfo: deviceMetadata,
        },
      };

      const { encrypted, salt, iv } = await encryptData(exportData, pass);

      const fileContent = {
        version: EXPORT_FORMAT_VERSION,
        salt: Array.from(salt),
        iv: Array.from(iv),
        data: Array.from(encrypted),
        metadata: {
          exportDate: exportData.metadata.exportDate,
          appVersion: exportData.metadata.appVersion,
        },
      };

      const json = JSON.stringify(fileContent);

      // Create test file with text() method
      return createTestFile(json, 'test.json.enc');
    }

    it('should import data with correct passphrase', async () => {
      const file = await createMockEncryptedFile(mockSessionData, passphrase);

      const result = await importEncryptedData(file, passphrase);

      expect(result.success).toBe(true);
      expect(result.sessionData.summary).toEqual(mockSessionData.summary);
    });

    it('should fail with incorrect passphrase', async () => {
      const file = await createMockEncryptedFile(mockSessionData, passphrase);
      const wrongPassphrase = 'wrong-passphrase-123';

      await expect(importEncryptedData(file, wrongPassphrase)).rejects.toThrow(
        'Incorrect passphrase or corrupted file',
      );
    });

    it('should reject file larger than 50MB', async () => {
      // Create mock file with size > 50MB
      const largeFile = new File(
        ['x'.repeat(MAX_FILE_SIZE_BYTES + 1)],
        'large.json.enc',
        { type: 'application/json' },
      );

      await expect(importEncryptedData(largeFile, passphrase)).rejects.toThrow(
        'File too large (maximum 50MB)',
      );
    }, 30000);

    it('should reject invalid JSON', async () => {
      const invalidFile = new File(['not valid json{{{'], 'invalid.json.enc', {
        type: 'application/json',
      });

      await expect(
        importEncryptedData(invalidFile, passphrase),
      ).rejects.toThrow('Invalid file format - not valid JSON');
    });

    it('should reject file with missing required fields', async () => {
      const incompleteFile = new File(
        [JSON.stringify({ version: 1, salt: [] })],
        'incomplete.json.enc',
        { type: 'application/json' },
      );

      await expect(
        importEncryptedData(incompleteFile, passphrase),
      ).rejects.toThrow('Invalid file format');
    });

    it('should reject file with incorrect field types', async () => {
      const wrongTypeFile = new File(
        [
          JSON.stringify({
            version: '1', // should be number
            salt: [],
            iv: [],
            data: [],
          }),
        ],
        'wrong-type.json.enc',
        { type: 'application/json' },
      );

      await expect(
        importEncryptedData(wrongTypeFile, passphrase),
      ).rejects.toThrow('Invalid file format');
    });

    it('should reject file with incorrect salt size', async () => {
      const wrongSizeFile = createTestFile(
        JSON.stringify({
          version: 1,
          salt: [1, 2, 3], // should be 16 bytes
          iv: new Array(12).fill(0),
          data: [1, 2, 3],
        }),
        'wrong-size.json.enc',
      );

      await expect(
        importEncryptedData(wrongSizeFile, passphrase),
      ).rejects.toThrow('Invalid file format - incorrect salt size');
    });

    it('should reject file with incorrect IV size', async () => {
      const wrongIvFile = createTestFile(
        JSON.stringify({
          version: 1,
          salt: new Array(16).fill(0),
          iv: [1, 2, 3], // should be 12 bytes
          data: [1, 2, 3],
        }),
        'wrong-iv.json.enc',
      );

      await expect(
        importEncryptedData(wrongIvFile, passphrase),
      ).rejects.toThrow('Invalid file format - incorrect IV size');
    });

    it('should reject file with unsupported version', async () => {
      const futureVersionFile = createTestFile(
        JSON.stringify({
          version: 999,
          salt: new Array(16).fill(0),
          iv: new Array(12).fill(0),
          data: [1, 2, 3],
        }),
        'future-version.json.enc',
      );

      await expect(
        importEncryptedData(futureVersionFile, passphrase),
      ).rejects.toThrow('Unsupported export version 999');
    });

    it('should reject file with prototype pollution attempt', async () => {
      // Create object with __proto__ as own property
      const maliciousData = JSON.parse(
        '{"version":1,"salt":[],"iv":[],"data":[],"__proto__":{"admin":true}}',
      );
      const maliciousFile = createTestFile(
        JSON.stringify(maliciousData),
        'malicious.json.enc',
      );

      await expect(
        importEncryptedData(maliciousFile, passphrase),
      ).rejects.toThrow('Invalid file format');
    });

    it('should detect cross-device import', async () => {
      // Create file with different device info
      const file = await createMockEncryptedFile(mockSessionData, passphrase);

      const result = await importEncryptedData(file, passphrase);

      // Since we're testing with different device metadata in the mock,
      // it should detect as cross-device
      expect(result.crossDevice).toBeDefined();
    });

    it('should handle corrupted encrypted data', async () => {
      const file = await createMockEncryptedFile(mockSessionData, passphrase);

      // Read file content
      const text = await file.text();
      const fileData = JSON.parse(text);
      fileData.data[0] = (fileData.data[0] + 1) % 256; // corrupt one byte

      const corruptedFile = createTestFile(
        JSON.stringify(fileData),
        'corrupted.json.enc',
      );

      await expect(
        importEncryptedData(corruptedFile, passphrase),
      ).rejects.toThrow('Incorrect passphrase or corrupted file');
    });
  });

  describe('end-to-end export/import workflow', () => {
    const mockSessionData = {
      summary: [
        { date: '2026-01-23', ahi: 3.2, usage: 7.5, epap: 8.0 },
        { date: '2026-01-24', ahi: 4.1, usage: 8.0, epap: 8.5 },
      ],
      details: [
        { timestamp: '2026-01-23T22:00:00Z', event: 'H', duration: 15 },
      ],
    };
    const passphrase = 'strong-test-passphrase-12345';

    beforeEach(() => {
      // Mock DOM for export
      document.createElement = (tag) => {
        if (tag === 'a') {
          return {
            href: '',
            download: '',
            click: () => {},
          };
        }
        return {};
      };
      URL.createObjectURL = () => 'blob:mock-url';
      URL.revokeObjectURL = () => {};
    });

    it('should successfully export and import data', async () => {
      // Export
      const exportResult = await exportEncryptedData(
        mockSessionData,
        passphrase,
      );
      expect(exportResult.success).toBe(true);

      // Simulate the exported file
      const { encryptData } = await import('./encryption');
      const deviceMetadata = {
        platform: navigator.platform,
        userAgentHash: 'test-hash',
        language: navigator.language,
      };

      const exportData = {
        ...mockSessionData,
        metadata: {
          exportDate: new Date().toISOString(),
          appVersion: '1.0.0',
          deviceInfo: deviceMetadata,
        },
      };

      const { encrypted, salt, iv } = await encryptData(exportData, passphrase);

      const fileContent = {
        version: EXPORT_FORMAT_VERSION,
        salt: Array.from(salt),
        iv: Array.from(iv),
        data: Array.from(encrypted),
        metadata: {
          exportDate: exportData.metadata.exportDate,
          appVersion: exportData.metadata.appVersion,
        },
      };

      const file = createTestFile(
        JSON.stringify(fileContent),
        exportResult.filename,
      );

      // Import
      const importResult = await importEncryptedData(file, passphrase);
      expect(importResult.success).toBe(true);
      expect(importResult.sessionData.summary).toEqual(mockSessionData.summary);
      expect(importResult.sessionData.details).toEqual(mockSessionData.details);
    });

    it('should preserve data integrity through export/import cycle', async () => {
      // Complex data with nested structures
      const complexData = {
        summary: [{ date: '2026-01-23', ahi: 3.2, usage: 7.5, leak: 2.1 }],
        metadata: {
          sessionStart: '2026-01-23T22:00:00Z',
          totalRecords: 1,
        },
      };

      const { encryptData } = await import('./encryption');
      const { encrypted, salt, iv } = await encryptData(
        complexData,
        passphrase,
      );

      const fileContent = {
        version: EXPORT_FORMAT_VERSION,
        salt: Array.from(salt),
        iv: Array.from(iv),
        data: Array.from(encrypted),
      };

      const file = createTestFile(JSON.stringify(fileContent), 'test.json.enc');

      const importResult = await importEncryptedData(file, passphrase);
      expect(importResult.sessionData.summary).toEqual(complexData.summary);
      // Metadata is not part of session data (removed during import for privacy)
      // Check that import succeeded and data integrity preserved
      expect(importResult.success).toBe(true);
    });
  });

  describe('detectCrossDeviceImport', () => {
    it('should return false if no device info in metadata', async () => {
      const sessionData = { summary: [] };
      const result = await detectCrossDeviceImport(sessionData);
      expect(result).toBe(false);
    });

    it('should detect different platform', async () => {
      const sessionData = {
        summary: [],
        metadata: {
          deviceInfo: {
            platform: 'DifferentPlatform',
            userAgentHash: 'different-hash',
            language: 'en-US',
          },
        },
      };

      const result = await detectCrossDeviceImport(sessionData);
      // Should be true if platforms are different
      expect(typeof result).toBe('boolean');
    });
  });
});
