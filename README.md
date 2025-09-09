# OSCAR Export Analyzer

[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

React application for exploring and visualizing OSCAR sleep data exports.

## Table of Contents
- [Features](#features)
- [Quick Start](#quick-start)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Features
- Upload Summary and optional Details CSV files.
- Interactive charts for usage, AHI trends, pressure correlation, clusters, and more.
- Built-in guide with statistical explanations.
- Optional local session storage for offline work.

## Quick Start
1. Install [Node.js 20](https://nodejs.org/) and npm.
2. Install dependencies and start a dev server:
   ```bash
   npm install
   npm run dev
   ```
3. Open the URL printed in the terminal (usually http://localhost:5173) and select your OSCAR CSV files using the file inputs.

## Documentation
Detailed guides live in the [`docs`](./docs) directory:
- [User documentation](docs/user/01-getting-started.md)
- [Developer documentation](docs/developer/README.md)

## Contributing
Run `npm run lint` and `npm test -- --run` before committing. See the [Developer Guide](docs/developer/README.md) for project structure and contribution tips.

## License
Distributed under the [MIT License](LICENSE).
