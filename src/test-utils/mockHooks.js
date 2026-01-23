import { vi } from 'vitest';
import * as useDateFilterModule from '../hooks/useDateFilter';

/**
 * Mock setup for useDateFilter hook used in DateRangeControls tests.
 * Provides default mock return values that can be overridden per test.
 *
 * @param {Object} [overrides] - Override default mock values
 * @returns {Object} Mock useDateFilter return value
 */
export function mockUseDateFilter(overrides = {}) {
  const ISO_DATE_LENGTH = 10;
  const defaultMock = {
    quickRange: 'all',
    handleQuickRangeChange: vi.fn(),
    dateFilter: { start: null, end: null },
    setDateFilter: vi.fn(),
    selectCustomRange: vi.fn(),
    resetDateFilter: vi.fn(),
    parseDate: vi.fn((val) => (val ? new Date(val) : null)),
    formatDate: vi.fn((date) => {
      if (!date) return '';
      const d = new Date(date);
      return d.toISOString().slice(0, ISO_DATE_LENGTH);
    }),
    ...overrides,
  };

  vi.spyOn(useDateFilterModule, 'useDateFilter').mockReturnValue(defaultMock);

  return defaultMock;
}

/**
 * Clear all mocks for useDateFilter
 */
export function clearUseDateFilterMock() {
  vi.restoreAllMocks();
}
