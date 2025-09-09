import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FalseNegativesAnalysis from './FalseNegativesAnalysis';

const sample = [
  {
    start: new Date('2024-01-01T00:00:00Z'),
    durationSec: 60,
    confidence: 0.9,
  },
];

describe('FalseNegativesAnalysis', () => {
  it('renders preset selector and calls change handler', () => {
    const onChange = vi.fn();
    render(
      <FalseNegativesAnalysis
        list={sample}
        preset="balanced"
        onPresetChange={onChange}
      />
    );
    const select = screen.getByLabelText(/preset/i);
    fireEvent.change(select, { target: { value: 'strict' } });
    expect(onChange).toHaveBeenCalledWith('strict');
    expect(screen.getByText(/false negative clusters/i)).toBeInTheDocument();
  });
});
