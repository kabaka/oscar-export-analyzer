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

  it('normalizes worker-provided cluster and false-negative dates', async () => {
    class MockWorker {
      constructor(url) {
        this.url = typeof url === 'string' ? url : url?.href || '';
        this.onmessage = null;
      }

      postMessage() {
        if (this.url.includes('analytics.worker')) {
          setTimeout(() => {
            this.onmessage?.({
              data: {
                ok: true,
                data: {
                  clusters: [
                    {
                      id: 'cluster-2',
                      count: 1,
                      severity: 0.2,
                      start: '2025-06-01T00:00:00Z',
                      end: 1759353600000,
                      events: [
                        {
                          date: '2025-06-01T00:00:00Z',
                          durationSec: 45,
                        },
                      ],
                    },
                    {
                      id: 'cluster-without-start',
                      count: 2,
                      severity: 0.4,
                      events: [
                        {
                          date: '2025-06-02T00:00:00Z',
                          durationSec: 30,
                        },
                        {
                          date: '2025-06-02T00:05:00Z',
                          durationSec: 20,
                        },
                      ],
                    },
                  ],
                  falseNegatives: [
                    {
                      start: '2025-06-03T00:00:00Z',
                      end: 'invalid',
                      durationSec: 60,
                      confidence: 0.5,
                    },
                    {
                      start: 1759436400000,
                      durationSec: 40,
                      confidence: 0.6,
                    },
                    {
                      start: null,
                      durationSec: 10,
                      confidence: 0.2,
                    },
                  ],
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
      expect(latestClustersProps?.clusters?.length).toBe(2);
    });

    const [first, second] = latestClustersProps.clusters;
    expect(first.start).toBeInstanceOf(Date);
    expect(first.end).toBeInstanceOf(Date);
    expect(first.events[0].date).toBeInstanceOf(Date);

    expect(second.start).toBeInstanceOf(Date);
    expect(second.events[0].date).toBeInstanceOf(Date);

    await waitFor(() => {
      expect(latestFalseNegativesProps?.list?.length).toBe(2);
    });

    for (const entry of latestFalseNegativesProps.list) {
      expect(entry.start).toBeInstanceOf(Date);
      expect(entry.end).toBeInstanceOf(Date);
    }
  });
});
