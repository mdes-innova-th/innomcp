<!-- cc-team deliverable
 group: P3B (Phase 3.2 â€” WS reconnection banner in ChatPage)
 member: P3B-1 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":397,"completion_tokens":2109,"total_tokens":2506,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1835,"image_tokens":0},"cache_creation_input_tokens":0} | 38s
 generated: 2026-06-12T03:42:15.286Z -->
// INSERT AT LINE ~293 (near other useState definitions)
const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');

// INSERT AT LINE ~644 inside the WebSocket onopen handler
setWsStatus('connected');

// INSERT AT LINE ~660 inside the onclose handler
setWsStatus('disconnected');
// Schedule a reconnect attempt
setTimeout(() => createWebSocket(), 3000);

// INSERT AT LINE ~670 inside the onerror handler (if separate; otherwise combine with onclose)
setWsStatus('disconnected');
// Schedule a reconnect attempt
setTimeout(() => createWebSocket(), 3000);

// INSERT AT LINE ~320 (top of the chat area JSX, before the message list or chat pane)
{wsStatus !== 'connected' && (
  <div className={`sticky top-0 z-10 w-full py-2 text-center font-medium ${
    wsStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
  }`}>
    {wsStatus === 'connecting'
      ? 'กำลังเชื่อมต่อ...'
      : 'ขาดการเชื่อมต่อ — กำลังพยายามเชื่อมต่อใหม่'}
  </div>
)}
