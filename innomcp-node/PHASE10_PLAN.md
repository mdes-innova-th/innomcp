# Phase 10 Plan — Real-time Polish + Cloud Deploy

## Goals
1. **Typing indicator UI** — wire roomWss typing events to a React TypingIndicator component shown in ChatPage when other users are typing
2. **Activity feed WebSocket push** — instead of polling, push new activities via roomWss broadcast to subscribed clients  
3. **Cloud deploy validation** — run `docker-compose up -d`, verify all 3 services (backend:3011, frontend:3000, nginx:80) are healthy
4. **Admin audit log UI** — show admin_audit_log table in Admin dashboard Sessions tab

## Sub-agents
| Agent | Task |
|-------|------|
| typing-ui | TypingIndicator.tsx component + ChatPage wire |
| ws-activity-push | Push activity events via roomWss broadcast |
| docker-validate | Run docker-compose, check health endpoints |
| audit-log-ui | Add audit log table to Admin Sessions tab |
| test-typing | Unit tests for typing indicator logic |

## Definition of Done
- [ ] TypingIndicator shows "user is typing..." in ChatPage when WS typing_start received
- [ ] Clears after 3s of no typing_stop
- [ ] docker-compose up -d exits 0, all 3 containers healthy
- [ ] Admin audit log visible in Sessions tab
- [ ] All tests pass (target: >1020 tests)
