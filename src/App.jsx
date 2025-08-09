import React, { useState, useEffect } from 'react';
import { usePrefersDarkMode } from './hooks/usePrefersDarkMode';
import Papa from 'papaparse';
import { parseDuration, quantile, summarizeUsage, computeAHITrends, computeEPAPTrends } from './utils/stats';
import {
  clusterApneaEvents,
  detectFalseNegatives,
  FALSE_NEG_CONFIDENCE_MIN,
  FLG_BRIDGE_THRESHOLD,
  APOEA_CLUSTER_MIN_TOTAL_SEC,
  MAX_CLUSTER_DURATION_SEC,
  APNEA_GAP_DEFAULT,
  FLG_CLUSTER_GAP_DEFAULT,
  computeClusterSeverity,
  clustersToCsv,
} from './utils/clustering';
import Overview from './components/Overview';
import UsagePatternsCharts from './components/UsagePatternsCharts';
import AhiTrendsCharts from './components/AhiTrendsCharts';
import EpapTrendsCharts from './components/EpapTrendsCharts';
import ApneaEventStats from './components/ApneaEventStats';
import Plot from 'react-plotly.js';


// Hook for loading CSV files via file input
function useCsvFiles() {
  const [summaryData, setSummaryData] = useState(null);
  const [detailsData, setDetailsData] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryProgress, setSummaryProgress] = useState(0);
  const [summaryProgressMax, setSummaryProgressMax] = useState(0);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsProgress, setDetailsProgress] = useState(0);
  const [detailsProgressMax, setDetailsProgressMax] = useState(0);

  /**
   * Generic CSV loader with optional event filtering.
   * @param {Function} setter - state setter for parsed rows
   * @param {Function} setLoading - state setter for loading flag
   * @param {Function} setProgress - state setter for progress cursor
   * @param {Function} setProgressMax - state setter for progress max
   * @param {boolean} filterEvents - if true, only retain ClearAirway, Obstructive, Mixed, FLG rows
   */
  const handleFile = (
    setter,
    setLoading,
    setProgress,
    setProgressMax,
    filterEvents = false
  ) => e => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setProgress(0);
    setProgressMax(file.size);
    const rows = [];
    Papa.parse(file, {
      worker: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      chunkSize: 1024 * 1024,
      chunk: results => {
        setProgress(results.meta.cursor);
      if (filterEvents) {
        // retain only apnea annotations and sufficiently high-FLG events
        const keep = results.data.filter(r => {
          const e = r['Event'];
          if (e === 'FLG') return r['Data/Duration'] >= FLG_BRIDGE_THRESHOLD;
          return ['ClearAirway', 'Obstructive', 'Mixed'].includes(e);
        });
        rows.push(...keep);
      } else {
        rows.push(...results.data);
      }
      },
      complete: () => {
        setter(rows);
        setLoading(false);
      },
    });
  };

  return {
    summaryData,
    detailsData,
    loadingSummary,
    summaryProgress,
    summaryProgressMax,
    loadingDetails,
    detailsProgress,
    detailsProgressMax,
    onSummaryFile: handleFile(
      setSummaryData,
      setLoadingSummary,
      setSummaryProgress,
      setSummaryProgressMax
    ),
    onDetailsFile: handleFile(
      setDetailsData,
      setLoadingDetails,
      setDetailsProgress,
      setDetailsProgressMax,
      true /* filter to only apnea & FLG events */
    ),
  };
}

