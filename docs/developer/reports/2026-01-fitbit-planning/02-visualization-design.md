# Fitbit+CPAP Correlation: Visualization & UX Design

**Document Date**: January 24, 2026  
**Target Users**: Data scientists, bioinformaticians, clinicians, statistics professionals  
**Design Goals**: Empower exploration of multidimensional sleep therapy data while maintaining accessibility and cognitive clarity

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Core Visualization Concepts](#core-visualization-concepts)
3. [Information Architecture](#information-architecture)
4. [Layout & Navigation Patterns](#layout--navigation-patterns)
5. [Accessibility Framework](#accessibility-framework)
6. [Responsive Design Strategy](#responsive-design-strategy)
7. [Interaction Patterns](#interaction-patterns)
8. [Mobile Considerations](#mobile-considerations)
9. [Cognitive Load Management](#cognitive-load-management)
10. [Implementation Guidance](#implementation-guidance)

---

## Design Philosophy

The Fitbit+CPAP visualization suite balances **discovery** with **clarity**:

- **For explorers**: Rich multidimensional data, deep drill-down, statistical rigor
- **For clinicians**: Actionable insights highlighted prominently, medical terminology precise
- **For accessibility**: WCAG AA compliance, keyboard-first navigation, colorblind-safe by default
- **For mobile users**: Progressive disclosure, responsive layout, touch-friendly controls

**Key principle**: No single visualization tells the whole story. Instead, provide layered views that build understanding incrementally—summary first, then details on demand.

---

## Core Visualization Concepts

### 1. **Dual-Axis Synchronization View** (Primary Overview)

**Purpose**: Establish temporal relationship between CPAP metrics and Fitbit signals within a single night

**Design**:

- **Primary axis (left)**: Heart rate trend line (gray baseline + colored zones for intensity)
- **Primary axis (right)**: AHI events (scatter points or bar chart) or pressure settings
- **Time-aligned**: Both datasets locked to minute-by-minute sleep duration
- **SpO2 overlay**: Semi-transparent band showing SpO2 range (good/alert colors)
- **Sleep stages**: Background color wash (light purple = N1, deeper = N3, blue = REM)

**Visual Encoding**:

```
Moment-by-moment:
  - Heart rate: Line (gray) + filled area for elevated periods (orange/red if >90th percentile)
  - SpO2: Vertical band colored by threshold zones (green ≥95%, yellow 90-95%, red <90%)
  - AHI events: Overlaid circles sized by severity (apnea type ∈ {apnea, hypopnea})
  - Pressure settings: Stepped line or heatmap background
  - Sleep stage: Background color progression (N1→N2→N3→REM)
```

**Interaction**:

- Hover: Shows exact values + timestamps + event details (leak, HR variability)
- Brush: Select time window to zoom and inspect details
- Toggle: Show/hide individual signals (HR, SpO2, AHI, pressure, sleep stage)
- Click events: Drill to event detail modal

**Accessibility**:

- `aria-label`: "Heart rate trend and AHI events for night of YYYY-MM-DD"
- `aria-describedby`: Links to data table summarizing chart
- Keyboard nav: Tab to visible signals, arrow keys to pan/zoom
- Color + shape: HR line is solid, SpO2 is band, AHI are circles (not color-dependent)

**Responsive behavior**:

- Desktop: Full multi-axis chart (height ~400px)
- Tablet: Slightly compressed, legend moves below
- Mobile: Stack as separate simplified charts OR use swipeable carousel

---

### 2. **Multi-Metric Correlation Matrix (Statistical Overview)**

**Purpose**: Show pairwise correlations across multiple metrics (HR, SpO2, AHI, pressure, sleep efficiency, activity)

**Design**:

- **Heatmap grid**: Metrics on both axes; cell color indicates correlation strength (blue = positive, red = negative, white = uncorrelated)
- **Cell values**: Pearson r + p-value badge (show statistical significance)
- **Sorting options**: Cluster by correlation similarity, sort by strength, group by metric type
- **Row/column toggles**: Show only metrics of interest (e.g., "compare HR + SpO2 + AHI")

**Visual Encoding**:

```
Cell coloring (diverging scale):
  - Strong positive (r > 0.7): Deep blue
  - Moderate positive (0.4–0.7): Light blue
  - Weak/none (−0.2–0.2): White/light gray
  - Moderate negative (−0.7 to −0.4): Light red
  - Strong negative (r < −0.7): Deep red

p-value badge on each cell:
  - *** for p < 0.001 (highly significant)
  - ** for p < 0.01
  - * for p < 0.05
  - (ns) for p ≥ 0.05 (not significant)
```

**Interaction**:

- Click cell: Open bivariate scatter plot for that metric pair
- Hover: Shows full correlation details + clinical interpretation
- Filter: Date range, event type, therapy settings
- Export: Download correlation matrix as CSV

**Accessibility**:

- `role="table"` with proper headers
- Data table view: Alternative to heatmap showing all values in accessible format
- Color + symbol: Correlation strength also indicated by intensity, p-value by badge type
- Screen reader: "Row: Heart Rate, Column: AHI, Correlation: 0.45, p-value: <0.001"

---

### 3. **Bivariate Density Heatmap** (Pattern Detection)

**Purpose**: Reveal density clusters and relationships between two metrics (e.g., SpO2 vs HR colored by AHI)

**Design**:

- **X-axis**: One metric (e.g., SpO2)
- **Y-axis**: Another metric (e.g., Heart Rate)
- **Color encoding**: Third dimension (e.g., AHI severity, proportion of REM sleep)
- **Hexbin or contour density**: Show concentration of observations
- **Outlier overlay**: Individual points for extreme cases

**Visual Encoding**:

```
Example: SpO2 (x) vs Heart Rate (y) colored by AHI severity

Density visualization:
  - Background: Contour density heatmap (white = sparse, blue = dense)
  - Outliers: Circle markers for points beyond 2 SD (colored by AHI intensity)
  - Quadrant lines: Clinical thresholds (e.g., SpO2 ≥95%, HR <60 = baseline)
  - Annotation: Number of nights in each quadrant
```

**Interaction**:

- Hover: Show all relevant metrics for that point (SpO2, HR, AHI, date, sleep stage)
- Click point: Open night detail panel for that observation
- Brush: Select region; highlight corresponding nights in gallery
- Toggle third dimension: Switch color coding (AHI → pressure → sleep efficiency)

**Accessibility**:

- Data table: Tabular view of all points with sorting/filtering
- Color + size: Encoded by size/pattern in addition to hue
- ARIA: "Density plot: SpO2 vs Heart Rate, showing AHI severity. 342 nights plotted."

---

### 4. **Temporal Event Alignment (Stream Graph with Events)**

**Purpose**: Show how sleep stages evolve across the night with overlaid events (AHI, HR dips, SpO2 desaturation)

**Design**:

- **Base**: Stream graph showing sleep stage proportion over time (flowing bands for N1, N2, N3, REM)
- **Overlays**:
  - AHI events: Downward spikes from stage bands
  - SpO2 dips: Color flashes on band (orange = mild, red = severe)
  - HR anomalies: Pulse markers or brief color pulses
- **Time axis**: Full night duration (typically 22:00–07:00)
- **Height**: Sleep stage depth (deeper = more time in that stage at that point)

**Visual Encoding**:

```
Sleep stages:
  - N1: Light purple, semi-transparent
  - N2: Medium purple
  - N3: Deep purple
  - REM: Blue with rapid eye movement indicator

Event overlay:
  - AHI spike: Downward line from stage boundary, width = apnea duration
  - SpO2 dip: Color wash on stage (orange/red intensity = severity)
  - HR acceleration: Upward pulse or marker on event
```

**Interaction**:

- Hover: Shows all events in that time window + metrics
- Click event: Drill to event detail (pressure, settings, exact metrics)
- Zoom: Select time range to expand and inspect
- Filter by event type: Show only AHI, SpO2, or HR events

**Accessibility**:

- Sequential table: Show events in chronological order with full details
- ARIA: "Stream chart showing sleep stage progression with overlaid AHI events"
- Color + symbol: Events marked by type symbol, not color alone

---

### 5. **Night Comparison View (Parallel Nights)**

**Purpose**: Compare therapy effectiveness and metrics across selected nights (2–5 nights side-by-side)

**Design**:

- **Column layout**: One column per night
- **Shared metrics**: Each column shows same visualization (dual-axis chart or heatmap)
- **Synchronized axes**: All columns share Y-axis scales for direct comparison
- **Night selector**: Gallery or date picker to add/remove comparison nights
- **Metric toggle**: Switch between chart types (time-series vs heatmap vs metrics dashboard)

**Visual Encoding**:

```
Column headers:
  - Date + night summary (AHI avg, HR avg, SpO2 min, sleep stages %)
  - Therapy settings (EPAP, IPAP, ramp time)
  - Overall quality score (derived from metrics)

Body:
  - Identical chart type in each column
  - Synchronized colors across columns
  - Summary statistics below chart
```

**Interaction**:

- Click to add/remove nights: Modal night selector
- Reorder columns: Drag to reorder (e.g., sort by AHI, HR, SpO2 min)
- Metric preset buttons: "Show HR only", "Show SpO2 + AHI", etc.
- Export: Download comparison as multi-chart PDF

**Accessibility**:

- Keyboard nav: Tab through columns, arrow keys to compare
- Alt text: Each chart column has descriptive alt text
- Tabular export: HTML table for screen readers

---

### 6. **Statistical Relationship Scatterplot (Correlation Explorer)**

**Purpose**: Investigate causal relationships between metrics with regression overlay and confidence intervals

**Design**:

- **X-axis**: Independent variable (e.g., therapy EPAP setting)
- **Y-axis**: Dependent variable (e.g., AHI)
- **Points**: Individual nights, sized by confidence/sample duration, colored by additional dimension (SpO2 severity, HR variability)
- **Regression line**: LOWESS or linear fit + confidence band (95% CI)
- **Residual visualization**: Optional histogram of residuals for assessment of fit quality

**Visual Encoding**:

```
Scatter points:
  - Position: EPAP (x) vs AHI (y)
  - Color: SpO2 dip frequency (gradient blue to red)
  - Size: Sleep duration (larger = longer night)
  - Transparency: Residual magnitude (opaque = fits well, faded = outlier)

Regression:
  - Line: LOWESS smooth or least-squares fit
  - Band: 95% confidence interval (light shade)
  - Annotation: r², p-value, equation (if linear)
```

**Interaction**:

- Hover: Shows night date, all metrics, residual value
- Click point: Open night detail panel
- Brush for filtering: Select points; refit line to subset
- Metric selector: Swap x/y variables; add color dimension
- Regression type toggle: Linear vs LOWESS vs polynomial

**Accessibility**:

- Data table: Export all points with residuals
- ARIA: "Scatter plot: EPAP vs AHI with LOWESS regression. 92 nights plotted. R² = 0.62, p < 0.001."
- Color + size: Relationships not encoded by color alone

---

### 7. **Outlier & Anomaly Detection Dashboard**

**Purpose**: Flag unusual nights and interesting patterns for investigation

**Design**:

- **Card-based layout**: Each card represents a flagged anomaly (e.g., "Unusually high HR on low AHI night", "SpO2 dip without apnea event")
- **Visual summary**: Small sparkline or icon showing the anomaly
- **Statistical context**: How unusual (z-score, percentile rank)
- **Action buttons**: "Inspect night", "Add to comparison", "Export data"

**Visual Encoding**:

```
Anomaly cards:

1. "Low AHI, High HR Variability"
   - Icon: HR heartbeat with alert marker
   - Sparkline: HR trend for that night
   - Stat: "HR std.dev = 2.3 SD above mean"
   - Date + metrics: "2026-01-22: AHI=2.1, HR=85±18"

2. "SpO2 Dip Without Apnea"
   - Icon: SpO2 arrow down with question mark
   - Sparkline: SpO2 dip event
   - Stat: "3 dips; 0 AHI events"
   - Date + metrics: "2026-01-23: SpO2 min=91%, AHI=1.8"

3. "REM Sleep Pressure Event"
   - Icon: REM marker with pressure indicator
   - Sparkline: Pressure + REM overlap
   - Stat: "Pressure spike during REM (unusual)"
   - Date: "2026-01-24"
```

**Interaction**:

- Click card: Open full night detail view
- Filter: Show only anomalies of type X (HR, SpO2, pressure, etc.)
- Sort: By severity, date, frequency
- Subscribe: Alert if similar anomaly detected in future

**Accessibility**:

- Semantic cards: `<article role="region">`
- ARIA labels: Describe anomaly type and severity
- Text-based: Anomalies explained in plain language + statistics

---

## Information Architecture

### High-Level Structure

```
Fitbit+CPAP Analysis
├── 📊 Dashboard (summary overview)
│   ├─ Key metrics (avg HR, SpO2 min, AHI, correlation strength)
│   ├─ Anomaly alerts (3–5 most interesting findings)
│   └─ Quick action buttons (explore night, compare nights, run analysis)
│
├── 🔍 Explore
│   ├─ Single Night View
│   │  ├─ Dual-axis sync chart (HR, SpO2, AHI, pressure, sleep stage)
│   │  ├─ Metrics dashboard (summary stats, event counts)
│   │  └─ Events table (drill-down to individual events)
│   │
│   ├─ Multi-Night Gallery
│   │  ├─ Night cards: thumbnail + summary metrics + quality score
│   │  ├─ Sorting/filtering (by AHI, HR variability, SpO2, date range)
│   │  └─ Batch actions (add to comparison, export)
│   │
│   └─ Comparison View
│      ├─ Side-by-side night charts
│      ├─ Metric toggles (time-series, heatmap, stats)
│      └─ Difference highlighting (show improvement/decline)
│
├── 📈 Analysis
│   ├─ Correlation Matrix (heatmap + statistics)
│   ├─ Bivariate Scatter (explore metric pairs with regression)
│   ├─ Trend Analysis (rolling averages, seasonal patterns)
│   └─ Anomaly Detection (flagged unusual nights)
│
├── ⚙️ Controls & Filters (across all views)
│   ├─ Date range selector (quick presets: last week, month, 3 months)
│   ├─ Metric filter (show HR, SpO2, AHI, pressure, sleep stages, activity)
│   ├─ Event type filter (apnea, hypopnea, central events, SpO2 dips)
│   ├─ Therapy setting range filter (pressure levels, ramp settings)
│   └─ Statistical threshold selector (p-value, effect size minimum)
│
└─ 📚 Documentation (inline help)
   ├─ Tooltips on all metrics and controls
   ├─ "Why is this interesting?" badges on correlations
   ├─ Links to medical terminology glossary
   └─ Export options (PDF, CSV, PNG charts)
```

---

## Layout & Navigation Patterns

### Desktop Layout (1440px+)

```
┌─────────────────────────────────────────────────────────┐
│  Header: OSCAR Fitbit+CPAP Analysis  [Date Range] [Help] │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Quick Filters (sticky):                            │ │
│  │ [📅 Last 7 days ▼] [❤️ HR][🫁 SpO2][📊 AHI]... │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  Main Content (tabs):                                   │
│  ┌────────────────────────────────────────────────────┐ │
│  │ 📊 Dashboard │ 🔍 Explore │ 📈 Analysis │ ⚙️ Config │ │
│  ├────────────────────────────────────────────────────┤ │
│  │                                                    │ │
│  │  [Active Tab Content Below]                       │ │
│  │                                                    │ │
│  │  Full-width chart or content area                 │ │
│  │  (responsive to content)                          │ │
│  │                                                    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Sidebar Navigation** (optional left sidebar for dense navigation):

- Collapses to icon-only on < 1200px
- Contains quick jumps to sections (Single Night, Compare, Analysis)
- Pinnable for persistent access

### Tablet Layout (768px–1439px)

```
┌─────────────────────────────────────────────────────┐
│ Header: OSCAR Analysis  [Menu ≡] [Help]             │
├─────────────────────────────────────────────────────┤
│                                                     │
│ [📅 Last 7 days] [❤️ HR ✕ ] [🫁 SpO2 ✕] ... ▾   │
│                                                     │
│ Tab navigation (horizontal scroll if overflow):   │
│ 📊 Dashboard │ 🔍 Explore │ 📈 Analysis │          │
│                                                     │
│ Single-column content                             │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ Chart/Content Area (full width)             │   │
│ │ [Adapts to tablet orientation]              │   │
│ │                                             │   │
│ │ Height: reduced, may use horizontal scroll  │   │
│ │ for complex charts                          │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ Legend and controls below chart                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Mobile Layout (<768px)

```
┌────────────────────────────────────────────┐
│ Header: Fitbit+CPAP [Menu ≡]              │
├────────────────────────────────────────────┤
│                                            │
│ [📅 Last 7 days ▼]                        │
│                                            │
│ Filters (collapsible accordion):          │
│ ┌────────────────────────────────────────┐│
│ │ ▶ Metrics (HR, SpO2, AHI, ...)        ││
│ │ ▶ Event Types (Apnea, Hypopnea, ...)  ││
│ │ ▶ Settings (Pressure Range, ...)      ││
│ └────────────────────────────────────────┘│
│                                            │
│ Navigation (horizontal tabs or buttons):  │
│ ┌────────────────────────────────────────┐│
│ │ Dashboard │ Explore │ Analysis         ││
│ │ ← (show active indicator)              ││
│ └────────────────────────────────────────┘│
│                                            │
│ ┌────────────────────────────────────────┐│
│ │ Content Area (full width, single col)  ││
│ │                                        ││
│ │ Charts stack vertically or use         ││
│ │ swipeable carousel for comparisons     ││
│ │                                        ││
│ │ (Height: 250–350px per chart)          ││
│ └────────────────────────────────────────┘│
│                                            │
│ Quick actions / metadata below            │
│                                            │
└────────────────────────────────────────────┘
```

---

## Accessibility Framework

### WCAG AA Compliance Checklist

#### Color & Contrast

- ✅ **Contrast ratio**: All text ≥ 4.5:1 (normal), ≥ 3:1 (large); chart elements ≥ 3:1
- ✅ **Colorblind-safe palettes**:
  - Primary: Blues (0–100%), Grays (neutral), Greens (good), Oranges/Reds (alert)
  - Avoid red+green alone; use patterns/textures in addition to color
  - Test with Coblis or similar simulator before deployment
- ✅ **Dark mode support**: Colors adapt to dark backgrounds; contrast maintained

#### Keyboard Navigation

- ✅ **Tab order**: Logical flow—filters → charts → controls → details
- ✅ **Focus indicators**: Visible outline (≥2px) on all interactive elements
- ✅ **Keyboard shortcuts**:
  - `Escape` to close modals
  - `Arrow keys` to navigate chart data points
  - `Enter` to select/drill
  - `Space` to toggle filters
  - `/` to focus search
- ✅ **No keyboard trap**: User can always tab forward/backward

#### Screen Reader & Semantics

- ✅ **ARIA labels & descriptions**:

  ```html
  <!-- Example for dual-axis chart -->
  <div
    role="img"
    aria-label="Heart rate and AHI events for night of 2026-01-24"
    aria-describedby="chart-details"
  >
    <!-- Chart SVG or canvas -->
  </div>
  <div id="chart-details">
    Average heart rate: 62 bpm, peak: 89 bpm. AHI events: 8 (5 apneas, 3
    hypopneas). Sleep stages: 15% N1, 40% N2, 20% N3, 25% REM.
  </div>
  ```

- ✅ **Data tables**: Every chart has accessible table equivalent

  ```html
  <table aria-label="Night of 2026-01-24 metrics">
    <thead>
      <tr>
        <th>Time</th>
        <th>HR (bpm)</th>
        <th>SpO2 (%)</th>
        <th>AHI Event</th>
      </tr>
    </thead>
    <tbody>
      <!-- Data rows -->
    </tbody>
  </table>
  ```

- ✅ **Semantic HTML**: Use `<main>`, `<section>`, `<article>`, `<nav>` appropriately
- ✅ **Headings hierarchy**: Proper `<h1>` → `<h2>` → `<h3>` structure
- ✅ **Lists**: Use `<ul>`, `<ol>`, `<li>` for metric lists and options
- ✅ **Form controls**: Proper `<label>` association, `aria-label` for icon buttons

#### Focus Management

- ✅ **Modal focus**: Focus traps inside modal; returns to trigger when closed
- ✅ **Loading states**: ARIA live region announces data loading completion
- ✅ **Error messages**: Linked to form fields; announced immediately
- ✅ **Dynamic content**: Use `aria-live="polite"` for chart updates

#### Alternative Content

- ✅ **Image alt text**: All chart exports and screenshots have descriptive alt text
- ✅ **PDF exports**: Include accessible tables and text descriptions
- ✅ **Data download**: CSV/JSON export includes all chart data + metadata

---

### Accessibility Implementation Patterns

#### Pattern 1: Accessible Chart with Data Table Toggle

```jsx
export function AccessibleChart({ chartId, title, data }) {
  const [showTable, setShowTable] = React.useState(false);

  return (
    <section className="chart-section" aria-labelledby={`${chartId}-title`}>
      <h2 id={`${chartId}-title`}>{title}</h2>

      <button
        onClick={() => setShowTable(!showTable)}
        aria-label={`Toggle ${showTable ? 'chart' : 'data table'} view`}
        className="sr-only-focus"
      >
        {showTable ? '📊 Show Chart' : '📋 Show Data'}
      </button>

      {!showTable && (
        <div
          role="img"
          aria-label={`Chart: ${title}. ${getChartDescription(data)}`}
          aria-describedby={`${chartId}-description`}
          className="chart-container"
        >
          {/* Plotly chart or SVG */}
        </div>
      )}

      <div id={`${chartId}-description`} className="sr-only">
        {/* Detailed textual description */}
      </div>

      {showTable && <AccessibleDataTable data={data} title={title} />}
    </section>
  );
}
```

#### Pattern 2: Color-Blind Safe Palette

```js
export const chartColorPalette = {
  primary: {
    blue: '#0173B2', // WCAG AAA on white/dark
    orange: '#DE8F05', // Alert state, distinct from blue
    gray: '#666666', // Neutral, baseline
    green: '#029E73', // Positive outcome (if used)
    red: '#D45113', // Alert/danger (high values), distinct from green
  },

  // Patterns/textures for additional encoding
  patterns: {
    solidFill: 'none',
    stripedHorizontal: 'url(#stripes-h)',
    stripedVertical: 'url(#stripes-v)',
    dots: 'url(#dots)',
  },

  // Semantic color mapping (not color-dependent alone)
  semantic: {
    good: { color: '#029E73', pattern: 'none' }, // Green + solid
    warning: { color: '#DE8F05', pattern: 'stripedHorizontal' }, // Orange + stripes
    alert: { color: '#D45113', pattern: 'dots' }, // Red + dots
    neutral: { color: '#666666', pattern: 'none' }, // Gray
  },
};

// Usage: Encode by color AND pattern
const metricEncoding = {
  goodValue: { fill: '#029E73' }, // Solid color
  warningValue: { fill: '#DE8F05', strokeDasharray: '3,3' }, // Striped
  alertValue: { fill: '#D45113', opacity: 0.7 }, // Red + faded
};
```

#### Pattern 3: Keyboard Navigation for Charts

```jsx
export function InteractiveChart({ data, onPointSelect }) {
  const [focusedIndex, setFocusedIndex] = React.useState(null);
  const containerRef = React.useRef();

  const handleKeyDown = (e) => {
    if (focusedIndex === null) {
      if (e.key === 'Enter' || e.key === ' ') {
        setFocusedIndex(0); // Focus first point
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        setFocusedIndex(Math.min(focusedIndex + 1, data.length - 1));
        e.preventDefault();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        setFocusedIndex(Math.max(focusedIndex - 1, 0));
        e.preventDefault();
        break;
      case 'Enter':
      case ' ':
        onPointSelect(data[focusedIndex]);
        e.preventDefault();
        break;
      case 'Escape':
        setFocusedIndex(null);
        containerRef.current?.focus();
        e.preventDefault();
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      tabIndex="0"
      role="region"
      aria-label="Interactive chart, press Enter to navigate data points"
    >
      {/* Chart rendering with visual focus indicator */}
      {focusedIndex !== null && (
        <div className="focus-indicator" aria-live="polite" aria-atomic="true">
          Focused: {data[focusedIndex].label}
        </div>
      )}
    </div>
  );
}
```

---

## Responsive Design Strategy

### Breakpoints & Adaptation

#### Desktop (1440px+)

- **Chart height**: 400–500px (enough detail)
- **Layout**: Multi-column where appropriate (side-by-side comparisons, matrix view)
- **Legend**: Positioned beside or below chart
- **Interactions**: Hover tooltips, brush/zoom, click details
- **Text size**: 14px body, 24px headings (web standard)

#### Tablet (768px–1439px)

- **Chart height**: 300–400px (reduced but readable)
- **Layout**: Single column, full width with consistent padding
- **Legend**: Moved below chart if space constrained
- **Interactions**: Touch-optimized (larger tap targets ≥48px), long-press for details
- **Text size**: 14px body, 20px headings

#### Mobile (<768px)

- **Chart height**: 250–300px (portrait), 200px (landscape)
- **Layout**: Vertical stack, single column
- **Legend**: Collapsible or in separate tab
- **Interactions**:
  - Swipe left/right to navigate between chart views
  - Tap to drill-down instead of hover
  - Long-press for context menu
- **Text size**: 16px body (avoids zoom trigger on iOS), 18px headings
- **Touch targets**: 44×44px minimum for all buttons/controls

### CSS-in-JS Responsive Patterns

```jsx
import styled from 'styled-components';

export const ChartContainer = styled.div`
  width: 100%;
  padding: 1rem;

  /* Mobile-first */
  .chart-wrapper {
    height: 250px;
    margin: 1rem 0;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    overflow: hidden;
  }

  .chart-legend {
    margin-top: 1rem;
    font-size: 13px;
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }

  /* Tablet */
  @media (min-width: 768px) {
    padding: 2rem;

    .chart-wrapper {
      height: 350px;
    }

    .chart-legend {
      position: absolute;
      bottom: 2rem;
      right: 2rem;
      background: rgba(255, 255, 255, 0.95);
      padding: 1rem;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
  }

  /* Desktop */
  @media (min-width: 1440px) {
    .chart-wrapper {
      height: 450px;
    }

    .chart-legend {
      position: static;
      background: transparent;
      box-shadow: none;
    }
  }

  /* Print */
  @media print {
    .chart-wrapper {
      page-break-inside: avoid;
      break-inside: avoid;
      height: 350px;
    }

    .chart-legend {
      display: block;
      position: static;
      background: transparent;
    }
  }
`;
```

### Mobile Interaction Strategies

#### Strategy 1: Swipeable Chart Gallery

```jsx
export function SwipeableChartGallery({ charts }) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [touchStart, setTouchStart] = React.useState(0);

  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        setActiveIndex((i) => Math.min(i + 1, charts.length - 1));
      } else {
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
    }
  };

  return (
    <div
      className="swipeable-container"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="region"
      aria-label="Swipeable chart gallery"
    >
      <div className="chart-viewport">{charts[activeIndex]}</div>

      <div className="page-dots">
        {charts.map((_, i) => (
          <button
            key={i}
            className={`dot ${i === activeIndex ? 'active' : ''}`}
            onClick={() => setActiveIndex(i)}
            aria-label={`Chart ${i + 1} of ${charts.length}`}
            aria-pressed={i === activeIndex}
          />
        ))}
      </div>

      <div className="navigation-buttons">
        <button
          onClick={() => setActiveIndex(Math.max(activeIndex - 1, 0))}
          disabled={activeIndex === 0}
          aria-label="Previous chart"
        >
          &larr;
        </button>
        <button
          onClick={() =>
            setActiveIndex(Math.min(activeIndex + 1, charts.length - 1))
          }
          disabled={activeIndex === charts.length - 1}
          aria-label="Next chart"
        >
          &rarr;
        </button>
      </div>
    </div>
  );
}
```

#### Strategy 2: Progressive Disclosure on Mobile

```jsx
export function ProgressiveChart({ summary, detailChart, fullData }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="progressive-disclosure">
      {/* Level 1: Summary (always visible on mobile) */}
      <div className="summary-metrics">
        <div className="metric">
          <span className="label">Avg HR</span>
          <span className="value">{summary.avgHR} bpm</span>
        </div>
        <div className="metric">
          <span className="label">AHI</span>
          <span className="value">{summary.ahi}</span>
        </div>
      </div>

      {/* Level 2: Toggle to expand chart */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="expand-button"
        aria-expanded={expanded}
      >
        {expanded ? '📊 Hide Chart' : '📊 Show Chart'}
      </button>

      {/* Level 3: Detailed chart (on demand) */}
      {expanded && <div className="chart-detail">{detailChart}</div>}

      {/* Level 4: Data table (collapsible) */}
      <details className="raw-data">
        <summary>View Raw Data</summary>
        <AccessibleDataTable data={fullData} />
      </details>
    </div>
  );
}
```

---

## Interaction Patterns

### Global Interaction Patterns

#### 1. **Date Range Selector**

```
┌─────────────────────────────────┐
│ Quick Presets:                  │
│ [Last 7 days] [Last 30 days]   │
│ [Last 3 months] [All data]      │
│ [Custom range ▼]                │
│                                 │
│ Custom Date Range:              │
│ From: [📅 YYYY-MM-DD ▼]        │
│ To:   [📅 YYYY-MM-DD ▼]        │
│                                 │
│ [Apply] [Reset]                │
└─────────────────────────────────┘
```

**Interaction**:

- Click preset: Instant filter
- Click custom: Open date pickers
- Keyboard nav: Tab through fields, type dates
- Visual feedback: Highlight selected preset, show applied range in header

#### 2. **Metric Toggle Filter**

```
┌──────────────────────────────────────────┐
│ Show Metrics:                            │
│ ☑ Heart Rate    ☐ SpO2                  │
│ ☑ AHI           ☐ Central Events        │
│ ☑ Pressure      ☐ Leak Rate             │
│ ☑ Sleep Stages  ☐ Activity              │
│                                          │
│ [Apply] [Clear All] [Select All]         │
└──────────────────────────────────────────┘
```

**Interaction**:

- Click checkbox: Toggle metric visibility
- Keyboard: Space to toggle, tab to navigate
- Real-time filtering: Chart updates on selection
- Preset combinations: "Clinical View", "Patient View", "Sleep Scientist View"

#### 3. **Hover Tooltip (Desktop)**

```
On hover over chart element:

┌─────────────────────────────┐
│ 23:45 (Night of 2026-01-24) │
│ ─────────────────────────── │
│ HR: 72 bpm (normal)         │
│ SpO2: 96% (good)            │
│ AHI events: 0               │
│ Sleep stage: N2             │
│ Pressure: 12.5 cm H2O       │
│                             │
│ [Details →]                 │
└─────────────────────────────┘
```

**Implementation**:

- Plotly hover format + Popper.js for positioning
- Rich content: values, units, clinical interpretation
- Link to details modal
- Accessible via keyboard (Shift+Tab to focus tooltip)

#### 4. **Click Drill-Down**

```
User clicks on chart point or row:

1. Event details modal opens:
   ┌──────────────────────────────────┐
   │ Event Detail: Apnea (Central)    │
   │ Duration: 18 seconds             │
   │ Time: 01:23:45 (Sleep stage: REM)│
   │ HR response: 68 → 82 bpm         │
   │ SpO2 response: 96% → 92%         │
   │ Pressure setting: 12.5 cm H2O    │
   │ Recovery: 45 seconds             │
   │ ─────────────────────────────    │
   │ [Full Night View] [Compare]      │
   └──────────────────────────────────┘

2. User clicks [Full Night View]:
   → Navigate to Single Night tab with this night pre-loaded
```

#### 5. **Linked Brushing (Multi-Chart Selection)**

```
User selects region in one chart (e.g., high HR period):

Chart 1: HR Trend       Chart 2: AHI Events
──────────────────     ───────────────────
Line highlighted    →  Points highlighted
(interactive area)      (filtered to matching time)

Chart 3: SpO2 Trend
───────────────────
Line highlighted with alert regions identified
```

**Implementation**:

- Shared state manager (Context or Zustand) tracks selected time window
- All charts subscribe to selection
- Update on brush end (debounced for performance)

---

### Chart-Specific Interaction Patterns

#### Pattern: Dual-Axis Chart with Toggle

```jsx
export function DualAxisChart({ hrData, ahiData }) {
  const [visibleMetrics, setVisibleMetrics] = React.useState({
    heartRate: true,
    spO2: true,
    ahi: true,
    pressure: true,
    sleepStage: true,
  });

  const toggleMetric = (metric) => {
    setVisibleMetrics((prev) => ({
      ...prev,
      [metric]: !prev[metric],
    }));
  };

  const plotlyData = [
    visibleMetrics.heartRate && createHeartRateLine(hrData),
    visibleMetrics.spO2 && createSpO2Band(hrData),
    visibleMetrics.ahi && createAHIScatter(ahiData),
    visibleMetrics.pressure && createPressureLine(pressureData),
    visibleMetrics.sleepStage && createSleepStageBg(stageData),
  ].filter(Boolean);

  const plotlyLayout = {
    // Dual y-axes
    yaxis: { title: 'Heart Rate (bpm)' },
    yaxis2: { title: 'AHI Events', overlaying: 'y', side: 'right' },
    // ...
  };

  return (
    <section className="chart-section">
      <h2>Heart Rate & AHI Correlation</h2>

      <div className="metric-toggles">
        {Object.keys(visibleMetrics).map((metric) => (
          <label key={metric}>
            <input
              type="checkbox"
              checked={visibleMetrics[metric]}
              onChange={() => toggleMetric(metric)}
            />
            {metricLabels[metric]}
          </label>
        ))}
      </div>

      <Plot
        data={plotlyData}
        layout={plotlyLayout}
        config={{ responsive: true }}
      />
    </section>
  );
}
```

---

## Mobile Considerations

### Touch Interaction Principles

- **Tap**: 44×44px minimum target, 8px spacing
- **Swipe**: 50px minimum movement to register
- **Long-press**: 300ms hold for context menu or details
- **Double-tap**: For zoom (implement with pinch as primary for charts)
- **Pinch**: For zoom on charts (preferred over double-tap)

### Mobile-Specific UI Patterns

#### 1. **Bottom Sheet for Filters**

```
User taps [Filters] button:

┌─────────────────────────────────┐
│ Main content (dimmed)           │
│ ┌───────────────────────────────┤
│ │ ╭─────────────────╮            │
│ │ │ ⊠ Metric Filters │            │
│ │ ├─────────────────┤            │
│ │ │ ☑ HR ☑ SpO2     │            │
│ │ │ ☑ AHI ☐ Pressure │            │
│ │ ├─────────────────┤            │
│ │ │ [Apply] [Clear] │            │
│ │ │                 │            │
│ │ │ ← Swipe to hide │            │
│ │ ╰─────────────────╯            │
│ └───────────────────────────────┘
└─────────────────────────────────┘
```

#### 2. **Stacked Chart Cards with Scroll**

```
Mobile view - vertical stack:

┌─────────────────────────────────┐
│ 📊 HR Trend (250px height)      │
│ ┌─────────────────────────────┐ │
│ │ [Chart]                     │ │
│ └─────────────────────────────┘ │
│ Summary: Avg 65, Peak 89        │
├─────────────────────────────────┤
│ 📊 AHI Events (250px)           │
│ ┌─────────────────────────────┐ │
│ │ [Chart]                     │ │
│ └─────────────────────────────┘ │
│ Summary: 8 total events         │
├─────────────────────────────────┤
│ 📊 SpO2 Trend (250px)           │
│ ┌─────────────────────────────┐ │
│ │ [Chart]                     │ │
│ └─────────────────────────────┘ │
│ Summary: Min 91%, Mean 96%      │
│ ← Scroll to see more            │
└─────────────────────────────────┘
```

#### 3. **Tap-to-Expand Detail View**

```
Default (mobile):                 Expanded (on tap):
┌─────────────────────────┐       ┌──────────────────────────┐
│ Night: 2026-01-24       │   →   │ Night: 2026-01-24        │
│ AHI: 8.2                │       │ ┌────────────────────────┐│
│ HR: 65 avg, 89 peak  [+]│  ──→  │ │ AHI: 8.2 (Moderate)    ││
│ SpO2: 96% min        │ │       │ │ Events: 5 A, 3 H       ││
│                         │       │ │ HR: 65 avg, 89 peak    ││
│                         │       │ │ SpO2: 96% min (Good)   ││
│                         │       │ │ Sleep: N1 12%, N2 40%  ││
│                         │       │ │     N3 22%, REM 26%    ││
│                         │       │ │ Settings: EPAP 12.5    ││
│                         │       │ │ [View Full Chart] [×]  ││
│                         │       │ └────────────────────────┘│
└─────────────────────────┘       └──────────────────────────┘
```

#### 4. **Mobile-Optimized Data Entry**

For date range or custom filters on mobile:

```
┌────────────────────────────┐
│ Select Date Range          │
├────────────────────────────┤
│                            │
│ From:  [📅] [2026-01-01]  │
│                            │
│ To:    [📅] [2026-01-24]  │
│                            │
│ ┌──────────────────────────┐
│ │ Calendar picker          │
│ │ [displays on focus]      │
│ │ Touch-friendly dates     │
│ └──────────────────────────┘
│                            │
│ [Apply]        [Cancel]    │
└────────────────────────────┘
```

---

## Cognitive Load Management

### Principle 1: Progressive Disclosure

**Default view** (summary):

- 3–5 key metrics (AHI, HR, SpO2, sleep efficiency, correlation strength)
- 1–2 most interesting anomalies
- Quick action buttons

**Expanded view** (on demand):

- Full chart suite
- Statistical details
- Drill-down to individual events

**Implementation**:

```jsx
export function NightSummary({ night }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="night-card">
      {/* Level 1: Always visible */}
      <h3>{night.date}</h3>
      <MetricsRow metrics={night.summary} />

      <button onClick={() => setExpanded(!expanded)}>
        {expanded ? '▼ Hide Details' : '▶ Show Details'}
      </button>

      {/* Level 2: On demand */}
      {expanded && (
        <>
          <FullChartView night={night} />
          <StatisticsPanel night={night} />
        </>
      )}
    </div>
  );
}
```

### Principle 2: Color Coding Consistency

**System-wide color meaning**:

- 🟦 **Blue**: Baseline, normal range, primary data
- 🟧 **Orange**: Alert, outside typical range, attention needed
- 🟥 **Red**: Severe, actionable issue, intervention recommended
- 🟩 **Green**: Positive outcome, improved, good
- 🔘 **Gray**: Neutral, disabled, background

**Apply consistently**:

- If HR is blue in one chart, blue everywhere
- If SpO2 dip is orange in one view, orange in all views
- Establish mapping in design system and document in `constants.js`

### Principle 3: Smart Defaults

**On first load**, show:

1. **Last 7 nights** (not all data to avoid overwhelm)
2. **Most relevant correlations** (e.g., HR + AHI if p < 0.01)
3. **Anomaly alerts** (flagged unusual nights)
4. **Single-night detail** of most recent night

**For power users**:

- Remember filter preferences in localStorage
- Bookmark common views (e.g., "Pressure vs AHI" comparison)
- Suggest related analyses based on data patterns

### Principle 4: Contextual Help & Documentation

**Inline tooltips** on hover:

```
Metric name → "What is this?"
  ↓
"AHI (Apnea Hypopnea Index) measures breathing interruptions per hour.
Therapeutic range: <5 is ideal for most patients.
[Learn more →]"
```

**"Why is this interesting?" badges**:

```
📌 Correlation: HR + AHI (r=0.63, p<0.001)
   "Strong correlation suggests your heart rate spikes
   during breathing events. This is a typical response."
   [See similar nights]
```

**Link to glossary**:

- All medical terms should link to `docs/user/glossary.md`
- Definitions should be plain language + clinical context

### Principle 5: Reducing Visual Noise

**Visual hierarchy**:

1. **Primary**: Most statistically significant or clinically important finding
2. **Secondary**: Supporting data and trends
3. **Tertiary**: Raw data, outliers, exceptions (collapsible)
4. **Quaternary**: Documentation, tooltips (on hover)

**Example layout**:

```
┌──────────────────────────────────────┐
│ 📌 KEY FINDING (Large, prominent)    │
│ "Strong HR↑ during apnea events"     │
│ ─────────────────────────────────── │
│                                      │
│ Chart: HR vs AHI (primary visual)    │
│ [High-contrast, easy to read]        │
│ ─────────────────────────────────── │
│                                      │
│ Supporting Stats (secondary):        │
│ Correlation: 0.63, p<0.001           │
│ 8 AHI events, avg HR↑ = 12 bpm       │
│ ─────────────────────────────────── │
│                                      │
│ [Details ▼] [Full Dataset] [Export]  │
└──────────────────────────────────────┘
```

---

## Implementation Guidance

### Tech Stack Recommendations

#### Visualization Library

- **Primary**: Plotly.js (already used in OSCAR)
  - Pro: Accessible, responsive, statistical charts
  - Con: Limited custom patterns/textures
  - Use for: Time-series, scatter, heatmaps, box plots

- **Secondary**: D3.js (for custom visualizations if needed)
  - Pro: Extreme customization, patterns/textures
  - Con: Higher learning curve, accessibility burden on developer
  - Use for: Stream graphs, parallel coordinates, custom interactions

#### Accessibility Tools

- **axe DevTools**: Automated accessibility testing in dev
- **WAVE**: Browser extension for checking contrast, labels, structure
- **Coblis**: Color-blindness simulator
- **Keyboard testing**: Manual keyboard navigation for all features

#### Responsive Framework

- **Tailwind CSS** (already in project?): Mobile-first utility classes
- **CSS Media Queries**: Explicit breakpoints (mobile: <768px, tablet: 768–1439px, desktop: 1440px+)

### File Organization

```
src/
├── components/
│   ├── Fitbit/
│   │   ├── FitbitDashboard.jsx          # Main container
│   │   ├── SingleNightView.jsx          # Dual-axis + details
│   │   ├── MultiNightComparison.jsx     # Side-by-side
│   │   ├── CorrelationMatrix.jsx        # Heatmap
│   │   ├── BivariateScatter.jsx         # SpO2 vs HR, etc.
│   │   ├── AnomalyDetection.jsx         # Flagged nights
│   │   └── FitbitDashboard.test.jsx
│   │
│   └── [Reusable components]
│       ├── AccessibleChart.jsx          # Wrapper for chart + data table
│       ├── ChartLegend.jsx              # Accessible legend
│       ├── DataTable.jsx                # Alternative to chart
│       └── FilterPanel.jsx              # Date/metric filters
│
├── hooks/
│   ├── useFitbitData.js                 # Data fetching
│   ├── useChartFilters.js               # Filter state management
│   └── useCorrelation.js                # Statistical calculations
│
├── utils/
│   ├── fitbitTransform.js               # Align CPAP + Fitbit timings
│   ├── statisticalTests.js              # Correlation, significance
│   ├── colorPalette.js                  # Accessible colors
│   ├── a11y.js                          # ARIA label generators
│   └── responsive.js                    # Breakpoint helpers
│
├── constants/
│   ├── fitbitCharts.js                  # Chart config, thresholds
│   └── medicalThresholds.js             # Clinical ranges
│
└── tests/
    ├── Fitbit*.test.jsx                 # Component tests
    └── fitbit-a11y.test.js              # Accessibility tests
```

### Testing Strategy

#### Unit Tests

- Chart rendering: Does chart appear with expected data?
- Data transformation: Does Fitbit data align correctly with CPAP?
- Filter logic: Do filters update visualizations correctly?

#### Accessibility Tests

```js
import { axe } from 'jest-axe';
import { render, screen } from '@testing-library/react';

test('FitbitDashboard meets WCAG AA', async () => {
  const { container } = render(<FitbitDashboard />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});

test('Chart is keyboard navigable', async () => {
  render(<DualAxisChart {...props} />);
  const chart = screen.getByRole('img');
  chart.focus();
  // Arrow keys navigate points
  // Enter selects
});
```

#### Responsive Tests

- Test layouts at 320px, 768px, 1440px widths
- Verify touch targets ≥44×44px on mobile
- Check chart heights adapt appropriately

#### Integration Tests

- End-to-end: Upload Fitbit data → Select date range → Filter metrics → View correlation
- Data persistence: Filters survive page reload
- Export: Charts export as accessible PDF/PNG

### Design System Integration

#### Color Variables

```css
/* colors.css or Tailwind config */
:root {
  --color-primary-blue: #0173b2; /* WCAG AAA on white, dark */
  --color-alert-orange: #de8f05;
  --color-alert-red: #d45113;
  --color-good-green: #029e73;
  --color-neutral-gray: #666666;

  --chart-line-hr: var(--color-primary-blue);
  --chart-area-spO2-good: var(--color-good-green);
  --chart-area-spO2-alert: var(--color-alert-orange);
  --chart-scatter-ahi: var(--color-alert-red);
}
```

#### Typography

```css
/* All sizes meeting WCAG AA contrast */
.chart-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary); /* ≥4.5:1 contrast */
  margin-bottom: 1rem;
}

.chart-axis-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.chart-annotation {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}
```

#### Responsive Utilities

```jsx
// Helper functions for responsive behavior
export const isMobile = () => window.innerWidth < 768;
export const isTablet = () =>
  window.innerWidth >= 768 && window.innerWidth < 1440;
export const isDesktop = () => window.innerWidth >= 1440;

export const useResponsive = () => {
  const [width, setWidth] = React.useState(window.innerWidth);

  React.useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1440,
    isDesktop: width >= 1440,
  };
};
```

---

## Summary: Key Design Decisions

| Aspect                     | Decision                                     | Rationale                                                        |
| -------------------------- | -------------------------------------------- | ---------------------------------------------------------------- |
| **Primary Chart Type**     | Dual-axis synchronization (HR + AHI)         | Reveals temporal relationships; familiar to power users          |
| **Color Strategy**         | Blue/orange/red (colorblind-safe)            | Professional, accessible, consistent with medical UI conventions |
| **Layout**                 | Progressive disclosure (summary → details)   | Reduces cognitive load; supports exploration                     |
| **Mobile**                 | Stacked cards + swipeable charts             | Touch-friendly; maintains data density on small screens          |
| **Accessibility**          | WCAG AA + keyboard navigation                | Inclusive; required for medical contexts                         |
| **Default Data**           | Last 7 nights, most significant correlations | Balances exploration with initial usability                      |
| **Responsive Breakpoints** | 768px, 1440px                                | Covers mobile, tablet, desktop effectively                       |
| **Export Format**          | PDF + CSV (accessible tables included)       | Supports clinical documentation and data sharing                 |

---

## Next Steps for Development

1. **Prototype** single-night dual-axis chart with test data (use builders from `src/test-utils/`)
2. **Validate accessibility** with axe DevTools and keyboard navigation
3. **Test responsive behavior** across breakpoints
4. **Implement correlation matrix** and bivariate scatter
5. **Add multi-night comparison** with filtering
6. **Conduct user testing** with target audience (data scientists, clinicians)
7. **Refine based on feedback** and performance metrics

---

**Document Version**: 1.0  
**Last Updated**: January 24, 2026  
**Author**: UX Design Team  
**Status**: Design Specification (Ready for Development)
