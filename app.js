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
const APOEA_CLUSTER_GAP_SEC = 10;
const FLG_THRESHOLD = 0.9; // flow-limit threshold (fraction of max)
const FLG_CLUSTER_GAP_SEC = 60; // max gap to group FLG events (seconds)
const FLG_DURATION_THRESHOLD_SEC = 10; // min FLG cluster duration for false negative (seconds)

/**
 * Cluster Obstructive (OA) and Central (CA/ClearAirway) events close in time.
 * Each event must have {date: Date, durationSec: number}.
 */
function clusterApneaEvents(events, gapSec = APOEA_CLUSTER_GAP_SEC) {
  if (!events.length) return [];
  const sorted = events.slice().sort((a, b) => a.date - b.date);
  const clusters = [];
  let current = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const evt = sorted[i];
    const prev = current[current.length - 1];
    const prevEnd = new Date(prev.date.getTime() + prev.durationSec * 1000);
    if ((evt.date - prevEnd) / 1000 <= gapSec) {
      current.push(evt);
    } else {
      clusters.push(current);
      current = [evt];
    }
  }
  if (current.length) clusters.push(current);
  return clusters.map(cl => {
    const start = cl[0].date;
    const endEvt = cl[cl.length - 1];
    const end = new Date(endEvt.date.getTime() + endEvt.durationSec * 1000);
    const durationSec = (end - start) / 1000;
    return { start, end, durationSec, count: cl.length };
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
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      chunkSize: 1024 * 1024,
      chunk: results => {
        setProgress(results.meta.cursor);
      },
      complete: res => {
        setter(res.data);
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
      const apneaEvents = detailsData
        .filter(r => r['Event'] === 'ClearAirway' || r['Event'] === 'Obstructive')
        .map(r => ({ date: new Date(r['DateTime']), durationSec: parseFloat(r['Data/Duration']) }));
      // only clusters with more than one apnea event
      const rawClusters = clusterApneaEvents(apneaEvents);
      setApneaClusters(rawClusters.filter(cl => cl.count > 1));
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
