# 2026-06 Wearable Export Ingestion — Planning Archive

These are the **permanent planning artifacts** for the June 2026 rework that replaced
the Fitbit OAuth/API integration with local Google Health (formerly Fitbit) export
ingestion. They were migrated out of `docs/work/` (which is gitignored and must be empty
before a merge) so the decisions they capture survive for future maintainers and AI
agents.

The strategic and methodological decisions are recorded in the ADRs, which cross-reference
the documents here:

- [ADR-0003 — Replace Fitbit OAuth/API with Local Export Ingestion](../../architecture/adr/0003-replace-fitbit-oauth-with-local-export-ingestion.md)
- [ADR-0004 — Ingest and Aggregate Wearable Data to IndexedDB](../../architecture/adr/0004-ingest-and-aggregate-wearable-data-to-indexeddb.md)
- [ADR-0005 — Wearable Export File Access & Privacy Boundary](../../architecture/adr/0005-wearable-export-file-access-and-privacy-boundary.md)
- [ADR-0006 — Wearable↔CPAP Alignment & Correlation Methodology](../../architecture/adr/0006-wearable-cpap-alignment-and-correlation-methodology.md)

## Contents

| Document                                                                     | Description                                                                                         |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [data-catalog.md](data-catalog.md)                                           | Reconnaissance of a real Google Health (Fitbit) export: directory structure, schemas, data quality. |
| [design/data-model-and-correlation.md](design/data-model-and-correlation.md) | `WearableNight` data model, alignment, and correlation engine design.                               |
| [design/perf-storage-architecture.md](design/perf-storage-architecture.md)   | Streaming-ingest performance and IndexedDB storage architecture.                                    |
| [design/integration-and-ux.md](design/integration-and-ux.md)                 | Feature integration, component structure, and UX flow.                                              |
| [design/privacy-security.md](design/privacy-security.md)                     | Privacy and security architecture for local export ingestion.                                       |
| [security-audit-implementation.md](security-audit-implementation.md)         | Security & privacy audit of the implemented ingestion path (CSP, egress guard, allowlist, no-PHI).  |

> **Note:** The ephemeral adversarial red-team review notes and convergence audit that
> accompanied these design docs were working documents and were not retained; their
> conclusions are folded into the design docs above and into the ADRs.
