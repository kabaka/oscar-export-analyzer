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

function clusterEvents(events, thresholdSec = 60) {
  const sorted = events.slice().sort((a, b) => a.date - b.date);
  const clusters = [];
  let current = [];
  sorted.forEach(evt => {
    if (current.length === 0) {
      current.push(evt);
    } else {
      const prev = current[current.length - 1];
      if ((evt.date - prev.date) / 1000 <= thresholdSec) {
        current.push(evt);
      } else {
        clusters.push(current);
        current = [evt];
      }
    }
  });
  if (current.length) clusters.push(current);
  return clusters;
}

function findFalseNegatives(clusters) {
  return clusters.filter(cl => {
    const hasFLG = cl.some(e => e.event === 'FLG');
    const hasAnno = cl.some(e => !['Pressure', 'EPAP', 'FLG'].includes(e.event));
    return hasFLG && !hasAnno;
  });
}

function findConcerningEvents(clusters, topN = 10) {
  const evts = clusters.map(cl => {
    const start = cl[0].date;
    const end = cl[cl.length - 1].date;
    const durationSec = (end - start) / 1000;
    return { events: cl, durationSec };
  });
  return evts.sort((a, b) => b.durationSec - a.durationSec).slice(0, topN);
}

// Hook for loading CSV files via file input
function useCsvFiles() {
  const [summaryData, setSummaryData] = useState(null);
  const [detailsData, setDetailsData] = useState(null);

  const handleFile = setter => e => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: res => setter(res.data),
    });
  };

  return { summaryData, detailsData, onSummaryFile: handleFile(setSummaryData), onDetailsFile: handleFile(setDetailsData) };
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

function ClusterAnalysis({ clusters }) {
  return (
    <div>
      <h2>Clustered Events</h2>
      <p>Total clusters: {clusters.length}</p>
      <table>
        <thead><tr><th>#</th><th>Events</th><th>Span (s)</th></tr></thead>
        <tbody>
          {clusters.map((cl, i) => {
            const span = (cl[cl.length - 1].date - cl[0].date) / 1000;
            return <tr key={i}><td>{i+1}</td><td>{cl.map(e=>e.event).join(', ')}</td><td>{span.toFixed(0)}</td></tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

function FalseNegativesAnalysis({ list }) {
  return (
    <div>
      <h2>False Negatives</h2>
      <p>Total false negatives: {list.length}</p>
      <table>
        <thead><tr><th>#</th><th>Events</th><th>Span (s)</th></tr></thead>
        <tbody>
          {list.map((cl, i) => {
            const span = (cl[cl.length - 1].date - cl[0].date) / 1000;
            return <tr key={i}><td>{i+1}</td><td>{cl.map(e=>e.event).join(', ')}</td><td>{span.toFixed(0)}</td></tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

function ConcerningEventsAnalysis({ list }) {
  return (
    <div>
      <h2>Most Concerning Apnea Events</h2>
      <table>
        <thead><tr><th>#</th><th>Duration (s)</th><th>Events</th></tr></thead>
        <tbody>
          {list.map((item, i) => (
            <tr key={i}>
              <td>{i+1}</td>
              <td>{item.durationSec.toFixed(0)}</td>
              <td>{item.events.map(e=>e.event).join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function App() {
  const { summaryData, detailsData, onSummaryFile, onDetailsFile } = useCsvFiles();
  const [clusters, setClusters] = useState([]);
  const [falseNegatives, setFalseNegatives] = useState([]);
  const [concerning, setConcerning] = useState([]);

  useEffect(() => {
    if (detailsData) {
      const events = detailsData.map(r => ({ date: new Date(r['DateTime']), event: r['Event'], duration: r['Data/Duration'] }));
      const cls = clusterEvents(events, 60);
      setClusters(cls);
      const fn = findFalseNegatives(cls);
      setFalseNegatives(fn);
      setConcerning(findConcerningEvents(cls, 10));
    }
  }, [detailsData]);

  return (
    <div className="container">
      <h1>OSCAR Sleep Data Analysis</h1>
      <div className="controls">
        <label>Summary CSV: <input type="file" accept=".csv" onChange={onSummaryFile} /></label>
        <label>Details CSV: <input type="file" accept=".csv" onChange={onDetailsFile} /></label>
      </div>
      {summaryData && <SummaryAnalysis data={summaryData} />}
      {detailsData && (
        <>
          <ClusterAnalysis clusters={clusters} />
          <FalseNegativesAnalysis list={falseNegatives} />
          <ConcerningEventsAnalysis list={concerning} />
        </>
      )}
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById('root'));
