# Privacy & Terms

## Privacy Policy

- OSCAR Export Analyzer runs entirely in your browser. No uploads, telemetry, or third-party analytics are used.
- OSCAR CSV files, derived metrics, and visualizations stay on your device. Network requests are limited to loading the app shell; no health data is ever uploaded. Wearable correlation reads a local Google Health (formerly Fitbit) export directly from disk and makes no network requests.
- You choose if and when to save a session. Saved sessions are encrypted in IndexedDB with your passphrase when cross-device transfer is used.

## Data Storage

- **In-memory processing**: Imported CSVs are parsed in memory and web workers; raw files are never sent to a server.
- **Local caches only**: Temporary calculations and chart state live in memory. Optional session persistence uses browser storage scoped to this device.
- **Encryption**: Cross-device exports use AES-GCM encryption with your passphrase. Passphrases are never logged or stored.
- **No cookies for tracking**: Only essential settings (theme, dismissed notices) may be stored locally for UX continuity.

## Data Retention

- **You control retention**: Clear sessions from the header menu to remove data from memory and local storage.
- **Browser cleanup**: Clearing site data in your browser also removes saved sessions and preferences.
- **No background sync**: There is no automatic cloud backup or synchronization.

## Exports and Sharing

- **Encrypted exports**: Use "Export for Another Device" to create an encrypted `.json.enc` file secured by your passphrase.
- **Safe transfer guidance**: Prefer direct device transfer (AirDrop, USB). Avoid untrusted cloud folders when possible.
- **Decryption control**: Only someone with the exported file and your passphrase can decrypt the session.

## Wearable Integration

- **Local export only**: Wearable correlation uses a local Google Health (formerly Fitbit) export that you download and select yourself. There is no OAuth, no account login, and no network access to any wearable service — the export is read from disk in read-only mode.
- **No secondary analytics**: Wearable data is aggregated locally for correlation dashboards; it is never uploaded or shared.
- **You control retention**: Wearable data is stored only in your browser. Use **Forget folder** to clear all imported wearable data and any remembered folder permission. CPAP sessions are unaffected.
- **Chromium-only import**: The folder import requires a Chromium-based browser; CPAP analysis works on every browser. See the [Wearable Integration Guide](11-wearable-integration.md).

## Terms of Service

- This tool is provided “as is” for educational and self-analysis purposes. It is not a medical device and does not provide medical advice.
- You are responsible for how you use exported files and for keeping your passphrases private.
- The project may change or discontinue features without notice; availability is not guaranteed.

## Warranty Disclaimer

- No warranties, express or implied, including merchantability or fitness for a particular purpose.
- The maintainers are not liable for any damages arising from use, inability to use, data loss, or decisions made based on the analysis.

## Contact

- Questions or issues? Open a discussion or issue on the GitHub repository.
- For security or privacy concerns, share minimal detail and avoid attaching real health data when requesting help.

## Accessibility

- The UI follows WCAG-informed patterns: keyboard navigation, focus states, and color-contrast-aware themes.
- If you encounter barriers, file an accessibility issue with steps to reproduce so fixes can ship quickly.
