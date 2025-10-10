import { render, screen } from '@testing-library/react';
import React from 'react';
import ErrorBoundary from './ErrorBoundary';

function Bomb() {
  throw new Error('boom');
}

function Okay() {
  return <div>ok</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it('renders fallback when child throws', () => {
    render(
      <ErrorBoundary fallback="fallback text">
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('fallback text');
  });

  it('logs errors via console.error', () => {
    render(
      <ErrorBoundary fallback="fallback text">
        <Bomb />
      </ErrorBoundary>,
    );
    expect(console.error).toHaveBeenCalled();
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary fallback="fallback text">
        <Okay />
      </ErrorBoundary>,
    );
    expect(screen.getByText('ok')).toBeInTheDocument();
  });
});
