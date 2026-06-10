# Google Health (Fitbit) Export — Data Catalog

**Purpose:** Factual reconnaissance of a real Google Health (formerly Fitbit) Takeout export to
inform the design of an ingestion pipeline + data model for OSCAR Export Analyzer (correlating
wearable data with CPAP sleep-therapy nights).

**Source:** a local Google Takeout `Google Health/` export directory — ~10 GB, **32,738 files**
(23,944 CSV + 8,692 JSON), spanning **2014-05 → 2026-06**.

> **PHI handling:** This catalog records _schemas, structure, volumes, and synthetic-shaped
> examples only_. No real health values from the export are reproduced here. All "shape" examples
> below use fabricated/placeholder numbers that merely illustrate field types and formats.

---

## 0. Executive summary (the parts that drive the design)

1. **Massive redundancy.** Nearly every metric exists 2–3 times at different resolutions and in
   different formats. The single most important design decision is picking **one canonical source
   per metric** (see §2). The two giant directories — `Global Export Data` (6.9 GB) and
   `Physical Activity_GoogleData` (3.3 GB) — are largely the **same data in two encodings** (JSON
   `MM/DD/YY` local vs CSV ISO-8601-with-Z + `data source` column).
2. **Heart rate dominates volume.** ~67 M raw HR samples lifetime, **6.1 GB** as JSON. Sampling
   density jumped from ~12 k/day (older trackers) to **~42 k/day in 2025** (Pixel Watch, ~2–5 s
   cadence). HR must be aggregated, never ingested raw at full resolution.
3. **Sleep sessions are the linchpin.** `Global Export Data/sleep-*.json` carries full stage
   timelines, efficiency, and a `logId`. That `logId` joins to sleep scores and is the natural
   key for deriving a "night window" to align all other wearable data to a CPAP night (§3b).
4. **Several concrete data-quality traps** (§4): two datetime formats + Z/no-Z + epoch-1970
   placeholders + Unix-epoch-seconds, a **SpO2 = 50.0 sentinel** (≈15 % of minute rows = invalid
   floor), pseudo-JSON embedded in CSV cells with **unquoted enum tokens** (invalid JSON), and
   `classic` vs `stages` sleep schema drift.
5. **v1 ingestion scope** (§5): sleep stages, SpO2 (nightly + minute-in-night), HR (resting +
   nightly aggregates), HRV, respiratory rate, readiness, stress, snore, AZM. Defer social,
   account, commerce, GPS, glucose (empty), menstrual.

---

## 1. Per-category inventory

Sizes/counts from `du`/`find` on 2026-06-10. "Granularity" = temporal resolution of a row/record.

### 1.1 Global Export Data — `Global Export Data/` (6.9 GB, 11,849 files, mostly JSON)

The primary high-resolution JSON store. Two file-dating schemes coexist:

- **Per-day** files: `<metric>-YYYY-MM-DD.json` (heart_rate, time_in_heart_rate_zones,
  estimated_oxygen_variation).
- **~30-day chunk** files: `<metric>-YYYY-MM-DD.json` where the date is the chunk _start_, spaced
  ~30 days apart (steps, calories, distance, sleep, altitude, very/moderately/lightly_active_minutes,
  sedentary_minutes, weight). 144–147 files each ≈ monthly cadence over the 12-year span.
- **Per-year** files: `resting_heart_rate-YYYY-MM-DD.json`, `demographic_vo2_max-*` (13/11 files).
- **Sequence-numbered**: `exercise-N.json`, `swim_lengths_data-*` (paged logs, 100 records/page).

| Metric (file prefix)                      | Format  | Files  | Granularity              | Datetime format                               | Date range              |
| ----------------------------------------- | ------- | ------ | ------------------------ | --------------------------------------------- | ----------------------- |
| `heart_rate-`                             | JSON    | 3,541  | per-sample (~2–5 s)      | `MM/DD/YY HH:MM:SS` (local)                   | 2016-08-24 → 2026-06-09 |
| `time_in_heart_rate_zones-`               | JSON    | 3,541  | daily (1 rec/file)       | `MM/DD/YY HH:MM:SS`                           | 2016 → 2026             |
| `estimated_oxygen_variation-`             | **CSV** | 3,157  | per-minute               | `MM/DD/YY HH:MM:SS`                           | 2017-09-27 → 2026       |
| `sleep-`                                  | JSON    | 144    | per-session (~30/file)   | **ISO-8601 no Z** (`2024-02-22T07:41:30.000`) | 2014-05-15 → 2026-05-12 |
| `steps-`                                  | JSON    | 147    | per-minute               | `MM/DD/YY HH:MM:SS`                           | 2014 → 2026             |
| `calories-`                               | JSON    | 147    | per-minute (43,200/file) | `MM/DD/YY HH:MM:SS`                           | 2014 → 2026             |
| `distance-`                               | JSON    | 147    | per-minute               | `MM/DD/YY HH:MM:SS`                           | 2014 → 2026             |
| `altitude-`                               | JSON    | 147    | per-minute (sparse)      | `MM/DD/YY HH:MM:SS`                           | 2014 → 2026             |
| `*_active_minutes-`, `sedentary_minutes-` | JSON    | 147 ea | daily (≈30 rec/file)     | `MM/DD/YY HH:MM:SS`                           | 2014 → 2026             |
| `resting_heart_rate-`                     | JSON    | 13     | daily (365/file)         | nested `MM/DD/YY`                             | 2014 → 2026             |
| `demographic_vo2_max-`                    | JSON    | 11     | daily                    | `MM/DD/YY HH:MM:SS`                           | 2015 → 2026             |
| `weight-`                                 | JSON    | 112    | per-entry                | local                                         | 2014 → 2025             |
| `exercise-N`                              | JSON    | 45     | per-workout (100/page)   | ISO-ish                                       | full span               |
| `swim_lengths_data-`                      | JSON    | 106    | per-lap                  | `MM/DD/YY HH:MM:SS`                           | —                       |

