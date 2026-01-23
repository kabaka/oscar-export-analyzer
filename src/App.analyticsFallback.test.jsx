import { render, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, afterEach } from 'vitest';

const summaryData = [{ Date: '2025-06-01', 'Total Time': '08:00:00' }];
const detailsData = [
  {
    Event: 'ClearAirway',
    DateTime: '2025-06-01T00:00:00',
    'Data/Duration': '30',
  },
  {
    Event: 'ClearAirway',
    DateTime: '2025-06-01T00:00:40',
    'Data/Duration': '25',
  },
  {
    Event: 'ClearAirway',
    DateTime: '2025-06-01T00:01:10',
    'Data/Duration': '20',
  },
];

vi.mock('./utils/analytics', async () => {
  const actual = await vi.importActual('./utils/analytics');
  return {
    ...actual,
    finalizeClusters: vi.fn(actual.finalizeClusters),
  };
});

vi.mock('./hooks/useCsvFiles', () => ({
  useCsvFiles: () => ({
    summaryData,
    detailsData,
    loadingSummary: false,
    summaryProgress: 0,
    summaryProgressMax: 0,
    loadingDetails: false,
    detailsProgress: 0,
    detailsProgressMax: 0,
    onSummaryFile: vi.fn(),
    onDetailsFile: vi.fn(),
    setSummaryData: vi.fn(),
    setDetailsData: vi.fn(),
    error: null,
  }),
}));

vi.mock('./hooks/useSessionManager', () => ({
  useSessionManager: () => ({
    handleLoadSaved: vi.fn(),
    handleExportJson: vi.fn(),
    importSessionFile: vi.fn(),
  }),
}));

vi.mock('./components/UsagePatternsCharts', () => ({
  __esModule: true,
  default: () => null,
}));

describe('App fallback analytics', () => {
  const originalWorker = global.Worker;

  afterEach(async () => {
    global.Worker = originalWorker;
    const analytics = await import('./utils/analytics');
    analytics.finalizeClusters.mockClear();
  });

  it('uses finalizeClusters when the analytics worker returns an error', async () => {
    const analytics = await import('./utils/analytics');
    const mockClusters = [
      {
        start: new Date('2025-06-01T00:00:00Z'),
        end: new Date('2025-06-01T00:05:00Z'),
        durationSec: 300,
        count: 3,
        severity: 4.2,
        events: [],
      },
    ];
    analytics.finalizeClusters.mockReturnValueOnce(mockClusters);
    const workerInstances = [];

    class MockWorker {
      constructor(url) {
        this.url = typeof url === 'string' ? url : url?.href || '';
        this.messages = [];
        this.workerId = null;
        workerInstances.push(this);
      }

      postMessage(message) {
        this.messages.push(message);
        this.workerId = message?.workerId;
        if (this.url.includes('analytics.worker')) {
          // Use Promise.resolve for proper async handling
          Promise.resolve().then(() => {
            this.onmessage?.({
              data: { ok: false, data: null, error: 'fail' },
            });
          });
        }
      }

      terminate() {}
    }

    global.Worker = MockWorker;

    const { default: AppShell } = await import('./App');
    const { AppProviders } = await import('./app/AppProviders');

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    await waitFor(
      () => {
        expect(analytics.finalizeClusters).toHaveBeenCalled();
      },
      { timeout: 8000 },
    );
    expect(workerInstances.length).toBeGreaterThan(0);
    expect(workerInstances[0].messages[0]).toMatchObject({
      action: 'analyzeDetails',
    });
  });
});
