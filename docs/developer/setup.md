## Development Setup

The analyzer is a standard Vite + React project, but a few niceties make day‑to‑day work smoother. This chapter walks
through a fresh setup and highlights tools that keep feedback loops fast.

### Prerequisites

1. **Node.js 20** – The project targets the current LTS release. Using older versions often leads to cryptic build
   errors or failing tests. You can manage multiple Node versions with [nvm](https://github.com/nvm-sh/nvm).
2. **npm** – Installed alongside Node. We commit a `package-lock.json` to lock dependency versions, so please use npm
   rather than yarn or pnpm to avoid drift.
3. **Git** – Any modern release works. Clone the repository and ensure you have a GitHub account if you plan to submit
   pull requests.

### Installing Dependencies

After cloning the repo, install dependencies with:

```bash
npm install
```

This command also sets up Husky hooks for linting and tests. If Husky fails to install, run `npm run prepare` manually.

### Running the App Locally

Start the development server with hot module replacement:

```bash
npm run dev
```

By default Vite serves the app at <http://localhost:5173>. The terminal prints a QR code that you can scan with a
mobile device for quick testing on tablets or phones. The server automatically restarts when you save a file, but
changes to configuration files like `vite.config.js` require a manual restart.

### Testing and Linting

We use [Vitest](https://vitest.dev/) and [Testing Library](https://testing-library.com/) for unit and integration tests.
Execute the full suite once with:

```bash
npm test -- --run
```

During development, `npm test` launches Vitest in watch mode. ESLint keeps JavaScript and JSX tidy:

```bash
npm run lint
```

Prettier formats Markdown, CSS, and code:

```bash
npm run format
```

Run these commands before committing. Husky executes them as part of the pre‑commit hook, but catching problems early
saves time.

### Building for Production

Create a production bundle with:

```bash
npm run build
```

The output lands in the `dist/` directory. To inspect the production build locally, run:

```bash
npm run preview
```

Vite serves the optimized bundle so you can sanity‑check assets and network requests without deploying anywhere.

### Recommended Editor Setup

- **VS Code** with the official ESLint and Prettier extensions keeps the editor in sync with project config.
- Enable "format on save" to automatically apply Prettier to Markdown and code files.
- For faster navigation, install the "Path Autocomplete" extension to suggest import paths as you type.

### Environment Tips

- The app has no environment‑specific configuration beyond the Node version. If you need to tweak build behavior, see
  `vite.config.js`.
- When debugging workers, open the browser's dev tools and check the "Sources" panel under `Workers` for logs and stack
  traces.
- Some tests rely on jsdom features that lag behind real browsers. If a test fails in jsdom but works in Chromium,
  document the difference in a comment and link to upstream issues when possible.

With the basics in place, dive into the [architecture](architecture.md) chapter to understand how data flows through the
app.

### Continuous Integration

GitHub Actions runs the same lint, test, and build commands on every pull request. If the pipeline fails, check the
logs for stack traces or linter messages. Reproducing the failing command locally is usually the fastest way to fix the
issue.

### Troubleshooting

- **`npm install` fails on optional dependencies** – Try updating npm (`npm install -g npm`) or clearing the cache with
  `npm cache clean --force`.
- **Port 5173 already in use** – Another Vite server might be running. Stop the existing process or specify a different
  port with `npm run dev -- --port=5174`.
- **Tests hang** – Ensure no lingering browser window or watch process is running. Adding `--run` makes the suite
  execute once and exit.

Once your environment hums along, you're ready to explore the rest of the developer guide.
