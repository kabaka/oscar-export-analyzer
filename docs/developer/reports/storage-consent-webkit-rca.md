- `background: var(--color-surface); border-radius: var(--radius); box-shadow: var(--shadow-2); z-index: 1300; pointer-events: auto;`
- This will ensure the modal is always on top and interactable in all browsers.
- Optionally, add a fade-in animation for polish.

## Validation

- After adding CSS, re-run Playwright E2E on all browsers.
- Modal should be dismissed reliably in WebKit, Chromium, and Firefox.

## Preventive Recommendation

- Always define explicit CSS for modal overlays and content, including stacking and pointer events.
- Consider a shared `.modal-backdrop` and `.modal` style for all dialogs.

---

_No real OAuth or PHI data was used. All test data is synthetic._
