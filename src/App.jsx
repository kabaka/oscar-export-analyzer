import React, { useState, useEffect, useMemo } from 'react';
import { useCsvFiles } from './hooks/useCsvFiles';
import {
  clusterApneaEvents,
  detectFalseNegatives,
  FALSE_NEG_CONFIDENCE_MIN,
  FLG_BRIDGE_THRESHOLD,
  APOEA_CLUSTER_MIN_TOTAL_SEC,
  MAX_CLUSTER_DURATION_SEC,
  APNEA_GAP_DEFAULT,
  FLG_CLUSTER_GAP_DEFAULT,
  FLG_EDGE_ENTER_THRESHOLD_DEFAULT,
  FLG_EDGE_EXIT_THRESHOLD_DEFAULT,
  computeClusterSeverity,
} from './utils/clustering';
import Overview from './components/Overview';
import SummaryAnalysis from './components/SummaryAnalysis';
import ApneaClusterAnalysis from './components/ApneaClusterAnalysis';
import ApneaEventStats from './components/ApneaEventStats';
import RangeComparisons from './components/RangeComparisons';
import RawDataExplorer from './components/RawDataExplorer';
import ThemeToggle from './components/ThemeToggle';
import DocsModal from './components/DocsModal';
import GuideLink from './components/GuideLink';
import FalseNegativesAnalysis from './components/FalseNegativesAnalysis';
import useSessionManager from './hooks/useSessionManager';
import {
  buildSummaryAggregatesCSV,
  downloadTextFile,
  openPrintReportHTML,
} from './utils/export';

