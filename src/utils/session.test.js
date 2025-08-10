import { describe, it, expect } from 'vitest';
import { buildSession, applySession } from './session';

describe('session utils', () => {
  it('round-trips basic state', () => {
    const state = {
      summaryData: [{ Date: '2024-01-01', AHI: '2', 'Total Time': '01:00:00' }],
      detailsData: [{ Event: 'FLG', 'Data/Duration': 1.0, DateTime: '2024-01-01T01:00:00Z' }],
      clusterParams: { gapSec: 120 },
      dateFilter: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
      rangeA: { start: new Date('2024-01-01'), end: new Date('2024-01-15') },
      rangeB: { start: new Date('2024-01-16'), end: new Date('2024-01-31') },
      fnPreset: 'balanced',
    };
    const sess = buildSession(state);
    expect(sess.summaryData.length).toBe(1);
    const patch = applySession(sess);
    expect(patch.summaryData.length).toBe(1);
    expect(patch.dateFilter.start).toBeInstanceOf(Date);
    expect(patch.rangeB.end).toBeInstanceOf(Date);
    expect(patch.clusterParams.gapSec).toBe(120);
  });
});

