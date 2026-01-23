# Developer Guide

Welcome to the engineering wing of the OSCAR Export Analyzer. If the user guide is a friendly map for explorers,
this section is the backpack full of tools, tips, and stories from the trail. Our goal is to make contributing to
the analyzer feel joyful and approachable while still providing the rigor needed for a robust open‑source project.
Whether you are here to fix a typo or to design new visualizations, start by getting a lay of the land.

## What You'll Find Here

The developer documentation is organized into a handful of chapters that mirror the way most people engage with the
codebase:

1. [Development Setup](setup.md) — installing prerequisites, running the dev server, and making the most of the
   tooling.
2. [Architecture](architecture.md) — how the pieces fit together, from React components to background workers and data
   flow.
3. [Dependencies](dependencies.md) — a tour of the libraries that power the analyzer and guidance for keeping them up
   to date.
4. [Adding Features](adding-features.md) — conventions, testing strategies, and a gentle checklist for shepherding an
   idea from sketch to pull request.

You do not need to read these documents in order. Skim the sections that match your immediate task, then come back for
a longer read when you are curious.

## Philosophy

Software for health data should be inviting and transparent. We favor small, readable modules and tests that mirror how
actual users interact with the interface. A healthy dose of comments and docs lets new contributors jump in without
having to reverse‑engineer every decision. If a function or component feels magical, sprinkle in an explanation or
link to supporting documentation.

We value empathy in code review. When you open a pull request, assume that a future you—or someone entirely new to the
project—will read it months from now. Clear commit messages, thoughtful variable names, and a few sentences in the PR
description make all the difference.

## Repository Tour

The project uses [Vite](https://vitejs.dev/) and [React](https://react.dev/) with vanilla CSS modules. A quick guide to
the top‑level directories:

- `src/` — UI components, hooks, and utility modules. Tests live next to the files they cover.
- `docs/` — user and developer documentation. The user guide walks through visualizations; the developer guide is the
  place you are reading now.
- `analysis.js` — a Node script for deeper batch analytics outside the browser.
- `dist/` — generated build output. This folder is ignored in Git; run `npm run build` to create it locally.

Browsing through `src/components` is a great way to understand how a view is assembled. Most charts share a handful of
patterns: data flows in via context hooks, each component renders a `ThemedPlot`, and an `ErrorBoundary` catches
surprises.

## Contributing Back

If you discover a rough edge, please open an issue before submitting code unless the fix is trivial. Others may be
working on the same problem, and discussing approaches up front saves time. Pull requests should follow the
[Conventional Commit](https://www.conventionalcommits.org/) style and include a brief UI note; screenshots and GIFs
will be refreshed once the updated assets are regenerated.

## Getting Help

Stuck on something? A few avenues:

- **Search the issues** – Someone may have asked the same question. Add a "+1" or a comment if you have additional
  context.
- **Discussion forums** – For broader sleep‑data conversations, the OSCAR community forums are a welcoming place to
  brainstorm ideas or gather sample data.
- **Code comments** – When a module raises questions, leave a comment or TODO in the code. Future contributors can pick
  up the thread.

## Release Workflow

We have not yet settled on a formal release cadence. In practice, merging a pull request into `main` is enough to
publish the latest build to GitHub Pages and call it a "release." If you want to highlight a milestone, feel free to
add a tag or jot a note in `CHANGELOG.md`, but none of that is required for the project to move forward.

If you spot a regression in a deployed build, open an issue and we can ship a fix with the next merge.

The rest of this developer guide dives deeper into the topics above. We hope it sparks curiosity and lowers the
barrier to entry. Happy hacking!
