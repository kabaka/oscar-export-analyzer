## Data Dictionary

**Summary CSV (night-level)**

- `Date`: used for ordering and window calculations.
- `Total Time`: `HH:MM:SS` converted to hours of usage.
- `AHI`: apnea–hypopnea index.
- `Median EPAP`: pressure in cmH₂O.
- Optional leak columns containing both "Leak" and "Median" or "%/time above" are included in correlation views.

**Details CSV (event-level)**

- `Event`: `ClearAirway`, `Obstructive`, `Mixed`, or `FLG` (flow limitation).
- `DateTime`: event start timestamp.
- `Data/Duration`: apnea duration in seconds or FLG level.

If your exports differ, adjust parsing keys in `src/utils/stats.js` and `src/utils/clustering.js`.
