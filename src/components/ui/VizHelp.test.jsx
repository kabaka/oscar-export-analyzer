import React from 'react';
import { render, screen } from '@testing-library/react';
import VizHelp from './VizHelp';

describe('VizHelp', () => {
  it('generates a stable id and associates tooltip', () => {
    const { rerender } = render(<VizHelp text="Help text" />);
    const trigger = screen.getByTestId('viz-help');
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.id).toMatch(/^viz-tip-/);
    expect(trigger).toHaveAttribute('aria-describedby', tooltip.id);
    const firstId = tooltip.id;
    rerender(<VizHelp text="Help text" />);
    expect(screen.getByRole('tooltip').id).toBe(firstId);
  });

  it('uses provided id when supplied', () => {
    render(<VizHelp text="Help text" id="custom-id" />);
    const trigger = screen.getByTestId('viz-help');
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.id).toBe('custom-id');
    expect(trigger).toHaveAttribute('aria-describedby', 'custom-id');
  });
});
