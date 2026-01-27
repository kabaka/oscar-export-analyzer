/**
 * Barrel export for Fitbit integration components.
 * Note: FitbitConnectionCard is now exported from parent components/ directory.
 */

export { default as FitbitDashboard } from './FitbitDashboard';
export { default as SyncStatusPanel } from './SyncStatusPanel';

// Correlation charts
export * from './correlation';

// Re-export for convenience
export * from './FitbitDashboard';
export * from './SyncStatusPanel';
