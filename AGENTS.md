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
- `docs/work/`: temporary investigation documents (gitignored, must be empty before commits).
- `temp/`: temporary scripts and files (gitignored, must be empty before commits).

---

## Working Directory Policy for Subagents

OSCAR Export Analyzer provides two `.gitignore`d directories for temporary work. **Agents MUST use these local directories instead of `/tmp` or system temp paths.** Both directories must be empty before any commit. The `@readiness-reviewer` enforces this as part of the pre-commit quality gate.

### Why Use Local Temp Directories (Not `/tmp`)

**Critical rule**: All temporary files go to `docs/work/` or `temp/` — **NEVER `/tmp` or system temp paths.**

**Why this matters:**

- ❌ `/tmp` writes are outside the workspace and typically require user approval to access
- ❌ System temp paths are hard to track, clean up, and may be deleted unexpectedly
- ✅ `docs/work/` and `temp/` are gitignored, version-controlled, and visible in the workspace
- ✅ Local temp directories allow agents to coordinate cleanup and user verification
- ✅ All temporary work stays within the project, making it discoverable and maintainable

### Directory Purposes

- **`docs/work/`**: Temporary investigation documentation
  - RCA reports and debugging analysis (by `@debugger-rca-analyst`)
  - Algorithm validation notes (by `@data-scientist`)
  - Implementation planning documents
  - Test reports and coverage investigations
  - Draft documentation before finalization
- **`temp/`**: Temporary scripts and files
  - One-off utility scripts for testing or analysis
  - Temporary data transformation scripts
  - Build/test artifacts that aren't in `dist/`
  - Experimental code not ready for `src/`

### Critical Security Requirements

**NEVER place files containing real OSCAR CSV data or patient health information in these directories.**

Protected Health Information (PHI) includes:

- Raw OSCAR CSV exports (even "sample" files)
- AHI values, SpO2 readings, leak rates, pressure settings
- Session timestamps, dates, durations
- Any derivative data from real patient exports

**Safe patterns:**

- ✅ Use synthetic test data from `src/test-utils/builders.js`
- ✅ Reference data by description: "high AHI outlier case", "zero-usage session"
- ✅ Include only metadata: "parsed 2847 rows", "found 3 clusters"
- ✅ Document patterns: "AHI spike correlates with leak events"

**Unsafe patterns (NEVER do this):**

- ❌ Copy real CSV files to `temp/` for "testing"
- ❌ Log actual metric values: "AHI=42.3 on 2024-01-15"
- ❌ Include CSV excerpts in RCA notes, even if "anonymized"
- ❌ Hardcode real data samples in temporary scripts
- ❌ Store screenshots of charts with real patient data

### Cleanup Expectations

**Agents must clean up their own files when work is complete:**

1. **After completing investigation**: Delete temporary RCA/debugging docs from `docs/work/`
2. **After merging features**: Delete temporary implementation notes
3. **After fixing bugs**: Archive valuable RCA findings to `docs/developer/reports/` or delete
4. **After experiments**: Delete temporary scripts from `temp/`

**The `@readiness-reviewer` will reject commits if these directories are not empty.**

### Migration Path for Permanent Documentation

If temporary work produces valuable permanent documentation:

- **Algorithm insights** → Extract to `docs/developer/architecture/` or inline code comments (coordinate with `@documentation-specialist`)
- **Test strategy findings** → Move to permanent test documentation or ADRs
- **RCA findings** → Archive to `docs/developer/reports/` if they document systemic issues
- **Implementation notes** → Extract key decisions to ADRs via `@adr-specialist`

**Never promote files containing real patient data to permanent locations.**

### Example Workflow

```bash
# @debugger-rca-analyst investigating a bug
echo "RCA: Date filter regression" > docs/work/debugging/date-filter-rca.md
# ... investigation using synthetic test data only ...
# After fix is merged:
rm docs/work/debugging/date-filter-rca.md

# @data-scientist validating algorithm changes
echo "Cluster validation results" > docs/work/testing/cluster-validation.md
# ... testing with builders.buildSession() data ...
# Extract insights to permanent docs:
# (coordinate with @documentation-specialist)
# Then delete temporary notes:
rm docs/work/testing/cluster-validation.md
```

---

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

### CHANGELOG.md Maintenance (Required)

**All agents must update CHANGELOG.md when making user-facing or contributor-facing changes.**

The project follows [Keep a Changelog](https://keepachangelog.com/) format. Add entries to the `[Unreleased]` section under the appropriate category:

- **Added**: New features, visualizations, analysis capabilities, or documentation
- **Changed**: Modifications to existing functionality, UI/UX improvements, dependency updates that change behavior
- **Deprecated**: Features marked for removal in future versions
- **Removed**: Deleted features or breaking changes
- **Fixed**: Bug fixes, performance improvements, error handling
- **Security**: Security fixes, privacy enhancements, vulnerability patches

**What requires a CHANGELOG entry:**

✅ New features or visualizations users interact with  
✅ Breaking changes to data formats, APIs, or workflows  
✅ Significant UI/UX improvements  
✅ Performance improvements users would notice  
✅ Bug fixes affecting user experience  
✅ Documentation additions helping users/developers  
✅ Security or privacy enhancements  
✅ Dependency updates changing behavior

❌ Internal refactors without user impact  
❌ Test additions (unless documenting new coverage)  
❌ Code organization changes  
❌ Typo fixes in code comments  
❌ CI/CD changes (unless affecting contributors)

**Format and Workflow:**

The project uses date-based versioning (YYYY-MM-DD) because main branch deploys to GitHub Pages immediately with no staging environment. Changes flow through these stages:

1. **Before commit**: Add entries to `[Unreleased]` section
2. **On commit**: Entries stay in `[Unreleased]` until a release boundary is reached
3. **At release**: Move entries from `[Unreleased]` to a dated section (e.g., `[2026-01-23]`)

**Typical workflow for agents:**

```markdown
## [Unreleased]

### Added

- Brief description of what was added ([#123](link-to-issue-or-pr))
```

When a set of changes should be grouped as a release (e.g., end of sprint, major feature completion), the orchestrator moves `[Unreleased]` entries to a dated section:

```markdown
## [2026-01-23]

### Added

- Accessibility guide documenting keyboard navigation and WCAG AA compliance
- Testing patterns guide with 10 patterns and 29 code examples

### Fixed

- Date range filter now correctly handles sessions spanning midnight
```

**Guidelines:**

1. Add entries to `[Unreleased]` when you commit code with user-facing changes
2. Use present tense, be concise but descriptive
3. Include links to issues/PRs when available
4. Don't worry about dates—that's handled during release coordination
5. `@readiness-reviewer` will verify CHANGELOG is updated before approving

For questions about what belongs in CHANGELOG, consult `@documentation-specialist`.

## Commit & Pull Request Guidelines

- Style: prefer Conventional Commits (e.g., `feat:`, `fix:`, `chore:`) as in history.
- Pre-commit: Husky runs `npm run lint`, `npm test`, and `npm run build`; ensure all pass and builds have no warnings.
- Include updates to tests and docs with your code changes; bug fixes should come with regression tests.
- PRs: include clear description, linked issues, and screenshots/GIFs for UI changes. Ensure CI (lint, build, tests) passes.

## Security & Configuration Tips

- Node: use version 20 (see CI). Avoid committing data exports containing sensitive information.
- Vite config: see `vite.config.js`. For hooks, run `npm run prepare` after install.
