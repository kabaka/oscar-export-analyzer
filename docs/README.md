# OSCAR Export Analyzer — Documentation Hub

Welcome to the documentation center for OSCAR Export Analyzer! Whether you're a first-time user trying to load CPAP data or a developer adding new visualizations, you'll find guides tailored to your needs.

## 🎯 Quick Start by Role

### I'm a User

Want to analyze your OSCAR data? Start here:

1. **[Getting Started](user/01-getting-started.md)** — Install, load CSVs, navigate the interface
2. **[Visualizations Guide](user/02-visualizations.md)** — Understand charts and what they mean
3. **[Printing & Exporting](user/09-printing-and-exporting.md)** — Save reports and share with your doctor

**Common questions?** Jump to the [FAQ](user/05-faq.md) or [Troubleshooting](user/06-troubleshooting.md).

### I'm a Developer

Contributing code or exploring the architecture? Begin with:

1. **[Development Setup](developer/setup.md)** — Install dependencies, run dev server, test workflow
2. **[Architecture](developer/architecture.md)** — Component structure, data flow, Web Workers
3. **[Adding Features](developer/adding-features.md)** — Conventions, testing, PR process

**Need details?** Check [Dependencies](developer/dependencies.md) or the [CLI Tool](developer/cli-tool.md) guide.

### I Want to Understand Statistics

Curious about the math behind AHI calculations and trend analysis?

- **[Statistical Concepts](user/04-statistical-concepts.md)** — Rolling averages, Mann-Whitney U, correlation
- **[Data Dictionary](user/03-data-dictionary.md)** — What each metric means
- **[Glossary](user/glossary.md)** — Quick reference for all terms (medical, statistical, technical)
- **[Practical Tips](user/07-practical-tips.md)** — Interpret trends, spot anomalies

## 📚 Complete Documentation Index

### User Guides

Comprehensive guides for end-users analyzing CPAP therapy data:

| Guide                                                              | Description                                                                 |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| [**01 — Getting Started**](user/01-getting-started.md)             | Installation, CSV export from OSCAR, file upload, initial navigation        |
| [**02 — Visualizations**](user/02-visualizations.md)               | Chart types, tooltips, date filtering, interpreting trends                  |
| [**03 — Data Dictionary**](user/03-data-dictionary.md)             | Definitions of AHI, EPAP, leak rate, flow limitation, and other metrics     |
| [**04 — Statistical Concepts**](user/04-statistical-concepts.md)   | Explained: rolling averages, Mann-Whitney U test, correlation coefficients  |
| [**05 — FAQ**](user/05-faq.md)                                     | Frequently asked questions about data storage, parsing, and results         |
| [**06 — Troubleshooting**](user/06-troubleshooting.md)             | Common issues and solutions for file loading, performance, display problems |
| [**07 — Practical Tips**](user/07-practical-tips.md)               | Best practices for analyzing therapy data and spotting patterns             |
| [**08 — Disclaimers**](user/08-disclaimers.md)                     | Medical disclaimers, privacy policies, intended use limitations             |
| [**09 — Printing & Exporting**](user/09-printing-and-exporting.md) | Generate PDFs, export sessions, save CSV aggregates for spreadsheets        |
| [**10 — Progressive Web App**](user/10-progressive-web-app.md)     | Install as app, offline usage, cross-device session transfer                |
| [**11 — Wearable Integration**](user/11-wearable-integration.md)   | Import a local Google Health (Fitbit) export, correlation analysis, privacy |
| [**Glossary**](user/glossary.md)                                   | Comprehensive reference for medical, statistical, and technical terms       |

### Developer Guides

Technical documentation for contributors and maintainers:

| Guide                                                         | Description                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [**Developer Overview**](developer/README.md)                 | Philosophy, repository tour, contributing guidelines                                  |
| [**Setup**](developer/setup.md)                               | Node.js installation, dependency management, running tests and dev server             |
| [**Architecture**](developer/architecture.md)                 | System design, component hierarchy, state management, Web Workers, Mermaid diagrams   |
| [**Dependencies**](developer/dependencies.md)                 | Why we use React, Vite, Plotly, Vitest, Papa Parse, and other libraries               |
| [**Adding Features**](developer/adding-features.md)           | Step-by-step guide to implementing new visualizations and analysis modules            |
| [**Testing Patterns**](developer/testing-patterns.md)         | Vitest, Testing Library, Web Workers, accessibility, synthetic test data              |
| [**Accessibility**](developer/accessibility.md)               | WCAG 2.1 AA compliance, keyboard navigation, screen reader support                    |
| [**Wearable Integration**](developer/wearable-integration.md) | Local export ingestion, aggregation pipeline, correlation analytics, privacy boundary |
| [**CLI Tool**](developer/cli-tool.md)                         | Command-line analysis tool for batch processing and scripting                         |

### Specialized Documentation

Deep dives into specific topics:

| Document                                                | Description                                                                |
| ------------------------------------------------------- | -------------------------------------------------------------------------- |
| [**Magic Numbers Playbook**](magic-numbers-playbook.md) | Strategy for eliminating hardcoded constants and improving maintainability |

### Repository Root Documentation

Core project files:

| Document                                  | Description                                                   |
| ----------------------------------------- | ------------------------------------------------------------- |
| [**README.md**](../README.md)             | Project overview, installation, quick start, features         |
| [**CONTRIBUTING.md**](../CONTRIBUTING.md) | How to contribute: code style, commit conventions, PR process |
| [**AGENTS.md**](../AGENTS.md)             | Guide for AI agents collaborating on the project              |
| [**TODO.md**](../TODO.md)                 | Planned features, known issues, future enhancements           |
| [**LICENSE**](../LICENSE)                 | MIT License terms                                             |

