# CLI Analysis Tool

OSCAR Export Analyzer includes a command-line tool (`analysis.js`) for batch processing and detailed event cluster analysis. Unlike the web interface, the CLI script runs in Node.js and is optimized for:

- Scripting and automation workflows
- Analyzing specific dates without loading the full dataset into a browser
- Generating reproducible cluster reports for documentation or debugging
- Experimenting with different clustering algorithms and parameters

The CLI uses the same clustering algorithms as the web UI, so results should match what you see in the browser (given identical parameters).

## Prerequisites

- [Node.js 20 or later](https://nodejs.org/)
- OSCAR Details CSV export (the CLI requires event-level data)
- Basic command-line familiarity

## Installation

The CLI tool is part of the main repository. After cloning and installing dependencies, you can run it directly:

```bash
git clone https://github.com/kabaka/oscar-export-analyzer.git
cd oscar-export-analyzer
npm install
```

No additional installation steps are required—`analysis.js` imports shared utilities from the `src/` directory.

## Basic Usage

### Syntax

```bash
node analysis.js <detailsCsv> [YYYY-MM-DD] [gapSec] [flgBridgeThreshold] [flgClusterGapSec] [options]
```

### Positional Arguments

1. **`<detailsCsv>`** (required) — Path to your OSCAR Details CSV export
2. **`[YYYY-MM-DD]`** (optional) — Target date to analyze (default: `2025-06-15`)
3. **`[gapSec]`** (optional) — Maximum gap in seconds between events in same cluster (default: `240`)
4. **`[flgBridgeThreshold]`** (optional) — Minimum FLG level to bridge events (default: `0.3`)
5. **`[flgClusterGapSec]`** (optional) — Maximum gap when bridging with FLG events (default: `600`)

### Named Options (Flags)

- **`--algorithm=<name>`** — Clustering algorithm to use. Options:
  - `time-gap` (default) — Simple time-based clustering
  - `flg-bridge` — Bridge events with flow-limitation data
  - `kmeans` — K-means spatial clustering
  - `single-linkage` — Hierarchical clustering
- **`--k=<number>`** — Number of clusters for k-means algorithm (default: `3`)
- **`--linkage-threshold-sec=<seconds>`** — Distance threshold for single-linkage clustering (default: `300`)

### Examples

**Analyze a specific date with default settings:**

```bash
node analysis.js ~/oscar-exports/Details_20240101.csv 2024-01-15
```

**Use FLG-bridging algorithm with custom parameters:**

```bash
node analysis.js ~/oscar-exports/Details_20240101.csv 2024-01-15 \
  --algorithm=flg-bridge \
  240 0.4 600
```

**Run k-means clustering with 5 clusters:**

```bash
node analysis.js ~/oscar-exports/Details_20240101.csv 2024-02-20 \
  --algorithm=kmeans \
  --k=5
```

**Use single-linkage hierarchical clustering:**

```bash
node analysis.js ~/oscar-exports/Details_20240101.csv 2024-03-10 \
  --algorithm=single-linkage \
  --linkage-threshold-sec=420
```

## Understanding the Output

The CLI prints cluster analysis results to stdout. A typical run looks like:

```
Reading details from /path/to/Details_20240115.csv
Parsed 1847 apnea summary events, 3204 FLG events
Using time-gap clustering (gap=240s, bridge≥0.3, bridgeGap=600s, k=3, linkageThreshold=300s)
Detected apnea clusters for 2024-01-15:
Cluster 1:
  Start:    2024-01-15T02:34:12.000Z
  End:      2024-01-15T02:41:28.000Z
  Duration: 436.0 sec
  Events:
    Obstructive @ 2024-01-15T02:34:12.000Z dur=18s
    ClearAirway @ 2024-01-15T02:35:45.000Z dur=12s
    Obstructive @ 2024-01-15T02:38:02.000Z dur=22s
    Mixed @ 2024-01-15T02:40:15.000Z dur=15s
  FLG levels: min=0.2, max=0.8 (42 samples)
  Pressure:   min=8.4, max=11.2
  EPAP:       min=6.0, max=7.5
Cluster 2:
  ...
```

### Output Sections

- **Header** — Confirms file path, event counts, and algorithm parameters
- **Cluster summary** — Each cluster meeting the minimum criteria (≥2 events, ≥30s total duration, ≤1800s cluster span)
- **Event details** — Individual apnea events within each cluster (type, timestamp, duration)
- **FLG levels** — Flow-limitation data range during cluster (if available)
- **Pressure/EPAP** — Therapy pressure ranges during cluster (if available)

If no clusters are detected, the tool prints:

```
No apnea clusters (≥2 events and ≥30s total) found for 2024-01-15
```

This is expected for nights with low AHI or well-distributed events.

## Clustering Algorithms

The CLI supports four algorithms matching the web UI:

### 1. Time-Gap Clustering (default)

Groups events within `gapSec` seconds of each other. Simple and fast.

**Use when:** You want basic temporal clustering without flow-limitation data.

### 2. FLG-Bridge Clustering

Extends time-gap clustering by bridging longer gaps if flow-limitation levels exceed `bridgeThreshold`. This captures clusters where events are separated by sustained flow-limitation rather than clear breathing.

**Use when:** Your Details CSV includes FLG data and you want more sophisticated cluster detection.

**Parameters:**

- `gapSec` — Standard gap tolerance
- `bridgeThreshold` — Minimum FLG level to treat as a bridge (0.0–1.0 scale)
- `bridgeSec` — Maximum bridged gap duration

### 3. K-Means Clustering

Partitions events into `k` clusters using spatial clustering on event timestamps and durations. Useful for discovering patterns across an entire night.

**Use when:** You want to identify temporal patterns rather than strict adjacency.

**Parameters:**

- `--k=<number>` — Number of clusters to find

### 4. Single-Linkage Clustering

Hierarchical clustering that merges events if they're within `linkageThresholdSec` of any event in an existing cluster.

**Use when:** You want flexible cluster boundaries that can span variable gaps.

**Parameters:**

- `--linkage-threshold-sec=<seconds>` — Maximum distance for linkage

## Output Redirection

Direct output to a file for batch processing:

```bash
node analysis.js details.csv 2024-01-15 > report-2024-01-15.txt
```

Or filter for specific cluster numbers:

```bash
node analysis.js details.csv 2024-01-15 | grep "Cluster 1:"
```

## Scripting Multiple Dates

Process a date range with a shell loop:

```bash
#!/bin/bash
for date in $(seq -f "2024-01-%02g" 1 31); do
  echo "Processing $date"
  node analysis.js details.csv "$date" >> monthly-report.txt
done
```

## Troubleshooting

### "Cannot find module" error

Ensure you've installed dependencies:

```bash
npm install
```

### CSV parsing errors

Check that:

- The file is a valid OSCAR Details export (not Summary)
- Column names match OSCAR's format: `DateTime`, `Event`, `Data`/`Duration`
- The file uses UTF-8 encoding

### "No clusters found" despite high AHI

Try relaxing parameters:

- Increase `gapSec` to capture more widely spaced events
- Lower `bridgeThreshold` to allow weaker FLG bridging
- Verify the target date exists in your export: events must start with the exact date string

### Different results vs. web UI

Confirm parameters match:

- Check default values in the web UI's cluster settings modal
- Ensure you're using the same clustering algorithm
- Date filters in the web UI may exclude certain events; the CLI processes all events for the specified date

## Advanced Use Cases

### Comparing Algorithms

Run the same date through multiple algorithms to compare cluster detection strategies:

```bash
for algo in time-gap flg-bridge kmeans single-linkage; do
  echo "=== $algo ==="
  node analysis.js details.csv 2024-01-15 --algorithm=$algo
done
```

### Finding Optimal Parameters

Sweep parameter ranges to find the best clustering for your data:

```bash
#!/bin/bash
for gap in 120 180 240 300 360; do
  echo "Testing gap=$gap"
  node analysis.js details.csv 2024-01-15 $gap | grep "Detected"
done
```

### Integration with Research Tools

Export cluster data to CSV for further analysis:

```bash
node analysis.js details.csv 2024-01-15 | \
  grep "Cluster" | \
  awk '{print $2, $4}' > clusters.csv
```

## Relationship to Web UI

The CLI and web UI share the same clustering algorithms (`src/utils/clustering.js`) and constants (`src/constants.js`). Key differences:

| Feature                | Web UI                        | CLI                 |
| ---------------------- | ----------------------------- | ------------------- |
| **Data input**         | Drag-and-drop CSV upload      | File path argument  |
| **Date filtering**     | Interactive date range picker | Single date per run |
| **Visualization**      | Interactive Plotly charts     | Text output only    |
| **Persistence**        | IndexedDB session storage     | No persistence      |
| **Cluster parameters** | Settings modal with presets   | Command-line flags  |
| **Output format**      | Charts and tables             | Console text        |
| **Batch processing**   | Manual re-upload              | Script loops        |

**When to use each:**

- **Web UI**: Exploring data, comparing date ranges, sharing visual reports
- **CLI**: Automation, reproducible analysis, scripting workflows, debugging algorithms

## Future Enhancements

Possible improvements for the CLI tool:

- JSON output format for structured data export
- CSV output mode for spreadsheet import
- Batch date processing with glob patterns
- Integration with OSCAR's SQLite database (read directly)
- Statistical summaries across date ranges

Community contributions for these features are welcome!

## See Also

- [Architecture — Clustering Algorithms](architecture.md#workers-for-heavy-lifting)
- [User Guide — Apnea Clusters](../user/02-visualizations.md#apnea-event-clusters)
- [Data Dictionary — Event Types](../user/03-data-dictionary.md)
- [Adding Features — Algorithm Development](adding-features.md)
