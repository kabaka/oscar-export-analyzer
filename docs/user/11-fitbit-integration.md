# Fitbit Integration Guide

OSCAR Export Analyzer includes optional Fitbit integration to correlate CPAP therapy effectiveness with physiological metrics from your Fitbit device. This guide covers setup, privacy considerations, and interpreting correlation visualizations.

## Table of Contents

- [Overview](#overview)
- [Privacy & Security](#privacy--security)
- [Setup Instructions](#setup-instructions)
- [Intraday Heart Rate Data](#intraday-heart-rate-data)
- [Date Range Alignment](#date-range-alignment)
- [Correlation Analysis](#correlation-analysis)
- [Troubleshooting](#troubleshooting)
- [Data Limitations](#data-limitations)

## Overview

### What It Does

The Fitbit integration adds a **Fitbit Correlations** dashboard that analyzes relationships between:

**CPAP Therapy Metrics:**

- AHI (Apnea-Hypopnea Index)
- EPAP levels and pressure variations
- Leak rates and mask seal quality
- Usage hours and adherence patterns

**Fitbit Physiological Data:**

- Heart rate — including **minute-by-minute intraday data** (1,440 data points per night)
- Resting heart rate trends over time
- SpO2 (blood oxygen saturation) levels — intraday at 5-minute intervals
- Heart rate variability (HRV) derived from heart rate data

> **Note:** Fitbit sleep stage data is not currently available due to a [Fitbit platform CORS limitation](#sleep-api-cors-limitation). Heart rate and SpO2 provide rich overnight insights in the meantime.

### Why It's Valuable

Understanding correlations between therapy metrics and physiological responses helps:

- **Validate therapy effectiveness** – Does lower AHI correlate with lower resting heart rate?
- **Identify therapy issues** – Do leak events coincide with heart rate spikes or oxygen desaturations?
- **See overnight detail** – Minute-by-minute heart rate reveals patterns during CPAP use
- **Track progress** – How do therapy improvements affect heart rate and SpO2 over time?

## Privacy & Security

### Local-First Architecture

The Fitbit integration maintains OSCAR's privacy-first approach:

- ✅ **All data stays local** – Fitbit data downloaded to your browser, never uploaded to servers
- ✅ **End-to-end encryption** – Stored using same AES-GCM encryption as CPAP data
- ✅ **User-controlled keys** – You choose the passphrase for encryption
- ✅ **No tracking** – No analytics, cookies, or behavioral monitoring
- ✅ **Full transparency** – Open source code available for security audit

### OAuth Security & Passphrase Handling

The connection process uses industry-standard OAuth 2.0 with PKCE:

- **Limited scope**: Access only to heart rate and SpO2 data
- **Temporary authorization**: Tokens automatically expire and refresh
- **Revocable access**: Disconnect anytime via Settings or Fitbit account management

#### Passphrase Security Model

- **Your encryption passphrase is never stored long-term.**
- During OAuth, the app saves your passphrase in `sessionStorage` (and a short-lived backup in `localStorage`) to survive the redirect.
- After OAuth, the app restores your passphrase automatically if possible. If session data is cleared or blocked, you must re-enter it.
- **Why?** This protects your privacy: even if someone gains access to your device later, they cannot decrypt your data without your passphrase.
- **Tip:** Do not use browser settings or extensions that clear session/local storage during the OAuth process.

**Security rationale:**

- The passphrase is only kept in memory or temporary storage for the duration of your session and OAuth redirect. This minimizes the risk of compromise from malware, browser exploits, or shared computers.
- The app never writes your passphrase to disk, cookies, or permanent storage.

**Expected UX after OAuth:**

- If session/local storage is intact, you will be reconnected automatically and data sync will begin.
- If storage was cleared or blocked, you will be prompted to re-enter your passphrase to complete the connection.
- If you see repeated prompts or connection errors, check your browser privacy settings and disable extensions that block storage.

See [Troubleshooting](#troubleshooting) for more help.

## Setup Instructions

### Prerequisites

Before connecting Fitbit:

1. **Load CPAP data first** – Import your OSCAR CSV files
2. **Ensure data overlap** – You need at least 7 nights where both CPAP and Fitbit recorded data
3. **Compatible device** – Fitbit must support heart rate and SpO2 monitoring
4. **Recent data** – Best results with data from last 30-90 days

### Step-by-Step Setup

#### 1. Initiate Connection

1. Load your OSCAR data as usual
2. Navigate to **Settings** in the main menu
3. Find **Fitbit Integration** section
4. Click **Connect to Fitbit**

#### 2. OAuth Authorization

1. Browser opens Fitbit login page
2. Sign in to your Fitbit account
3. Review data access permissions:
   - Heart rate data (minute-level intraday)
   - SpO2 data (intraday at 5-minute intervals)
4. Click **Allow** to grant access

#### 3. Automatic Passphrase Restoration (New)

1. After Fitbit authorization, you are redirected back to OSCAR Export Analyzer.
2. The app attempts to restore your encryption passphrase from sessionStorage or a secure localStorage backup.
   - **If successful:** You do not need to re-enter your passphrase. Data sync begins automatically.
   - **If not:** You will be prompted to re-enter your passphrase. This is required if you cleared browser session data, used incognito mode, or have privacy extensions that block storage.
   - **Troubleshooting:** If you see repeated prompts, check your browser privacy settings and disable extensions that block session/local storage.
3. Progress indicator shows download status.
4. **Be patient**: Initial sync may take 2-5 minutes for 100 days of data.

#### 4. Verify Connection

1. **Fitbit Analysis** appears in navigation menu
2. Connection status shows "Connected" with last sync date in a single, unified dashboard
3. Data preview displays available nights and metrics

**Note**: The interface uses a single, theme-aware connection panel that adapts to both light and dark modes for consistent readability.

### Setting Up Encryption (Recommended)

For maximum security, encrypt your Fitbit data:

1. Go to **Settings** → **Privacy & Encryption**
2. Choose a strong passphrase (12+ characters)
3. Enable **"Encrypt Fitbit data"**
4. **Remember your passphrase** – it cannot be recovered if lost

## Intraday Heart Rate Data

One of the most powerful features of the Fitbit integration is **per-minute heart rate data**. For each night in your date range, the app fetches 1-minute resolution heart rate readings — up to 1,440 data points per day.

### What You'll See

In the **night detail view** (click any night in the Fitbit dashboard), you'll find:

- **Side-by-side KPI comparison**: OSCAR metrics (AHI, Total Time, Leak Rate) next to Fitbit metrics (Resting HR, Min HR, Avg SpO2, Min SpO2) for that specific night
- **SVG sparkline chart**: A minute-by-minute heart rate graph showing overnight patterns — dips, spikes, and recovery periods during CPAP use
- **SpO2 data cards**: When available, intraday SpO2 readings at 5-minute intervals
- **Dual-axis sync chart**: Combined OSCAR + Fitbit data on a shared timeline

### Interpreting Heart Rate Patterns

- **Gradual decline** into sleep is normal and healthy
- **Sharp spikes** may correspond to apnea events or arousals
- **Elevated baseline** throughout the night could indicate therapy issues
- **Low, steady overnight HR** generally correlates with effective therapy

> Heart rate data is fetched in batches of 7 days at a time and processed efficiently in the background. Initial sync for large date ranges may take a few minutes.

## Date Range Alignment

Fitbit sync automatically aligns with your OSCAR data:

- **With a date filter active**: Syncs only the filtered date range — great for focusing on a specific period
- **Without a date filter**: Derives the range from the earliest and latest dates in your imported OSCAR CSV data
- **No more "last 30 days" default**: The sync always matches the data you're actually analyzing

This means you get Fitbit data exactly where you need it, without fetching months of irrelevant days. If you import 90 days of OSCAR data, the Fitbit sync covers those same 90 days.

## Correlation Analysis

### Available Visualizations

The **Fitbit Correlations** dashboard includes:

#### 1. Correlation Matrix

- **Purpose**: Overview of all metric relationships
- **Interpretation**: Color intensity shows correlation strength
- **Look for**: Strong correlations (>0.5) between therapy and physiological metrics

#### 2. AHI vs. Resting Heart Rate

- **Purpose**: Primary therapy effectiveness indicator
- **Expected**: Lower AHI should correlate with lower resting HR
- **Clinical relevance**: Resting heart rate is sensitive to sleep quality and fragmentation

#### 3. Pressure vs. SpO2 Patterns

- **Purpose**: Evaluate pressure titration effectiveness
- **Expected**: Optimal pressure should minimize SpO2 drops
- **Look for**: Sweet spot where pressure prevents desaturations without over-treatment

#### 4. Leak Rate vs. Heart Rate

- **Purpose**: Detect how mask seal issues affect physiology
- **Expected**: Higher leak rates may correlate with elevated heart rate if causing arousals
- **Compare**: Nights with good seal vs. poor seal

#### 5. Night Detail View

- **Purpose**: Minute-by-minute view of a single night
- **Advanced**: Shows intraday heart rate sparkline alongside OSCAR therapy data
- **Clinical value**: Identifies if therapy events (apneas, leaks) correspond to heart rate changes

### Statistical Indicators

Each visualization includes statistical context:

- **Pearson correlation** (r): Linear relationship strength (-1 to +1)
- **Spearman rank correlation** (ρ): Monotonic relationship (handles outliers better)
- **P-values**: Statistical significance (p < 0.05 typically significant)
- **Effect sizes**: Clinical significance (Cohen's conventions)
- **Mann-Whitney U**: Compare distributions between groups

### Interpreting Results

#### Strong Positive Correlations (r > 0.5)

- **AHI ↔ Resting HR**: More apneas = elevated resting heart rate (expected — sleep fragmentation increases sympathetic tone)
- **Leak Rate ↔ Heart Rate**: High leaks = elevated HR if causing arousals

#### Strong Negative Correlations (r < -0.5)

- **Usage ↔ Resting HR**: More CPAP usage = lower resting heart rate (therapy effectiveness)
- **AHI ↔ SpO2**: More apneas = lower blood oxygen (expected)

#### Weak Correlations (|r| < 0.3)

- May indicate: therapy working well, data quality issues, or genuine independence
- Don't over-interpret: small sample sizes reduce statistical power

#### Example Clinical Insights

**Good Therapy Response:**

- AHI positively correlates with resting HR — nights with more events show elevated HR
- Pressure optimally balances AHI control and SpO2 stability
- Intraday HR shows gradual decline into sleep with stable overnight baseline

**Potential Issues:**

- High pressure but persistent oxygen drops (possible central apneas)
- Low AHI but elevated resting HR (possible flow limitations or other sleep disorders)
- Inconsistent patterns suggest equipment or fit problems

## Troubleshooting

### Connection Issues

**"OAuth authorization failed"**

- Ensure you're using HTTPS (required for OAuth)
- Try different browser or private/incognito mode
- Disable browser extensions that block redirects
- If issue persists after trying above steps, check browser console for specific error messages

**"Invalid OAuth state"**

- This error should be rare in current versions. If it occurs, your browser may have cleared sessionStorage or blocked localStorage during the OAuth redirect.
- Try reconnecting with browser privacy settings relaxed, or avoid clearing session data during the process.

**"No data available"**

- Verify Fitbit device recorded data on nights with CPAP use
- Check Fitbit app sync status (device → app → web dashboard)
- Ensure 7+ nights of overlapping data

**"Token expired"**

- Normal after 8 hours of inactivity
- Click "Reconnect" to refresh authorization
- Data remains encrypted and safe during reconnection

**"Sleep data not syncing"**

- This is a known limitation, not a configuration issue on your end
- Fitbit's Sleep v1.2 API endpoints currently return CORS errors that prevent browser-based apps from accessing sleep data
- This affects all browser-based Fitbit integrations, including Fitbit's own Swagger UI
- Heart rate and SpO2 data sync normally and provide rich overnight insights
- Sleep data support will be re-enabled if/when Fitbit resolves this platform issue

### Data Quality Issues

**Missing heart rate data**

- Fitbit device not worn during sleep
- Low battery or poor skin contact
- Disable "Heart Rate" notifications if causing gaps

**Inconsistent SpO2 readings**

- Only newer Fitbit devices support SpO2
- Requires specific positioning during sleep
- May have gaps due to movement or poor sensor contact

### Performance Issues

**Slow initial sync**

- Normal for 90+ days of data
- Browser may warn about memory usage (safe to continue)
- Close other tabs during sync to free memory

**Chart rendering delays**

- Large datasets (100+ nights) may take 10-15 seconds
- Use date filters to analyze smaller ranges
- Consider exporting data for analysis in other tools

## Data Limitations

### Passphrase & Session Storage

**Automatic Restoration:**

- After OAuth, your passphrase is restored automatically from sessionStorage or a secure localStorage backup. You do not need to re-enter it unless session data was cleared or browser privacy settings/extensions block storage.
- If connection fails or you are unexpectedly prompted for your passphrase, check that your browser allows sessionStorage/localStorage and that you have not cleared session data.

### Sleep API CORS Limitation

Fitbit's Sleep v1.2 API endpoints currently return CORS (Cross-Origin Resource Sharing) errors that prevent any browser-based application from accessing sleep stage data. This is a **Fitbit platform issue**, not a bug in OSCAR Export Analyzer:

- The CORS errors occur even on [Fitbit's official Swagger UI](https://dev.fitbit.com/build/reference/web-api/sleep/)
- Sleep scopes have been removed from the OAuth flow until this is resolved
- All other Fitbit APIs (heart rate, SpO2, HRV) work correctly
- If Fitbit fixes this in the future, sleep data support will be re-enabled

In the meantime, **intraday heart rate data provides excellent overnight insight** — you can see exactly how your heart responds during CPAP therapy, which is often more granular than sleep stage summaries.

### Fitbit Device Limitations

**Heart Rate Variability:**

- Estimated from photoplethysmography (PPG), not ECG
- Less precise than medical-grade HRV monitors
- Good for trends, not absolute clinical values

**SpO2 Accuracy:**

- Consumer-grade sensor limitations
- Movement artifacts during sleep
- May miss brief desaturations (<1 minute)

### Statistical Considerations

**Sample Size:**

- Minimum 7 nights for basic correlations
- 30+ nights for robust statistical inference
- More nights = more reliable patterns

**Confounding Variables:**

- Alcohol, medications, stress, illness affect both metrics
- Day-to-day variation normal and expected
- Look for consistent patterns over time

**Correlation vs. Causation:**

- Strong correlations don't prove causation
- Multiple factors affect both CPAP and Fitbit metrics
- Use correlations to generate hypotheses, not definitive conclusions

### Medical Disclaimer

**Important**: This integration is for educational and research purposes. Correlation analysis supplements but does not replace:

- Clinical sleep studies
- Healthcare provider consultation
- Medical device titration protocols
- Professional interpretation of therapy effectiveness

Always consult your healthcare provider before adjusting CPAP settings or interpreting physiological data for medical decisions.

---

**Next Steps:**

- [Statistical Concepts Guide](04-statistical-concepts.md) – Understanding correlation analysis
- [Troubleshooting Guide](06-troubleshooting.md) – General app support
- [Privacy & Security](08-disclaimers.md) – Data protection details
