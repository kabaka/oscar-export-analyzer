import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('Header date filter', () => {
  it('renders date inputs inside the header', () => {
    render(<App />);
    const startInput = screen.getByLabelText(/start date/i);
    const endInput = screen.getByLabelText(/end date/i);
    const header = startInput.closest('header');
    expect(header).toHaveClass('app-header');
    expect(endInput.closest('header')).toBe(header);
  });
});
