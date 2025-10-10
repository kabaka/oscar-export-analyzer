import { render, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const summaryData = [{ Date: '2025-06-01', 'Total Time': '08:00:00' }];
const detailsData = [
  {
    Event: 'ClearAirway',
    DateTime: '2025-06-01T00:00:00',
    'Data/Duration': '30',
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

vi.mock('./components/ui', () => ({
  __esModule: true,
  DataImportModal: () => null,
  DocsModal: () => null,
  ThemeToggle: () => null,
  GuideLink: () => null,
  ErrorBoundary: ({ children }) => children,
  KPICard: ({ children, title, value }) => (
    <div data-testid="kpi-card">
      <span>{title}</span>
      <span>{value}</span>
      {children}
    </div>
  ),
  ParamInput: () => null,
  ThemedPlot: () => null,
  VizHelp: () => null,
}));

describe('App analytics worker integration', () => {
  const originalWorker = global.Worker;

  afterEach(async () => {
    global.Worker = originalWorker;
    const analytics = await import('./utils/analytics');
    analytics.finalizeClusters.mockClear();
  });

  it('relies on worker-supplied clusters without re-finalizing them', async () => {
    const workerInstances = [];

    class MockWorker {
      constructor(url) {
        this.url = typeof url === 'string' ? url : url?.href || '';
        this.onmessage = null;
        this.messages = [];
        workerInstances.push(this);
      }

      postMessage(message) {
        this.messages.push(message);
        if (this.url.includes('analytics.worker')) {
          setTimeout(() => {
            this.onmessage?.({
              data: {
                ok: true,
                data: {
                  clusters: [
                    {
                      id: 'cluster-1',
                      count: 3,
                      severity: 'moderate',
                    },
                  ],
                  falseNegatives: [],
                },
              },
            });
          }, 0);
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

    await waitFor(() => {
      expect(workerInstances.length).toBeGreaterThan(0);
    });

    const analytics = await import('./utils/analytics');
    expect(analytics.finalizeClusters).not.toHaveBeenCalled();
    expect(workerInstances[0].messages[0]).toMatchObject({
      action: 'analyzeDetails',
    });
  });
});
