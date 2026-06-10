# INNOVA_WORKSPACE_VM_SPEC.md
## Innova‑workspace Virtual Machine Specification

### Overview
Innova‑workspace is a persistent, AI‑driven environment running alongside INNOMCP chat. It mirrors the “computer” concept of Manus.ai, allowing AI agents to execute code, manage files, run terminals, and browse the web. All storage is backed by MDES‑owned infrastructure (Drive, NAS, local workspace‑storage), ensuring government data sovereignty.

### Architecture
#### Storage Backend (Tiered)
1. **Drive** – Google Drive‑compatible or OneDrive – primary cloud document store.
2. **NAS** – MDES internal Network Attached Storage – accessible via SMB/NFS.
3. **workspace‑storage/** – local, per‑session directory inside the INNOMCP repository (already exists).

Files persist across sessions and are scoped by `sessionId`.

#### Capabilities (Manus‑aligned)
- **File System** – browse, read, write within workspace; full CRUD via API and UI.
- **Code Execution** – run Python, Node.js, or Bash snippets in a sandboxed child process.
- **Web Browser** – AI‑controlled headless browser for data collection and automation.
- **Terminal** – interactive shell with restricted command set, routed through an approval gate.
- **Artifact Store** – dedicated storage for generated files (PDF, CSV, images), shown in the UI.

### Frontend (ManusWorkspacePanel)
Already built with tabs: **งาน**, **เว็บ**, **Terminal**, **ไฟล์ผลลัพธ์**. The panel provides UI‑only stubs. This spec adds real backend connections:
- File browser populates from API listing.
- Code executed via `/api/workspace/exec` and streamed over WebSocket.
- Terminal accepts user input, passes through the existing `ApprovalGate` component.

All UI labels use Thai strings to match the MDES target audience.

### Backend (INNOMCP‑node additions)
- **POST /api/workspace/exec** – execute a snippet; returns jobId, streams output via WebSocket.
- **POST /api/workspace/file** – read/write file contents in the session workspace.
- **GET /api/workspace/ls** – list directory; support recursive flag.
- **WebSocket** – pushes live execution logs, file change events, and terminal output.

### Implementation Plan (Phased)
**Phase 1 – Storage & File View**
- Map `workspace‑storage/{sessionId}/` to API.
- Wire file browser in `ManusWorkspacePanel` to show/upload/save files.
- Persist artifacts to the same directory structure.

**Phase 2 – Code Execution**
- Use `child_process` with resource limits and timeout (sandboxed Node.js/Python).
- Stream stdout/stderr over existing WebSocket connection.
- All shell commands pass through the pre‑built `ApprovalGate`.

**Phase 3 – NAS/Drive Integration**
- Mount NAS path via SMB (credentials provided by Innova).
- Sync Drive for Thai government document collaboration.
- Enable file picker that spans local/NAS/Drive sources.

### Known Blockers
- **NAS configuration** – endpoint, mount path, and access credentials must be supplied by the Innova infrastructure team.
- **Drive sync** – OAuth or service‑account setup for Drive access not yet configured.
- **Sandboxing** – production‑grade execution requires Docker daemon access, which is not yet provisioned; current sandbox uses OS‑level limits.

### Existing Assets
- `ManusWorkspacePanel.tsx` – complete UI shell with tabs and placeholder content.
- `AgentWorkspacePanel.tsx` – terminal component with shell integration and approval flow.
- `workspace‑storage/` – pre‑created directory ready for per‑session data.

This specification defines the next steps to convert the static UI into a fully functional virtual machine that meets MDES requirements for secure, persistent AI workspaces.