import { APNEA_CLUSTER_MIN_EVENTS } from '../../constants';

export const MIN_VALID_CLUSTER_EVENT_COUNT = APNEA_CLUSTER_MIN_EVENTS;
export const FLG_LEVEL_BELOW_THRESHOLD_DELTA = 0.01;

const ANALYTICS_WORKER_CLUSTERS = Object.freeze([
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
]);

const ANALYTICS_WORKER_FALSE_NEGATIVES = Object.freeze([
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
]);

export const EXPECTED_ANALYTICS_CLUSTER_COUNT =
  ANALYTICS_WORKER_CLUSTERS.length;
export const EXPECTED_FALSE_NEGATIVE_COUNT =
  ANALYTICS_WORKER_FALSE_NEGATIVES.length;
export const EXPECTED_NORMALIZED_FALSE_NEGATIVE_COUNT = 2;

export function buildAnalyticsWorkerMessage() {
  return {
    ok: true,
    data: {
      clusters: ANALYTICS_WORKER_CLUSTERS.map((cluster) => ({
        ...cluster,
        events: cluster.events.map((event) => ({ ...event })),
      })),
      falseNegatives: ANALYTICS_WORKER_FALSE_NEGATIVES.map((entry) => ({
        ...entry,
      })),
    },
  };
}
