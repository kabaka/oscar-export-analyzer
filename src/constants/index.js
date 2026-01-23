/**
 * Barrel export for all constants used throughout the application.
 *
 * This module re-exports all constants from specialized domains (charts, time,
 * layout, UI, CLI) to simplify imports. Instead of importing from scattered
 * modules, components can now do:
 *   import { CHART_HEIGHT, TIME_CONSTANTS, ... } from 'constants';
 *
 * This provides a single point of access to all application constants while
 * maintaining logical separation in the implementation files.
 */

// Chart visualization constants
export * from './charts.js';

// Time and temporal constants
export * from './time.js';

// Layout and spacing constants
export * from './layout.js';

// UI styling and proportion constants
export * from './ui.js';

// CLI and clustering algorithm constants
export * from './cli.js';

// Test data (only imported by test files)
export * from './testData.js';
