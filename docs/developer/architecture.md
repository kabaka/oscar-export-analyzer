## Architecture

The app is a Vite + React single page application.

- **Component Hierarchy**: `App` hosts file pickers and analysis sections. Visualization components live in `src/components` and are wrapped with `ErrorBoundary` as needed.
- **Component Hierarchy**: `App` hosts file pickers and analysis sections. Visualization components live in `src/components` and are wrapped with `ErrorBoundary` as needed. Charts should use `ThemedPlot` to automatically apply light or dark styling.
- **State Management**: `DataContext` provides parsed CSV data, parameters, and theme. Hooks such as `useData` and `useTheme` access and update this state.
- **Data Flow**: Uploaded CSVs are parsed with PapaParse in a worker. Results are stored in context and passed to chart components. Additional workers handle cluster and false-negative analysis.
