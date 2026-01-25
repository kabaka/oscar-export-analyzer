# Privacy & Terms

## Privacy Policy

- OSCAR Export Analyzer runs entirely in your browser. No uploads, telemetry, or third-party analytics are used.
- OSCAR CSV files, derived metrics, and visualizations stay on your device. Network requests are limited to loading the app shell and optional Fitbit OAuth endpoints when explicitly initiated.
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

## Fitbit Integration

- **Opt-in only**: Fitbit OAuth is initiated by you and limited to requested scopes. Tokens are stored locally and encrypted.
- **No secondary analytics**: Fitbit data is processed locally for correlation dashboards; it is not uploaded or shared.
- **Revoke anytime**: Disconnect Fitbit to clear tokens and associated Fitbit data from this device.

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
