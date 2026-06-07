# Phase 9.2: Evidence Dashboard UI Specification

## 1. Overview

This specification outlines the UI design and component behavior for the Evidence Dashboard, which consumes the `structuredContent` generated from Phase 9.1 DetectDB E2E logic.

## 2. Component Spec

The Dashboard MUST implement three primary visualization components:

1. **KPI Cards:** Large numeral displays for aggregated metrics (e.g., Total Threats, Avg Response Time). Must support labels and tooltips.
2. **Chart Component:** Time-series visualization (Line/Bar) rendering the `series` node of the payload. Minimal animation for fast loading.
3. **Data Table:** Tabular view rendering the `table` node of the payload. Must support basic pagination or scrolling for dense data. No raw records, only aggregated views.

## 3. Theme & Styling

- **Color Modes:** The UI MUST support both `dark` and `light` modes natively tied to system preference or user toggle.
- **Green Accent:** The primary interactive and positive highlight color MUST be a vibrant but accessible "green accent" (e.g., `#10B981` in Tailwind, or equivalent HSL values).
- **Aesthetic:** Clean, glassmorphism hints allowed but keep it performant. Professional evidence dashboard look.

## 4. Accessibility (Basic)

- **ARIA Roles:** Essential roles such as `role="region"`, `role="table"`, and `role="img"` (for charts) must be defined.
- **Contrast Check:** Text elements on the green accent background or dark/light surfaces MUST pass basic WCAG contrast standards.
- **Keyboard Navigation:** High-level interactive elements (buttons, pagination, tabs) must be focusable.

## 5. Renderer-Only Enforcement

- The UI components MUST exactly bind to the metrics provided in the `structuredContent`.
- The frontend code CANNOT compute its own aggregations. It is purely an execution-level renderer of the backend payload, preventing discrepancies between LLM assertions and UI truths.
