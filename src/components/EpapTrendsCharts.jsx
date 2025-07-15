import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { COLORS } from '../utils/colors';

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
          {
            x: dates,
            y: epaps,
            type: 'scatter',
            mode: 'lines',
            name: 'Nightly EPAP',
            line: { width: 1, color: COLORS.primary },
          },
          {
            x: first30Dates,
            y: first30Epaps,
            type: 'scatter',
            mode: 'markers',
            name: 'First 30 Nights',
            marker: { color: COLORS.accent, size: 6 },
          },
          {
            x: last30Dates,
            y: last30Epaps,
            type: 'scatter',
            mode: 'markers',
            name: 'Last 30 Nights',
            marker: { color: COLORS.secondary, size: 6 },
          },
        ]}
        layout={{
          autosize: true,
          title: 'Nightly Median EPAP Over Time',
          legend: { orientation: 'h', x: 0.5, xanchor: 'center' },
          xaxis: { title: 'Date' },
          yaxis: { title: 'EPAP (cmH₂O)' },
          margin: { t: 40, l: 60, r: 20, b: 50 },
        }}
        config={{
          responsive: true,
          displaylogo: false,
          modeBarButtonsToAdd: ['toImage'],
          toImageButtonOptions: { format: 'svg', filename: 'epap_over_time' },
        }}
      />

      <div className="usage-charts-grid">
        <div className="chart-item">
        <Plot
          useResizeHandler
          style={{ width: '100%', height: '300px' }}
          data={[
            {
              y: epaps,
              type: 'box',
              name: 'EPAP Boxplot',
              boxpoints: 'outliers',
              marker: { color: COLORS.box },
            },
          ]}
          layout={{
            autosize: true,
            title: 'Boxplot of Nightly Median EPAP',
            legend: { orientation: 'h', x: 0.5, xanchor: 'center' },
            yaxis: { title: 'EPAP (cmH₂O)', zeroline: false },
            margin: { t: 40, l: 60, r: 20, b: 50 },
          }}
          config={{
            responsive: true,
            displaylogo: false,
            modeBarButtonsToAdd: ['toImage'],
            toImageButtonOptions: { format: 'svg', filename: 'epap_boxplot' },
          }}
        />
        </div>
        <div className="chart-item">
          <Plot
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[
              { x: epapAhiPairs.map(p => p.epap), y: epapAhiPairs.map(p => p.ahi), type: 'scatter', mode: 'markers', name: 'Data', marker: { size: 6, opacity: 0.7, color: COLORS.primary } },
              { x: [boxMin, boxMax], y: [slope * boxMin + intercept, slope * boxMax + intercept], type: 'scatter', mode: 'lines', name: 'Fit', line: { dash: 'dash', width: 2, color: COLORS.secondary } },
            ]}
            layout={{
              autosize: true,
              title: `EPAP vs AHI Scatter (r = ${corr.toFixed(2)})`,
              legend: { orientation: 'h', x: 0.5, xanchor: 'center' },
              xaxis: { title: 'Median EPAP (cmH₂O)' },
              yaxis: { title: 'AHI (events/hour)' },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
            config={{
              responsive: true,
              displaylogo: false,
              modeBarButtonsToAdd: ['toImage'],
              toImageButtonOptions: { format: 'svg', filename: 'epap_vs_ahi_scatter' },
            }}
          />
        </div>
      </div>
    </div>
  );
}
