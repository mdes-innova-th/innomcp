# Deployment Checklist — innomcp

**Version**: 0.2.0-recovery | **Date**: 2026-06-12

---

## Pre-Deployment Checks

### 1. Backend (innomcp-node)

```bash
cd innomcp-node
npx tsc --noEmit          # Must: EXIT 0
node scripts/verify-recovery.js  # Must: 8/8 PASS
node dist/app.js          # Must: starts on port 3012 without crash
```

| Check | Command | Expected |
|---|---|---|
| tsc clean | `npx tsc --noEmit` | EXIT 0 |
| 0 @ts-nocheck | `grep -r @ts-nocheck src/` | no output |
| Recovery verify | `node scripts/verify-recovery.js` | 8/8 PASS |
| Backend starts | `node dist/app.js` | port 3012 listening |
| WS listens | `curl ws://localhost:3012` | connection refused (not crash) |

---

### 2. Frontend (innomcp-next)

```bash
cd innomcp-next
npx tsc --noEmit          # Must: EXIT 0
pnpm build                # Must: build succeeds (no next.js errors)
```

| Check | Command | Expected |
|---|---|---|
| tsc clean | `npx tsc --noEmit` | EXIT 0 |
| Production build | `pnpm build` | Compiled successfully |
| No console errors | Open browser, check DevTools | 0 errors |

---

### 3. Integration

Start backend on :3012, frontend on :3001, then:

```bash
# Hello greeting (not ห้ามเดาโว้ย)
curl -s -X POST http://localhost:3012/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"hello"}' | grep -c "ห้ามเดาโว้ย"
# Expected: 0

# Health shows providers + build
curl -s http://localhost:3012/api/health | jq '.providers, .build'
# Expected: both objects present

# New routes respond
curl -s http://localhost:3012/api/analytics/stats    # Expected: 200
curl -s http://localhost:3012/api/mdes/models        # Expected: 200
curl -s http://localhost:3012/api/thai/detect -X POST -H "Content-Type: application/json" -d '{"text":"สวัสดี"}' # Expected: 200
```

---

### 4. Pre-commit Gates Active

```bash
cd innomcp-node
node scripts/install-hooks.js   # Install if not already done
# Verify gates in hook:
grep "fence-check\|tsc-gate" $(git rev-parse --show-toplevel)/.git/hooks/pre-commit
# Expected: both lines present
```

---

## Go / No-Go

| Area | Status | Blocker? |
|---|---|---|
| Backend tsc | Must be EXIT 0 | YES |
| Frontend tsc | Must be EXIT 0 | YES |
| verify-recovery 8/8 | Must pass | YES |
| hello → greeting | Must not return ห้ามเดาโว้ย | YES |
| pnpm build | Must succeed | YES |
| Pre-commit gates | Must be wired | YES |
| 3 columns visible | Browser check | Recommended |
| MDESBrandHeader sticky | Browser check | Recommended |

---

## Rollback

```bash
git revert <commit-hash>   # Per-phase commits are independently revertable
# Last known good: 7fb8f68 (2026-06-11 09:05)
```
