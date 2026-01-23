/**
 * Utility functions for normalizing analytics data structures.
 *
 * These functions ensure that date fields in cluster and false negative data
 * are converted to valid Date objects, handling various input formats
 * (Date instances, timestamps, ISO strings).
 *
 * **Date Serialization Context:**
 * Web Workers send date values as milliseconds (primitive numbers) because the
 * structured clone algorithm cannot serialize Date or DateTime objects. These
 * normalization functions reconstruct Date objects from milliseconds on the
 * main thread after receiving worker messages.
 *
 * @see src/workers/csv.worker.js - Where DateTime is converted to milliseconds
 * @see docs/developer/architecture.md - Full date serialization strategy
 */

/**
 * Converts various date formats to a valid Date object.
 *
 * Handles the main thread side of worker date serialization: converts milliseconds
 * (received from workers via postMessage) back to Date objects for use in React
 * components and visualization libraries.
 *
 * @param {Date|number|string} value - Date value in various formats:
 *   - number: milliseconds timestamp from worker (primary use case)
 *   - Date: already a Date object (passthrough)
 *   - string: ISO 8601 string (fallback)
 * @returns {Date|null} Valid Date object or null if conversion fails
 */
export const toValidDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'number') {
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
  }
  if (typeof value === 'string' && value) {
    const fromString = new Date(value);
    return Number.isNaN(fromString.getTime()) ? null : fromString;
  }
  return null;
};

/**
 * Normalizes a single cluster object, ensuring all date fields are valid Date objects.
 *
 * @param {Object} cluster - Raw cluster data from worker or fallback computation
 * @param {Date|string|number} cluster.start - Cluster start time
 * @param {Date|string|number} cluster.end - Cluster end time
 * @param {Array<Object>} cluster.events - Array of events in the cluster
 * @returns {Object|null} Normalized cluster with Date objects, or null if invalid
 */
export const normalizeCluster = (cluster) => {
  if (!cluster) return null;

  const normalizedEvents = Array.isArray(cluster.events)
    ? cluster.events
        .map((evt) => {
          if (!evt) return null;
          const date = toValidDate(evt.date);
          return date ? { ...evt, date } : null;
        })
        .filter(Boolean)
    : cluster.events;

  const start =
    toValidDate(cluster.start) ||
    (Array.isArray(normalizedEvents) ? normalizedEvents[0]?.date : null);

  if (!start) {
    return null;
  }

  const end =
    toValidDate(cluster.end) ||
    (Array.isArray(normalizedEvents)
      ? normalizedEvents[normalizedEvents.length - 1]?.date
      : null) ||
    start;

  return {
    ...cluster,
    start,
    end,
    events: Array.isArray(normalizedEvents) ? normalizedEvents : cluster.events,
  };
};

/**
 * Normalizes a single false negative entry, ensuring all date fields are valid Date objects.
 *
 * @param {Object} entry - Raw false negative data from worker or fallback computation
 * @param {Date|string|number} entry.start - False negative start time
 * @param {Date|string|number} entry.end - False negative end time
 * @returns {Object|null} Normalized entry with Date objects, or null if invalid
 */
export const normalizeFalseNegative = (entry) => {
  if (!entry) return null;

  const start = toValidDate(entry.start);
  if (!start) {
    return null;
  }

  const end = toValidDate(entry.end) || start;

  return {
    ...entry,
    start,
    end,
  };
};

/**
 * Normalizes an array of cluster objects.
 *
 * @param {Array<Object>} clusters - Array of raw cluster data
 * @returns {Array<Object>} Array of normalized clusters (invalid entries filtered out)
 */
export const normalizeClusters = (clusters) =>
  (Array.isArray(clusters) ? clusters : [])
    .map(normalizeCluster)
    .filter(Boolean);

/**
 * Normalizes an array of false negative entries.
 *
 * @param {Array<Object>} entries - Array of raw false negative data
 * @returns {Array<Object>} Array of normalized entries (invalid entries filtered out)
 */
export const normalizeFalseNegatives = (entries) =>
  (Array.isArray(entries) ? entries : [])
    .map(normalizeFalseNegative)
    .filter(Boolean);
