# ADR Evaluation Report

**Date**: January 22, 2026  
**Evaluator**: @adr-specialist  
**Scope**: Architectural decision documentation and decision-making process assessment

---

## Executive Summary

OSCAR Export Analyzer has **no formal Architecture Decision Records (ADRs)** despite making significant, intentional architectural choices that are difficult to reverse or important for long-term maintenance. While the project includes excellent technical documentation (architecture.md, dependencies.md), the **rationale, alternatives considered, and trade-offs behind key decisions are not explicitly documented**.

**Key Finding**: The project demonstrates **mature architectural thinking** but lacks a formal decision record process. Approximately **12–15 significant architectural decisions** require documentation to preserve context for future contributors and to support the AI-first development model.

**Overall ADR Status: INCOMPLETE** — Architecture is sound; documentation of decisions is missing.

---

## 1. Existing ADR Status

### Current State

- **ADRs Documented**: 0
- **ADR Process**: Not established
- **ADR Template**: Not defined in project
- **Decision Repository**: No dedicated location

### What Exists Instead

OSCAR Export Analyzer has **excellent supplementary documentation** that partially captures architectural decisions but lacks formal ADR structure:

- [**architecture.md**](../../architecture.md) — Describes _what_ was built and _how_ components interact, but not _why_ certain choices were made
- [**dependencies.md**](../../dependencies.md) — Lists libraries and mentions some reasoning (e.g., "Plotly for interactive charts") but doesn't document alternatives or trade-offs
- [**README.md**](../../README.md) — Design goals and high-level overview exist; specific decisions lack rationale
- [**AGENTS.md**](../../../../AGENTS.md) — Mentions an ADR specialist agent but no ADR framework or examples
- [**Code comments**](../../architecture.md) — Architecture decisions scattered in code and comments, not centralized
- [**TODO.md**](../../../../TODO.md) — Contains forward-looking proposals but doesn't capture _past_ decisions

### Assessment

The project has **strong architectural understanding** but **weak decision documentation**. Reasoning is embedded in architecture prose rather than systematically recorded. This creates risks:

- Future contributors don't understand _why_ Vite was chosen over alternatives
- New features may inadvertently conflict with intentional constraints
- AI agents lack explicit context about trade-offs when refactoring
- Difficult-to-reverse decisions are implicit rather than explicit

---

## 2. Significant Architectural Decisions Identified

### Category A: Core Technology Stack (High Priority)

#### 1. **Build Tool & Module System: Vite + React**

**Status**: Partially Documented | **ADR Needed**: YES

**Current Documentation**:

- ✅ Mentioned in architecture.md: "Vite handles module loading and hot replacement"
- ✅ Mentioned in dependencies.md: "instant startup and on-demand module loading keep the feedback loop tight"
- ❌ No rationale for choosing Vite _over Webpack, Rollup, or esbuild_
- ❌ Trade-offs not documented (e.g., smaller ecosystem vs faster dev experience)

**Why It Matters**: Vite's development model (ESM, HMR, instant reload) affects developer workflow, build performance, and bundle strategy. This is a difficult decision to reverse.

**Should Document**:

- Why Vite was preferred over Webpack/Rollup/esbuild
- Performance trade-offs (dev vs production)
- ESM-first model rationale
- When to consider alternatives (e.g., if Vite support degraded)

---

#### 2. **Styling Approach: Single Global CSS + Component-Scoped Modules**

**Status**: Undocumented | **ADR Needed**: YES

**Current Documentation**:

- ✅ architecture.md: "The project uses a single `guide.css` file for global styles plus small component‑scoped CSS modules"
- ❌ No justification for this approach vs alternatives (Tailwind, styled-components, CSS-in-JS)
- ❌ No discussion of when to use global vs scoped CSS
- ❌ No rationale for rejecting CSS frameworks

**Why It Matters**: CSS architecture affects maintainability, bundle size, and developer experience. Choosing to avoid Tailwind is an intentional constraint.

**Should Document**:

