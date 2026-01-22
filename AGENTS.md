# OSCAR Export Analyzer — Agent Guide

## Custom Copilot Agents

OSCAR Export Analyzer includes **9 specialized GitHub Copilot agents** for development workflows. When completing tasks that could be delegated, use these agents as subagents; they coordinate development, testing, documentation, analysis, and quality assurance.

**Agents** (in `.github/agents/`):

- `@orchestrator-manager` — Coordinate projects, delegate tasks, track progress across workflows
- `@frontend-developer` — Build React/JSX components, hooks, component architecture
- `@ux-designer` — Design user experiences, accessibility, data visualization, medical UI patterns
- `@testing-expert` — Design test strategy, write Vitest tests, synthetic test data, coverage
- `@data-scientist` — Statistical analysis, algorithm validation, medical data interpretation
- `@documentation-specialist` — Write and maintain documentation, guides, architecture docs, code comments
- `@security-auditor` — Audit security, privacy, sensitive health data handling (local-first privacy)
- `@adr-specialist` — Document architectural decisions, technology choices, rationale
- `@debugger-rca-analyst` — Determine root cause through rigorous testing and analysis
- `@readiness-reviewer` — Pre-commit quality gate: tests pass, linting clean, scope complete, docs updated

**Documentation**:

- [**Individual Agent Details**](.github/agents/*.agent.md) — Full agent descriptions, expertise, and patterns
- **Delegation Model**: Always delegate — use multiple agents for complex work. See orchestrator-manager for patterns.
- **Quality Bar**: All tests pass, linting clean, documentation updated, no sensitive data committed.

---

## Project Structure & Module Organization

- `src/`: React app code.
  - `components/`, `utils/`, `hooks/`, `App.jsx`, `main.jsx`.
  - Tests colocated as `*.test.jsx|js` next to code.
- `analysis.js`: optional CLI for deeper event analysis.
- `dist/`: production build output (generated).
- `.github/workflows/ci.yml`: CI for build and tests.
- `.github/agents/`: Agent specifications for coordinated development.

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
