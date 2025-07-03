import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { parseDuration, quantile, summarizeUsage, computeAHITrends, computeEPAPTrends } from './utils/stats';
import Overview from './components/Overview';

// Constants for apnea clustering and false negative detection
// gaps and thresholds for apnea clustering
const APOEA_CLUSTER_GAP_SEC = 120;        // max gap (sec) between annotation events to cluster
const FLG_BRIDGE_THRESHOLD = 0.1;          // FLG level to bridge annotation events (low threshold)
const FLG_CLUSTER_GAP_SEC = 60;            // max gap (sec) to group FLG readings into clusters
// thresholds for boundary extension via FLG edge clusters
const FLG_EDGE_THRESHOLD = 0.5;            // FLG level to detect true low-flow edges (high threshold)
const FLG_EDGE_MIN_DURATION_SEC = 10;      // min duration (sec) for FLG edge cluster to extend boundaries
// minimum total apnea-event duration (seconds) for a valid cluster
const APOEA_CLUSTER_MIN_TOTAL_SEC = 60;
// minimum total FLG-only cluster duration (seconds) for false-negative detection
const FLG_DURATION_THRESHOLD_SEC = APOEA_CLUSTER_MIN_TOTAL_SEC;
// minimum confidence (fraction) to record false negatives (e.g., 95% flow-limit)
const FALSE_NEG_CONFIDENCE_MIN = 0.95;
// maximum FLG-only cluster duration for false-negatives (cap long FLG clusters)
const MAX_FALSE_NEG_FLG_DURATION_SEC = 600;
// maximum apnea cluster window to sanity-check (seconds)
const MAX_CLUSTER_DURATION_SEC = 230;

/**
 * Cluster Obstructive (OA) and Central (CA/ClearAirway) events close in time.
 * Each event must have {date: Date, durationSec: number}.
 */
/**
 * Cluster Obstructive/Central (and related) apnea annotation events, then extend
 * each cluster's boundaries based on nearby flow-limit (FLG) events for true start/end.
 * @param {Array} events - annotation events with {date: Date, durationSec: number}
 * @param {Array} flgEvents - FLG events with {date: Date, level: number}
 * @param {number} gapSec - max gap between annotation events to group (seconds)
 * @param {number} flgThreshold - min FLG level to extend cluster boundaries
 * @returns Array of {start: Date, end: Date, durationSec: number, count: number}
 */
/**
 * Cluster apnea annotation events, optionally bridging through nearby high-FLG events,
 * then extend cluster boundaries based on FLG events.
 */
/**
 * Cluster apnea annotation events, bridging through moderate FLG readings,
 * then extend boundaries based on sustained, high-level FLG edge clusters.
 * @param {Array} events - annotation events with {date: Date, durationSec: number}
 * @param {Array} flgEvents - FLG events with {date: Date, level: number}
 * @param {number} gapSec - max gap between events to cluster (seconds)
 * @param {number} bridgeThreshold - FLG level threshold for bridging clusters
 * @param {number} bridgeSec - max gap for FLG-based bridging (seconds)
 * @returns Array of {start: Date, end: Date, durationSec: number, count, events}
 */
