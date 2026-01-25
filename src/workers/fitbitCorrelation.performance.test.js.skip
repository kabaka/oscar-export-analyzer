import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildCombinedNightlyData } from '../test-utils/fitbitBuilders.js';

// Mock Web Worker for testing
class MockWorker {
  constructor(url) {
    this.url = url;
    this.onmessage = null;
    this.onerror = null;
    this.postMessage = vi.fn((data) => {
      // Simulate async worker processing
      setTimeout(() => {
        this.simulateWorkerResponse(data);
      }, 10);
    });
    this.terminate = vi.fn();
    this.addEventListener = vi.fn();
    this.removeEventListener = vi.fn();
  }

  simulateWorkerResponse(data) {
    if (data.type === 'compute-correlation') {
      // Simulate correlation computation
      const result = this.mockCorrelationComputation(data);
      if (this.onmessage) {
        this.onmessage({ data: result });
      }
    } else if (data.type === 'performance-benchmark') {
      // Simulate performance benchmark
      const result = this.mockPerformanceBenchmark(data);
      if (this.onmessage) {
        this.onmessage({ data: result });
      }
    }
  }

  mockCorrelationComputation({ events, fitbit, options = {} }) {
    // Simulate processing time based on data size
    const heartRateLength = fitbit?.heartRate?.length || 0;
    const processingTimeMs = Math.max(
      50,
      events.length * 0.1 + heartRateLength * 0.05,
    );

    // Simulate memory usage
    const estimatedMemoryMb =
      (events.length * 0.1 + heartRateLength * 0.05) / 1000;

    return {
      type: 'correlation-result',
      timestamp: Date.now(),
      correlations: {
        ahiHeartRate: {
          correlation: 0.65,
          pValue: 0.02,
          significance: 'moderate',
          sampleSize: Math.min(events.length, fitbit?.heartRate?.length || 0),
        },
        ahiSpO2: {
          correlation: -0.72,
          pValue: 0.01,
          significance: 'strong',
          sampleSize: Math.min(events.length, fitbit?.spo2?.length || 0),
        },
      },
      performance: {
        processingTimeMs: Math.round(processingTimeMs),
        memoryUsageMb: Math.round(estimatedMemoryMb * 10) / 10,
        dataPoints: events.length,
      },
      metadata: {
        method: options.method || 'pearson',
        windowSize: options.windowSize || 60,
        resampleInterval: options.resampleInterval || 60000,
      },
    };
  }

  mockPerformanceBenchmark({ dataset, iterations }) {
    const results = {
      type: 'performance-result',
      dataset: dataset.name,
      iterations,
      metrics: {
        avgProcessingTimeMs: 150 + dataset.size * 0.02,
        maxMemoryUsageMb: 10 + dataset.size * 0.001,
        memoryStableAfterGc: true,
        throughtputEventsPerSec: Math.round(
          (dataset.size / (150 + dataset.size * 0.02)) * 1000,
        ),
      },
      iterationResults: Array.from({ length: iterations }, (_, i) => ({
        iteration: i + 1,
        processingTimeMs: 140 + Math.random() * 20 + dataset.size * 0.02,
        memoryUsageMb: 9 + Math.random() * 2 + dataset.size * 0.001,
        gcTriggered: Math.random() > 0.7,
      })),
    };
    return results;
  }
}

// Mock the Worker constructor
global.Worker = vi.fn(function (url) {
  return new MockWorker(url);
});

