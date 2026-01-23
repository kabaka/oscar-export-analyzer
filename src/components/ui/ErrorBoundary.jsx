import React from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';

/**
 * Error boundary wrapper component that catches React rendering errors.
 *
 * Displays a fallback UI when child components throw exceptions, preventing
 * the entire app from crashing. Logs errors to console in development mode.
 *
 * @param {Object} props - Component props
 * @param {ReactNode} props.children - Child components to wrap
 * @param {ReactNode} [props.fallback='Something went wrong.'] - UI to display when error is caught
 * @returns {JSX.Element} React Error Boundary wrapping children or fallback
 *
 * @example
 * <ErrorBoundary fallback={<p>Failed to load chart</p>}>
 *   <ComplexChart />
 * </ErrorBoundary>
 */
function ErrorBoundary({ fallback, children }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={() => (
        <div role="alert">{fallback || 'Something went wrong.'}</div>
      )}
      onError={(error, info) => {
        if (import.meta.env.DEV) {
          console.error('ErrorBoundary caught an error', error, info);
        }
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}

export default ErrorBoundary;
