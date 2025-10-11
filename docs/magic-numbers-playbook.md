# Magic Numbers Playbook

This playbook explains how we keep numeric literals maintainable throughout the OSCAR Export Analyzer codebase.

## Allowlisted literals

Our ESLint configuration only permits a tiny set of inline numbers when enforcing `no-magic-numbers`:

- `-1`
- `0`
- `1`

These values already appear in array lookups and ternaries where introducing a constant would add noise. Any other literal should be given a descriptive name and exported from a shared constants module.

## Preferred constant patterns

Use the existing constant modules as templates when promoting a literal:

- [`src/constants.js`](../src/constants.js) centralizes global numeric defaults. Each constant is defined with an uppercase name, documented with a JSDoc comment, and grouped by purpose (windows, tolerances, thresholds, etc.). Arrays and objects are frozen with `Object.freeze` to signal immutability.
- [`src/constants/charts.js`](../src/constants/charts.js) contains chart-specific sizing defaults. It follows the same naming and documentation approach while keeping visualization concerns isolated from application logic.

When adding a new constant:

1. Decide whether it belongs in `src/constants.js`, `src/constants/charts.js`, or a new domain-specific module.
2. Add a short JSDoc comment that describes the unit and intent.
3. Export the constant with an `UPPER_SNAKE_CASE` name.
4. Import and reuse that constant instead of repeating a literal.

## Auditing for new magic numbers

Run the dedicated lint pass to surface any remaining inline literals:

```bash
npm run lint:magic
```

The command executes ESLint with a strict `no-magic-numbers` rule and writes a summary report to `reports/magic-numbers.json`. Review the report after large refactors, when introducing new calculations, or before shipping performance-sensitive changes. Promote any newly flagged literals to named constants following the patterns above, then rerun the check to confirm the report is clean.
