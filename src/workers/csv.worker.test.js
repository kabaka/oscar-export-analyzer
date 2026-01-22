import Papa from 'papaparse';
import { FLG_BRIDGE_THRESHOLD } from '../utils/clustering.js';
import { FLG_LEVEL_BELOW_THRESHOLD_DELTA } from '../test-utils/fixtures/clustering.js';
import './csv.worker.js';

describe('csv.worker chunk handler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates progress and filters rows per chunk', () => {
    const originalPost = self.postMessage;
    self.postMessage = vi.fn();

    vi.spyOn(Papa, 'parse').mockImplementation((file, opts) => {
      opts.chunk({
        data: [
          {
            Event: 'FLG',
            'Data/Duration':
              FLG_BRIDGE_THRESHOLD - FLG_LEVEL_BELOW_THRESHOLD_DELTA,
            DateTime: '2025-01-01T00:00:00',
          },
          {
            Event: 'FLG',
            'Data/Duration': FLG_BRIDGE_THRESHOLD,
            DateTime: '2025-01-01T00:01:00',
          },
          {
            Event: 'ClearAirway',
            'Data/Duration': 10,
            DateTime: '2025-01-01T00:02:00',
          },
          {
            Event: 'Noise',
            'Data/Duration': 5,
            DateTime: '2025-01-01T00:03:00',
          },
        ],
        meta: {
          cursor: 321,
          fields: ['Event', 'DateTime', 'Data/Duration'],
        },
      });
      opts.complete();
    });

    self.onmessage({ data: { file: 'file', filterEvents: true } });

    const [[progressPayload], [rowsPayload], [completePayload]] =
      self.postMessage.mock.calls;

    expect(progressPayload).toEqual({
      type: 'progress',
      cursor: 321,
    });
    expect(rowsPayload).toEqual({
      type: 'rows',
      rows: [
        {
          Event: 'FLG',
          'Data/Duration': FLG_BRIDGE_THRESHOLD,
          DateTime: new Date('2025-01-01T00:01:00').getTime(),
        },
        {
          Event: 'ClearAirway',
          'Data/Duration': 10,
          DateTime: new Date('2025-01-01T00:02:00').getTime(),
        },
      ],
    });
    expect(completePayload).toEqual({ type: 'complete' });

    self.postMessage = originalPost;
  });

  it('sanitizes error messages containing data samples', () => {
    const originalPost = self.postMessage;
    const originalConsoleError = console.error;
    self.postMessage = vi.fn();
    console.error = vi.fn();

    vi.spyOn(Papa, 'parse').mockImplementation((file, opts) => {
      opts.error({
        message:
          'Unexpected token at line 42: "DateTime,Session,Event\\n2024-01-15,12345,OA"',
      });
    });

    self.onmessage({ data: { workerId: 'test-1', file: 'file' } });

    const [[errorPayload]] = self.postMessage.mock.calls;

    expect(errorPayload).toEqual({
      workerId: 'test-1',
      type: 'error',
      error: 'Failed to parse CSV file. Please check the file format.',
    });

    // Verify no data samples in error message
    expect(errorPayload.error).not.toContain('DateTime');
    expect(errorPayload.error).not.toContain('12345');
    expect(errorPayload.error).not.toContain('line 42');

    self.postMessage = originalPost;
    console.error = originalConsoleError;
  });

  it('sanitizes "too many fields" errors', () => {
    const originalPost = self.postMessage;
    const originalConsoleError = console.error;
    self.postMessage = vi.fn();
    console.error = vi.fn();

    vi.spyOn(Papa, 'parse').mockImplementation((file, opts) => {
      opts.error({
        message: 'Too many fields: expected 5, received 7 in row with data',
      });
    });

    self.onmessage({ data: { workerId: 'test-2', file: 'file' } });

    const [[errorPayload]] = self.postMessage.mock.calls;

    expect(errorPayload).toEqual({
      workerId: 'test-2',
      type: 'error',
      error: 'CSV file structure is invalid.',
    });

    self.postMessage = originalPost;
    console.error = originalConsoleError;
  });

  it('sanitizes "missing headers" errors', () => {
    const originalPost = self.postMessage;
    const originalConsoleError = console.error;
    self.postMessage = vi.fn();
    console.error = vi.fn();

    vi.spyOn(Papa, 'parse').mockImplementation((file, opts) => {
      opts.error({ message: 'Missing required header: Event column' });
    });

    self.onmessage({ data: { workerId: 'test-3', file: 'file' } });

    const [[errorPayload]] = self.postMessage.mock.calls;

    expect(errorPayload).toEqual({
      workerId: 'test-3',
      type: 'error',
      error: 'CSV file is missing required columns.',
    });

    self.postMessage = originalPost;
    console.error = originalConsoleError;
  });

  it('provides generic message for unknown error types', () => {
    const originalPost = self.postMessage;
    const originalConsoleError = console.error;
    self.postMessage = vi.fn();
    console.error = vi.fn();

    vi.spyOn(Papa, 'parse').mockImplementation((file, opts) => {
      opts.error({ message: 'Some obscure parsing failure with details' });
    });

    self.onmessage({ data: { workerId: 'test-4', file: 'file' } });

    const [[errorPayload]] = self.postMessage.mock.calls;

    expect(errorPayload).toEqual({
      workerId: 'test-4',
      type: 'error',
      error:
        "Failed to parse CSV file. Please verify it's a valid OSCAR export.",
    });

    self.postMessage = originalPost;
    console.error = originalConsoleError;
  });

  it('logs detailed errors in development mode', () => {
    const originalPost = self.postMessage;
    const originalConsoleError = console.error;
    const originalEnv = import.meta.env.DEV;
    self.postMessage = vi.fn();
    console.error = vi.fn();
    import.meta.env.DEV = true;

    const detailedError = {
      message: 'Unexpected token at line 42: sensitive data here',
      type: 'ParserError',
      stack: 'full stack trace',
    };

    vi.spyOn(Papa, 'parse').mockImplementation((file, opts) => {
      opts.error(detailedError);
    });

    self.onmessage({ data: { workerId: 'test-5', file: 'file' } });

    // Should log the full error in DEV mode
    expect(console.error).toHaveBeenCalledWith(
      'CSV parsing error:',
      detailedError,
    );

    // But still send sanitized message to main thread
    const [[errorPayload]] = self.postMessage.mock.calls;
    expect(errorPayload.error).toBe(
      'Failed to parse CSV file. Please check the file format.',
    );

    self.postMessage = originalPost;
    console.error = originalConsoleError;
    import.meta.env.DEV = originalEnv;
  });
});

