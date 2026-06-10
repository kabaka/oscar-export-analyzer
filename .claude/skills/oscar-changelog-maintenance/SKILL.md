---
name: oscar-changelog-maintenance
description: Maintain CHANGELOG.md following Keep a Changelog format with date-based versioning. Use when making user-facing or contributor-facing changes to determine if CHANGELOG update is required.
---

# OSCAR CHANGELOG Maintenance

OSCAR Export Analyzer follows [Keep a Changelog](https://keepachangelog.com/) format with **date-based versioning** because the main branch deploys immediately to GitHub Pages with no staging environment.

## When to Update CHANGELOG

**Requires CHANGELOG entry (✅):**

- New features or visualizations users interact with
- Breaking changes to data formats, APIs, or workflows
- Significant UI/UX improvements
- Performance improvements users would notice
- Bug fixes affecting user experience
- Documentation additions helping users/developers
- Security or privacy enhancements
- Dependency updates changing behavior

**Does NOT require entry (❌):**

- Internal refactors without user impact
- Test additions (unless documenting new coverage)
- Code organization changes
- Typo fixes in code comments
- CI/CD changes (unless affecting contributors)

## Format and Structure

### Date-Based Sections

The project uses **today's date** as the version identifier:

```markdown
## [2026-02-07]

### Added

- Feature description ([#123](link-to-issue-or-pr))
- Another feature description

### Fixed

- Bug fix description ([#124](link-to-issue-or-pr))
```

**Key points:**

- No "Unreleased" section—add directly to today's date
- Create today's section if it doesn't exist
- Use ISO date format: `YYYY-MM-DD`
- Each deployment date gets its own section

### Categories

Use these standard categories (in order):

```markdown
## [YYYY-MM-DD]

### Added

New features, visualizations, analysis capabilities, documentation

### Changed

Modifications to existing functionality, UI/UX improvements, dependency updates that change behavior

### Deprecated

Features marked for removal in future versions

### Removed

Deleted features or breaking changes

### Fixed

Bug fixes, performance improvements, error handling

### Security

Security fixes, privacy enhancements, vulnerability patches
```

## Entry Format

**Good entries:**

```markdown
### Added

- Apnea cluster detection with FLG bridging and edge extension ([#45](link))
- Dark mode support with automatic theme switching
- PDF export with customizable date ranges

### Fixed

- Date filter now correctly handles single-day selections ([#67](link))
- Web Worker fallback when SharedArrayBuffer unavailable
- Chart zoom persistence across date range changes
```

**Bad entries (too vague):**

```markdown
### Added

- New feature
- Improvements to charts

### Fixed

- Various bug fixes
- Updated dependencies
```

## Workflow for Agents

**When making changes:**

1. Determine if change is user-facing or impacts contributors
2. If yes, check what today's date is: `date +"%Y-%m-%d"`
3. Open `CHANGELOG.md` and find or create today's section
4. Add entry under appropriate category
5. Use present tense, be concise but descriptive
6. Include issue/PR link if available

**Example agent workflow:**

```bash
# Get today's date
$ date +"%Y-%m-%d"
2026-02-07

# Check if section exists
$ grep "## \[2026-02-07\]" CHANGELOG.md
# (empty result = section doesn't exist)

# Add new section if needed, then add entry
```

**Multi-commit work:**

If working on a feature across multiple commits, add CHANGELOG entry in the **final commit** when feature is complete, not incrementally.

## Examples from Project History

**Example 1: New Feature**

```markdown
## [2026-01-23]

### Added

- Event cluster detection algorithm with configurable gap threshold, FLG bridging, and boundary extension based on Flow Limitation readings ([#42](https://github.com/kabaka/oscar-export-analyzer/issues/42))
- False negative detection scoring system comparing annotation clusters to FLG-detected periods with confidence intervals
```

**Example 2: Bug Fix**

```markdown
## [2026-01-15]

### Fixed

- Date range filter now correctly excludes boundary dates when using strict mode
- Web Worker CSV parsing fallback when SharedArrayBuffer is unavailable in Firefox
```

**Example 3: UI Improvement**

```markdown
## [2026-01-10]

### Changed

- Improved chart zoom responsiveness with debounced re-rendering
- Updated color palette for better WCAG AA contrast compliance
```

**Example 4: Security Enhancement**

```markdown
## [2026-01-05]

### Security

- Added encrypted token storage for Fitbit OAuth with user-provided passphrase
- Implemented automatic token refresh with secure session management
```

## Common Mistakes to Avoid

**❌ Forgetting to update:**

Many agents forget CHANGELOG when making user-facing changes. Always check before committing.

**❌ Using "Unreleased":**

This project uses date-based sections, not "Unreleased".

**❌ Entries too technical:**

Write for users, not just developers. Explain impact, not implementation.

```markdown
<!-- ❌ Too technical -->

- Refactored useDateRangeFilter hook to use useCallback

<!-- ✅ User-friendly -->

- Improved date filtering performance for large datasets
```

**❌ Missing context:**

```markdown
<!-- ❌ Missing context -->

- Fixed bug

<!-- ✅ Clear context -->

- Fixed crash when uploading CSV with missing date column
```

## Version Releases

When creating a GitHub release:

1. Copy the relevant date section(s) from CHANGELOG.md
2. Tag format: `YYYY-MM-DD` (e.g., `2026-02-07`)
3. Release title: Same as tag
4. Release body: CHANGELOG entries for that date

## Integration with Readiness Reviewer

The `@readiness-reviewer` agent enforces CHANGELOG updates:

- Checks if user-facing changes were made
- Verifies CHANGELOG.md includes today's date section
- Blocks merge if CHANGELOG not updated

If reviewer flags missing CHANGELOG entry, add it before merge.

## Quick Reference

```bash
# Check if today's section exists
grep "## \[$(date +"%Y-%m-%d")\]" CHANGELOG.md

# Add today's section if missing
echo -e "\n## [$(date +"%Y-%m-%d")]\n\n### Added\n\n- " >> CHANGELOG.md

# View recent entries
head -n 50 CHANGELOG.md
```

## Resources

- **Project CHANGELOG**: `CHANGELOG.md` in repository root
- **Keep a Changelog spec**: https://keepachangelog.com/
- **Readiness reviewer**: Enforces CHANGELOG compliance