**Schemas (shapes are synthetic):**

- `heart_rate-*.json` — array of `{ "dateTime": "MM/DD/YY HH:MM:SS", "value": { "bpm": <int>, "confidence": <0..3> } }`. ~10k–42k records/file (per day).
- `time_in_heart_rate_zones-*.json` — 1 record/file: `value.valuesInZones` = `{ BELOW_DEFAULT_ZONE_1, IN_DEFAULT_ZONE_1, IN_DEFAULT_ZONE_2, IN_DEFAULT_ZONE_3 }` → minutes in each zone that day.
- `estimated_oxygen_variation-*.csv` — `timestamp,Infrared to Red Signal Ratio` per minute. **NOT calibrated SpO2** — a raw IR/Red ratio proxy; the real SpO2 % lives in the `Oxygen Saturation (SpO2)` dir.
- `sleep-*.json` — see §3b for the full structure (the most important schema in the export).
- `steps-/distance-/calories-/altitude-*.json` — `{ "dateTime": "MM/DD/YY HH:MM:SS", "value": "<string-number>" }` per minute. **`value` is a string**, not a number.
- `resting_heart_rate-*.json` — `{ "dateTime": "...", "value": { "date": "MM/DD/YY", "value": <float bpm>, "error": <float> } }`, one per day.
- `demographic_vo2_max-*.json` — `value` = `{ demographicVO2Max, demographicVO2MaxError, filteredDemographicVO2Max, filteredDemographicVO2MaxError }`.
- `exercise-*.json` — workout logs: `logId, activityName, activityTypeId, activityLevel[{minutes,name}], calories, duration, activeDuration, steps, startTime, hasGps, hasActiveZoneMinutes, …`.
- `swim_lengths_data-*.json` — `value` = `{ lapDurationSec, strokeCount, swimStrokeType, swimAlgorithmType }`.

### 1.2 Physical Activity_GoogleData — `Physical Activity_GoogleData/` (3.3 GB, 10,149 files, CSV)

Google's **CSV re-export of the same telemetry**, plus a few metrics not in Global Export. Naming
uses **underscore** separators: `<metric>_YYYY-MM-DD.csv`. Every file carries a trailing
`data source` column (e.g. `Pixel Watch`, `Fitbit App`) — useful for provenance/device attribution.

| Metric (prefix)                                                | Files      | Granularity      | Notes / schema                                                                               |
| -------------------------------------------------------------- | ---------- | ---------------- | -------------------------------------------------------------------------------------------- |
| `heart_rate_`                                                  | 3,538      | per-sample       | `timestamp(ISO+Z),beats per minute,data source`. **2.2 GB** total. Duplicates §1.1 HR.       |
| `sedentary_period_`                                            | 3,536      | per-interval     | `start time,end time,data source` (ISO+Z). Sedentary bouts.                                  |
| `body_temperature_`                                            | 1,013      | per-night        | wrist/skin temp; overlaps `Temperature/` dir.                                                |
| `oxygen_saturation_`                                           | 67         | per-minute       | `timestamp,oxygen saturation percentage,data source`. Duplicates Minute SpO2.                |
| `heart_rate_variability_`                                      | 70         | per-5-min        | `timestamp,root mean square of successive differences ms,standard deviation ms,data source`. |
| `respiratory_rate_sleep_summary_`                              | 70         | per-night        | per-stage breathing rate in **milli-breaths/min** (note unit).                               |
| `active_zone_minutes_`                                         | 70         | per-minute       | duplicates `Active Zone Minutes (AZM)/`.                                                     |
| `steps_/distance_/calories_/floors_/altitude_/activity_level_` | 142–146 ea | per-minute/daily | duplicates Global Export.                                                                    |
| `time_in_heart_rate_zone_`, `calories_in_heart_rate_zone_`     | 119–146    | daily            | zone minutes/calories.                                                                       |
| `live_pace_`, `gps_location_`                                  | 157 / 90   | per-second       | GPS tracks for workouts (privacy-sensitive — location).                                      |
| `cardio_load_`                                                 | 19         | per-minute       | `timestamp,workout,background,total,data source`. Newer Pixel metric.                        |
| `hydration_log_`                                               | 79         | per-entry        | manual water logging.                                                                        |
| `body_fat_`, `weight.csv`, `core_body_temperature_`            | 97 / 1 / 7 | per-entry        | body composition.                                                                            |
| `heart_rate_notification_`                                     | 19         | per-event        | high/low HR alerts.                                                                          |
| `mindfulness_session_`                                         | 9          | per-session      | overlaps Mindfulness dir.                                                                    |
| `daily_heart_rate_zones.csv`                                   | 1          | daily            | **GOTCHA file** — embedded pseudo-JSON in a cell + 1970 timestamps (§4).                     |

### 1.3 Oxygen Saturation (SpO2) — `Oxygen Saturation (SpO2)/` (28 MB, 1,913 files, CSV)

The canonical **calibrated SpO2 %** source, measured during sleep. Range 2020-09-01 → 2026-06-09
(SpO2 only exists from when an SpO2-capable device was used).

- **`Minute SpO2 - YYYY-MM-DD.csv`** (1,889 files) — per-minute during sleep:
  `timestamp(ISO+Z),value`. **README claims** extra columns (`confidence,coverage,valid,unused`)
  but **sampled files only contain `timestamp,value`** → schema drift / README ahead of export.
  **SpO2 = 50.0 sentinel:** ~15 % of rows are exactly `50.0`, and _every_ sub-70 value equals
  exactly 50.0 → invalid/low-confidence readings are floored to 50.0, NOT real desaturations (§4).