## 🧭 Documentation by Task

### Common Tasks

**Loading and Exploring Data:**

- Export CSVs from OSCAR → [Getting Started § Preparing Data](user/01-getting-started.md#1-preparing-your-data)
- Upload files → [Getting Started § Loading Files](user/01-getting-started.md#2-loading-files-into-the-analyzer)
- Understand charts → [Visualizations Guide](user/02-visualizations.md)
- Filter by date → [Visualizations § Date Filtering](user/02-visualizations.md)

**Analyzing Results:**

- Compare two time periods → [Visualizations § Range Comparisons](user/02-visualizations.md)
- Interpret AHI trends → [Statistical Concepts](user/04-statistical-concepts.md)
- Detect apnea clusters → [Visualizations § Clusters](user/02-visualizations.md)
- Spot anomalies → [Practical Tips](user/07-practical-tips.md)

**Saving and Sharing:**

- Print PDF report → [Printing & Exporting § Printing](user/09-printing-and-exporting.md#printing-reports)
- Export session for backup → [Printing & Exporting § Sessions](user/09-printing-and-exporting.md#exporting-session-data)
- Generate CSV for Excel → [Printing & Exporting § Aggregates](user/09-printing-and-exporting.md#exporting-csv-aggregates)

**Troubleshooting:**

- File won't parse → [Troubleshooting](user/06-troubleshooting.md)
- Page freezes on large file → [FAQ § Large CSVs](user/05-faq.md)
- Charts are empty → [FAQ § Empty Charts](user/05-faq.md)
- Print PDF issues → [Printing & Exporting § Troubleshooting](user/09-printing-and-exporting.md#troubleshooting)

### Development Tasks

**Getting Started with Development:**

- Set up local environment → [Setup](developer/setup.md)
- Run dev server → [Setup § Running](developer/setup.md)
- Run tests → [Setup § Testing](developer/setup.md)
- Understand project structure → [Architecture](developer/architecture.md)

**Adding New Features:**

- Create new visualization → [Adding Features](developer/adding-features.md)
- Add new statistical test → [Adding Features § Analytics](developer/adding-features.md)
- Write tests → [Adding Features § Testing](developer/adding-features.md)
- Update documentation → [Adding Features § Docs](developer/adding-features.md)

**Using Development Tools:**

- CLI analysis tool → [CLI Tool](developer/cli-tool.md)
- Batch processing → [CLI Tool § Scripting](developer/cli-tool.md)
- Clustering algorithms → [CLI Tool § Algorithms](developer/cli-tool.md)

**Understanding the Codebase:**

- Component hierarchy → [Architecture § Component Structure](developer/architecture.md#component-structure)
- State management → [Architecture § State and Persistence](developer/architecture.md#state-and-persistence)
- Web Workers → [Architecture § High-Level Flow](developer/architecture.md#highlevel-flow)
- Data flow diagrams → [Architecture § Mermaid Diagrams](developer/architecture.md)

## 🔍 Search Tips

If you're looking for specific information:

1. **Use your browser's find function** (`Ctrl+F` / `Cmd+F`) on this page to search headings
2. **Check the FAQ first** — Common questions are answered in [FAQ](user/05-faq.md)
3. **Look in the glossary** — Medical terms are defined in [Data Dictionary](user/03-data-dictionary.md)
4. **Search the repository** — Use GitHub's search or `grep` in your local clone
5. **Check inline code comments** — Many functions have detailed JSDoc documentation

## 📖 Documentation Style Guide

OSCAR Export Analyzer documentation follows these principles:

- **Conversational but technically accurate** — We explain complex concepts without dumbing them down
- **Examples over abstractions** — Show concrete use cases rather than theoretical possibilities
- **Friendly to both humans and AI agents** — Clear structure helps everyone find information
- **Privacy-conscious** — Never include real patient data in examples
- **Maintained alongside code** — Docs are updated in the same PR as code changes

When contributing documentation:

- Use Markdown formatting for readability
- Include code examples for technical content
- Cross-reference related documentation
- Add entries to this index when creating new guides
- Test all examples and command-line snippets

See [CONTRIBUTING.md](../CONTRIBUTING.md) for full documentation standards.

## 🤝 Contributing to Documentation

Found a typo? Want to add an example? Documentation improvements are welcome!

**Small fixes** (typos, broken links, clarifications):

- Open a PR with the fix directly
- No need to open an issue first

**Larger additions** (new guides, major rewrites):

- Open an issue to discuss the proposal
- Get feedback on structure and scope
- Write the guide and open a PR
- Include your new guide in this index

**Need help?** Ask in GitHub issues or discussions. Documentation contributions are valued as much as code contributions!

## 📜 License and Disclaimers

- **Code and Documentation**: MIT License — see [LICENSE](../LICENSE)
- **Medical Disclaimer**: This tool is for informational purposes only. See [Disclaimers](user/08-disclaimers.md)
- **Privacy**: All processing happens locally in your browser. See [Disclaimers § Privacy](user/08-disclaimers.md#data-privacy)

---

**Last updated**: January 2026  
**Feedback?** Open an issue on [GitHub](https://github.com/kabaka/oscar-export-analyzer/issues) or contribute improvements via pull request!
