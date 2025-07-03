const { useState, useEffect } = React;

// Utility functions for data parsing and analysis
function parseDuration(s) {
  const [h, m, sec] = s.split(':').map(parseFloat);
  return (h || 0) * 3600 + (m || 0) * 60 + (sec || 0);
}

function summarizeUsage(data) {
  const totalNights = data.length;
  let sumSeconds = 0;
  let nightsLong = 0;
  data.forEach(r => {
    const secs = parseDuration(r['Total Time']);
    sumSeconds += secs;
    if (secs >= 4 * 3600) nightsLong++;
  });
  const nightsShort = totalNights - nightsLong;
  const avgHours = sumSeconds / totalNights / 3600;
  return { totalNights, avgHours, nightsLong, nightsShort };
}

function computeAHITrends(data) {
  const ahis = data.map(r => parseFloat(r['AHI'])).filter(v => !isNaN(v));
  const avgAHI = ahis.reduce((a, b) => a + b, 0) / ahis.length;
  const minAHI = Math.min(...ahis);
  const maxAHI = Math.max(...ahis);
  const nightsAHIover5 = ahis.filter(v => v > 5).length;
  const sorted = data.slice().sort((a, b) => new Date(a['Date']) - new Date(b['Date']));
  const first = sorted.slice(0, 30).map(r => parseFloat(r['AHI'])).filter(v => !isNaN(v));
  const last = sorted.slice(-30).map(r => parseFloat(r['AHI'])).filter(v => !isNaN(v));
  const first30AvgAHI = first.reduce((a, b) => a + b, 0) / first.length;
  const last30AvgAHI = last.reduce((a, b) => a + b, 0) / last.length;
  return { avgAHI, minAHI, maxAHI, nightsAHIover5, first30AvgAHI, last30AvgAHI };
}

function computeEPAPTrends(data) {
  const sorted = data.slice().sort((a, b) => new Date(a['Date']) - new Date(b['Date']));
  const first30 = sorted.slice(0, 30);
  const last30 = sorted.slice(-30);
  const epapFirst = first30.map(r => parseFloat(r['Median EPAP'])).filter(v => !isNaN(v));
  const epapLast = last30.map(r => parseFloat(r['Median EPAP'])).filter(v => !isNaN(v));
  const avgMedianEPAPFirst30 = epapFirst.reduce((a, b) => a + b, 0) / epapFirst.length;
  const avgMedianEPAPLast30 = epapLast.reduce((a, b) => a + b, 0) / epapLast.length;
  const lowGroup = data
    .filter(r => parseFloat(r['Median EPAP']) < 7)
    .map(r => parseFloat(r['AHI']))
    .filter(v => !isNaN(v));
  const highGroup = data
    .filter(r => parseFloat(r['Median EPAP']) >= 7)
    .map(r => parseFloat(r['AHI']))
    .filter(v => !isNaN(v));
  const countLow = lowGroup.length;
  const countHigh = highGroup.length;
  const avgAHILow = lowGroup.reduce((a, b) => a + b, 0) / (countLow || 1);
  const avgAHIHigh = highGroup.reduce((a, b) => a + b, 0) / (countHigh || 1);
  return { avgMedianEPAPFirst30, avgMedianEPAPLast30, countLow, avgAHILow, countHigh, avgAHIHigh };
}

// Constants for apnea clustering and false negative detection
// max gap (seconds) between apnea annotation events to cluster (including FLG bridges)
const APOEA_CLUSTER_GAP_SEC = 120;
// flow-limit threshold (fraction of max) for FLG edge detection and false-negative detection
const FLG_THRESHOLD = 0.1;
const FLG_CLUSTER_GAP_SEC = 60; // max gap (seconds) to group FLG events into clusters
const FLG_DURATION_THRESHOLD_SEC = 10; // min FLG cluster duration for false negative (seconds)
// Flow-limit threshold (fraction of max) for bridging and edge-detection of low-flow periods
// Edge threshold (flow-limit) for cluster boundary extension (tune for early/late edges)
// Flow-limit threshold for cluster boundary extension (use high FLG to detect true low-flow edges)
// use same FLG threshold for edge-based cluster boundary extension and FLG bridge gap
const FLG_EDGE_THRESHOLD = FLG_THRESHOLD;
const FLG_BRIDGE_GAP_SEC = FLG_CLUSTER_GAP_SEC;

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
function clusterApneaEvents(
  events,
  flgEvents,
  gapSec = APOEA_CLUSTER_GAP_SEC,
  flgThreshold = FLG_EDGE_THRESHOLD,
  bridgeSec = FLG_BRIDGE_GAP_SEC
) {
  if (!events.length) return [];
  // Pre-filter and sort only high-level FLG events for bridging/extension
  const flgHigh = flgEvents
    .filter(f => f.level >= flgThreshold)
    .sort((a, b) => a.date - b.date);
  // cluster contiguous high-FLG events into blocks
  const flgClusters = [];
  if (flgHigh.length) {
    let vc = [flgHigh[0]];
    for (let j = 1; j < flgHigh.length; j++) {
      const prev = flgHigh[j - 1], curr = flgHigh[j];
      if ((curr.date - prev.date) / 1000 <= bridgeSec) vc.push(curr);
      else { flgClusters.push(vc); vc = [curr]; }
    }
    flgClusters.push(vc);
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
    // allow annotation events to be bridged by nearby high FLG (flow-limit) readings
    const flgBridge = gap <= bridgeSec && flgHigh.some(f => f.date >= prevEnd && f.date <= evt.date);
    if (gap <= gapSec || flgBridge) {
      current.push(evt);
    } else {
      rawGroups.push(current);
      current = [evt];
    }
  }
  if (current.length) rawGroups.push(current);
  // Map to clusters and extend boundaries using filtered FLG events
  return rawGroups.map(group => {
    let start = group[0].date;
    const lastEvt = group[group.length - 1];
    let end = new Date(lastEvt.date.getTime() + lastEvt.durationSec * 1000);
    const count = group.length;
    // extend boundaries by FLG clusters intersecting near start/end
    const beforeBlock = flgClusters.find(
      cl => cl[cl.length - 1].date <= start && (start - cl[cl.length - 1].date) / 1000 <= gapSec
    );
    if (beforeBlock) {
      start = beforeBlock[0].date;
    }
    const afterBlock = flgClusters.find(
      cl => cl[0].date >= end && (cl[0].date - end) / 1000 <= gapSec
    );
    if (afterBlock) {
      end = afterBlock[afterBlock.length - 1].date;
    }
    return { start, end, durationSec: (end - start) / 1000, count };
  });
}

