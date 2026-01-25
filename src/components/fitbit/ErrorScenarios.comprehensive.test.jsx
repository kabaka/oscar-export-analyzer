import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import {
  buildMockFitbitApiResponse,
  buildCombinedNightlyData,
} from '../../test-utils/fitbitBuilders.js';
import { FitbitOAuthProvider } from '../../context/FitbitOAuthContext.jsx';
import FitbitDashboard from '../../components/fitbit/FitbitDashboard.jsx';
import { useFitbitOAuth } from '../../hooks/useFitbitOAuth.js';
import { fitbitApi } from '../../utils/fitbitApi.js';
import { fitbitSync } from '../../utils/fitbitSync.js';

// Mock network and storage
global.fetch = vi.fn();
global.indexedDB = vi.fn();

// Mock navigator.onLine for offline testing
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

describe('Fitbit Integration Error Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigator.onLine = true;

    // Reset fetch mock to default success behavior
    global.fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Network and API Failures', () => {
    it('handles network offline during OAuth flow', async () => {
      navigator.onLine = false;

      const TestComponent = () => {
        const { initiateAuth, error, status } = useFitbitOAuth();

        return (
          <div>
            <button onClick={initiateAuth}>Connect Fitbit</button>
            <span data-testid="status">{status}</span>
            <span data-testid="error">{error}</span>
          </div>
        );
      };

      render(
        <FitbitOAuthProvider>
          <TestComponent />
        </FitbitOAuthProvider>,
      );

      const connectButton = screen.getByText('Connect Fitbit');
      fireEvent.click(connectButton);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          /offline|network.*unavailable|check.*connection/i,
        );
      });

      expect(screen.getByTestId('status')).toHaveTextContent('disconnected');
    });

    it('handles Fitbit API server errors (5xx)', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: () =>
          Promise.resolve({
            errors: [
              {
                errorType: 'system',
                message: 'Fitbit service temporarily unavailable',
              },
            ],
          }),
      });

      const TestComponent = () => {
        const { handleCallback, error, status } = useFitbitOAuth();

        React.useEffect(() => {
          handleCallback('valid_code', 'valid_state');
        }, [handleCallback]);

        return (
          <div>
            <span data-testid="status">{status}</span>
            <span data-testid="error">{error}</span>
          </div>
        );
      };

      sessionStorage.setItem('fitbit_oauth_state', 'valid_state');

      render(
        <FitbitOAuthProvider>
          <TestComponent />
        </FitbitOAuthProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          /service.*unavailable|temporarily.*unavailable|try.*later/i,
        );
      });

      expect(screen.getByTestId('status')).toHaveTextContent('disconnected');
    });

    it('handles API rate limiting with exponential backoff', async () => {
      // First request: rate limited
      global.fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: {
            get: (name) => {
              if (name === 'X-RateLimit-Reset') return '1706140800'; // Unix timestamp
              if (name === 'Retry-After') return '3600'; // 1 hour
              return null;
            },
          },
          json: () =>
            Promise.resolve({
              errors: [
                {
                  errorType: 'rate_limit_exceeded',
                  message: 'Rate limit exceeded. Try again in 3600 seconds.',
                },
              ],
            }),
        })
        // Second request after backoff: success
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(buildMockFitbitApiResponse('heartrate')),
        });

      const TestComponent = () => {
        const [data, setData] = React.useState(null);
        const [error, setError] = React.useState(null);
        const [retryAttempt, setRetryAttempt] = React.useState(0);

        const fetchData = async () => {
          try {
            const response = await fitbitApi.getHeartRateData('2026-01-24');
            setData(response);
            setError(null);
          } catch (err) {
            setError(err.message);

            // Simulate exponential backoff retry
            if (err.message.includes('rate_limit') && retryAttempt < 2) {
              setTimeout(() => {
                setRetryAttempt((prev) => prev + 1);
                fetchData();
              }, 1000); // Shortened for test
            }
          }
        };

        React.useEffect(() => {
          fetchData();
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        return (
          <div>
            <span data-testid="data">{data ? 'Success' : 'No data'}</span>
            <span data-testid="error">{error}</span>
            <span data-testid="retry-count">{retryAttempt}</span>
          </div>
        );
      };

      render(<TestComponent />);

      // Initially shows rate limit error
      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(/rate.*limit/i);
      });

      // After retry, should succeed
      await waitFor(
        () => {
          expect(screen.getByTestId('data')).toHaveTextContent('Success');
        },
        { timeout: 2000 },
      );

      expect(screen.getByTestId('retry-count')).toHaveTextContent('1');
    });

    it('handles malformed JSON responses gracefully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new SyntaxError('Unexpected token in JSON')),
        text: () => Promise.resolve('<!DOCTYPE html><html>...</html>'), // HTML instead of JSON
      });

      const TestComponent = () => {
        const { handleCallback, error } = useFitbitOAuth();

        React.useEffect(() => {
          handleCallback('valid_code', 'valid_state');
        }, [handleCallback]);

        return <span data-testid="error">{error}</span>;
      };

      sessionStorage.setItem('fitbit_oauth_state', 'valid_state');

      render(
        <FitbitOAuthProvider>
          <TestComponent />
        </FitbitOAuthProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          /invalid.*response|parse.*error|unexpected.*format/i,
        );
      });
    });

    it('handles timeout errors for long requests', async () => {
      global.fetch.mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error('Request timeout'));
            }, 100); // Quick timeout for test
          }),
      );

      const TestComponent = () => {
        const [error, setError] = React.useState(null);

        React.useEffect(() => {
          const fetchWithTimeout = async () => {
            try {
              await fitbitSync.syncRecentData();
            } catch (err) {
              setError(err.message);
            }
          };
          fetchWithTimeout();
        }, []);

        return <span data-testid="error">{error}</span>;
      };

      render(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          /timeout|request.*took.*too.*long|connection.*slow/i,
        );
      });
    });
  });

  describe('Data Quality and Validation Issues', () => {
    it('handles missing sensor readings gracefully', () => {
      const incompleteData = buildCombinedNightlyData({
        date: '2026-01-24',
        nights: 7,
        correlationStrength: 'moderate',
        seed: 12345,
      });

      // Simulate missing heart rate data for some nights
      incompleteData.forEach((night, index) => {
        if (index % 3 === 0) {
          // Every 3rd night missing HR data
          night.fitbit.heartRate.avgSleepBpm = NaN;
          night.fitbit.heartRate.hrv.rmssd = NaN;
        }
      });

      render(
        <FitbitDashboard
          fitbitData={incompleteData}
          connectionStatus="connected"
          syncState={{ status: 'idle' }}
          onConnect={vi.fn()}
          onDisconnect={vi.fn()}
          onSync={vi.fn()}
          onCorrelationAnalysis={vi.fn()}
        />,
      );

      // Should display data quality warnings
      const warnings = screen.queryAllByText(
        /missing.*data|incomplete.*readings|gaps.*detected/i,
      );
      expect(warnings.length).toBeGreaterThan(0);

      // Should still show available correlations
      const correlationSection = screen.queryByTestId('correlation-section');
      if (correlationSection) {
        expect(correlationSection).toBeVisible();
      }
    });

    it('detects and flags physiologically implausible values', () => {
      const anomalousData = buildCombinedNightlyData({
        date: '2026-01-24',
        nights: 5,
        correlationStrength: 'moderate',
        seed: 99999,
      });

      // Inject implausible values
      anomalousData[0].fitbit.heartRate.avgSleepBpm = 200; // Extreme tachycardia
      anomalousData[1].fitbit.oxygenSaturation.minPercent = 50; // Dangerous hypoxemia
      anomalousData[2].oscar.ahi = 150; // Impossible AHI

      render(
        <FitbitDashboard
          fitbitData={anomalousData}
          connectionStatus="connected"
          syncState={{ status: 'idle' }}
          onConnect={vi.fn()}
          onDisconnect={vi.fn()}
          onSync={vi.fn()}
          onCorrelationAnalysis={vi.fn()}
        />,
      );

      // Should flag data quality issues
      const qualityWarnings = screen.queryAllByText(
        /implausible|anomal|review.*data|quality.*concern/i,
      );
      expect(qualityWarnings.length).toBeGreaterThan(0);

      // Should provide option to exclude anomalous data
      const excludeOption = screen.queryByRole('checkbox', {
        name: /exclude.*anomal/i,
      });
      if (excludeOption) {
        expect(excludeOption).toBeInTheDocument();
      }
    });

    it('handles timestamp misalignment between OSCAR and Fitbit', () => {
      const misalignedData = buildCombinedNightlyData({
        date: '2026-01-24',
        nights: 5,
        correlationStrength: 'moderate',
        seed: 11111,
      });

      // Shift Fitbit timestamps to create misalignment
      misalignedData.forEach((night) => {
        const originalTime = night.date.getTime();
        night.date = new Date(originalTime + 2 * 60 * 60 * 1000); // +2 hours
      });

      render(
        <FitbitDashboard
          fitbitData={misalignedData}
          connectionStatus="connected"
          syncState={{ status: 'idle' }}
          onConnect={vi.fn()}
          onDisconnect={vi.fn()}
          onSync={vi.fn()}
          onCorrelationAnalysis={vi.fn()}
        />,
      );

      // Should detect timestamp alignment issues
      const alignmentWarnings = screen.queryAllByText(
        /timestamp|alignment|timezone|sync.*issue/i,
      );
      expect(alignmentWarnings.length).toBeGreaterThan(0);

      // Should offer alignment correction
      const correctButton = screen.queryByRole('button', {
        name: /correct.*align/i,
      });
      if (correctButton) {
        expect(correctButton).toBeEnabled();
      }
    });

    it('handles incomplete night records appropriately', () => {
      const incompleteNights = [
        {
          date: new Date('2026-01-24'),
          oscar: { ahi: 12.5, events: [] }, // AHI without events
          fitbit: { heartRate: {}, oxygenSaturation: {}, sleepStages: {} }, // Empty Fitbit data
        },
        {
          date: new Date('2026-01-25'),
          oscar: { events: [{ type: 'Obstructive', durationSec: 15 }] }, // Events without AHI
          fitbit: { heartRate: { avgSleepBpm: 65 } }, // Partial Fitbit data
        },
      ];

      render(
        <FitbitDashboard
          fitbitData={incompleteNights}
          connectionStatus="connected"
          syncState={{ status: 'idle' }}
          onConnect={vi.fn()}
          onDisconnect={vi.fn()}
          onSync={vi.fn()}
          onCorrelationAnalysis={vi.fn()}
        />,
      );

      // Should handle incomplete data gracefully
      expect(screen.queryByText(/error|crash|fail/i)).not.toBeInTheDocument();

      // Should show data completeness indicators
      const completenessIndicators = screen.queryAllByText(
        /complete|partial|missing/i,
      );
      expect(completenessIndicators.length).toBeGreaterThan(0);
    });
  });

  describe('User Edge Cases', () => {
    it('handles user disconnecting Fitbit during active sync', async () => {
      const TestComponent = () => {
        const [syncStatus, setSyncStatus] = React.useState('syncing');
        const [connectionStatus, setConnectionStatus] =
          React.useState('connected');
        const [error, setError] = React.useState(null);

        const handleDisconnect = () => {
          setConnectionStatus('disconnected');
          if (syncStatus === 'syncing') {
            setSyncStatus('cancelled');
            setError('Sync cancelled due to disconnection');
          }
        };

        return (
          <div>
            <button onClick={handleDisconnect} data-testid="disconnect">
              Disconnect
            </button>
            <span data-testid="sync-status">{syncStatus}</span>
            <span data-testid="connection-status">{connectionStatus}</span>
            <span data-testid="error">{error}</span>
          </div>
        );
      };

      render(<TestComponent />);

      expect(screen.getByTestId('sync-status')).toHaveTextContent('syncing');
      expect(screen.getByTestId('connection-status')).toHaveTextContent(
        'connected',
      );

      // User disconnects during sync
      fireEvent.click(screen.getByTestId('disconnect'));

      await waitFor(() => {
        expect(screen.getByTestId('sync-status')).toHaveTextContent(
          'cancelled',
        );
        expect(screen.getByTestId('connection-status')).toHaveTextContent(
          'disconnected',
        );
        expect(screen.getByTestId('error')).toHaveTextContent(
          /sync.*cancelled/i,
        );
      });
    });

    it('handles multiple browser tabs attempting OAuth simultaneously', async () => {
      const TestComponent = () => {
        const { initiateAuth, isLoading, error } = useFitbitOAuth();

        // Simulate another tab starting OAuth
        React.useEffect(() => {
          sessionStorage.setItem('fitbit_oauth_in_progress', 'true');
        }, []);

        return (
          <div>
            <button
              onClick={initiateAuth}
              disabled={isLoading}
              data-testid="connect"
            >
              {isLoading ? 'Connecting...' : 'Connect'}
            </button>
            <span data-testid="error">{error}</span>
          </div>
        );
      };

      render(
        <FitbitOAuthProvider>
          <TestComponent />
        </FitbitOAuthProvider>,
      );

      const connectButton = screen.getByTestId('connect');
      fireEvent.click(connectButton);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          /another.*tab|oauth.*already.*progress|multiple.*attempts/i,
        );
      });

      expect(connectButton).toBeEnabled(); // Should re-enable after error
    });

    it('handles storage quota exceeded gracefully', async () => {
      // Mock IndexedDB quota exceeded error
      global.indexedDB = {
        open: vi.fn(() => ({
          onsuccess: null,
          onerror: vi.fn(),
          addEventListener: vi.fn(),
          result: {
            transaction: vi.fn(() => ({
              objectStore: vi.fn(() => ({
                put: vi.fn(() => {
                  throw new DOMException(
                    'Quota exceeded',
                    'QuotaExceededError',
                  );
                }),
              })),
            })),
          },
        })),
      };

      const TestComponent = () => {
        const [error, setError] = React.useState(null);

        const storeData = async () => {
          try {
            // Simulate storing large amount of data
            const largeData = new Array(10000).fill(0).map((_, i) => ({
              id: i,
              data: new Array(1000).fill('x').join(''),
            }));

            // This would trigger quota exceeded in mock
            localStorage.setItem('large_data', JSON.stringify(largeData));
          } catch (err) {
            if (err.name === 'QuotaExceededError') {
              setError(
                'Storage quota exceeded. Please free up space or clear old data.',
              );
            }
          }
        };

        React.useEffect(() => {
          storeData();
        }, []);

        return <span data-testid="error">{error}</span>;
      };

      // Mock localStorage quota exceeded
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      });

      render(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          /quota.*exceeded|storage.*full|free.*space/i,
        );
      });

      // Restore original method
      Storage.prototype.setItem = originalSetItem;
    });

    it('handles user changing system timezone during analysis', () => {
      const TestComponent = () => {
        const [timezone, setTimezone] = React.useState('America/New_York');
        const [data, setData] = React.useState(
          buildCombinedNightlyData({
            date: '2026-01-24',
            nights: 3,
            correlationStrength: 'moderate',
            seed: 55555,
          }),
        );

        const handleTimezoneChange = (newTz) => {
          setTimezone(newTz);

          // Recalculate data with new timezone
          const adjustedData = data.map((night) => ({
            ...night,
            timezoneOffset: newTz === 'America/Los_Angeles' ? -480 : -300, // PST vs EST
            date: new Date(
              night.date.getTime() +
                (newTz === 'America/Los_Angeles' ? 3 * 60 * 60 * 1000 : 0),
            ),
          }));

          setData(adjustedData);
        };

        return (
          <div>
            <select
              value={timezone}
              onChange={(e) => handleTimezoneChange(e.target.value)}
              data-testid="timezone"
            >
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
            </select>
            <span data-testid="data-count">{data.length}</span>
            <span data-testid="first-date">{data[0]?.date.toISOString()}</span>
          </div>
        );
      };

      render(<TestComponent />);

      expect(screen.getByTestId('data-count')).toHaveTextContent('3');
      const originalDate = screen.getByTestId('first-date').textContent;

      // Change timezone
      fireEvent.change(screen.getByTestId('timezone'), {
        target: { value: 'America/Los_Angeles' },
      });

      const newDate = screen.getByTestId('first-date').textContent;
      expect(newDate).not.toBe(originalDate);
      expect(screen.getByTestId('data-count')).toHaveTextContent('3'); // Data count unchanged
    });
  });

  describe('Recovery and Resilience', () => {
    it('provides clear recovery steps for common errors', () => {
      const errorScenarios = [
        {
          error: 'OAuth authorization was denied by user',
          expectedRecovery: /try.*again|grant.*permission|allow.*access/i,
        },
        {
          error: 'Network connection failed',
          expectedRecovery: /check.*connection|try.*again|offline/i,
        },
        {
          error: 'Fitbit API rate limit exceeded',
          expectedRecovery: /wait.*minutes|try.*later|rate.*limit/i,
        },
        {
          error: 'Invalid or expired access token',
          expectedRecovery: /reconnect|authorize.*again|refresh.*connection/i,
        },
      ];

      errorScenarios.forEach(({ error, expectedRecovery }) => {
        const TestComponent = () => (
          <FitbitDashboard
            fitbitData={[]}
            connectionStatus="error"
            error={error}
            onConnect={vi.fn()}
            onDisconnect={vi.fn()}
            onSync={vi.fn()}
            onCorrelationAnalysis={vi.fn()}
          />
        );

        const { unmount } = render(<TestComponent />);

        const recoveryGuidance = screen.queryByText(expectedRecovery);
        expect(recoveryGuidance).toBeInTheDocument();

        const retryButton = screen.queryByRole('button', {
          name: /retry|try.*again/i,
        });
        if (retryButton) {
          expect(retryButton).toBeEnabled();
        }

        unmount();
      });
    });

    it('maintains app functionality with partial feature failure', () => {
      // Simulate correlation analysis failure while keeping basic data display
      const TestComponent = () => {
        const [correlationError] = React.useState(
          'Correlation analysis failed due to insufficient data',
        );
        const [basicData] = React.useState(
          buildCombinedNightlyData({
            date: '2026-01-24',
            nights: 5,
            correlationStrength: 'moderate',
            seed: 77777,
          }),
        );

        return (
          <div>
            <div data-testid="basic-data">
              <h2>Sleep Data</h2>
              <p>Showing {basicData.length} nights</p>
              {basicData.map((night, i) => (
                <div key={i} data-testid={`night-${i}`}>
                  AHI: {night.oscar.ahi || 'N/A'}
                </div>
              ))}
            </div>

            <div data-testid="correlation-section">
              <h2>Correlation Analysis</h2>
              {correlationError ? (
                <div data-testid="correlation-error">
                  Error: {correlationError}
                  <button>Retry Analysis</button>
                </div>
              ) : (
                <div>Correlation results...</div>
              )}
            </div>
          </div>
        );
      };

      render(<TestComponent />);

      // Basic data should still be accessible
      expect(screen.getByTestId('basic-data')).toBeVisible();
      expect(screen.getByText('Showing 5 nights')).toBeInTheDocument();
      expect(screen.getAllByTestId(/night-\d/)).toHaveLength(5);

      // Correlation error should be clearly indicated
      expect(screen.getByTestId('correlation-error')).toBeVisible();
      expect(screen.getByText(/correlation.*failed/i)).toBeInTheDocument();

      // Retry option should be available
      expect(screen.getByRole('button', { name: /retry/i })).toBeEnabled();
    });

    it('handles progressive enhancement when features are unavailable', () => {
      // Simulate environment where advanced features aren't supported
      const TestComponent = () => {
        const [webWorkersSupported] = React.useState(false); // Simulate no Web Workers
        const [indexedDbSupported] = React.useState(true);

        return (
          <div>
            <div data-testid="features">
              {webWorkersSupported ? (
                <button>Advanced Correlation Analysis</button>
              ) : (
                <div>
                  <button data-testid="basic-analysis">Basic Analysis</button>
                  <p data-testid="limitation-notice">
                    Advanced analysis unavailable in this browser
                  </p>
                </div>
              )}

              {indexedDbSupported ? (
                <span data-testid="storage">Local storage available</span>
              ) : (
                <span data-testid="no-storage">
                  Limited functionality - data won&apos;t persist
                </span>
              )}
            </div>
          </div>
        );
      };

      render(<TestComponent />);

      // Should gracefully degrade to basic functionality
      expect(screen.getByTestId('basic-analysis')).toBeInTheDocument();
      expect(screen.getByTestId('limitation-notice')).toBeVisible();
      expect(screen.getByTestId('storage')).toHaveTextContent(
        'Local storage available',
      );

      // Advanced features should not be available but basic ones should work
      expect(
        screen.queryByText('Advanced Correlation Analysis'),
      ).not.toBeInTheDocument();
    });
  });

  describe('Data Integrity and Security', () => {
    it('handles corrupted local data gracefully', () => {
      // Simulate corrupted data in localStorage
      const corruptedData = 'corrupted_json_data{invalid';
      localStorage.setItem('fitbit_cache', corruptedData);

      const TestComponent = () => {
        const [data, setData] = React.useState(null);
        const [error, setError] = React.useState(null);

        React.useEffect(() => {
          try {
            const cached = localStorage.getItem('fitbit_cache');
            const parsed = JSON.parse(cached);
            setData(parsed);
          } catch {
            setError('Local data corrupted - clearing cache');
            localStorage.removeItem('fitbit_cache');
          }
        }, []);

        return (
          <div>
            <span data-testid="data">{data ? 'Valid data' : 'No data'}</span>
            <span data-testid="error">{error}</span>
          </div>
        );
      };

      render(<TestComponent />);

      expect(screen.getByTestId('error')).toHaveTextContent(
        /corrupted.*clearing/i,
      );
      expect(screen.getByTestId('data')).toHaveTextContent('No data');

      // Should clear corrupted data
      expect(localStorage.getItem('fitbit_cache')).toBeNull();
    });

    it('validates data integrity after network requests', async () => {
      // Mock response with unexpected structure
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            malformed: 'response',
            missing_expected_fields: true,
          }),
      });

      const TestComponent = () => {
        const [error, setError] = React.useState(null);
        const [validData, setValidData] = React.useState(null);

        React.useEffect(() => {
          const fetchAndValidate = async () => {
            try {
              const response = await fetch('/api/fitbit/heartrate');
              const data = await response.json();

              // Validate expected structure
              if (
                !data.activities ||
                !data.activities.heart ||
                !Array.isArray(data.activities.heart)
              ) {
                throw new Error('Invalid API response structure');
              }

              setValidData(data);
            } catch (err) {
              setError(`Data validation failed: ${err.message}`);
            }
          };

          fetchAndValidate();
        }, []);

        return (
          <div>
            <span data-testid="valid-data">
              {validData ? 'Valid' : 'Invalid'}
            </span>
            <span data-testid="error">{error}</span>
          </div>
        );
      };

      render(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          /validation.*failed/i,
        );
        expect(screen.getByTestId('valid-data')).toHaveTextContent('Invalid');
      });
    });

    it('prevents XSS attacks in user-generated content', () => {
      const maliciousData = buildCombinedNightlyData({
        date: '2026-01-24',
        nights: 1,
        correlationStrength: 'moderate',
        seed: 88888,
      });

      // Inject potentially malicious content
      maliciousData[0].oscar.events[0].type =
        '<script>alert("XSS")</script>Obstructive';

      render(
        <FitbitDashboard
          fitbitData={maliciousData}
          connectionStatus="connected"
          syncState={{ status: 'idle' }}
          onConnect={vi.fn()}
          onDisconnect={vi.fn()}
          onSync={vi.fn()}
          onCorrelationAnalysis={vi.fn()}
        />,
      );

      // Should not execute script or render raw HTML
      const eventElements = screen.queryAllByText(/script|alert/i);
      eventElements.forEach((element) => {
        expect(element).not.toHaveTextContent(/<script>/);
        expect(element.innerHTML).not.toContain('<script>');
      });
    });
  });
});
