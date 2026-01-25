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
    // eslint-disable-next-line no-magic-numbers -- ISO 8601 date format: YYYY-MM-DD is first 10 characters
    const formatted = date.toISOString().slice(0, 10);
    const overrides = valueAccessor ? valueAccessor(i, formatted) : {};
    rows.push({ Date: formatted, ...overrides });
  }
  return rows;
}

/**
 * Generate realistic CPAP night session data for testing
 *
 * Creates synthetic data mimicking real CPAP sessions with physiologically accurate patterns:
 * - Apnea events distributed with temporal clustering (REM sleep periodicity)
 * - Flow limitation (FLG) signal readings with realistic noise and pre-event spikes
 * - Event durations following log-normal distribution (typical 10-60s range)
 *
 * **Clinical context:**
 * - Normal sleep: AHI < 5 events/hour
 * - Mild OSA: AHI 5-15 events/hour
 * - Moderate OSA: AHI 15-30 events/hour
 * - Severe OSA: AHI > 30 events/hour
 *
 * **ALL DATA IS SYNTHETIC** — Never use real patient data in tests.
 *
 * @param {object} options - Session configuration
 * @param {string} options.date - Session date (YYYY-MM-DD format, default '2021-01-01')
 * @param {number} options.ahiTarget - Target AHI (events per hour, default 10)
 * @param {number} options.durationHours - Session duration in hours (default 8)
 * @param {number} options.flgBaseLevel - Baseline flow limitation 0.0-1.0 scale (default 0.3)
 *   - 0.0-0.1: Healthy
 *   - 0.1-0.3: Mild flow limitation
 *   - 0.3-0.6: Moderate
 *   - 0.6-1.0: Severe
 * @param {number} options.flgNoiseScale - Random FLG variation amplitude (default 0.1)
 * @param {number} options.remClusteringStrength - REM clustering factor 0-1 (default 0.5)
 *   - 0.0: Uniform distribution
 *   - 1.0: All events during REM-like periods
 * @param {object} options.eventTypeDistribution - Event type percentages (default {Obstructive: 0.7, ClearAirway: 0.2, Mixed: 0.1})
 * @param {number} options.seed - Random seed for reproducible tests (default random)
 * @returns {object} { events: ApneaDetail[], flgReadings: FLGReading[] }
 *
 * @example Normal night (AHI < 5)
 * const { events } = buildNightSession({
 *   date: '2021-01-01',
 *   ahiTarget: 3,
 *   flgBaseLevel: 0.05,
 *   remClusteringStrength: 0.2,
 * });
 *
 * @example Severe OSA night (AHI > 30)
 * const { events } = buildNightSession({
 *   ahiTarget: 35,
 *   flgBaseLevel: 0.6,
 *   remClusteringStrength: 0.8,
 *   eventTypeDistribution: { Obstructive: 0.8, ClearAirway: 0.15, Mixed: 0.05 },
 * });
 */
