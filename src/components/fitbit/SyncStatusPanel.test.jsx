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
    expect(screen.getByText(/Next automatic sync:/)).toBeInTheDocument();
    expect(screen.getByText(/Next sync: Tomorrow at/)).toBeInTheDocument();
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
    expect(screen.getByText('Syncing...')).toBeInTheDocument();
  });

  it('displays data metrics correctly', () => {
    render(<SyncStatusPanel {...mockProps} />);

    // Total days
    expect(screen.getByText('47')).toBeInTheDocument();
    expect(screen.getByText('Total Days')).toBeInTheDocument();

    // Heart rate nights
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('Heart Rate')).toBeInTheDocument();

    // SpO2 nights
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('SpO2')).toBeInTheDocument();

    // Sleep stages
    expect(screen.getByText('43')).toBeInTheDocument();
    expect(screen.getByText('Sleep Stages')).toBeInTheDocument();

    // Data quality
    expect(screen.getByText('Good')).toBeInTheDocument();
    expect(screen.getByText('Data Quality')).toBeInTheDocument();

    // Gaps detected
    expect(screen.getByText('3 gaps detected')).toBeInTheDocument();
  });

  it('handles sync now button click', () => {
    render(<SyncStatusPanel {...mockProps} />);

    const syncButton = screen.getByRole('button', { name: /sync now/i });
    fireEvent.click(syncButton);

    expect(mockProps.onSyncNow).toHaveBeenCalledTimes(1);
  });

  it('handles auto-sync toggle', () => {
    render(<SyncStatusPanel {...mockProps} />);

    const autoSyncSwitch = screen.getByRole('switch', {
      name: /auto-sync enabled/i,
    });
    expect(autoSyncSwitch).toBeChecked();

    fireEvent.click(autoSyncSwitch);

    expect(mockProps.onAutoSyncToggle).toHaveBeenCalledWith(false);
  });

  it('handles disabled auto-sync state', () => {
    const disabledAutoSyncProps = {
      ...mockProps,
      syncStatus: {
        ...mockProps.syncStatus,
        autoSync: false,
      },
    };

    render(<SyncStatusPanel {...disabledAutoSyncProps} />);

    const autoSyncSwitch = screen.getByRole('switch', {
      name: /auto-sync disabled/i,
    });
    expect(autoSyncSwitch).not.toBeChecked();

    fireEvent.click(autoSyncSwitch);

    expect(mockProps.onAutoSyncToggle).toHaveBeenCalledWith(true);
  });

  it('displays recent activity correctly', () => {
    render(<SyncStatusPanel {...mockProps} />);

    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(screen.getByText('Auto sync completed')).toBeInTheDocument();
    expect(
      screen.getByText('45 nights processed, 3 gaps filled'),
    ).toBeInTheDocument();
    expect(screen.getByText('Manual sync requested')).toBeInTheDocument();
    expect(screen.getByText('2 new nights added')).toBeInTheDocument();
  });

  it('shows resolve gaps button when gaps detected', () => {
    render(<SyncStatusPanel {...mockProps} />);

    const resolveGapsButton = screen.getByRole('button', {
      name: /resolve gaps/i,
    });
    expect(resolveGapsButton).toBeInTheDocument();

    fireEvent.click(resolveGapsButton);

    expect(mockProps.onResolveGaps).toHaveBeenCalledTimes(1);
  });

  it('hides resolve gaps button when no gaps', () => {
    const noGapsProps = {
      ...mockProps,
      syncMetrics: {
        ...mockProps.syncMetrics,
        gapsDetected: 0,
      },
    };

    render(<SyncStatusPanel {...noGapsProps} />);

    expect(
      screen.queryByRole('button', { name: /resolve gaps/i }),
    ).not.toBeInTheDocument();
  });

  it('formats dates correctly', () => {
    const specificDateProps = {
      ...mockProps,
      syncStatus: {
        ...mockProps.syncStatus,
        lastSyncDate: new Date('2025-12-01T14:30:00'),
        nextSyncDate: new Date('2025-12-02T14:30:00'),
      },
    };

    render(<SyncStatusPanel {...specificDateProps} />);

    expect(screen.getByText(/12\/1\/2025 at 2:30 PM/)).toBeInTheDocument();
    expect(screen.getByText(/12\/2\/2025 at 2:30 PM/)).toBeInTheDocument();
  });

  it('handles missing recent activity', () => {
    const noActivityProps = {
      ...mockProps,
      recentActivity: [],
    };

    render(<SyncStatusPanel {...noActivityProps} />);

    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });

  it('shows success/failure icons for activity items', () => {
    const mixedActivityProps = {
      ...mockProps,
      recentActivity: [
        {
          date: new Date('2026-01-24T08:30:00'),
          action: 'Sync completed',
          details: 'Success',
          success: true,
        },
        {
          date: new Date('2026-01-23T08:30:00'),
          action: 'Sync failed',
          details: 'Network error',
          success: false,
        },
      ],
    };

    render(<SyncStatusPanel {...mixedActivityProps} />);

    // Success icon
    expect(screen.getByText('✓')).toBeInTheDocument();
    // Failure icon
    expect(screen.getByText('✗')).toBeInTheDocument();
  });

  it('sets correct ARIA attributes', () => {
    render(<SyncStatusPanel {...mockProps} />);

    const panel = screen.getByRole('region', { name: /Data Sync Status/i });
    expect(panel).toHaveAttribute('aria-labelledby', 'sync-status-title');

    const syncButton = screen.getByRole('button', { name: /sync now/i });
    expect(syncButton).toHaveAttribute(
      'aria-describedby',
      'sync-status-description',
    );

    const autoSyncSwitch = screen.getByRole('switch', {
      name: /auto-sync enabled/i,
    });
    expect(autoSyncSwitch).toHaveAttribute(
      'aria-describedby',
      'auto-sync-description',
    );
  });

  it('shows different data quality indicators', () => {
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

      expect(screen.getByText(quality)).toBeInTheDocument();

      rerender(<div />); // Clear for next iteration
    });
  });

  it('handles loading state gracefully', () => {
    const loadingProps = {
      ...mockProps,
      syncMetrics: null,
    };

    render(<SyncStatusPanel {...loadingProps} />);

    expect(screen.getByText('Data Sync Status')).toBeInTheDocument();
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

    expect(screen.getByText(/syncing/i)).toBeInTheDocument();
  });

  it('shows overflow for long activity list', async () => {
    const longActivityProps = {
      ...mockProps,
      recentActivity: Array.from({ length: 10 }, (_, i) => ({
        date: new Date(`2026-01-${24 - i}T08:30:00`),
        action: `Activity ${i + 1}`,
        details: `Details for activity ${i + 1}`,
        success: i % 2 === 0,
      })),
    };

    render(<SyncStatusPanel {...longActivityProps} />);

    const activityList = screen.getByRole('list');
    expect(activityList.children).toHaveLength(10);

    // Should have scrollable overflow styling
    expect(activityList).toHaveClass('max-h-48', 'overflow-y-auto');
  });

  it('shows keyboard navigation hints', () => {
    render(<SyncStatusPanel {...mockProps} />);

    const syncButton = screen.getByRole('button', { name: /sync now/i });

    fireEvent.focus(syncButton);
    // In a real implementation, we'd check for focus indicators

    fireEvent.keyDown(syncButton, { key: 'Enter' });
    expect(mockProps.onSyncNow).toHaveBeenCalledTimes(1);
  });
});
