import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';

/**
 * EPAP Analysis Charts: boxplot of nightly median EPAP,
 * time-series of EPAP with first/last 30-night markers,
 * and scatter plot of EPAP vs AHI with regression line and correlation coefficient.
 */
export default function EpapTrendsCharts({ data, width = 700, height = 300 }) {
  const {
    dates,
    epaps,
    first30Dates,
    first30Epaps,
    last30Dates,
    last30Epaps,
    epapAhiPairs,
    corr,
    slope,
    intercept,
  } = useMemo(() => {
    const pts = data
      .map(r => ({
        date: new Date(r['Date']),
        epap: parseFloat(r['Median EPAP']),
        ahi: parseFloat(r['AHI']),
      }))
      .filter(p => !isNaN(p.epap) && !isNaN(p.ahi))
      .sort((a, b) => a.date - b.date);
    const datesArr = pts.map(p => p.date);
    const epapsArr = pts.map(p => p.epap);
    const first30 = pts.slice(0, 30);
    const last30 = pts.slice(-30);
    const epapAhiPairsArr = pts;
    const n = epapAhiPairsArr.length;
    const meanE = epapAhiPairsArr.reduce((sum, p) => sum + p.epap, 0) / n;
    const meanA = epapAhiPairsArr.reduce((sum, p) => sum + p.ahi, 0) / n;
    const cov =
      epapAhiPairsArr.reduce((sum, p) => sum + (p.epap - meanE) * (p.ahi - meanA), 0) /
      (n - 1);
    const varE =
      epapAhiPairsArr.reduce((sum, p) => sum + (p.epap - meanE) ** 2, 0) / (n - 1);
    const stdE = Math.sqrt(varE);
    const stdA = Math.sqrt(
      epapAhiPairsArr.reduce((sum, p) => sum + (p.ahi - meanA) ** 2, 0) / (n - 1)
    );
    const corrVal = cov / (stdE * stdA);
    const slopeVal = cov / varE;
    const interceptVal = meanA - slopeVal * meanE;
    return {
      dates: datesArr,
      epaps: epapsArr,
      first30Dates: first30.map(p => p.date),
      first30Epaps: first30.map(p => p.epap),
      last30Dates: last30.map(p => p.date),
      last30Epaps: last30.map(p => p.epap),
      epapAhiPairs: epapAhiPairsArr,
      corr: corrVal,
      slope: slopeVal,
      intercept: interceptVal,
    };
  }, [data]);

  // Time-series chart with first/last markers
  const boxMin = Math.min(...epaps);
  const boxMax = Math.max(...epaps);

  return (
    <div className="usage-charts">
      <Plot
        useResizeHandler
        style={{ width: '100%', height: '300px' }}
        data={[
          { x: dates, y: epaps, type: 'scatter', mode: 'lines+markers', name: 'Nightly EPAP' },
          { x: first30Dates, y: first30Epaps, type: 'scatter', mode: 'markers', name: 'First 30 Nights', marker: { color: 'green', size: 6 } },
          { x: last30Dates, y: last30Epaps, type: 'scatter', mode: 'markers', name: 'Last 30 Nights', marker: { color: 'orange', size: 6 } },
        ]}
        layout={{
          autosize: true,
          title: 'Nightly Median EPAP Over Time',
          xaxis: { title: 'Date' },
          yaxis: { title: 'EPAP (cmH₂O)' },
          margin: { t: 40, l: 60, r: 20, b: 50 },
        }}
      />

      <div className="usage-charts-grid">
        <div className="chart-item">
          <Plot
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[{ y: epaps, type: 'box', name: 'EPAP Boxplot', boxpoints: 'outliers', marker: { color: '#888' } }]}
            layout={{
              autosize: true,
              title: 'Boxplot of Nightly Median EPAP',
              yaxis: { title: 'EPAP (cmH₂O)', zeroline: false },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
          />
        </div>
        <div className="chart-item">
          <Plot
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[
              { x: epapAhiPairs.map(p => p.epap), y: epapAhiPairs.map(p => p.ahi), type: 'scatter', mode: 'markers', name: 'Data' },
              { x: [boxMin, boxMax], y: [slope * boxMin + intercept, slope * boxMax + intercept], type: 'scatter', mode: 'lines', name: 'Fit', line: { dash: 'dash' } },
            ]}
            layout={{
              autosize: true,
              title: `EPAP vs AHI Scatter (r = ${corr.toFixed(2)})`,
              xaxis: { title: 'Median EPAP (cmH₂O)' },
              yaxis: { title: 'AHI (events/hour)' },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
          />
        </div>
      </div>
    </div>
  );
}
