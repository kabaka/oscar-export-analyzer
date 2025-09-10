import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

describe('Header date filter', () => {
  it('renders date inputs inside the header', () => {
    render(<App />);
    const startInput = screen.getByLabelText(/start date/i);
    const endInput = screen.getByLabelText(/end date/i);
    const header = startInput.closest('header');
    expect(header).toHaveClass('app-header');
    expect(endInput.closest('header')).toBe(header);
  });

  it('ignores invalid dates without crashing', () => {
    render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>,
    );
    const startInput = screen.getByLabelText(/start date/i);
    fireEvent.change(startInput, { target: { value: 'not-a-date' } });
    expect(startInput).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
