# Fitbit OAuth Connection: FAQ and Troubleshooting

## Why do I have to re-enter my passphrase after Fitbit OAuth?

For your privacy and security, your Fitbit tokens are encrypted with a passphrase that is never stored permanently. After completing the Fitbit OAuth flow, you may be prompted to re-enter your passphrase to unlock your tokens and connect your Fitbit data. This ensures that only you can access your health data, even if someone else uses your device.

- **If your passphrase is present in sessionStorage** (e.g., you have not closed your browser or tab), the app will auto-connect and you will not be prompted.
- **If your passphrase is missing** (e.g., after a browser restart or new session), you must re-enter it to complete the connection.

## What if I see 'Not connected' after OAuth?

- This means the app could not find your passphrase in memory or sessionStorage.
- Simply re-enter your passphrase when prompted to unlock your Fitbit data.
- Your tokens are safe and remain encrypted on your device.

## Can I store my passphrase to avoid re-entering it?

- For security, the app only stores your passphrase in sessionStorage for the current session.
- It is never saved permanently or sent to any server.
- This protects your privacy and ensures your health data stays secure.

## Where can I learn more about privacy and security?

- See [docs/user/12-privacy-and-terms.md](12-privacy-and-terms.md) for full details.
- For technical details, see [docs/developer/testing-patterns/fitbit-oauth-flow.md](../developer/testing-patterns/fitbit-oauth-flow.md).
