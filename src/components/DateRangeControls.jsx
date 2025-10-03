import React from 'react';

function DateRangeControls({
  quickRange,
  onQuickRangeChange,
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  onReset,
}) {
  return (
    <div className="date-filter">
      <select
        value={quickRange}
        onChange={(e) => onQuickRangeChange(e.target.value)}
        aria-label="Quick range"
      >
        <option value="all">All</option>
        <option value="7">Last 7 days</option>
        <option value="14">Last 14 days</option>
        <option value="30">Last 30 days</option>
        <option value="90">Last 90 days</option>
        <option value="180">Last 180 days</option>
        <option value="365">Last year</option>
        <option value="1825">Last 5 years</option>
        <option value="custom">Custom</option>
      </select>
      <input
        type="date"
        value={startValue}
        onChange={(e) => onStartChange(e.target.value)}
        aria-label="Start date"
      />
      <span>-</span>
      <input
        type="date"
        value={endValue}
        onChange={(e) => onEndChange(e.target.value)}
        aria-label="End date"
      />
      {(startValue || endValue) && (
        <button className="btn-ghost" onClick={onReset} aria-label="Reset date filter">
          ×
        </button>
      )}
    </div>
  );
}

export default DateRangeControls;
