---
name: code-review-checklist
description: Comprehensive code review checklist covering quality, consistency, testing, documentation, and security. Use when reviewing pull requests or preparing code for merge.
---

# Code Review Checklist

This skill provides a comprehensive checklist for reviewing code changes in OSCAR Export Analyzer, covering quality, consistency, testing, documentation, and security.

## Pre-Review: Understanding Context

Before reviewing code, understand:

- [ ] What is this change trying to accomplish?
- [ ] What acceptance criteria were defined?
- [ ] Why this approach over alternatives?
- [ ] What files are changed? (run `git diff --stat`)
- [ ] Are changes scoped appropriately?

## File Organization

### Component Structure

- [ ] Components in `src/components/` (not root)
- [ ] Complex features organized in subdirectories (e.g., `charts/`, `fitbit/`)
- [ ] Test files colocated: `ComponentName.jsx` + `ComponentName.test.jsx`
- [ ] File naming: `PascalCase.jsx` for components

### Hooks and Utilities

- [ ] Custom hooks in `src/hooks/`
- [ ] Utilities in `src/utils/`
- [ ] Hook names start with `use` prefix
- [ ] Tests colocated with code

### Constants and Workers

- [ ] Constants in `src/constants/` (not scattered)
- [ ] Workers in `src/workers/` with `.worker.js` extension
- [ ] No hardcoded values that should be constants

## Naming Conventions

### Consistency Check

- [ ] Components: `PascalCase` (UsagePatternsCharts.jsx)
- [ ] Functions/variables: `camelCase` (calculateAhi, sessionData)
- [ ] Constants: `UPPER_SNAKE_CASE` (AHI_NORMAL, EPAP_MIN)
- [ ] Files match their export: `DateFilter.jsx` exports `DateFilter`

### Meaningful Names

- [ ] Clear intent: `filterByDateRange` not `filter1`
- [ ] Medical terminology consistent: AHI, EPAP, SpO2 (not ahi, epap, spo2)
- [ ] No abbreviations unless widely known (CSV, HTTP ok; but not `sess`, `usr`)

## Code Quality

### DRY Violations

- [ ] No duplicate logic across files
- [ ] Common patterns extracted to utilities/hooks
- [ ] Repeated calculations extracted to functions
- [ ] Similar components share base component

### Code Smells

- [ ] Functions under 50 lines (complex functions decomposed)
- [ ] Components under 300 lines (large components split)
- [ ] No deeply nested conditionals (> 3 levels)
- [ ] No god objects or classes (single responsibility)
- [ ] Clear abstractions (no leaky abstractions)

### Error Handling

- [ ] Try-catch around async operations
- [ ] Meaningful error messages (not generic "Error occurred")
- [ ] Errors don't expose sensitive data (PHI)
- [ ] Fallback behavior for failures

## Testing

### Test Coverage

- [ ] New features have tests
- [ ] Bug fixes have regression tests
- [ ] Tests cover happy path
- [ ] Tests cover error scenarios
- [ ] Tests cover edge cases (empty data, single value, extremes)

### Test Quality

- [ ] Tests are deterministic (no random failures)
- [ ] Tests don't depend on execution order
- [ ] Descriptive test names (explain scenario)
- [ ] Use Testing Library queries (accessible queries preferred)
- [ ] Mock external dependencies (Web Workers, APIs)

### Commands Pass

```bash
# All must pass before merge
npm run lint          # No errors or warnings
npm test -- --run     # All tests pass
npm run build         # Build succeeds, no warnings
```

## Documentation

### Code Documentation

- [ ] Complex logic has inline comments explaining "why"
- [ ] Public functions have JSDoc comments
- [ ] Algorithm parameters documented with rationale
- [ ] Non-obvious code patterns explained

### User-Facing Docs

