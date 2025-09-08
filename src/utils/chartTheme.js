export function applyChartTheme(isDark, layout = {}) {
  const light = {
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    font: { color: '#0b1220' },
    axisColor: '#5b6472',
    gridColor: '#e7ebf0',
  };
  const dark = {
    paper_bgcolor: '#121821',
    plot_bgcolor: '#121821',
    font: { color: '#e6eaef' },
    axisColor: '#aab2bd',
    // darker grid so it doesn't look light grey
    gridColor: '#1e2734',
    zeroLineColor: '#2c3747',
  };
  const t = isDark ? dark : light;
  const mergeFont = { ...(layout.font || {}), ...(t.font || {}) };

  // Normalize title and axis titles to object form to ensure consistent rendering
  const toTitleObj = (v) => (typeof v === 'string' ? { text: v } : v || {});
  const normAxis = (ax = {}) => ({
    ...ax,
    title: {
      standoff: (ax.title && ax.title.standoff) ?? 8,
      ...toTitleObj(ax.title),
    },
    automargin: ax.automargin ?? true,
  });

  const lx = {
    ...layout,
    paper_bgcolor: layout.paper_bgcolor ?? t.paper_bgcolor,
    plot_bgcolor: layout.plot_bgcolor ?? t.plot_bgcolor,
    font: mergeFont,
    title: toTitleObj(layout.title),
    xaxis: {
      ...normAxis(layout.xaxis || {}),
      color: (layout.xaxis && layout.xaxis.color) || t.axisColor,
      gridcolor: (layout.xaxis && layout.xaxis.gridcolor) || t.gridColor,
      zerolinecolor:
        (layout.xaxis && layout.xaxis.zerolinecolor) ||
        t.zeroLineColor ||
        t.gridColor,
    },
    yaxis: {
      ...normAxis(layout.yaxis || {}),
      color: (layout.yaxis && layout.yaxis.color) || t.axisColor,
      gridcolor: (layout.yaxis && layout.yaxis.gridcolor) || t.gridColor,
      zerolinecolor:
        (layout.yaxis && layout.yaxis.zerolinecolor) ||
        t.zeroLineColor ||
        t.gridColor,
    },
    legend: {
      ...(layout.legend || {}),
      font: {
        ...((layout.legend && layout.legend.font) || {}),
        color: mergeFont.color,
      },
    },
  };
  return lx;
}
