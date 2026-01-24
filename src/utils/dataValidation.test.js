/* eslint-disable no-magic-numbers -- test data uses explicit numeric values for clarity */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateEPAP } from './dataValidation';
import { EPAP_MIN, EPAP_MAX } from '../constants';

describe('validateEPAP', () => {
  let consoleWarnSpy;

  beforeEach(() => {
    // Spy on console.warn to verify warning messages
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('valid EPAP values (no warnings)', () => {
    it('should not warn for EPAP at minimum boundary', () => {
      const result = validateEPAP(EPAP_MIN);
      expect(result).toBe(EPAP_MIN);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should not warn for EPAP at maximum boundary', () => {
      const result = validateEPAP(EPAP_MAX);
      expect(result).toBe(EPAP_MAX);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should not warn for EPAP in mid-range', () => {
      const testValues = [7.0, 10.5, 15.0, 20.0];
      testValues.forEach((epap) => {
        const result = validateEPAP(epap);
        expect(result).toBe(epap);
      });
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should not warn for EPAP at split threshold', () => {
      // EPAP_SPLIT_THRESHOLD = 7 is a different constant for grouping
      const result = validateEPAP(7.0);
      expect(result).toBe(7.0);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should not warn for typical clinical values', () => {
      // Common CPAP/BiPAP settings in clinical practice
      const clinicalValues = [4.0, 5.5, 8.0, 12.0, 16.0, 20.0, 25.0];
      clinicalValues.forEach((epap) => {
        validateEPAP(epap);
      });
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('below-range EPAP values (warning expected)', () => {
    it('should warn for EPAP below minimum', () => {
      const result = validateEPAP(3.9);
      expect(result).toBe(3.9); // Value unchanged
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Suspicious EPAP value: 3.9 cmH₂O'),
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`typical range: ${EPAP_MIN}-${EPAP_MAX}`),
      );
    });

    it('should warn for zero EPAP', () => {
      validateEPAP(0.0);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('0.0 cmH₂O'),
      );
    });

    it('should warn for negative EPAP', () => {
      validateEPAP(-2.5);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('-2.5 cmH₂O'),
      );
    });

    it('should warn for very low EPAP', () => {
      validateEPAP(1.0);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('above-range EPAP values (warning expected)', () => {
    it('should warn for EPAP above maximum', () => {
      const result = validateEPAP(25.1);
      expect(result).toBe(25.1); // Value unchanged
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Suspicious EPAP value: 25.1 cmH₂O'),
      );
    });

    it('should warn for moderately high EPAP', () => {
      validateEPAP(30.0);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('30.0 cmH₂O'),
      );
    });

    it('should warn for extremely high EPAP', () => {
      validateEPAP(50.0);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('50.0 cmH₂O'),
      );
    });

    it('should warn for unrealistic high EPAP', () => {
      // Device error or corruption likely
      validateEPAP(100.0);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('should not warn for NaN values', () => {
      const result = validateEPAP(NaN);
      expect(result).toBeNaN();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should not warn for positive Infinity', () => {
      const result = validateEPAP(Infinity);
      expect(result).toBe(Infinity);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should not warn for negative Infinity', () => {
      const result = validateEPAP(-Infinity);
      expect(result).toBe(-Infinity);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle exactly at boundaries without floating point issues', () => {
      // Test that 4.0 and 25.0 are treated as valid despite floating point representation
      validateEPAP(4.0);
      validateEPAP(25.0);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle values very close to boundaries', () => {
      // Just inside boundaries - no warning
      validateEPAP(4.0001);
      validateEPAP(24.9999);
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      // Just outside boundaries - warnings
      consoleWarnSpy.mockClear();
      validateEPAP(3.9999);
      validateEPAP(25.0001);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('context parameter', () => {
    it('should include date in warning message when provided', () => {
      validateEPAP(3.0, { date: '2024-01-15' });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Date: 2024-01-15]'),
      );
    });

    it('should include row number in warning message when provided', () => {
      validateEPAP(30.0, { row: 47 });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Row: 47]'),
      );
    });

    it('should include both date and row when both provided', () => {
      validateEPAP(2.5, { date: '2024-01-15', row: 47 });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Date: 2024-01-15, Row: 47]'),
      );
    });

    it('should not include context when none provided', () => {
      validateEPAP(3.0);
      const callArg = consoleWarnSpy.mock.calls[0][0];
      expect(callArg).not.toContain('[');
      expect(callArg).not.toContain('Date:');
      expect(callArg).not.toContain('Row:');
    });

    it('should handle empty context object', () => {
      validateEPAP(3.0, {});
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      const callArg = consoleWarnSpy.mock.calls[0][0];
      expect(callArg).not.toContain('[');
    });
  });

  describe('multiple validations', () => {
    it('should warn for each out-of-range value independently', () => {
      validateEPAP(2.0);
      validateEPAP(30.0);
      validateEPAP(7.0); // valid, no warning
      validateEPAP(1.5);

      expect(consoleWarnSpy).toHaveBeenCalledTimes(3);
    });

    it('should return correct value for each validation', () => {
      const values = [3.0, 10.0, 30.0, 7.0];
      const results = values.map((v) => validateEPAP(v));

      expect(results).toEqual(values); // All values unchanged
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2); // Only 3.0 and 30.0 warned
    });
  });

  describe('numeric precision', () => {
    it('should format warning message with one decimal place', () => {
      validateEPAP(3.12345);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('3.1 cmH₂O'),
      );
    });

    it('should format integer values with one decimal place', () => {
      validateEPAP(3);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('3.0 cmH₂O'),
      );
    });
  });

  describe('clinical scenario validation', () => {
    it('should flag device error scenario (negative pressure)', () => {
      // Negative pressure indicates sensor malfunction
      validateEPAP(-1.5);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });

    it('should flag data corruption scenario (unrealistic high)', () => {
      // Values > 25 cmH₂O suggest CSV corruption or device error
      validateEPAP(99.9);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });

    it('should not flag edge case high-EPAP therapy (obesity hypoventilation)', () => {
      // Some patients legitimately need EPAP 20-25 cmH₂O
      validateEPAP(24.0);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should flag sub-therapeutic pressure (likely device starting up)', () => {
      // EPAP < 4 during device startup/warmup
      validateEPAP(2.0);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });
  });
});