describe.skip('Fitbit Correlation Worker Performance', () => {
  let worker;

  beforeEach(() => {
    vi.clearAllMocks();
    worker = new Worker('/src/workers/fitbit-correlation.worker.js', {
      type: 'module',
    });
  });

  afterEach(() => {
    if (worker) {
      worker.terminate();
    }
  });

  describe('Large Dataset Handling', () => {
    it('processes 1-year dataset within performance budget', async () => {
      // Generate 365 nights of data (full year)
      const yearlyData = buildCombinedNightlyData({
        date: '2025-01-01',
        nights: 365,
        correlationStrength: 'moderate',
        seed: 12345, // Reproducible
      });

      // Extract events and heart rate data
      const events = yearlyData.flatMap((night) =>
        night.oscar.events.map((event) => ({
          timestamp: new Date(event.timestamp).getTime(),
          type: event.type,
          durationSec: event.durationSec,
        })),
      );

      const heartRateData = yearlyData
        .filter((night) => !isNaN(night.fitbit.heartRate.avgSleepBpm))
        .map((night) => ({
          timestamp: night.date.getTime(),
          avgSleepBpm: night.fitbit.heartRate.avgSleepBpm,
          minSleepBpm: night.fitbit.heartRate.minSleepBpm,
          maxSleepBpm: night.fitbit.heartRate.maxSleepBpm,
        }));

      const spo2Data = yearlyData
        .filter((night) => !isNaN(night.fitbit.oxygenSaturation.avgPercent))
        .map((night) => ({
          timestamp: night.date.getTime(),
          avgPercent: night.fitbit.oxygenSaturation.avgPercent,
          minPercent: night.fitbit.oxygenSaturation.minPercent,
        }));

      const startTime = performance.now();

      return new Promise((resolve) => {
        worker.onmessage = (e) => {
          const result = e.data;
          const processingTime = performance.now() - startTime;

          // Performance requirements
          expect(processingTime).toBeLessThan(5000); // < 5 seconds
          expect(result.performance.memoryUsageMb).toBeLessThan(50); // < 50 MB
          expect(result.performance.dataPoints).toBe(events.length);

          // Verify correlation results are computed
          expect(result.correlations.ahiHeartRate).toBeDefined();
          expect(result.correlations.ahiSpO2).toBeDefined();
          expect(result.correlations.ahiHeartRate.correlation).toBeTypeOf(
            'number',
          );
          expect(result.correlations.ahiHeartRate.sampleSize).toBeGreaterThan(
            300,
          ); // Most days have data

          resolve();
        };

        worker.postMessage({
          type: 'compute-correlation',
          events,
          fitbit: {
            heartRate: heartRateData,
            spo2: spo2Data,
          },
          options: {
            method: 'pearson',
            windowSize: 60,
            resampleInterval: 60000,
          },
        });
      });
    }, 10000); // 10 second timeout

    it('handles extreme dataset sizes gracefully', async () => {
      // Generate 2 years of high-AHI data (many events per night)
      const extremeData = buildCombinedNightlyData({
        date: '2024-01-01',
        nights: 730, // 2 years
        correlationStrength: 'strong',
        seed: 99999,
      });

      // Filter to get subset that simulates extreme case
      const highEventNights = extremeData.filter(
        (night) => night.oscar.ahi > 20,
      );
      const events = highEventNights.flatMap((night) => night.oscar.events);

      expect(events.length).toBeGreaterThan(10000); // Ensure we have many events

      return new Promise((resolve) => {
        worker.onmessage = (e) => {
          const result = e.data;

          // Should handle large datasets without crashing
          expect(result.type).toBe('correlation-result');
          expect(result.performance.memoryUsageMb).toBeLessThan(100); // Memory ceiling
          expect(result.performance.processingTimeMs).toBeGreaterThan(0);

          // Correlations should still be computed
          expect(result.correlations).toBeDefined();
          expect(Object.keys(result.correlations)).toHaveLength(2);

          resolve();
        };

        worker.postMessage({
          type: 'compute-correlation',
          events: events.slice(0, 15000), // Cap at 15k events to avoid test timeouts
          fitbit: {
            heartRate: highEventNights.map((n) => ({
              timestamp: n.date.getTime(),
              avgSleepBpm: n.fitbit.heartRate.avgSleepBpm,
            })),
          },
          options: { method: 'pearson' },
        });
      });
    }, 15000);
  });

  describe('Memory Management', () => {
    it('maintains stable memory usage during repeated operations', async () => {
      const testData = buildCombinedNightlyData({
        date: '2026-01-01',
        nights: 100,
        correlationStrength: 'moderate',
        seed: 55555,
      });

      const events = testData.flatMap((night) => night.oscar.events);
      const heartRate = testData.map((night) => ({
        timestamp: night.date.getTime(),
        avgSleepBpm: night.fitbit.heartRate.avgSleepBpm,
      }));

      const iterations = 5;
      const memoryReadings = [];

      return new Promise((resolve) => {
        let completedIterations = 0;

        const runIteration = () => {
          worker.onmessage = (e) => {
            const result = e.data;
            memoryReadings.push(result.performance.memoryUsageMb);
            completedIterations++;

            if (completedIterations < iterations) {
              setTimeout(() => runIteration(), 100); // Brief pause between iterations
            } else {
              // Analyze memory stability
              const avgMemory =
                memoryReadings.reduce((a, b) => a + b, 0) /
                memoryReadings.length;
              const maxMemory = Math.max(...memoryReadings);
              const memoryVariation = maxMemory - Math.min(...memoryReadings);

              expect(avgMemory).toBeLessThan(30); // Reasonable average
              expect(memoryVariation).toBeLessThan(15); // Stable memory usage
              expect(memoryReadings).toHaveLength(iterations);

              resolve();
            }
          };

          worker.postMessage({
            type: 'compute-correlation',
            events: events.slice(0, 2000), // Reasonable subset
            fitbit: { heartRate },
            options: { method: 'pearson' },
          });
        };

        runIteration();
      });
    }, 10000);

    it('handles memory pressure gracefully', async () => {
      // Simulate memory pressure with overlapping large datasets
      const datasets = Array.from({ length: 3 }, (_, i) =>
        buildCombinedNightlyData({
          date: `2026-01-${i * 10 + 1}`,
          nights: 200,
          correlationStrength: 'weak',
          seed: 77777 + i,
        }),
      );

      return new Promise((resolve) => {
        let completedDatasets = 0;
        const results = [];

        datasets.forEach((dataset) => {
          const events = dataset.flatMap((night) => night.oscar.events);
          const heartRate = dataset.map((night) => ({
            timestamp: night.date.getTime(),
            avgSleepBpm: night.fitbit.heartRate.avgSleepBpm,
          }));

          const workerInstance = new Worker(
            '/src/workers/fitbit-correlation.worker.js',
          );

          workerInstance.onmessage = (e) => {
            results.push(e.data);
            completedDatasets++;

            if (completedDatasets === datasets.length) {
              // All datasets processed successfully
              expect(results).toHaveLength(3);
              results.forEach((result) => {
                expect(result.type).toBe('correlation-result');
                expect(result.performance.memoryUsageMb).toBeLessThan(60); // Higher limit under pressure
              });

              // Cleanup
              workerInstance.terminate();
              resolve();
            }
          };

          workerInstance.onerror = (error) => {
            expect.fail(`Worker error under memory pressure: ${error.message}`);
          };

          workerInstance.postMessage({
            type: 'compute-correlation',
            events: events.slice(0, 5000),
            fitbit: { heartRate },
            options: { method: 'pearson' },
          });
        });
      });
    }, 20000);
  });

  describe('Progress Reporting', () => {
    it('reports progress during long computations', async () => {
      const largeDataset = buildCombinedNightlyData({
        date: '2026-01-01',
        nights: 500,
        correlationStrength: 'moderate',
        seed: 33333,
      });

      const events = largeDataset.flatMap((night) => night.oscar.events);
      const progressUpdates = [];

      return new Promise((resolve) => {
        worker.onmessage = (e) => {
          const result = e.data;

          if (result.type === 'progress') {
            progressUpdates.push(result);
          } else if (result.type === 'correlation-result') {
            // Verify we received progress updates
            expect(progressUpdates.length).toBeGreaterThan(0);

            // Progress should be sequential and reach 100%
            const progressValues = progressUpdates.map((p) => p.progress);
            expect(progressValues[0]).toBeGreaterThan(0);
            expect(progressValues[progressValues.length - 1]).toBeCloseTo(
              100,
              1,
            );

            // Each progress update should be >= previous
            for (let i = 1; i < progressValues.length; i++) {
              expect(progressValues[i]).toBeGreaterThanOrEqual(
                progressValues[i - 1],
              );
            }

            resolve();
          }
        };

        worker.postMessage({
          type: 'compute-correlation',
          events: events.slice(0, 8000), // Large enough to trigger progress
          fitbit: {
            heartRate: largeDataset.map((n) => ({
              timestamp: n.date.getTime(),
              avgSleepBpm: n.fitbit.heartRate.avgSleepBpm,
            })),
          },
          options: {
            method: 'pearson',
            reportProgress: true,
            progressInterval: 1000, // Report every 1000 processed events
          },
        });
      });
    }, 12000);

    it('allows cancellation of long-running operations', async () => {
      const largeDataset = buildCombinedNightlyData({
        date: '2026-01-01',
        nights: 1000, // Very large dataset
        correlationStrength: 'strong',
        seed: 44444,
      });

      const events = largeDataset.flatMap((night) => night.oscar.events);
      let cancelled = false;

      return new Promise((resolve) => {
        const startTime = performance.now();

        worker.onmessage = (e) => {
          const result = e.data;

          if (
            result.type === 'progress' &&
            result.progress > 20 &&
            !cancelled
          ) {
            // Cancel after some progress
            cancelled = true;
            worker.postMessage({ type: 'cancel-computation' });

            // Allow time for cancellation to process
            setTimeout(() => {
              const elapsedTime = performance.now() - startTime;
              expect(elapsedTime).toBeLessThan(3000); // Should cancel quickly
              worker.terminate();
              resolve();
            }, 500);
          } else if (result.type === 'correlation-result' && !cancelled) {
            expect.fail('Computation completed instead of being cancelled');
          } else if (result.type === 'computation-cancelled') {
            const elapsedTime = performance.now() - startTime;
            expect(elapsedTime).toBeLessThan(3000); // Quick cancellation
            expect(cancelled).toBe(true);
            resolve();
          }
        };

        worker.postMessage({
          type: 'compute-correlation',
          events: events.slice(0, 12000),
          fitbit: {
            heartRate: largeDataset.slice(0, 500).map((n) => ({
              timestamp: n.date.getTime(),
              avgSleepBpm: n.fitbit.heartRate.avgSleepBpm,
            })),
          },
          options: {
            method: 'pearson',
            reportProgress: true,
            progressInterval: 500,
          },
        });
      });
    }, 10000);
  });

  describe('Performance Benchmarks', () => {
    it('meets throughput requirements for different dataset sizes', async () => {
      const benchmarkSets = [
        { name: 'small', nights: 30, expectedMinThroughput: 1000 }, // events/sec
        { name: 'medium', nights: 120, expectedMinThroughput: 800 },
        { name: 'large', nights: 365, expectedMinThroughput: 500 },
      ];

      const benchmarkPromises = benchmarkSets.map(
        ({ name, nights, expectedMinThroughput }) => {
          const testData = buildCombinedNightlyData({
            date: '2026-01-01',
            nights,
            correlationStrength: 'moderate',
            seed: 12321,
          });

          const events = testData.flatMap((night) => night.oscar.events);

          return new Promise((resolve) => {
            const benchmarkWorker = new Worker(
              '/src/workers/fitbit-correlation.worker.js',
            );

            benchmarkWorker.onmessage = (e) => {
              const result = e.data;

              if (result.type === 'performance-result') {
                expect(result.metrics.throughtputEventsPerSec).toBeGreaterThan(
                  expectedMinThroughput,
                );
                expect(result.metrics.avgProcessingTimeMs).toBeLessThan(10000); // < 10 seconds
                expect(result.metrics.maxMemoryUsageMb).toBeLessThan(80); // < 80 MB
                expect(result.metrics.memoryStableAfterGc).toBe(true);

                benchmarkWorker.terminate();
                resolve({ name, result: result.metrics });
              }
            };

            benchmarkWorker.postMessage({
              type: 'performance-benchmark',
              dataset: { name, size: events.length },
              iterations: 3,
              data: {
                events: events.slice(0, Math.min(8000, events.length)),
                fitbit: {
                  heartRate: testData.map((n) => ({
                    timestamp: n.date.getTime(),
                    avgSleepBpm: n.fitbit.heartRate.avgSleepBpm,
                  })),
                },
              },
            });
          });
        },
      );

      const benchmarkResults = await Promise.all(benchmarkPromises);

      // Log benchmark results for analysis
      benchmarkResults.forEach(({ name, result }) => {
        console.log(`Benchmark ${name}:`, {
          throughput: `${result.throughtputEventsPerSec} events/sec`,
          avgTime: `${result.avgProcessingTimeMs}ms`,
          maxMemory: `${result.maxMemoryUsageMb}MB`,
        });
      });

      expect(benchmarkResults).toHaveLength(benchmarkSets.length);
    }, 25000);

    it('maintains consistent performance under repeated load', async () => {
      const testData = buildCombinedNightlyData({
        date: '2026-01-01',
        nights: 90,
        correlationStrength: 'moderate',
        seed: 67890,
      });

      const events = testData.flatMap((night) => night.oscar.events);
      const runs = 10;
      const timings = [];

      for (let run = 0; run < runs; run++) {
        const startTime = performance.now();

        await new Promise((resolve) => {
          worker.onmessage = (e) => {
            if (e.data.type === 'correlation-result') {
              const endTime = performance.now();
              timings.push(endTime - startTime);
              resolve();
            }
          };

          worker.postMessage({
            type: 'compute-correlation',
            events: events.slice(0, 3000),
            fitbit: {
              heartRate: testData.map((n) => ({
                timestamp: n.date.getTime(),
                avgSleepBpm: n.fitbit.heartRate.avgSleepBpm,
              })),
            },
            options: { method: 'pearson' },
          });
        });

        // Brief pause between runs to simulate real usage
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Analyze timing consistency
      const avgTiming = timings.reduce((a, b) => a + b, 0) / timings.length;
      const maxTiming = Math.max(...timings);
      const minTiming = Math.min(...timings);
      const timingVariation = ((maxTiming - minTiming) / avgTiming) * 100;

      expect(avgTiming).toBeLessThan(2000); // Average < 2 seconds
      expect(timingVariation).toBeLessThan(50); // < 50% variation
      expect(timings).toHaveLength(runs);

      console.log('Performance consistency:', {
        avgTiming: `${Math.round(avgTiming)}ms`,
        variation: `${Math.round(timingVariation)}%`,
        range: `${Math.round(minTiming)}-${Math.round(maxTiming)}ms`,
      });
    }, 30000);
  });

  describe('Worker Lifecycle Management', () => {
    it('cleans up resources on termination', async () => {
      const testData = buildCombinedNightlyData({
        date: '2026-01-01',
        nights: 50,
        correlationStrength: 'weak',
        seed: 98765,
      });

      const workers = [];
      const results = [];

      // Create multiple workers
      for (let i = 0; i < 5; i++) {
        const workerInstance = new Worker(
          '/src/workers/fitbit-correlation.worker.js',
        );
        workers.push(workerInstance);

        workerInstance.onmessage = (e) => {
          results.push(e.data);

          // Terminate worker after receiving result
          workerInstance.terminate();
        };

        workerInstance.postMessage({
          type: 'compute-correlation',
          events: testData
            .flatMap((night) => night.oscar.events)
            .slice(0, 1000),
          fitbit: {
            heartRate: testData.slice(0, 20).map((n) => ({
              timestamp: n.date.getTime(),
              avgSleepBpm: n.fitbit.heartRate.avgSleepBpm,
            })),
          },
          options: { method: 'pearson' },
        });
      }

      // Wait for all workers to complete
      await new Promise((resolve) => {
        const checkCompletion = () => {
          if (results.length === workers.length) {
            resolve();
          } else {
            setTimeout(checkCompletion, 100);
          }
        };
        checkCompletion();
      });

      // Verify all workers were terminated
      workers.forEach((worker) => {
        expect(worker.terminate).toHaveBeenCalled();
      });

      expect(results).toHaveLength(5);
      expect(workers).toHaveLength(5);
    }, 10000);

    it('handles worker errors gracefully', async () => {
      const errorScenarios = [
        { type: 'invalid-data', data: { events: 'invalid', fitbit: null } },
        { type: 'missing-options', data: { events: [], fitbit: {} } }, // Missing required options
        {
          type: 'malformed-events',
          data: { events: [{ invalid: 'format' }], fitbit: {} },
        },
      ];

      const errorResults = [];

      for (const scenario of errorScenarios) {
        await new Promise((resolve) => {
          const errorWorker = new Worker(
            '/src/workers/fitbit-correlation.worker.js',
          );

          errorWorker.onmessage = (e) => {
            if (e.data.type === 'correlation-error') {
              errorResults.push({
                scenario: scenario.type,
                error: e.data.error,
              });
            }
            resolve();
          };

          errorWorker.onerror = (error) => {
            errorResults.push({
              scenario: scenario.type,
              error: error.message,
            });
            resolve();
          };

          errorWorker.postMessage({
            type: 'compute-correlation',
            ...scenario.data,
          });

          // Timeout in case worker hangs
          setTimeout(() => {
            errorWorker.terminate();
            resolve();
          }, 2000);
        });
      }

      expect(errorResults.length).toBeGreaterThan(0);
      errorResults.forEach(({ scenario, error }) => {
        expect(scenario).toBeDefined();
        expect(error).toBeDefined();
        expect(typeof error).toBe('string');
      });
    }, 10000);
  });
});