- **`Daily SpO2 - <start>-<end>.csv`** (22 files, ~100-day chunks) — daily aggregate:
  `timestamp(ISO+Z),average_value,lower_bound,upper_bound`.

### 1.4 Heart Rate Variability — `Heart Rate Variability/` (29 MB, 5,889 files, CSV)

Range 2020-09-01 → 2026-06-08. Multiple related products:

| File pattern                                              | Files | Granularity                | Schema                                                            |
| --------------------------------------------------------- | ----- | -------------------------- | ----------------------------------------------------------------- |
| `Heart Rate Variability Details - YYYY-MM-DD.csv`         | 1,978 | **per-5-min during sleep** | `timestamp(ISO no Z),rmssd,coverage,low_frequency,high_frequency` |
| `Daily Heart Rate Variability Summary - YYYY-MM-(DD).csv` | 1,916 | nightly                    | `timestamp,rmssd,nremhr,entropy` (`nremhr`=non-REM HR)            |
| `Daily Respiratory Rate Summary - *.csv`                  | 1,851 | nightly                    | `timestamp,daily_respiratory_rate` (breaths/min)                  |
| `Respiratory Rate Summary - *.csv`                        | 70    | nightly per-stage          | full/deep/light/rem breathing_rate + std-dev + signal_to_noise    |
| `Heart Rate Variability Histogram - *.csv`                | 70    | nightly                    | `timestamp,bucket_values` = **29-bin array in a quoted CSV cell** |

> Note the **inconsistent filename date suffix** on Daily HRV Summary: `... - 2020-11-(15).csv`
> (parenthesized day). Parsers must tolerate this.

### 1.5 Temperature — `Temperature/` (46 MB, 1,884 files, CSV)

Range 2020-05-19 → **2024-06-06** (stops mid-2024 → continues in `Physical Activity_GoogleData/body_temperature_*` and `Body Temperature_GoogleData`).

| Pattern                        | Files | Granularity   | Schema highlights                                                                                                                          |
| ------------------------------ | ----- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `Computed Temperature - *.csv` | 31    | **per-night** | `type,sleep_start,sleep_end,temperature_samples,nightly_temperature,baseline_relative_*` → has sleep window + nightly skin temp deviation. |
| `Device Temperature - *.csv`   | 1,010 | per-reading   | raw device temp.                                                                                                                           |
| `Wrist Temperature - *.csv`    | 838   | per-night     | wrist/skin temp.                                                                                                                           |
| `Manual Temperature - *.csv`   | 5     | per-entry     | manual logs.                                                                                                                               |

`Computed Temperature` carries `sleep_start`/`sleep_end` → an independent source of night windows
and `nightly_temperature` (relative to baseline) is clinically interesting (fever, illness, cycle).

### 1.6 Active Zone Minutes (AZM) — `Active Zone Minutes (AZM)/` (1.7 MB, 71 files, CSV)

`Active Zone Minutes - YYYY-MM-01.csv` (monthly), range 2020-08 → 2026-06.
Schema: `date_time(ISO no Z),heart_zone_id(FAT_BURN|CARDIO|PEAK),total_minutes` — per-minute rows
where an AZM was earned.

### 1.7 Daily Readiness — `Daily Readiness/` (152 KB, 38 files, CSV)

`Daily Readiness Score - YYYY-MM-01.csv` (monthly, 36 files), range from 2021-11.
Schema: `date,readiness_score_value,readiness_state(LOW|MED|HIGH),activity_subcomponent,sleep_subcomponent,hrv_subcomponent,activity_state,sleep_state,hrv_state`.
One row/day. Readiness explicitly blends sleep + HRV + activity → high correlation value with CPAP.
Plus `Daily Readiness User Properties` (config).

### 1.8 Sleep Score — `Sleep Score/` (164 KB, 1 file, CSV)

**`sleep_score.csv`** — one row per sleep session, the whole history in a single file:
`sleep_log_entry_id,timestamp(ISO+Z),overall_score,composition_score,revitalization_score,duration_score,deep_sleep_in_minutes,resting_heart_rate,restlessness`.
**`sleep_log_entry_id` == the `logId` in `sleep-*.json`** → the join key linking scores to sessions.

### 1.9 Stress Score — `Stress Score/` (136 KB, CSV)

**`Stress Score.csv`** — one file, one row/day:
`DATE,UPDATED_AT,STRESS_SCORE,SLEEP_POINTS,MAX_SLEEP_POINTS,RESPONSIVENESS_POINTS,MAX_RESPONSIVENESS_POINTS,EXERTION_POINTS,MAX_EXERTION_POINTS,STATUS,CALCULATION_FAILED`. Range from 2020-10.

### 1.10 Snore and Noise Detect — `Snore and Noise Detect/` (17 MB, 520 files, CSV)

`Snore Details - YYYY-MM-DD.csv` (519 files), per-night, range from 2021-09.
Schema (**per-30-second** during sleep): `timestamp(ISO no Z),mean_dba,max_dba,min_dba,events_number,snoring_events_number,snore_label(0|1),sample_duration`.
**Directly CPAP-relevant** — overnight snoring/ambient-noise correlates with therapy efficacy & leaks.

### 1.11 Health Fitness Data_GoogleData — `Health Fitness Data_GoogleData/` (42 MB, 102 files, CSV)

Google's normalized relational re-export. Each entity is sharded into a few large CSVs + a README.
The **most valuable timezone-aware** sleep tables live here:

