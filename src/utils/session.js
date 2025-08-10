// Build and apply app session objects for export/import and local persistence.

export function buildSession(state) {
  const {
    summaryData = [],
    detailsData = [],
    clusterParams = {},
    dateFilter = { start: null, end: null },
    rangeA = { start: null, end: null },
    rangeB = { start: null, end: null },
    fnPreset = 'balanced',
    version = 1,
  } = state || {};
  return {
    version,
    savedAt: new Date().toISOString(),
    clusterParams,
    dateFilter: serializeRange(dateFilter),
    rangeA: serializeRange(rangeA),
    rangeB: serializeRange(rangeB),
    fnPreset,
    // Raw parsed rows; intended for local persistence/export only
    summaryData,
    detailsData,
  };
}

function serializeRange(r) {
  return !r ? { start: null, end: null } : {
    start: r.start instanceof Date ? r.start.toISOString() : (r.start || null),
    end: r.end instanceof Date ? r.end.toISOString() : (r.end || null),
  };
}

function parseMaybeDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

export function applySession(session) {
  if (!session || typeof session !== 'object') return null;
  const { summaryData = [], detailsData = [], clusterParams = {}, dateFilter, rangeA, rangeB, fnPreset = 'balanced' } = session;
  const patch = {
    summaryData,
    detailsData,
    clusterParams,
    dateFilter: { start: parseMaybeDate(dateFilter?.start), end: parseMaybeDate(dateFilter?.end) },
    rangeA: { start: parseMaybeDate(rangeA?.start), end: parseMaybeDate(rangeA?.end) },
    rangeB: { start: parseMaybeDate(rangeB?.start), end: parseMaybeDate(rangeB?.end) },
    fnPreset,
  };
  return patch;
}

