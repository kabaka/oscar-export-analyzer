# Fitbit Data Correlation: Executive Planning Summary

**Date**: January 24, 2026  
**Prepared by**: OSCAR Export Analyzer Planning Team (@data-scientist, @ux-designer, @frontend-developer, @security-auditor)  
**Status**: Planning Complete — Ready for Implementation Phase

---

## Vision

The OSCAR Export Analyzer will integrate Fitbit biometric data to unlock powerful correlations between CPAP sleep therapy and real-time physiological responses. This will enable data scientists, clinicians, and informed patients to:

1. **Understand therapy efficacy** at a physiological level (How does pressure setting affect heart rate variability? Does therapy improve SpO₂ stability?)
2. **Discover novel relationships** between sleep architecture and therapy outcomes (REM fragmentation vs. event clustering? HR recovery rates post-apnea?)
3. **Conduct research-grade analysis** with statistical rigor and depth (Granger causality, clustering phenotypes, anomaly detection)
4. **Make informed therapy adjustments** backed by data insights ("This pressure is helping my HRV; let's keep it")

**Target Users**: Data scientists, bioinformaticians, clinicians, and statistics-fluent patients analyzing their own data.

---

## What We've Planned

### **1. Data Science Opportunities** (`01-data-science-analysis.md`)

**Clinical Correlations** (7 major analyses):

- Autonomic response to pressure settings via HRV, HR recovery, heart rate variability
- SpO₂ dynamics and therapy efficacy (clustering low-oxygen nights with event patterns)
- Sleep stage preservation (REM/deep sleep quality and therapy effects)
- Respiratory rate patterns predicting apnea severity
- Cardiovascular stress indicators (resting heart rate trends, HRV degradation)
- Temperature and circadian synchrony
- Activity levels and recovery patterns

**Statistical Deep Dives** (5 advanced methods):

- **Cross-spectral & wavelet analysis**: Detect frequency-domain coupling between pressure oscillations and heart rate
- **Multi-dimensional clustering**: Group nights into phenotypes (fast responders, refractory cases, side effects, optimal states)
- **Time-series decomposition**: Isolate therapy signal from circadian and other physiological noise
- **Granger causality**: Determine if therapy statistically drives physiological changes (or vice versa)
- **Anomaly detection**: Flag unusual nights with root-cause analysis ("High HR + low AHI = success?")

**Novel Combinations** (5 exploratory areas):

- Pre-therapy prediction (does activity/HRV the day before predict therapy quality?)
- Therapy response phenotyping (fast vs. slow responders; personalized titration)
- Temperature variations and pressure efficacy
- HRV recovery rates post-event (time to normalize after apnea)
- Sleep stage-dependent therapy effectiveness (effectiveness varies by REM vs. light sleep)

**Visualization Concepts** (5 dashboard designs):

- Multi-axis trend dashboard with compliance overlay
- Sleep stage × time-of-night heatmaps showing event density
- Scatter plots with regression lines and prediction intervals
- Violin plots comparing therapy vs. baseline distribution
- Sankey diagrams for therapy response phenotype transitions

---

### **2. Visualization & UX Design** (`02-visualization-design.md`)

**Novel Chart Types**:

