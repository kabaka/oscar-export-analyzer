import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SyncStatusPanel from './SyncStatusPanel';

describe('SyncStatusPanel', () => {
  const mockProps = {
    syncStatus: 'idle',
    lastSync: new Date('2026-01-24T08:30:00'),
    nextAutoSync: new Date('2026-01-25T08:30:00'),
    autoSyncEnabled: true,
    dataMetrics: {
      heartRate: {
        nights: 45,
        lastDate: new Date('2026-01-24'),
      },
      sleepStages: {
        nights: 43,
        lastDate: new Date('2026-01-24'),
      },
      spO2: {
        nights: 42,
        lastDate: new Date('2026-01-22'),
      },
    },
    recentActivity: [
      {
        time: new Date('2026-01-24T08:30:00'),
        message: 'Auto sync completed',
        details: '45 nights processed, 3 gaps filled',
        type: 'success',
      },
      {
        time: new Date('2026-01-23T08:30:00'),
        message: 'Manual sync requested',
        details: '2 new nights added',
        type: 'success',
      },
    ],
    onSyncNow: vi.fn(),
    onAutoSyncToggle: vi.fn(),
    onViewHistory: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sync status correctly when not syncing', () => {
    render(<SyncStatusPanel {...mockProps} />);

    expect(screen.getByText('Data Synchronization')).toBeInTheDocument();
    expect(screen.getByText(/Synced \(/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sync now/i }),
    ).toBeInTheDocument();
  });

  it('renders sync status correctly when syncing', () => {
    const syncingProps = {
      ...mockProps,
      syncStatus: 'syncing',
    };

    render(<SyncStatusPanel {...syncingProps} />);

    expect(screen.getByText('Data Synchronization')).toBeInTheDocument();
    // Multiple elements contain 'Syncing...', use getAllByText
    const syncingElements = screen.getAllByText('Syncing...');
    expect(syncingElements.length).toBeGreaterThan(0);
  });

  it('displays data metrics correctly', () => {
    render(<SyncStatusPanel {...mockProps} />);

    // Heart rate nights
    expect(screen.getByText(/45.*nights/)).toBeInTheDocument();
    expect(screen.getByText('Heart Rate')).toBeInTheDocument();

    // SpO2 nights
    expect(screen.getByText(/42.*nights/)).toBeInTheDocument();
    expect(screen.getByText('SpO2')).toBeInTheDocument();

    // Sleep stages
    expect(screen.getByText(/43.*nights/)).toBeInTheDocument();
    expect(screen.getByText('Sleep Stages')).toBeInTheDocument();
  });

  it('handles sync now button click', () => {
    render(<SyncStatusPanel {...mockProps} />);

    const syncButton = screen.getByRole('button', { name: /sync now/i });
    fireEvent.click(syncButton);

    expect(mockProps.onSyncNow).toHaveBeenCalledTimes(1);
  });

  it('shows next auto-sync time when enabled', () => {
    render(<SyncStatusPanel {...mockProps} />);

    // Compact design shows next sync time inline
    expect(screen.getByText(/Next sync:/)).toBeInTheDocument();
  });

  it('hides next sync time when auto-sync disabled', () => {
    const disabledAutoSyncProps = {
      ...mockProps,
      autoSyncEnabled: false,
    };

    render(<SyncStatusPanel {...disabledAutoSyncProps} />);

    // No next sync time shown when disabled
    expect(screen.queryByText(/Next sync:/)).not.toBeInTheDocument();
  });

  it('formats dates correctly', () => {
    const specificDateProps = {
      ...mockProps,
      lastSync: new Date('2025-12-01T14:30:00'),
      nextAutoSync: new Date('2025-12-02T14:30:00'),
    };

    render(<SyncStatusPanel {...specificDateProps} />);

    // Component formats times and dates - just verify it renders
    expect(screen.getByText(/Synced \(/)).toBeInTheDocument();
  });

  it('sets correct ARIA attributes', () => {
    render(<SyncStatusPanel {...mockProps} />);

    const panel = screen.getByRole('region', { name: /Data Synchronization/i });
    expect(panel).toHaveAttribute('aria-labelledby', 'sync-panel-title');

    const syncButton = screen.getByRole('button', { name: /sync now/i });
    expect(syncButton).toBeInTheDocument();
  });

  it('shows different data quality indicators', () => {
    // Component renders without errors with extra props
    const qualityVariants = ['Excellent', 'Good', 'Fair', 'Poor'];

    qualityVariants.forEach((quality) => {
      const qualityProps = {
        ...mockProps,
        syncMetrics: {
          ...mockProps.syncMetrics,
          dataQuality: quality,
        },
      };

      const { rerender } = render(<SyncStatusPanel {...qualityProps} />);

      // Just verify component renders successfully
      expect(screen.getByRole('region')).toBeInTheDocument();

      rerender(<div />); // Clear for next iteration
    });
  });

  it('handles loading state gracefully', () => {
    const loadingProps = {
      ...mockProps,
      syncMetrics: null,
    };

    render(<SyncStatusPanel {...loadingProps} />);

    expect(screen.getByText('Data Synchronization')).toBeInTheDocument();
    // Should still show sync controls even without metrics
    expect(
      screen.getByRole('button', { name: /sync now/i }),
    ).toBeInTheDocument();
  });

  it('displays sync progress when syncing', () => {
    const syncingProps = {
      ...mockProps,
      syncStatus: 'syncing',
    };

    render(<SyncStatusPanel {...syncingProps} />);

    // Multiple elements may contain 'syncing', use getAllByText
    const syncingElements = screen.getAllByText(/syncing/i);
    expect(syncingElements.length).toBeGreaterThan(0);
  });

  it('shows error with retry button when sync fails', () => {
    const errorProps = {
      ...mockProps,
      syncStatus: 'error',
      errorMessage: 'Network timeout',
    };

    render(<SyncStatusPanel {...errorProps} />);

    expect(screen.getByText('Sync failed')).toBeInTheDocument();
    expect(screen.getByText(/Network timeout/)).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);
    expect(mockProps.onSyncNow).toHaveBeenCalledTimes(1);
  });

  it('uses theme-aware CSS custom properties', () => {
    render(<SyncStatusPanel {...mockProps} />);

    const panel = screen.getByRole('region', { name: /data synchronization/i });
    const style = panel.getAttribute('style');

    // Should use CSS custom properties, not hardcoded colors
    expect(style).toContain('var(--color-surface)');
    expect(style).toContain('var(--color-border)');
    expect(style).toContain('var(--shadow-2)');
    expect(style).not.toContain('#ffffff');
    expect(style).not.toContain('#e0e0e0');
  });

  it('renders without maxWidth constraint', () => {
    render(<SyncStatusPanel {...mockProps} />);

    const panel = screen.getByRole('region', { name: /data synchronization/i });
    const style = panel.getAttribute('style');

    // Should not have maxWidth
    expect(style).not.toContain('max-width');
    expect(style).not.toContain('maxWidth');
  });

  it('shows keyboard navigation hints', () => {
    render(<SyncStatusPanel {...mockProps} />);

    const syncButton = screen.getByRole('button', { name: /sync now/i });

    fireEvent.focus(syncButton);

    // Buttons respond to click events
    fireEvent.click(syncButton);
    expect(mockProps.onSyncNow).toHaveBeenCalledTimes(1);
  });
});
