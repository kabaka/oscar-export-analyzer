import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ParamInput from './ParamInput';

describe('ParamInput', () => {
  it('renders label and forwards numeric changes', async () => {
    const onChange = vi.fn();
    render(
      <ParamInput
        label="Gap sec"
        value={10}
        onChange={onChange}
        inputProps={{ type: 'number', min: 0 }}
      />,
    );
    const input = screen.getByLabelText('Gap sec');
    fireEvent.change(input, { target: { value: '30' } });
    expect(onChange).toHaveBeenLastCalledWith(30);
  });
});
