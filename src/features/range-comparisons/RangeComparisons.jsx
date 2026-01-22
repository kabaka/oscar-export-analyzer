import React, { useMemo, useCallback } from 'react';
import { parseDuration, mannWhitneyUTest } from '../../utils/stats';
import { useData } from '../../context/DataContext';
import {
  SECONDS_PER_HOUR,
  DECIMAL_PLACES_2,
  SECONDARY_TEXT_OPACITY,
} from '../../constants';

/**
 * Compare usage hours and AHI across two date ranges.
 *
 * @param {Object} props
 * @param {{ start: Date|null, end: Date|null }} [props.rangeA] - Range A.
 * @param {{ start: Date|null, end: Date|null }} [props.rangeB] - Range B.
 * @returns {JSX.Element|null}
 */
export default function RangeComparisons({ rangeA, rangeB }) {
  const { summaryData = [] } = useData();
  const pick = useCallback(
    (r) => {
      if (!r) return [];
      const dateCol = summaryData.length
        ? Object.keys(summaryData[0]).find((c) => /date/i.test(c))
        : null;
      if (!dateCol) return [];
      return summaryData.filter((row) => {
        const d = new Date(row[dateCol]);
        return (!r.start || d >= r.start) && (!r.end || d <= r.end);
      });
    },
    [summaryData],
  );
  const A = useMemo(() => pick(rangeA), [pick, rangeA]);
  const B = useMemo(() => pick(rangeB), [pick, rangeB]);
  const toUsage = (rows) =>
    rows
      .map((r) => parseDuration(r['Total Time']) / SECONDS_PER_HOUR)
      .filter((v) => !isNaN(v));
  const toAHI = (rows) =>
    rows.map((r) => parseFloat(r['AHI'])).filter((v) => !isNaN(v));
  const uA = toUsage(A),
    uB = toUsage(B);
  const aA = toAHI(A),
    aB = toAHI(B);
  const avg = (arr) =>
    arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : NaN;
  const kpi = {
    usageA: avg(uA),
    usageB: avg(uB),
    usageDelta: avg(uB) - avg(uA),
    usageMW: mannWhitneyUTest(uA, uB),
    ahiA: avg(aA),
    ahiB: avg(aB),
    ahiDelta: avg(aB) - avg(aA),
    ahiMW: mannWhitneyUTest(aA, aB),
    nA: A.length,
    nB: B.length,
  };
  if (!A.length || !B.length) return null;
  return (
    <div>
      <h3>Range Comparisons (A vs B)</h3>
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>A (mean)</th>
            <th>B (mean)</th>
            <th>Delta (B−A)</th>
            <th>MW p</th>
            <th>Effect (B &gt; A)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Usage (h/night)</td>
            <td>{kpi.usageA.toFixed(DECIMAL_PLACES_2)}</td>
            <td>{kpi.usageB.toFixed(DECIMAL_PLACES_2)}</td>
            <td>{kpi.usageDelta.toFixed(DECIMAL_PLACES_2)}</td>
            <td>
              {isFinite(kpi.usageMW.p)
                ? kpi.usageMW.p.toExponential(DECIMAL_PLACES_2)
                : '—'}
            </td>
            <td title="Rank-biserial effect; positive means B tends to be larger">
              {isFinite(kpi.usageMW.effect)
                ? kpi.usageMW.effect.toFixed(DECIMAL_PLACES_2)
                : '—'}
            </td>
          </tr>
          <tr>
            <td>AHI (events/h)</td>
            <td>{kpi.ahiA.toFixed(DECIMAL_PLACES_2)}</td>
            <td>{kpi.ahiB.toFixed(DECIMAL_PLACES_2)}</td>
            <td>{kpi.ahiDelta.toFixed(DECIMAL_PLACES_2)}</td>
            <td>
              {isFinite(kpi.ahiMW.p)
                ? kpi.ahiMW.p.toExponential(DECIMAL_PLACES_2)
                : '—'}
            </td>
            <td title="Rank-biserial effect; positive means B tends to be larger">
              {isFinite(kpi.ahiMW.effect)
                ? kpi.ahiMW.effect.toFixed(DECIMAL_PLACES_2)
                : '—'}
            </td>
          </tr>
        </tbody>
      </table>
      <p style={{ opacity: SECONDARY_TEXT_OPACITY }}>
        nA={kpi.nA}, nB={kpi.nB}. Mann–Whitney U p-values and signed
        rank-biserial effects (positive means range B tends to be larger) shown.
      </p>
    </div>
  );
}