describe('csv.worker header validation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('validates summary file headers and rejects missing Date column', () => {
    const originalPost = self.postMessage;
    const originalConsoleError = console.error;
    self.postMessage = vi.fn();
    console.error = vi.fn();

    vi.spyOn(Papa, 'parse').mockImplementation((file, opts) => {
      opts.chunk({
        data: [],
        meta: { fields: ['AHI', 'Median EPAP', 'Total Time'], cursor: 0 },
      });
    });

    self.onmessage({
      data: { workerId: 'test-validate-1', file: 'file', filterEvents: false },
    });

    const [[errorPayload]] = self.postMessage.mock.calls;

    expect(errorPayload).toEqual({
      workerId: 'test-validate-1',
      type: 'error',
      error: 'CSV file is missing required columns.',
    });

    self.postMessage = originalPost;
    console.error = originalConsoleError;
  });

  it('validates summary file headers and rejects missing AHI column', () => {
    const originalPost = self.postMessage;
    const originalConsoleError = console.error;
    self.postMessage = vi.fn();
    console.error = vi.fn();

    vi.spyOn(Papa, 'parse').mockImplementation((file, opts) => {
      opts.chunk({
        data: [],
        meta: { fields: ['Date', 'Median EPAP', 'Total Time'], cursor: 0 },
      });
    });

    self.onmessage({
      data: { workerId: 'test-validate-2', file: 'file', filterEvents: false },
    });

    const [[errorPayload]] = self.postMessage.mock.calls;

    expect(errorPayload).toEqual({
      workerId: 'test-validate-2',
      type: 'error',
      error: 'CSV file is missing required columns.',
    });

    self.postMessage = originalPost;
    console.error = originalConsoleError;
  });

  it('validates details file headers and rejects missing Event column', () => {
    const originalPost = self.postMessage;
    const originalConsoleError = console.error;
    self.postMessage = vi.fn();
    console.error = vi.fn();

    vi.spyOn(Papa, 'parse').mockImplementation((file, opts) => {
      opts.chunk({
        data: [],
        meta: { fields: ['DateTime', 'Data/Duration'], cursor: 0 },
      });
    });

    self.onmessage({
      data: { workerId: 'test-validate-3', file: 'file', filterEvents: true },
    });

    const [[errorPayload]] = self.postMessage.mock.calls;

    expect(errorPayload).toEqual({
      workerId: 'test-validate-3',
      type: 'error',
      error: 'CSV file is missing required columns.',
    });

    self.postMessage = originalPost;
    console.error = originalConsoleError;
  });

  it('validates details file headers and rejects missing DateTime column', () => {
    const originalPost = self.postMessage;
    const originalConsoleError = console.error;
    self.postMessage = vi.fn();
    console.error = vi.fn();

    vi.spyOn(Papa, 'parse').mockImplementation((file, opts) => {
      opts.chunk({
        data: [],
        meta: { fields: ['Event', 'Data/Duration'], cursor: 0 },
      });
    });

    self.onmessage({
      data: { workerId: 'test-validate-4', file: 'file', filterEvents: true },
    });

    const [[errorPayload]] = self.postMessage.mock.calls;

    expect(errorPayload).toEqual({
      workerId: 'test-validate-4',
      type: 'error',
      error: 'CSV file is missing required columns.',
    });

    self.postMessage = originalPost;
    console.error = originalConsoleError;
  });

  it('logs detailed validation errors in development mode', () => {
    const originalPost = self.postMessage;
    const originalConsoleError = console.error;
    const originalEnv = import.meta.env.DEV;
    self.postMessage = vi.fn();
    console.error = vi.fn();
    import.meta.env.DEV = true;

    vi.spyOn(Papa, 'parse').mockImplementation((file, opts) => {
      opts.chunk({
        data: [],
        meta: { fields: ['Date', 'Median EPAP'], cursor: 0 },
      });
    });

    self.onmessage({
      data: { workerId: 'test-validate-5', file: 'file', filterEvents: false },
    });

    // Should log detailed validation result in DEV mode
    expect(console.error).toHaveBeenCalledWith(
      'CSV validation failed:',
      expect.objectContaining({
        valid: false,
        error: expect.stringContaining('Missing required columns'),
        found: ['Date', 'Median EPAP'],
      }),
    );

    // But still send sanitized message to main thread
    const [[errorPayload]] = self.postMessage.mock.calls;
    expect(errorPayload.error).toBe('CSV file is missing required columns.');

    self.postMessage = originalPost;
    console.error = originalConsoleError;
    import.meta.env.DEV = originalEnv;
  });

  it('allows summary files with extra columns beyond required', () => {
    const originalPost = self.postMessage;
    self.postMessage = vi.fn();

    vi.spyOn(Papa, 'parse').mockImplementation((file, opts) => {
      opts.chunk({
        data: [
          {
            Date: '2024-01-01',
            AHI: 5,
            'Median EPAP': 10,
            'Total Time': 480,
            'Leak Rate': 1,
          },
        ],
        meta: {
          fields: ['Date', 'AHI', 'Median EPAP', 'Total Time', 'Leak Rate'],
          cursor: 100,
        },
      });
      opts.complete();
    });

    self.onmessage({
      data: { workerId: 'test-validate-6', file: 'file', filterEvents: false },
    });

    // Should proceed with parsing (progress + rows + complete)
    expect(self.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'progress' }),
    );
    expect(self.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'rows' }),
    );
    expect(self.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'complete' }),
    );

    // Should NOT have error message
    const errorCalls = self.postMessage.mock.calls.filter(
      ([msg]) => msg.type === 'error',
    );
    expect(errorCalls).toHaveLength(0);

    self.postMessage = originalPost;
  });

  it('allows details files with extra columns beyond required', () => {
    const originalPost = self.postMessage;
    self.postMessage = vi.fn();

    vi.spyOn(Papa, 'parse').mockImplementation((file, opts) => {
      opts.chunk({
        data: [
          {
            Event: 'ClearAirway',
            DateTime: '2024-01-01T00:00:00',
            'Data/Duration': 10,
            Session: '12345',
          },
        ],
        meta: {
          fields: ['Event', 'DateTime', 'Data/Duration', 'Session'],
          cursor: 100,
        },
      });
      opts.complete();
    });

    self.onmessage({
      data: { workerId: 'test-validate-7', file: 'file', filterEvents: true },
    });

    // Should proceed with parsing
    expect(self.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'progress' }),
    );

    // Should NOT have error message
    const errorCalls = self.postMessage.mock.calls.filter(
      ([msg]) => msg.type === 'error',
    );
    expect(errorCalls).toHaveLength(0);

    self.postMessage = originalPost;
  });
});
