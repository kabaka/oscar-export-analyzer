import React from 'react';
import UsagePatternsCharts from './UsagePatternsCharts';
import AhiTrendsCharts from './AhiTrendsCharts';
import EpapTrendsCharts from './EpapTrendsCharts';
import GuideLink from './GuideLink';
import {
  summarizeUsage,
  computeAHITrends,
  computeEPAPTrends,
} from '../utils/stats';
import { useData } from '../context/DataContext';

export default function SummaryAnalysis({ clusters = [] }) {
  const { filteredSummary: data } = useData();
  const usage = summarizeUsage(data || []);
  const ahi = computeAHITrends(data || []);
  const epap = computeEPAPTrends(data || []);
  return (
    <div>
      <h2 id="usage-patterns">
        1. Usage Patterns <GuideLink anchor="usage-patterns" label="Guide" />
      </h2>
      <table>
        <tbody>
          <tr>
            <td>Total nights analyzed</td>
            <td>{usage.totalNights}</td>
          </tr>
          <tr>
            <td>Average usage per night</td>
            <td>{usage.avgHours.toFixed(2)} hours</td>
          </tr>
          <tr>
            <td>Nights ≥ 4 h usage</td>
            <td>
              {usage.nightsLong} (
              {((usage.nightsLong / usage.totalNights) * 100).toFixed(1)}%)
            </td>
          </tr>
          <tr>
            <td>Nights &lt; 4 h usage</td>
            <td>
              {usage.nightsShort} (
              {((usage.nightsShort / usage.totalNights) * 100).toFixed(1)}%)
            </td>
          </tr>
        </tbody>
      </table>
      <table>
        <tbody>
          <tr>
            <td>Median usage per night</td>
            <td>{usage.medianHours.toFixed(2)} hours</td>
          </tr>
          <tr>
            <td>Usage IQR (25th–75th percentile)</td>
            <td>
              {usage.p25Hours.toFixed(2)}–{usage.p75Hours.toFixed(2)} hours
            </td>
          </tr>
          <tr>
            <td>Min / Max usage</td>
            <td>
              {usage.minHours.toFixed(2)} / {usage.maxHours.toFixed(2)} hours
            </td>
          </tr>
          <tr>
            <td>Outlier nights (≤ Q1−1.5×IQR)</td>
            <td>{usage.outlierLowCount} nights</td>
          </tr>
          <tr>
            <td>Outlier nights (≥ Q3+1.5×IQR)</td>
            <td>{usage.outlierHighCount} nights</td>
          </tr>
        </tbody>
      </table>
      <ul>
        <li>
          Usage distributions highlight variability and potential adherence
          issues.
        </li>
      </ul>
      <UsagePatternsCharts data={data} />

      <h2 id="ahi-trends">
        2. AHI Trends <GuideLink anchor="ahi-trends" label="Guide" />
      </h2>
      <table>
        <tbody>
          <tr>
            <td>Average AHI</td>
            <td>{ahi.avgAHI.toFixed(2)} events/hour</td>
          </tr>
          <tr>
            <td>Median AHI</td>
            <td>{ahi.medianAHI.toFixed(2)} events/hour</td>
          </tr>
          <tr>
            <td>AHI IQR (25th–75th percentile)</td>
            <td>
              {ahi.p25AHI.toFixed(2)}–{ahi.p75AHI.toFixed(2)}
            </td>
          </tr>
          <tr>
            <td>Min AHI</td>
            <td>{ahi.minAHI.toFixed(2)}</td>
          </tr>
          <tr>
            <td>Max AHI</td>
            <td>{ahi.maxAHI.toFixed(2)}</td>
          </tr>
          <tr>
            <td>Nights with AHI &gt; 5.0</td>
            <td>
              {ahi.nightsAHIover5} (
              {((ahi.nightsAHIover5 / usage.totalNights) * 100).toFixed(1)}%)
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        First 30 nights avg AHI = {ahi.first30AvgAHI.toFixed(2)}, last 30 nights
        avg AHI = {ahi.last30AvgAHI.toFixed(2)}
      </p>
      <ul>
        <li>
          Outlier nights (AHI ≥ Q3+1.5×IQR):{' '}
          {ahi.ahis.filter((v) => v >= ahi.p75AHI + 1.5 * ahi.iqrAHI).length}
        </li>
      </ul>
      <AhiTrendsCharts data={data} clusters={clusters} />

      <h2 id="pressure-settings">
        3. Pressure Settings and Performance{' '}
        <GuideLink anchor="pressure-correlation-epap" label="Guide" />
      </h2>
      <h3 id="epap-distribution">3.1 EPAP Distribution & Percentiles</h3>
      <table>
        <tbody>
          <tr>
            <td>Median EPAP</td>
            <td>{epap.medianEPAP.toFixed(2)} cmH₂O</td>
          </tr>
          <tr>
            <td>EPAP IQR (25th–75th percentile)</td>
            <td>
              {epap.p25EPAP.toFixed(2)}–{epap.p75EPAP.toFixed(2)} cmH₂O
            </td>
          </tr>
          <tr>
            <td>Min / Max EPAP</td>
            <td>
              {epap.minEPAP.toFixed(2)} / {epap.maxEPAP.toFixed(2)} cmH₂O
            </td>
          </tr>
        </tbody>
      </table>
      <ul>
        <li>Distribution summary of nightly median EPAP settings.</li>
      </ul>

      <h3 id="epap-trend">3.2 EPAP Trend (First vs Last 30 nights)</h3>
      <table>
        <tbody>
          <tr>
            <td>Avg median EPAP (first 30 nights)</td>
            <td>{epap.avgMedianEPAPFirst30.toFixed(2)} cmH₂O</td>
          </tr>
          <tr>
            <td>Avg median EPAP (last 30 nights)</td>
            <td>{epap.avgMedianEPAPLast30.toFixed(2)} cmH₂O</td>
          </tr>
        </tbody>
      </table>

      <h3 id="epap-correlation">3.3 EPAP vs AHI & Correlation</h3>
      <table>
        <thead>
          <tr>
            <th>EPAP group</th>
            <th>Nights</th>
            <th>Avg AHI</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>EPAP &lt; 7 cmH₂O</td>
            <td>{epap.countLow}</td>
            <td>{epap.avgAHILow.toFixed(2)}</td>
          </tr>
          <tr>
            <td>EPAP ≥ 7 cmH₂O</td>
            <td>{epap.countHigh}</td>
            <td>{epap.avgAHIHigh.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        Correlation between nightly median EPAP and AHI: r ={' '}
        {epap.corrEPAPAHI.toFixed(2)}
      </p>
      <EpapTrendsCharts data={data} />
    </div>
  );
}
