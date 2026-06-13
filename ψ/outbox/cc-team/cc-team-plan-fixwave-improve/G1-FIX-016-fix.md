<!-- cc-team deliverable
 group: G1 (Fix patches from improve audit findings)
 member: FIX-016 role=fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1185,"completion_tokens":2186,"total_tokens":3371,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1768,"image_tokens":0},"cache_creation_input_tokens":0} | 26s
 generated: 2026-06-13T11:30:18.799Z -->
### Finding 1: `assessRisk` – Missing input guard (HIGH)

**Summary**  
Calling `assessRisk` with a null, undefined, or non‑string value causes a runtime `TypeError` when `.test()` is invoked on the patterns, crashing the backend.  
**Fix:** Add an early type‑and‑empty guard that returns a safe low‑risk result immediately.

```diff
--- a/innomcp-node/src/services/riskDetector.ts
+++ b/innomcp-node/src/services/riskDetector.ts
@@ -34,6 +34,11 @@ const MEDIUM_PATTERNS = [
 
 export function assessRisk(command: string, context?: string): RiskAssessment {
+  // Guard against non-string or empty input
+  if (typeof command !== 'string' || command.length === 0) {
+    return { riskLevel: "low", reason: "", requiresApproval: false };
+  }
+
   if (CRITICAL_PATTERNS.some(p => p.test(command))) {
     return { riskLevel: "critical", reason: "คำสั่งนี้อาจทำลายข้อมูลสำคัญหรือระบบไฟล์", requiresApproval: true };
   }
```

---

### Finding 2: `HIGH_PATTERNS` / `assessRisk` – Spaced‑flag false classification (MEDIUM) → **FALSE POSITIVE**

The regex `/\ rm\s+(-r|-f|-rf|-fr)/i` does **not** fail to match commands with flags separated by spaces (e.g., `rm -r -f /`). JavaScript’s `RegExp.test()` searches for a substring match anywhere in the input, and the pattern will match `rm -r` in that string. Therefore the command is correctly caught by the `HIGH_PATTERNS` check and classified as `"high"` before ever reaching the `MEDIUM_PATTERNS` fallback. No fix is required.
