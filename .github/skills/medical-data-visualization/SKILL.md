---
name: medical-data-visualization
description: Design principles and patterns for medical data visualization including accessibility, chart selection, and clinical context. Use when designing or reviewing health data visualizations.
---

# Medical Data Visualization

This skill documents design principles, patterns, and best practices for visualizing medical sleep therapy data in OSCAR Export Analyzer.

## Principles for CPAP Data Visualization

### 1. Context Matters

Always show clinical thresholds and normal ranges to help users interpret values.

```javascript
// ❌ Show AHI without context
<Plot data={[{ x: dates, y: ahiValues }]} />

// ✅ Show AHI with severity thresholds
<Plot
  data={[
    { x: dates, y: ahiValues, name: 'AHI', type: 'scatter' },
    // Normal range
    { x: dates, y: Array(dates.length).fill(5), name: 'Normal threshold', type: 'line', line: { dash: 'dash', color: 'green' } },
    // Moderate range
    { x: dates, y: Array(dates.length).fill(15), name: 'Moderate threshold', line: { dash: 'dash', color: 'orange' } },
    // Severe range
    { x: dates, y: Array(dates.length).fill(30), name: 'Severe threshold', line: { dash: 'dash', color: 'red' } },
  ]}
/>
```

### 2. Trend Visibility

Use rolling averages to show patterns, not just noisy raw data.

```javascript
// Show both raw and smoothed data
const smoothed7Day = rollingAverage(ahiValues, 7);
const smoothed30Day = rollingAverage(ahiValues, 30);

<Plot
  data={[
    {
      x: dates,
      y: ahiValues,
      name: 'Daily AHI',
      mode: 'markers',
      marker: { opacity: 0.3 },
    },
    { x: dates, y: smoothed7Day, name: '7-day average', mode: 'lines' },
    {
      x: dates,
      y: smoothed30Day,
      name: '30-day average',
      mode: 'lines',
      line: { width: 3 },
    },
  ]}
/>;
```

### 3. Outlier Clarity

Highlight unusual values that might indicate sensor errors or significant events.

```javascript
// Detect outliers
const { normal, outliers } = detectOutliers(ahiValues);

<Plot
  data={[
    { x: normalDates, y: normal, name: 'Normal readings', type: 'scatter' },
    {
      x: outlierDates,
      y: outliers,
      name: 'Outliers',
      mode: 'markers',
      marker: { color: 'red', size: 10 },
    },
  ]}
/>;
```

### 4. Multiple Perspectives

Show same data in different ways to reveal different insights.

```javascript
// Time-series + distribution + correlation
<div className="analysis-grid">
  {/* Time trend */}
  <TimeSeries data={sessions} />

  {/* Distribution */}
  <Histogram data={sessions} />

  {/* Correlation */}
  <ScatterPlot x={epapValues} y={ahiValues} />
</div>
```

### 5. Actionable Insights

Design visualizations to answer: "Is my therapy working?"

```javascript
// Show compliance and effectiveness together
<ComplianceAndEffectiveness
  usageHours={usageValues}
  ahiValues={ahiValues}
  complianceThreshold={4} // 4 hours per night
  effectivenessThreshold={5} // AHI < 5
/>
```

## Chart Type Selection

### Time-Series (Trends Over Time)

**When to use:** Daily metrics, therapy progression, change detection

```javascript
// Line chart for continuous trends
<Plot
  data={[
    {
      x: dates,
      y: ahiValues,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'AHI',
    },
  ]}
  layout={{
    xaxis: { title: 'Date', type: 'date' },
    yaxis: { title: 'AHI (events/hour)' },
    title: 'AHI Trends Over Time',
  }}
/>
```

### Distribution (Value Frequency)

**When to use:** Understanding typical values, identifying patterns

```javascript
// Histogram for value distribution
<Plot
  data={[
    {
      x: ahiValues,
      type: 'histogram',
      nbinsx: 20,
      name: 'AHI Distribution',
    },
  ]}
  layout={{
    xaxis: { title: 'AHI (events/hour)' },
    yaxis: { title: 'Number of Nights' },
    title: 'AHI Distribution',
  }}
/>
```

### Box Plot (Statistical Summary)

**When to use:** Comparing periods, showing variability

```javascript
// Box plot for comparing before/after
<Plot
  data={[
    { y: beforeValues, type: 'box', name: 'Before Adjustment' },
    { y: afterValues, type: 'box', name: 'After Adjustment' },
  ]}
  layout={{
    yaxis: { title: 'AHI (events/hour)' },
    title: 'AHI Before and After EPAP Adjustment',
  }}
/>
```

### Scatter Plot (Correlation)

**When to use:** Testing relationships between variables

