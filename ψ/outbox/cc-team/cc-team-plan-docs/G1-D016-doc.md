<!-- cc-team deliverable
 group: G1 (Doc generation)
 member: D016 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":1150,"completion_tokens":2359,"total_tokens":3509,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1858,"image_tokens":0},"cache_creation_input_tokens":0} | 26s
 generated: 2026-06-13T11:21:40.678Z -->
- **`notificationService`**: Singleton instance of `NotificationService`. Provides notification publish/subscribe for sessions, with convenience methods for common notification types.
- **`subscribe(sessionId, callback)`**: Subscribes to notifications for a specific session. Returns an unsubscribe function.  
  `@param sessionId` – string  
  `@param callback` – function receiving a `Notification`  
  `@returns` – () => void  
  *Caveat*: Only one callback per `sessionId`; a later subscription overwrites the previous. The returned unsubscribe function only removes the callback if it is still the registered one.
- **`notify(notification)`**: Sends a notification to a specific session (`sessionId` required).  
  `@param notification` – `Omit<Notification, 'id' | 'timestamp'>` (must include `sessionId`)  
  *Caveat*: If no callback is registered for the session, the notification is still stored in history but not delivered.
- **`broadcast(notification)`**: Sends a notification to all connected sessions.  
  `@param notification` – `Omit<Notification, 'id' | 'timestamp' | 'sessionId'>`  
  *Caveat*: Errors thrown by listener callbacks are caught and logged; they do not propagate.
- **`notifyTaskComplete(sessionId, taskSummary)`**: Convenience to send a `task_complete` notification.  
  `@param sessionId` – string  
  `@param taskSummary` – string
- **`notifyMDESAlert(message)`**: Convenience to broadcast an `mdes_alert` notification to all sessions.  
  `@param message` – string
- **`notifyAgentDone(sessionId, agentId, model, elapsed)`**: Convenience to send an `agent_done` notification.  
  `@param sessionId` – string  
  `@param agentId` – string  
  `@param model` – string  
  `@param elapsed` – number (duration in ms)
- **`getRecentNotifications(sessionId, limit?)`**: Retrieves recent notifications for a session, most recent first.  
  `@param sessionId` – string  
  `@param limit` – number (default `50`)  
  `@returns` – `Notification[]`
