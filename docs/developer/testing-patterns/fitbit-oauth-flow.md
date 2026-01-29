# Fitbit OAuth Flow Test Plan

## Overview

This document outlines the test strategy and coordination for the Fitbit OAuth flow in OSCAR Export Analyzer. All tests use synthetic data/builders and avoid real tokens or PHI.

## Test Scenarios

### 1. Prompt for Passphrase After OAuth

- **Scenario:** After OAuth, if `fitbit_tokens` exist but passphrase is missing, user is prompted to re-enter passphrase.
- **Setup:** Simulate session state with tokens in storage but no passphrase.
- **Assertion:** Passphrase prompt/modal is shown.

### 2. Auto-Connect with Passphrase Present

- **Scenario:** If passphrase is present in `sessionStorage`, app auto-connects and displays Fitbit data/charts.
- **Setup:** Mock `sessionStorage` with both tokens and passphrase.
- **Assertion:** Fitbit charts/data are visible without manual input.

### 3. Fitbit Section Loads Data/Charts After Connection

- **Scenario:** After successful connection, Fitbit section loads and displays data/charts.
- **Setup:** Simulate connection and inject synthetic Fitbit data.
- **Assertion:** Charts render with expected synthetic data.

## Data & Privacy

- Use only synthetic test data/builders (see `src/test-utils/builders.js`).
- No real tokens, PHI, or user data in tests or documentation.

## Coordination

- **Frontend-developer:**
  - Provide test hooks/mocks for session state, OAuth callback, and synthetic Fitbit data injection if needed.
  - Ensure testability of passphrase prompt and chart rendering.
- **UX-designer:**
  - Validate accessibility and clarity of passphrase prompt/modal.
  - Review chart accessibility and ARIA attributes in Fitbit section.

## Temporary Artifacts

- This file is now permanent. Remove the temporary version from docs/work/testing/.
