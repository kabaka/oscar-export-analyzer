import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WearableImportCard from './WearableImportCard';

/** Build a default `useWearableImport`-shaped object with overridable fields. */
function makeImports(overrides = {}) {
  return {
    supported: true,
    state: 'idle',
    detection: null,
    error: null,
    lastImport: null,
    pickDirectory: vi.fn().mockResolvedValue({ kind: 'directory' }),
    scan: vi.fn().mockResolvedValue(null),
    startIngest: vi.fn(),
    reconnect: vi.fn(),
    forgetFolder: vi.fn(),
    ...overrides,
  };
}

describe('WearableImportCard', () => {
  it('renders the non-Chromium empty-state when unsupported', () => {
    render(<WearableImportCard imports={makeImports({ supported: false })} />);
    expect(
      screen.getByTestId('wearable-import-unsupported'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/needs a Chromium-based browser/i),
    ).toBeInTheDocument();
    // No directory-picker control is rendered in the unsupported state.
    expect(screen.queryByText(/Select export folder/i)).not.toBeInTheDocument();
  });

  it('renders the select-folder CTA when idle', () => {
    render(<WearableImportCard imports={makeImports()} />);
    expect(
      screen.getByRole('button', { name: /Select export folder/i }),
    ).toBeInTheDocument();
  });

  it('picks a directory then scans on click', async () => {
    const imports = makeImports();
    render(<WearableImportCard imports={imports} />);
    fireEvent.click(
      screen.getByRole('button', { name: /Select export folder/i }),
    );
    await waitFor(() => expect(imports.pickDirectory).toHaveBeenCalled());
    expect(imports.scan).toHaveBeenCalled();
  });

  it('shows the detection summary and consent options when detected', () => {
    const imports = makeImports({
      state: 'detected',
      detection: {
        dateRange: { start: '2026-01-01', end: '2026-02-01' },
        metrics: ['sleep', 'spo2'],
        fileCount: 1234,
      },
    });
    render(<WearableImportCard imports={imports} />);
    expect(screen.getByTestId('wearable-detection')).toBeInTheDocument();
    expect(screen.getByText('2026-01-01 → 2026-02-01')).toBeInTheDocument();
    expect(screen.getByText(/Remember this folder/i)).toBeInTheDocument();
    // Consent copy reassures that sensitive data stays local (privacy boundary).
    expect(screen.getByText(/never leaves your device/i)).toBeInTheDocument();
  });

  it('starts ingest with the opted-in flags', () => {
    const imports = makeImports({ state: 'detected', detection: null });
    render(<WearableImportCard imports={imports} />);
    fireEvent.click(screen.getByLabelText(/Remember this folder/i));
    fireEvent.click(screen.getByTestId('wearable-ingest-button'));
    expect(imports.startIngest).toHaveBeenCalledWith({
      rememberFolder: true,
      menstrualOptIn: false,
    });
  });

  it('offers a reconnect CTA in needs-permission state', () => {
    const imports = makeImports({ state: 'needs-permission' });
    render(<WearableImportCard imports={imports} />);
    fireEvent.click(
      screen.getByRole('button', { name: /Reconnect folder access/i }),
    );
    expect(imports.reconnect).toHaveBeenCalled();
  });

  it('shows a sanitized error with retry', () => {
    const imports = makeImports({
      state: 'error',
      error: 'Could not open the folder picker.',
    });
    render(<WearableImportCard imports={imports} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      /Could not open the folder picker/i,
    );
  });
});
