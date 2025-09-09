import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FalseNegativesAnalysis from './FalseNegativesAnalysis.jsx';

describe('FalseNegativesAnalysis component', () => {
  it('renders list and handles preset change', () => {
    const list = [
      {
        start: new Date('2021-01-01T00:00:00Z'),
        durationSec: 90,
        confidence: 0.9,
      },
    ];
    const handlePreset = vi.fn();
    render(
      <FalseNegativesAnalysis
        list={list}
        preset="strict"
        onPresetChange={handlePreset}
      />
    );

    // table row for data plus header
    expect(screen.getAllByRole('row')).toHaveLength(2);

    const select = screen.getByLabelText(/preset/i);
    fireEvent.change(select, { target: { value: 'balanced' } });
    expect(handlePreset).toHaveBeenCalledWith('balanced');
  });
});
