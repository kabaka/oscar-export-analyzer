import Papa from 'papaparse';
import { FLG_BRIDGE_THRESHOLD } from '../utils/clustering.js';

// Parses CSV files off the main thread and streams filtered rows
self.onmessage = (e) => {
  const { file, filterEvents } = e.data || {};
  if (!file) return;
  Papa.parse(file, {
    worker: false,
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    chunkSize: 1024 * 1024,
    // Runs in a worker: update progress and filter events per chunk to keep the UI responsive
    chunk(results) {
      self.postMessage({ type: 'progress', cursor: results.meta.cursor });
      let rows = results.data;
      if (filterEvents) {
        rows = rows.filter((r) => {
          const e = r['Event'];
          if (e === 'FLG') return r['Data/Duration'] >= FLG_BRIDGE_THRESHOLD;
          return ['ClearAirway', 'Obstructive', 'Mixed'].includes(e);
        });
      }
      if (rows.length) {
        const processed = rows.map((r) => {
          if (r['DateTime']) {
            const ms = new Date(r['DateTime']).getTime();
            return { ...r, DateTime: ms };
          }
          return r;
        });
        self.postMessage({ type: 'rows', rows: processed });
      }
    },
    complete() {
      self.postMessage({ type: 'complete' });
    },
    error(err) {
      self.postMessage({ type: 'error', error: err?.message || String(err) });
    },
  });
};