| Entity                                                                                                                   | Files | Granularity       | Key schema                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------ | ----- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `UserSleeps_*`                                                                                                           | 13    | per-session       | `sleep_id,sleep_type(CLASSIC                                                                                                                                                                                                                                     | STAGES),minutes_in_sleep_period,minutes_asleep,minutes_awake,minutes_to_fall_asleep,start_utc_offset,sleep_start(UTC),end_utc_offset,sleep_end(UTC),data_source,algorithm_version,…`. **Has explicit UTC offsets** → resolves timezone ambiguity. |
| `UserSleepStages_*`                                                                                                      | 11    | per-stage-segment | `sleep_id,sleep_stage_type(LIGHT                                                                                                                                                                                                                                 | DEEP                                                                                                                                                                                                                                              | REM | WAKE),start_utc_offset,sleep_stage_start(UTC),end_utc_offset,sleep_stage_end(UTC),…`. Flat alternative to nested `sleep-\*.json` `levels.data`. |
| `UserSleepScores_*`                                                                                                      | 8     | per-session       | `sleep_id,overall_score,duration_score,composition_score,revitalization_score,sleep_time_minutes,deep_sleep_minutes,rem_sleep_percent,resting_heart_rate,waso_count_*,restlessness_normalized,hr_below_resting_hr,…`. Richer than `Sleep Score/sleep_score.csv`. |
| `UserExercises_*`                                                                                                        | 12    | per-workout       | exercise logs.                                                                                                                                                                                                                                                   |
| `UserDemographicData`, `UserProfileData`, `UserLocationCountry`                                                          | 1 ea  | profile           | static.                                                                                                                                                                                                                                                          |
| `MedicalRecords`, `UserJournalEntries`, `UserFoodFrequencyEntries`, `UserConversations`, `UserMBDData`, premium/settings | 1 ea  | misc              | mostly out of scope.                                                                                                                                                                                                                                             |

> **`sleep_id` here is a different (larger, 19-digit) identifier than the `logId` in
> `sleep-*.json`/`sleep_score.csv`.** Cross-source join on sleep needs to be done on
> **timestamp/night**, not on raw id, unless a mapping is found. Flag for the pipeline.

### 1.12 Smaller clinical / contextual categories

| Dir                                                                                                                  | Size/Files  | Content                                                                                                                                                                                                                             | Granularity                                   |
| -------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------- |
| `Atrial Fibrillation ECG/`                                                                                           | 1.2 MB, 29  | `afib_ecg_reading_<epoch_ms>.csv` — single ECG reading: `reading_id,reading_time("Thu Oct 08 07:15:06 UTC 2020"),result_classification(NSR                                                                                          | …),heart_rate,…,<embedded ECG sample array>`. | per-reading (30 s waveform) |
| `Atrial Fibrillation PPG/`                                                                                           | 8 KB, 2     | AFib PPG assessment summaries.                                                                                                                                                                                                      | per-assessment                                |
| `Mindfulness/`                                                                                                       | 116 KB, 12  | `Mindfulness Eda Data Sessions - *.csv`: `session_id,timestamp(UNIX epoch seconds),valid_data,activation,scl_avg`. **Unix-epoch-seconds timestamps.**                                                                               | per-EDA-session                               |
| `Body Temperature_GoogleData/`                                                                                       | 28 KB, 2    | `Pixel Body Temperatures.csv` — manual thermometer readings: `measurement_timestamp,body_temperature_celsius,measurement_location,…` + a huge HTML guide blob per row.                                                              | per-reading                                   |
| `Biometrics/`                                                                                                        | 920 KB, 230 | `Glucose <YYMM>.csv` — **all files contain "no data"** (no glucose device). Skip.                                                                                                                                                   | —                                             |
| `Stress Journal/`                                                                                                    | 4 KB, 1     | journal config (no `.csv` data rows).                                                                                                                                                                                               | —                                             |
| `Menstrual Health/`                                                                                                  | 20 KB, 5    | `menstrual_health_{cycles,symptoms,birth_control,settings}.csv`.                                                                                                                                                                    | per-entry                                     |
| `Sleep/` (top-level)                                                                                                 | 8 KB, 2     | **`Sleep Profile.csv`** — Premium monthly "sleep animal" archetype: `creation_date,sleep_type(animal),deep_sleep,rem_sleep,sleep_duration,sleep_start_time,schedule_variability,restorative_sleep,…`. Aggregate, not session-level. | monthly                                       |
| `Heart Rate/` (top-level)                                                                                            | 12 KB, 3    | **Notification config only** — `Heart Rate Notifications {Alerts,Profile}.csv` (`id,start_timestamp(ISO+offset),end_timestamp,type(HIGH                                                                                             | LOW),threshold,value`). Not HR telemetry.     | per-alert                   |
| `Paired Devices/`                                                                                                    | 24 KB, 6    | `Devices.csv,Trackers.csv,Scales.csv,…` — device inventory; useful for provenance & sampling-rate eras.                                                                                                                             | static                                        |
| `Your Profile/`                                                                                                      | 8 KB, 2     | PII profile (name, email, DOB, country). **PII — do not ingest.**                                                                                                                                                                   | static                                        |
| `Daily Readiness User Properties`                                                                                    | —           | readiness config.                                                                                                                                                                                                                   | static                                        |
| Account/Social/Commerce/Discover/Surveys/Premium/Security/Notifications/Guided Programs/Blocked Users/Fitbit Friends | 4–24 KB ea  | account, social graph, commerce, app settings. **All out of scope.**                                                                                                                                                                | —                                             |

---

## 2. Redundancy / canonical-source map

For each logical metric: every place it appears → resolution → coverage → **recommended canonical
source** (✅) and why. "Coverage" notes the limiting factor.

### Heart rate (instantaneous)

| Source                                          | Resolution          | Format                                   | Coverage               | Pick                                                                                            |
| ----------------------------------------------- | ------------------- | ---------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| `Global Export Data/heart_rate-*.json`          | per-sample (~2–5 s) | JSON, `MM/DD/YY` local, has `confidence` | 2016-08 → 2026, 6.1 GB | ✅ **canonical for raw** (only source with per-sample confidence) — but **aggregate on ingest** |
| `Physical Activity_GoogleData/heart_rate_*.csv` | per-sample          | CSV, ISO+Z, `data source`                | same, 2.2 GB           | use only if you need device-source attribution / cleaner timestamps                             |

