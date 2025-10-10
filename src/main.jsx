import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from './components/ui';
import { AppProviders } from './app/AppProviders.jsx';
import { AppShell } from './App.jsx';

import '../styles.css';
import './guide.css';
import 'katex/dist/katex.min.css';

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <AppShell />
      </AppProviders>
    </ErrorBoundary>
  </React.StrictMode>,
);
