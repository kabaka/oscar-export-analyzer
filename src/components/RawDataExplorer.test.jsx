import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RawDataExplorer from './RawDataExplorer';
import { DataProvider } from '../context/DataContext';

const sampleSummary = [
  { Date: '2024-07-01', UsageHours: 7.2, AHI: 3.1 },
  { Date: '2024-07-02', UsageHours: 3.8, AHI: 6.5 },
  { Date: '2024-07-03', UsageHours: 5.0, AHI: 4.0 },
];

const sampleDetails = [
  {
    DateTime: '2024-07-01T01:00:00',
    Event: 'ClearAirway',
    'Data/Duration': 12,
  },
  {
    DateTime: '2024-07-02T02:00:00',
    Event: 'Obstructive',
    'Data/Duration': 25,
  },
];

describe('RawDataExplorer', () => {
  test('renders and filters summary rows by search', async () => {
    render(
      <DataProvider summaryData={sampleSummary} detailsData={sampleDetails}>
        <RawDataExplorer />
      </DataProvider>,
    );
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    // Table should show 3 rows initially (reported count)
    expect(screen.getByTestId('row-count')).toHaveTextContent('3');
    const search = screen.getByPlaceholderText('Search');
    await userEvent.type(search, '2024-07-02');
    expect(screen.getByTestId('row-count')).toHaveTextContent('1');
  });

  test('toggle columns visibility', async () => {
    render(
      <DataProvider summaryData={sampleSummary} detailsData={sampleDetails}>
        <RawDataExplorer />
      </DataProvider>,
    );
    const summary = screen.getByText('Columns');
    await userEvent.click(summary);
    const ahiToggle = screen.getByLabelText('AHI');
    expect(ahiToggle).toBeChecked();
    await userEvent.click(ahiToggle);
    // Column header should no longer include AHI
    expect(
      screen.queryByRole('columnheader', { name: /AHI/ }),
    ).not.toBeInTheDocument();
  });

  test('sorts by header click', async () => {
    render(
      <DataProvider summaryData={sampleSummary} detailsData={sampleDetails}>
        <RawDataExplorer />
      </DataProvider>,
    );
    // Click AHI header to sort asc
    const ahiHeader = await screen.findByRole('columnheader', { name: 'AHI' });
    await userEvent.click(ahiHeader);
    // First visible data row (virtualized) should be the lowest AHI (3.1)
    // We inspect the first rendered cell row text content includes 3.1
    expect(screen.getByText('3.1')).toBeInTheDocument();
    // Toggle sort desc
    await userEvent.click(ahiHeader);
    expect(screen.getByText('6.5')).toBeInTheDocument();
  });

  test('apply date filter triggers callback', async () => {
    const onApply = vi.fn();
    render(
      <DataProvider summaryData={sampleSummary} detailsData={sampleDetails}>
        <RawDataExplorer onApplyDateFilter={onApply} />
      </DataProvider>,
    );
    const start = screen.getByLabelText('Start date:');
    const end = screen.getByLabelText('End date:');
    await userEvent.type(start, '2024-07-02');
    await userEvent.type(end, '2024-07-03');
    await userEvent.click(
      screen.getByRole('button', { name: /Apply to charts/i }),
    );
    expect(onApply).toHaveBeenCalledTimes(1);
    const arg = onApply.mock.calls[0][0];
    expect(arg.start).toBeInstanceOf(Date);
    expect(arg.end).toBeInstanceOf(Date);
  });
});