function clusterApneaEvents(
  events,
  flgEvents,
  gapSec = APOEA_CLUSTER_GAP_SEC,
  bridgeThreshold = FLG_BRIDGE_THRESHOLD,
  bridgeSec = FLG_CLUSTER_GAP_SEC
) {
  if (!events.length) return [];
  // FLG clusters for bridging annotation gaps (lower threshold)
  const flgBridgeHigh = flgEvents
    .filter(f => f.level >= bridgeThreshold)
    .sort((a, b) => a.date - b.date);
  const flgBridgeClusters = [];
  if (flgBridgeHigh.length) {
    let vc = [flgBridgeHigh[0]];
    for (let i = 1; i < flgBridgeHigh.length; i++) {
      const prev = flgBridgeHigh[i - 1], curr = flgBridgeHigh[i];
      if ((curr.date - prev.date) / 1000 <= bridgeSec) vc.push(curr);
      else { flgBridgeClusters.push(vc); vc = [curr]; }
    }
    flgBridgeClusters.push(vc);
  }
  // FLG clusters for boundary extension (higher threshold, min duration)
  const flgEdgeHigh = flgEvents
    .filter(f => f.level >= FLG_EDGE_THRESHOLD)
    .sort((a, b) => a.date - b.date);
  const flgEdgeClusters = [];
  if (flgEdgeHigh.length) {
    let vc = [flgEdgeHigh[0]];
    for (let i = 1; i < flgEdgeHigh.length; i++) {
      const prev = flgEdgeHigh[i - 1], curr = flgEdgeHigh[i];
      if ((curr.date - prev.date) / 1000 <= bridgeSec) vc.push(curr);
      else { flgEdgeClusters.push(vc); vc = [curr]; }
    }
    flgEdgeClusters.push(vc);
  }
  // Group annotation events by proximity and FLG bridges
  const sorted = events.slice().sort((a, b) => a.date - b.date);
  const rawGroups = [];
  let current = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const evt = sorted[i];
    const prev = current[current.length - 1];
    const prevEnd = new Date(prev.date.getTime() + prev.durationSec * 1000);
    const gap = (evt.date - prevEnd) / 1000;
    const flgBridge = gap <= bridgeSec && flgBridgeHigh.some(f => f.date >= prevEnd && f.date <= evt.date);
    if (gap <= gapSec || flgBridge) {
      current.push(evt);
    } else {
      rawGroups.push(current);
      current = [evt];
    }
  }
  if (current.length) rawGroups.push(current);
  // Map to clusters and extend boundaries using sustained FLG edge clusters
  return rawGroups.map(group => {
    let start = group[0].date;
    const lastEvt = group[group.length - 1];
    let end = new Date(lastEvt.date.getTime() + lastEvt.durationSec * 1000);
    const count = group.length;
    const validEdges = flgEdgeClusters.filter(cl =>
      (cl[cl.length - 1].date - cl[0].date) / 1000 >= FLG_EDGE_MIN_DURATION_SEC
    );
    const before = validEdges.find(cl =>
      cl[cl.length - 1].date <= start && (start - cl[cl.length - 1].date) / 1000 <= gapSec
    );
    if (before) start = before[0].date;
    const after = validEdges.find(cl =>
      cl[0].date >= end && (cl[0].date - end) / 1000 <= gapSec
    );
    if (after) end = after[after.length - 1].date;
    return { start, end, durationSec: (end - start) / 1000, count, events: group };
  });
}

/**
 * Detect potential false negatives by clustering high flow-limit events (FLG) without apnea events.
 * Details data must include DateTime, Event ('FLG', 'ClearAirway', 'Obstructive'), and Data/Duration for FLG level.
 */
function detectFalseNegatives(details, flThreshold = FLG_BRIDGE_THRESHOLD) {
  const flEvents = details
    .filter(r => r['Event'] === 'FLG' && r['Data/Duration'] >= flThreshold)
    .map(r => ({ date: new Date(r['DateTime']), level: r['Data/Duration'] }));
  // cluster flow-limit events by time gap
  const clusters = [];
  let current = [];
  flEvents.sort((a, b) => a.date - b.date).forEach(evt => {
    if (!current.length) {
      current.push(evt);
    } else {
      const prev = current[current.length - 1];
      if ((evt.date - prev.date) / 1000 <= FLG_CLUSTER_GAP_SEC) {
        current.push(evt);
      } else {
        clusters.push(current);
        current = [evt];
      }
    }
  });
  if (current.length) clusters.push(current);
  // filter clusters by duration and absence of apnea events
  return clusters
    .map(cl => {
      const start = cl[0].date;
      const end = cl[cl.length - 1].date;
      const durationSec = (end - start) / 1000;
      const confidence = Math.max(...cl.map(e => e.level));
      return { start, end, durationSec, confidence };
    })
    .filter(cl => cl.durationSec >= FLG_DURATION_THRESHOLD_SEC && cl.durationSec <= MAX_FALSE_NEG_FLG_DURATION_SEC)
    .filter(cl => {
      // no known apnea events within expanded window
      return !details.some(r => {
        const t = new Date(r['DateTime']).getTime();
        return ['ClearAirway', 'Obstructive', 'Mixed'].includes(r['Event']) &&
               t >= (cl.start.getTime() - 5000) && t <= (cl.end.getTime() + 5000);
      });
    })
    // drop low-confidence FLG clusters (require ≥95% flow-limit for false-negative reporting)
    .filter(cl => cl.confidence >= FALSE_NEG_CONFIDENCE_MIN);
}

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

