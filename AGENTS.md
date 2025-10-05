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
- Typical builds take 2+ minutes; let them finish before concluding failure.
- `npm run preview`: serve the production build locally.
- `npm test`: run tests in watch mode.
- `npm test -- --run`: run tests once without watch mode.
- `npm run test:watch`: explicitly run tests in watch mode.
- `npm run test:coverage`: run tests with coverage report.
- `npm run prepare`: install Husky Git hooks.
- `npm run lint`: run ESLint for code quality.
- `npm run format`: apply Prettier formatting.

## Coding Style & Naming Conventions

- Indentation: 2 spaces; semicolons optional but be consistent.
- Components: `PascalCase` filenames (e.g., `UsagePatternsCharts.jsx`).
- Functions/vars: `camelCase`; constants: `UPPER_SNAKE_CASE`.
- Keep components functional and focused; co-locate tests and small helpers.
- ESLint and Prettier are configured; run `npm run lint` and `npm run format` to maintain code quality.

## Testing Guidelines

- Frameworks: Vitest + @testing-library/react + jsdom.
- Naming: `ComponentName.test.jsx` or `module.test.js` colocated with code.
- Expectations: add tests for new logic and bug fixes; prefer user-facing assertions.
- Do not abandon new tests because they fail—keep fixing until they pass.
- Run locally: `npm test` (watch mode) or `npm test -- --run` (single run); check coverage via `npm run test:coverage`.

## Documentation Guidelines

- Docs should be helpful and fun; avoid redundant README notes for obvious behavior.
- Update documentation alongside code changes to keep docs accurate and engaging.

## Commit & Pull Request Guidelines

- Style: prefer Conventional Commits (e.g., `feat:`, `fix:`, `chore:`) as in history.
- Pre-commit: Husky runs `npm run lint`, `npm test`, and `npm run build`; ensure all pass and builds have no warnings.
- Include updates to tests and docs with your code changes; bug fixes should come with regression tests.
- PRs: include clear description, linked issues, and screenshots/GIFs for UI changes. Ensure CI (lint, build, tests) passes.

## Security & Configuration Tips

- Node: use version 20 (see CI). Avoid committing data exports containing sensitive information.
- Vite config: see `vite.config.js`. For hooks, run `npm run prepare` after install.

## Automated screenshots

- The app supports session prehydration for screenshot automation. Load sanitized datasets by placing fixtures under `public/fixtures/` (see `public/fixtures/screenshot-session.json`).
- Vite accepts a `VITE_SCREENSHOT_SESSION` environment variable pointing to the desired JSON snapshot (relative paths such as `/fixtures/screenshot-session.json` are resolved against the dev server).
- Automation can also pass `?session=<url>` in the query string or inject `window.__OSCAR_PREHYDRATED_SESSION__` before React mounts. All options expect the JSON produced by `buildSession`.
- Never commit fixtures that contain identifying information; scrub dates, names, and any device identifiers before adding new screenshot datasets.