- Design philosophy (simplicity over framework abstractions)
- Why not Tailwind, styled-components, or other CSS-in-JS?
- How to add styles to new components (decision tree)
- WCAG AA contrast commitment and how it's enforced

---

#### 3. **Chart Library: Plotly.js**

**Status**: Partially Documented | **ADR Needed**: YES

**Current Documentation**:

- ✅ dependencies.md: "interactive charts with zooming, panning, and tooltips"
- ✅ Code: Custom `ThemedPlot.jsx` wrapper shows intentional theme integration
- ❌ Why Plotly.js vs D3.js, Chart.js, ECharts, or Recharts?
- ❌ Performance trade-offs (Plotly bundle size is significant)
- ❌ Limitations of Plotly that might require alternatives

**Why It Matters**: Plotly adds ~1.2 MB (minified) to bundle. This is a significant constraint for interactive charts.

**Should Document**:

- Evaluation of alternatives (D3, Chart.js, ECharts, Recharts)
- Why Plotly was chosen (ease of use, interactivity, medical/scientific legitimacy?)
- Bundle size justification
- When to consider alternatives (e.g., if performance becomes critical)

---

#### 4. **Testing Framework: Vitest + Testing Library + jsdom**

**Status**: Partially Documented | **ADR Needed**: YES

**Current Documentation**:

- ✅ dependencies.md: "Jest‑like testing interface with Vite's blazing speed"
- ✅ architecture.md: "Tests mirror how a user interacts with the UI"
- ❌ Why Vitest vs Jest? When did this decision move from Jest to Vitest?
- ❌ Why jsdom vs Playwright/Cypress for integration tests?
- ❌ Why not E2E testing? When is it needed?

**Why It Matters**: Testing strategy affects reliability, developer feedback loop, and confidence in changes.

**Should Document**:

- Vitest vs Jest comparison and migration rationale
- jsdom vs headless browser (when to use each)
- Testing philosophy (unit vs integration vs E2E)
- When to add end-to-end tests

---

### Category B: Architecture Patterns (High Priority)

#### 5. **Web Worker for CSV Parsing**

**Status**: Documented in Code | **ADR Needed**: YES

**Current Documentation**:

- ✅ architecture.md: "dedicated parser worker filters events, converts timestamps, and streams batches"
- ✅ Explained: "main thread receives only necessary data and remains responsive"
- ✅ Code pattern: [src/workers/csv.worker.js](../src/workers/csv.worker.js) + [useCsvFiles hook](../src/hooks/useCsvFiles.js)
- ❌ Why Workers instead of streaming parse on main thread?
- ❌ Trade-offs: complexity vs responsiveness
- ❌ When is this pattern necessary?

**Why It Matters**: Web Worker integration affects UI responsiveness, bundle size (worker code), and debugging complexity.

**Should Document**:

- Why Web Workers instead of async/await + requestIdleCallback?
- Performance benchmarks (UI blocking with/without workers)
- Trade-offs: added complexity vs smoothness
- When to use workers for other async work (clustering, false negatives)

---

#### 6. **Local-First Architecture (No Server)**

**Status**: Partially Documented | **ADR Needed**: YES

**Current Documentation**:

- ✅ README.md: "Runs entirely in the browser; no data leaves your machine unless you explicitly export it"
- ✅ architecture.md: "Parsing of large CSV files occurs in a Web Worker"
- ❌ Decision rationale not explicit
- ❌ Privacy/security implications not fully documented
- ❌ Implications for features (no sync, no collaboration, etc.)

**Why It Matters**: This is a fundamental architectural constraint affecting scalability, features, and user trust.

**Should Document**:

- Why local-first? (Privacy, simplicity, cost, trust?)
- When _not_ to use local-first (e.g., if collaboration needed)
- Implications: no sync, no backup, no real-time collaboration
- Security model: browser storage is readable by extensions, dev tools
- How this affects future features (reports, analysis, sharing)

---

#### 7. **State Management: Custom Hooks + Context API (No Redux/Zustand)**

**Status**: Partially Documented | **ADR Needed**: YES

**Current Documentation**:

