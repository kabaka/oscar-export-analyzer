# Repository Guidelines

This repo contains a Vite + React app for analyzing OSCAR sleep data, with tests via Vitest and Testing Library. Use Node 20 and npm.

## Project Structure & Module Organization
- `src/`: React app code.
  - `components/`, `utils/`, `hooks/`, `App.jsx`, `main.jsx`.
  - Tests colocated as `*.test.jsx|js` next to code.
- `analysis.js`: optional CLI for deeper event analysis.
- `dist/`: production build output (generated).
- `.github/workflows/ci.yml`: CI for build and tests.

## Build, Test, and Development Commands
- `npm run dev`: start Vite dev server with HMR.
- `npm run build`: create production build to `dist/`.
- `npm run preview`: serve the production build locally.
- `npm test`: run unit/integration tests once.
- `npm run test:watch`: run tests in watch mode.
- `npm run test:coverage`: run tests with coverage report.
- `npm run prepare`: install Husky Git hooks.

## Coding Style & Naming Conventions
- Indentation: 2 spaces; semicolons optional but be consistent.
- Components: `PascalCase` filenames (e.g., `UsagePatternsCharts.jsx`).
- Functions/vars: `camelCase`; constants: `UPPER_SNAKE_CASE`.
- Keep components functional and focused; co-locate tests and small helpers.
- No linter is configured; ensure clean Vite builds with zero warnings.

## Testing Guidelines
- Frameworks: Vitest + @testing-library/react + jsdom.
- Naming: `ComponentName.test.jsx` or `module.test.js` colocated with code.
- Expectations: add tests for new logic and bug fixes; prefer user-facing assertions.
- Run locally: `npm test` or `npm run test:watch`; check coverage via `npm run test:coverage`.

## Commit & Pull Request Guidelines
- Style: prefer Conventional Commits (e.g., `feat:`, `fix:`, `chore:`) as in history.
- Pre-commit: Husky runs `npm test` and `npm run build`; ensure both pass and builds have no warnings.
- PRs: include clear description, linked issues, and screenshots/GIFs for UI changes. Ensure CI passes.

## Security & Configuration Tips
- Node: use version 20 (see CI). Avoid committing data exports containing sensitive information.
- Vite config: see `vite.config.js`. For hooks, run `npm run prepare` after install.