→ **Canonical:** Global JSON for values; consider GoogleData CSV's ISO+Z timestamps to disambiguate
TZ. Ingest as **nightly aggregates** (min/avg/max + time-in-zones), not raw.

### Resting heart rate

| Source                                                            | Resolution          | Pick                                    |
| ----------------------------------------------------------------- | ------------------- | --------------------------------------- |
| `Global Export Data/resting_heart_rate-*.json`                    | daily, with `error` | ✅ canonical (direct daily RHR + error) |
| `Sleep Score/sleep_score.csv` → `resting_heart_rate`              | per-session         | secondary (session-scoped RHR)          |
| `UserSleepScores_*` → `resting_heart_rate`, `hr_below_resting_hr` | per-session         | secondary, richer                       |

### Sleep sessions & stages

| Source                                                   | Resolution                                                | TZ-aware?                  | Pick                                                                           |
| -------------------------------------------------------- | --------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------ |
| `Global Export Data/sleep-*.json`                        | session + stage timeline + 30-day-avg summaries + `logId` | ❌ local naive             | ✅ **canonical for stage detail & efficiency** (richest, has `logId` join key) |
| `Health Fitness Data/UserSleeps_*` + `UserSleepStages_*` | session + stage segments                                  | ✅ **explicit UTC offset** | ✅ **canonical for night-window timestamps / TZ** (use to anchor UTC)          |
| `Physical Activity_GoogleData` (no direct sleep)         | —                                                         | —                          | n/a                                                                            |

→ Use **both**: `sleep-*.json` for stage minutes/efficiency/levels, `UserSleeps/UserSleepStages`
for authoritative UTC-offset-anchored start/end (join on overlapping timestamp/date).

### Sleep score

| Source                        | Resolution                                                     | Pick                                           |
| ----------------------------- | -------------------------------------------------------------- | ---------------------------------------------- |
| `Sleep Score/sleep_score.csv` | per-session, `sleep_log_entry_id`==`logId`                     | ✅ canonical (joins cleanly to `sleep-*.json`) |
| `UserSleepScores_*`           | per-session, more fields (`waso_count_*`, `rem_sleep_percent`) | secondary/enrichment (different `sleep_id`)    |

### SpO2 (blood oxygen)

| Source                                                 | Resolution                             | Pick                                                 |
| ------------------------------------------------------ | -------------------------------------- | ---------------------------------------------------- |
| `Oxygen Saturation (SpO2)/Minute SpO2 - *.csv`         | per-minute during sleep (calibrated %) | ✅ **canonical** (apply 50.0 sentinel filter)        |
| `Oxygen Saturation (SpO2)/Daily SpO2 - *.csv`          | daily avg + bounds                     | ✅ canonical for nightly summary                     |
| `Physical Activity_GoogleData/oxygen_saturation_*.csv` | per-minute                             | redundant (67 files only — partial) — ignore         |
| `Global Export Data/estimated_oxygen_variation-*.csv`  | per-minute **IR/Red ratio** (NOT %)    | **different metric** — proxy signal, ignore for SpO2 |

### HRV

| Source                                                          | Resolution                         | Pick                                    |
| --------------------------------------------------------------- | ---------------------------------- | --------------------------------------- |
| `Heart Rate Variability/Heart Rate Variability Details - *.csv` | per-5-min (rmssd, LF/HF, coverage) | ✅ canonical for intra-night HRV detail |
| `Heart Rate Variability/Daily HRV Summary - *.csv`              | nightly (rmssd, nremhr, entropy)   | ✅ canonical for nightly HRV            |
| `Physical Activity_GoogleData/heart_rate_variability_*.csv`     | per-5-min (rmssd, std)             | redundant (70 files, partial) — ignore  |

### Respiratory rate

| Source                                                              | Resolution                               | Pick                                              |
| ------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------- |
| `Heart Rate Variability/Daily Respiratory Rate Summary - *.csv`     | nightly single value                     | ✅ canonical (nightly RR)                         |
| `Heart Rate Variability/Respiratory Rate Summary - *.csv`           | nightly per-stage + SNR                  | ✅ canonical (per-stage detail) — but breaths/min |
| `Physical Activity_GoogleData/respiratory_rate_sleep_summary_*.csv` | nightly per-stage, **milli-breaths/min** | redundant + unit trap — ignore                    |

### Steps / distance / calories / floors / active minutes

| Source                                                           | Resolution                 | Pick               |
| ---------------------------------------------------------------- | -------------------------- | ------------------ |
| `Global Export Data/{steps,distance,calories,…}-*.json`          | per-minute (string values) | ✅ canonical raw   |
| `Physical Activity_GoogleData/{steps,distance,calories,…}_*.csv` | per-minute                 | redundant — ignore |

→ For CPAP correlation, only **daily totals** matter. Aggregate.

### Heart-rate zones / AZM

| Source                                                                         | Resolution                       | Pick                                |
| ------------------------------------------------------------------------------ | -------------------------------- | ----------------------------------- |
| `Active Zone Minutes (AZM)/*.csv`                                              | per-AZM-minute (zone label)      | ✅ canonical for AZM                |
| `Global Export Data/time_in_heart_rate_zones-*.json`                           | daily minutes/zone               | ✅ canonical for daily zone minutes |
| `Physical Activity_GoogleData/{active_zone_minutes,time_in_heart_rate_zone}_*` | redundant                        | ignore                              |
| `Physical Activity_GoogleData/daily_heart_rate_zones.csv`                      | zone _definitions_ (pseudo-JSON) | reference only (§4)                 |

### Temperature

