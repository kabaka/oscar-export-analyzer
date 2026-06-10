# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) documenting significant architectural and technical choices in OSCAR Export Analyzer.

## What is an ADR?

An ADR captures a single architectural decision along with its context, consequences, and alternatives considered. ADRs help preserve the reasoning behind important technical choices for future contributors and AI agents.

## When to Create an ADR

Document decisions that are:

- **Difficult to reverse** (e.g., choice of build tool, framework)
- **Affect multiple components** (e.g., state management pattern)
- **Involve significant trade-offs** (e.g., local-first vs cloud architecture)
- **Set project-wide constraints** (e.g., styling approach, testing strategy)

## ADR List

| ADR                                                                 | Title                                                     | Status   | Date       |
| ------------------------------------------------------------------- | --------------------------------------------------------- | -------- | ---------- |
| [0001](0001-working-directory-policy.md)                            | Working Directory Policy for Subagent Ephemeral Files     | Accepted | 2026-01-22 |
| [0002](0002-progressive-web-app-implementation.md)                  | Progressive Web App (PWA) Implementation                  | Accepted | 2026-01-24 |
| [0003](0003-replace-fitbit-oauth-with-local-export-ingestion.md)    | Replace Fitbit OAuth/API with Local Export Ingestion      | Proposed | 2026-06-10 |
| [0004](0004-ingest-and-aggregate-wearable-data-to-indexeddb.md)     | Ingest-and-Aggregate Wearable Data to IndexedDB           | Proposed | 2026-06-10 |
| [0005](0005-wearable-export-file-access-and-privacy-boundary.md)    | Wearable Export File Access, Handle Persistence & Privacy | Proposed | 2026-06-10 |
| [0006](0006-wearable-cpap-alignment-and-correlation-methodology.md) | Wearable↔CPAP Alignment & Correlation Methodology        | Proposed | 2026-06-10 |

## ADR Template

See `@adr-specialist` agent documentation for the standard ADR template and guidelines.

## Process

1. **Identify a decision** that needs documentation
2. **Check existing ADRs** to avoid duplication
3. **Draft the ADR** following the template (context, decision, consequences, alternatives)
4. **Review with stakeholders** (human maintainer or relevant agents)
5. **Merge as "Accepted"** once finalized

## Status Values

- **Proposed**: Under consideration, not yet finalized
- **Accepted**: Decision has been made and implemented
- **Deprecated**: No longer relevant (include superseding ADR reference)
- **Superseded**: Replaced by a newer decision (link to new ADR)

---

**See Also**:

- [Architecture Overview](../architecture.md)
- [AGENTS.md](../../../../AGENTS.md) — Agent coordination and workflows
- `.github/agents/adr-specialist.agent.md` — ADR specialist agent documentation
