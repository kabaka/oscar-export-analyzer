/* eslint-disable no-magic-numbers -- test fixtures */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { useWearableImport } from './useWearableImport';

/**
 * `useWearableImport` tests. The worker is mocked (real `new Worker(new
 * URL(..., import.meta.url))` triggers Vite bundling / OOM in Vitest — same
 * constraint as `useAnalyticsWorker`), so we override `global.Worker` and drive
 * the protocol by hand. `showDirectoryPicker` and the FSA handle are mocked.
 */
describe('useWearableImport', () => {
  let originalWorker;
  let originalPicker;
  let originalIdb;
  let originalKeyRange;
  let workers;

  class MockWorker {
    constructor() {
      this.postMessage = vi.fn();
      this.terminate = vi.fn();
      this.onmessage = null;
      workers.push(this);
    }
  }

  beforeEach(() => {
    workers = [];
    originalWorker = global.Worker;
    global.Worker = MockWorker;
    originalPicker = window.showDirectoryPicker;
    originalIdb = globalThis.indexedDB;
    originalKeyRange = globalThis.IDBKeyRange;
    globalThis.indexedDB = new IDBFactory();
    globalThis.IDBKeyRange = IDBKeyRange;
  });

  afterEach(() => {
    global.Worker = originalWorker;
    if (originalPicker === undefined) delete window.showDirectoryPicker;
    else window.showDirectoryPicker = originalPicker;
    globalThis.indexedDB = originalIdb;
    globalThis.IDBKeyRange = originalKeyRange;
  });

  it('reports unsupported when showDirectoryPicker is absent', () => {
    delete window.showDirectoryPicker;
    const { result } = renderHook(() => useWearableImport());
    expect(result.current.supported).toBe(false);
  });

  it('is supported when showDirectoryPicker exists', () => {
    window.showDirectoryPicker = vi.fn();
    const { result } = renderHook(() => useWearableImport());
    expect(result.current.supported).toBe(true);
  });

  it('pickDirectory resolves a handle and moves to detected', async () => {
    const handle = { kind: 'directory', name: 'export' };
    window.showDirectoryPicker = vi.fn().mockResolvedValue(handle);
    const { result } = renderHook(() => useWearableImport());

    await act(async () => {
      await result.current.pickDirectory();
    });
    expect(window.showDirectoryPicker).toHaveBeenCalledWith({ mode: 'read' });
    expect(result.current.state).toBe('detected');
  });

  it('pickDirectory returns to idle when the user dismisses the picker', async () => {
    const abort = Object.assign(new Error('dismissed'), { name: 'AbortError' });
    window.showDirectoryPicker = vi.fn().mockRejectedValue(abort);
    const { result } = renderHook(() => useWearableImport());
    await act(async () => {
      await result.current.pickDirectory();
    });
    expect(result.current.state).toBe('idle');
  });

  it('startIngest posts an ingest message and reflects progress + completion', async () => {
    const handle = { kind: 'directory', name: 'export' };
    window.showDirectoryPicker = vi.fn().mockResolvedValue(handle);
    const { result } = renderHook(() => useWearableImport());

    await act(async () => {
      await result.current.pickDirectory();
    });
    await act(async () => {
      await result.current.startIngest();
    });

    expect(result.current.state).toBe('ingesting');
    const worker = workers[workers.length - 1];
    const sent = worker.postMessage.mock.calls.at(-1)[0];
    expect(sent.action).toBe('ingest');
    expect(sent.payload.dirHandle).toBe(handle);
    const workerId = sent.workerId;

    act(() => {
      worker.onmessage({
        data: {
          workerId,
          type: 'progress',
          phase: 'spo2',
          filesDone: 2,
          filesTotal: 5,
          nights: 1,
        },
      });
    });
    expect(result.current.progress.phase).toBe('spo2');

    act(() => {
      worker.onmessage({
        data: { workerId, type: 'complete', nights: 3, stats: { nights: 3 } },
      });
    });
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.lastImport.nights).toBe(3);
  });

  it('surfaces a sanitized error from the worker', async () => {
    const handle = { kind: 'directory', name: 'export' };
    window.showDirectoryPicker = vi.fn().mockResolvedValue(handle);
    const { result } = renderHook(() => useWearableImport());
    await act(async () => {
      await result.current.pickDirectory();
    });
    await act(async () => {
      await result.current.startIngest();
    });
    const worker = workers[workers.length - 1];
    const workerId = worker.postMessage.mock.calls.at(-1)[0].workerId;
    act(() => {
      worker.onmessage({
        data: {
          workerId,
          type: 'error',
          error: 'Failed to import the wearable export.',
        },
      });
    });
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.error).toMatch(/failed to import/i);
  });

  it('cancelIngest terminates the worker and moves to partial', async () => {
    const handle = { kind: 'directory', name: 'export' };
    window.showDirectoryPicker = vi.fn().mockResolvedValue(handle);
    const { result } = renderHook(() => useWearableImport());
    await act(async () => {
      await result.current.pickDirectory();
    });
    await act(async () => {
      await result.current.startIngest();
    });
    const worker = workers[workers.length - 1];
    act(() => {
      result.current.cancelIngest();
    });
    expect(worker.terminate).toHaveBeenCalled();
    expect(result.current.state).toBe('partial');
  });
});
