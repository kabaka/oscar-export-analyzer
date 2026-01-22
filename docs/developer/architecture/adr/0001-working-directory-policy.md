# ADR-0001: Working Directory Policy for Subagent Ephemeral Files

**Date**: January 22, 2026  
**Status**: Accepted

---

## Context

OSCAR Export Analyzer is developed primarily by AI agents (GitHub Copilot subagents) with human guidance. During their work, subagents often create temporary documentation and files:

- **RCA (Root Cause Analysis) notes**: Debugging investigations, test results, hypotheses
- **Analysis drafts**: Data exploration, statistical validation, intermediate findings
- **Temporary scripts**: One-off utilities, test data generators, diagnostic tools
- **Working notes**: In-progress documentation before it's finalized

Currently, these ephemeral files present several problems:

1. **No designated location**: Subagents create files in `/tmp`, which requires manual user approval in VS Code for each access
2. **Accidental commits**: Working documentation ends up in `docs/work/debugging/` and risks being committed, confusing future contributors
3. **Workspace clutter**: Temporary files scattered across the project without clear cleanup policy
4. **Context confusion**: Human contributors stumble upon ephemeral investigation notes and mistake them for permanent documentation
5. **No enforcement**: Nothing prevents temporary files from being committed to version control

The project needs a clear policy for where subagents should place ephemeral files and how to enforce cleanup before commits.

---

## Decision

We establish **two designated directories for ephemeral subagent files**, both excluded from version control:

### 1. `docs/work/` — Subagent Working Documentation

**Purpose**: Scratch space for subagent investigation notes, RCA analysis, draft documentation, and intermediate findings.

**Usage**:

- RCA notes during debugging sessions
- Draft documentation before moving to permanent locations
- Analysis explorations and hypothesis testing
- Intermediate findings during multi-step investigations

**Rules**:

- Files in `docs/work/` are **never committed** to version control
- If documentation becomes permanent, it must be moved to proper locations:
  - `docs/developer/` for technical documentation
  - `docs/user/` for user-facing guides
  - `docs/developer/architecture/adr/` for architectural decisions
  - `docs/developer/reports/` for formal evaluation reports

### 2. `temp/` — Temporary Scripts and Files

**Purpose**: Temporary scripts, test data, diagnostic utilities, and other non-documentation files created by subagents.

**Usage**:

- One-off diagnostic scripts
- Temporary test data generators
- Intermediate data files during analysis
- Quick utilities for debugging

**Rules**:

- Files in `temp/` are **never committed** to version control
- Scripts that become useful should be moved to:
  - `scripts/` for project utilities
  - `src/test-utils/` for testing utilities
  - Appropriate source directories if they become permanent features

### 3. Enforcement

Both directories are:

1. **Added to `.gitignore`** to prevent accidental staging
2. **Checked by `@readiness-reviewer`** agent — both directories must be empty before allowing commits
3. **Documented in AGENTS.md** so subagents know where to place ephemeral files
4. **Documented in developer docs** so human contributors understand the policy

### 4. Workflow

When a subagent needs to create ephemeral files:

```text
Investigation starts
├─ Create working notes in docs/work/rca-analysis.md
├─ Create test script in temp/diagnostic.js
├─ Perform investigation
└─ Investigation completes
   ├─ If findings are valuable → Move to proper location
   ├─ If findings are temporary → Delete files
   └─ Readiness check enforces: docs/work/ and temp/ must be empty
```

---

## Consequences

### Positive

- **Predictable locations**: Subagents know exactly where to place ephemeral files without requiring user approval
- **Clean commits**: Pre-commit checks enforce cleanup, preventing ephemeral files from polluting version control
- **No confusion**: Human contributors won't mistake temporary investigation notes for permanent documentation
- **Better organization**: Clear separation between ephemeral and permanent files
- **Faster workflow**: No repeated VS Code approval dialogs for `/tmp` access
- **Context preservation**: Subagents can preserve context during long investigations without cluttering permanent docs
- **Enforced cleanup**: Automated checks ensure temporary files don't accumulate
- **Clear graduation path**: Process for promoting useful temporary files to permanent locations

### Negative

