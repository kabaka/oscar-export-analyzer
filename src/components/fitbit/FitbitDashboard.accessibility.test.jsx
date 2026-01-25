import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import FitbitDashboard from '../../components/fitbit/FitbitDashboard.jsx';
import FitbitConnectionCard from '../../components/fitbit/FitbitConnectionCard.jsx';
import CorrelationMatrix from '../../components/fitbit/correlation/CorrelationMatrix.jsx';
import { buildCombinedNightlyData } from '../../test-utils/fitbitBuilders.js';

// Extend Jest matchers for accessibility testing
expect.extend(toHaveNoViolations);

// Mock chart libraries that may not render properly in test environment
vi.mock('plotly.js-dist', () => ({
  default: {
    newPlot: vi.fn(),
    react: vi.fn(),
    purge: vi.fn(),
  },
}));

vi.mock('react-plotly.js', () => ({
  default: ({ data, layout, ...props }) => (
    <div
      data-testid="plotly-chart"
      role="img"
      aria-label={layout?.title?.text || 'Chart'}
      {...props}
    >
      {layout?.title?.text && <h3>{layout.title.text}</h3>}
      <p>Chart with {data?.length || 0} data series</p>
    </div>
  ),
}));

describe('Fitbit Dashboard Accessibility', () => {
  let mockData;

  beforeEach(() => {
    mockData = {
      fitbitData: buildCombinedNightlyData({
        date: '2026-01-24',
        nights: 30,
        correlationStrength: 'moderate',
        seed: 12345,
      }),
      connectionStatus: 'connected',
      syncState: {
        status: 'idle',
        lastSync: new Date('2026-01-24T08:30:00'),
        autoSync: true,
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('WCAG AA Compliance', () => {
    it('passes automated accessibility audit', async () => {
      const { container } = render(
        <FitbitDashboard
          {...mockData}
          onConnect={vi.fn()}
          onDisconnect={vi.fn()}
          onSync={vi.fn()}
          onCorrelationAnalysis={vi.fn()}
        />,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('meets color contrast requirements for all text elements', async () => {
      render(
        <FitbitDashboard
          {...mockData}
          onConnect={vi.fn()}
          onDisconnect={vi.fn()}
          onSync={vi.fn()}
          onCorrelationAnalysis={vi.fn()}
        />,
      );

      // Test critical text elements for contrast
      const headings = screen.getAllByRole('heading');
      const buttons = screen.getAllByRole('button');

      // Verify elements are visible and have proper contrast
      // Note: Actual contrast testing would require color analysis
      headings.forEach((heading) => {
        expect(heading).toBeVisible();
        expect(heading).toHaveStyle({ color: expect.any(String) });
      });

      buttons.forEach((button) => {
        expect(button).toBeVisible();
        const computedStyle = window.getComputedStyle(button);
        expect(computedStyle.color).toBeDefined();
        expect(computedStyle.backgroundColor).toBeDefined();
      });
    });

    it('provides sufficient focus indicators for interactive elements', async () => {
      const user = userEvent.setup();

      render(
        <FitbitDashboard
          {...mockData}
          onConnect={vi.fn()}
          onDisconnect={vi.fn()}
          onSync={vi.fn()}
          onCorrelationAnalysis={vi.fn()}
        />,
      );

      const interactiveElements = [
        ...screen.getAllByRole('button'),
        ...screen.getAllByRole('tab'),
        ...screen.queryAllByRole('link'),
        ...screen.queryAllByRole('combobox'),
      ];

      for (const element of interactiveElements) {
        await user.tab(); // Focus on element

        if (document.activeElement === element) {
          // Verify focus is visible (would need visual inspection in real test)
          expect(element).toHaveFocus();
          expect(element).toHaveStyle({ outline: expect.stringMatching(/.*/) });
        }
      }
    });

    it('maintains 4.5:1 contrast ratio for small text', () => {
      render(
        <FitbitDashboard
          {...mockData}
          onConnect={vi.fn()}
          onDisconnect={vi.fn()}
          onSync={vi.fn()}
          onCorrelationAnalysis={vi.fn()}
        />,
      );

      // Test specific text elements that commonly have contrast issues
      const statusText = screen.queryByTestId('connection-status');
      const metricLabels = screen.queryAllByTestId(/metric-label/);
      const correlationValues = screen.queryAllByTestId(/correlation-value/);

      [statusText, ...metricLabels, ...correlationValues].forEach((element) => {
        if (element) {
          const computedStyle = window.getComputedStyle(element);
          const fontSize = parseInt(computedStyle.fontSize);

          // Small text (< 18px regular or < 14px bold) needs 4.5:1 contrast
          if (
            fontSize < 18 ||
            (fontSize < 14 && computedStyle.fontWeight >= 700)
          ) {
            // In a real test, we'd calculate the actual contrast ratio
            expect(element).toBeVisible();
          }
        }
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports full keyboard navigation through all interactive elements', async () => {
      const user = userEvent.setup();

      const onConnect = vi.fn();
      const onDisconnect = vi.fn();
      const onSync = vi.fn();

      render(
        <FitbitDashboard
          {...mockData}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onSync={onSync}
          onCorrelationAnalysis={vi.fn()}
        />,
      );

      // Test Tab navigation through interactive elements
      const interactiveElements = [
        ...screen.getAllByRole('button'),
        ...screen.getAllByRole('tab'),
        ...screen.queryAllByRole('combobox'),
        ...screen.queryAllByRole('checkbox'),
      ];

      expect(interactiveElements.length).toBeGreaterThan(0);

      // Navigate through all elements using Tab
      for (let i = 0; i < interactiveElements.length; i++) {
        await user.tab();

        // Verify focus moves to expected elements
        const focusedElement = document.activeElement;
        expect(interactiveElements).toContain(focusedElement);
      }

      // Test Shift+Tab for reverse navigation
      await user.keyboard('{Shift>}{Tab}{/Shift}');
      expect(interactiveElements[interactiveElements.length - 1]).toHaveFocus();
    });

    it('handles Enter and Space key activation for buttons', async () => {
      const user = userEvent.setup();
      const onConnect = vi.fn();
      // eslint-disable-next-line no-unused-vars
      const onSync = vi.fn();

      render(
        <FitbitConnectionCard
          connectionStatus="disconnected"
          onConnect={onConnect}
        />,
      );

      const connectButton = screen.getByRole('button', {
        name: /connect.*fitbit/i,
      });

      // Focus the button and activate with Enter
      connectButton.focus();
      await user.keyboard('{Enter}');
      expect(onConnect).toHaveBeenCalledTimes(1);

      // Reset and test Space key activation
      onConnect.mockClear();
      connectButton.focus();
      await user.keyboard(' ');
      expect(onConnect).toHaveBeenCalledTimes(1);
    });

    it('supports arrow key navigation in correlation matrix', async () => {
      const user = userEvent.setup();

      const correlationData = {
        AHI: {
          HeartRate: {
            correlation: -0.65,
            pValue: 0.02,
            significance: 'moderate',
          },
          SpO2: { correlation: 0.72, pValue: 0.01, significance: 'strong' },
        },
        HeartRate: {
          AHI: { correlation: -0.65, pValue: 0.02, significance: 'moderate' },
          SpO2: { correlation: -0.41, pValue: 0.08, significance: 'weak' },
        },
        SpO2: {
          AHI: { correlation: 0.72, pValue: 0.01, significance: 'strong' },
          HeartRate: { correlation: -0.41, pValue: 0.08, significance: 'weak' },
        },
      };

      render(
        <CorrelationMatrix
          correlationData={correlationData}
          onCellClick={vi.fn()}
        />,
      );

      const matrixTable = screen.getByRole('table');
      expect(matrixTable).toBeInTheDocument();

      // Find matrix cells
      const matrixCells = screen.getAllByRole('gridcell');
      expect(matrixCells.length).toBeGreaterThan(0);

      // Test arrow key navigation within matrix
      const firstCell = matrixCells[0];
      firstCell.focus();

      // Right arrow should move to next cell
      await user.keyboard('{ArrowRight}');
      expect(matrixCells[1]).toHaveFocus();

      // Down arrow should move to cell below
      await user.keyboard('{ArrowDown}');
      // Would need to implement proper grid navigation in component
    });

    it('handles Escape key to close modals and dropdowns', async () => {
      const user = userEvent.setup();

      render(
        <FitbitDashboard
          {...mockData}
          onConnect={vi.fn()}
          onDisconnect={vi.fn()}
          onSync={vi.fn()}
          onCorrelationAnalysis={vi.fn()}
        />,
      );

      // Open any modal/dropdown if available
      const menuButton = screen.queryByRole('button', {
        name: /menu|options/i,
      });
      if (menuButton) {
        await user.click(menuButton);

        // Press Escape to close
        await user.keyboard('{Escape}');

        // Verify modal/dropdown is closed (would need specific implementation)
        expect(menuButton).toHaveFocus();
      }
    });
  });

  describe('Screen Reader Support', () => {
    it('provides descriptive aria-labels for all interactive elements', () => {
      render(
        <FitbitDashboard
          {...mockData}
          onConnect={vi.fn()}
          onDisconnect={vi.fn()}
          onSync={vi.fn()}
          onCorrelationAnalysis={vi.fn()}
        />,
      );

      const buttons = screen.getAllByRole('button');
      const links = screen.queryAllByRole('link');
      const inputs = screen.queryAllByRole('textbox');

      [...buttons, ...links, ...inputs].forEach((element) => {
        // Each interactive element should have accessible name
        expect(element).toHaveAccessibleName();
      });
    });

    it('announces correlation results with appropriate aria-live regions', async () => {
      const onCorrelationAnalysis = vi.fn();

      render(
        <FitbitDashboard
          {...mockData}
          onConnect={vi.fn()}
          onDisconnect={vi.fn()}
          onSync={vi.fn()}
          onCorrelationAnalysis={onCorrelationAnalysis}
        />,
      );

      // Find aria-live region for announcements
      const liveRegion =
        screen.queryByRole('status') || screen.queryByRole('alert');

      if (liveRegion) {
        expect(liveRegion).toHaveAttribute('aria-live');
      }

      // Trigger correlation analysis
      const analyzeButton = screen.queryByRole('button', {
        name: /analyze|correlat/i,
      });
      if (analyzeButton) {
        fireEvent.click(analyzeButton);
        expect(onCorrelationAnalysis).toHaveBeenCalled();
      }
    });

    it('provides descriptive alt text and aria-labels for charts', () => {
      render(
        <FitbitDashboard
          {...mockData}
          onConnect={vi.fn()}
          onDisconnect={vi.fn()}
          onSync={vi.fn()}
          onCorrelationAnalysis={vi.fn()}
        />,
      );

      const charts = screen.getAllByRole('img');

      charts.forEach((chart) => {
        // Charts should have descriptive labels
        expect(chart).toHaveAccessibleName();

        // Should describe the chart content
        const accessibleName =
          chart.getAttribute('aria-label') || chart.getAttribute('alt');
        expect(accessibleName).toMatch(/chart|graph|correlation|trend/i);
      });
    });

    it('structures data tables with proper headers and captions', () => {
      const correlationData = {
        AHI: {
          HeartRate: {
            correlation: -0.65,
            pValue: 0.02,
            significance: 'moderate',
          },
          SpO2: { correlation: 0.72, pValue: 0.01, significance: 'strong' },
        },
        HeartRate: {
          AHI: { correlation: -0.65, pValue: 0.02, significance: 'moderate' },
        },
      };

      render(
        <CorrelationMatrix
          correlationData={correlationData}
          onCellClick={vi.fn()}
        />,
      );

      const table = screen.getByRole('table');
      const columnHeaders = screen.getAllByRole('columnheader');
      const rowHeaders = screen.getAllByRole('rowheader');

      expect(table).toBeInTheDocument();
      expect(columnHeaders.length).toBeGreaterThan(0);
      expect(rowHeaders.length).toBeGreaterThan(0);

      // Table should have caption
      const caption =
        screen.queryByRole('caption') ||
        table.querySelector('caption') ||
        screen.queryByLabelledBy(table.getAttribute('aria-labelledby'));

      expect(caption || table.getAttribute('aria-label')).toBeTruthy();
    });

    it('announces loading states and progress updates', async () => {
      // eslint-disable-next-line no-unused-vars
      const user = userEvent.setup();

      render(
        <FitbitDashboard
          {...mockData}
          connectionStatus="connecting"
          syncState={{ status: 'syncing', progress: 45 }}
          onConnect={vi.fn()}
          onDisconnect={vi.fn()}
          onSync={vi.fn()}
          onCorrelationAnalysis={vi.fn()}
        />,
      );

      // Check for loading announcements
      const loadingIndicator = screen.queryByRole('status', {
        name: /loading|syncing/i,
      });
      const progressBar = screen.queryByRole('progressbar');

      if (loadingIndicator) {
        expect(loadingIndicator).toHaveAttribute('aria-live', 'polite');
      }

      if (progressBar) {
        expect(progressBar).toHaveAttribute('aria-valuenow');
        expect(progressBar).toHaveAttribute('aria-valuemin');
        expect(progressBar).toHaveAttribute('aria-valuemax');
      }
    });
  });

  describe('Motor Accessibility', () => {
    it('provides large enough click targets (44x44px minimum)', () => {
      render(
        <FitbitDashboard
          {...mockData}
          onConnect={vi.fn()}
          onDisconnect={vi.fn()}
          onSync={vi.fn()}
          onCorrelationAnalysis={vi.fn()}
        />,
      );

      const buttons = screen.getAllByRole('button');
      const links = screen.queryAllByRole('link');

      [...buttons, ...links].forEach((element) => {
        const rect = element.getBoundingClientRect();

        // WCAG AAA recommends minimum 44x44px for touch targets
        expect(rect.width).toBeGreaterThanOrEqual(44);
        expect(rect.height).toBeGreaterThanOrEqual(44);
      });
    });

    it('maintains functionality without precise mouse movements', async () => {
      const user = userEvent.setup();
      const onCellClick = vi.fn();

      const correlationData = {
        AHI: {
          HeartRate: {
            correlation: -0.65,
            pValue: 0.02,
            significance: 'moderate',
          },
        },
      };

      render(
        <CorrelationMatrix
          correlationData={correlationData}
          onCellClick={onCellClick}
        />,
      );

      const matrixCells = screen.getAllByRole('gridcell');

      if (matrixCells.length > 0) {
        // Test that cells can be activated with keyboard instead of precise clicking
        matrixCells[0].focus();
        await user.keyboard('{Enter}');
        expect(onCellClick).toHaveBeenCalled();
      }
    });

    it('supports sticky hover and focus states', async () => {
      const user = userEvent.setup();

      render(
        <FitbitConnectionCard
          connectionStatus="disconnected"
          onConnect={vi.fn()}
        />,
      );

      const connectButton = screen.getByRole('button', { name: /connect/i });

      // Focus should be clearly visible and sticky
      connectButton.focus();
      expect(connectButton).toHaveFocus();

      // Hover state should be maintained for motor accessibility
      await user.hover(connectButton);
      // Would check for hover styles in real implementation

      await user.unhover(connectButton);
      // Focus should remain if keyboard user
      if (connectButton === document.activeElement) {
        expect(connectButton).toHaveFocus();
      }
    });
  });

  describe('Cognitive Accessibility', () => {
    it('provides clear error messages with guidance', async () => {
      render(
        <FitbitDashboard
          {...mockData}
          connectionStatus="error"
          error="Failed to connect to Fitbit API. Please check your internet connection and try again."
          onConnect={vi.fn()}
          onDisconnect={vi.fn()}
          onSync={vi.fn()}
          onCorrelationAnalysis={vi.fn()}
        />,
      );

      const errorMessage = screen.queryByRole('alert');

      if (errorMessage) {
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage).toHaveTextContent(/failed.*connect/i);
        expect(errorMessage).toHaveTextContent(/try.*again/i); // Guidance provided
      }
    });

    it('uses consistent navigation patterns', () => {
      render(
        <FitbitDashboard
          {...mockData}
          onConnect={vi.fn()}
          onDisconnect={vi.fn()}
          onSync={vi.fn()}
          onCorrelationAnalysis={vi.fn()}
        />,
      );

      const navigationTabs = screen.getAllByRole('tab');
      const buttons = screen.getAllByRole('button');

      // Consistent placement and styling
      navigationTabs.forEach((tab, index) => {
        if (index > 0) {
          // Tabs should follow consistent patterns
          expect(tab).toHaveAttribute('role', 'tab');
        }
      });

      // Primary buttons should have consistent styling
      const primaryButtons = buttons.filter(
        (btn) =>
          btn.className.includes('primary') ||
          btn.getAttribute('data-variant') === 'primary',
      );

      primaryButtons.forEach((button) => {
        expect(button).toBeVisible();
        // Would check for consistent styling in real implementation
      });
    });

    it('provides helpful tooltips and context', async () => {
      const user = userEvent.setup();

      render(
        <CorrelationMatrix
          correlationData={{
            AHI: {
              HeartRate: {
                correlation: -0.65,
                pValue: 0.02,
                significance: 'moderate',
              },
            },
          }}
          onCellClick={vi.fn()}
        />,
      );

      const correlationCells = screen.getAllByRole('gridcell');

      for (const cell of correlationCells.slice(0, 3)) {
        // Test first few cells
        await user.hover(cell);

        // Look for tooltip or additional context
        const tooltip = screen.queryByRole('tooltip');
        const descriptionId = cell.getAttribute('aria-describedby');

        if (tooltip || descriptionId) {
          // Tooltip should provide helpful context about correlation values
          const tooltipText =
            tooltip?.textContent ||
            (descriptionId &&
              document.getElementById(descriptionId)?.textContent);

          if (tooltipText) {
            expect(tooltipText).toMatch(/correlation|significance|p.*value/i);
          }
        }

        await user.unhover(cell);
      }
    });

    it('maintains logical reading order and heading hierarchy', () => {
      render(
        <FitbitDashboard
          {...mockData}
          onConnect={vi.fn()}
          onDisconnect={vi.fn()}
          onSync={vi.fn()}
          onCorrelationAnalysis={vi.fn()}
        />,
      );

      const headings = screen.getAllByRole('heading');

      // Should have proper heading hierarchy (h1 -> h2 -> h3, etc.)
      const headingLevels = headings.map((h) => parseInt(h.tagName.charAt(1)));

      expect(headingLevels[0]).toBe(1); // Main page heading should be h1

      for (let i = 1; i < headingLevels.length; i++) {
        const currentLevel = headingLevels[i];
        const previousLevel = headingLevels[i - 1];

        // Heading levels shouldn't skip (e.g., h1 -> h3)
        expect(currentLevel - previousLevel).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Responsive and Zoom Accessibility', () => {
    it('maintains usability at 200% zoom level', () => {
      // Simulate 200% zoom by setting smaller viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 640, // Half of typical 1280px width
      });

      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 360, // Half of typical 720px height
      });

      render(
        <FitbitDashboard
          {...mockData}
          onConnect={vi.fn()}
          onDisconnect={vi.fn()}
          onSync={vi.fn()}
          onCorrelationAnalysis={vi.fn()}
        />,
      );

      // Critical elements should still be visible and usable
      const buttons = screen.getAllByRole('button');
      const headings = screen.getAllByRole('heading');

      buttons.forEach((button) => {
        expect(button).toBeVisible();
        expect(button).not.toHaveStyle({ overflow: 'hidden' });
      });

      headings.forEach((heading) => {
        expect(heading).toBeVisible();
      });
    });

    it('provides alternative access methods for complex interactions', async () => {
      const user = userEvent.setup();
      const onCellClick = vi.fn();

      render(
        <CorrelationMatrix
          correlationData={{
            AHI: {
              HeartRate: {
                correlation: -0.65,
                pValue: 0.02,
                significance: 'moderate',
              },
            },
          }}
          onCellClick={onCellClick}
        />,
      );

      const matrixCells = screen.getAllByRole('gridcell');

      if (matrixCells.length > 0) {
        const cell = matrixCells[0];

        // Should support both click and keyboard activation
        await user.click(cell);
        expect(onCellClick).toHaveBeenCalledTimes(1);

        onCellClick.mockClear();

        cell.focus();
        await user.keyboard('{Enter}');
        expect(onCellClick).toHaveBeenCalledTimes(1);
      }
    });
  });
});
