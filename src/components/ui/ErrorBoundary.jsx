import React from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';

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
