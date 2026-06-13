<!-- cc-team deliverable
 group: G1 (Fix patches from improve audit findings)
 member: FIX-021 role=fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2818,"completion_tokens":911,"total_tokens":3729,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":756,"image_tokens":0},"cache_creation_input_tokens":0} | 12s
 generated: 2026-06-13T11:30:21.935Z -->
## MEDIUM – MDES remote provider always seeded despite comment

```typescript
--- a/innomcp-node/src/providers/registry.ts
+++ b/innomcp-node/src/providers/registry.ts
@@ -47,7 +47,7 @@ function buildSeed(): ProviderRecord[] {
   // Remote MDES Ollama — optional (only seeded if URL env present)
   const mdesUrl =
-    process.env.OLLAMA_REMOTE_BASE_URL || "https://ollama.mdes-innova.online";
+    process.env.OLLAMA_REMOTE_BASE_URL;
   if (mdesUrl) {
     seeds.push({
       id: "seed-mdes-ollama",
```
