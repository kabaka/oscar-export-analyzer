import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { AppProviders } from './app/AppProviders';
import { AppShell } from './App';
import ErrorBoundary from './components/ErrorBoundary';

describe('Header date filter', () => {
  it('renders date inputs and presets inside the header', () => {
    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );
    const presetSelect = screen.getByLabelText(/quick range/i);
    const startInput = screen.getByLabelText(/start date/i);
    const endInput = screen.getByLabelText(/end date/i);
    const header = startInput.closest('header');
    expect(header).toHaveClass('app-header');
    expect(endInput.closest('header')).toBe(header);
    expect(presetSelect.closest('header')).toBe(header);
  });

  it('applies quick date range presets', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-10'));
    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );
    const presetSelect = screen.getByLabelText(/quick range/i);
    const startInput = screen.getByLabelText(/start date/i);
    const endInput = screen.getByLabelText(/end date/i);

    fireEvent.change(presetSelect, { target: { value: '7' } });
    expect(startInput).toHaveValue('2023-01-04');
    expect(endInput).toHaveValue('2023-01-10');

    fireEvent.change(presetSelect, { target: { value: '14' } });
    expect(startInput).toHaveValue('2022-12-28');
    expect(endInput).toHaveValue('2023-01-10');

    fireEvent.change(presetSelect, { target: { value: '365' } });
    expect(startInput).toHaveValue('2022-01-11');
    expect(endInput).toHaveValue('2023-01-10');

    fireEvent.change(presetSelect, { target: { value: 'all' } });
    expect(startInput).toHaveValue('');
    expect(endInput).toHaveValue('');
    vi.useRealTimers();
  });

  it('ignores invalid dates without crashing', () => {
    render(
      <ErrorBoundary>
        <AppProviders>
          <AppShell />
        </AppProviders>
      </ErrorBoundary>,
    );
    const startInput = screen.getByLabelText(/start date/i);
    fireEvent.change(startInput, { target: { value: 'not-a-date' } });
    expect(startInput).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