function SummaryAnalysis({ data, clusters = [] }) {
  const usage = summarizeUsage(data);
  const ahi = computeAHITrends(data);
  const epap = computeEPAPTrends(data);
  return (
    <div>
      <h2 id="usage-patterns">1. Usage Patterns</h2>
      <table>
        <tbody>
          <tr><td>Total nights analyzed</td><td>{usage.totalNights}</td></tr>
          <tr><td>Average usage per night</td><td>{usage.avgHours.toFixed(2)} hours</td></tr>
          <tr><td>Nights ≥ 4 h usage</td><td>{usage.nightsLong} ({(usage.nightsLong / usage.totalNights * 100).toFixed(1)}%)</td></tr>
          <tr><td>Nights &lt; 4 h usage</td><td>{usage.nightsShort} ({(usage.nightsShort / usage.totalNights * 100).toFixed(1)}%)</td></tr>
        </tbody>
      </table>
      <table>
        <tbody>
          <tr><td>Median usage per night</td><td>{usage.medianHours.toFixed(2)} hours</td></tr>
          <tr><td>Usage IQR (25th–75th percentile)</td><td>{usage.p25Hours.toFixed(2)}–{usage.p75Hours.toFixed(2)} hours</td></tr>
          <tr><td>Min / Max usage</td><td>{usage.minHours.toFixed(2)} / {usage.maxHours.toFixed(2)} hours</td></tr>
          <tr><td>Outlier nights (≤ Q1−1.5×IQR)</td><td>{usage.outlierLowCount} nights</td></tr>
          <tr><td>Outlier nights (≥ Q3+1.5×IQR)</td><td>{usage.outlierHighCount} nights</td></tr>
        </tbody>
      </table>
      <ul>
        <li>Usage distributions highlight variability and potential adherence issues.</li>
      </ul>
      <UsagePatternsCharts data={data} />

      <h2 id="ahi-trends">2. AHI Trends</h2>
      <table>
        <tbody>
          <tr><td>Average AHI</td><td>{ahi.avgAHI.toFixed(2)} events/hour</td></tr>
          <tr><td>Median AHI</td><td>{ahi.medianAHI.toFixed(2)} events/hour</td></tr>
          <tr><td>AHI IQR (25th–75th percentile)</td><td>{ahi.p25AHI.toFixed(2)}–{ahi.p75AHI.toFixed(2)}</td></tr>
          <tr><td>Min AHI</td><td>{ahi.minAHI.toFixed(2)}</td></tr>
          <tr><td>Max AHI</td><td>{ahi.maxAHI.toFixed(2)}</td></tr>
          <tr><td>Nights with AHI &gt; 5.0</td><td>{ahi.nightsAHIover5} ({(ahi.nightsAHIover5 / usage.totalNights * 100).toFixed(1)}%)</td></tr>
        </tbody>
      </table>
      <p>First 30 nights avg AHI = {ahi.first30AvgAHI.toFixed(2)}, last 30 nights avg AHI = {ahi.last30AvgAHI.toFixed(2)}</p>
      <ul>
        <li>Outlier nights (AHI ≥ Q3+1.5×IQR): {ahi.ahis.filter(v => v >= (ahi.p75AHI + 1.5 * ahi.iqrAHI)).length}</li>
      </ul>
      <AhiTrendsCharts data={data} clusters={clusters} />

      <h2 id="pressure-settings">3. Pressure Settings and Performance</h2>
      <h3 id="epap-distribution">3.1 EPAP Distribution & Percentiles</h3>
      <table>
        <tbody>
          <tr><td>Median EPAP</td><td>{epap.medianEPAP.toFixed(2)} cmH₂O</td></tr>
          <tr><td>EPAP IQR (25th–75th percentile)</td><td>{epap.p25EPAP.toFixed(2)}–{epap.p75EPAP.toFixed(2)} cmH₂O</td></tr>
          <tr><td>Min / Max EPAP</td><td>{epap.minEPAP.toFixed(2)} / {epap.maxEPAP.toFixed(2)} cmH₂O</td></tr>
        </tbody>
      </table>
      <ul>
        <li>Distribution summary of nightly median EPAP settings.</li>
      </ul>
      {/* EPAP distribution, trend, and correlation charts */}

      <h3 id="epap-trend">3.2 EPAP Trend (First vs Last 30 nights)</h3>
      <table>
        <tbody>
          <tr><td>Avg median EPAP (first 30 nights)</td><td>{epap.avgMedianEPAPFirst30.toFixed(2)} cmH₂O</td></tr>
          <tr><td>Avg median EPAP (last 30 nights)</td><td>{epap.avgMedianEPAPLast30.toFixed(2)} cmH₂O</td></tr>
        </tbody>
      </table>

      <h3 id="epap-correlation">3.3 EPAP vs AHI & Correlation</h3>
      <table>
        <thead><tr><th>EPAP group</th><th>Nights</th><th>Avg AHI</th></tr></thead>
        <tbody>
          <tr><td>EPAP &lt; 7 cmH₂O</td><td>{epap.countLow}</td><td>{epap.avgAHILow.toFixed(2)}</td></tr>
          <tr><td>EPAP ≥ 7 cmH₂O</td><td>{epap.countHigh}</td><td>{epap.avgAHIHigh.toFixed(2)}</td></tr>
        </tbody>
      </table>
      <p>Correlation between nightly median EPAP and AHI: r = {epap.corrEPAPAHI.toFixed(2)}</p>
      <EpapTrendsCharts data={data} />
    </div>
  );
}

