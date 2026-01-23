import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import VirtualTable from './VirtualTable';

describe('VirtualTable', () => {
  const mockData = [
    { id: 1, name: 'Alice', age: 30 },
    { id: 2, name: 'Bob', age: 25 },
    { id: 3, name: 'Charlie', age: 35 },
  ];

  const renderRow = (row, idx) => (
    <div key={idx} data-testid={`row-${idx}`}>
      {row.name} - {row.age}
    </div>
  );

  it('renders virtualized table container', () => {
    render(<VirtualTable rows={mockData} renderRow={renderRow} />);
    const tableContainer = screen.getByTestId('virtual-table-container');
    expect(tableContainer).toBeInTheDocument();
  });

  it('applies height style to container', () => {
    const customHeight = 500;
    render(
      <VirtualTable
        rows={mockData}
        height={customHeight}
        renderRow={renderRow}
      />,
    );
    const tableContainer = screen.getByTestId('virtual-table-container');
    expect(tableContainer).toHaveStyle({ height: '500px' });
  });

  it('renders visible rows using renderRow function', () => {
    render(<VirtualTable rows={mockData} renderRow={renderRow} />);
    // All rows should be visible in small dataset
    expect(screen.getByTestId('row-0')).toHaveTextContent('Alice - 30');
    expect(screen.getByTestId('row-1')).toHaveTextContent('Bob - 25');
    expect(screen.getByTestId('row-2')).toHaveTextContent('Charlie - 35');
  });

  it('creates spacer with correct total height', () => {
    const rowHeight = 40;
    const { container } = render(
      <VirtualTable
        rows={mockData}
        rowHeight={rowHeight}
        renderRow={renderRow}
      />,
    );
    // eslint-disable-next-line testing-library/no-container -- checking internal implementation detail (.virtual-table-spacer)
    const spacer = container.querySelector('.virtual-table-spacer');
    expect(spacer).toHaveStyle({ height: `${mockData.length * rowHeight}px` });
  });

  it('handles empty rows array', () => {
    const { container } = render(
      <VirtualTable rows={[]} renderRow={renderRow} />,
    );
    // eslint-disable-next-line testing-library/no-container -- checking internal implementation detail (.virtual-table-spacer)
    const spacer = container.querySelector('.virtual-table-spacer');
    expect(spacer).toHaveStyle({ height: '0px' });
  });

  it('calls renderRow with correct row and index', () => {
    const mockRenderRow = vi.fn((row, idx) => <div key={idx}>{row.name}</div>);
    render(<VirtualTable rows={mockData} renderRow={mockRenderRow} />);
    const FIRST_INDEX = 0;
    const SECOND_INDEX = 1;
    const THIRD_INDEX = 2;
    expect(mockRenderRow).toHaveBeenCalledWith(
      mockData[FIRST_INDEX],
      FIRST_INDEX,
    );
    expect(mockRenderRow).toHaveBeenCalledWith(
      mockData[SECOND_INDEX],
      SECOND_INDEX,
    );
    expect(mockRenderRow).toHaveBeenCalledWith(
      mockData[THIRD_INDEX],
      THIRD_INDEX,
    );
  });

  it('uses default row height when not provided', () => {
    const { container } = render(
      <VirtualTable rows={mockData} renderRow={renderRow} />,
    );
    // eslint-disable-next-line testing-library/no-container -- checking internal implementation detail (.virtual-table-spacer)
    const spacer = container.querySelector('.virtual-table-spacer');
    // Default is 28px from constants
    expect(spacer).toHaveStyle({ height: '84px' }); // 3 rows * 28px
  });

  it('uses custom row height when provided', () => {
    const customRowHeight = 50;
    const { container } = render(
      <VirtualTable
        rows={mockData}
        rowHeight={customRowHeight}
        renderRow={renderRow}
      />,
    );
    // eslint-disable-next-line testing-library/no-container -- checking internal implementation detail (.virtual-table-spacer)
    const spacer = container.querySelector('.virtual-table-spacer');
    expect(spacer).toHaveStyle({
      height: `${mockData.length * customRowHeight}px`,
    });
  });
});