- [ ] README updated if features changed
- [ ] CHANGELOG.md updated (today's date section)
- [ ] User guides updated if UI/UX changed
- [ ] Developer docs updated if architecture changed

### CHANGELOG Requirements

- [ ] Entry added if user-facing change
- [ ] Entry in today's date section (YYYY-MM-DD)
- [ ] Proper category (Added, Changed, Fixed, Security, etc.)
- [ ] Clear description with issue/PR link

## Accessibility

### Visual Accessibility

- [ ] Color contrast meets WCAG AA (4.5:1 minimum)
- [ ] Colorblind-safe palettes (not red/green only)
- [ ] Text legible at standard sizes
- [ ] Focus indicators visible

### Keyboard Accessibility

- [ ] All interactive elements keyboard accessible
- [ ] Tab order logical
- [ ] Enter/Space activate buttons
- [ ] Escape closes modals
- [ ] Focus management for modals/dialogs

### ARIA and Semantics

- [ ] Semantic HTML (button, nav, main, article)
- [ ] ARIA labels for charts and non-text content
- [ ] Form inputs have labels
- [ ] Error messages associated with inputs

## Security and Privacy

### Sensitive Data Handling

- [ ] No PHI logged to console (no AHI values, dates, sessions)
- [ ] No real OSCAR data in test files
- [ ] Test data uses builders from `src/test-utils/`
- [ ] No hardcoded patient examples
- [ ] CSV data not committed accidentally

### Data Privacy

- [ ] Data stays local (no network uploads)
- [ ] IndexedDB writes encrypted if storing PHI
- [ ] User consent before persistence
- [ ] Export/print only user-selected data
- [ ] Web Worker messages sanitized (no CSV content in errors)

### Network Security

- [ ] No credentials in code
- [ ] API keys not hardcoded
- [ ] HTTPS for external requests
- [ ] PKCE for OAuth flows

## Performance

### Optimization Check

- [ ] No unnecessary re-renders (React.memo, useMemo where needed)
- [ ] Heavy computation in Web Workers
- [ ] Large lists virtualized (if > 1000 items)
- [ ] Lazy loading for non-critical components
- [ ] Images optimized and lazy-loaded

### Resource Management

- [ ] Web Workers terminated on cleanup
- [ ] Event listeners removed on unmount
- [ ] No memory leaks (check DevTools profiler)
- [ ] IndexedDB connections closed

## Architecture Adherence

### Patterns Consistency

- [ ] Similar components follow same structure
- [ ] State management consistent (hooks/context patterns)
- [ ] Data flow follows established patterns
- [ ] Web Worker communication uses project patterns

### Dependencies

- [ ] No unnecessary dependencies added
- [ ] Existing dependencies used correctly
- [ ] No circular dependencies
- [ ] Import paths consistent

## Git and CI

### Commit Quality

- [ ] Meaningful commit messages (Conventional Commits format)
- [ ] Commits scoped appropriately (not mixing concerns)
- [ ] No merge conflicts
- [ ] No sensitive data in history

### Working Directories

- [ ] `docs/work/` empty (temporary files cleaned up)
- [ ] `temp/` empty (temporary scripts removed)
- [ ] No temporary investigation notes committed
- [ ] Draft documentation migrated to permanent locations

### CI Checks

- [ ] GitHub Actions pass (if CI configured)
- [ ] Build artifacts not committed (dist/, coverage/)
- [ ] No console warnings in build output

## Scope Validation

### Acceptance Criteria

- [ ] All original requirements met
- [ ] No missing functionality
- [ ] No gold-plating (extra features not requested)
- [ ] Edge cases handled as specified

### Breaking Changes

- [ ] No unintended breaking changes
- [ ] API changes documented
- [ ] Migration path provided if breaking
- [ ] User-facing changes have CHANGELOG entry

## Common Issues

### Forgot to Update

- [ ] CHANGELOG.md updated
- [ ] Tests updated for new behavior
- [ ] Documentation updated
- [ ] Related components updated

### Testing Gaps

- [ ] No tests for new code
- [ ] Tests don't cover error cases
- [ ] Integration between components not tested
- [ ] Web Worker communication not tested

### Privacy Violations

- [ ] console.log with PHI
- [ ] Hardcoded real data examples
- [ ] CSV content in error messages
- [ ] Test files with real exports

### Architecture Drift

- [ ] Component in wrong directory
- [ ] Breaking established patterns
- [ ] Introducing new pattern without justification
- [ ] Not following existing conventions

## Review Workflow

### First Pass (High-Level)

1. Read PR description and acceptance criteria
2. Check files changed (scope appropriate?)
3. Review git diff at high level
4. Identify areas of concern

### Second Pass (Detailed)

1. Read each file change carefully
2. Check against checklist items
3. Run code locally if complex
4. Test user-facing changes manually

### Third Pass (Testing)

1. Run `npm run lint`
2. Run `npm test -- --run`
3. Run `npm run build`
4. Test locally in browser

### Feedback

- **Blocking issues**: Must fix before merge (tests fail, security issue, scope gap)
- **Suggestions**: Nice-to-have improvements (refactoring, better names)
- **Questions**: Clarify intent, why this approach?
- **Praise**: Acknowledge good work (clear code, thorough tests)

## Resources

- **Project structure**: vite-react-project-structure skill
- **Test patterns**: react-component-testing skill
- **Privacy rules**: oscar-privacy-boundaries skill
- **CHANGELOG maintenance**: oscar-changelog-maintenance skill
- **Developer docs**: `docs/developer/` directory
