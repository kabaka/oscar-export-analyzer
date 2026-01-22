# Working Directory

This directory is designated for **ephemeral subagent working documentation** during investigations, debugging, and analysis.

## Purpose

Scratch space for:

- RCA (Root Cause Analysis) notes
- Draft documentation before finalization
- Analysis explorations and hypothesis testing
- Intermediate findings during multi-step investigations

## Rules

⚠️ **Files in this directory are NEVER committed to version control**

- This directory is `.gitignore`d
- The `@readiness-reviewer` agent enforces that this directory must be empty before commits
- If documentation becomes permanent, move it to:
  - `docs/developer/` for technical documentation
  - `docs/user/` for user-facing guides
  - `docs/developer/architecture/adr/` for architectural decisions
  - `docs/developer/reports/` for formal evaluation reports

## Workflow

```text
Investigation starts
├─ Create working notes in docs/work/rca-analysis.md
├─ Perform investigation
└─ Investigation completes
   ├─ If findings are valuable → Move to proper location
   └─ If findings are temporary → Delete files
```

---

**See**: [ADR-0001: Working Directory Policy](../developer/architecture/adr/0001-working-directory-policy.md) for full context and rationale.