/**
 * Detect potential false negatives by clustering high flow-limit events (FLG) without apnea events.
 * Details data must include DateTime, Event ('FLG', 'ClearAirway', 'Obstructive'), and Data/Duration for FLG level.
 */
function detectFalseNegatives(details, flThreshold = FLG_THRESHOLD) {
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
    .filter(cl => cl.durationSec >= FLG_DURATION_THRESHOLD_SEC)
    .filter(cl => {
      // no obstructive/central events within cluster window
      return !details.some(r => {
        const t = new Date(r['DateTime']);
        return (r['Event'] === 'ClearAirway' || r['Event'] === 'Obstructive') && t >= cl.start && t <= cl.end;
      });
    });
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

  const handleFile = (setter, setLoading, setProgress, setProgressMax) => e => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setProgress(0);
    setProgressMax(file.size);
    const rows = [];
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      chunkSize: 1024 * 1024,
      chunk: results => {
        setProgress(results.meta.cursor);
        rows.push(...results.data);
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
      setDetailsProgressMax
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
          <tr><td>Nights ≥ 4 h usage</td><td>{usage.nightsLong} ({(usage.nightsLong/usage.totalNights*100).toFixed(1)}%)</td></tr>
          <tr><td>Nights &lt; 4 h usage</td><td>{usage.nightsShort} ({(usage.nightsShort/usage.totalNights*100).toFixed(1)}%)</td></tr>
        </tbody>
      </table>
      <h2>2. AHI Trends</h2>
      <table>
        <tbody>
          <tr><td>Average AHI</td><td>{ahi.avgAHI.toFixed(2)} events/hour</td></tr>
          <tr><td>Min AHI</td><td>{ahi.minAHI.toFixed(2)}</td></tr>
          <tr><td>Max AHI</td><td>{ahi.maxAHI.toFixed(2)}</td></tr>
          <tr><td>Nights with AHI &gt; 5.0</td><td>{ahi.nightsAHIover5} ({(ahi.nightsAHIover5/usage.totalNights*100).toFixed(1)}%)</td></tr>
        </tbody>
      </table>
      <p>First 30 nights avg AHI = {ahi.first30AvgAHI.toFixed(2)}, last 30 nights avg AHI = {ahi.last30AvgAHI.toFixed(2)}</p>
      <h2>3. Pressure Settings and Performance</h2>
      <table>
        <tbody>
          <tr><td>Avg median EPAP (first 30 nights)</td><td>{epap.avgMedianEPAPFirst30.toFixed(2)} cmH₂O</td></tr>
          <tr><td>Avg median EPAP (last 30 nights)</td><td>{epap.avgMedianEPAPLast30.toFixed(2)} cmH₂O</td></tr>
        </tbody>
      </table>
      <table>
        <thead><tr><th>EPAP group</th><th>Nights</th><th>Avg AHI</th></tr></thead>
        <tbody>
          <tr><td>EPAP &lt; 7 cmH₂O</td><td>{epap.countLow}</td><td>{epap.avgAHILow.toFixed(2)}</td></tr>
          <tr><td>EPAP ≥ 7 cmH₂O</td><td>{epap.countHigh}</td><td>{epap.avgAHIHigh.toFixed(2)}</td></tr>
        </tbody>
      </table>
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

  useEffect(() => {
    if (detailsData) {
      // cluster OA/CA apnea events
      // Only central (ClearAirway), obstructive and mixed apnea annotations for clustering
      const apneaEvents = detailsData
        .filter(r => ['ClearAirway', 'Obstructive', 'Mixed'].includes(r['Event']))
        .map(r => ({ date: new Date(r['DateTime']), durationSec: parseFloat(r['Data/Duration']) }));
      const flgEvents = detailsData
        .filter(r => r['Event'] === 'FLG')
        .map(r => ({ date: new Date(r['DateTime']), level: parseFloat(r['Data/Duration']) }));
      // cluster annotations and extend boundaries by nearby FLG events, then filter singletons
      const rawClusters = clusterApneaEvents(apneaEvents, flgEvents);
      // retain only clusters with three or more apnea events
      setApneaClusters(rawClusters.filter(cl => cl.count >= 3));
      // detect potential false negatives via flow-limit events
      setFalseNegatives(detectFalseNegatives(detailsData));
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
        {loadingDetails && (
          <progress value={detailsProgress} max={detailsProgressMax} />
        )}
      </div>
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

ReactDOM.render(<App />, document.getElementById('root'));
