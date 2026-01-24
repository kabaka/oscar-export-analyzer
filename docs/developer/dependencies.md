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

### Progressive Web App (PWA)

- **vite-plugin-pwa** – Generates service worker and web app manifest for offline capability and installability. Integrates with Vite's build process to inject service worker registration code and cache static assets. Provides development utilities for testing PWA features in production builds.
- **workbox-window** – Client-side library for service worker lifecycle management. Powers update notifications by detecting when new service workers are available. Provides hooks for controlling when updates are applied (user-controlled, no forced reloads).

**Why these choices**:

- **vite-plugin-pwa**: Industry-standard PWA plugin for Vite with excellent Workbox integration. Handles complex service worker generation, manifest creation, and asset precaching automatically. Supports multiple caching strategies and has comprehensive documentation.
- **workbox-window**: Official Workbox library for service worker communication from the main thread. Provides clean API for detecting updates, managing registrations, and controlling update flow. Smaller and more focused than full Workbox runtime.

**Bundle impact**: ~8 KB gzipped for workbox-window (service worker itself is separate and loaded lazily). Total PWA overhead is ~20 KB (4.2% of bundle)—acceptable for features gained.

**Alternatives considered**:

- **Manual service worker**: Would avoid dependencies but require implementing caching strategies, update detection, and lifecycle management from scratch. Workbox provides battle-tested patterns.
- **workbox-build**: Lower-level Workbox API for custom builds. Chosen vite-plugin-pwa instead for better Vite integration and simpler configuration.
- **@vite-pwa/sveltekit** / **@vite-pwa/nuxt**: Framework-specific PWA plugins. Not applicable (we use vanilla Vite + React).

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

---

## See Also

- [Architecture](architecture.md) — See how these dependencies fit into the overall system design
- [Development Setup](setup.md) — Installation and configuration for local development
- [Testing Patterns](testing-patterns.md) — How testing libraries are used in practice
- [Adding Features](adding-features.md) — Choosing appropriate libraries for new features

---
