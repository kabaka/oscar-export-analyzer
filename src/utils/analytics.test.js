/* eslint-disable no-magic-numbers -- test-specific data and clustering scenarios */
import { describe, expect, it } from 'vitest';
import { finalizeClusters } from './analytics';
import { APNEA_CLUSTER_MIN_EVENTS } from '../constants';
import { APOEA_CLUSTER_MIN_TOTAL_SEC } from './clustering';

const baseDate = new Date('2025-01-01T00:00:00Z');

function makeEvent(offsetSec, durationSec) {
  return {
    date: new Date(baseDate.getTime() + offsetSec * 1000),
    durationSec,
  };
}

describe('finalizeClusters', () => {
  it('filters clusters and adds severity metadata', () => {
    const raw = [
      {
        start: baseDate,
        end: new Date(baseDate.getTime() + 200 * 1000),
        durationSec: 200,
        count: APNEA_CLUSTER_MIN_EVENTS,
        events: [makeEvent(0, 30), makeEvent(40, 25), makeEvent(80, 35)],
      },
      {
        start: baseDate,
        end: new Date(baseDate.getTime() + 50 * 1000),
        durationSec: 50,
        count: 2,
        events: [makeEvent(0, 10), makeEvent(20, 5)],
      },
      {
        start: baseDate,
        end: new Date(baseDate.getTime() + 400 * 1000),
        durationSec: 400,
        count: APNEA_CLUSTER_MIN_EVENTS,
        events: [makeEvent(0, 10), makeEvent(200, 10), makeEvent(380, 10)],
      },
    ];

    const finalized = finalizeClusters(raw, {
      minCount: APNEA_CLUSTER_MIN_EVENTS,
      minTotalSec: APOEA_CLUSTER_MIN_TOTAL_SEC,
      maxClusterSec: 300,
    });

    expect(finalized).toHaveLength(1);
    expect(finalized[0]).toMatchObject({
      count: APNEA_CLUSTER_MIN_EVENTS,
      durationSec: 200,
    });
    expect(finalized[0].severity).toBeGreaterThan(0);
  });

  it('handles undefined arrays gracefully', () => {
    expect(finalizeClusters(undefined)).toEqual([]);
  });
});
