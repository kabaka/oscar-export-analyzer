import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import App from './App.jsx';

// In-memory stub store to simulate IndexedDB-backed persistence
const memoryStore = { last: null };

vi.mock('./utils/db', () => {
  return {
    putLastSession: vi.fn(async (session) => {
      memoryStore.last = session;
      return true;
    }),
    getLastSession: vi.fn(async () => memoryStore.last),
    clearLastSession: vi.fn(async () => {
      memoryStore.last = null;
      return true;
    }),
  };
});

describe('App persistence flow', () => {
  beforeEach(() => {
    // Ensure a clean store and timers per test
    memoryStore.last = null;
    vi.useFakeTimers();
    // Clear persistEnabled between tests
    try {
      window.localStorage.removeItem('persistEnabled');
    } catch {
      // ignore storage errors
    }
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces auto-save when enabled and supports save/load/clear controls', async () => {
    render(<App />);

    const remember = screen.getByLabelText(/remember data locally/i);
    const saveNow = screen.getByRole('button', { name: /save session now/i });
    const loadSaved = screen.getByRole('button', {
      name: /load saved session/i,
    });
    const clearSaved = screen.getByRole('button', {
      name: /clear saved session/i,
    });

    // Initially disabled until opt-in
    expect(saveNow).toBeDisabled();

    // Enable persistence; localStorage flag should be set and a debounced save should occur
    fireEvent.click(remember);
    vi.advanceTimersByTime(600);

    const { putLastSession, getLastSession, clearLastSession } = await import(
      './utils/db'
    );
    expect(putLastSession).toHaveBeenCalledTimes(1);
    expect(memoryStore.last).toBeTruthy();
    expect(memoryStore.last).toHaveProperty('clusterParams');

    // Manual save should call put again
    fireEvent.click(saveNow);
    expect(putLastSession).toHaveBeenCalledTimes(2);

    // Load should fetch the saved session
    fireEvent.click(loadSaved);
    expect(getLastSession).toHaveBeenCalledTimes(1);

    // Clear should remove the saved session
    fireEvent.click(clearSaved);
    expect(clearLastSession).toHaveBeenCalledTimes(1);
    expect(memoryStore.last).toBeNull();
  });
});