export function buildNightSession({
  date = '2021-01-01',
  ahiTarget = 10,
  durationHours = 8,
  flgBaseLevel = 0.3,
  flgNoiseScale = 0.1,
  remClusteringStrength = 0.5,
  eventTypeDistribution = { Obstructive: 0.7, ClearAirway: 0.2, Mixed: 0.1 },
  seed = Math.random(),
} = {}) {
  // Seeded pseudo-random number generator for reproducible tests
  let rngState = seed;
  const seededRandom = () => {
    rngState = (rngState * 9301 + 49297) % 233280;
    return rngState / 233280;
  };

  // Calculate total events needed
  const totalEvents = Math.round(ahiTarget * durationHours);
  const sessionStartTime = new Date(`${date}T22:00:00Z`);

  // Generate REM-like periods (~90 min cycles, ~20% of total sleep time)
  // eslint-disable-next-line no-magic-numbers -- REM sleep cycle duration
  const remCycleDurationMs = 90 * 60 * 1000; // 90 minutes
  // eslint-disable-next-line no-magic-numbers -- REM stage duration within cycle
  const remStageDurationMs = 20 * 60 * 1000; // ~20 min REM per 90 min cycle
  const sessionDurationMs = durationHours * 60 * 60 * 1000;

  // Helper: Check if timestamp falls within REM-like period
  const isInRemPeriod = (offsetMs) => {
    const cyclePosition = offsetMs % remCycleDurationMs;
    // REM typically occurs in latter half of each cycle
    return cyclePosition > remCycleDurationMs - remStageDurationMs;
  };

  // Generate event timestamps with REM clustering
  const events = [];
  for (let i = 0; i < totalEvents; i++) {
    let eventOffsetMs;
    let attempts = 0;
    const maxAttempts = 100;

    // Use rejection sampling to achieve desired REM clustering
    do {
      eventOffsetMs = seededRandom() * sessionDurationMs;
      const inRem = isInRemPeriod(eventOffsetMs);
      const acceptProbability = inRem ? 1.0 : 1.0 - remClusteringStrength * 0.8; // 0.8 factor to keep some non-REM events
      attempts++;
      if (seededRandom() < acceptProbability || attempts >= maxAttempts) {
        break;
      }
      // eslint-disable-next-line no-constant-condition -- intentional do-while loop structure
    } while (true);

    const eventTime = new Date(sessionStartTime.getTime() + eventOffsetMs);

    // Sample event duration from log-normal-like distribution

    const durationBase = 20; // median duration in seconds

    const durationSpread = 1.5;
    // Approximate log-normal: exp(normal) ≈ uniform^spread
    const durationSec = Math.max(
      10,
      Math.min(
        120,
        durationBase * Math.pow(seededRandom() * 2, durationSpread),
      ),
    );

    // Select event type based on distribution
    const typeRandom = seededRandom();
    let eventType = 'Obstructive';
    let cumulative = 0;
    for (const [type, probability] of Object.entries(eventTypeDistribution)) {
      cumulative += probability;
      if (typeRandom <= cumulative) {
        eventType = type;
        break;
      }
    }

    events.push(
      buildApneaDetail({
        event: eventType,
        durationSec: Math.round(durationSec * 10) / 10,
        dateTime: eventTime.toISOString(),
      }),
    );
  }

  // Sort events by timestamp
  events.sort((a, b) => new Date(a.DateTime) - new Date(b.DateTime));

  // Generate FLG signal readings (~5 second intervals)
  // eslint-disable-next-line no-magic-numbers -- FLG sampling interval
  const flgIntervalMs = 5 * 1000; // 5 seconds
  const flgReadings = [];
  const totalFlgSamples = Math.floor(sessionDurationMs / flgIntervalMs);

  for (let i = 0; i < totalFlgSamples; i++) {
    const flgOffsetMs = i * flgIntervalMs;
    const flgTime = new Date(sessionStartTime.getTime() + flgOffsetMs);

    // Base FLG level with noise
    let flgValue = flgBaseLevel + (seededRandom() - 0.5) * 2 * flgNoiseScale;

    // Add pre-event spikes (10-30s before apnea events)
    for (const event of events) {
      const eventTime = new Date(event.DateTime).getTime();
      const timeDiffMs = eventTime - flgTime.getTime();
      // eslint-disable-next-line no-magic-numbers -- pre-event spike window
      if (timeDiffMs > 0 && timeDiffMs < 30000) {
        // Linear spike 10-30s before event
        // eslint-disable-next-line no-magic-numbers -- spike magnitude calculation
        const spikeIntensity = 0.3 * (1 - timeDiffMs / 30000);
        flgValue += spikeIntensity;
      }
    }

    // Clamp to valid range [0, 1]
    flgValue = Math.max(0, Math.min(1, flgValue));

    flgReadings.push({
      Event: 'FLG',
      'Data/Duration': flgValue.toFixed(3),
      DateTime: flgTime.toISOString(),
    });
  }

  return { events, flgReadings };
}