function ApneaClusterAnalysis({
  clusters,
  params,
  onParamChange,
}) {
  const [selected, setSelected] = useState(null);
  const [sortBy, setSortBy] = useState({ key: 'severity', dir: 'desc' });
  const isDark = usePrefersDarkMode();
  const sorted = [...clusters].sort((a, b) => {
    const dir = sortBy.dir === 'asc' ? 1 : -1;
    const va = a[sortBy.key] ?? 0;
    const vb = b[sortBy.key] ?? 0;
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });

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
      <h2 id="clustered-apnea">Clustered Apnea Events</h2>

      <div className="controls" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'end' }}>
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
          <button onClick={handleExport}>Export CSV</button>
        </div>
      </div>

      {selected !== null && sorted[selected] && (
        <div>
          <h3>Event-level Timeline for Cluster #{selected + 1}</h3>
            <Plot
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
            layout={{
              template: isDark ? 'plotly_dark' : 'plotly',
              title: `Cluster #${selected + 1} Event Timeline`,
              xaxis: { type: 'date', title: 'Event Start Time' },
              yaxis: { title: 'Event #' },
              margin: { l: 80, r: 20, t: 40, b: 40 },
              height: Math.max(200, sorted[selected].events.length * 30 + 100)
            }}
            config={{ displayModeBar: false }}
          />
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
                style={{ cursor: 'pointer', backgroundColor: selected === i ? '#f0f8ff' : undefined }}
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

function FalseNegativesAnalysis({ list }) {
  const prefersDark = usePrefersDarkMode();
  return (
    <div>
      <h2 id="false-negatives">Potential False Negatives</h2>
      <div>
        <h3>False Negative Clusters by Confidence Over Time</h3>
        <Plot
          useResizeHandler
          style={{ width: '100%', height: '400px' }}
          data={[{
            type: 'scatter',
            mode: 'markers',
            x: list.map(cl => cl.start),
            y: list.map(cl => cl.confidence * 100),
            marker: {
              size: list.map(cl => Math.max(6, Math.min(20, Math.sqrt(cl.durationSec) * 5))),
              color: list.map(cl => cl.confidence * 100),
              colorscale: 'Viridis',
              showscale: true,
              colorbar: { title: 'Confidence (%)' }
            },
            text: list.map(cl =>
              `Start: ${cl.start.toLocaleString()}<br>Duration: ${cl.durationSec.toFixed(0)} s<br>Confidence: ${(cl.confidence * 100).toFixed(0)}%`
            ),
            hovertemplate: '%{text}<extra></extra>'
          }]}
          layout={{
            template: prefersDark ? 'plotly_dark' : 'plotly',
            autosize: true,
            title: 'False Negative Clusters by Confidence Over Time',
            xaxis: { type: 'date', title: 'Cluster Start Time' },
            yaxis: { title: 'Confidence (%)', range: [FALSE_NEG_CONFIDENCE_MIN * 100, 100] },
            margin: { l: 80, r: 20, t: 40, b: 40 },
            height: 400
          }}
          config={{ responsive: true, displaylogo: false }}
        />
      </div>
      <div className="cluster-table-container">
        <table>
          <thead>
            <tr><th>#</th><th>Start</th><th>Duration (s)</th><th>Confidence</th></tr>
          </thead>
          <tbody>
            {list.map((cl, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{cl.start.toLocaleString()}</td>
                <td>{cl.durationSec.toFixed(0)}</td>
                <td>{(cl.confidence * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function App() {
  const prefersDark = usePrefersDarkMode();
  const {
    summaryData,
    detailsData,
    loadingSummary,
    summaryProgress,
    summaryProgressMax,
    loadingDetails,
    detailsProgress,
    detailsProgressMax,
    onSummaryFile,
    onDetailsFile,
  } = useCsvFiles();
  const [apneaClusters, setApneaClusters] = useState([]);
  const [falseNegatives, setFalseNegatives] = useState([]);
  const [processingDetails, setProcessingDetails] = useState(false);
  const [clusterParams, setClusterParams] = useState({
    gapSec: APNEA_GAP_DEFAULT,
    bridgeThreshold: FLG_BRIDGE_THRESHOLD,
    bridgeSec: FLG_CLUSTER_GAP_DEFAULT,
    minCount: 3,
    minTotalSec: APOEA_CLUSTER_MIN_TOTAL_SEC,
    maxClusterSec: MAX_CLUSTER_DURATION_SEC,
  });

  const onClusterParamChange = (patch) => {
    setClusterParams(prev => ({ ...prev, ...patch }));
  };

  useEffect(() => {
  if (detailsData) {
    // begin processing phase
    setProcessingDetails(true);
    // defer clustering/detection to next tick so UI can update (e.g., hide parse progress)
    const timer = setTimeout(() => {
      // cluster OA/CA apnea annotation events
      const apneaEvents = detailsData
        .filter(r => ['ClearAirway', 'Obstructive', 'Mixed'].includes(r['Event']))
        .map(r => ({ date: new Date(r['DateTime']), durationSec: parseFloat(r['Data/Duration']) }));
      const flgEvents = detailsData
        .filter(r => r['Event'] === 'FLG')
        .map(r => ({ date: new Date(r['DateTime']), level: parseFloat(r['Data/Duration']) }));
      const rawClusters = clusterApneaEvents(
        apneaEvents,
        flgEvents,
        clusterParams.gapSec,
        clusterParams.bridgeThreshold,
        clusterParams.bridgeSec
      );
      const validClusters = rawClusters
        .filter(cl => cl.count >= clusterParams.minCount)
        .filter(cl => cl.events.reduce((sum, e) => sum + e.durationSec, 0) >= clusterParams.minTotalSec)
        .filter(cl => cl.durationSec <= clusterParams.maxClusterSec)
        .map(cl => ({ ...cl, severity: computeClusterSeverity(cl) }));
      setApneaClusters(validClusters);
      // detect potential false negatives via flow-limit events
      setFalseNegatives(detectFalseNegatives(detailsData));
      // end processing phase after clustering/detection
      setProcessingDetails(false);
    }, 0);
    return () => {
      clearTimeout(timer);
      setProcessingDetails(false);
    };
  }
  }, [detailsData, clusterParams]);

  return (
    <div className="container">
      <h1>OSCAR Sleep Data Analysis</h1>
      <nav className="toc">
        <a href="#overview">Overview</a>
        <a href="#usage-patterns">Usage Patterns</a>
        <a href="#ahi-trends">AHI Trends</a>
        <a href="#pressure-settings">Pressure Settings</a>
        <a href="#apnea-characteristics">Apnea Events</a>
        <a href="#clustered-apnea">Clusters</a>
        <a href="#false-negatives">False Negatives</a>
      </nav>
      <div className="section controls">
        <label>
          Summary CSV: <input type="file" accept=".csv" onChange={onSummaryFile} />
        </label>
        {loadingSummary && (
          <progress value={summaryProgress} max={summaryProgressMax} />
        )}
        <label>
          Details CSV: <input type="file" accept=".csv" onChange={onDetailsFile} />
        </label>
        {(loadingDetails || processingDetails) && (
          <progress
            value={loadingDetails ? detailsProgress : undefined}
            max={loadingDetails ? detailsProgressMax : undefined}
          />
        )}
      </div>
      {summaryData && detailsData && (
        <div className="section">
          <Overview
            summaryData={summaryData}
            clusters={apneaClusters}
            falseNegatives={falseNegatives}
          />
        </div>
      )}
      {summaryData && (
        <div className="section">
          <SummaryAnalysis data={summaryData} clusters={apneaClusters} />
        </div>
      )}
      {detailsData && (
        <>
          <div className="section">
            <ApneaEventStats data={detailsData} />
          </div>
          <div className="section">
            <ApneaClusterAnalysis
              clusters={apneaClusters}
              params={clusterParams}
              onParamChange={onClusterParamChange}
            />
          </div>
          <div className="section">
            <FalseNegativesAnalysis list={falseNegatives} />
          </div>
        </>
      )}
    </div>
  );
}

export default App;