- **Strict pre-commit checks**: Requires discipline to clean up working directories before committing
- **Lost context**: Ephemeral files deleted after investigation; must manually preserve valuable findings
- **Two locations**: Adds slight cognitive overhead (documentation vs. scripts)
- **Manual migration**: Useful temporary files must be manually moved to permanent locations
- **Enforcement complexity**: `@readiness-reviewer` must check directory emptiness

### Mitigations

- Pre-commit checks provide clear error messages about which files need cleanup
- Subagent instructions emphasize moving valuable findings to permanent locations before cleanup
- Documentation makes the policy explicit and easy to follow
- Two-directory approach is simple and intuitive (docs vs. code)

---

## Alternatives Considered

### Alternative A: Use `/tmp` for All Temporary Files

**Pros**:

- Standard OS location for temporary files
- Automatically cleaned by system
- No project-specific directories needed

**Cons**:

- Requires VS Code user approval for each access (breaks agent workflow)
- Files outside project directory (harder to find and review)
- No separation between documentation and scripts
- Automatic cleanup happens unpredictably
- Not tracked by version control system (can't see in `.gitignore`)

**Why not chosen**: VS Code approval dialogs break subagent workflow; files outside project context are harder to manage.

---

### Alternative B: Allow Temporary Files in Any Location with Naming Convention

**Pros**:

- Flexibility for subagents
- No prescribed directory structure
- Files stay contextually near related code

**Cons**:

- High risk of accidental commits
- Scattered temporary files hard to track
- `.gitignore` patterns become complex and error-prone
- No clear cleanup policy
- Naming conventions easily forgotten or violated

**Why not chosen**: Too error-prone; centralized locations provide better organization and enforcement.

---

### Alternative C: Create Nested Subdirectories (e.g., `temp/scripts/`, `temp/data/`, `temp/docs/`)

**Pros**:

- Better organization within temporary space
- Clear categorization of ephemeral files
- Single root directory (`temp/`)

**Cons**:

- Added complexity for simple use case
- Forces premature organization of temporary files
- `docs/work/` location is more intuitive for documentation
- Cognitive overhead for directory structure

**Why not chosen**: Current project size doesn't justify the complexity; two top-level directories are sufficient and intuitive.

---

### Alternative D: Git-ignore Individual Files Instead of Directories

**Pros**:

- Allows subagents to place temporary files anywhere
- More flexible placement

**Cons**:

- Difficult to enforce comprehensively
- `.gitignore` becomes unwieldy
- Easy to forget to add new files
- No clear cleanup policy or enforcement point
- Pre-commit checks much harder to implement

**Why not chosen**: Directory-level exclusion is more robust and easier to enforce.

---

### Alternative E: Allow Commits of Temporary Files to Feature Branches, Strip Before Merge

**Pros**:

- Preserves investigation context in branch history
- Subagents don't need to clean up during development
- Can review ephemeral files during PR review

**Cons**:

- Pollutes Git history with temporary files
- Requires manual cleanup step before merge
- Confuses contributors reviewing branches
- Increases repository size unnecessarily
- Complicates branch management

**Why not chosen**: Clean commits are more valuable than preserving ephemeral context; keep repository lean and focused.

---

## Implementation

### 1. Update `.gitignore`

```gitignore
# Subagent working directories
docs/work/
temp/
```

### 2. Update `AGENTS.md`

Add guidance for subagents:

```markdown
## Ephemeral Files Policy

When creating temporary files during investigations:

- Place working documentation in `docs/work/`
- Place temporary scripts/data in `temp/`
- Both directories are git-ignored
- Clean up before committing (enforced by @readiness-reviewer)
- Move valuable findings to permanent locations
```

### 3. Update `@readiness-reviewer` Agent

Add check to verify both directories are empty before allowing commits.

### 4. Document in Developer Guides

Update [docs/developer/README.md](../../README.md) with the policy.

---

## References

- [AGENTS.md](../../../../AGENTS.md) — Subagent coordination and workflows
- [docs/developer/README.md](../../README.md) — Developer documentation
- `.github/agents/readiness-reviewer.agent.md` — Pre-commit quality gate
- [ADR Template](.github/agents/adr-specialist.agent.md) — ADR format and guidelines