- Dual-axis synchronized time series (pressure + heart rate + SpO₂ in lockstep)
- Bivariate density heatmaps (SpO₂ vs. HR colored by AHI severity)
- Temporal event streams (sleep stages + events + metrics all aligned)
- Night comparison gallery (sort by correlation strength, outliers, or custom metrics)
- Correlation strength indicators (visual p-values, effect sizes)
- Linked brushing (select one metric's range, highlight in all charts)
- 3D/interactive scatter plots for multidimensional cluster exploration

**Information Architecture**:

- **Summary view**: Top insights, key correlations, alert flags
- **Deep dive**: Tab-based sections (Heart Rate, SpO₂, Sleep Stages, Activity, HRV)
- **Progressive disclosure**: Summary → charts → raw data export
- **Exploration tools**: Date range selectors, event filters, metric combiners, outlier highlights
- **Mobile responsiveness**: Stacked layout, swipeable galleries, tap-to-expand details

**Accessibility** (WCAG AA):

- Alt text and data tables for all charts (screen reader accessible)
- High-contrast color palettes (colorblind-friendly)
- Keyboard navigation for all interactive elements
- Touch targets ≥44×44px on mobile
- Readability: font sizes ≥14px, line height 1.5

**Cognitive Load Management**:

- Default: show clinically/statistically interesting correlations first
- Consistent color coding across all charts
- Contextual tooltips and documentation links
- "Why is this interesting?" badges highlighting unexpected findings

---

### **3. Technical Architecture** (`03-technical-architecture.md`)

**Data Acquisition**:

- **MVP (Phase 1)**: Manual JSON import from Fitbit export
- **Phase 2+**: OAuth 2.0 API sync with PKCE protection
- Date range mapping and time zone normalization
- Graceful degradation: app works with CPAP-only or Fitbit-only data

**Storage & Synchronization**:

- Extended IndexedDB schema with dedicated `fitbit_metrics` stores
- Timestamp normalization to UTC milliseconds (consistent with CPAP)
- Caching strategy with expiration for API responses
- Cross-device support: encrypted export/import with combined datasets

**Computation Pipeline**:

- **4 Web Workers**: CSV parser, analytics, Fitbit parser, correlation analyzer
- Message protocol with `type`, `timestamp`, and `data` fields
- Progressive computation: stream results as available
- Real-time updates as user adjusts filters

**Component Structure**:

```
src/features/fitbit-correlation/
  ├── components/
  │   ├── FitbitImportModal.jsx
  │   ├── CorrelationDashboard.jsx
  │   ├── MetricTrendChart.jsx
  │   └── ClusterExplorer.jsx
  ├── hooks/
  │   ├── useFitbitMetrics.js
  │   ├── useFitbitDataAvailable.js
  │   └── useCorrelationAnalysis.js
  ├── workers/
  │   ├── fitbit-parser.worker.js
  │   └── fitbit-correlation.worker.js
  ├── utils/
  │   ├── normalize-fitbit-data.js
  │   ├── cross-correlation.js
  │   └── clustering.js
  └── tests/
      ├── fitbit-correlation.integration.test.jsx
      └── [unit tests for utilities]
```

**API Integration** (Phase 2+):

- OAuth 2.0 with PKCE protection
- Token lifecycle: storage in IndexedDB (never localStorage), automatic refresh
- Rate limiting & exponential backoff
- User-facing error handling

**Performance**:

- Bundle size impact: +25–30 KB (<5% growth)
- 1-year correlation computation: <5 seconds
- Memory footprint: ~10–12 MB total
- Caching strategy for expensive correlations

**Testing Strategy**:

- Mock Fitbit data builders (synthetic, no real health data)
- Integration tests for import workflow
- Worker tests with proper message passing
- Performance benchmarks
- Accessibility testing (WCAG AA)

---

### **4. Security & Privacy** (`04-security-privacy-assessment.md`)

**Data Classification**:

- Fitbit data = Protected Health Information (PHI)
- Combined Fitbit + CPAP = higher sensitivity (reveals autonomic stress, cardiac concerns)
- Regulatory context: HIPAA (likely not applicable for individual users), GDPR (if EU users), CCPA (if CA users)

**OAuth & Authentication**:

- Tokens stored in IndexedDB with PBKDF2 encryption (never localStorage)
- 1-hour expiration; refresh token with secure rotation
- Revocation on logout; user education if account compromised

**Data Persistence**:

- Local-first architecture: all data stays on user's device
- IndexedDB encryption using Web Crypto API
- Safe deletion: complete database wipe on app uninstall
- Auto-expiration: optional data retention policies

**Cross-Device Transfer**:

- AES-256-GCM encryption maintained for combined datasets
- Passphrase entropy: 12+ characters recommended (79+ bits)
- Strict file format validation (no prototype pollution)
- Encrypted exports suitable for email/cloud, with privacy warnings

**Compliance & Consent**:

- Multi-stage consent flow with explicit privacy disclosure
- Right to withdraw: revoke Fitbit permission, data securely deleted
- Privacy policy updates covering Fitbit data collection, storage, use
- FDA disclaimer: "Not a medical device or diagnostic tool"
- GDPR/CCPA notices (if applicable by jurisdiction)

**Threat Model Mitigations**:

- ✅ Passphrase brute-force: AES-256-GCM protects
- ✅ Access token theft: 1-hour expiration, revocation, secure storage
- ✅ Malicious exports: strict format validation
- ✅ XSS attacks: CSP headers, DOM sanitization
- ⚠️ Device compromise: user responsibility; security best practices guide provided

**Critical Recommendations** (before release):

1. Implement encrypted token storage (IndexedDB + PBKDF2)
2. Multi-stage consent flow with explicit privacy disclosure
3. Token lifecycle management (refresh, expiration, revocation)
4. Security unit tests (encryption, file validation, XSS prevention)
5. CSP headers + safe error handling

---

## Phased Implementation Roadmap

### **Phase 1: Foundation & MVP** (Weeks 1–4)

- Manual Fitbit JSON import workflow
- Basic correlation: heart rate vs. AHI over time
- Simple dual-axis trend chart
- IndexedDB schema for Fitbit data
- Core transforms (timestamp normalization, aggregation)

### **Phase 2: Correlation Analysis** (Weeks 5–8)

- Cross-correlation algorithms (peak detection, lag analysis)
- Multi-dimensional clustering (night phenotyping)
- Advanced charts (bivariate density heatmaps, scatter regression)
- Statistical significance reporting (p-values, effect sizes)
- Exploration UI (filters, metric combiners, outlier highlighting)

### **Phase 3: API Integration** (Weeks 9–12)

- OAuth 2.0 with PKCE protection
- Token lifecycle management
- Real-time Fitbit sync
- Rate limiting & backoff
- Security testing (token management, encryption)

### **Phase 4: Advanced Analytics** (Weeks 13–16)

- Granger causality inference
- Time-series decomposition
- Anomaly detection with RCA narratives
- Advanced cluster visualization

### **Phase 5: Polish & Release** (Weeks 17–20)

- Accessibility testing (WCAG AA)
- Performance optimization
- Cross-device testing
- Documentation & user guides
- Security audit & hardening

---

## Success Criteria

### **Data Science**

- ✅ At least 5 clinically meaningful correlations identified with p < 0.05 and effect size > 0.3
- ✅ Clustering algorithm identifies reproducible phenotypes across test cohort
- ✅ Causality inference (Granger test) provides insights on therapy direction

### **Visualization**

- ✅ All charts meet WCAG AA accessibility (keyboard nav, alt text, high contrast)
- ✅ Mobile responsive: readable on 320px–768px viewports
- ✅ Professional appearance: comparable to Tableau, R Shiny, medical software

### **Technical**

- ✅ Bundle size growth <5% (target: +25–30 KB)
- ✅ 1-year correlation computation: <5 seconds
- ✅ 90% test coverage for Fitbit modules
- ✅ Zero security findings in OWASP Top 10 review

### **Security & Privacy**

- ✅ Encryption validated (AES-256-GCM + PBKDF2)
- ✅ Token security audit passed
- ✅ Multi-stage consent flow tested
- ✅ Privacy policy updated and reviewed
- ✅ No PHI in logs, temp directories, or exports

---

## Key Insights from Planning

1. **Fitbit + CPAP = Unique Value**: Combined dataset reveals physiological responses to therapy that neither alone provides. SpO₂ drops, HR variability, and sleep stage disruption tell the story of therapy impact.

2. **Professional-Grade Analysis Expected**: Target users (data scientists, clinicians) expect statistical rigor: p-values, confidence intervals, effect sizes, not just pretty charts.

3. **Privacy-Preserving by Design**: Local-first architecture maintained. All computation happens in browser; no data sent to servers. Encrypted export/import for cross-device sync.

4. **Phased, Risk-Managed Rollout**: Start with manual import (no OAuth complexity) and basic charts. Phase in OAuth, advanced analytics, and real-time sync once foundation is solid.

5. **Accessibility is Non-Negotiable**: Even professional tools must be accessible. WCAG AA compliance, colorblind palettes, keyboard navigation required from day one.

6. **Security Concerns are Manageable**: Biggest risks (token theft, passphrase cracking) are well-understood and mitigatable with standard practices (encryption, PBKDF2, revocation).

---

## Next Steps

### **1. Implementation Delegation** (Recommended)

Coordinate with:

- **@frontend-developer**: React components, data import UI, chart integration
- **@testing-expert**: Test strategy for correlation algorithms, fixtures, coverage
- **@data-scientist**: Validate algorithm implementations, statistical correctness
- **@ux-designer**: Finalize chart designs, accessibility audit
- **@security-auditor**: Token management implementation, encryption validation

### **2. Detailed Design**

- Create detailed component specs based on 02-visualization-design.md
- Finalize IndexedDB schema and message protocol
- Write algorithm pseudocode and unit test specs

### **3. Implementation**

- MVP: manual import + basic charts (Phase 1)
- Iteratively add features per roadmap

### **4. Validation**

- User testing with data scientist/clinician cohort
- Security audit before Phase 3 (OAuth)
- Performance testing at 1-year data scale

---

## Document References

- **[01-data-science-analysis.md](01-data-science-analysis.md)** — Medical correlations, statistical methods, visualization concepts, use cases
- **[02-visualization-design.md](02-visualization-design.md)** — Chart designs, UX architecture, accessibility, mobile responsiveness
- **[03-technical-architecture.md](03-technical-architecture.md)** — Data acquisition, storage, computation pipeline, component structure
- **[04-security-privacy-assessment.md](04-security-privacy-assessment.md)** — Threat model, compliance, consent, encryption, incident response

---

## Appendix: Fitbit Data Available

From `docs/work/fitbit-web-api-swagger.json`:

- Heart rate (minute-by-minute, resting, zones, HR variability)
- Sleep/wake cycles (light/deep/REM, awake minutes, sleep efficiency)
- SpO₂ (blood oxygen saturation, minute-by-minute)
- Respiratory rate (estimated)
- Activity (steps, calories, active minutes, exercise)
- HRV (heart rate variability daily)
- Skin temperature variations
- Interday summaries (daily totals, trends)

---

## Sign-Off

This planning document represents 4-week comprehensive analysis across 4 specialized perspectives. All recommendations are grounded in domain expertise, user needs, and technical feasibility. The roadmap is achievable over 20 weeks with standard team capacity.

**Prepared by:**

- @data-scientist — Medical correlations, analytics strategy
- @ux-designer — Visualization design, accessibility
- @frontend-developer — Technical architecture, implementation feasibility
- @security-auditor — Privacy, threat model, compliance

**Coordinated by:** @orchestrator-manager
