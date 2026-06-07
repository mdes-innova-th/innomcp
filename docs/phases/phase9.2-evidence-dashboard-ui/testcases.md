# Phase 9.2: Evidence Dashboard UI Test Cases

## TC_92_01: Render Component Triad

- **Description:** Ensure KPI, Chart, and Table components render correctly when provided a full payload.
- **Steps:**
  1. Inject a mock `structuredContent` payload containing `kpis`, `series`, and `table` data.
  2. Inspect the dashboard view.
- **Expected:** The KPI components display values exactly as provided. The Chart renders points correctly. The Table displays columns and aggregated rows accurately.

## TC_92_02: Dark/Light Mode & Green Accent Validation

- **Description:** Verify theme toggling and accent styling.
- **Steps:**
  1. Toggle the overall application theme to Light. Ensure the green accent is clearly visible and readable against the background.
  2. Toggle to Dark mode. Verify background shades transition appropriately and the green accent maintains visibility without bleeding.
- **Expected:** UI updates seamlessly; the green accent color serves as the core highlight in both themes.

## TC_92_03: Basic Accessibility Check

- **Description:** Verify basic a11y standards.
- **Steps:**
  1. Trigger keyboard Tab navigation sequence across the dashboard.
  2. Inspect DOM nodes for appropriate ARIA roles (e.g., charts using localized labels).
- **Expected:** Key interactive actions are reachable via keyboard, and standard ARIA markup exists.

## TC_92_04: Missing Node Resilience

- **Description:** Graceful degradation if parts of the payload are omitted.
- **Steps:**
  1. Inject a `structuredContent` payload containing ONLY `kpis` (no chart or table data).
- **Expected:** The KPI section renders. The Chart/Table sections render a "No data available" fallback instead of crashing the React tree.

## TC_92_05: Renderer-Only Verification

- **Description:** Prove UI does not calculate its own values.
- **Steps:**
  1. Submit a payload indicating `COUNT=999`.
  2. Inspect the rendered component source.
- **Expected:** The UI prints `999` directly matching the payload, with no clientside derivation/modification logic present.
