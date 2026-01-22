# Temporary Files Directory

This directory is designated for **temporary scripts and files** created by subagents during development.

## Purpose

Temporary location for:

- One-off diagnostic scripts
- Temporary test data generators
- Intermediate data files during analysis
- Quick utilities for debugging

## Rules

⚠️ **Files in this directory are NEVER committed to version control**

- This directory is `.gitignore`d
- The `@readiness-reviewer` agent enforces that this directory must be empty before commits
- If scripts become useful, move them to:
  - `scripts/` for project utilities
  - `src/test-utils/` for testing utilities
  - Appropriate source directories if they become permanent features

## Workflow

```text
Development starts
├─ Create test script in temp/diagnostic.js
├─ Run experiments
└─ Development completes
   ├─ If script is useful → Move to proper location
   └─ If script is temporary → Delete files
```

---

**See**: [ADR-0001: Working Directory Policy](docs/developer/architecture/adr/0001-working-directory-policy.md) for full context and rationale.