| Source                                                    | Resolution                                     | Pick                                                            |
| --------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| `Temperature/Computed Temperature - *.csv`                | per-night (skin temp deviation + sleep window) | ✅ canonical (nightly, has sleep_start/end) — but only 31 files |
| `Temperature/Wrist Temperature - *.csv`                   | per-night                                      | secondary                                                       |
| `Physical Activity_GoogleData/body_temperature_*` (1,013) | per-night                                      | broadest coverage — ✅ canonical for long range                 |
| `Body Temperature_GoogleData/Pixel Body Temperatures.csv` | manual thermometer                             | separate metric (clinical fever)                                |

### Readiness / Stress (single canonical each)

- Readiness: ✅ `Daily Readiness/Daily Readiness Score - *.csv` (only source).
- Stress: ✅ `Stress Score/Stress Score.csv` (only source).

### Snore (single canonical)

- ✅ `Snore and Noise Detect/Snore Details - *.csv` (only source).

---

## 3. Volume & resolution analysis

### 3.1 Heavy hitters (measured / estimated)

| Metric                      | Files                       | Raw resolution          | Est. lifetime records                     | On-disk (raw)   | Notes                                            |
| --------------------------- | --------------------------- | ----------------------- | ----------------------------------------- | --------------- | ------------------------------------------------ |
| Heart rate (Global JSON)    | 3,541                       | ~2–5 s/sample           | **~67 M** (sampled avg ≈19 k/day × 3,541) | **6.1 GB**      | 2025+ ≈42 k/day (Pixel Watch) vs ~12 k/day older |
| Heart rate (GoogleData CSV) | 3,538                       | ~2–5 s                  | ~67 M (dup)                               | **2.2 GB**      | same data, cheaper encoding                      |
| Calories (Global JSON)      | 147                         | per-minute              | ~6.3 M (43,200/file × 147)                | part of 6.9 GB  | per-minute; only daily total useful              |
| Steps/Distance (Global)     | 147 ea                      | per-minute              | ~3 M ea                                   | —               | per-minute; only daily total useful              |
| estimated_oxygen_variation  | 3,157                       | per-minute              | ~1.4 M (≈445/file)                        | ~? (CSV, small) | IR/Red ratio, not SpO2                           |
| Minute SpO2                 | 1,889                       | per-minute (sleep only) | ~0.9 M (≈500/night)                       | ~28 MB          | ✅ ingest (minute-in-night)                      |
| HRV Details                 | 1,978                       | per-5-min (sleep)       | ~0.2 M                                    | ~part of 29 MB  | ✅ ingest                                        |
| Snore Details               | 519                         | per-30-s (sleep)        | ~0.5 M (≈900/night)                       | ~17 MB          | ✅ ingest                                        |
| Sleep sessions              | 144 files / ~4,300 sessions | per-session             | ~4,300                                    | small           | ✅ ingest fully                                  |

### 3.2 Recommended resolution per metric

| Metric           | (a) Nightly correlation store                            | (b) Optional drill-down                                |
| ---------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| Heart rate       | nightly min/avg/max, time-in-zones, **mean sleeping HR** | per-minute-within-night (downsample raw 2–5 s → 1 min) |
| Resting HR       | daily value                                              | —                                                      |
| Sleep stages     | per-night stage minutes, efficiency, score, WASO         | full stage timeline (`levels.data`) for hypnogram      |
| SpO2             | nightly mean/min/% time <90 (after 50.0 filter)          | per-minute-within-night                                |
| HRV              | nightly rmssd, nremhr, entropy                           | per-5-min within night                                 |
| Respiratory rate | nightly + per-stage breaths/min                          | —                                                      |
| Readiness        | daily score + subcomponents                              | —                                                      |
| Stress           | daily score + components                                 | —                                                      |
| Snore            | nightly snore-minute count, mean/max dBA                 | per-30-s within night                                  |
| AZM / activity   | daily totals (steps, AZM, active min)                    | —                                                      |
| Temperature      | nightly skin-temp deviation                              | —                                                      |

**Design implication:** raw HR (6.1 GB / 67 M rows) must be **streamed and aggregated during
ingest** (Web Worker, chunked), persisting only ~per-minute-within-night + nightly rollups. Never
load full-resolution HR into memory or IndexedDB. After aggregation the whole correlation store is
**megabytes, not gigabytes** (~4,300 nights × a few dozen metrics + optional minute arrays).

---

## 3b. Sleep-period alignment (the linchpin)

Aligning all wearable data to a CPAP "night" requires authoritative sleep windows. Available
session data:

**`Global Export Data/sleep-*.json`** (richest, per session):

```jsonc
{
  "logId": 44632289206,                       // joins to sleep_score.csv.sleep_log_entry_id
  "dateOfSleep": "2024-02-22",                // the "night" date label
  "startTime": "2024-02-22T07:41:30.000",     // ISO, NO timezone (naive local)
  "endTime":   "2024-02-22T17:59:30.000",
  "duration": 37080000,                        // ms
  "minutesToFallAsleep": 0, "minutesAsleep": 529, "minutesAwake": 89,
  "minutesAfterWakeup": 0, "timeInBed": 618, "efficiency": 93,
  "type": "stages",                            // "stages" | "classic" (schema drift)
  "infoCode": 0, "logType": "auto_detected", "mainSleep": true,
  "levels": {
    "summary": { "deep": {"count":2,"minutes":56,"thirtyDayAvgMinutes":52},
                 "light": {...}, "rem": {...}, "wake": {...} },   // stages
    // classic type instead has: { "restless":{}, "awake":{}, "asleep":{} }
    "data":      [ {"dateTime":"...T07:41:30.000","level":"light","seconds":180}, … ],
    "shortData": [ {"dateTime":"...T08:34:00.000","level":"wake","seconds":30}, … ]  // brief stage segments
  }
}
```

