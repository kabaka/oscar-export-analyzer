# OSCAR Export Analyzer — User Guide

This guide shows how to load OSCAR CSV exports and interpret the resulting charts and tables.

## Getting Started

- **Files to load**
  - Summary CSV: provides nightly metrics such as `Date`, `Total Time`, `AHI`, and `Median EPAP`.
  - Details CSV (optional): enables event, cluster, and false-negative analyses using `Event`, `DateTime`, and `Data/Duration` columns.
- Use the **Summary CSV** and **Details CSV** pickers to upload files. Large files are parsed in a web worker and show progress bars.
- Toggle **Light / Dark / System** theme from the header.
- Enable **Remember data locally** to persist files and settings in the browser. Use **Save/Load/Clear** or **Export/Import JSON** for sharing sessions.
