import React from 'react';
import UsagePatternsCharts from './UsagePatternsCharts';
import AhiTrendsCharts from './AhiTrendsCharts';
import EpapTrendsCharts from './EpapTrendsCharts';
import { GuideLink } from './ui';
import {
  summarizeUsage,
  computeAHITrends,
  computeEPAPTrends,
} from '../utils/stats';
import { useData } from '../context/DataContext';
import {
  AHI_SEVERITY_LIMITS,
  EPAP_SPLIT_THRESHOLD,
  IQR_OUTLIER_MULTIPLIER,
  PERCENT_SCALE,
  ROLLING_WINDOW_LONG_DAYS,
  USAGE_COMPLIANCE_THRESHOLD_HOURS,
} from '../constants';

export default function SummaryAnalysis({ clusters = [] }) {
  const { filteredSummary: data } = useData();
  const usage = summarizeUsage(data || []);
  const ahi = computeAHITrends(data || []);
  const epap = computeEPAPTrends(data || []);
  const DECIMAL_PLACES_PERCENT = 1;
  const DECIMAL_PLACES_TWO = 2;
  const percent = (count, denom) =>
    denom
      ? ((count / denom) * PERCENT_SCALE).toFixed(DECIMAL_PLACES_PERCENT)
      : '—';
  return (
    <div>
      <h2 id="usage-patterns">
        1. Usage Patterns <GuideLink anchor="usage-patterns" label="Guide" />
      </h2>
      <table>
        <tbody>
          <tr>
            <td>Total nights provided</td>
            <td>{usage.totalNights}</td>
          </tr>
          <tr>
            <td>Valid nights analyzed</td>
            <td>{usage.validNights}</td>
          </tr>
          {usage.invalidNights > 0 && (
            <tr>
              <td>Invalid nights excluded</td>
              <td>{usage.invalidNights}</td>
            </tr>
          )}
          <tr>
            <td>Average usage per night</td>
            <td>{usage.avgHours.toFixed(DECIMAL_PLACES_TWO)} hours</td>
          </tr>
          <tr>
            <td>Nights ≥ {USAGE_COMPLIANCE_THRESHOLD_HOURS} h usage</td>
            <td>
              {usage.nightsLong} ({percent(usage.nightsLong, usage.validNights)}
              %)
            </td>
          </tr>
          <tr>
            <td>Nights &lt; {USAGE_COMPLIANCE_THRESHOLD_HOURS} h usage</td>
            <td>
              {usage.nightsShort} (
              {percent(usage.nightsShort, usage.validNights)}%)
            </td>
          </tr>
        </tbody>
      </table>
      <table>
        <tbody>
          <tr>
            <td>Median usage per night</td>
            <td>{usage.medianHours.toFixed(DECIMAL_PLACES_TWO)} hours</td>
          </tr>
          <tr>
            <td>Usage IQR (25th–75th percentile)</td>
            <td>
              {usage.p25Hours.toFixed(DECIMAL_PLACES_TWO)}–
              {usage.p75Hours.toFixed(DECIMAL_PLACES_TWO)} hours
            </td>
          </tr>
          <tr>
            <td>Min / Max usage</td>
            <td>
              {usage.minHours.toFixed(DECIMAL_PLACES_TWO)} /
              {usage.maxHours.toFixed(DECIMAL_PLACES_TWO)} hours
            </td>
          </tr>
          <tr>
            <td>
              Outlier nights (≤ Q1−
              {IQR_OUTLIER_MULTIPLIER}×IQR)
            </td>
            <td>{usage.outlierLowCount} nights</td>
          </tr>
          <tr>
            <td>
              Outlier nights (≥ Q3+
              {IQR_OUTLIER_MULTIPLIER}×IQR)
            </td>
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
            <td>{ahi.avgAHI.toFixed(DECIMAL_PLACES_TWO)} events/hour</td>
          </tr>
          <tr>
            <td>Median AHI</td>
            <td>{ahi.medianAHI.toFixed(DECIMAL_PLACES_TWO)} events/hour</td>
          </tr>
          <tr>
            <td>AHI IQR (25th–75th percentile)</td>
            <td>
              {ahi.p25AHI.toFixed(DECIMAL_PLACES_TWO)}–
              {ahi.p75AHI.toFixed(DECIMAL_PLACES_TWO)}
            </td>
          </tr>
          <tr>
            <td>Min AHI</td>
            <td>{ahi.minAHI.toFixed(DECIMAL_PLACES_TWO)}</td>
          </tr>
          <tr>
            <td>Max AHI</td>
            <td>{ahi.maxAHI.toFixed(DECIMAL_PLACES_TWO)}</td>
          </tr>
          <tr>
            <td>Nights with AHI &gt; {AHI_SEVERITY_LIMITS.normal}</td>
            <td>
              {ahi.nightsAHIover5} (
              {percent(ahi.nightsAHIover5, usage.validNights)}%)
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        First {ROLLING_WINDOW_LONG_DAYS} nights avg AHI ={' '}
        {ahi.first30AvgAHI.toFixed(DECIMAL_PLACES_TWO)}, last
        {ROLLING_WINDOW_LONG_DAYS} nights avg AHI =
        {ahi.last30AvgAHI.toFixed(DECIMAL_PLACES_TWO)}
      </p>
      <ul>
        <li>
          Outlier nights (AHI ≥ Q3+
          {IQR_OUTLIER_MULTIPLIER}×IQR):{' '}
          {
            ahi.ahis.filter(
              (v) => v >= ahi.p75AHI + IQR_OUTLIER_MULTIPLIER * ahi.iqrAHI,
            ).length
          }
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
            <td>{epap.medianEPAP.toFixed(DECIMAL_PLACES_TWO)} cmH₂O</td>
          </tr>
          <tr>
            <td>EPAP IQR (25th–75th percentile)</td>
            <td>
              {epap.p25EPAP.toFixed(DECIMAL_PLACES_TWO)}–
              {epap.p75EPAP.toFixed(DECIMAL_PLACES_TWO)} cmH₂O
            </td>
          </tr>
          <tr>
            <td>Min / Max EPAP</td>
            <td>
              {epap.minEPAP.toFixed(DECIMAL_PLACES_TWO)} /
              {epap.maxEPAP.toFixed(DECIMAL_PLACES_TWO)} cmH₂O
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
            <td>
              {epap.avgMedianEPAPFirst30.toFixed(DECIMAL_PLACES_TWO)} cmH₂O
            </td>
          </tr>
          <tr>
            <td>Avg median EPAP (last 30 nights)</td>
            <td>
              {epap.avgMedianEPAPLast30.toFixed(DECIMAL_PLACES_TWO)} cmH₂O
            </td>
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
            <td>EPAP &lt; {EPAP_SPLIT_THRESHOLD} cmH₂O</td>
            <td>{epap.countLow}</td>
            <td>{epap.avgAHILow.toFixed(DECIMAL_PLACES_TWO)}</td>
          </tr>
          <tr>
            <td>EPAP ≥ {EPAP_SPLIT_THRESHOLD} cmH₂O</td>
            <td>{epap.countHigh}</td>
            <td>{epap.avgAHIHigh.toFixed(DECIMAL_PLACES_TWO)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        Correlation between nightly median EPAP and AHI: r ={' '}
        {epap.corrEPAPAHI.toFixed(DECIMAL_PLACES_TWO)}
      </p>
      <EpapTrendsCharts data={data} />
    </div>
  );
}
