## Dependencies

Open‑source projects stand on the shoulders of many libraries. Understanding why each one is here makes upgrades less
mysterious and helps you pick the right tool when extending the analyzer. Versions are locked in `package-lock.json`;
check that file for exact numbers.

### Core Stack

- **React** – The UI is built with functional components and hooks. We avoid class components entirely. React's
  declarative nature keeps state in sync with the DOM, and the ecosystem provides robust testing and tooling.
- **Vite** – Serves as both development server and bundler. Its instant startup and on‑demand module loading keep the
  feedback loop tight. Vite also handles TypeScript and JSX out of the box.
- **PapaParse** – Streams CSV rows in workers so large files do not block the main thread. The library supports
  chunked parsing, which lets us update progress indicators while data is still loading.

### Visualization

- **Plotly.js** and **react-plotly.js** – Generate interactive charts with zooming, panning, and tooltips. We use the
  React wrapper to manage chart lifecycle and to tap into Plotly's extensive library of plot types without writing raw
  imperative code.
- **ThemedPlot** – Our own wrapper around `react-plotly.js` that injects color palettes, fonts, and responsive sizing.
  It lives in `src/components/ThemedPlot.jsx` and ensures visual consistency.

### State and Data Utilities

- **idb** – A small wrapper around IndexedDB. It powers session persistence and makes structured storage less painful
  than using the raw IndexedDB API.
- **lodash-es** – Only a few modules are imported, primarily for array grouping and deep cloning. The `-es` build allows
  tree shaking so unused helpers do not inflate bundle size.

### Testing and Quality

- **Vitest** – Provides a Jest‑like testing interface with Vite's blazing speed. Tests run in a jsdom environment and
  support modern ESM syntax.
- **@testing-library/react** – Encourages tests that resemble how users interact with the app. Queries search for text
  and roles instead of component internals.
- **ESLint & Prettier** – The flat-config `eslint.config.js` composes `@eslint/js` with the React, Testing Library, Jest DOM,
  and no-unsanitized plugins while extending `eslint-config-prettier`. Run `npm run lint` to execute the shared ruleset and
  `npm run format` to apply Prettier settings from `.prettierrc`. Formatting enforcement happens via `npm run format:check`,
  which CI and the Husky pre-commit hook both execute so style drift fails fast.

### Worker Tooling

- **Comlink** (planned) – We currently communicate with workers via raw `postMessage` calls. If message passing becomes
  unwieldy, [Comlink](https://github.com/GoogleChromeLabs/comlink) is a potential future addition to simplify remote
  procedure calls. Documenting this possibility here keeps the door open for future contributors.

### Keeping Dependencies Fresh

Routine maintenance prevents security vulnerabilities and unlocks new features. To check for outdated packages, run:

```bash
npm outdated
```

When upgrading, prefer small, isolated commits. Run the full test suite and build after each bump. For major version
changes, skim the upstream changelog and note breaking changes in `docs/developer/CHANGELOG.md` if the upgrade impacts
project behavior.

If a dependency no longer pulls its weight, open an issue discussing alternatives. We value a small surface area over a
kitchen sink of utilities.

### Development Helpers

- **Husky** – Hooks into Git to run lint, test, and build steps before commits land in the history. If a command fails,
  the commit is aborted, preventing broken code from sneaking in.
- **Lint‑staged** – Only lints and formats files that are staged for commit, keeping pre‑commit hooks speedy even in large
  repositories.

These helpers live entirely in development and do not ship in production bundles.
