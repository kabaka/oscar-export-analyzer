import { render, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import {
  buildAnalyticsWorkerMessage,
  EXPECTED_ANALYTICS_CLUSTER_COUNT,
  EXPECTED_NORMALIZED_FALSE_NEGATIVE_COUNT,
} from './test-utils/fixtures/clustering.js';

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

let latestClustersProps;
let latestFalseNegativesProps;

vi.mock('./features/apnea-clusters/ApneaClusterAnalysis', () => ({
  __esModule: true,
  default: (props) => {
    latestClustersProps = props;
    return null;
  },
}));

vi.mock('./features/apnea-clusters/ApneaEventStats', () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock('./components/ui', () => ({
  __esModule: true,
  DataImportModal: () => null,
  DocsModal: () => null,
  PrintWarningDialog: () => null,
  StorageConsentDialog: () => null,
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

vi.mock('./components/FalseNegativesAnalysis', () => ({
  __esModule: true,
  default: (props) => {
    latestFalseNegativesProps = props;
    return null;
  },
}));

describe('App analytics worker integration', () => {
  const originalWorker = global.Worker;

  afterEach(async () => {
    global.Worker = originalWorker;
    const analytics = await import('./utils/analytics');
    analytics.finalizeClusters.mockClear();
    latestClustersProps = undefined;
    latestFalseNegativesProps = undefined;
  });

  it('relies on worker-supplied clusters without re-finalizing them', async () => {
    const workerInstances = [];

    class MockWorker {
      constructor(url) {
        this.url = typeof url === 'string' ? url : url?.href || '';
        this.onmessage = null;
        this.messages = [];
        this.workerId = null;
        workerInstances.push(this);
      }

      postMessage(message) {
        this.messages.push(message);
        this.workerId = message?.workerId;
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

  it('normalizes worker-provided cluster and false-negative dates', async () => {
    class MockWorker {
      constructor(url) {
        this.url = typeof url === 'string' ? url : url?.href || '';
        this.onmessage = null;
      }

      postMessage() {
        if (this.url.includes('analytics.worker')) {
          setTimeout(() => {
            const analyticsWorkerMessage = buildAnalyticsWorkerMessage();
            this.onmessage?.({
              data: analyticsWorkerMessage,
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
      expect(latestClustersProps?.clusters?.length).toBe(
        EXPECTED_ANALYTICS_CLUSTER_COUNT,
      );
    });

    const [first, second] = latestClustersProps.clusters;
    expect(first.start).toBeInstanceOf(Date);
    expect(first.end).toBeInstanceOf(Date);
    expect(first.events[0].date).toBeInstanceOf(Date);

    expect(second.start).toBeInstanceOf(Date);
    expect(second.events[0].date).toBeInstanceOf(Date);

    await waitFor(() => {
      expect(latestFalseNegativesProps?.list?.length).toBe(
        EXPECTED_NORMALIZED_FALSE_NEGATIVE_COUNT,
      );
    });

    for (const entry of latestFalseNegativesProps.list) {
      expect(entry.start).toBeInstanceOf(Date);
      expect(entry.end).toBeInstanceOf(Date);
    }
  });
});
