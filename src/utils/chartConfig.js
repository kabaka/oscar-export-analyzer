/**
 * Responsive Plotly configuration utilities for OSCAR Export Analyzer.
 * Generates viewport-appropriate chart layouts with adaptive font sizes, margins, and legends.
 *
 * @module chartConfig
 */

/**
 * Responsive Plotly layout configuration generator.
 * Returns layout object with viewport-appropriate font sizes and margins.
 *
 * Breakpoints:
 * - Mobile: <768px (compact fonts, horizontal legend below chart)
 * - Tablet: 768px-1023px (medium fonts, vertical legend to right)
 * - Desktop: ≥1024px (full fonts, vertical legend to right)
 *
 * @param {Object} baseLayout - Base Plotly layout object to extend
 * @returns {Object} Responsive Plotly layout configuration
 *
 * @example
 * const baseLayout = {
 *   title: 'AHI Over Time',
 *   xaxis: { title: 'Date' },
 *   yaxis: { title: 'AHI' },
 * };
 * const layout = getResponsiveChartLayout(baseLayout);
 */
export function getResponsiveChartLayout(baseLayout = {}) {
  // Check if matchMedia is available (not in all test environments)
  const hasMatchMedia = typeof window !== 'undefined' && window.matchMedia;

  const isMobile = hasMatchMedia
    ? window.matchMedia('(max-width: 767px)').matches
    : false;
  const isTablet = hasMatchMedia
    ? window.matchMedia('(min-width: 768px) and (max-width: 1023px)').matches
    : false;

  const fontSizes = {
    mobile: {
      title: 14,
      axis: 11,
      tick: 10,
      legend: 11,
    },
    tablet: {
      title: 16,
      axis: 12,
      tick: 11,
      legend: 12,
    },
    desktop: {
      title: 18,
      axis: 13,
      tick: 12,
      legend: 13,
    },
  };

  const margins = {
    mobile: { l: 40, r: 20, t: 40, b: 40 },
    tablet: { l: 50, r: 30, t: 50, b: 50 },
    desktop: { l: 60, r: 40, t: 60, b: 60 },
  };

  const legendPositions = {
    mobile: { orientation: 'h', y: -0.2, x: 0.5, xanchor: 'center' },
    tablet: { orientation: 'v', y: 1, x: 1.02, xanchor: 'left' },
    desktop: { orientation: 'v', y: 1, x: 1.02, xanchor: 'left' },
  };

  const size = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';

  return {
    ...baseLayout,
    autosize: true, // Critical for responsive resizing
    margin: margins[size],
    font: {
      size: fontSizes[size].axis,
      family: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
    },
    title: {
      ...baseLayout.title,
      font: {
        size: fontSizes[size].title,
      },
    },
    xaxis: {
      ...baseLayout.xaxis,
      titlefont: { size: fontSizes[size].axis },
      tickfont: { size: fontSizes[size].tick },
    },
    yaxis: {
      ...baseLayout.yaxis,
      titlefont: { size: fontSizes[size].axis },
      tickfont: { size: fontSizes[size].tick },
    },
    legend: {
      ...baseLayout.legend,
      ...legendPositions[size],
      font: { size: fontSizes[size].legend },
    },
  };
}

/**
 * Responsive Plotly config object.
 * Disables logo, adjusts interaction modes for touch devices.
 *
 * @returns {Object} Responsive Plotly config
 *
 * @example
 * const config = getResponsiveChartConfig();
 * <Plot data={data} layout={layout} config={config} />
 */
export function getResponsiveChartConfig() {
  // Check if matchMedia is available (not in all test environments)
  const hasMatchMedia = typeof window !== 'undefined' && window.matchMedia;
  const isMobile = hasMatchMedia
    ? window.matchMedia('(max-width: 767px)').matches
    : false;

  return {
    responsive: true,
    displayModeBar: !isMobile, // Hide mode bar on mobile (limited space)
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    toImageButtonOptions: {
      format: 'png',
      filename: 'oscar-chart',
      height: 600,
      width: 800,
    },
    scrollZoom: false, // Prevent accidental zoom on scroll
  };
}
