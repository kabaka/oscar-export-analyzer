function normalizeSessionCandidate(candidate) {
  if (!candidate) return null;
  if (typeof candidate === 'object') {
    return candidate;
  }
  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch (err) {
      return trimmed;
    }
  }
  return null;
}

async function fetchSessionFromUrl(urlValue, { fetchImpl, baseLocation, windowObj }) {
  if (!urlValue) return null;
  let url;
  try {
    url = new URL(
      urlValue,
      baseLocation?.href || baseLocation?.origin || windowObj?.location?.href,
    );
  } catch (err) {
    throw new Error(`Invalid session URL: ${urlValue}`);
  }
  const response = await fetchImpl(url.href, { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error(`Failed to fetch session from ${url.href}: ${response.status}`);
  }
  return response.json();
}

export async function resolvePrehydratedSession({
  windowObj = typeof window !== 'undefined' ? window : undefined,
  location = typeof window !== 'undefined' ? window.location : undefined,
  env = typeof import.meta !== 'undefined' ? import.meta.env || {} : {},
  fetchImpl =
    typeof fetch !== 'undefined'
      ? fetch
      : windowObj?.fetch
      ? windowObj.fetch.bind(windowObj)
      : undefined,
} = {}) {
  if (!windowObj || !location) return null;

  const directCandidate = normalizeSessionCandidate(
    windowObj.__OSCAR_PREHYDRATED_SESSION__ || null,
  );
  if (directCandidate && typeof directCandidate === 'object') {
    return directCandidate;
  }

  const searchParams = new URLSearchParams(location.search || '');
  const queryCandidate = normalizeSessionCandidate(searchParams.get('session'));
  if (queryCandidate) {
    if (typeof queryCandidate === 'object') {
      return queryCandidate;
    }
    if (!fetchImpl) {
      throw new Error('Cannot fetch session URL: fetch is unavailable in this environment');
    }
    return fetchSessionFromUrl(queryCandidate, {
      fetchImpl,
      baseLocation: location,
      windowObj,
    });
  }

  const envCandidate = normalizeSessionCandidate(env?.VITE_SCREENSHOT_SESSION);
  if (envCandidate) {
    if (typeof envCandidate === 'object') {
      return envCandidate;
    }
    if (!fetchImpl) {
      throw new Error('Cannot fetch session URL: fetch is unavailable in this environment');
    }
    return fetchSessionFromUrl(envCandidate, {
      fetchImpl,
      baseLocation: location,
      windowObj,
    });
  }

  return null;
}
