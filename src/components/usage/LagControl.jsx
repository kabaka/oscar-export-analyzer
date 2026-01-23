import React from 'react';
import {
  LAG_INPUT_MAX,
  LAG_INPUT_MIN,
  LAG_CONTROL_GAP_PX,
  LAG_CONTROL_MARGIN_BOTTOM_PX,
  LAG_CONTROL_MARGIN_TOP_PX,
} from './lagConstants';

const LAG_INPUT_WIDTH_PX = 80;
const LAG_INPUT_STEP = 1;
const LAG_LABEL = 'Max lag (nights):';
const LAG_CONTROL_MARGIN = `${LAG_CONTROL_MARGIN_TOP_PX}px 0 ${LAG_CONTROL_MARGIN_BOTTOM_PX}px`;

/**
 * Input control for adjusting maximum lag in ACF/PACF charts.
 *
 * Allows users to dynamically change how many prior nights to consider when
 * computing autocorrelation. Useful for exploring different memory horizons
 * in usage or AHI patterns (e.g., 7 lags = 1 week, 30 lags = 1 month).
 *
 * @param {Object} props - Component props
 * @param {number} props.maxLag - Current maximum lag value (in nights)
 * @param {string} props.lagInputId - Unique ID for the input element (from useId)
 * @param {Function} props.onChange - Callback when user changes the input.
 *   Called with React ChangeEvent: (event: ChangeEvent<HTMLInputElement>) => void
 * @returns {JSX.Element} A flex container with label and number input
 *
 * @example
 * const { maxLag, lagInputId, handleLagChange } = useAutocorrelation(values);
 * return <LagControl maxLag={maxLag} lagInputId={lagInputId} onChange={handleLagChange} />;
 */
function LagControl({ maxLag, lagInputId, onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: `${LAG_CONTROL_GAP_PX}px`,
        margin: LAG_CONTROL_MARGIN,
      }}
    >
      <label htmlFor={lagInputId}>{LAG_LABEL}</label>
      <input
        id={lagInputId}
        type="number"
        min={LAG_INPUT_MIN}
        max={LAG_INPUT_MAX}
        step={LAG_INPUT_STEP}
        value={maxLag}
        onChange={onChange}
        style={{ width: `${LAG_INPUT_WIDTH_PX}px` }}
      />
    </div>
  );
}

export default LagControl;