```javascript
// Scatter for EPAP vs AHI correlation
<Plot
  data={[
    {
      x: epapValues,
      y: ahiValues,
      type: 'scatter',
      mode: 'markers',
      text: dates,
      marker: { size: 10 },
    },
  ]}
  layout={{
    xaxis: { title: 'EPAP Pressure (cmH₂O)' },
    yaxis: { title: 'AHI (events/hour)' },
    title: 'EPAP vs AHI Correlation',
  }}
/>
```

### Heatmap (Calendar/Pattern Visualization)

**When to use:** Weekly patterns, compliance tracking

```javascript
// Calendar heatmap (GitHub-style)
<Plot
  data={[
    {
      z: usageByWeek, // 2D array: weeks x 7 days
      type: 'heatmap',
      colorscale: [
        [0, 'lightgray'],
        [1, 'green'],
      ],
    },
  ]}
  layout={{
    xaxis: { title: 'Day of Week' },
    yaxis: { title: 'Week' },
    title: 'Usage Compliance Calendar',
  }}
/>
```

## Accessibility Guidelines

### Color Contrast (WCAG AA)

```javascript
// ❌ Poor contrast
const colors = {
  line: '#87CEEB', // Light blue on white background
  text: '#CCCCCC', // Light gray on white
};

// ✅ WCAG AA compliant (4.5:1 minimum)
const colors = {
  line: '#0066CC', // Dark blue
  text: '#333333', // Dark gray
  background: '#FFFFFF',
};
```

**Test contrast:**

- Use browser DevTools color picker
- Online tools: WebAIM Contrast Checker
- Minimum ratio: 4.5:1 for normal text, 3:1 for large text

### Colorblind-Safe Palettes

```javascript
// ❌ Red/green (indistinguishable for colorblind users)
const palette = ['#FF0000', '#00FF00', '#0000FF'];

// ✅ Colorblind-safe (use blue/orange/gray)
const palette = ['#0072B2', '#D55E00', '#666666'];

// ✅ Also use patterns, not just color
data={[
  { name: 'AHI', line: { color: '#0072B2', dash: 'solid' } },
  { name: 'Goal', line: { color: '#D55E00', dash: 'dash' } },
]}
```

### ARIA Labels

```javascript
// Add accessible names and descriptions
<div
  role="img"
  aria-label="Chart showing AHI trends from Jan 1 to Jan 31"
  aria-describedby="chart-description"
>
  <Plot data={data} layout={layout} />
</div>
<p id="chart-description" className="sr-only">
  Line chart showing AHI values ranging from 3.2 to 12.5 events per hour. AHI decreases over
  time, indicating therapy improvement.
</p>
```

### Keyboard Navigation

```javascript
// Plotly has built-in keyboard support, but ensure controls are keyboard-accessible
<div className="chart-controls">
  <button onClick={handleZoomIn} aria-label="Zoom in">
    🔍+
  </button>
  <button onClick={handleZoomOut} aria-label="Zoom out">
    🔍-
  </button>
  <button onClick={handleReset} aria-label="Reset zoom">
    ↺ Reset
  </button>
</div>
```

## Medical Terminology

### Patient-Friendly Labels

```javascript
// ❌ Technical jargon
const labels = {
  xaxis: 'Date (ISO 8601)',
  yaxis: 'AHI (apnea-hypopnea index)',
};

// ✅ Clear and approachable
const labels = {
  xaxis: 'Date',
  yaxis: 'Apnea Events per Hour (AHI)',
};

// ✅ With tooltip explanation
<Tooltip content="AHI measures how many times per hour you stop breathing (apnea) or breathe shallowly (hypopnea) during sleep. Lower is better." />;
```

### Hover Tooltips

```javascript
// Informative tooltips with context
layout={{
  hovermode: 'closest',
  hoverlabel: {
    bgcolor: 'white',
    font: { size: 14 },
  },
}}

// Custom hover template
hovertemplate: '<b>Date:</b> %{x|%Y-%m-%d}<br>' +
               '<b>AHI:</b> %{y:.1f} events/hour<br>' +
               '<b>Severity:</b> %{customdata}<extra></extra>',

customdata: ahiValues.map(ahi =>
  ahi < 5 ? 'Normal' : ahi < 15 ? 'Mild' : ahi < 30 ? 'Moderate' : 'Severe'
),
```

## Plotly Configuration

### Responsive Layout

```javascript
const responsiveLayout = {
  autosize: true,
  margin: { l: 60, r: 20, t: 60, b: 60 },
  font: { size: 14, family: 'system-ui, sans-serif' },
  xaxis: { automargin: true },
  yaxis: { automargin: true },
};

const responsiveConfig = {
  responsive: true,
  displayModeBar: true,
  modeBarButtonsToRemove: ['lasso2d', 'select2d'],
  displaylogo: false,
};
```

