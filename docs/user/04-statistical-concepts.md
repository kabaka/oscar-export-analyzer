# Statistical Concepts

The analyzer applies a number of statistical techniques to summarize and compare therapy data. This chapter explains each method so results can be interpreted with confidence.

## Rolling Windows

Many charts show 7‑ and 30‑night rolling averages to smooth nightly variation. For a series $x_1, x_2, …, x_n$, the rolling mean of window $k$ at night $t$ is:

$$
\text{RollingMean}_k(t) = \frac{1}{k} \sum_{i=t-k+1}^{t} x_i
$$

Rolling medians are computed by sorting the last $k$ values and selecting the middle element. Windows include calendar days with missing data so gaps do not over‑weight subsequent nights.

## Confidence Intervals

To convey uncertainty, rolling means are accompanied by 95 % confidence intervals assuming approximately normal residuals:

$$
\text{CI}_{95} = \bar{x} \pm 1.96 \frac{s}{\sqrt{k}}
$$

where $\bar{x}$ is the window mean and $s$ is the sample standard deviation. For medians we use order‑statistic bounds derived from the binomial distribution.

## Change‑Point Detection

The analyzer marks structural breaks in usage and AHI series using least‑squares segmentation. The algorithm partitions the series into segments where the mean is relatively stable. Change‑points can highlight the start of a new therapy regimen or periods of non‑adherence.

## Mann–Whitney U Test

When comparing two date ranges, we avoid assumptions of normality by using the Mann–Whitney U test. Given groups $A$ and $B$:

$$
U_A = n_A n_B + \frac{n_A(n_A + 1)}{2} - R_A
$$

where $R_A$ is the sum of ranks assigned to group $A$. The `p`‑value indicates whether the distributions differ; the rank‑biserial effect size is computed as:

$$
\text{RB} = 1 - \frac{2U}{n_A n_B}
$$

with $U = \min(U_A, U_B)$.

## LOESS and Quantile Bands

Locally Estimated Scatterplot Smoothing (LOESS) fits a smooth curve to the EPAP×AHI scatter plot. It uses weighted least squares with tri‑cube kernel and span parameter `α` (default 0.5). The running quantile bands show the 50th and 90th percentile of AHI for each pressure bucket, illustrating how the bulk and tail of the distribution shift with pressure.

## QQ Plot

Quantile–quantile plots compare the sorted nightly AHI values to the theoretical quantiles of a normal distribution. The theoretical quantiles are computed using a Beasley–Springer/Moro approximation to the inverse normal CDF. Points that stray from the diagonal line indicate departures from normality such as skew or heavy tails.

## Partial Correlation

To isolate the relationship between two variables while controlling for others, we compute the partial correlation. For variables $X$, $Y$, and control variable $Z$:

$$
r_{XY \cdot Z} = \frac{r_{XY} - r_{XZ} r_{YZ}}{\sqrt{(1 - r_{XZ}^2)(1 - r_{YZ}^2)}}
$$

This is especially useful when examining EPAP vs. AHI while accounting for usage or leak rate.

## Survival Analysis

Kaplan–Meier curves estimate the probability that an apnea event lasts longer than $t$ seconds. The survival function is:

$$
S(t) = \prod_{t_i \le t} \left(1 - \frac{d_i}{n_i}\right)
$$

where $d_i$ is the number of events ending at time $t_i$ and $n_i$ is the number still active just before $t_i$. Steeper drops indicate many long events.

## Clustering Parameters

Apnea clusters are sequences of events separated by less than a specified gap (default 90 s). Optionally, flow‑limitation segments can bridge gaps shorter than the **FLG bridge** parameter. The analyzer sorts FLG readings once and scans them linearly to bridge gaps and extend cluster edges. The severity score for a cluster is:

$$
\text{Severity} = \frac{\text{EventCount}}{\text{Duration}}
$$

Clusters with high severity may indicate positional apnea or inadequate pressure response.

## False‑Negative Presets

The analyzer scans for intervals of sustained high flow limitation that lack apnea labels. Presets adjust three thresholds:

- **FLG Threshold** – Minimum flow‑limitation level.
- **Minimum Duration** – Minimum length of the interval.
- **Confidence** – Required peak FLG to consider the interval suspicious.

A strict preset requires higher thresholds, while a lenient preset flags more potential false negatives but increases noise.

---

## See Also

- [Visualizations and Interpretation](02-visualizations.md) — See these statistical methods applied in charts and analyses
- [Glossary](glossary.md) — Quick reference for statistical and medical terminology
- [Practical Tips](07-practical-tips.md) — How to use statistical insights to improve therapy outcomes
- [FAQ](05-faq.md) — Common questions about rolling averages and statistical calculations

---
