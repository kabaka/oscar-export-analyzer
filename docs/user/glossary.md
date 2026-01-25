# Glossary

A comprehensive reference for medical, statistical, and technical terms used throughout OSCAR Export Analyzer. For more detailed explanations, see the [Data Dictionary](03-data-dictionary.md) and [Statistical Concepts](04-statistical-concepts.md) guides.

---

## Medical & Clinical Terms

### AHI (Apnea-Hypopnea Index)

**Definition**: The number of apnea and hypopnea events per hour of sleep, calculated as `(Central + Obstructive + Hypopnea events) / Hours Slept`.

**Context**: AHI is the primary metric for assessing sleep apnea severity. OSCAR calculates AHI from detected events. Values below 5 are considered normal, 5–15 mild, 15–30 moderate, and above 30 severe.

**Related Terms**: [Obstructive Apnea](#obstructive-apnea), [Central Apnea](#central-apnea), [Hypopnea](#hypopnea)

**See Also**: [Data Dictionary](03-data-dictionary.md), [Visualizations Guide](02-visualizations.md)

---

### Central Apnea

**Definition**: A breathing cessation lasting 10+ seconds caused by lack of respiratory effort (brain fails to signal breathing muscles).

**Context**: CPAP machines detect central apneas differently than obstructive apneas. Central events may indicate neurological issues or heart failure and often require different treatment approaches than obstructive events.

**Related Terms**: [Obstructive Apnea](#obstructive-apnea), [Mixed Apnea](#mixed-apnea), [AHI](#ahi-apnea-hypopnea-index)

**See Also**: [Data Dictionary](03-data-dictionary.md)

---

### Compliance

**Definition**: Meeting prescribed therapy requirements, typically defined as using CPAP for at least 4 hours per night on 70% of nights over a 30-day period.

**Context**: Insurance providers and clinicians track compliance to ensure effective therapy. The analyzer's usage patterns charts help visualize compliance trends over time.

**Related Terms**: [Total Time](#total-time), [Usage Patterns](#usage-patterns)

**See Also**: [Practical Tips](07-practical-tips.md), [Visualizations Guide](02-visualizations.md)

---

### CPAP (Continuous Positive Airway Pressure)

**Definition**: A therapy device that delivers pressurized air through a mask to keep airways open during sleep.

**Context**: CPAP is the gold-standard treatment for obstructive sleep apnea. Modern devices automatically adjust pressure (Auto-CPAP or APAP) and record detailed session data exported to OSCAR.

**Related Terms**: [EPAP](#epap-expiratory-positive-airway-pressure), [IPAP](#ipap-inspiratory-positive-airway-pressure), [Pressure Relief](#pressure-relief)

**See Also**: [Getting Started](01-getting-started.md)

---

### EPAP (Expiratory Positive Airway Pressure)

**Definition**: Air pressure during exhalation. In BiPAP/BiLevel devices, EPAP is lower than IPAP to make breathing out easier.

**Context**: The analyzer charts median EPAP over time and correlates it with AHI. Higher EPAP generally keeps airways more open but may feel uncomfortable. Auto-adjusting machines vary EPAP based on detected events.

**Related Terms**: [IPAP](#ipap-inspiratory-positive-airway-pressure), [CPAP](#cpap-continuous-positive-airway-pressure), [Pressure Relief](#pressure-relief)

**See Also**: [Data Dictionary](03-data-dictionary.md), [Visualizations Guide](02-visualizations.md)

---

### Fitbit Integration

**Definition**: Optional connection to Fitbit devices via OAuth authentication to analyze correlations between CPAP therapy metrics and physiological data.

**Context**: When enabled, the analyzer securely downloads heart rate, SpO2, and sleep stage data from Fitbit Web API. All data remains local and encrypted. Correlation analysis helps identify relationships between therapy effectiveness and cardiovascular/respiratory responses.

**Related Terms**: [HRV](#hrv-heart-rate-variability), [Correlation Analysis](#correlation-analysis), [OAuth](#oauth)

**See Also**: [Fitbit Integration Guide](11-fitbit-integration.md), [Statistical Concepts](04-statistical-concepts.md)

---

### FLG (Flow Limitation)

**Definition**: Partial airflow restriction detected by analyzing breath waveform shape. Reported as a numeric value between 0 (no limitation) and 1 (severe limitation).

**Context**: Flow limitation events precede apneas and hypopneas. The analyzer clusters FLG events to identify potential false negatives—sessions where AHI appears low but flow limitation suggests under-detection.

**Related Terms**: [RERA](#rera-respiratory-effort-related-arousal), [False Negatives](#false-negatives), [Hypopnea](#hypopnea)

**See Also**: [False Negatives Guide](02-visualizations.md#false-negatives-analysis)

---

### HRV (Heart Rate Variability)

**Definition**: The variation in time intervals between heartbeats, measured in milliseconds. Higher HRV typically indicates better cardiovascular health and more restorative sleep.

**Context**: Available when Fitbit integration is enabled. HRV is calculated as RMSSD (Root Mean Square of Successive Differences) from minute-level heart rate data during sleep periods. Lower HRV may correlate with higher AHI or poor therapy effectiveness.

**Related Terms**: [Fitbit Integration](#fitbit-integration), [Correlation Analysis](#correlation-analysis)

**See Also**: [Fitbit Integration Guide](11-fitbit-integration.md), [Statistical Concepts](04-statistical-concepts.md)

---

### Hypopnea

**Definition**: Partial reduction in airflow (typically 30%+) lasting 10+ seconds, accompanied by oxygen desaturation or arousal.

**Context**: Hypopneas are milder than full apneas but still disrupt sleep. Included in AHI calculation. The analyzer's event-level data (if available) shows individual hypopnea timestamps.

**Related Terms**: [Obstructive Apnea](#obstructive-apnea), [AHI](#ahi-apnea-hypopnea-index), [SpO2](#spo2-oxygen-saturation)

**See Also**: [Data Dictionary](03-data-dictionary.md)

---

### IPAP (Inspiratory Positive Airway Pressure)

**Definition**: Air pressure during inhalation. In BiPAP/BiLevel devices, IPAP is higher than EPAP to assist breathing in.

**Context**: IPAP settings are prescribed by clinicians based on sleep studies. The analyzer doesn't typically chart IPAP separately unless it's included in OSCAR exports.

**Related Terms**: [EPAP](#epap-expiratory-positive-airway-pressure), [CPAP](#cpap-continuous-positive-airway-pressure)

**See Also**: [Data Dictionary](03-data-dictionary.md)

---

### Leak Rate

**Definition**: Unintended air leakage from the CPAP mask, reported in liters per minute (L/min) or as percentage of time above threshold.

**Context**: High leak rates reduce therapy effectiveness and may correlate with higher AHI. The analyzer includes leak data in correlation charts if available in OSCAR exports. Median leak < 24 L/min is generally acceptable.

**Related Terms**: [CPAP](#cpap-continuous-positive-airway-pressure), [Mask Fit](#mask-fit)

**See Also**: [Data Dictionary](03-data-dictionary.md), [Practical Tips](07-practical-tips.md)

---

### Mask Fit

**Definition**: How well a CPAP mask seals against the face, affecting leak rates and therapy comfort.

**Context**: Poor mask fit causes leaks and discomfort. The analyzer's leak correlation charts help identify whether leak issues correlate with specific pressure ranges or time periods.

**Related Terms**: [Leak Rate](#leak-rate), [Compliance](#compliance)

**See Also**: [Practical Tips](07-practical-tips.md)

---

### Mixed Apnea

**Definition**: A breathing cessation that starts as central (no effort) and transitions to obstructive (effort against closed airway).

**Context**: Less common than pure obstructive or central apneas. OSCAR classifies mixed events separately when machine firmware detects them. Treatment may require BiPAP or ASV devices.

**Related Terms**: [Central Apnea](#central-apnea), [Obstructive Apnea](#obstructive-apnea)

**See Also**: [Data Dictionary](03-data-dictionary.md)

---

### Obstructive Apnea

**Definition**: A breathing cessation lasting 10+ seconds caused by physical airway blockage despite continued respiratory effort.

**Context**: The most common type of sleep apnea. CPAP treats obstructive apneas by pressurizing the airway to prevent collapse. The analyzer's cluster analysis groups obstructive events by temporal proximity.

**Related Terms**: [Central Apnea](#central-apnea), [Hypopnea](#hypopnea), [AHI](#ahi-apnea-hypopnea-index)

**See Also**: [Visualizations Guide](02-visualizations.md#apnea-clusters)

---

### Pressure Relief

**Definition**: A comfort feature that temporarily reduces air pressure during exhalation (e.g., ResMed's EPR, Respironics' C-Flex).

**Context**: Pressure relief doesn't appear directly in OSCAR exports but affects user comfort and compliance. Not the same as BiPAP, which has separate IPAP/EPAP settings.

**Related Terms**: [EPAP](#epap-expiratory-positive-airway-pressure), [CPAP](#cpap-continuous-positive-airway-pressure)

**See Also**: [Practical Tips](07-practical-tips.md)

---

### Ramp Time

**Definition**: Period at therapy start when pressure gradually increases from a lower setting to prescribed level, allowing easier sleep onset.

**Context**: Ramp time is set in machine settings. The analyzer doesn't separately track ramp periods, but very short total usage times may indicate ramp-only sessions.

**Related Terms**: [Total Time](#total-time), [Compliance](#compliance)

**See Also**: [Practical Tips](07-practical-tips.md)

---

### RERA (Respiratory Effort Related Arousal)

**Definition**: Increased breathing effort that causes arousal (awakening) without meeting apnea or hypopnea criteria.

**Context**: RERAs disrupt sleep quality even when AHI is low. Some sleep studies report RDI (Respiratory Disturbance Index = AHI + RERA) instead of AHI. Most CPAP machines don't detect RERAs; flow limitation is a proxy.

**Related Terms**: [FLG](#flg-flow-limitation), [Hypopnea](#hypopnea)

**See Also**: [False Negatives Guide](02-visualizations.md#false-negatives-analysis)

---

### SpO2 (Oxygen Saturation)

**Definition**: Percentage of hemoglobin in blood carrying oxygen, measured via pulse oximetry. Normal range is 95–100%.

**Context**: SpO2 desaturations (drops below 90%) often accompany apneas and hypopneas. OSCAR can record SpO2 if a compatible oximeter is used, but many CPAP exports don't include it. The analyzer doesn't currently process SpO2 data.

**Related Terms**: [Hypopnea](#hypopnea), [AHI](#ahi-apnea-hypopnea-index)

**See Also**: [Data Dictionary](03-data-dictionary.md)

---

### Titration

**Definition**: The process of determining optimal CPAP pressure settings through sleep study observation or auto-adjusting device data.

**Context**: Clinicians review OSCAR data to adjust pressure ranges. The analyzer's EPAP trends and pressure-AHI correlation charts help inform titration decisions.

**Related Terms**: [EPAP](#epap-expiratory-positive-airway-pressure), [CPAP](#cpap-continuous-positive-airway-pressure)

**See Also**: [Practical Tips](07-practical-tips.md)

---

### Total Time

**Definition**: Duration of CPAP usage per night, reported in hours. OSCAR exports as `HH:MM:SS` or decimal hours.

**Context**: The analyzer converts time strings to decimal hours. Nights with `Total Time = 0` are treated as missed sessions. Insurance compliance typically requires 4+ hours per night.

**Related Terms**: [Compliance](#compliance), [Session](#session)

**See Also**: [Data Dictionary](03-data-dictionary.md), [Visualizations Guide](02-visualizations.md)

---

### Usage Patterns

**Definition**: Temporal trends in CPAP use, including nightly duration, compliance rates, and gaps in therapy.

**Context**: The analyzer's usage patterns section shows nightly hours, rolling averages, and survival curves (time-to-4-hours) to visualize adherence over time.

**Related Terms**: [Compliance](#compliance), [Total Time](#total-time)

**See Also**: [Visualizations Guide](02-visualizations.md)

---

## Statistical Terms

### ACF/PACF (Autocorrelation/Partial Autocorrelation)

**Definition**: Statistical measures of how a time series correlates with lagged versions of itself. ACF shows total correlation; PACF removes intermediate lag effects.

**Context**: Used in time series analysis to detect patterns and seasonality. The analyzer doesn't currently implement ACF/PACF but may in future releases for advanced trend detection.

**Related Terms**: [Time Series](#time-series), [Rolling Window](#rolling-window-moving-average)

**See Also**: [Statistical Concepts](04-statistical-concepts.md)

---

### Changepoint Detection

**Definition**: Identifying moments in a time series where statistical properties (mean, variance, trend) abruptly change.

**Context**: The analyzer uses least-squares segmentation (similar to PELT) to mark structural breaks in AHI and usage trends, highlighting therapy regimen changes or compliance shifts.

**Related Terms**: [PELT](#pelt-pruned-exact-linear-time), [Time Series](#time-series)

**See Also**: [Statistical Concepts](04-statistical-concepts.md)

---

### Clustering

**Definition**: Grouping similar data points based on proximity or shared characteristics.

**Context**: The analyzer clusters apnea events that occur close in time to identify periodic breathing patterns. K-means and single-linkage algorithms are supported.

**Related Terms**: [K-Means](#k-means), [Single-Linkage](#single-linkage)

**See Also**: [Visualizations Guide](02-visualizations.md#apnea-clusters), [Statistical Concepts](04-statistical-concepts.md)

---

### Confidence Interval

**Definition**: A range of values likely to contain the true population parameter with a specified probability (typically 95%).

**Context**: Rolling average charts display 95% confidence intervals around the mean to convey uncertainty. Calculated as $\bar{x} \pm 1.96 \frac{s}{\sqrt{k}}$ for normally distributed data.

**Related Terms**: [Rolling Window](#rolling-window-moving-average), [Standard Deviation](#standard-deviation)

**See Also**: [Statistical Concepts](04-statistical-concepts.md)

---

### Interquartile Range (IQR)

**Definition**: The range between the 25th and 75th percentiles of a dataset, representing the middle 50% of values. Calculated as $\text{IQR} = Q_3 - Q_1$.

**Context**: IQR is used for outlier detection (values beyond $Q_1 - 1.5 \times \text{IQR}$ or $Q_3 + 1.5 \times \text{IQR}$ are outliers). The analyzer's summary statistics include IQR.

**Related Terms**: [Percentile](#percentile), [Outlier](#outlier)

**See Also**: [Statistical Concepts](04-statistical-concepts.md)

---

### Kaplan-Meier Survival Curve

**Definition**: A method for estimating the probability of "surviving" (not experiencing an event) over time, handling censored data.

**Context**: The analyzer uses Kaplan-Meier curves to show the probability of reaching 4+ hours of nightly usage, treating missed nights as censored observations.

**Related Terms**: [Compliance](#compliance), [Survival Analysis](#survival-analysis)

**See Also**: [Visualizations Guide](02-visualizations.md), [Statistical Concepts](04-statistical-concepts.md)

---

### K-Means

**Definition**: A clustering algorithm that partitions data into k groups by iteratively assigning points to nearest cluster centroids and recalculating centroids.

**Context**: One of two clustering algorithms available for apnea event analysis. K-means requires specifying the number of clusters (k) in advance.

**Related Terms**: [Clustering](#clustering), [Single-Linkage](#single-linkage)

**See Also**: [Visualizations Guide](02-visualizations.md#apnea-clusters)

---

### LOESS (Locally Weighted Scatterplot Smoothing)

**Definition**: A non-parametric regression method that fits smooth curves by computing weighted least squares over local neighborhoods of data.

**Context**: The analyzer applies LOESS smoothing to EPAP×AHI scatter plots with a span parameter of 0.5, revealing pressure-response relationships without assuming linear trends.

**Related Terms**: [STL Decomposition](#stl-decomposition-seasonal-trend-loess), [Smoothing](#smoothing)

**See Also**: [Statistical Concepts](04-statistical-concepts.md)

---

### Mann-Whitney U Test

**Definition**: A non-parametric test comparing distributions of two independent groups by ranking all values and comparing rank sums. Does not assume normality.

**Context**: Used in the analyzer's range comparison feature to test whether AHI distributions differ between two date ranges. Reported with p-value and rank-biserial effect size.

**Related Terms**: [P-Value](#p-value), [Effect Size](#effect-size)

**See Also**: [Statistical Concepts](04-statistical-concepts.md), [Visualizations Guide](02-visualizations.md)

---

### Outlier

**Definition**: A data point significantly different from other observations, typically beyond $Q_1 - 1.5 \times \text{IQR}$ or $Q_3 + 1.5 \times \text{IQR}$.

**Context**: The analyzer identifies AHI outliers in summary statistics and visualizes them on box plots. Outliers may indicate data errors, unusual events, or therapy failures.

**Related Terms**: [IQR](#interquartile-range-iqr), [Percentile](#percentile)

**See Also**: [Visualizations Guide](02-visualizations.md)

---

### Percentile

**Definition**: The value below which a given percentage of observations fall. The 50th percentile is the median; 90th percentile means 90% of values are lower.

**Context**: The analyzer reports percentiles (25th, 50th, 75th, 90th) for AHI, usage, and pressure metrics in summary cards and tables.

**Related Terms**: [IQR](#interquartile-range-iqr), [Median](#median)

**See Also**: [Statistical Concepts](04-statistical-concepts.md)

---

### PELT (Pruned Exact Linear Time)

**Definition**: An efficient changepoint detection algorithm that finds optimal segmentations of time series in linear time using dynamic programming.

**Context**: The analyzer uses a least-squares segmentation approach similar to PELT for detecting structural breaks in AHI and usage trends.

**Related Terms**: [Changepoint Detection](#changepoint-detection), [Time Series](#time-series)

**See Also**: [Statistical Concepts](04-statistical-concepts.md)

---

### Rolling Window (Moving Average)

**Definition**: A calculation performed over a sliding subset of consecutive data points. For window size k, each point's value is computed from the k most recent observations.

**Context**: The analyzer displays 7-night and 30-night rolling averages for AHI and usage to smooth daily variation and reveal trends. Formula: $\text{RollingMean}_k(t) = \frac{1}{k} \sum_{i=t-k+1}^{t} x_i$.

**Related Terms**: [Smoothing](#smoothing), [Confidence Interval](#confidence-interval)

**See Also**: [Statistical Concepts](04-statistical-concepts.md), [Visualizations Guide](02-visualizations.md)

---

### Single-Linkage

**Definition**: A hierarchical clustering algorithm that merges clusters based on minimum distance between any two points in different clusters.

**Context**: Used as an alternative to k-means for apnea event clustering. Single-linkage with a gap threshold automatically determines cluster count based on temporal proximity.

**Related Terms**: [Clustering](#clustering), [K-Means](#k-means)

**See Also**: [Visualizations Guide](02-visualizations.md#apnea-clusters)

---

### Smoothing

**Definition**: Techniques for reducing noise and highlighting trends in data, such as moving averages or LOESS regression.

**Context**: Applied throughout the analyzer to make charts more readable—rolling windows smooth nightly variation, LOESS reveals pressure-response curves.

**Related Terms**: [Rolling Window](#rolling-window-moving-average), [LOESS](#loess-locally-weighted-scatterplot-smoothing)

**See Also**: [Statistical Concepts](04-statistical-concepts.md)

---

### Standard Deviation

**Definition**: A measure of data spread around the mean, calculated as $\sigma = \sqrt{\frac{1}{n}\sum_{i=1}^{n}(x_i - \bar{x})^2}$.

**Context**: Standard deviation is reported in summary statistics and used to calculate confidence intervals around rolling averages. Higher standard deviation indicates greater variability.

**Related Terms**: [Confidence Interval](#confidence-interval), [Variance](#variance)

**See Also**: [Statistical Concepts](04-statistical-concepts.md)

---

### STL Decomposition (Seasonal-Trend-Loess)

**Definition**: A method for decomposing time series into seasonal, trend, and residual components using LOESS smoothing.

**Context**: The analyzer doesn't currently implement full STL but uses LOESS for trend detection. Future versions may add seasonal decomposition for multi-year datasets.

**Related Terms**: [LOESS](#loess-locally-weighted-scatterplot-smoothing), [Time Series](#time-series)

**See Also**: [Statistical Concepts](04-statistical-concepts.md)

---

### Time Series

**Definition**: Data points indexed in time order, often used for trend analysis and forecasting.

**Context**: AHI and usage data are time series. The analyzer uses time series techniques like rolling windows, changepoint detection, and LOESS smoothing to reveal patterns.

**Related Terms**: [Rolling Window](#rolling-window-moving-average), [Changepoint Detection](#changepoint-detection)

**See Also**: [Statistical Concepts](04-statistical-concepts.md)

---

### Correlation Analysis

**Definition**: Statistical method to measure the strength and direction of linear relationships between two variables, typically expressed as Pearson correlation coefficient (r) ranging from -1 to +1.

**Context**: Used extensively in Fitbit integration to identify relationships between CPAP therapy metrics (AHI, pressure, usage) and physiological responses (HRV, SpO2, sleep stages). Includes significance testing (p-values) and effect size calculations for clinical interpretation.

**Related Terms**: [Pearson Correlation](#pearson-correlation), [Spearman Correlation](#spearman-correlation), [P-Value](#p-value), [Effect Size](#effect-size)

**See Also**: [Fitbit Integration Guide](11-fitbit-integration.md), [Statistical Concepts](04-statistical-concepts.md)

---

### Effect Size

**Definition**: A quantitative measure of the magnitude of a difference between groups, independent of sample size.

**Context**: The analyzer reports rank-biserial effect size (0 = no difference, 1 = complete separation) alongside p-values in range comparisons.

**Related Terms**: [Mann-Whitney U Test](#mann-whitney-u-test), [P-Value](#p-value)

**See Also**: [Statistical Concepts](04-statistical-concepts.md)

---

### Median

**Definition**: The middle value when data is sorted; the 50th percentile. More robust to outliers than the mean.

**Context**: Many OSCAR metrics (EPAP, leak rate) are reported as medians rather than means. The analyzer uses medians in summary statistics and rolling windows.

**Related Terms**: [Percentile](#percentile), [Mean](#mean)

**See Also**: [Statistical Concepts](04-statistical-concepts.md)

---

### Mean

**Definition**: The arithmetic average of a dataset, calculated as $\bar{x} = \frac{1}{n}\sum_{i=1}^{n}x_i$.

**Context**: Used for AHI averages, rolling windows, and confidence intervals. Less robust than median when data contains outliers.

**Related Terms**: [Median](#median), [Standard Deviation](#standard-deviation)

**See Also**: [Statistical Concepts](04-statistical-concepts.md)

---

### P-Value

**Definition**: The probability of observing data at least as extreme as the current sample, assuming the null hypothesis is true. Values < 0.05 are typically considered statistically significant.

**Context**: Reported in range comparisons to test whether AHI differs between periods. Low p-values suggest real differences, not random variation.

**Related Terms**: [Mann-Whitney U Test](#mann-whitney-u-test), [Effect Size](#effect-size)

**See Also**: [Statistical Concepts](04-statistical-concepts.md)

---

### Variance

**Definition**: A measure of data spread, equal to the squared standard deviation: $\sigma^2 = \frac{1}{n}\sum_{i=1}^{n}(x_i - \bar{x})^2$.

**Context**: Used internally in statistical calculations. The analyzer typically reports standard deviation instead of variance since it's in the same units as the data.

**Related Terms**: [Standard Deviation](#standard-deviation)

**See Also**: [Statistical Concepts](04-statistical-concepts.md)

---

### Survival Analysis

**Definition**: Statistical methods for analyzing time-until-event data, handling cases where the event hasn't occurred (censored observations).

**Context**: The analyzer uses Kaplan-Meier survival curves to show the probability of reaching 4+ hours of nightly CPAP use.

**Related Terms**: [Kaplan-Meier Survival Curve](#kaplan-meier-survival-curve), [Compliance](#compliance)

**See Also**: [Visualizations Guide](02-visualizations.md)

---

## Technical Terms

### CSV (Comma-Separated Values)

**Definition**: A plain-text file format where each line represents a data row, with fields separated by commas.

**Context**: OSCAR exports data as CSV files. The analyzer parses both Summary (nightly) and Details (event-level) CSVs. Must use `.` as decimal separator.

**Related Terms**: [Session](#session), [Export/Import](#exportimport)

**See Also**: [Getting Started](01-getting-started.md), [Data Dictionary](03-data-dictionary.md)

---

### Dashboard

**Definition**: A visual interface displaying multiple charts, metrics, and controls in a single view.

**Context**: The analyzer's main interface is a multi-section dashboard: Overview, Analytics, Apnea Clusters, False Negatives, Range Comparisons, and Raw Data Explorer.

**Related Terms**: [Visualization](#visualization), [Section](#section)

**See Also**: [Visualizations Guide](02-visualizations.md)

---

### Date Range Filter

**Definition**: UI controls that limit displayed data to a specific time period (e.g., "Last 30 days", "Custom range").

**Context**: Available in the header. Filters apply globally to all sections. Quick presets include 7/30/90 days and full range. Custom ranges support calendar date selection.

**Related Terms**: [Session](#session), [Filter](#filter)

**See Also**: [Visualizations Guide](02-visualizations.md), [Getting Started](01-getting-started.md)

---

### Export/Import

**Definition**: Saving application state to a file (export) or loading previously saved state (import).

**Context**: The analyzer can export sessions as JSON files for backup or sharing (without personal notes). Import restores parsed data without re-parsing CSV files.

**Related Terms**: [Session](#session), [JSON](#json), [IndexedDB](#indexeddb)

**See Also**: [Getting Started](01-getting-started.md)

---

### Filter

**Definition**: A constraint that limits which data is displayed or analyzed, such as date ranges or parameter thresholds.

**Context**: The main filter is the date range selector. Feature-specific filters (e.g., cluster parameters, false negative presets) are available in individual sections.

**Related Terms**: [Date Range Filter](#date-range-filter), [Session](#session)

**See Also**: [Visualizations Guide](02-visualizations.md)

---

### IndexedDB

**Definition**: A browser-based database API for storing large amounts of structured data client-side, with indexed queries.

**Context**: Used for optional session persistence ("Remember data locally"). Stores parsed CSV data so it survives page refreshes. Disabled by default for privacy; requires user consent.

**Related Terms**: [Local-First](#local-first), [Session](#session), [Persistence](#persistence)

**See Also**: [Getting Started](01-getting-started.md), [Disclaimers](08-disclaimers.md)

---

### JSON (JavaScript Object Notation)

**Definition**: A lightweight text format for structured data, using key-value pairs and arrays. Human-readable and machine-parseable.

**Context**: Session export files use JSON format. Smaller than CSV and includes metadata like date ranges and clustering parameters.

**Related Terms**: [Export/Import](#exportimport), [Session](#session)

**See Also**: [Getting Started](01-getting-started.md)

---

### OAuth (Open Authorization)

**Definition**: Industry-standard protocol for secure API authorization that allows applications to access user data without exposing passwords.

**Context**: Used for Fitbit integration. OAuth 2.0 with PKCE (Proof Key for Code Exchange) provides secure, time-limited access to heart rate and sleep data. Users can revoke access anytime via Fitbit account settings or analyzer Settings panel.

**Related Terms**: [Fitbit Integration](#fitbit-integration), [API](#api), [Encryption](#encryption)

**See Also**: [Fitbit Integration Guide](11-fitbit-integration.md), [Disclaimers](08-disclaimers.md)

---

### Local-First

**Definition**: Software architecture that processes data entirely on the user's device, without sending it to remote servers.

**Context**: The analyzer is 100% local-first: CSV files never leave your browser. All parsing, analysis, and storage happens client-side, ensuring privacy.

**Related Terms**: [IndexedDB](#indexeddb), [Web Worker](#web-worker), [Privacy](#privacy)

**See Also**: [Disclaimers](08-disclaimers.md), [Getting Started](01-getting-started.md)

---

### Persistence

**Definition**: Storing data across browser sessions so it remains available after closing the tab or restarting the browser.

**Context**: Optional session persistence uses IndexedDB. When enabled, parsed data and settings are saved automatically. Can be cleared anytime via "Clear Session".

**Related Terms**: [IndexedDB](#indexeddb), [Session](#session), [Local-First](#local-first)

**See Also**: [Getting Started](01-getting-started.md)

---

### Privacy

**Definition**: The protection of sensitive personal health information from unauthorized access or disclosure.

**Context**: The analyzer processes Protected Health Information (PHI) locally and never transmits data to servers. No analytics, tracking, or cloud storage. Users control all data via export/clear functions.

**Related Terms**: [Local-First](#local-first), [PHI](#phi), [IndexedDB](#indexeddb)

**See Also**: [Disclaimers](08-disclaimers.md)

---

### PHI (Protected Health Information)

**Definition**: Any individually identifiable health information, including CPAP therapy data, subject to privacy regulations like HIPAA.

**Context**: OSCAR exports contain PHI (dates, AHI values, pressure settings). The analyzer's local-first architecture and lack of server communication protect PHI privacy.

**Related Terms**: [Privacy](#privacy), [Local-First](#local-first)

**See Also**: [Disclaimers](08-disclaimers.md)

---

### Section

**Definition**: A major content area in the analyzer's dashboard, focusing on a specific analysis type (Overview, Analytics, etc.).

**Context**: Sections are navigable via the table of contents. Each section may contain multiple charts, tables, and controls. Implemented as feature modules in `src/features/`.

**Related Terms**: [Dashboard](#dashboard), [Feature Module](#feature-module)

**See Also**: [Visualizations Guide](02-visualizations.md)

---

### Session

**Definition**: The complete state of the analyzer at a given time: uploaded CSV data, date filters, parameters, and theme settings.

**Context**: Sessions can be persisted to IndexedDB or exported as JSON files. Useful for switching between multiple OSCAR exports or backing up analysis state.

**Related Terms**: [Export/Import](#exportimport), [Persistence](#persistence), [IndexedDB](#indexeddb)

**See Also**: [Getting Started](01-getting-started.md)

---

### SPA (Single-Page Application)

**Definition**: A web app that loads a single HTML page and dynamically updates content without full page reloads.

**Context**: The analyzer is an SPA built with React and Vite. All navigation happens client-side; sections mount/unmount based on user interaction.

**Related Terms**: [React](#react), [Vite](#vite)

**See Also**: [Architecture](../developer/architecture.md)

---

### Visualization

**Definition**: Graphical representation of data, such as charts, plots, and graphs.

**Context**: The analyzer uses Plotly.js for interactive visualizations: line charts (trends), scatter plots (correlations), box plots (distributions), histograms, and survival curves.

**Related Terms**: [Dashboard](#dashboard), [Plotly](#plotly), [Chart](#chart)

**See Also**: [Visualizations Guide](02-visualizations.md)

---

### Web Worker

**Definition**: A JavaScript API for running scripts in background threads, separate from the main UI thread.

**Context**: The analyzer uses web workers for CSV parsing and heavy analytics (clustering, false negative detection) to keep the interface responsive during long computations.

**Related Terms**: [Performance](#performance), [Background Processing](#background-processing)

**See Also**: [Architecture](../developer/architecture.md)

---

### React

**Definition**: A JavaScript library for building user interfaces using component-based architecture.

**Context**: The analyzer's UI is built with React functional components and hooks. State management uses Context API; no external state libraries.

**Related Terms**: [Component](#component), [Hook](#hook), [SPA](#spa-single-page-application)

**See Also**: [Architecture](../developer/architecture.md)

---

### Vite

**Definition**: A fast build tool and dev server for modern web projects, using native ES modules and optimized bundling.

**Context**: The analyzer uses Vite for development (hot module replacement) and production builds. Configured in `vite.config.js`.

**Related Terms**: [Build](#build), [Bundle](#bundle), [SPA](#spa-single-page-application)

**See Also**: [Setup Guide](../developer/setup.md)

---

### Component

**Definition**: A reusable, self-contained UI building block in React. Can be functional (hooks) or class-based (deprecated in this project).

**Context**: The analyzer is built from components: `<HeaderMenu />`, `<ThemedPlot />`, `<OverviewSection />`, etc. Components live in `src/components/` and `src/features/`.

**Related Terms**: [React](#react), [Feature Module](#feature-module)

**See Also**: [Architecture](../developer/architecture.md), [Adding Features](../developer/adding-features.md)

---

### Hook

**Definition**: React functions that let you "hook into" state and lifecycle features from functional components (e.g., `useState`, `useEffect`, custom hooks).

**Context**: The analyzer uses custom hooks extensively: `useData()` (context access), `useDateRangeFilter()` (filtering), `useSessionManager()` (persistence), etc.

**Related Terms**: [React](#react), [Component](#component), [Context](#context-api)

**See Also**: [Architecture](../developer/architecture.md)

---

### Context API

**Definition**: React's built-in mechanism for passing data through the component tree without prop drilling.

**Context**: `DataContext` provides parsed sessions, filters, and theme to all components. Accessed via `useData()` hook.

**Related Terms**: [React](#react), [Hook](#hook), [State Management](#state-management)

**See Also**: [Architecture](../developer/architecture.md)

---

### Feature Module

**Definition**: A self-contained directory in `src/features/` containing a section's components, logic, and tests.

**Context**: Modules like `overview/`, `apnea-clusters/`, `false-negatives/` export public APIs through `index.js`. Keeps code organized by domain.

**Related Terms**: [Section](#section), [Component](#component), [Module](#module)

**See Also**: [Architecture](../developer/architecture.md)

---

### Plotly

**Definition**: An open-source JavaScript charting library for creating interactive, publication-quality graphs.

**Context**: The analyzer uses `react-plotly.js` wrapper with `ThemedPlot` component for automatic dark/light theme switching. Supports zoom, pan, hover tooltips, and export.

**Related Terms**: [Visualization](#visualization), [Chart](#chart), [ThemedPlot](#themedplot)

**See Also**: [Visualizations Guide](02-visualizations.md)

---

### ThemedPlot

**Definition**: Custom wrapper component around Plotly that automatically applies dark/light theme colors.

**Context**: All charts use `<ThemedPlot />` instead of raw `<Plot />` to ensure consistent theming. Located at `src/components/ui/ThemedPlot.jsx`.

**Related Terms**: [Plotly](#plotly), [Theme](#theme), [Component](#component)

**See Also**: [Architecture](../developer/architecture.md), [Adding Features](../developer/adding-features.md)

---

### Chart

**Definition**: A graphical representation of data (line, bar, scatter, box plot, etc.).

**Context**: The analyzer displays 20+ chart types across sections. All are interactive Plotly visualizations with zoom, pan, and hover details.

**Related Terms**: [Visualization](#visualization), [Plotly](#plotly), [Dashboard](#dashboard)

**See Also**: [Visualizations Guide](02-visualizations.md)

---

### Theme

**Definition**: A set of colors, fonts, and styles applied consistently across the UI. Options: System (auto), Light, Dark.

**Context**: Toggle via sun/moon icon in header. Stored in localStorage. Charts automatically adapt via `ThemedPlot` wrapper.

**Related Terms**: [ThemedPlot](#themedplot), [Dark Mode](#dark-mode)

**See Also**: [Getting Started](01-getting-started.md)

---

### Dark Mode

**Definition**: A color scheme using dark backgrounds and light text, reducing eye strain in low-light environments.

**Context**: Enabled by setting theme to "Dark" or "System" (follows OS preference). All UI elements and charts adapt automatically.

**Related Terms**: [Theme](#theme), [Light Mode](#light-mode)

**See Also**: [Getting Started](01-getting-started.md)

---

### Light Mode

**Definition**: A color scheme using light backgrounds and dark text, traditional for web applications.

**Context**: Default theme. Can be explicitly selected or set via "System" to follow OS preference.

**Related Terms**: [Theme](#theme), [Dark Mode](#dark-mode)

**See Also**: [Getting Started](01-getting-started.md)

---

### Performance

**Definition**: How quickly and responsively the application processes data and renders UI.

**Context**: Critical for large OSCAR datasets. The analyzer optimizes via web workers, lazy rendering, and efficient algorithms. Most operations complete in < 5 seconds.

**Related Terms**: [Web Worker](#web-worker), [Optimization](#optimization)

**See Also**: [Architecture](../developer/architecture.md)

---

### Optimization

**Definition**: Techniques for improving code speed, memory usage, or user experience.

**Context**: The analyzer uses memoization, incremental rendering, worker offloading, and efficient data structures to handle multi-year datasets smoothly.

**Related Terms**: [Performance](#performance), [Web Worker](#web-worker)

**See Also**: [Architecture](../developer/architecture.md)

---

### Background Processing

**Definition**: Running computationally intensive tasks in separate threads to avoid blocking the UI.

**Context**: CSV parsing and analytics run in web workers. Main thread remains responsive for user interactions while processing continues.

**Related Terms**: [Web Worker](#web-worker), [Performance](#performance)

**See Also**: [Architecture](../developer/architecture.md)

---

### Build

**Definition**: The process of transforming source code into optimized production assets (minified JS, CSS, HTML).

**Context**: Run via `npm run build`. Vite outputs to `dist/` with code splitting, tree-shaking, and minification. Takes 2+ minutes.

**Related Terms**: [Vite](#vite), [Bundle](#bundle), [Deployment](#deployment)

**See Also**: [Setup Guide](../developer/setup.md)

---

### Bundle

**Definition**: Compiled JavaScript file(s) containing all application code and dependencies, ready for browser execution.

**Context**: Vite produces multiple bundles via code splitting: main app, Plotly, worker scripts. Total ~2MB uncompressed.

**Related Terms**: [Build](#build), [Vite](#vite), [Code Splitting](#code-splitting)

**See Also**: [Architecture](../developer/architecture.md)

---

### Code Splitting

**Definition**: Breaking application code into smaller chunks loaded on-demand, reducing initial load time.

**Context**: Vite automatically splits vendor libraries (React, Plotly) from app code. Workers are separate bundles.

**Related Terms**: [Bundle](#bundle), [Performance](#performance), [Lazy Loading](#lazy-loading)

**See Also**: [Architecture](../developer/architecture.md)

---

### Lazy Loading

**Definition**: Deferring loading of code or data until it's actually needed.

**Context**: The analyzer loads sections incrementally as user navigates. Heavy dependencies (Plotly) are code-split.

**Related Terms**: [Code Splitting](#code-splitting), [Performance](#performance)

**See Also**: [Architecture](../developer/architecture.md)

---

### Deployment

**Definition**: Publishing the application to a web server or hosting service for user access.

**Context**: Build via `npm run build`, then serve `dist/` from any static host (GitHub Pages, Netlify, S3, etc.). No server-side code required.

**Related Terms**: [Build](#build), [Static Site](#static-site)

**See Also**: [Setup Guide](../developer/setup.md)

---

### Static Site

**Definition**: A website consisting only of HTML, CSS, and JavaScript files, without server-side processing.

**Context**: The analyzer is a static site—no backend, databases, or APIs. Can be hosted on GitHub Pages or any static CDN.

**Related Terms**: [SPA](#spa-single-page-application), [Deployment](#deployment), [Local-First](#local-first)

**See Also**: [Architecture](../developer/architecture.md)

---

### State Management

**Definition**: Techniques for managing and synchronizing application data across components.

**Context**: The analyzer uses React Context API for global state (data, theme). Local state via `useState`. No Redux or external state libraries.

**Related Terms**: [Context API](#context-api), [React](#react), [Hook](#hook)

**See Also**: [Architecture](../developer/architecture.md)

---

### Module

**Definition**: A self-contained unit of code, typically a single file or directory, with defined imports/exports.

**Context**: The analyzer organizes code into ES modules: features, components, utils, hooks, workers. Import paths use Vite's `@` alias.

**Related Terms**: [Feature Module](#feature-module), [ES Modules](#es-modules)

**See Also**: [Architecture](../developer/architecture.md)

---

### ES Modules

**Definition**: JavaScript's native module system using `import` and `export` statements.

**Context**: All analyzer code uses ES modules. Vite handles bundling without requiring CommonJS transforms.

**Related Terms**: [Module](#module), [Vite](#vite)

**See Also**: [Architecture](../developer/architecture.md)

---

## Related Documentation

- **[Data Dictionary](03-data-dictionary.md)** — Detailed CSV column definitions and parsing conventions
- **[Statistical Concepts](04-statistical-concepts.md)** — Mathematical explanations of analysis methods
- **[Visualizations Guide](02-visualizations.md)** — How to interpret charts and sections
- **[Getting Started](01-getting-started.md)** — Installation and first use walkthrough
- **[Practical Tips](07-practical-tips.md)** — Advice for improving therapy outcomes
- **[Architecture](../developer/architecture.md)** — Technical system design
- **[Adding Features](../developer/adding-features.md)** — Developer guide for extending the analyzer
