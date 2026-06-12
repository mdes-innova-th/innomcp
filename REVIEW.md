# REVIEW.md

| Severity | File | Line | Finding | Fix |
| :--- | :--- | :--- | :--- | :--- |
| Critical | `docker-compose.yml` / `.env.local` | N/A | Database port mismatch: Host `3308` mapped to container `3306` in `docker-compose.yml`, but `.env.local` uses `3306`. | Update `.env.local` to use port `3308` for host connections. |
| Medium | `innomcp-next/src/app/components/chat/ChatPage.tsx` | 1222 | Simulated upload progress: `handleFileUpload` uses a timer instead of real progress events (TODO #40). | Implement real `XMLHttpRequest` or `Fetch` progress events. |
| Medium | `innomcp-next/src/app/components/chat/ChatPage.tsx` | 1341 | Ephemeral chat renaming: `handleRename` only updates local state and `localStorage` without backend persistence (TODO #45). | Implement backend API call to persist the chat rename. |
