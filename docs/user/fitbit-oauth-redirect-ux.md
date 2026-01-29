# Fitbit OAuth Redirect UX Patterns

## Passphrase Prompt After OAuth Redirect

- If the user's passphrase is missing after OAuth redirect, the UI prompts: "Please re-enter your passphrase to complete Fitbit connection."
- This message is shown only if tokens exist but the passphrase is not found in sessionStorage/localStorage.
- The error state is visually distinct and accessible (role="alert").
- Error message uses clear, plain language and is announced to screen readers.
- Focus is managed to the passphrase input field when prompt appears.
- Keyboard navigation is supported.
- Add a short explanation of why the passphrase is needed ("For your privacy, your passphrase is never stored. Please re-enter to unlock your Fitbit data.")
- Ensure error state is visually distinct in both light and dark mode.

## Seamless Experience with Passphrase in sessionStorage

- If the passphrase is present in sessionStorage (normal flow), the OAuth callback handler retrieves it automatically.
- No prompt is shown; the user is not interrupted.
- The Fitbit section loads and displays data/charts immediately after connection.
- Loading state uses role="status" and aria-live="polite" for screen readers.
- Progress indicator is visible and labeled.
- Confirm that the loading spinner and status text have sufficient color contrast.
- Add a brief success message (e.g., "Fitbit connected! Data loaded.") with aria-live for confirmation.

## Fitbit Section Data/Chart Loading

- After successful OAuth and passphrase restoration, the Fitbit section loads and displays correlation charts.
- If connection fails, a clear error is shown with retry guidance.
- Charts have ARIA labels, keyboard navigation, and colorblind-safe palettes.
- Empty/error states are described for screen readers.
- Add a summary sentence above charts ("These charts show the relationship between your CPAP and Fitbit data.")
- Ensure all chart controls are keyboard accessible.

## Medical UX Patterns & Clarity

- Passphrase handling is privacy-first and explained in plain language.
- Error and loading states are clear and actionable.
- Data is not persisted beyond session, reducing risk.
- Add a tooltip or info icon near passphrase prompt explaining why it's needed.
- Consider a help link to "Why do I need a passphrase?" (links to privacy FAQ).
- For clinicians, clarify that passphrase is user-specific and not shared.
