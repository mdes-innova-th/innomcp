# Component Registry

New and recovered components introduced in the `innomcp-next` recovery.

---

## Chat Components

### WSStatusBanner
- **File:** `src/components/chat/WSStatusBanner.tsx`
- **Props:**
  - `status: 'connecting' | 'connected' | 'disconnected' | 'error'`
  - `reconnectAttempt?: number`
  - `onReconnect?: () => void`
  - `className?: string`
- **Purpose:** Persistent banner displayed above chat panels to communicate the current WebSocket connection state and provide manual reconnect controls.

### PanelErrorBoundary
- **File:** `src/components/chat/PanelErrorBoundary.tsx`
- **Props:**
  - `children: ReactNode`
  - `fallback?: ReactNode`
  - `onError?: (error: Error, errorInfo: ErrorInfo) => void`
  - `panelId?: string`
- **Purpose:** Isolated error boundary scoped to a single chat panel so a rendering failure in one panel does not crash the entire layout.

### AgentStepsView
- **File:** `src/components/chat/AgentStepsView.tsx`
- **Props:**
  - `steps: AgentStep[]`
  - `isLoading?: boolean`
  - `currentStepId?: string`
  - `onStepClick?: (step: AgentStep) => void`
  - `expandable?: boolean`
- **Purpose:** Renders an agent's reasoning chain, tool calls, and intermediate results as an interactive, collapsible timeline inside the chat stream.

### ChatConnectionStatus
- **File:** `src/components/chat/ChatConnectionStatus.tsx`
- **Props:**
  - `state: ConnectionState`
  - `latency?: number`
  - `lastPing?: Date`
  - `className?: string`
- **Purpose:** Compact, real-time indicator embedded in the chat header showing connection health, latency, and last successful heartbeat.

---

## Layout

### ThreeColumnLayout
- **File:** `src/components/layout/ThreeColumnLayout.tsx`
- **Props:**
  - `leftPanel: ReactNode`
  - `centerPanel: ReactNode`
  - `rightPanel: ReactNode`
  - `leftWidth?: string` (default: `280px`)
  - `rightWidth?: string` (default: `320px`)
  - `resizable?: boolean`
  - `className?: string`
- **Purpose:** Responsive, resizable 3-column application shell that manages the sidebar, main workspace, and inspector panels.

### LayoutDebugOverlay
- **File:** `src/components/layout/LayoutDebugOverlay.tsx`
- **Props:**
  - `enabled?: boolean`
  - `showGrid?: boolean`
  - `showBorders?: boolean`
  - `showDimensions?: boolean`
  - `gridSize?: number`
- **Purpose:** Development-only overlay that paints column boundaries, baseline grids, and element dimensions to debug layout alignment issues.

---

## Debug

### DevToolsPanel
- **File:** `src/components/debug/DevToolsPanel.tsx`
- **Props:**
  - `initialOpen?: boolean`
  - `position?: 'left' | 'right' | 'bottom'`
  - `tabs?: DevToolTab[]`
  - `defaultTab?: string`
- **Purpose:** Collapsible debug drawer exposing internal application logs, WebSocket message traffic, state snapshots, and performance metrics for troubleshooting.

---

## Common

### HealthIndicator
- **File:** `src/components/common/HealthIndicator.tsx`
- **Props:**
  - `status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'`
  - `pulse?: boolean`
  - `size?: 'sm' | 'md' | 'lg'`
  - `label?: string`
- **Purpose:** Accessible, colored status dot with an optional pulsing animation used to signal service or system health.

### StatusBadge
- **File:** `src/components/common/StatusBadge.tsx`
- **Props:**
  - `status: string`
  - `variant?: 'default' | 'outline' | 'subtle'`
  - `icon?: ReactNode`
  - `className?: string`
- **Purpose:** Normalized badge tag for displaying enumerated states (e.g., "Running", "Idle", "Failed") with optional iconography.

### LoadingSpinner
- **File:** `src/components/common/LoadingSpinner.tsx`
- **Props:**
  - `size?: 'sm' | 'md' | 'lg' | 'xl'`
  - `color?: string`
  - `label?: string`
  - `centered?: boolean`
- **Purpose:** Accessible, animated SVG spinner with an optional screen-reader label to indicate asynchronous loading states.

### ErrorMessage
- **File:** `src/components/common/ErrorMessage.tsx`
- **Props:**
  - `title?: string`
  - `message: string`
  - `retry?: () => void`
  - `error?: Error`
  - `showDetails?: boolean`
- **Purpose:** Consistent error presentation block providing a user-friendly message, optional retry action, and a toggleable technical details section.

### Tooltip
- **File:** `src/components/common/Tooltip.tsx`
- **Props:**
  - `content: ReactNode`
  - `children: ReactElement`
  - `side?: 'top' | 'right' | 'bottom' | 'left'`
  - `delay?: number`
  - `disabled?: boolean`
- **Purpose:** Lightweight, accessible floating tooltip wrapper for supplementary hints and label expansions without cluttering the UI.