- ✅ architecture.md: "Using context keeps props shallow and makes it easy to expose new pieces of state"
- ✅ Code pattern: [useAppState.js](../src/app/useAppState.js) composes smaller hooks
- ✅ Two-tier context: AppState + Data context
- ❌ Why not Redux, Zustand, Jotai, or Recoil?
- ❌ Trade-offs: simplicity vs debugging, flexibility vs structure
- ❌ When would context become insufficient?

**Why It Matters**: State management architecture affects maintainability, debugging, and scalability as features grow.

**Should Document**:

- Philosophy: prefer composition over frameworks
- Why not Redux? (boilerplate, overkill for app size?)
- Why not Zustand? (when might this become appealing?)
- Constraints: context causes all consumers to re-render on state changes (potential perf issue)
- Refactoring path if state management becomes complex

---

#### 8. **Persistence: IndexedDB + Optional Session Export**

**Status**: Partially Documented | **ADR Needed**: YES

**Current Documentation**:

- ✅ architecture.md: "IndexedDB using the browser's `idb` wrapper when 'Remember data locally' is enabled"
- ✅ Code: [useSessionManager.js](../src/hooks/useSessionManager.js)
- ❌ Why IndexedDB vs localStorage? (Size, performance, API)
- ❌ Why opt-in vs opt-out?
- ❌ Privacy/security implications (data is unencrypted)
- ❌ Data retention policy

**Why It Matters**: Persistence strategy affects user experience, privacy posture, and storage requirements.

**Should Document**:

- IndexedDB vs localStorage vs service worker cache
- Why opt-in rather than default behavior?
- Encryption considerations (data is unencrypted in IndexedDB)
- Data retention: when does stored data expire?
- Session export as reproducibility mechanism

---

#### 9. **Component Organization: Feature-Based Modules**

**Status**: Documented in Code | **ADR Needed**: YES

**Current Documentation**:

- ✅ architecture.md: "src/features/<feature>/ bundles the Section container, local components, and colocated tests"
- ✅ Code structure: overview/, analytics/, apnea-clusters/, false-negatives/, range-comparisons/, raw-explorer/
- ❌ Why feature-based vs domain-based vs layer-based organization?
- ❌ Guidelines for when to extract a new feature module
- ❌ How to split monolithic chart components

**Why It Matters**: Component organization affects team scalability, code discoverability, and onboarding.

**Should Document**:

- Philosophy: feature modules = self-contained vertical slices
- When to create a new feature directory
- Rules for exports (public API via index.js)
- UI primitives belong in src/components/ui/
- How to know when a feature is too large

---

### Category C: Data Processing & Algorithms (High Priority)

#### 10. **Clustering Algorithm: Multiple Algorithms (FLG, k-means, Single-Linkage)**

**Status**: Code-Documented | **ADR Needed**: YES

**Current Documentation**:

- ✅ Code: [src/utils/clustering.js](../src/utils/clustering.js) implements FLG + k-means + single-link
- ✅ Constants: Tunable parameters (gap thresholds, cluster minimum sizes, etc.)
- ✅ UI: Event Exploration view lets users toggle algorithms and tune parameters
- ❌ Why these three algorithms? What are they detecting?
- ❌ FLG (Flexible Linking Group) is proprietary/research concept—no academic reference
- ❌ When to use each algorithm? Rationale for defaults?
- ❌ Validation of clustering quality (no metrics documented)

**Why It Matters**: Clustering is central to "false negatives" analysis and affects clinical interpretation.

**Should Document**:

- What each algorithm detects (FLG for bridged gaps, k-means for natural clusters, single-link for threshold)
- Academic/research basis for each approach
- FLG algorithm design: why this specific boundary-extension approach?
- Parameter tuning strategy and validation
- When to recommend each algorithm to users
- Limitations and failure modes

---

#### 11. **Statistical Methods: Mann-Whitney U, ACF/PACF, STL Decomposition**

**Status**: Code-Implemented | **ADR Needed**: YES

**Current Documentation**:

