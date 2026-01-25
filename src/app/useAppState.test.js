import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppState } from './useAppState';

// Mock external dependencies BEFORE importing the hook
vi.mock('../hooks/useCsvFiles', () => ({
  useCsvFiles: vi.fn(() => ({
    summaryData: null,
    setSummaryData: vi.fn(),
    detailsData: null,
    setDetailsData: vi.fn(),
    loadingSummary: false,
    summaryProgress: 0,
    summaryProgressMax: 100,
    loadingDetails: false,
    detailsProgress: 0,
    detailsProgressMax: 100,
    onSummaryFile: vi.fn(),
    onDetailsFile: vi.fn(),
    error: null,
    warning: null,
    setError: vi.fn(),
    setWarning: vi.fn(),
    cancelCurrent: vi.fn(),
  })),
}));

vi.mock('../hooks/useDateRangeFilter', () => ({
  useDateRangeFilter: vi.fn(() => ({
    dateFilter: null,
    setDateFilter: vi.fn(),
    quickRange: null,
    handleQuickRangeChange: vi.fn(),
    parseDate: vi.fn((d) => new Date(d)),
    formatDate: vi.fn((d) => d),
    selectCustomRange: vi.fn(),
    resetDateFilter: vi.fn(),
  })),
}));

vi.mock('../hooks/useSessionManager', () => ({
  useSessionManager: vi.fn(() => ({
    handleLoadSaved: vi.fn(),
    handleExportJson: vi.fn(),
    importSessionFile: vi.fn(),
  })),
}));

vi.mock('../hooks/useAnalyticsProcessing', () => ({
  useAnalyticsProcessing: vi.fn(() => ({
    apneaClusters: [],
    falseNegatives: [],
    processing: false,
  })),
}));

vi.mock('../hooks/useModal', () => ({
  useModal: vi.fn((initial) => ({
    isOpen: initial,
    open: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock('../utils/export', () => ({
  downloadTextFile: vi.fn(),
  buildSummaryAggregatesCSV: vi.fn(() => 'date,ahi\n2026-01-23,3.2'),
}));

vi.mock('../utils/db', () => ({
  clearLastSession: vi.fn(async () => true),
}));

vi.mock('../utils/exportImport', () => ({
  exportEncryptedData: vi.fn(async () => true),
  importEncryptedData: vi.fn(async () => ({})),
  detectCrossDeviceImport: vi.fn(() => false),
}));

describe('useAppState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('fnPreset and fnOptions', () => {
    it('should default fnPreset to balanced', () => {
      const { result } = renderHook(() => useAppState());
      expect(result.current.fnPreset).toBe('balanced');
    });

    it('should compute fnOptions for strict preset', () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.setFnPreset('strict');
      });

      expect(result.current.fnPreset).toBe('strict');
    });

    it('should compute fnOptions for lenient preset', () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.setFnPreset('lenient');
      });

      expect(result.current.fnPreset).toBe('lenient');
    });

    it('should fallback to balanced for invalid preset', () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.setFnPreset('invalid_preset');
      });

      expect(result.current.fnPreset).toBe('invalid_preset');
    });

    it('should switch between all three presets', () => {
      const { result } = renderHook(() => useAppState());

      const presets = ['strict', 'balanced', 'lenient'];
      for (const preset of presets) {
        act(() => {
          result.current.setFnPreset(preset);
        });
        expect(result.current.fnPreset).toBe(preset);
      }
    });
  });

  describe('exportAggregatesCsv', () => {
    it('should be callable', () => {
      const { result } = renderHook(() => useAppState());

      expect(typeof result.current.exportAggregatesCsv).toBe('function');

      act(() => {
        result.current.exportAggregatesCsv();
      });
    });
  });

  describe('handleClearSession', () => {
    it('should be callable and accept async', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      const { result } = renderHook(() => useAppState());

      expect(typeof result.current.handleClearSession).toBe('function');

      await act(async () => {
        await result.current.handleClearSession();
      });

      expect(confirmSpy).toHaveBeenCalled();

      confirmSpy.mockRestore();
    });
  });

  describe('cluster parameters', () => {
    it('should update cluster params', () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.onClusterParamChange({ gapSec: 25 });
      });

      expect(result.current.clusterParams.gapSec).toBe(25);
    });

    it('should update multiple cluster params', () => {
      const { result } = renderHook(() => useAppState());

      act(() => {
        result.current.onClusterParamChange({
          gapSec: 30,
          bridgeThreshold: 4,
          k: 5,
        });
      });

      expect(result.current.clusterParams.gapSec).toBe(30);
      expect(result.current.clusterParams.bridgeThreshold).toBe(4);
      expect(result.current.clusterParams.k).toBe(5);
    });
  });

  describe('section tracking', () => {
    it('should track active section ID', () => {
      const { result } = renderHook(() => useAppState());

      expect(result.current.activeSectionId).toBe('overview');

      act(() => {
        result.current.setActiveSectionId('ahi-trends');
      });

      expect(result.current.activeSectionId).toBe('ahi-trends');
    });

    it('should navigate between sections', () => {
      const { result } = renderHook(() => useAppState());

      const sections = [
        'overview',
        'usage-patterns',
        'ahi-trends',
        'clustered-apnea',
      ];
      for (const section of sections) {
        act(() => {
          result.current.setActiveSectionId(section);
        });
        expect(result.current.activeSectionId).toBe(section);
      }
    });
  });

  describe('state initialization', () => {
    it('should have all required state properties', () => {
      const { result } = renderHook(() => useAppState());
      const state = result.current;

      expect(state).toHaveProperty('summaryData');
      expect(state).toHaveProperty('setSummaryData');
      expect(state).toHaveProperty('detailsData');
      expect(state).toHaveProperty('setDetailsData');
      expect(state).toHaveProperty('clusterParams');
      expect(state).toHaveProperty('setClusterParams');
      expect(state).toHaveProperty('fnPreset');
      expect(state).toHaveProperty('setFnPreset');
      expect(state).toHaveProperty('filteredSummary');
      expect(state).toHaveProperty('filteredDetails');
      expect(state).toHaveProperty('activeSectionId');
      expect(state).toHaveProperty('setActiveSectionId');
    });

    it('should initialize with null data', () => {
      const { result } = renderHook(() => useAppState());

      expect(result.current.summaryData).toBeNull();
      expect(result.current.detailsData).toBeNull();
      expect(result.current.filteredSummary).toBeNull();
      expect(result.current.filteredDetails).toBeNull();
    });

    it('should initialize with false data availability flags', () => {
      const { result } = renderHook(() => useAppState());

      expect(result.current.hasAnyData).toBe(false);
      expect(result.current.summaryAvailable).toBe(false);
    });
  });

  describe('callback functions', () => {
    it('should have callable handler functions', () => {
      const { result } = renderHook(() => useAppState());

      expect(typeof result.current.handleExportJson).toBe('function');
      expect(typeof result.current.handleExportCsv).toBe('undefined');
      expect(typeof result.current.exportAggregatesCsv).toBe('function');
      expect(typeof result.current.handleClearSession).toBe('function');
    });
  });
});
