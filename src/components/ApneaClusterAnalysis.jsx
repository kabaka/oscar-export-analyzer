import React, { useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { useEffectiveDarkMode } from '../hooks/useEffectiveDarkMode';
import { clustersToCsv } from '../utils/clustering';
import { applyChartTheme } from '../utils/chartTheme';
import GuideLink from './GuideLink';
import VizHelp from './VizHelp';

export default function ApneaClusterAnalysis({
  clusters,
  params,
  onParamChange,
  details,
}) {
  const [selected, setSelected] = useState(null);
  const [sortBy, setSortBy] = useState({ key: 'severity', dir: 'desc' });
  const isDark = useEffectiveDarkMode();
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
    if (!selectedCluster || !details?.length) return { leakTrace: [], pressureTrace: [] };
    const padMs = 30000; // 30s padding around cluster
    const start = new Date(selectedCluster.start.getTime() - padMs);
    const end = new Date(selectedCluster.end.getTime() + padMs);
    const leak = [], pressure = [];
    details.forEach(r => {
      const dt = new Date(r['DateTime']);
      if (dt < start || dt > end) return;
      const val = parseFloat(r['Data/Duration']);
      if (r['Event'] === 'Leak') leak.push({ x: dt, y: val });
      if (r['Event'] === 'Pressure' || r['Event'] === 'EPAP') pressure.push({ x: dt, y: val });
    });
    return { leakTrace: leak, pressureTrace: pressure };
  }, [selectedCluster, details]);

  const handleExport = () => {
    const csv = clustersToCsv(clusters);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'apnea_clusters.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="section">
      <h2 id="clustered-apnea">Clustered Apnea Events <GuideLink anchor="clustered-apnea-events-details-csv" label="Guide" /></h2>

      <div className="controls" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'end' }} aria-label="Cluster parameters">
        <span className="control-title" style={{ marginBottom: 6 }}>Clustering Params</span>
        <div>
          <label>Gap sec
            <input
              type="number"
              min={0}
              value={params.gapSec}
              onChange={e => onParamChange({ gapSec: Number(e.target.value) })}
            />
          </label>
        </div>
        <div>
          <label>FLG bridge ≥
            <input
              type="number"
              step="0.05"
              min={0}
              max={2}
              value={params.bridgeThreshold}
              onChange={e => onParamChange({ bridgeThreshold: Number(e.target.value) })}
            />
          </label>
        </div>
        <div>
          <label>FLG gap sec
            <input
              type="number"
              min={0}
              value={params.bridgeSec}
              onChange={e => onParamChange({ bridgeSec: Number(e.target.value) })}
            />
          </label>
        </div>
        <div>
          <label>Edge enter ≥
            <input
              type="number"
              step="0.05"
              min={0}
              max={2}
              value={params.edgeEnter}
              onChange={e => onParamChange({ edgeEnter: Number(e.target.value) })}
            />
          </label>
        </div>
        <div>
          <label>Edge exit ≥
            <input
              type="number"
              step="0.05"
              min={0}
              max={2}
              value={params.edgeExit}
              onChange={e => onParamChange({ edgeExit: Number(e.target.value) })}
            />
          </label>
        </div>
        <div>
          <label>Min event count
            <input
              type="number"
              min={1}
              value={params.minCount}
              onChange={e => onParamChange({ minCount: Number(e.target.value) })}
            />
          </label>
        </div>
        <div>
          <label>Min total apnea sec
            <input
              type="number"
              min={0}
              value={params.minTotalSec}
              onChange={e => onParamChange({ minTotalSec: Number(e.target.value) })}
            />
          </label>
        </div>
        <div>
          <label>Max cluster sec
            <input
              type="number"
              min={0}
              value={params.maxClusterSec}
              onChange={e => onParamChange({ maxClusterSec: Number(e.target.value) })}
            />
          </label>
        </div>
        <div>
          <label>Min density (evt/min)
            <input
              type="number"
              step="0.1"
              min={0}
              value={params.minDensity}
              onChange={e => onParamChange({ minDensity: Number(e.target.value) })}
            />
          </label>
        </div>
        <div>
          <button onClick={handleExport}>Export CSV</button>
        </div>
      </div>

      {selectedCluster && (
        <div>
          <h3>Event-level Timeline for Cluster #{selected + 1}</h3>
            <div className="chart-with-help">
              <Plot
            key={isDark ? 'dark-cluster' : 'light-cluster'}
            data={[{
              type: 'bar',
              orientation: 'h',
              y: sorted[selected].events.map((_, i) => `Evt ${i + 1}`),
              x: sorted[selected].events.map(e => e.durationSec * 1000),
              base: sorted[selected].events.map(e => e.date.toISOString()),
              marker: { color: '#ff7f0e' },
              hovertemplate: sorted[selected].events.map(e =>
                `${e.date.toLocaleString()}<br>Duration: ${e.durationSec.toFixed(0)} s<extra></extra>`
              )
            }]}
            layout={applyChartTheme(isDark, {
              title: `Cluster #${selected + 1} Event Timeline`,
              xaxis: { type: 'date', title: 'Event Start Time' },
              yaxis: { title: 'Event #' },
              margin: { l: 80, r: 20, t: 40, b: 40 },
              height: Math.max(200, sorted[selected].events.length * 30 + 100)
            })}
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
            <Plot
              key={isDark ? 'dark-leak-pressure' : 'light-leak-pressure'}
              data={[
                leakTrace.length && {
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Leak',
                  x: leakTrace.map(p => p.x),
                  y: leakTrace.map(p => p.y),
                  yaxis: 'y1',
                },
                pressureTrace.length && {
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Pressure',
                  x: pressureTrace.map(p => p.x),
                  y: pressureTrace.map(p => p.y),
                  yaxis: leakTrace.length ? 'y2' : 'y1',
                },
              ].filter(Boolean)}
              layout={applyChartTheme(isDark, {
                title: 'Leak/Pressure around Cluster',
                xaxis: { type: 'date', title: 'Time' },
                yaxis: { title: leakTrace.length ? 'Leak' : 'Pressure', side: 'left' },
                ...(leakTrace.length && pressureTrace.length
                  ? { yaxis2: { title: 'Pressure', overlaying: 'y', side: 'right' } }
                  : {}),
                margin: { l: 80, r: 20, t: 40, b: 40 },
                height: 300,
              })}
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
              <th style={{cursor:'pointer'}} onClick={() => setSortBy(s => ({ key:'durationSec', dir: s.key==='durationSec' && s.dir==='desc' ? 'asc' : 'desc' }))}>Duration (s)</th>
              <th style={{cursor:'pointer'}} onClick={() => setSortBy(s => ({ key:'count', dir: s.key==='count' && s.dir==='desc' ? 'asc' : 'desc' }))}>Count</th>
              <th style={{cursor:'pointer'}} onClick={() => setSortBy(s => ({ key:'severity', dir: s.key==='severity' && s.dir==='desc' ? 'asc' : 'desc' }))}>Severity</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((cl, i) => (
              <tr
                key={i}
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

