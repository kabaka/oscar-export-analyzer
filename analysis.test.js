import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import analysis from './analysis.js';
import {
  clusterApneaEvents,
  APOEA_CLUSTER_MIN_TOTAL_SEC,
  MAX_CLUSTER_DURATION_SEC,
} from './src/utils/clustering.js';
import { MIN_VALID_CLUSTER_EVENT_COUNT } from './src/test-utils/fixtures/clustering.js';

const { run } = analysis;

describe('analysis CLI clustering', () => {
  it('matches clustering from shared utility', async () => {
    const csv = [
      'DateTime,Type,Event,Data/Duration',
      '2021-01-01T00:00:00,0,ClearAirway,20',
      '2021-01-01T00:01:00,0,Obstructive,20',
      '2021-01-01T00:02:00,0,Mixed,30',
      '2021-01-01T00:01:30,0,FLG,0.2',
    ].join('\n');
    const tmp = path.join(process.cwd(), 'tmp-details.csv');
    fs.writeFileSync(tmp, csv);

    const cliClusters = await run(tmp, '2021-01-01');

    const events = [
      {
        date: new Date('2021-01-01T00:00:00Z'),
        type: 'ClearAirway',
        durationSec: 20,
      },
      {
        date: new Date('2021-01-01T00:01:00Z'),
        type: 'Obstructive',
        durationSec: 20,
      },
      {
        date: new Date('2021-01-01T00:02:00Z'),
        type: 'Mixed',
        durationSec: 30,
      },
    ];
    const flgEvents = [{ date: new Date('2021-01-01T00:01:30Z'), level: 0.2 }];
    const clusters = clusterApneaEvents({ events, flgEvents });
    const expected = clusters.filter((c) => {
      const totalEventDur = c.events.reduce((sum, e) => sum + e.durationSec, 0);
      return (
        c.count >= MIN_VALID_CLUSTER_EVENT_COUNT &&
        totalEventDur >= APOEA_CLUSTER_MIN_TOTAL_SEC &&
        c.durationSec <= MAX_CLUSTER_DURATION_SEC
      );
    });

    expect(cliClusters).toEqual(expected);
    fs.unlinkSync(tmp);
  });
});