- ✅ User guides mention methods: ACF, PACF, STL, Mann-Whitney U
- ✅ Code: [src/utils/analytics.js](../src/utils/analytics.js), statistical functions
- ❌ Why these methods? Why not t-test, Wilcoxon, or other alternatives?
- ❌ When is each method appropriate?
- ❌ Assumptions and limitations not documented
- ❌ Effect sizes and confidence intervals—how are they computed?

**Why It Matters**: Statistical methods are central to analysis credibility and clinical interpretation.

**Should Document**:

- Why Mann-Whitney U for group comparisons? (non-parametric, handles outliers)
- Why ACF/PACF? (time series autocorrelation to identify patterns)
- Why STL decomposition? (separate trend, seasonal, residual components)
- When to use each method
- Confidence intervals: how computed and why 95%?
- Multiple comparison corrections? (if not, why not?)

---

#### 12. **Apnea Event Definition & Filtering**

**Status**: Constants-Based | **ADR Needed**: YES

**Current Documentation**:

- ✅ Constants defined: gap thresholds, minimum durations, cluster size minimums
- ✅ Code: Filtering logic in [clustering.js](../src/utils/clustering.js)
- ❌ Why these specific thresholds? Clinical rationale?
- ❌ How were parameters validated?
- ❌ When to adjust parameters for different patient profiles?

**Why It Matters**: Event definition affects all downstream analysis and clinical interpretation.

**Should Document**:

- Apnea event definition (duration, type, gap between events)
- Why current thresholds (clinical guidelines, research, OSCAR defaults?)
- Sensitivity/specificity of current thresholds
- Patient subgroups with different thresholds (pediatric, other??)

---

### Category D: Data Privacy & Security (Medium Priority)

#### 13. **Privacy Model: Browser-Only Processing**

**Status**: Documented | **ADR Needed**: YES

**Current Documentation**:

- ✅ README.md: "All processing occurs locally in your browser"
- ✅ architecture.md: References IndexedDB storage
- ⚠️ Security evaluation flagged risks with IndexedDB (unencrypted, readable by extensions)
- ❌ Threat model not documented
- ❌ Privacy guarantees not explicit
- ❌ Data retention policy unclear

**Why It Matters**: Privacy is a key selling point and user trust driver.

**Should Document**:

- Privacy model: what data is collected, stored, transmitted?
- Threat model: what are we protecting against?
- IndexedDB security: limitations, risks from malicious extensions
- HIPAA/GDPR/medical data compliance considerations
- Data retention: when does IndexedDB data expire?
- Audit trail: how do users verify no data leaks?

---

### Category E: Development Practices (Medium Priority)

#### 14. **Magic Numbers & Constant Management**

**Status**: Documented Process | **ADR Needed**: MAYBE

**Current Documentation**:

- ✅ [magic-numbers-playbook.md](../../magic-numbers-playbook.md) explains the approach
- ✅ ESLint rule enforces only -1, 0, 1 as inline literals
- ✅ Constants organized by concern (src/constants.js, src/constants/charts.js)
- ✅ Audit process: npm run lint:magic

**Assessment**: This is well-documented as a **process** but might benefit from an ADR explaining _why_ this strictness is necessary (readability, maintainability, audit trail).

**Should Consider**: ADR explaining the philosophy of named constants over magic literals.

---

#### 15. **Code Organization: ESLint Strictness & Pre-commit Hooks**

**Status**: Implemented | **ADR Needed**: MAYBE

**Current Documentation**:

- ✅ ESLint configuration: [eslint.config.js](../../../eslint.config.js)
- ✅ Prettier for formatting
- ✅ Husky pre-commit hooks enforce lint + test + build
- ❌ Why this level of strictness? Cost vs benefit?
- ❌ When to relax rules?

**Should Consider**: ADR explaining the philosophy of strict pre-commit checks (fail-fast, prevent broken code).

---

## 3. Decision Rationale Quality Assessment

### In architecture.md

- **Strong**: Describes _what_ and _how_ clearly
- **Weak**: Lacks _why_ (rationale) and _when_ (constraints)
- **Missing**: Alternatives considered, trade-offs, evolution path

