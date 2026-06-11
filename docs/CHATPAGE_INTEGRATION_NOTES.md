# Integration Guide: Manus‑style Components in ChatPage.tsx

This guide explains how the new Wave 1–9 components (AgentStepsView, MDESStreamIndicator, SlashCommandMenu, etc.) integrate into `ChatPage.tsx`. It covers placement, state wiring, and the agent‑to‑UI data flow.

## 1. Architecture Overview

The current ChatPage splits the UI into:
- **Top bar:** `MDESBrandHeader` – MDES branding, model picker, settings (⚙️) and workspace toggle (🗂️).
- **Left sidebar:** `ChatSidebar` – conversation history.
- **Right panel(s):**  
  - `ManusWorkspacePanel` (toggle via `workspaceOpen`) – shows agent workspaces (งาน, เว็บ, Terminal, ไฟล์).  
  - `ModelSettingsPanel` (toggle via `modelSettingsOpen`) – provider management, triggered by ⚙️.
- **Center:**  
  - Empty state: `ChatEmptyStateManager` → `ChatWelcomeHero`, `GovernmentQuickActions`, `StarterPromptsGrid`.  
  - Active chat: list of `ChatMessage` components, plus `CollapsibleAgentWrapper` (agent progress, collapsed by default).  
  - Bottom: `ChatInput` (composer + attach/send/stop).

Agent streaming is driven by WebSocket events stored in `agentStreamState`.

## 2. New Component Placement

Add the following components inside the main area, wired to the existing state.

| Component | Where to insert | Purpose |
|-----------|----------------|---------|
| `AgentStepsView` | Inside `CollapsibleAgentWrapper` or as a sibling before the message list | Displays MDES agent step‑by‑step progress (e.g., planning, tool calls). |
| `MDESStreamIndicator` | Inside `MDESBrandHeader` or as a fixed banner below the header | Shows live streaming status (MDES cloud/local) and token throughput. |
| `SlashCommandMenu` | Overlay triggered inside `ChatInput` (on `/` key) | Inline slash‑command palette for MDES‑specific commands. |
| `MultiAgentPanel` (optional) | Could replace `ManusWorkspacePanel` or be a separate right panel | Multi‑agent orchestrator view, toggled via `multiAgentOpen`. |

### 2.1 AgentStepsView

- **Location**: Insert directly inside the message area, before the list of `ChatMessage`, or inside `CollapsibleAgentWrapper` if you want collapsible behavior.
- **Data**: It consumes `agentSteps` from `agentStreamState`. When the user sends a message, `agentStreamState.events` updates, `AgentStepsView` re‑renders with the latest steps.