import React from 'react';

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