function App() {
  const tocSections = useMemo(
    () => [
      { id: 'overview', label: 'Overview' },
      { id: 'usage-patterns', label: 'Usage Patterns' },
      { id: 'ahi-trends', label: 'AHI Trends' },
      { id: 'pressure-settings', label: 'Pressure Settings' },
      { id: 'apnea-characteristics', label: 'Apnea Events' },
      { id: 'clustered-apnea', label: 'Clusters' },
      { id: 'false-negatives', label: 'False Negatives' },
      { id: 'raw-data-explorer', label: 'Raw Data' },
    ],
    []
  );
  const [activeId, setActiveId] = useState('overview');
  const {
    summaryData,
    detailsData,
    loadingSummary,
    summaryProgress,
    summaryProgressMax,
    loadingDetails,
    detailsProgress,
    detailsProgressMax,
    onSummaryFile,
    onDetailsFile,
    setSummaryData,
    setDetailsData,
    error,
  } = useCsvFiles();
  const [apneaClusters, setApneaClusters] = useState([]);
  const [falseNegatives, setFalseNegatives] = useState([]);
  const [processingDetails, setProcessingDetails] = useState(false);
  const [dateFilter, setDateFilter] = useState({ start: null, end: null });
  const [rangeA, setRangeA] = useState({ start: null, end: null });
  const [rangeB, setRangeB] = useState({ start: null, end: null });
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideAnchor, setGuideAnchor] = useState('');
  const [clusterParams, setClusterParams] = useState({
    gapSec: APNEA_GAP_DEFAULT,
    bridgeThreshold: FLG_BRIDGE_THRESHOLD,
    bridgeSec: FLG_CLUSTER_GAP_DEFAULT,
    minCount: 3,
    minTotalSec: APOEA_CLUSTER_MIN_TOTAL_SEC,
    maxClusterSec: MAX_CLUSTER_DURATION_SEC,
    minDensity: 0,
    edgeEnter: FLG_EDGE_ENTER_THRESHOLD_DEFAULT,
    edgeExit: FLG_EDGE_EXIT_THRESHOLD_DEFAULT,
  });
  const [fnPreset, setFnPreset] = useState('balanced');
  const fnOptions = useMemo(() => {
    const presets = {
      strict: {
        flThreshold: Math.max(0.9, FLG_BRIDGE_THRESHOLD),
        confidenceMin: 0.98,
        gapSec: FLG_CLUSTER_GAP_DEFAULT,
        minDurationSec: 120,
      },
      balanced: {
        flThreshold: FLG_BRIDGE_THRESHOLD,
        confidenceMin: FALSE_NEG_CONFIDENCE_MIN,
        gapSec: FLG_CLUSTER_GAP_DEFAULT,
        minDurationSec: 60,
      },
      lenient: {
        flThreshold: Math.max(0.5, FLG_BRIDGE_THRESHOLD * 0.8),
        confidenceMin: 0.85,
        gapSec: FLG_CLUSTER_GAP_DEFAULT,
        minDurationSec: 45,
      },
    };
    return presets[fnPreset] || presets.balanced;
  }, [fnPreset]);

  const onClusterParamChange = (patch) => {
    setClusterParams((prev) => ({ ...prev, ...patch }));
  };

  // Map in-app sections to guide anchors
  const guideMap = {
    overview: 'overview-dashboard',
    'usage-patterns': 'usage-patterns',
    'ahi-trends': 'ahi-trends',
    'pressure-settings': 'pressure-correlation-epap',
    'apnea-characteristics': 'apnea-event-characteristics-details-csv',
    'clustered-apnea': 'clustered-apnea-events-details-csv',
    'false-negatives': 'potential-false-negatives-details-csv',
    'raw-data-explorer': 'raw-data-explorer',
    'range-compare': 'range-comparisons-a-vs-b',
  };
  const openGuideForActive = () => {
    const anchor = guideMap[activeId] || '';
    setGuideAnchor(anchor);
    setGuideOpen(true);
  };

  // Global event to open guide from inline links without prop drilling
  useEffect(() => {
    const handler = (e) => {
      const anchor = e?.detail?.anchor || '';
      setGuideAnchor(anchor);
      setGuideOpen(true);
    };
    window.addEventListener('open-guide', handler);
    return () => window.removeEventListener('open-guide', handler);
  }, []);

  const {
    persistEnabled,
    setPersistEnabled,
    handleSaveNow,
    handleLoadSaved,
    handleClearSaved,
    handleExportJson,
    handleImportJson,
  } = useSessionManager({
    summaryData,
    detailsData,
    clusterParams,
    dateFilter,
    rangeA,
    rangeB,
    fnPreset,
    setClusterParams,
    setDateFilter,
    setRangeA,
    setRangeB,
    setSummaryData,
    setDetailsData,
  });

  useEffect(() => {
    if (detailsData) {
      // begin processing phase
      setProcessingDetails(true);
      // defer clustering/detection to next tick so UI can update (e.g., hide parse progress)
      let cancelled = false;
      let worker;
      try {
        // eslint-disable-next-line no-undef
        worker = new Worker(
          new URL('./workers/analytics.worker.js', import.meta.url),
          { type: 'module' }
        );
        worker.onmessage = (evt) => {
          if (cancelled) return;
          const { ok, data, error } = evt.data || {};
          if (ok) {
            const rawClusters = data.clusters || [];
            const validClusters = rawClusters
              .filter((cl) => cl.count >= clusterParams.minCount)
              .filter(
                (cl) =>
                  cl.events.reduce((sum, e) => sum + e.durationSec, 0) >=
                  clusterParams.minTotalSec
              )
              .filter((cl) => cl.durationSec <= clusterParams.maxClusterSec)
              .map((cl) => ({ ...cl, severity: computeClusterSeverity(cl) }));
            setApneaClusters(validClusters);
            setFalseNegatives(data.falseNegatives || []);
            setProcessingDetails(false);
          } else {
            console.warn('Analytics worker error:', error);
            fallbackCompute();
          }
        };
        worker.postMessage({
          action: 'analyzeDetails',
          payload: { detailsData, params: clusterParams, fnOptions },
        });
      } catch (err) {
        console.warn('Worker unavailable, using fallback', err);
        fallbackCompute();
      }
      function fallbackCompute() {
        const apneaEvents = detailsData
          .filter((r) =>
            ['ClearAirway', 'Obstructive', 'Mixed'].includes(r['Event'])
          )
          .map((r) => ({
            date: new Date(r['DateTime']),
            durationSec: parseFloat(r['Data/Duration']),
          }));
        const flgEvents = detailsData
          .filter((r) => r['Event'] === 'FLG')
          .map((r) => ({
            date: new Date(r['DateTime']),
            level: parseFloat(r['Data/Duration']),
          }));
        const rawClusters = clusterApneaEvents(
          apneaEvents,
          flgEvents,
          clusterParams.gapSec,
          clusterParams.bridgeThreshold,
          clusterParams.bridgeSec,
          clusterParams.edgeEnter,
          clusterParams.edgeExit,
          10,
          clusterParams.minDensity
        );
        const validClusters = rawClusters
          .filter((cl) => cl.count >= clusterParams.minCount)
          .filter(
            (cl) =>
              cl.events.reduce((sum, e) => sum + e.durationSec, 0) >=
              clusterParams.minTotalSec
          )
          .filter((cl) => cl.durationSec <= clusterParams.maxClusterSec)
          .map((cl) => ({ ...cl, severity: computeClusterSeverity(cl) }));
        setApneaClusters(validClusters);
        setFalseNegatives(detectFalseNegatives(detailsData, fnOptions));
        setProcessingDetails(false);
      }
      return () => {
        cancelled = true;
        try {
          worker && worker.terminate && worker.terminate();
        } catch {
          // ignore termination errors
        }
        setProcessingDetails(false);
      };
    }
  }, [detailsData, clusterParams, fnOptions]);

  const filteredSummary = useMemo(() => {
    if (!summaryData) return null;
    const { start, end } = dateFilter || {};
    const dateCol = summaryData.length
      ? Object.keys(summaryData[0]).find((c) => /date/i.test(c))
      : null;
    if (!dateCol || (!start && !end)) return summaryData;
    return summaryData.filter((r) => {
      const d = new Date(r[dateCol]);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [summaryData, dateFilter]);

  const filteredDetails = useMemo(() => {
    if (!detailsData) return null;
    const { start, end } = dateFilter || {};
    const dateCol = detailsData.length
      ? Object.keys(detailsData[0]).find((c) => /date/i.test(c))
      : null;
    if (!dateCol || (!start && !end)) return detailsData;
    return detailsData.filter((r) => {
      const d = new Date(r[dateCol]);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [detailsData, dateFilter]);

  // Highlight active TOC link based on visible section
  useEffect(() => {
    const root = document.documentElement;
    const cssVar = getComputedStyle(root)
      .getPropertyValue('--header-offset')
      .trim();
    const headerOffset = cssVar.endsWith('px')
      ? parseFloat(cssVar)
      : Number(cssVar) || 58;
    const topMargin = headerOffset + 8;

    const pickActive = () => {
      // choose the last heading whose top is above the threshold
      const ids = tocSections.map((s) => s.id);
      let current = ids[0];
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.top - topMargin <= 0) {
          current = id;
        }
      });
      setActiveId(current);
    };

    const observer = new IntersectionObserver(
      () => {
        pickActive();
      },
      {
        root: null,
        // Trigger when headings cross just below the sticky header and before bottom of viewport
        rootMargin: `-${topMargin}px 0px -70% 0px`,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    // Observe any headings currently in the DOM
    tocSections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    // Also recompute on hash change (e.g., when user clicks a link)
    const onHash = () => {
      const h = (window.location.hash || '').replace('#', '');
      if (h) setActiveId(h);
    };
    window.addEventListener('hashchange', onHash);

    // Update on scroll/resize to ensure responsiveness in all browsers
    const onScroll = () => pickActive();
    const onResize = () => pickActive();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    // Initial selection
    pickActive();

    return () => {
      observer.disconnect();
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
    // Re-run when data presence changes which may mount/unmount sections
  }, [filteredSummary, filteredDetails, tocSections]);

  return (
    <div className="container">
      <header className="app-header">
        <div className="inner">
          <div className="title">
            <h1>OSCAR Sleep Data Analysis</h1>
            <span className="badge">beta</span>
          </div>
          <ThemeToggle />
          <button
            className="btn-ghost"
            style={{ marginLeft: 8 }}
            onClick={openGuideForActive}
            aria-label="Open Usage Guide"
          >
            Guide
          </button>
        </div>
      </header>
      <nav className="toc">
        {tocSections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={activeId === s.id ? 'active' : undefined}
            onClick={() => setActiveId(s.id)}
          >
            {s.label}
          </a>
        ))}
      </nav>
      <div className="section controls" aria-label="Data and export controls">
        <label>
          Summary CSV:{' '}
          <input type="file" accept=".csv" onChange={onSummaryFile} />
        </label>
        {loadingSummary && (
          <progress value={summaryProgress} max={summaryProgressMax} />
        )}
        <label>
          Details CSV:{' '}
          <input type="file" accept=".csv" onChange={onDetailsFile} />
        </label>
        {(loadingDetails || processingDetails) && (
          <progress
            value={loadingDetails ? detailsProgress : undefined}
            max={loadingDetails ? detailsProgressMax : undefined}
          />
        )}
        {error && (
          <div role="alert" style={{ color: 'red' }}>
            {error}
          </div>
        )}
        <div
          className="control-group"
          aria-label="Session controls"
          style={{ marginTop: 6 }}
        >
          <span className="control-title">Session</span>
          <label title="Enable local session persistence">
            <input
              type="checkbox"
              checked={persistEnabled}
              onChange={(e) => setPersistEnabled(e.target.checked)}
            />{' '}
            Remember data locally
          </label>
          <button
            className="btn-ghost"
            onClick={handleSaveNow}
            disabled={!persistEnabled}
            aria-label="Save session now"
          >
            Save now
          </button>
          <button
            className="btn-ghost"
            onClick={handleLoadSaved}
            aria-label="Load saved session"
          >
            Load saved
          </button>
          <button
            className="btn-ghost"
            onClick={handleClearSaved}
            aria-label="Clear saved session"
          >
            Clear saved
          </button>
          <label
            style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}
            title="Import session JSON"
          >
            Import JSON
            <input
              type="file"
              accept="application/json"
              onChange={handleImportJson}
            />
          </label>
        </div>
        <div className="control-group" aria-label="Export controls">
          <span className="control-title">Export</span>
          <button
            className="btn-primary"
            onClick={handleExportJson}
            disabled={!summaryData && !detailsData}
          >
            Export JSON
          </button>
          <button
            className="btn-primary"
            onClick={() =>
              downloadTextFile(
                'aggregates.csv',
                buildSummaryAggregatesCSV(summaryData || []),
                'text/csv'
              )
            }
            disabled={!summaryData}
          >
            Export Aggregates CSV
          </button>
          <button
            className="btn-primary"
            onClick={() =>
              openPrintReportHTML(
                summaryData || [],
                apneaClusters || [],
                falseNegatives || []
              )
            }
            disabled={!summaryData}
          >
            Open Print Report
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'end',
          }}
        >
          <div>
            <label>
              Filter start{' '}
              <input
                type="date"
                onChange={(e) =>
                  setDateFilter((prev) => ({
                    ...prev,
                    start: e.target.value ? new Date(e.target.value) : null,
                  }))
                }
              />
            </label>
          </div>
          <div>
            <label>
              Filter end{' '}
              <input
                type="date"
                onChange={(e) =>
                  setDateFilter((prev) => ({
                    ...prev,
                    end: e.target.value ? new Date(e.target.value) : null,
                  }))
                }
              />
            </label>
          </div>
          <button onClick={() => setDateFilter({ start: null, end: null })}>
            Reset filter
          </button>
        </div>
      </div>
      {filteredSummary && (
        <div className="section">
          <Overview
            summaryData={filteredSummary}
            clusters={apneaClusters}
            falseNegatives={falseNegatives}
          />
        </div>
      )}
      {filteredSummary && (
        <div className="section">
          <SummaryAnalysis data={filteredSummary} clusters={apneaClusters} />
          <div style={{ marginTop: 8 }}>
            <h2 id="range-compare">
              Range Comparisons{' '}
              <GuideLink anchor="range-comparisons-a-vs-b" label="Guide" />
            </h2>
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                alignItems: 'end',
              }}
            >
              <div>
                <label>
                  Range A start{' '}
                  <input
                    type="date"
                    onChange={(e) =>
                      setRangeA((prev) => ({
                        ...prev,
                        start: e.target.value ? new Date(e.target.value) : null,
                      }))
                    }
                  />
                </label>
              </div>
              <div>
                <label>
                  Range A end{' '}
                  <input
                    type="date"
                    onChange={(e) =>
                      setRangeA((prev) => ({
                        ...prev,
                        end: e.target.value ? new Date(e.target.value) : null,
                      }))
                    }
                  />
                </label>
              </div>
              <button onClick={() => setRangeA(dateFilter)}>
                Use current filter as A
              </button>
              <div style={{ width: 12 }} />
              <div>
                <label>
                  Range B start{' '}
                  <input
                    type="date"
                    onChange={(e) =>
                      setRangeB((prev) => ({
                        ...prev,
                        start: e.target.value ? new Date(e.target.value) : null,
                      }))
                    }
                  />
                </label>
              </div>
              <div>
                <label>
                  Range B end{' '}
                  <input
                    type="date"
                    onChange={(e) =>
                      setRangeB((prev) => ({
                        ...prev,
                        end: e.target.value ? new Date(e.target.value) : null,
                      }))
                    }
                  />
                </label>
              </div>
              <button onClick={() => setRangeB(dateFilter)}>
                Use current filter as B
              </button>
            </div>
            <RangeComparisons
              summaryData={summaryData || []}
              rangeA={rangeA}
              rangeB={rangeB}
            />
          </div>
        </div>
      )}
      {filteredDetails && (
        <>
          <div className="section">
            <ApneaEventStats data={filteredDetails} />
          </div>
          <div className="section">
            <ApneaClusterAnalysis
              clusters={apneaClusters}
              params={clusterParams}
              onParamChange={onClusterParamChange}
              details={filteredDetails}
            />
          </div>
          <div className="section">
            <FalseNegativesAnalysis
              list={falseNegatives}
              preset={fnPreset}
              onPresetChange={setFnPreset}
            />
          </div>
          <div className="section">
            <RawDataExplorer
              summaryRows={summaryData || []}
              detailRows={detailsData || []}
              onApplyDateFilter={({ start, end }) =>
                setDateFilter({ start, end })
              }
            />
          </div>
        </>
      )}
      <DocsModal
        isOpen={guideOpen}
        onClose={() => setGuideOpen(false)}
        initialAnchor={guideAnchor}
      />
    </div>
  );
}

export default App;
