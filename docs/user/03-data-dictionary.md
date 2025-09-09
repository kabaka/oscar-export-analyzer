# Data Dictionary

This chapter defines the fields expected in the OSCAR exports.  Knowing the meaning and units of each column helps when performing custom analyses or debugging parsing issues.

## Summary CSV (night‑level)
The summary file contains one row per night.  The analyzer expects at least the following columns:

| Column | Type | Units | Description |
| ------ | ---- | ----- | ----------- |
| `Date` | string | date | Night of sleep in `YYYY‑MM‑DD` format.  Used for ordering, rolling windows, and labeling charts. |
| `Total Time` | string or number | hours | Therapy usage.  `HH:MM:SS` is converted to decimal hours.  Nights with `0` are treated as missed. |
| `AHI` | number | events/hour | Apnea–Hypopnea Index.  Calculated by OSCAR as `(Central + Obstructive + Hypopnea events) / Hours Slept`. |
| `Median EPAP` | number | cmH₂O | Median expiratory positive airway pressure.  Correlated with airway patency. |
| Leak columns (optional) | number | L/min or % | Any column containing `Leak` and either `Median` or `%/time above` is ingested for correlation analysis. |

Additional columns such as `Pressure Min`, `Pressure Max`, or `Notes` are ignored by default but remain available in the Raw Data explorer.

## Details CSV (event‑level)
The details file lists individual events with timestamps.

| Column | Type | Description |
| ------ | ---- | ----------- |
| `Event` | string | One of `ClearAirway`, `Obstructive`, `Mixed`, or `FLG` (flow limitation).  Additional event types are ignored. |
| `DateTime` | string | Start time in local time zone, often `YYYY-MM-DD HH:MM:SS`.  Used for clustering and survival analysis. |
| `Data` / `Duration` | number | For apnea events, duration in seconds.  For `FLG`, the numeric flow‑limitation value (0–1). |

When present, a column named `machine` or `session` is preserved but not used.  Rows with missing or malformed timestamps are dropped during parsing and reported in the console.

## Units and Conventions
- **Time Zones** – OSCAR exports use the local time of the host computer.  The analyzer does not perform time‑zone conversion.
- **Decimal Separators** – CSVs must use `.` as the decimal separator.  European users should export with “International” locale.
- **Missing Data** – Empty cells become `null` and are excluded from calculations.  Nights with all metrics missing are skipped.

## Customizing Parsers
If your exports use different headers, you can adjust parsing keys in the source code:

- `src/utils/stats.js` – Configures summary metrics and rolling calculations.
- `src/utils/clustering.js` – Handles cluster and false‑negative detection parameters.

After modifying these files, rebuild the application and update this data dictionary accordingly.
