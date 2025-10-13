import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ParamInput from './ParamInput';
import {
  CHANGEPOINT_PENALTY,
  DEFAULT_MAX_LAG,
  MIN_LAG_INPUT,
} from '../../constants';
const INITIAL_VALUE = CHANGEPOINT_PENALTY;
const UPDATED_VALUE = DEFAULT_MAX_LAG;
const MIN_VALUE = MIN_LAG_INPUT;

describe('ParamInput', () => {
  it('renders label and forwards numeric changes', async () => {
    const onChange = vi.fn();
    render(
      <ParamInput
        label="Gap sec"
        value={INITIAL_VALUE}
        onChange={onChange}
        inputProps={{ type: 'number', min: MIN_VALUE }}
      />,
    );
    const input = screen.getByLabelText('Gap sec');
    fireEvent.change(input, { target: { value: String(UPDATED_VALUE) } });
    expect(onChange).toHaveBeenLastCalledWith(UPDATED_VALUE);
  });
});
