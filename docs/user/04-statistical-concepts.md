## Statistical Concepts

- **Rolling Windows**: Metrics like 7‑ and 30‑night averages use calendar‑day inclusion so gaps in data do not skew results.
- **Confidence Intervals**: Rolling means use a normal approximation; medians use order‑statistic bounds.
- **Mann–Whitney U Test**: Non‑parametric test for comparing two ranges. Reports p‑value and rank‑biserial effect size.
- **Change‑Point Detection**: Least‑squares segmentation marks structural breaks in AHI and usage series.
- **LOESS and Quantile Bands**: Smooth the EPAP×AHI relationship and summarize central (p50) and high‑end (p90) burden.
- **Partial Correlation**: Controls for confounders like usage or leak when examining EPAP vs. AHI.
- **Survival Analysis**: Kaplan–Meier curves show probability of event durations exceeding t seconds.
- **Clustering Parameters**: Gap, FLG bridging, edge thresholds, and density filters govern apnea cluster detection.
- **False‑Negative Presets**: Strict/Balanced/Lenient options adjust FLG threshold, duration, and confidence requirements.
