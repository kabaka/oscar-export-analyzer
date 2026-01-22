import { describe, it, expect } from 'vitest';
import { applyChartTheme } from './chartTheme';

describe('chartTheme.js - Theme application', () => {
  describe('Light mode theme', () => {
    it('applies light colors when isDark=false', () => {
      const theme = applyChartTheme(false);

      expect(theme.paper_bgcolor).toBe('#ffffff');
      expect(theme.plot_bgcolor).toBe('#ffffff');
      expect(theme.font.color).toBe('#0b1220');
      expect(theme.xaxis.color).toBe('#5b6472');
      expect(theme.yaxis.color).toBe('#5b6472');
    });

    it('uses light gray grid for light mode', () => {
      const theme = applyChartTheme(false);

      expect(theme.xaxis.gridcolor).toBe('#e7ebf0');
      expect(theme.yaxis.gridcolor).toBe('#e7ebf0');
    });

    it('preserves custom layout properties in light mode', () => {
      const customLayout = {
        title: 'My Chart',
        xaxis: { title: 'Time' },
        yaxis: { title: 'AHI' },
      };

      const theme = applyChartTheme(false, customLayout);

      expect(theme.title.text).toBe('My Chart');
      expect(theme.xaxis.title.text).toBe('Time');
      expect(theme.yaxis.title.text).toBe('AHI');
    });
  });

  describe('Dark mode theme', () => {
    it('applies dark colors when isDark=true', () => {
      const theme = applyChartTheme(true);

      expect(theme.paper_bgcolor).toBe('#121821');
      expect(theme.plot_bgcolor).toBe('#121821');
      expect(theme.font.color).toBe('#e6eaef');
      expect(theme.xaxis.color).toBe('#aab2bd');
      expect(theme.yaxis.color).toBe('#aab2bd');
    });

    it('uses dark gray grid for dark mode', () => {
      const theme = applyChartTheme(true);

      expect(theme.xaxis.gridcolor).toBe('#1e2734');
      expect(theme.yaxis.gridcolor).toBe('#1e2734');
    });

    it('provides zero line color for dark mode', () => {
      const theme = applyChartTheme(true);

      expect(theme.xaxis.zerolinecolor).toBe('#2c3747');
      expect(theme.yaxis.zerolinecolor).toBe('#2c3747');
    });

    it('preserves custom layout properties in dark mode', () => {
      const customLayout = {
        title: 'Dark Chart',
        xaxis: { title: 'Date' },
        yaxis: { title: 'Pressure' },
      };

      const theme = applyChartTheme(true, customLayout);

      expect(theme.title.text).toBe('Dark Chart');
      expect(theme.xaxis.title.text).toBe('Date');
      expect(theme.yaxis.title.text).toBe('Pressure');
    });
  });

  describe('Title handling', () => {
    it('normalizes string title to object format', () => {
      const theme = applyChartTheme(false, { title: 'My Title' });

      expect(theme.title).toBeDefined();
      expect(theme.title.text).toBe('My Title');
    });

    it('preserves title object format', () => {
      const titleObj = { text: 'My Title', x: 0.5 };
      const theme = applyChartTheme(false, { title: titleObj });

      expect(theme.title.text).toBe('My Title');
      expect(theme.title.x).toBe(0.5);
    });

    it('handles missing title gracefully', () => {
      const theme = applyChartTheme(false);

      expect(theme.title).toBeDefined();
      expect(typeof theme.title).toBe('object');
    });
  });

  describe('Axis configuration', () => {
    it('normalizes axis titles to object format', () => {
      const theme = applyChartTheme(false, {
        xaxis: { title: 'Time' },
        yaxis: { title: 'AHI' },
      });

      expect(theme.xaxis.title.text).toBe('Time');
      expect(theme.yaxis.title.text).toBe('AHI');
    });

    it('preserves axis title objects', () => {
      const customXAxis = { title: { text: 'Date', standoff: 16 } };
      const theme = applyChartTheme(false, { xaxis: customXAxis });

      expect(theme.xaxis.title.text).toBe('Date');
      expect(theme.xaxis.title.standoff).toBe(16);
    });

    it('sets default standoff for axis titles when not specified', () => {
      const theme = applyChartTheme(false, {
        xaxis: { title: 'Time' },
      });

      expect(theme.xaxis.title.standoff).toBe(8);
    });

    it('preserves custom standoff value', () => {
      const theme = applyChartTheme(false, {
        xaxis: { title: { text: 'Time', standoff: 20 } },
      });

      expect(theme.xaxis.title.standoff).toBe(20);
    });

    it('enables automargin for axes by default', () => {
      const theme = applyChartTheme(false, {
        xaxis: { title: 'Time' },
      });

      expect(theme.xaxis.automargin).toBe(true);
    });

    it('preserves custom automargin setting', () => {
      const theme = applyChartTheme(false, {
        xaxis: { automargin: false },
      });

      expect(theme.xaxis.automargin).toBe(false);
    });
  });

  describe('Font handling', () => {
    it('merges custom font with theme font', () => {
      const customLayout = {
        font: { size: 14, family: 'Arial' },
      };

      const theme = applyChartTheme(false, customLayout);

      expect(theme.font.color).toBe('#0b1220');
      expect(theme.font.size).toBe(14);
      expect(theme.font.family).toBe('Arial');
    });

    it('theme font color takes precedence over custom', () => {
      const customLayout = {
        font: { color: '#ff0000' },
      };

      const theme = applyChartTheme(false, customLayout);

      // Light mode color should win
      expect(theme.font.color).toBe('#0b1220');
    });

    it('applies theme font to legend', () => {
      const theme = applyChartTheme(false);

      expect(theme.legend.font.color).toBe('#0b1220');
    });

    it('preserves legend font customizations', () => {
      const customLayout = {
        legend: { font: { size: 12 } },
      };

      const theme = applyChartTheme(false, customLayout);

      expect(theme.legend.font.size).toBe(12);
      expect(theme.legend.font.color).toBe('#0b1220');
    });
  });

  describe('Color customization', () => {
    it('allows custom axis color', () => {
      const customLayout = {
        xaxis: { color: '#0000ff' },
      };

      const theme = applyChartTheme(false, customLayout);

      expect(theme.xaxis.color).toBe('#0000ff');
    });

    it('allows custom grid color', () => {
      const customLayout = {
        xaxis: { gridcolor: '#cccccc' },
      };

      const theme = applyChartTheme(false, customLayout);

      expect(theme.xaxis.gridcolor).toBe('#cccccc');
    });

    it('allows custom zero line color', () => {
      const customLayout = {
        xaxis: { zerolinecolor: '#999999' },
      };

      const theme = applyChartTheme(false, customLayout);

      expect(theme.xaxis.zerolinecolor).toBe('#999999');
    });

    it('theme colors override empty custom colors', () => {
      const customLayout = {
        xaxis: { color: undefined },
      };

      const theme = applyChartTheme(false, customLayout);

      expect(theme.xaxis.color).toBe('#5b6472');
    });
  });

  describe('Default layout handling', () => {
    it('handles empty layout object', () => {
      const theme = applyChartTheme(false, {});

      expect(theme.paper_bgcolor).toBe('#ffffff');
      expect(theme.xaxis).toBeDefined();
      expect(theme.yaxis).toBeDefined();
    });

    it('handles undefined layout', () => {
      const theme = applyChartTheme(false);

      expect(theme.paper_bgcolor).toBe('#ffffff');
      expect(theme.xaxis).toBeDefined();
      expect(theme.yaxis).toBeDefined();
    });

    it('creates new layout object, does not mutate input', () => {
      const input = { title: 'Test' };
      const theme = applyChartTheme(false, input);

      expect(input.title).toBe('Test');
      expect(input.paper_bgcolor).toBeUndefined();
      expect(theme.paper_bgcolor).toBe('#ffffff');
    });
  });

  describe('Theme switching', () => {
    it('switching from light to dark changes colors', () => {
      const light = applyChartTheme(false);
      const dark = applyChartTheme(true);

      expect(light.paper_bgcolor).not.toBe(dark.paper_bgcolor);
      expect(light.font.color).not.toBe(dark.font.color);
      expect(light.xaxis.color).not.toBe(dark.xaxis.color);
    });

    it('switching to dark increases contrast for better visibility', () => {
      const dark = applyChartTheme(true);

      // Dark backgrounds with light text
      expect(dark.paper_bgcolor).toBe('#121821'); // very dark
      expect(dark.font.color).toBe('#e6eaef'); // light
      expect(dark.xaxis.gridcolor).toBe('#1e2734'); // slightly lighter than background
    });

    it('dark mode grid is darker to prevent light appearance', () => {
      const light = applyChartTheme(false);
      const dark = applyChartTheme(true);

      // Compare brightness values
      expect(light.xaxis.gridcolor).toBe('#e7ebf0');
      expect(dark.xaxis.gridcolor).toBe('#1e2734');
      // Dark grid should not look light
      expect(dark.xaxis.gridcolor).not.toBe('#e7ebf0');
    });
  });

  describe('Complex layout scenarios', () => {
    it('handles multi-axis chart configuration', () => {
      const complexLayout = {
        title: 'Multi-Series Chart',
        xaxis: { title: 'Date', type: 'date' },
        yaxis: { title: 'Primary', type: 'linear' },
      };

      const theme = applyChartTheme(false, complexLayout);

      expect(theme.title.text).toBe('Multi-Series Chart');
      expect(theme.xaxis.title.text).toBe('Date');
      expect(theme.yaxis.title.text).toBe('Primary');
    });

    it('preserves custom layout alongside theme application', () => {
      const complexLayout = {
        margin: { l: 50, r: 50, t: 50, b: 50 },
        showlegend: true,
        hovermode: 'x unified',
      };

      const theme = applyChartTheme(false, complexLayout);

      expect(theme.margin).toBeDefined();
      expect(theme.showlegend).toBe(true);
      expect(theme.hovermode).toBe('x unified');
    });

    it('handles both light theme and custom properties', () => {
      const layout = {
        title: 'Chart with Theme',
        xaxis: { title: 'X Axis' },
        yaxis: { title: 'Y Axis' },
        margin: { l: 60, r: 40, t: 40, b: 40 },
      };

      const theme = applyChartTheme(false, layout);

      expect(theme.paper_bgcolor).toBe('#ffffff');
      expect(theme.margin.l).toBe(60);
      expect(theme.xaxis.title.text).toBe('X Axis');
    });
  });

  describe('Type safety and edge cases', () => {
    it('handles null layout gracefully', () => {
      const theme = applyChartTheme(false, null);

      expect(theme.paper_bgcolor).toBe('#ffffff');
      expect(theme.xaxis).toBeDefined();
    });

    it('applies theme consistently across multiple calls', () => {
      const theme1 = applyChartTheme(false);
      const theme2 = applyChartTheme(false);

      expect(theme1.paper_bgcolor).toBe(theme2.paper_bgcolor);
      expect(theme1.font.color).toBe(theme2.font.color);
    });

    it('handles axis with only title normalization needed', () => {
      const layout = {
        xaxis: { title: 'Normalized' },
      };

      const theme = applyChartTheme(false, layout);

      expect(theme.xaxis.title.text).toBe('Normalized');
      expect(theme.xaxis.color).toBe('#5b6472');
    });
  });
});
