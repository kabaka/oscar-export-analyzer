import { APNEA_DURATION_THRESHOLD_SEC, TREND_WINDOW_DAYS } from '../constants';

export function buildApneaDetail({
  event = 'ClearAirway',
  durationSec = APNEA_DURATION_THRESHOLD_SEC,
  dateTime = '2021-01-01T00:00:00Z',
} = {}) {
  return {
    Event: event,
    'Data/Duration': durationSec.toString(),
    DateTime: dateTime,
  };
}

export function buildSummaryRow({
  date = '2021-01-01',
  ahi,
  medianEPAP,
  totalTime,
} = {}) {
  const row = { Date: date };
  if (ahi !== undefined) row.AHI = ahi.toString();
  if (medianEPAP !== undefined) row['Median EPAP'] = medianEPAP.toString();
  if (totalTime !== undefined) row['Total Time'] = totalTime;
  return row;
}

export function buildTrendWindowSequence({
  startDate = new Date('2021-01-01'),
  nights = TREND_WINDOW_DAYS,
  valueAccessor,
} = {}) {
  const rows = [];
  for (let i = 0; i < nights; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const formatted = date.toISOString().slice(0, 10);
    const overrides = valueAccessor ? valueAccessor(i, formatted) : {};
    rows.push({ Date: formatted, ...overrides });
  }
  return rows;
}