### In dependencies.md

- **Strong**: Lists libraries with brief justification
- **Weak**: No alternatives evaluated, no trade-off discussion
- **Example Gap**: "Plotly.js for interactive charts" — but why not D3, Chart.js, ECharts?

### In README.md

- **Strong**: Design goals explicit (transparency, portability, education, experimentation)
- **Weak**: Goals don't map back to architectural decisions
- **Example Gap**: "Transparency" goal implies code should be open-source, but doesn't explain Web Worker choice or algorithm selection

### In Code Comments

- **Mixed**: Some functions have detailed JSDoc (clustering.js has good algorithm descriptions)
- **Gaps**: No comments explaining _why_ local-first instead of server-based, or _why_ context instead of Redux

---

## 4. Assessment: Decision-Making Process

### Positive Indicators

1. ✅ **Intentional Design**: Architecture shows evidence of deliberate choices (Web Workers, local-first, feature modules)
2. ✅ **Constraints Clear**: Documentation explicitly mentions design goals and trade-offs in general terms
3. ✅ **Composable Architecture**: Patterns (custom hooks, context, feature modules) show thoughtful composition
4. ✅ **Evolution Path Visible**: TODO.md suggests future considerations (routing, plugin system)

### Gaps in Decision Process

1. ❌ **No Formal ADR Template**: No standard format for capturing decisions
2. ❌ **No Decision Registry**: Decisions are scattered across architecture.md, dependencies.md, code comments
3. ❌ **No Alternatives Analysis**: Nowhere documented: "We considered X, Y, Z and chose Q because..."
4. ❌ **No Decision Timeline**: When were decisions made? Have they evolved?
5. ❌ **No Decision Owners**: Who decided to use Plotly? When? Based on what evidence?
6. ❌ **No Review Process**: How are architectural decisions reviewed? Who has authority?

### Impact on AI-First Development

The lack of formal ADRs creates risks for AI agents:

- **Context Loss**: Agents don't see rationale behind decisions, may inadvertently violate constraints
- **Refactoring Risks**: Without understanding trade-offs, agents may introduce regressions
- **Feature Direction**: Without explicit decision philosophy, agents may build features inconsistent with design goals
- **Algorithm Choices**: Without documented validation, agents may miss important caveats

---

## 5. Recommended ADR Process & Template

### ADR Location & Naming

- Directory: `docs/adr/` (not in evaluation reports)
- Naming: `ADR-NNNN-short-title.md`
- Example: `ADR-0001-vite-as-build-tool.md`, `ADR-0002-local-first-architecture.md`

### Proposed ADR Template

```markdown
# ADR-NNNN: [Decision Title]

## Status

Proposed | Accepted | Deprecated | Superseded

## Date

YYYY-MM-DD

## Context

What is the issue that motivates this decision? What constraints, requirements, or problems are we solving?

## Decision

What is the change we're proposing and/or doing?

## Rationale

Why was this approach chosen? What benefits does it provide?

## Consequences

What becomes easier or harder to do because of this change?

### Positive

- Consequence 1
- Consequence 2

### Negative / Trade-offs

- Trade-off 1 (what are we sacrificing?)
- Trade-off 2

## Alternatives Considered

### Alternative A: [Name]

- Pros: ...
- Cons: ...
- Why not chosen: ...

### Alternative B: [Name]

- Pros: ...
- Cons: ...
- Why not chosen: ...

## References

- Related docs, code, issues, research papers, external standards
- Links to implementation, tests, examples

## Open Questions

- Any unresolved aspects? Future considerations?

## Related ADRs

- ADR-NNNN: [Related decision]
```

### ADR Lifecycle

1. **Proposed**: Initial draft, open for feedback
2. **Accepted**: Decision is approved and implemented
3. **Deprecated**: No longer valid but kept for history
4. **Superseded**: Replaced by a newer ADR (link to replacement)

---

## 6. Prioritized List of ADRs to Create

### Phase 1: Core Decisions (HIGH PRIORITY)

