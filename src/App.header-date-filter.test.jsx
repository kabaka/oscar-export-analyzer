import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { AppProviders } from './app/AppProviders';
import { AppShell } from './App';
import { ErrorBoundary } from './components/ui';

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
    // Set time with explicit time to avoid timezone issues
    vi.setSystemTime(new Date('2023-01-10T12:00:00Z'));
    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );
    const presetSelect = screen.getByLabelText(/quick range/i);
    const startInput = screen.getByLabelText(/start date/i);
    const endInput = screen.getByLabelText(/end date/i);

    // eslint-disable-next-line no-magic-numbers -- test simulates 7-day preset
    fireEvent.change(presetSelect, { target: { value: '7' } });
    // Accept timezone variance in date calculations
    const startVal7 = startInput.value;
    expect(['2023-01-03', '2023-01-04']).toContain(startVal7);
    const endValue = endInput.value;
    expect(['2023-01-09', '2023-01-10']).toContain(endValue);

    // eslint-disable-next-line no-magic-numbers -- test simulates 14-day preset
    fireEvent.change(presetSelect, { target: { value: '14' } });
    const startVal14 = startInput.value;
    expect(['2022-12-27', '2022-12-26', '2022-12-28']).toContain(startVal14);

    // eslint-disable-next-line no-magic-numbers -- test simulates 365-day preset
    fireEvent.change(presetSelect, { target: { value: '365' } });
    const startVal365 = startInput.value;
    expect(['2022-01-10', '2022-01-09', '2022-01-11']).toContain(startVal365);

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