**`Health Fitness Data/UserSleeps_*.csv`** (TZ-authoritative):
`sleep_id, sleep_type(CLASSIC|STAGES), minutes_in_sleep_period, minutes_asleep, …,
start_utc_offset(+00:00/-07:00), sleep_start(UTC), end_utc_offset, sleep_end(UTC), data_source`.

**`Health Fitness Data/UserSleepStages_*.csv`**: flat stage segments with `sleep_stage_type`,
`sleep_stage_start/end` (UTC) and offsets — a relational alternative to nested `levels.data`.

**`Temperature/Computed Temperature - *.csv`** independently provides `sleep_start`/`sleep_end`.

### Deriving a "night" window

1. **Primary:** use `sleep-*.json` sessions where `mainSleep == true`. The `dateOfSleep` field is
   Fitbit's canonical night label — **use it as the join key to a CPAP night** (CPAP nights are
   also labeled by the morning's date in OSCAR; reconcile by ±1 day if conventions differ).
2. **Window = [startTime, endTime]** for that main-sleep session. Filter all high-frequency
   wearable series (SpO2, HRV, snore, HR) to timestamps within that window for "within-night"
   drill-down.
3. **Timezone:** `sleep-*.json` times are **naive local** (no offset). To compare against
   UTC-stamped series (SpO2/HR CSVs use `Z`), **resolve the offset from `UserSleeps_*.csv`**
   (`start_utc_offset`) for the same date, or infer from the local-vs-UTC delta of overlapping
   series. **This is the single biggest correctness risk in alignment** (§4).
4. **Naps:** `mainSleep == false` sessions are naps — exclude from nightly CPAP correlation (or
   tag separately).
5. `classic`-type nights (older devices, pre-stage-tracking) lack deep/REM — only asleep/restless/
   awake. Handle gracefully (degraded feature set, not an error).

---

## 4. Data-quality gotchas

1. **Two datetime formats coexist:**
   - `Global Export Data` JSON intraday + zones + RHR: **`MM/DD/YY HH:MM:SS`** (e.g. `01/01/24 08:00:06`), **local, naive** (no TZ).
   - `Global Export Data/sleep-*.json`, HRV/Snore/AZM/Temperature CSVs: **ISO-8601 without `Z`** (`2024-02-22T07:41:30.000`) — local, naive.
   - SpO2 CSVs, all `Physical Activity_GoogleData` CSVs: **ISO-8601 WITH `Z`** (UTC).
   - `Heart Rate Notifications`: **ISO-8601 with explicit offset** (`...-08:00`).
   - `Health Fitness Data` sleep tables: **UTC timestamp + separate `*_utc_offset` column**.
   - `Atrial Fibrillation ECG`: Java `Date.toString` (`"Thu Oct 08 07:15:06 UTC 2020"`).
   - `Mindfulness EDA`: **Unix epoch seconds** (`1601501667`).
     → A robust multi-format datetime parser with a per-source format map is mandatory.

2. **Timezone ambiguity / DST.** The naive-local series have no offset; the UTC series do. Joining
   a naive-local sleep window to UTC-stamped SpO2/HR requires the offset, which is only explicit in
   `UserSleeps_*.csv`. Travel/DST changes mean a single global offset is wrong. **Resolve offset
   per night** from `UserSleeps_*` (preferred) or infer it.

3. **SpO2 = 50.0 sentinel (error floor).** In Minute SpO2, ~15 % of rows are exactly `50.0`, and
   _every_ value below 70 equals exactly 50.0 → these are **invalid/low-confidence reads floored to
   50.0**, not real desaturations. **Drop `value == 50.0` (and ideally anything < ~70) before
   computing nightly SpO2 stats**, or they will fabricate severe-desaturation artifacts.

