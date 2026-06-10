> **⚠️ Superseded / abandoned approach.** These January 2026 documents plan a
> **Fitbit OAuth + Web API** integration that was **never shipped in its final
> form and has since been abandoned**. The OAuth/API approach was replaced by
> **local Google Health (formerly Fitbit) export ingestion**.
>
> See instead:
>
> - [2026-06 Wearable Export Ingestion — Planning Archive](../2026-06-wearable-export-planning/README.md) — the planning that supersedes this directory.
> - [ADR-0003 — Replace Fitbit OAuth/API with Local Export Ingestion](../../architecture/adr/0003-replace-fitbit-oauth-with-local-export-ingestion.md) — the decision record explaining why the OAuth approach was dropped.
>
> The documents below are retained only for historical context (the original
> data-science, visualization, architecture, and security/privacy rationale).
> Do **not** treat them as describing current or intended behavior — the app has
> no OAuth flow, tokens, or network calls to any wearable service.

# 2026-01 Fitbit OAuth Integration — Planning (Abandoned)

Original planning artifacts for the proposed Fitbit OAuth / Web API integration.
This approach was abandoned in favor of local export ingestion (see the note above).

## Contents

| Document                                                               | Description                                                          |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [00-executive-summary.md](00-executive-summary.md)                     | Executive summary of the proposed OAuth/API integration.             |
| [01-data-science-analysis.md](01-data-science-analysis.md)             | Data-science analysis of available Fitbit metrics and correlations.  |
| [02-visualization-design.md](02-visualization-design.md)               | Visualization design for the proposed Fitbit correlation views.      |
| [03-technical-architecture.md](03-technical-architecture.md)           | Technical architecture for the OAuth/API client (abandoned).         |
| [04-security-privacy-assessment.md](04-security-privacy-assessment.md) | Security & privacy assessment of the OAuth/token flow (now removed). |
