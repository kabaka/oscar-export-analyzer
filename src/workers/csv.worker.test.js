import Papa from 'papaparse';
import { FLG_BRIDGE_THRESHOLD } from '../utils/clustering.js';
import { FLG_LEVEL_BELOW_THRESHOLD_DELTA } from '../test-utils/fixtures/clustering.js';
import './csv.worker.js';

describe('csv.worker chunk handler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates progress and filters rows per chunk', () => {
    const originalPost = self.postMessage;
    self.postMessage = vi.fn();

    vi.spyOn(Papa, 'parse').mockImplementation((file, opts) => {
      opts.chunk({
        data: [
          {
            Event: 'FLG',
            'Data/Duration':
              FLG_BRIDGE_THRESHOLD - FLG_LEVEL_BELOW_THRESHOLD_DELTA,
            DateTime: '2025-01-01T00:00:00',
          },
          {
            Event: 'FLG',
            'Data/Duration': FLG_BRIDGE_THRESHOLD,
            DateTime: '2025-01-01T00:01:00',
          },
          {
            Event: 'ClearAirway',
            'Data/Duration': 10,
            DateTime: '2025-01-01T00:02:00',
          },
          {
            Event: 'Noise',
            'Data/Duration': 5,
            DateTime: '2025-01-01T00:03:00',
          },
        ],
        meta: { cursor: 321 },
      });
      opts.complete();
    });

    self.onmessage({ data: { file: 'file', filterEvents: true } });

    const [[progressPayload], [rowsPayload], [completePayload]] =
      self.postMessage.mock.calls;

    expect(progressPayload).toEqual({
      type: 'progress',
      cursor: 321,
    });
    expect(rowsPayload).toEqual({
      type: 'rows',
      rows: [
        {
          Event: 'FLG',
          'Data/Duration': FLG_BRIDGE_THRESHOLD,
          DateTime: new Date('2025-01-01T00:01:00').getTime(),
        },
        {
          Event: 'ClearAirway',
          'Data/Duration': 10,
          DateTime: new Date('2025-01-01T00:02:00').getTime(),
        },
      ],
    });
    expect(completePayload).toEqual({ type: 'complete' });

    self.postMessage = originalPost;
  });
});