4. **Pseudo-JSON embedded in CSV cells with UNQUOTED tokens.**
   `Physical Activity_GoogleData/daily_heart_rate_zones.csv` cell:
   `"{""heart_rate_zone_type"": LIGHT, ""min_heart_rate_bpm"": 30, …},{…}"` — the enum values
   (`LIGHT`, `MODERATE`) are **not quoted** → this is **not valid JSON** and will throw in a JSON
   parser. Also it's a _comma-joined list of objects_ without enclosing `[]`. Needs custom parsing
   or skip entirely (it's only zone _definitions_).

5. **Epoch-1970 placeholder timestamps.** Same file uses `1970-01-01T00:00:00Z`, `1970-01-02…`
   as row keys (sequential, meaningless dates) → never treat these as real dates.

6. **HRV histogram & ECG arrays in cells.** `Heart Rate Variability Histogram` has a 29-element
   float array as a quoted CSV cell (`"[0.0, …]"`); AFib ECG embeds a long sample array. Parse as
   array-in-cell, not numeric.

7. **`value` fields are strings.** Global intraday JSON (`steps`/`distance`/`calories`) store
   `"value": "0"` / `"1.19"` as **strings** → cast before arithmetic; guard NaN/empty.

8. **Unit inconsistencies.**
   - Respiratory rate: `Heart Rate Variability/*` = **breaths/min**; `Physical Activity_GoogleData/respiratory_rate_sleep_summary` = **milli-breaths/min** (×1000). Easy to mix up.
   - Body temperature in °C; OSCAR/users may expect °F.
   - `estimated_oxygen_variation` is an **IR/Red ratio**, _not_ a SpO2 percentage — do not treat as SpO2.

9. **Schema drift over the 12-year span.**
   - Sleep `type`: `classic` (pre-stage) vs `stages`.
   - Minute SpO2 README lists `confidence,coverage,valid,unused` columns that the actual sampled files **omit** (only `timestamp,value`). Don't assume README == file.
   - HR sampling density tripled+ in 2025 (device upgrade).
   - Filename date suffix variants (`- 2020-11-(15).csv`).
   - `Temperature/` ends 2024-06; continues under `*_GoogleData`.

10. **Cross-source duplication.** HR / SpO2 / HRV / respiratory / steps each appear in both Global
    and GoogleData — ingesting both **double-counts**. Pick one canonical per metric (§2); never
    union raw rows across the two trees.

11. **Empty / placeholder datasets.** `Biometrics/Glucose *.csv` all say "no data". `Stress
Journal` has no data rows. Detect-and-skip empties; don't crash on header-only files.

12. **Different sleep id spaces.** `sleep-*.json.logId` (== `sleep_score.csv.sleep_log_entry_id`)
    is a _different identifier_ from `Health Fitness Data` `sleep_id` (19-digit). Don't assume a
    single global sleep id; join cross-tree on timestamp/night.

13. **Partial/empty trailing rows & sparse minute series.** Intraday `altitude`/`distance` are
    mostly zeros; per-minute files can have gaps. Treat missing minutes as missing, not zero, for
    physiological metrics.

---

## 5. Recommended ingestion scope (v1)

Prioritized by **correlation value with CPAP/sleep ÷ volume cost**. App correlates at **nightly**
granularity, so high-frequency data is aggregated to per-night (with optional minute-in-night
drill-down).

### MUST-HAVE (v1) — high correlation, manageable cost

| Metric                              | Canonical source                                                        | Stored resolution                                          | Why                                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Sleep sessions/stages**           | `sleep-*.json` (+ `UserSleeps_*` for UTC offset)                        | per-night summary + stage timeline                         | Defines the night; stage architecture is the core comparison vs CPAP AHI/efficiency.                      |
| **Sleep score**                     | `Sleep Score/sleep_score.csv`                                           | per-night                                                  | Single-number sleep quality; joins via `logId`.                                                           |
| **SpO2**                            | `Minute SpO2 - *.csv` + `Daily SpO2`                                    | nightly mean/min/% <90 + minute-in-night                   | Overnight oxygenation is the most direct physiological analog to AHI/desaturation. **Apply 50.0 filter.** |
| **Heart rate (resting + sleeping)** | `resting_heart_rate-*.json` + aggregated `heart_rate-*.json`            | daily RHR + nightly min/avg/max                            | Autonomic load; sleeping HR tracks apnea burden. Aggregate raw on ingest.                                 |
| **HRV**                             | HRV `Details` + `Daily Summary`                                         | nightly rmssd/nremhr/entropy (+ 5-min drill-down)          | Parasympathetic recovery; sensitive to fragmented/apneic sleep.                                           |
| **Respiratory rate**                | `Daily Respiratory Rate Summary` + per-stage `Respiratory Rate Summary` | nightly + per-stage                                        | Direct breathing metric; complements CPAP respiratory data. **breaths/min units.**                        |
| **Readiness**                       | `Daily Readiness Score - *.csv`                                         | daily                                                      | Pre-blended sleep+HRV+activity; strong composite.                                                         |
| **Stress**                          | `Stress Score.csv`                                                      | daily                                                      | Includes sleep + responsiveness components.                                                               |
| **Snore / noise**                   | `Snore Details - *.csv`                                                 | nightly snore-min count + mean/max dBA (+ 30-s drill-down) | Snoring/leak-noise directly relates to therapy efficacy and mask fit.                                     |
| **Activity / AZM**                  | daily totals from Global `steps/active_minutes` + AZM dir               | daily totals                                               | Daytime activity is a known confounder for sleep quality.                                                 |
| **Temperature (skin deviation)**    | `body_temperature_*` / `Computed Temperature`                           | nightly deviation                                          | Illness/cycle confounders; cheap.                                                                         |

### NICE-TO-HAVE (later)

- Sleep Profile (monthly archetype), VO2max trend, weight/body-fat trend, AFib ECG/PPG (episodic,
  device-source attribution), Mindfulness EDA, exercise/workout logs, time-in-HR-zones detail,
  cardio_load, sedentary periods, heart-rate notifications (HIGH/LOW events).

### DEFER / IGNORE (low correlation or non-health)

- `Physical Activity_GoogleData` and `Health Fitness Data` **duplicate** series (use only as
  fallback / TZ source — never as additional rows).
- `estimated_oxygen_variation` (IR/Red ratio, not SpO2).
- GPS / `live_pace` / `gps_location` (location-privacy sensitive, irrelevant to sleep).
- Glucose biometrics (empty), hydration, food, journal, medical records, conversations.
- Menstrual health (separate concern; ingest only if user opts in).
- All account/social/commerce/discover/surveys/premium/security/notifications/profile (PII, non-clinical).

### Cross-cutting ingestion requirements (for the ADR)

- **Stream + aggregate** raw HR (6.1 GB, 67 M rows) in the Web Worker — chunked, never fully
  resident. Output is per-night/per-minute rollups only.
- **One canonical source per metric** (de-dup the Global vs GoogleData trees).
- **Per-source datetime parser** with explicit format map + per-night UTC-offset resolution from
  `UserSleeps_*`.
- **Sentinel/validity filters** (SpO2 50.0 floor; `valid` flags where present; drop empties).
- **Night-keying** on `dateOfSleep` / main-sleep window; reconcile with OSCAR's night labeling.
- **Local-first / privacy:** all parsing in-browser; never upload; strip/avoid PII dirs
  (`Your Profile`, demographics) entirely.

---

## Appendix: methodology

Built with `find`/`du`/`wc`/`ls` for inventory, `head` + `python3 json/csv` for schema sampling
(multiple files per category across years to detect drift), and statistical sampling (40 random HR
files, 32 SpO2 files) for record-count and sentinel-prevalence estimates. No real health values are
reproduced; all inline "shape" examples use fabricated numbers. Generated 2026-06-10.