**Timeline**: Weeks 1–2  
**Rationale**: These affect day-to-day development and are frequently questioned by new contributors.

1. **ADR-0001: Vite as Build Tool & Module System**
   - Core infrastructure decision affecting dev experience
   - Difficult to reverse

2. **ADR-0002: Local-First Architecture (No Server)**
   - Fundamental design constraint
   - Affects all features and privacy model

3. **ADR-0003: Web Workers for CSV Parsing & Analytics**
   - Complex pattern affecting performance and maintainability
   - Justifies added complexity

4. **ADR-0004: State Management via Custom Hooks + Context API**
   - Core architectural pattern
   - Affects all component code

5. **ADR-0005: Plotly.js for Interactive Visualization**
   - Significant bundle size decision
   - Affects performance and charting capabilities

### Phase 2: Design Patterns (MEDIUM PRIORITY)

**Timeline**: Weeks 3–4  
**Rationale**: These guide new feature development and code organization.

6. **ADR-0006: Feature-Based Module Organization**
   - Guides future structure as app grows
   - Affects team scalability

7. **ADR-0007: Styling: Global CSS + Component Modules**
   - Affects developer experience
   - Decides constraint against CSS frameworks

8. **ADR-0008: Testing with Vitest + Testing Library + jsdom**
   - Affects testing approach and coverage
   - Justifies no end-to-end tests

9. **ADR-0009: IndexedDB for Optional Session Persistence**
   - Privacy and storage strategy
   - Trade-off: user data never sent vs unencrypted local storage

### Phase 3: Data & Algorithms (MEDIUM PRIORITY)

**Timeline**: Weeks 5–6  
**Rationale**: Critical for credibility and clinical interpretation.

10. **ADR-0010: Clustering Algorithms (FLG, k-means, Single-Linkage)**
    - Complex multi-algorithm approach
    - Affects "false negatives" analysis credibility

11. **ADR-0011: Statistical Methods (Mann-Whitney U, ACF/PACF, STL)**
    - Critical for analysis rigor
    - Medical/scientific legitimacy

12. **ADR-0012: Apnea Event Definition & Threshold Parameters**
    - Affects all upstream analysis
    - Clinical validation needed

### Phase 4: Cross-Cutting Concerns (LOWER PRIORITY)

**Timeline**: Weeks 7–8  
**Rationale**: Important for completeness but less frequently questioned.

13. **ADR-0013: Privacy Model & Browser-Only Processing**
    - Affects user trust
    - Documents threat model

14. **ADR-0014: Constants & Magic Numbers Management**
    - Documents development practice
    - Guides future code review

15. **ADR-0015: Pre-commit Hooks & Build Strictness**
    - Documents development discipline
    - Affects contributor onboarding

---

## 7. Evaluation Findings: Summary Table

| Decision Area              | Documented?     | ADR Needed? | Priority | Status                                          |
| -------------------------- | --------------- | ----------- | -------- | ----------------------------------------------- |
| Vite build tool            | Partial         | YES         | P0       | Undocumented rationale                          |
| React + hooks              | Good            | MAYBE       | P1       | Rationale exists but no alternatives discussion |
| Web Workers                | Partial         | YES         | P0       | How/why gap; complexity not justified           |
| Local-first architecture   | Partial         | YES         | P0       | Privacy implications unclear                    |
| Context API (no Redux)     | Partial         | YES         | P0       | Philosophy not explicit                         |
| IndexedDB persistence      | Partial         | YES         | P1       | Security/encryption not discussed               |
| Feature-based organization | Good            | YES         | P1       | Why this over domain/layer organization?        |
| Plotly.js charts           | Partial         | YES         | P1       | Alternatives not evaluated                      |
| Styling approach           | Partial         | YES         | P1       | Why no Tailwind/CSS-in-JS?                      |
| Vitest + Testing Library   | Partial         | YES         | P1       | Jest migration not documented                   |
| Clustering algorithms      | Code-documented | YES         | P0       | FLG algorithm needs academic basis              |
| Statistical methods        | Code-documented | YES         | P0       | Why these? Alternatives?                        |
| Apnea event definition     | Constants-based | YES         | P1       | Clinical validation missing                     |
| Privacy model              | Documented      | YES         | P1       | Threat model & encryption risks                 |
| Magic numbers process      | Documented      | MAYBE       | P2       | Process good; philosophy could be ADR           |

