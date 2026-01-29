# Fitbit Integration Guide

OSCAR Export Analyzer includes optional Fitbit integration to correlate CPAP therapy effectiveness with physiological metrics from your Fitbit device. This guide covers setup, privacy considerations, and interpreting correlation visualizations.

## Table of Contents

- [Overview](#overview)
- [Privacy & Security](#privacy--security)
- [Setup Instructions](#setup-instructions)
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

- Heart rate variability (HRV) during sleep
- SpO2 (blood oxygen saturation) levels
- Sleep stages (Light, Deep, REM, Wake)
- Restlessness and movement patterns

### Why It's Valuable

Understanding correlations between therapy metrics and physiological responses helps:

- **Validate therapy effectiveness** – Does lower AHI correlate with better HRV?
- **Identify therapy issues** – Do leak events coincide with oxygen desaturations?
- **Optimize settings** – Which pressure ranges produce the most restorative sleep?
- **Track progress** – How do therapy improvements affect overall sleep quality?

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

- **Limited scope**: Access only to heart rate, SpO2, and sleep data
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
   - Heart rate data (minute-level)
   - SpO2 data (daily summaries)
   - Sleep stages and duration
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

## Correlation Analysis

### Available Visualizations

The **Fitbit Correlations** dashboard includes:

#### 1. Correlation Matrix

- **Purpose**: Overview of all metric relationships
- **Interpretation**: Color intensity shows correlation strength
- **Look for**: Strong correlations (>0.5) between therapy and physiological metrics

#### 2. AHI vs. Heart Rate Variability

- **Purpose**: Primary therapy effectiveness indicator
- **Expected**: Lower AHI should correlate with higher HRV (better sleep quality)
- **Clinical relevance**: HRV is sensitive to sleep fragmentation

#### 3. Pressure vs. SpO2 Patterns

- **Purpose**: Evaluate pressure titration effectiveness
- **Expected**: Optimal pressure should minimize SpO2 drops
- **Look for**: Sweet spot where pressure prevents desaturations without over-treatment

#### 4. Sleep Stage Distribution

- **Purpose**: How therapy affects sleep architecture
- **Expected**: Better therapy should increase deep and REM sleep percentages
- **Compare**: Sleep stage patterns on high vs. low AHI nights

#### 5. Time-Aligned Analysis

- **Purpose**: Minute-by-minute correlation during sleep
- **Advanced**: Shows precise timing relationships
- **Clinical value**: Identifies if therapy events predict physiological responses

### Statistical Indicators

Each visualization includes statistical context:

- **Pearson correlation** (r): Linear relationship strength (-1 to +1)
- **Spearman rank correlation** (ρ): Monotonic relationship (handles outliers better)
- **P-values**: Statistical significance (p < 0.05 typically significant)
- **Effect sizes**: Clinical significance (Cohen's conventions)
- **Mann-Whitney U**: Compare distributions between groups

### Interpreting Results

#### Strong Positive Correlations (r > 0.5)

- **AHI ↔ Restlessness**: More apneas = more movement (expected)
- **Pressure ↔ AHI Control**: Higher pressure = lower AHI (if properly titrated)

#### Strong Negative Correlations (r < -0.5)

- **AHI ↔ HRV**: More apneas = lower heart rate variability (expected)
- **AHI ↔ Deep Sleep**: More apneas = less restorative sleep (expected)

#### Weak Correlations (|r| < 0.3)

- May indicate: therapy working well, data quality issues, or genuine independence
- Don't over-interpret: small sample sizes reduce statistical power

#### Example Clinical Insights

**Good Therapy Response:**

- AHI negatively correlates with HRV (r = -0.7)
- Pressure optimally balances AHI control and SpO2 stability
- Sleep stages show healthy distribution

**Potential Issues:**

- High pressure but persistent oxygen drops (possible central apneas)
- Low AHI but poor HRV (possible flow limitations or other sleep disorders)
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

### Data Quality Issues

**Missing heart rate data**

- Fitbit device not worn during sleep
- Low battery or poor skin contact
- Disable "Heart Rate" notifications if causing gaps

**Inconsistent SpO2 readings**

- Only newer Fitbit devices support SpO2
- Requires specific positioning during sleep
- May have gaps due to movement or poor sensor contact

**Sleep stage inaccuracies**

- Fitbit uses accelerometer + heart rate estimation
- Less accurate than clinical polysomnography
- Use for trends, not absolute values

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

### Fitbit Device Limitations

**Heart Rate Variability:**

- Estimated from photoplethysmography (PPG), not ECG
- Less precise than medical-grade HRV monitors
- Good for trends, not absolute clinical values

**SpO2 Accuracy:**

- Consumer-grade sensor limitations
- Movement artifacts during sleep
- May miss brief desaturations (<1 minute)

**Sleep Stage Detection:**

- Algorithm-based estimation, not polysomnography
- Accuracy varies by individual and device model
- Use for pattern recognition, not clinical diagnosis

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
