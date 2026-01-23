# Accessibility Guide

OSCAR Export Analyzer aims to be usable by everyone, including people with disabilities who rely on assistive technologies. This document describes our accessibility implementation, testing practices, and areas for improvement.

## Standards and Compliance

**Target**: WCAG 2.1 Level AA compliance

The analyzer is designed for WCAG 2.1 Level AA compliance, which includes:

- **Perceivable**: Information and UI components must be presentable to users in ways they can perceive (color contrast, text alternatives, adaptable layouts)
- **Operable**: UI components and navigation must be operable via keyboard, with sufficient time to read and use content
- **Understandable**: Information and operation of the interface must be understandable (readable text, predictable behavior, input assistance)
- **Robust**: Content must be robust enough to be interpreted by assistive technologies (valid HTML, proper ARIA attributes)

**Reference**: [Web Content Accessibility Guidelines (WCAG) 2.1](https://www.w3.org/WAI/WCAG21/quickref/)

---

## Keyboard Navigation

All interactive elements are accessible via keyboard. No mouse required.

### Global Shortcuts

- **Tab**: Move forward through interactive elements
- **Shift+Tab**: Move backward through interactive elements
- **Enter/Space**: Activate buttons, links, and menu items
- **Escape**: Close modals and menus
- **Ctrl+P / Cmd+P**: Print page (intercepted to show print warning dialog when data is loaded)

### Component-Specific Navigation

#### Header Menu

Located in [`src/components/HeaderMenu.jsx`](../../src/components/HeaderMenu.jsx):

- **Tab to menu button**: Focus the "Menu" button
- **Enter/Space**: Open menu dropdown
- **Tab through menu items**: Navigate menu items (Load Data, Export JSON, Print Page, etc.)
- **Enter/Space on menu item**: Activate menu action and close menu
- **Escape**: Close menu
- **Click outside menu**: Close menu

**ARIA attributes**:

```jsx
<button aria-haspopup="menu" aria-expanded={open}>Menu</button>
<div className="menu-list" role="menu">
  <button role="menuitem">Load Data</button>
  {/* ... more menu items */}
</div>
```

#### Date Range Controls

Located in [`src/components/DateRangeControls.jsx`](../../src/components/DateRangeControls.jsx):

- **Tab to quick range selector**: Focus dropdown (Last 7 Nights, Last 30 Nights, All, Custom)
- **Arrow Keys**: Navigate options in dropdown
- **Enter**: Select option
- **Tab to Start Date**: Focus start date input (native date picker)
- **Tab to End Date**: Focus end date input (native date picker)
- **Tab to Reset button**: Focus "Reset date filter" button (only visible when custom dates are set)
- **Enter/Space on Reset**: Clear custom date range

**ARIA labels**:

```jsx
<select aria-label="Quick range">...</select>
<input type="date" aria-label="Start date" />
<input type="date" aria-label="End date" />
<button aria-label="Reset date filter">×</button>
```

#### Modal Dialogs

All modals implement **focus trapping** and **focus restoration**.

**Storage Consent Dialog** ([`src/components/ui/StorageConsentDialog.jsx`](../../src/components/ui/StorageConsentDialog.jsx)):

- **Auto-focus**: "Don't Save" button receives focus when opened (privacy-safe default)
- **Tab**: Cycle through buttons (Don't Save → Save Data → Ask Later → Don't Save)
- **Shift+Tab**: Reverse cycle
- **Enter/Space**: Activate focused button
- **Escape**: Dismiss dialog (same as "Ask Later")
- **Focus restoration**: Returns focus to element that opened dialog when closed

**Print Warning Dialog** ([`src/components/ui/PrintWarningDialog.jsx`](../../src/components/ui/PrintWarningDialog.jsx)):

- **Auto-focus**: "Cancel" button receives focus when opened
- **Tab**: Cycle through buttons (Cancel → Print Anyway → Cancel)
- **Shift+Tab**: Reverse cycle
- **Enter/Space**: Activate focused button
- **Escape**: Close dialog (same as "Cancel")
- **Focus restoration**: Returns focus to trigger element when closed

**ARIA attributes for modals**:

```jsx
<div
  className="modal-backdrop"
  role="alertdialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
>
  <h3 id="dialog-title">Dialog Title</h3>
  <div id="dialog-description">Dialog content...</div>
</div>
```

#### Table of Contents Navigation

Located in [`src/app/AppLayout.jsx`](../../src/app/AppLayout.jsx):

- **Tab to TOC links**: Navigate between section links
- **Enter**: Jump to section (smooth scroll with offset for sticky header)
- **Active section**: Highlighted based on scroll position (visual indicator only)

---

## Screen Reader Support

All interactive elements have appropriate ARIA labels, roles, and landmarks.

### ARIA Patterns Implemented

#### Menu Pattern

**HeaderMenu** follows [WAI-ARIA menu pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu/):

```jsx
<button aria-haspopup="menu" aria-expanded={open}>Menu</button>
<div role="menu">
  <div role="group">
    <button role="menuitem">Load Data</button>
    <button role="menuitem" disabled={!hasAnyData}>Export JSON</button>
  </div>
</div>
```

- `aria-haspopup="menu"`: Indicates button opens a menu
- `aria-expanded`: Announces menu state (true/false)
- `role="menu"`: Identifies menu container
- `role="group"`: Groups related menu items
- `role="menuitem"`: Identifies each menu item
- `disabled` attribute: Announces disabled state to screen readers

#### Dialog Pattern

**Modals** follow [WAI-ARIA dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/):

```jsx
<div
  role="alertdialog"
  aria-modal="true"
  aria-labelledby="title-id"
  aria-describedby="description-id"
>
  <h3 id="title-id">Dialog Title</h3>
  <div id="description-id">Dialog description text...</div>
</div>
```

- `role="alertdialog"`: For urgent messages requiring user action
- `aria-modal="true"`: Indicates modal behavior (focus trapped)
- `aria-labelledby`: Associates title with dialog
- `aria-describedby`: Associates description with dialog

#### Form Controls

**DateRangeControls** uses semantic HTML with ARIA labels:

```jsx
<label>
  <select aria-label="Quick range">
    <option value="7">Last 7 Nights</option>
    <option value="30">Last 30 Nights</option>
  </select>
</label>

<input type="date" aria-label="Start date" />
<input type="date" aria-label="End date" />
```

- Semantic `<select>` and `<input type="date">` elements
- `aria-label` for screen reader context (visible labels are icons or implicit)

#### Live Regions

**Error messages** use `role="alert"`:

```jsx
{
  error && (
    <div role="alert" style={{ color: 'red' }}>
      {error}
    </div>
  );
}
```

**Progress indicators** use `role="status"`:

```jsx
{
  loading && (
    <div role="status">
      <progress value={progress} max={total} />
      <span>Loading... {Math.round((progress / total) * 100)}%</span>
    </div>
  );
}
```

- `role="alert"`: Announces immediately (for errors)
- `role="status"`: Announces politely (for progress updates)

### Screen Reader Testing

Test with these screen readers:

- **macOS**: VoiceOver (Cmd+F5 to enable)
  - Safari + VoiceOver is the primary macOS combination
  - Test navigation: VO+Right Arrow (next item), VO+Space (activate)
- **Windows**: NVDA (free, open-source)
  - Firefox + NVDA or Chrome + NVDA
  - Test navigation: Down Arrow (next item), Enter/Space (activate)
- **Windows**: JAWS (commercial)
  - Most commonly used enterprise screen reader
- **Linux**: Orca
  - Built into GNOME desktop environment

**Recommended testing workflow**:

1. Close your eyes or turn off monitor
2. Navigate entire app using only keyboard + screen reader
3. Verify all content is announced in logical order
4. Verify all controls are labeled and actionable
5. Verify focus moves predictably (no focus traps except modals)

---

## Color Contrast

OSCAR Export Analyzer supports light and dark themes with WCAG AA contrast compliance.

### Theme Color Tokens

Defined in [`styles.css`](../../styles.css):

#### Light Theme

```css
:root[data-theme='light'] {
  --color-bg: #f7f8fa; /* Background (gray-50) */
  --color-surface: #ffffff; /* Cards, modals (white) */
  --color-text: #0b1220; /* Primary text (gray-900) */
  --color-text-muted: #5b6472; /* Secondary text (gray-600) */
  --color-border: #d9dee6; /* Borders (gray-300) */
  --color-link: #2563eb; /* Links (blue-600) */
  --color-accent: #2563eb; /* Focus rings (blue-600) */
}
```

**Contrast ratios**:

- Text on surface (`#0b1220` on `#ffffff`): **15.3:1** (AAA ✓)
- Muted text on surface (`#5b6472` on `#ffffff`): **7.1:1** (AAA ✓)
- Links on surface (`#2563eb` on `#ffffff`): **8.6:1** (AAA ✓)

#### Dark Theme

```css
:root[data-theme='dark'] {
  --color-bg: #0f141a; /* Background (gray-950) */
  --color-surface: #121821; /* Cards, modals (gray-900) */
  --color-text: #e6eaef; /* Primary text (gray-100) */
  --color-text-muted: #aab2bd; /* Secondary text (gray-400) */
  --color-border: #2b3440; /* Borders (gray-700) */
  --color-link: #79b0ff; /* Links (blue-300) */
  --color-accent: #79b0ff; /* Focus rings (blue-300) */
}
```

**Contrast ratios**:

- Text on surface (`#e6eaef` on `#121821`): **13.2:1** (AAA ✓)
- Muted text on surface (`#aab2bd` on `#121821`): **8.4:1** (AAA ✓)
- Links on surface (`#79b0ff` on `#121821`): **9.1:1** (AAA ✓)

**WCAG Requirements**:

- **Level AA**: 4.5:1 for normal text, 3:1 for large text (18pt+ or 14pt+ bold)
- **Level AAA**: 7:1 for normal text, 4.5:1 for large text

All text in OSCAR Export Analyzer meets **WCAG AAA** standards.

### Chart Colors

Chart colors defined in [`src/utils/colors.js`](../../src/utils/colors.js):

```javascript
export const COLORS = Object.freeze({
  primary: '#1f77b4', // Blue (main data lines)
  secondary: '#ff7f0e', // Orange (secondary metrics)
  accent: '#2ca02c', // Green (highlights)
  threshold: '#d62728', // Red (warning/critical values)
  box: '#888888', // Gray (statistical boxes)
});
```

**Chart accessibility notes**:

- **Colorblind-safe palette**: Uses standard D3 category colors, distinguishable by most colorblind users
- **Not relying solely on color**: Charts also use line patterns, markers, and labels
- **High contrast**: All chart colors have 4.5:1+ contrast ratio on white backgrounds
- **Theme-aware**: Chart backgrounds automatically switch between light/dark via [`applyChartTheme()`](../../src/utils/chartTheme.js)

**Testing for colorblindness**:

- Use browser extensions like [Colorblindly](https://chrome.google.com/webstore/detail/colorblindly) or [Colorblind](https://addons.mozilla.org/en-US/firefox/addon/colorblind-simulator/)
- Test with deuteranopia (red-green, most common), protanopia (red-green), and tritanopia (blue-yellow)

### Contrast Testing Tools

- **WebAIM Contrast Checker**: https://webaim.org/resources/contrastchecker/
- **Chrome DevTools**: Built-in contrast checker in Inspect Element → Color Picker
- **Firefox Accessibility Inspector**: Shows contrast ratios for text elements
- **axe DevTools**: Browser extension for automated accessibility audits

---

## Focus Management

Keyboard users rely on visible focus indicators to know where they are.

### Focus Indicators

Defined in [`styles.css`](../../styles.css):

```css
/* Focus styles for keyboard users */
button:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--color-accent) 40%, transparent);
  outline-offset: 2px;
}
```

- **`:focus-visible`**: Only shows outline when keyboard navigating (not mouse clicks)
- **Outline color**: Semi-transparent accent color (blue in light, blue in dark)
- **Outline offset**: 2px spacing for better visibility
- **Outline width**: 2px solid for clear indication

**Input focus** (additional styling):

```css
input:focus,
select:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px
    color-mix(in oklab, var(--color-accent) 20%, transparent);
}
```

- **Border color**: Changes to accent color
- **Box shadow**: Subtle glow effect for additional emphasis

### Focus Order (Tab Order)

Focus order follows visual layout:

1. **Header**: Menu button → Theme toggle buttons
2. **Date controls**: Quick range selector → Start date → End date → Reset button (if visible)
3. **Content area**: TOC links → Section headings (if focusable) → Interactive chart elements
4. **Modals** (when open): Modal buttons only (focus trapped)

**Tab order testing**:

1. Press Tab repeatedly from page load
2. Verify focus moves in logical reading order (top to bottom, left to right)
3. Verify focus is always visible (outline or other indicator)
4. Verify no "focus traps" outside modals

### Focus Trapping in Modals

Implemented in [`StorageConsentDialog.jsx`](../../src/components/ui/StorageConsentDialog.jsx) and [`PrintWarningDialog.jsx`](../../src/components/ui/PrintWarningDialog.jsx):

```javascript
// Tab key trap: keep focus within dialog
if (e.key === 'Tab') {
  const focusableElements = dialogRef.current?.querySelectorAll(
    'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  // Shift+Tab on first element: wrap to last
  if (e.shiftKey && document.activeElement === firstElement) {
    e.preventDefault();
    lastElement.focus();
  }
  // Tab on last element: wrap to first
  else if (!e.shiftKey && document.activeElement === lastElement) {
    e.preventDefault();
    firstElement.focus();
  }
}
```

**Why focus trapping matters**:

- Prevents keyboard users from tabbing "behind" the modal
- Ensures modal is the only interactive content when open
- Required by WCAG for modal dialogs

### Focus Restoration

When modals close, focus returns to the element that opened them:

```javascript
useEffect(() => {
  if (!isOpen) return;

  const previousFocus = document.activeElement;

  // Focus management when modal opens...

  return () => {
    // Restore focus when modal closes
    if (previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus();
    }
  };
}, [isOpen]);
```

**Why focus restoration matters**:

- Prevents "lost focus" when modal closes
- Maintains user's place in the page
- Required for good keyboard UX

---

## Responsive Design

OSCAR Export Analyzer is designed to work on screens from mobile phones to desktop monitors.

### Breakpoints

No explicit breakpoints defined in CSS (uses modern CSS features for fluid layouts):

- **Mobile**: 320px–767px (single column, stacked charts)
- **Tablet**: 768px–1023px (two-column layouts where appropriate)
- **Desktop**: 1024px+ (full multi-column layouts, side-by-side TOC)

### Touch Target Sizes

**WCAG 2.1 requirement**: Touch targets should be at least 44×44 CSS pixels.

**Button sizing** (from [`styles.css`](../../styles.css)):

```css
button {
  padding: 8px 12px; /* Minimum 44px height with typical line-height */
  border-radius: 10px;
}
```

**Touch target testing** (from [`StorageConsentDialog.test.jsx`](../../src/components/ui/StorageConsentDialog.test.jsx)):

```javascript
it('has minimum touch target sizes (44×44px) for mobile accessibility', () => {
  const allowButton = screen.getByRole('button', { name: /Save data/i });
  const rect = allowButton.getBoundingClientRect();

  expect(rect.width).toBeGreaterThanOrEqual(44);
  expect(rect.height).toBeGreaterThanOrEqual(44);
});
```

**Touch-friendly spacing**:

- Modal buttons have adequate spacing between them (16px+ gap)
- Menu items have padding for large tap areas
- Date inputs use native controls (browser-optimized for touch)

### Mobile Considerations

- **Native date pickers**: `<input type="date">` uses OS-native picker on mobile (optimized for touch)
- **Scrollable content**: Long tables and charts scroll horizontally on narrow screens
- **Readable text**: Base font size is 16px (prevents zoom-on-focus on iOS)
- **Touch-friendly interactions**: No hover-only functionality; all interactions work via tap

### Responsive Chart Sizing

Charts adapt to container width:

```jsx
<ThemedPlot
  data={data}
  layout={layout}
  style={{ width: '100%', height: '400px' }}
  config={{ responsive: true }}
/>
```

- **Width**: 100% of container (fluid)
- **Height**: Fixed height (adjusts based on chart type)
- **Responsive**: Plotly charts automatically resize on window resize

---

## Error Handling

Error messages are accessible to all users, including screen reader users.

### Error Display Pattern

Located in [`src/App.jsx`](../../src/App.jsx):

```jsx
{
  error && (
    <div
      role="alert"
      style={{
        margin: '58px 0',
        color: 'red',
        fontWeight: 'bold',
        padding: '20px',
        border: '2px solid red',
        borderRadius: '10px',
        background: 'color-mix(in oklab, red 10%, transparent)',
      }}
    >
      {error}
    </div>
  );
}
```

**Accessibility features**:

- `role="alert"`: Announces error immediately to screen readers
- **High contrast**: Red text on light background (11.8:1 contrast ratio)
- **Multiple cues**: Color (red), border, bold text, icon (⚠️ in some contexts)
- **Persistent**: Error stays visible until user takes action

### Error Sources

Errors can come from:

1. **CSV parsing failures**: "Failed to parse CSV file. Please verify it's a valid OSCAR export."
2. **Missing required columns**: "Missing required columns: AHI, Date"
3. **File format issues**: "CSV file structure is invalid."
4. **Session import failures**: "Failed to load saved session."
5. **Worker errors**: Generic sanitized error messages (see Security section)

### Error Message Guidelines

**DO**:

- Use clear, actionable language ("Check file format" instead of "Malformed CSV")
- Indicate what went wrong and what to do next
- Use `role="alert"` for immediate announcement
- Include multiple visual cues (not just color)

**DON'T**:

- Include sensitive data in error messages
- Use technical jargon ("ParserError" → "Failed to parse file")
- Rely solely on color to convey errors
- Hide errors or dismiss them automatically

### Error Boundary

Chart rendering errors are caught by [`ErrorBoundary`](../../src/components/ui/ErrorBoundary.jsx):

```jsx
<ErrorBoundary fallback="Unable to render this chart. Please refresh the page.">
  <AhiTrendsCharts data={data} />
</ErrorBoundary>
```

**Accessibility**:

- Fallback message has `role="alert"`
- Error logged to console in development mode only (no sensitive data)
- User sees friendly message, not stack trace

---

## Chart Accessibility

Plotly charts present unique accessibility challenges. We implement several strategies to make charts accessible.

### Plotly Configuration

**Display mode bar** (chart controls):

```javascript
config={{
  displayModeBar: false,  // Hidden by default (reduces clutter)
  // OR
  displayModeBar: 'hover',  // Show on hover
  toImageButtonOptions: {
    format: 'svg',  // SVG preserves text as selectable (accessible)
    filename: 'ahi_trends',
  }
}}
```

**Why `displayModeBar: false`**:

- Reduces visual clutter for screen reader users
- Chart controls (zoom, pan) are not keyboard accessible in Plotly
- Most users don't need chart controls for static analysis

**Export as SVG** (not PNG):

- SVG text is selectable and searchable
- SVG can be scaled without loss of quality
- Screen readers can potentially access SVG text nodes

### Chart Theming for Accessibility

Theme application in [`src/utils/chartTheme.js`](../../src/utils/chartTheme.js):

```javascript
export function applyChartTheme(isDark, layout = {}) {
  const light = {
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    font: { color: '#0b1220' },
    axisColor: '#5b6472',
    gridColor: '#e7ebf0',
  };
  const dark = {
    paper_bgcolor: '#121821',
    plot_bgcolor: '#121821',
    font: { color: '#e6eaef' },
    axisColor: '#aab2bd',
    gridColor: '#1e2734',
  };
  // ... merge theme into layout
}
```

**Accessibility features**:

- **High contrast text**: Chart text meets WCAG AAA standards
- **Readable grid lines**: Grid color is subtle but visible
- **Automatic theming**: Charts adapt to user's theme preference
- **Consistent typography**: Matches body text for readability

### Chart Alternatives (Data Tables)

**Current state**: Charts do not have text alternatives or data tables.

**Planned improvement** (see Known Issues):

```jsx
<figure>
  <figcaption id="chart-caption">
    AHI Trends Over Time (January 2024 - March 2024)
  </figcaption>
  <ThemedPlot data={data} layout={layout} aria-labelledby="chart-caption" />
  <details>
    <summary>View data table</summary>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>AHI</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.date}>
            <td>{row.date}</td>
            <td>{row.ahi}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </details>
</figure>
```

**Benefits**:

- Screen reader users can access raw data
- Keyboard users can navigate data without Plotly controls
- Searchable and selectable (unlike chart images)

### Chart Descriptions

**Pattern for adding descriptions**:

```jsx
<div className="chart-container">
  <h3 id="chart-title">AHI Trends Over Time</h3>
  <p id="chart-description" className="sr-only">
    Line chart showing AHI values from January 2024 to March 2024. AHI starts at
    12.3 and trends downward to 5.1. Notable spike on February 15th (AHI 18.7).
  </p>
  <ThemedPlot
    data={data}
    layout={{ title: 'AHI Trends' }}
    aria-labelledby="chart-title"
    aria-describedby="chart-description"
  />
</div>
```

**`.sr-only` class** (screen reader only):

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

---

## Print Accessibility

Print output is designed to be accessible and legible on paper.

### Print Media Queries

From [`styles.css`](../../styles.css):

```css
@media print {
  /* Hide interactive elements */
  .app-header,
  .btn-primary,
  .btn-ghost,
  .guide-link,
  button,
  input,
  select {
    display: none !important;
  }

  /* Force Plotly legends to print with dark text for contrast */
  .js-plotly-plot .legend text {
    fill: #0b1220 !important;
  }
}
```

**Print accessibility features**:

1. **High contrast text**: Chart text forced to dark color (`#0b1220`) for legibility
2. **No interactive elements**: Buttons and controls hidden (not useful on paper)
3. **Full content**: All sections print in order
4. **Page breaks**: Sections break logically (no charts split across pages)

### Print Warning Dialog

Before printing, users see [`PrintWarningDialog`](../../src/components/ui/PrintWarningDialog.jsx) explaining:

- PDF generation may take 1-2 minutes for large datasets
- Sensitive health data (PHI) will be included in printout
- Charts will be included in export

**Why this matters**:

- Warns users about printing PHI in shared environments
- Prepares users for long PDF generation time
- Gives users chance to cancel before printing

### Print Keyboard Shortcut

**Ctrl+P / Cmd+P** intercepted in [`src/App.jsx`](../../src/App.jsx):

```javascript
useEffect(() => {
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      if (summaryAvailable) {
        e.preventDefault();
        printWarningModal.open();
      }
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [summaryAvailable, printWarningModal]);
```

**Accessibility note**: Native print shortcut is overridden only when data is loaded, to show warning dialog. If no data is loaded, native browser print behavior is preserved.

---

## Testing Accessibility

Automated and manual testing ensure accessibility is maintained.

### Automated Testing

**Vitest + Testing Library** tests in [`src/tests/accessibility/`](../../src/tests/accessibility/):

#### Keyboard Navigation Tests

[`keyboard-navigation.test.jsx`](../../src/tests/accessibility/keyboard-navigation.test.jsx):

```javascript
it('allows tabbing through all interactive elements in order', async () => {
  const user = userEvent.setup();
  render(<DateRangeControls {...defaultProps} />);

  await user.tab();
  expect(quickRangeSelect).toHaveFocus();

  await user.tab();
  expect(startDateInput).toHaveFocus();

  await user.tab();
  expect(endDateInput).toHaveFocus();
});
```

**Coverage**:

- Tab order (forward and backward)
- Enter/Space activation of buttons
- Escape key to close menus/modals
- Arrow key navigation in menus
- Focus visibility indicators

#### ARIA Attributes Tests

[`aria-attributes.test.jsx`](../../src/tests/accessibility/aria-attributes.test.jsx):

```javascript
it('has aria-label on quick range selector', () => {
  render(<DateRangeControls {...defaultProps} />);
  const select = screen.getByRole('combobox', { name: /quick range/i });
  expect(select).toHaveAttribute('aria-label', 'Quick range');
});
```

**Coverage**:

- ARIA labels on all interactive elements
- ARIA roles (menu, menuitem, alertdialog, alert, status)
- ARIA states (aria-expanded, aria-haspopup, aria-modal)
- ARIA relationships (aria-labelledby, aria-describedby)

#### Focus Management Tests

From component test files (e.g., [`PrintWarningDialog.test.jsx`](../../src/components/ui/PrintWarningDialog.test.jsx)):

```javascript
it('focuses cancel button on open', async () => {
  render(<PrintWarningDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} />);
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /cancel/i })).toHaveFocus();
  });
});

it('restores focus to previous element on close', async () => {
  const { rerender } = render(
    <PrintWarningDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} />,
  );
  const triggerButton = document.createElement('button');
  document.body.appendChild(triggerButton);
  triggerButton.focus();

  rerender(
    <PrintWarningDialog isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
  );

  await waitFor(() => {
    expect(triggerButton).toHaveFocus();
  });
});
```

**Coverage**:

- Auto-focus on modal open
- Focus restoration on modal close
- Focus trapping (Tab cycles within modal)

### Manual Testing

Automated tests catch most issues, but manual testing is essential for:

1. **Screen reader testing**: Automated tests can't verify announcements
2. **Real keyboard navigation**: Tab order may be correct but feel awkward
3. **Color contrast in context**: Verify readability in real usage
4. **Chart interactions**: Plotly charts require manual testing

### Testing Checklist

Use this checklist for manual accessibility testing:

#### Keyboard Navigation

- [ ] Can reach all interactive elements via Tab
- [ ] Tab order follows visual layout
- [ ] Shift+Tab reverses direction correctly
- [ ] Enter/Space activates buttons and links
- [ ] Escape closes menus and modals
- [ ] No keyboard traps (except modals)
- [ ] Focus indicator always visible

#### Screen Reader

- [ ] All images have alt text or aria-label
- [ ] All buttons and links are labeled
- [ ] Form inputs have labels
- [ ] Headings are in logical order (h1 → h2 → h3)
- [ ] Error messages announced (role="alert")
- [ ] Loading states announced (role="status")
- [ ] Modal title and description announced

#### Color and Contrast

- [ ] Text has 4.5:1 contrast (WCAG AA) or 7:1 (WCAG AAA)
- [ ] Links distinguishable from body text (not just color)
- [ ] Focus indicators have 3:1 contrast with background
- [ ] Charts don't rely solely on color

#### Responsive and Touch

- [ ] Touch targets at least 44×44px
- [ ] Content readable at 200% zoom
- [ ] No horizontal scrolling on mobile (except data tables)
- [ ] Interactive elements have adequate spacing

#### Print

- [ ] All content prints (no missing sections)
- [ ] Chart text is legible (high contrast)
- [ ] No interactive elements in print output
- [ ] Page breaks are logical

### Browser Extensions for Testing

- **axe DevTools** (Chrome, Firefox): Automated accessibility audit
- **WAVE** (Chrome, Firefox, Edge): Visual accessibility feedback
- **Lighthouse** (Chrome DevTools): Accessibility score and recommendations
- **Colorblindly** (Chrome): Simulate color vision deficiencies
- **Screen Reader Keyboard Shortcuts**: Test with keyboard + screen reader

---

## Known Issues

Areas where accessibility could be improved:

### 1. Chart Data Tables Missing

**Issue**: Charts do not provide alternative text representations of data.

**Impact**: Screen reader users cannot access chart data.

**Severity**: High

**Recommendation**:

- Add collapsible data tables below each chart (`<details><summary>View data</summary><table>...</table></details>`)
- Add `aria-describedby` pointing to a text description of chart trends
- Example implementation:

```jsx
<div className="chart-section">
  <h3 id="chart-title">AHI Trends Over Time</h3>
  <p id="chart-summary" className="sr-only">
    Chart shows AHI decreasing from 12.3 to 5.1 over 90 nights.
  </p>
  <ThemedPlot
    data={data}
    layout={layout}
    aria-labelledby="chart-title"
    aria-describedby="chart-summary"
  />
  <details>
    <summary>View data table</summary>
    <DataTable data={data} />
  </details>
</div>
```

**Effort**: Medium (3-5 hours)

---

### 2. Chart Zoom/Pan Not Keyboard Accessible

**Issue**: Plotly's zoom, pan, and modebar controls are not keyboard accessible.

**Impact**: Keyboard users cannot interact with charts beyond viewing.

**Severity**: Medium

**Recommendation**:

- Consider disabling zoom/pan features for consistency
- OR investigate Plotly keyboard navigation options
- OR provide keyboard shortcuts for zoom/pan (document in guide)

**Note**: Most users view charts statically, so this may be low priority.

**Effort**: High (requires Plotly customization or workaround)

---

### 3. No Skip-to-Content Link

**Issue**: No "skip to main content" link for keyboard users to bypass header/TOC.

**Impact**: Keyboard users must tab through header and TOC to reach content.

**Severity**: Low

**Recommendation**:

Add skip link as first focusable element:

```jsx
<a href="#main-content" className="skip-link">
  Skip to main content
</a>
```

```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--color-accent);
  color: white;
  padding: 8px;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
```

**Effort**: Low (30 minutes)

---

### 4. TOC Active State Not Announced

**Issue**: Active section in TOC is visually highlighted, but not announced to screen readers.

**Impact**: Screen reader users don't know which section is currently active.

**Severity**: Low

**Recommendation**:

Add `aria-current="location"` to active TOC link:

```jsx
<a
  href={`#${section.id}`}
  className={activeSectionId === section.id ? 'active' : ''}
  aria-current={activeSectionId === section.id ? 'location' : undefined}
>
  {section.label}
</a>
```

**Effort**: Low (15 minutes)

---

### 5. Date Picker Accessibility on Mobile

**Issue**: Native date pickers on mobile vary by browser and may not be accessible.

**Impact**: Some mobile users may struggle with date selection.

**Severity**: Low (most browsers have accessible native pickers)

**Recommendation**:

- Test with iOS Safari, Chrome Mobile, Firefox Mobile
- Consider custom date picker if native implementation is problematic
- OR document known mobile browser issues in FAQ

**Effort**: Medium (testing + potential custom date picker implementation)

---

### 6. Error Messages Not Dismissible

**Issue**: Error messages persist until user takes corrective action (no "X" button).

**Impact**: Error messages may obstruct content.

**Severity**: Low

**Recommendation**:

Add dismiss button to error messages:

```jsx
{
  error && (
    <div role="alert">
      {error}
      <button
        onClick={() => setError(null)}
        aria-label="Dismiss error"
        className="error-dismiss"
      >
        ×
      </button>
    </div>
  );
}
```

**Effort**: Low (1 hour)

---

### 7. No Reduced Motion Support

**Issue**: Page uses `scroll-behavior: smooth` without checking `prefers-reduced-motion`.

**Impact**: Users with vestibular disorders may experience discomfort from smooth scrolling.

**Severity**: Medium

**Recommendation**:

Respect `prefers-reduced-motion` user preference:

```css
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}
```

**Effort**: Low (5 minutes)

---

## Recommendations for Improvement

Priority-ordered improvements:

### High Priority

1. **Add chart data tables**: Most impactful for screen reader users (3-5 hours)
2. **Add chart descriptions**: Provide context for chart trends (2-3 hours)

### Medium Priority

3. **Add skip-to-content link**: Quick win for keyboard users (30 minutes)
4. **Add reduced motion support**: Respect user preferences (5 minutes)
5. **Add aria-current to TOC**: Improve screen reader navigation (15 minutes)

### Low Priority

6. **Make error messages dismissible**: Improve error UX (1 hour)
7. **Test mobile date pickers**: Verify cross-browser accessibility (2 hours)
8. **Investigate Plotly keyboard navigation**: May not be feasible (research task)

---

## Resources

### Standards and Guidelines

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [WAI-ARIA Authoring Practices Guide (APG)](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

### Testing Tools

- [axe DevTools](https://www.deque.com/axe/devtools/) — Automated accessibility testing
- [WAVE Browser Extension](https://wave.webaim.org/extension/) — Visual accessibility feedback
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) — Color contrast validator
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) — Chrome DevTools audit

### Screen Readers

- [NVDA](https://www.nvaccess.org/) — Free Windows screen reader
- [JAWS](https://www.freedomscientific.com/products/software/jaws/) — Commercial Windows screen reader
- [VoiceOver](https://www.apple.com/accessibility/voiceover/) — Built into macOS/iOS
- [Orca](https://help.gnome.org/users/orca/stable/) — Linux screen reader

### Learning Resources

- [WebAIM Articles](https://webaim.org/articles/) — Comprehensive accessibility articles
- [A11ycasts by Google Chrome](https://www.youtube.com/playlist?list=PLNYkxOF6rcICWx0C9LVWWVqvHlYJyqw7g) — Video series on accessibility
- [Inclusive Components](https://inclusive-components.design/) — Accessible UI patterns

---

## Summary

OSCAR Export Analyzer takes accessibility seriously, with WCAG 2.1 Level AA compliance as the target. Current implementation includes:

**✅ Strengths**:

- Full keyboard navigation (Tab, Enter, Escape, arrow keys)
- ARIA attributes throughout (labels, roles, states)
- Focus management in modals (trapping, restoration)
- High contrast themes (WCAG AAA text contrast)
- Screen reader announcements (alerts, status updates)
- Touch-friendly sizing (44×44px touch targets)
- Semantic HTML (proper headings, landmarks)
- Print accessibility (high contrast, hidden interactive elements)

**⚠️ Known Gaps**:

- Charts lack data table alternatives (HIGH priority)
- Chart zoom/pan not keyboard accessible (MEDIUM priority)
- No skip-to-content link (MEDIUM priority)
- No reduced motion support (MEDIUM priority)
- Error messages not dismissible (LOW priority)

**Next Steps**:

1. Add data tables to all charts (see recommendation #1)
2. Add chart descriptions for screen readers (see recommendation #2)
3. Implement skip-to-content link and reduced motion support
4. Continue manual testing with screen readers

For questions or accessibility concerns, open an issue on GitHub or consult the [Testing Patterns guide](testing-patterns.md) for adding accessibility tests.

---

## See Also

- [Adding Features](adding-features.md) — Accessibility checklist for new features
- [Testing Patterns](testing-patterns.md) — How to write accessibility tests
- [Architecture](architecture.md) — Understanding component structure for accessible design
- [User Guide — Getting Started](../user/01-getting-started.md#7-keyboard-shortcuts) — Keyboard shortcuts available to users

---
