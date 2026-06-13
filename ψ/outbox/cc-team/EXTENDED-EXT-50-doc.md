<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-50 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":68,"completion_tokens":1117,"total_tokens":1185,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":481,"image_tokens":0},"cache_creation_input_tokens":0} | 12s
 generated: 2026-06-13T05:27:25.193Z -->
```markdown
# Hooks Catalog — `innomcp-next`

This document catalogs all custom React hooks located in `src/app/hooks/`. Each entry describes the hook’s signature, return value, and primary purpose.

| Hook Name | File | Parameters | Returns | Purpose |
|-----------|------|------------|---------|---------|
| `useUser` | `useUser.ts` | — | `{ user: User \| null, isLoading: boolean, error: Error \| null }` | Fetches and caches the authenticated user profile from the MCP server. |
| `useNavigation` | `useNavigation.ts` | `(target: string, options?: NavOptions)` | `{ navigate: (path: string) => void, isNavigating: boolean }` | Provides a controlled navigation helper with loading state and optional transition effects. |
| `useTheme` | `useTheme.ts` | — | `{ theme: 'light' \| 'dark', toggle: () => void, setTheme: (t: 'light' \| 'dark') => void }` | Manages the current UI theme, persists preference to localStorage, and applies CSS class. |
| `useToast` | `useToast.ts` | — | `{ toast: (msg: string, type?: 'info' \| 'error' \| 'success') => void, clear: () => void }` | Exposes a global toast notification system with auto-dismiss and stack management. |
| `useApi` | `useApi.ts` | `(endpoint: string, options?: RequestInit)` | `{ data: any, loading: boolean, error: Error \| null, refetch: () => void }` | Generic data-fetching hook that wraps `fetch` with loading/error states and caching. |
| `useMCPConnection` | `useMCPConnection.ts` | — | `{ isConnected: boolean, connectionStatus: 'connected' \| 'disconnected' \| 'connecting', reconnect: () => void }` | Monitors the WebSocket connection to the MCP backend and provides reconnection controls. |
| `useFormHandler` | `useFormHandler.ts` | `(initialValues: Record<string, any>, validation?: (values: any) => Record<string, string>)` | `{ values, errors, touched, handleChange, handleSubmit, reset }` | Manages form state, validation, and submission lifecycle. |
| `useDebounce` | `useDebounce.ts` | `(value: any, delay: number)` | `debouncedValue: any` | Delays updating the returned value until after the specified delay, useful for search inputs. |

## Usage Notes

- All hooks are designed to be side-effect free where possible.
- Hooks that depend on external state (e.g., `useUser`) require a wrapping `Provider` component.
- For detailed API documentation, refer to the inline JSDoc comments in each file.
```
