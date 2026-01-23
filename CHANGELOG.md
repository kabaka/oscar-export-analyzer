# Changelog

All notable changes to OSCAR Export Analyzer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project uses [date-based versioning](https://calver.org/) (YYYY-MM-DD)
to track releases as they're deployed to production on the main branch. Each date section
corresponds to changes released on that day.

## 2026-01-23

### Added

- **Comprehensive responsive design for mobile, tablet, and desktop**: Implemented mobile-first responsive design with breakpoints at 768px (mobile/tablet) and 1024px (tablet/desktop). Added `useMediaQuery` hook for viewport detection, `chartConfig.js` utilities for responsive Plotly configurations, and `MobileNav` hamburger menu component for mobile navigation. All chart components automatically apply responsive font sizes, margins, and legend positions. Mobile-first CSS includes responsive typography (16px base on mobile), touch-optimized interactive elements (44×44px minimum touch targets for WCAG AAA compliance), responsive header layout, responsive KPI grid (1 column mobile → 2 tablet → 4 desktop), and responsive chart heights (300px mobile → 400px tablet → 500px desktop). Desktop layout and functionality fully preserved while enabling complete mobile/tablet support.
- **Comprehensive JSDoc comments for complex logic** (Issue #25): Added detailed JSDoc and inline comments to 38+ functions across hooks, utilities, and components including RawDataExplorer helper functions (`rowsToCsv`, `uniqueCols`, `numericColumns`, `dateFromAny`, `formatCell`), CSV worker, analytics worker, time-series analysis, clustering algorithms, and data transformation functions. Documentation includes parameter descriptions, return types, code examples, error handling notes, and references to related functions. Inline comments clarify complex algorithms (filtering, sorting, pivoting) and worker communication patterns.

### Changed

- **Extracted VirtualTable to reusable component** (Issue #3): Extracted 34-line inline VirtualTable from RawDataExplorer.jsx to standalone `src/components/ui/VirtualTable.jsx` component with PropTypes validation, JSDoc documentation, and comprehensive test suite. RawDataExplorer reduced from 483 to 449 lines, improving maintainability and enabling component reuse.
- **Consolidated magic numbers into shared constants** (Issue #15): Refactored 31 magic numbers across 13 files into semantic constants in `src/constants/` (PERCENTILES, CLUSTER_PRESETS, TABLE_DEFAULTS, CANVAS_OPTIONS) with JSDoc documentation. Eliminated scattered literals for percentile thresholds, cluster parameters, table configurations, and canvas sizes, improving maintainability and reducing duplication.

### Fixed

- **Analytics worker race condition** (Issue #11 follow-up): Fixed test failures in `App.analyticsFallback.test.jsx` and `App.analyticsWorker.test.jsx` caused by `useAnalyticsWorker` job tracking race condition. Replaced state-based job tracking with ref-based tracking to ensure proper staleness detection when worker callbacks fire before React state updates are applied. All tests now pass.
- **Prop drilling reduced with granular hooks** (Issue #2): Refactored DateRangeControls, ApneaClustersSection, FalseNegativesSection, and RangeComparisonsSection to use granular context hooks (`useDateFilter`, `useClusterParams`, `useFalseNegatives`, `useRangeComparisons`) instead of receiving 8+ props from App.jsx, reducing coupling and improving component reusability. All 467 tests pass including comprehensive accessibility test coverage.

### Added

- **PropTypes validation for all components** (Issue #13): Added comprehensive PropTypes to 24 components across `src/components/`, `src/features/`, `src/components/ui/`, and `src/app/`, improving type safety and developer experience. All components receiving props now validate prop types at runtime during development.
- **Consistent ErrorAlert component** (Issue #14): Created reusable `ErrorAlert.jsx` component with comprehensive accessibility features (WCAG 2.1 AA compliant), semantic HTML, ARIA attributes, keyboard navigation, and 47 test cases. Deployed across App.jsx, RawDataExplorer.jsx, and all major sections for consistent error UX.
- **Documentation for date serialization strategy** (Issue #9): Added comprehensive JSDoc comments in csv.worker.js and analytics.worker.js explaining ISO 8601 date serialization for Web Worker postMessage (structured clone algorithm requires string serialization since Date objects aren't directly transferable).
- **CI quality gates** enforcing bundle size limits (2.6MB gzipped max), security audit (moderate+ vulnerabilities), and test coverage thresholds (80% minimum line coverage)
- **67 comprehensive accessibility tests** for HeaderMenu (17 tests), DateRangeControls (26 tests), and DataImportModal (24 tests) covering keyboard navigation, ARIA attributes, and focus management
- **Accessibility Testing Patterns guide** in testing-patterns.md documenting keyboard navigation tests, ARIA attribute verification, focus management tests, and best practices for WCAG 2.1 AA compliance
- **Coverage baseline measurement** with Vitest v8 provider achieving 89.87% line coverage and 71.38% branch coverage across 431 tests
- Coverage configuration in vite.config.js with HTML, text, and JSON reporters
- Accessibility guide documenting WCAG 2.1 AA compliance, keyboard navigation, screen reader support, color contrast standards, focus management, and testing practices
- AGENTS.md contributor guide with AI agent workflow patterns
- Working directory policy for temporary files (`docs/work/`, `temp/`)
- Magic numbers audit reporting system
- Data science evaluation reports with algorithm validation
- Copilot agent specifications for orchestrated development

### Changed

- Raised CSV upload limit from 50MB to 150MB for larger datasets
- Refactored CONTRIBUTING.md as human-focused guide with clear workflows
- **Refactored inline style objects to CSS classes** (Issue #23): Replaced 38 inline style objects with semantic CSS classes across App, RawDataExplorer, DataImportModal, AhiTrendsCharts, and EpapTrendsCharts for improved maintainability, theme support, and reduced runtime style calculations. Dynamic styles (chart heights, scroll positions) preserved as inline where necessary.
- Enhanced JSDoc coverage across codebase
- Improved clustering documentation with density metrics and FLG hysteresis explanations
- Adopted date-based CHANGELOG workflow where agents add entries directly to current date section
- Update developer report to mark completed high-priority items (Issues #1, #7, #19, #22)
- **Split AppStateContext and GuideContext** to prevent unnecessary re-renders when guide modal state changes independently from app state
- **Refactored useAnalyticsProcessing hook** to reduce complexity from 179 to 59 lines by extracting normalization utilities to `src/utils/normalization.js` (with comprehensive tests) and worker communication logic to `useAnalyticsWorker` hook

### Security

- Implemented Content Security Policy (CSP) for XSS defense
- Added input sanitization for all worker message payloads
- Hardened DOMPurify configuration for HTML sanitization
- **Added comprehensive error boundaries to Web Worker message handlers** in csv.worker.js and analytics.worker.js with try-catch wrappers, malformed message validation, and proper error communication back to main thread
- Applied secure coding practices across data handling paths

### Fixed

- Test timeout issues in App.toc-active.test.jsx and App.navigation.test.jsx under coverage instrumentation (increased async timeouts to 6000ms)
- Eliminated all 489 ESLint warnings for improved code quality
- Resolved analytics worker race conditions
- Fixed out-of-memory issues in hook tests
- Improved worker flow stability and error handling
- Fixed chart theme helper to handle null layouts gracefully

## 2026-01-21

Initial production release with comprehensive CPAP data analysis capabilities.

### Added

#### Core Features

- CSV parsing for OSCAR Summary and Details exports with progress tracking
- Web Worker architecture for responsive UI during heavy computations
- IndexedDB session persistence with auto-save and manual save/load
- JSON session export/import for reproducible analysis
- Date range filtering across all visualizations
- Cross-chart brushing for interactive data exploration

#### Visualization Suite

- **Overview Dashboard**: KPI cards with sparklines showing therapy metrics at a glance
- **Usage Patterns**: Time series, histograms, box plots, STL decomposition, calendar heatmap, autocorrelation diagnostics
- **AHI Trends**: Nightly AHI with optional OA/CA/MA stacking, change-point detection, severity bands, violin and QQ plots
- **EPAP Analysis**: Pressure trends over time, correlation matrix, titration helper with Mann-Whitney U tests, 2D density plots
- **Event Clusters**: Density-aware apnea cluster detection with configurable parameters, severity scoring, sortable table
- **False Negatives**: Detection of potential unreported apnea events based on flow limitation patterns
- **Raw Data Explorer**: Virtualized table with filtering, sorting, pivot summary, CSV export

#### Statistical Analysis

- Rolling averages with confidence intervals (7-day and 30-day windows)
- LOESS smoothing for trend visualization
- PELT-like change-point detection for identifying therapy adjustments
- Mann-Whitney U tests with rank-biserial effect sizes for EPAP stratification
- Kaplan-Meier survival curves for apnea event durations
- Pearson and partial correlation analysis
- STL decomposition (seasonal-trend decomposition using LOESS)
- Autocorrelation (ACF) and partial autocorrelation (PACF) diagnostics
- K-means clustering validation

#### User Experience

- Light/dark/system theme toggle with theme-aware charts
- In-app documentation viewer with deep-linking to active sections
- Print-friendly report generation (save as PDF via browser)
- Aggregated metrics CSV export
- Responsive design for various screen sizes
- Keyboard navigation and accessibility features
- Help tooltips on all charts explaining metrics and visualizations

#### Developer Tools

- Comprehensive test suite with Vitest and Testing Library
- Husky pre-commit hooks for linting, testing, and building
- GitHub Actions CI workflow for continuous integration
- ESLint and Prettier configuration for code quality
- Feature-first project structure for maintainability
- Centralized constants and test fixtures
- CLI analysis tool (`analysis.js`) for batch processing

### Changed

- Migrated from inline HTML/JS to modern React + Vite architecture (July 2025)
- Refactored to feature-first directory layout for improved code organization
- Optimized rolling calculations from O(n²) to O(n) for better performance
- Split large chart components for better maintainability
- Unified chart styling and theming across all visualizations
- Enhanced bad-night tagging with multi-factor explanations (high AHI, high CA%, long clusters)

### Fixed

- FLG (flow limitation) threshold and boundary extension logic in clustering algorithm
- Parsing progress bar accuracy with determinate progress tracking
- Worker thread race conditions and cancellation handling
- Dark mode theming consistency across all Plotly charts
- Chart rendering issues with axis labels, titles, and legends
- Memory leaks in virtualized table rendering
- Date parsing for various CSV date formats
- Statistical edge cases (empty inputs, NaN handling, tie handling in Mann-Whitney)

## 2025-08-10

### Added

- Raw Data Explorer with virtualized table for browsing all parsed rows
- Session persistence to IndexedDB with debounced auto-save
- JSON export/import for sharing analysis sessions
- Print-friendly report with aggregated metrics CSV export
- In-app user guide modal with Markdown rendering and deep-linking
- Analytics worker for offloading statistical computations
- Cross-chart date range filtering
- Date range controls in header for global filtering

### Changed

- Enhanced header layout with improved menu and date filter placement
- Improved data import modal styling and user flow
- Streamlined session persistence controls

### Fixed

- Sticky header scroll offset in documentation viewer
- Session preservation when no files are loaded
- Tooltip ID generation for deterministic testing

## 2025-08-09

### Added

- Parameter controls for clustering algorithm tuning
- Density-aware clustering with FLG hysteresis (separate enter/exit thresholds)
- Severity scoring for apnea clusters
- Sortable cluster table with CSV export
- Bad-night tagging with detailed explanations (high AHI, outliers, high CA%, long/dense clusters)
- Time-above-leak threshold charts when available in data
- STL decomposition visualizations for usage and AHI trends
- Autocorrelation and partial autocorrelation diagnostics
- Advanced statistical functions: LOESS smoother, PELT change-point detection, Kaplan-Meier survival
- Partial correlation analysis for multivariate relationships
- Date-aware rolling windows with confidence intervals
- Help tooltips on all charts with metric explanations

### Changed

- Improved Plotly chart theming with consistent dark/light mode support
- Enhanced correlation matrix visualization with dark-mode friendly colors
- Refined chart layouts with explicit axis titles and legends
- Better handling of Plotly compatibility across versions

### Fixed

- Chart theme switching now forces Plotly remount for consistent rendering
- Dark mode grid and zero-line colors improved for readability
- Heatmap colorscales optimized for dark backgrounds
- Violin and QQ plot theming

## 2025-07-30

### Added

- Light/dark/system theme toggle
- Theme-aware chart rendering for all Plotly visualizations
- Polished UI layout with improved tables and buttons
- Table of contents with active section highlighting via IntersectionObserver
- Sticky header with automatic anchor scroll offset
- LOESS regression curves on EPAP vs AHI scatter plots
- Mann-Whitney U test with exact calculation for small samples and rank-biserial effect size
- Improved EPAP correlation matrix with statistical significance

### Changed

- Refined button and input styling for better contrast and accessibility
- Enhanced table styling with sticky headers and alternating row colors
- Improved navigation with smooth scrolling to sections

### Fixed

- Plotly chart axis title rendering normalized to object format
- Active TOC section highlighting on scroll
- Z-index layering for sticky elements

## 2025-07-14

Initial alpha release.

### Added

- React-based web application for OSCAR CSV analysis
- CSV parsing with PapaParse and Web Worker architecture
- Progress bars for determinate parsing progress
- Overview Dashboard with KPI cards and summary statistics
- Usage Patterns charts: time series, histograms, box plots with rolling averages
- AHI Trends charts: nightly values, change-points, severity distribution
- EPAP Analysis: box plots, time series, scatter plots with regression
- Apnea Event Clusters detection with configurable thresholds
- False Negatives detection based on flow limitation patterns
- Summary analysis with quartiles, IQR, and outlier detection
- Interactive Plotly charts with zoom, pan, and legend controls
- Comprehensive testing infrastructure with Vitest and Testing Library
- Husky pre-commit hooks for code quality
- GitHub Actions CI workflow
- CLI tool for batch apnea cluster analysis
- TODO.md roadmap document

### Changed

- Refactored from prototype to modern React/Vite structure
- Migrated from basic charts to full Plotly interactive visualizations
- Refined clustering algorithm to focus on Obstructive and Central Airway events
- Optimized FLG event filtering for performance

### Fixed

- FLG duration threshold bug in clustering
- Parsing progress bar with chunk-based accumulation
- Worker thread event filtering
- Chart responsiveness and layout issues
