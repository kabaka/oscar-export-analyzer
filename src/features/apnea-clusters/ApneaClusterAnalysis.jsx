import React, { useState, useMemo, useCallback } from 'react';
import {
  clustersToCsv,
  CLUSTER_ALGORITHMS,
  DEFAULT_CLUSTER_ALGORITHM,
} from '../../utils/clustering';
import {
  GuideLink,
  ParamInput,
  ThemedPlot,
  VizHelp,
} from '../../components/ui';
import { PARAM_FIELDS_BY_ALGORITHM } from './paramFields';

function ApneaClusterAnalysis({ clusters, params, onParamChange, details }) {
  const [selected, setSelected] = useState(null);
  const [sortBy, setSortBy] = useState({ key: 'severity', dir: 'desc' });
  const algorithm = params.algorithm || DEFAULT_CLUSTER_ALGORITHM;
  const paramFields =
    PARAM_FIELDS_BY_ALGORITHM[algorithm] ||
    PARAM_FIELDS_BY_ALGORITHM[DEFAULT_CLUSTER_ALGORITHM];
  const sorted = [...clusters].sort((a, b) => {
    const dir = sortBy.dir === 'asc' ? 1 : -1;
    const va = a[sortBy.key] ?? 0;
    const vb = b[sortBy.key] ?? 0;
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });

  const selectedCluster = selected !== null ? sorted[selected] : null;
  const { leakTrace, pressureTrace } = useMemo(() => {
    if (!selectedCluster || !details?.length)
      return { leakTrace: [], pressureTrace: [] };
    const padMs = 30000; // 30s padding around cluster
    const start = new Date(selectedCluster.start.getTime() - padMs);
    const end = new Date(selectedCluster.end.getTime() + padMs);
    const leak = [],
      pressure = [];
    details.forEach((r) => {
      const dt = new Date(r['DateTime']);
      if (dt < start || dt > end) return;
      const val = parseFloat(r['Data/Duration']);
      if (r['Event'] === 'Leak') leak.push({ x: dt, y: val });
      if (r['Event'] === 'Pressure' || r['Event'] === 'EPAP')
        pressure.push({ x: dt, y: val });
    });
    return { leakTrace: leak, pressureTrace: pressure };
  }, [selectedCluster, details]);

  const handleExport = useCallback(() => {
    const csv = clustersToCsv(clusters);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'apnea_clusters.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [clusters]);

  return (
    <div className="section">
      <h2 id="clustered-apnea">
        Clustered Apnea Events{' '}
        <GuideLink anchor="clustered-apnea-events-details-csv" label="Guide" />
      </h2>

      <div
        className="controls"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'end',
        }}
        aria-label="Cluster parameters"
      >
        <span className="control-title" style={{ marginBottom: 6 }}>
          Clustering Params
        </span>
        <div>
          <label>
            Algorithm
            <select
              value={algorithm}
              onChange={(e) =>
                onParamChange({
                  algorithm: e.target.value || DEFAULT_CLUSTER_ALGORITHM,
                })
              }
            >
              <option value={CLUSTER_ALGORITHMS.BRIDGED}>FLG-bridged</option>
              <option value={CLUSTER_ALGORITHMS.KMEANS}>K-means</option>
              <option value={CLUSTER_ALGORITHMS.AGGLOMERATIVE}>
                Single-link
              </option>
            </select>
          </label>
        </div>
        {paramFields.map(({ label, key, inputProps }) => (
          <ParamInput
            key={key}
            label={label}
            value={params[key]}
            onChange={(v) => onParamChange({ [key]: v })}
            inputProps={inputProps}
          />
        ))}
        <div>
          <button onClick={handleExport}>Export CSV</button>
        </div>
      </div>

      {selectedCluster && (
        <div>
          <h3>Event-level Timeline for Cluster #{selected + 1}</h3>
          <div className="chart-with-help">
            <ThemedPlot
              data={[
                {
                  type: 'bar',
                  orientation: 'h',
                  y: sorted[selected].events.map((_, i) => `Evt ${i + 1}`),
                  x: sorted[selected].events.map((e) => e.durationSec * 1000),
                  base: sorted[selected].events.map((e) =>
                    e.date.toISOString(),
                  ),
                  marker: { color: '#ff7f0e' },
                  hovertemplate: sorted[selected].events.map(
                    (e) =>
                      `${e.date.toLocaleString()}<br>Duration: ${e.durationSec.toFixed(0)} s<extra></extra>`,
                  ),
                },
              ]}
              layout={{
                title: `Cluster #${selected + 1} Event Timeline`,
                xaxis: { type: 'date', title: 'Event Start Time' },
                yaxis: { title: 'Event #' },
                margin: { l: 80, r: 20, t: 40, b: 40 },
                height: Math.max(
                  200,
                  sorted[selected].events.length * 30 + 100,
                ),
              }}
              config={{ displayModeBar: false }}
            />
            <VizHelp text="Horizontal bars show individual event durations positioned by start time. Longer bars mean longer apneas within the selected cluster." />
          </div>
        </div>
      )}

      {selectedCluster && (leakTrace.length || pressureTrace.length) && (
        <div>
          <h3>Leak/Pressure around Cluster</h3>
          <div className="chart-with-help">
            <ThemedPlot
              data={[
                leakTrace.length && {
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Leak',
                  x: leakTrace.map((p) => p.x),
                  y: leakTrace.map((p) => p.y),
                  yaxis: 'y1',
                },
                pressureTrace.length && {
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Pressure',
                  x: pressureTrace.map((p) => p.x),
                  y: pressureTrace.map((p) => p.y),
                  yaxis: leakTrace.length ? 'y2' : 'y1',
                },
              ].filter(Boolean)}
              layout={{
                title: 'Leak/Pressure around Cluster',
                xaxis: { type: 'date', title: 'Time' },
                yaxis: {
                  title: leakTrace.length ? 'Leak' : 'Pressure',
                  side: 'left',
                },
                ...(leakTrace.length && pressureTrace.length
                  ? {
                      yaxis2: {
                        title: 'Pressure',
                        overlaying: 'y',
                        side: 'right',
                      },
                    }
                  : {}),
                margin: { l: 80, r: 20, t: 40, b: 40 },
                height: 300,
              }}
              config={{ displayModeBar: false }}
            />
            <VizHelp text="Leak and pressure traces provide context around the cluster window." />
          </div>
        </div>
      )}

      <div className="cluster-table-container">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Start</th>
              <th
                style={{ cursor: 'pointer' }}
                onClick={() =>
                  setSortBy((s) => ({
                    key: 'durationSec',
                    dir:
                      s.key === 'durationSec' && s.dir === 'desc'
                        ? 'asc'
                        : 'desc',
                  }))
                }
              >
                Duration (s)
              </th>
              <th
                style={{ cursor: 'pointer' }}
                onClick={() =>
                  setSortBy((s) => ({
                    key: 'count',
                    dir: s.key === 'count' && s.dir === 'desc' ? 'asc' : 'desc',
                  }))
                }
              >
                Count
              </th>
              <th
                style={{ cursor: 'pointer' }}
                onClick={() =>
                  setSortBy((s) => ({
                    key: 'severity',
                    dir:
                      s.key === 'severity' && s.dir === 'desc' ? 'asc' : 'desc',
                  }))
                }
              >
                Severity
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((cl, i) => (
              <tr
                key={cl.start.getTime()}
                onClick={() => setSelected(i)}
                className={selected === i ? 'row-selected' : undefined}
                style={{ cursor: 'pointer' }}
              >
                <td>{i + 1}</td>
                <td>{cl.start.toLocaleString()}</td>
                <td>{cl.durationSec.toFixed(0)}</td>
                <td>{cl.count}</td>
                <td>{cl.severity?.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { ApneaClusterAnalysis };
export { PARAM_FIELDS_BY_ALGORITHM } from './paramFields';
export default React.memo(ApneaClusterAnalysis);