function SummaryAnalysis({ data }) {
  const usage = summarizeUsage(data);
  const ahi = computeAHITrends(data);
  const epap = computeEPAPTrends(data);
  return (
    <div>
      <h2>1. Usage Patterns</h2>
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
      {/* TODO: Integrate histogram and time-series visualizations for usage patterns */}

      <h2>2. AHI Trends</h2>
      <table>
        <tbody>
          <tr><td>Average AHI</td><td>{ahi.avgAHI.toFixed(2)} events/hour</td></tr>
          <tr><td>Median AHI</td><td>{ahi.medianAHI.toFixed(2)} events/hour</td></tr>
          <tr><td>AHI IQR (25th–75th percentile)</td><td>{ahi.p25AHI.toFixed(2)}–{ahi.p75AHI.toFixed(2)}</td></tr>
          <tr><td>Min AHI</td><td>{ahi.minAHI.toFixed(2)}</td></tr>
          <tr><td>Max AHI</td><td>{ahi.maxAHI.toFixed(2)}</td></tr>
          <tr><td>Nights with AHI > 5.0</td><td>{ahi.nightsAHIover5} ({(ahi.nightsAHIover5 / usage.totalNights * 100).toFixed(1)}%)</td></tr>
        </tbody>
      </table>
      <p>First 30 nights avg AHI = {ahi.first30AvgAHI.toFixed(2)}, last 30 nights avg AHI = {ahi.last30AvgAHI.toFixed(2)}</p>
      <ul>
        <li>Outlier nights (AHI ≥ Q3+1.5×IQR): {ahi.ahis.filter(v => v >= (ahi.p75AHI + 1.5 * ahi.iqrAHI)).length}</li>
      </ul>
      {/* TODO: Integrate histogram and trend-plot visualizations for AHI */}

      <h2>3. Pressure Settings and Performance</h2>
      <h3>3.1 EPAP Distribution & Percentiles</h3>
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
      {/* TODO: Integrate EPAP distribution boxplot */}

      <h3>3.2 EPAP Trend (First vs Last 30 nights)</h3>
      <table>
        <tbody>
          <tr><td>Avg median EPAP (first 30 nights)</td><td>{epap.avgMedianEPAPFirst30.toFixed(2)} cmH₂O</td></tr>
          <tr><td>Avg median EPAP (last 30 nights)</td><td>{epap.avgMedianEPAPLast30.toFixed(2)} cmH₂O</td></tr>
        </tbody>
      </table>
      {/* TODO: Integrate EPAP time-series trend */}

      <h3>3.3 EPAP vs AHI & Correlation</h3>
      <table>
        <thead><tr><th>EPAP group</th><th>Nights</th><th>Avg AHI</th></tr></thead>
        <tbody>
          <tr><td>EPAP &lt; 7 cmH₂O</td><td>{epap.countLow}</td><td>{epap.avgAHILow.toFixed(2)}</td></tr>
          <tr><td>EPAP ≥ 7 cmH₂O</td><td>{epap.countHigh}</td><td>{epap.avgAHIHigh.toFixed(2)}</td></tr>
        </tbody>
      </table>
      <p>Correlation between nightly median EPAP and AHI: r = {epap.corrEPAPAHI.toFixed(2)}</p>
      {/* TODO: Integrate scatter plot of EPAP vs AHI */}
    </div>
  );
}

function ApneaClusterAnalysis({ clusters }) {
  return (
    <div>
      <h2>Clustered Apnea Events</h2>
      <table>
        <thead>
          <tr><th>#</th><th>Start</th><th>Duration (s)</th><th>Count</th></tr>
        </thead>
        <tbody>
          {clusters.map((cl, i) => (
            <tr key={i}>
              <td>{i+1}</td>
              <td>{cl.start.toLocaleString()}</td>
              <td>{cl.durationSec.toFixed(0)}</td>
              <td>{cl.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FalseNegativesAnalysis({ list }) {
  return (
    <div>
      <h2>Potential False Negatives</h2>
      <table>
        <thead>
          <tr><th>#</th><th>Start</th><th>Duration (s)</th><th>Confidence</th></tr>
        </thead>
        <tbody>
          {list.map((cl, i) => (
            <tr key={i}>
              <td>{i+1}</td>
              <td>{cl.start.toLocaleString()}</td>
              <td>{cl.durationSec.toFixed(0)}</td>
              <td>{(cl.confidence * 100).toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


function App() {
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
      const rawClusters = clusterApneaEvents(apneaEvents, flgEvents);
      const validClusters = rawClusters.filter(
        cl => cl.count >= 3 &&
              cl.events.reduce((sum, e) => sum + e.durationSec, 0) >= APOEA_CLUSTER_MIN_TOTAL_SEC &&
              cl.durationSec <= MAX_CLUSTER_DURATION_SEC
      );
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
  }, [detailsData]);

  return (
    <div className="container">
      <h1>OSCAR Sleep Data Analysis</h1>
      <div className="controls">
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
        <Overview
          summaryData={summaryData}
          clusters={apneaClusters}
          falseNegatives={falseNegatives}
        />
      )}
      {summaryData && <SummaryAnalysis data={summaryData} />}
      {detailsData && (
        <>
          <ApneaClusterAnalysis clusters={apneaClusters} />
          <FalseNegativesAnalysis list={falseNegatives} />
        </>
      )}
    </div>
  );
}

export default App;