---

## 8. Recommendations

### Immediate Actions (Next 1–2 Weeks)

1. **Establish ADR Directory**: Create `docs/adr/` with README and template
2. **Create ADR-0000**: Meta-ADR explaining the ADR process itself
3. **Create Phase 1 ADRs**: Document 5 core decisions (Vite, Local-First, Web Workers, Context, Plotly)
4. **Add ADR Section to Contributing Guide**: Explain when to create ADRs, how to propose new decisions

### Medium-Term (1 Month)

1. **Complete Phase 2–3 ADRs**: Feature organization, algorithms, statistical methods
2. **Add ADR Index**: docs/adr/INDEX.md mapping decisions to affected code/components
3. **Link ADRs from Code**: Add comments like "See ADR-0003 for Web Worker design rationale"
4. **Update architecture.md**: Reference relevant ADRs instead of duplicating rationale

### Long-Term (Ongoing)

1. **ADR Review in Code Review**: Ask "Does this need an ADR?" for architectural changes
2. **Deprecate Old Docs**: As ADRs capture decisions, consolidate/retire duplicative documentation
3. **ADR as Team Onboarding**: Use ADRs in contributor onboarding to explain design philosophy
4. **Periodic ADR Review**: Quarterly: are decisions still valid? Do ADRs need updates?

### For AI-First Development

1. **Agent Context**: Include relevant ADRs in agent prompts/instructions (e.g., "See ADR-0002: Local-First Architecture")
2. **Refactoring Safety**: Before major refactors, agents should review related ADRs to understand constraints
3. **Decision Proposals**: When proposing new features, include "Does this require a new ADR?" question
4. **ADR as Training Data**: Use ADRs as examples of good architectural thinking for future agent training

---

## 9. Open Questions & Considerations

### Clarifications Needed

1. **Why Web Workers?** When was this decision made? After performance issues? Planned from start?
2. **FLG Algorithm**: Is this novel research or published algorithm? Citation needed.
3. **Thresholds**: How were clustering/event thresholds validated? User feedback? Clinical guidelines?
4. **Plotly Choice**: Was this chosen for medical legitimacy (Plotly used in healthcare)? Or just ease of use?
5. **IndexedDB Security**: Are there plans to encrypt stored data? Threat model assumed?

### Future Decisions

1. **Server Backend**: If collaboration or data sync becomes needed, how would architecture evolve?
2. **Plugin System**: TODO.md mentions plugin API—how would this work within local-first model?
3. **Mobile Support**: No mention of mobile. Is this intentional? Would architecture change?
4. **Accessibility**: Good coverage but no ADR on accessibility philosophy (WCAG AA commitment documented?).

---

## 10. Conclusion

OSCAR Export Analyzer demonstrates **strong architectural thinking and thoughtful design decisions**, but lacks a **formal process for capturing and communicating those decisions**. The project has no ADRs despite making 12–15 significant, difficult-to-reverse architectural choices.

**Key Takeaway**: The architecture is sound; documentation of decision rationale is incomplete.

### Recommended Next Steps

1. ✅ Adopt ADR process and template
2. ✅ Create Phase 1 ADRs (5 core decisions)
3. ✅ Establish `docs/adr/` directory and README
4. ✅ Link ADRs from code and architecture documentation
5. ✅ Include ADR review in contributor guidelines

### Success Criteria

- ✅ All significant architectural decisions have ADRs (30-day goal)
- ✅ New architectural decisions follow ADR process (process documented)
- ✅ Contributors reference ADRs when discussing design changes
- ✅ AI agents have explicit context about architecture constraints and trade-offs
- ✅ Future maintainers can understand _why_ each decision was made, not just _what_ was built
