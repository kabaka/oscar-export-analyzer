import React from 'react';

/**
 * Simple labeled input component for numeric parameters.
 *
 * Memoized for performance when used in control panels with many inputs.
 * Coerces input value to number before passing to onChange callback.
 *
 * @param {Object} props - Component props
 * @param {string} props.label - Label text displayed next to input
 * @param {number} props.value - Current numeric value
 * @param {Function} props.onChange - Callback fired when value changes.
 *   Called with numeric value: (num: number) => void
 * @param {Object} [props.inputProps={}] - Additional HTML input attributes
 *   (e.g., { type: 'range', min: 0, max: 100, step: 1 })
 * @returns {JSX.Element} A div containing label and input element
 *
 * @example
 * <ParamInput
 *   label="Max lag:"
 *   value={maxLag}
 *   onChange={setMaxLag}
 *   inputProps={{ type: 'number', min: 1, max: 50 }}
 * />
 */
function ParamInput({ label, value, onChange, inputProps = {} }) {
  return (
    <div>
      <label>
        {label}
        <input
          {...inputProps}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </label>
    </div>
  );
}

export default React.memo(ParamInput);
