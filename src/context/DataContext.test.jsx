import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from '../components/ui';
import { DataProvider, useData, THEMES } from './DataContext';

describe('DataContext provider', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    document.documentElement.removeAttribute('data-theme');
    window.localStorage.clear();
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it('throws when useData is called outside provider', () => {
    function Consumer() {
      useData();
      return null;
    }
    render(
      <ErrorBoundary fallback="context error">
        <Consumer />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('context error');
  });

  it('initializes theme from localStorage', () => {
    window.localStorage.setItem('theme', THEMES.DARK);
    render(
      <DataProvider>
        <div>child</div>
      </DataProvider>,
    );
    expect(document.documentElement).toHaveAttribute('data-theme', THEMES.DARK);
  });

  it('shares summary data updates across components', async () => {
    function Setter() {
      const { setSummaryData } = useData();
      return (
        <button
          onClick={() => setSummaryData([{ Date: '2025-06-01', AHI: 5 }])}
        >
          load
        </button>
      );
    }
    function Display() {
      const { summaryData } = useData();
      return <div>{summaryData ? summaryData.length : 0}</div>;
    }
    const user = userEvent.setup();
    function Wrapper() {
      const [summary, setSummary] = React.useState(null);
      return (
        <DataProvider summaryData={summary} setSummaryData={setSummary}>
          <Setter />
          <Display />
        </DataProvider>
      );
    }
    render(<Wrapper />);
    expect(screen.getByText('0')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /load/i }));
    await screen.findByText('1');
  });
});