### Print-Friendly

```javascript
// Adjust for print media
const printLayout = {
  ...responsiveLayout,
  paper_bgcolor: 'white',
  plot_bgcolor: 'white',
  font: { color: 'black' },
  xaxis: { ...responsiveLayout.xaxis, gridcolor: '#666666' },
  yaxis: { ...responsiveLayout.yaxis, gridcolor: '#666666' },
};

// Detect print media
const isPrint = window.matchMedia('print').matches;
const layout = isPrint ? printLayout : responsiveLayout;
```

### Dark Mode Support

```javascript
const darkModeLayout = {
  ...responsiveLayout,
  paper_bgcolor: '#1a1a1a',
  plot_bgcolor: '#2a2a2a',
  font: { color: '#e0e0e0' },
  xaxis: {
    ...responsiveLayout.xaxis,
    gridcolor: '#444444',
    color: '#e0e0e0',
  },
  yaxis: {
    ...responsiveLayout.yaxis,
    gridcolor: '#444444',
    color: '#e0e0e0',
  },
};

// Apply based on theme
const layout = isDarkMode ? darkModeLayout : responsiveLayout;
```

## Statistical Annotations

### Change-Points

```javascript
// Mark significant changes
const changePoint = { date: '2024-01-15', reason: 'EPAP adjusted' };

layout={{
  shapes: [
    {
      type: 'line',
      x0: changePoint.date,
      x1: changePoint.date,
      y0: 0,
      y1: 1,
      yref: 'paper',
      line: { color: 'red', dash: 'dash', width: 2 },
    },
  ],
  annotations: [
    {
      x: changePoint.date,
      y: 1,
      yref: 'paper',
      text: changePoint.reason,
      showarrow: true,
      arrowhead: 2,
    },
  ],
}}
```

### Confidence Intervals

```javascript
// Show error bands
<Plot
  data={[
    // Mean line
    { x: dates, y: meanValues, name: 'Mean AHI', line: { color: 'blue' } },
    // Upper confidence bound
    {
      x: dates,
      y: upperBound,
      fill: 'tonexty',
      fillcolor: 'rgba(0, 100, 200, 0.2)',
      line: { width: 0 },
      showlegend: false,
    },
    // Lower confidence bound
    {
      x: dates,
      y: lowerBound,
      fill: 'tonexty',
      fillcolor: 'rgba(0, 100, 200, 0.2)',
      line: { width: 0 },
      name: '95% CI',
    },
  ]}
/>
```

## Performance Optimization

### Large Datasets

```javascript
// Downsample for large datasets (> 1000 points)
const downsampled = data.length > 1000 ? downsample(data, 1000) : data;

// Use WebGL for better performance
data={{
  ...chartData,
  type: 'scattergl', // WebGL-accelerated
}}
```

### Lazy Loading

```javascript
// Load charts only when visible
import { lazy, Suspense } from 'react';

const AhiChart = lazy(() => import('./AhiChart'));

function ChartsSection() {
  return (
    <Suspense fallback={<div>Loading chart...</div>}>
      <AhiChart data={data} />
    </Suspense>
  );
}
```

## Common Patterns

### Dual Y-Axis (Two Metrics)

```javascript
// Show AHI and EPAP on same chart
<Plot
  data={[
    { x: dates, y: ahiValues, name: 'AHI', yaxis: 'y1' },
    { x: dates, y: epapValues, name: 'EPAP', yaxis: 'y2' },
  ]}
  layout={{
    xaxis: { title: 'Date' },
    yaxis: { title: 'AHI (events/hour)', side: 'left' },
    yaxis2: {
      title: 'EPAP (cmH₂O)',
      overlaying: 'y',
      side: 'right',
    },
  }}
/>
```

### Subplots (Multiple Charts)

```javascript
// Stacked charts sharing x-axis
<Plot
  data={[
    { x: dates, y: ahiValues, xaxis: 'x1', yaxis: 'y1', name: 'AHI' },
    { x: dates, y: usageValues, xaxis: 'x1', yaxis: 'y2', name: 'Usage' },
  ]}
  layout={{
    grid: { rows: 2, columns: 1, pattern: 'independent' },
    xaxis: { title: 'Date' },
    yaxis: { title: 'AHI' },
    yaxis2: { title: 'Usage (hours)' },
  }}
/>
```

## Resources

- **Plotly docs**: https://plotly.com/javascript/
- **WCAG guidelines**: https://www.w3.org/WAI/WCAG21/quickref/
- **Colorblind palettes**: https://colorbrewer2.org/
- **Contrast checker**: https://webaim.org/resources/contrastchecker/
- **Chart examples**: `src/components/charts/` directory
- **Accessibility skill**: oscar-privacy-boundaries skill
