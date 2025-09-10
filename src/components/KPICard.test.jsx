import React from 'react';
import { render, screen } from '@testing-library/react';
import KPICard from './KPICard';

describe('KPICard', () => {
  it('renders title, value, and children', () => {
    const { asFragment } = render(
      <KPICard title="Test KPI" value="42">
        <span data-testid="child">Child Content</span>
      </KPICard>,
    );
    expect(screen.getByText('Test KPI')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toHaveTextContent('Child Content');
    expect(asFragment()).toMatchSnapshot();
  });
});
