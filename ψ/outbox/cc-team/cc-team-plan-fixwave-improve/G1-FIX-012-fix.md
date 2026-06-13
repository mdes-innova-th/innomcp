<!-- cc-team deliverable
 group: G1 (Fix patches from improve audit findings)
 member: FIX-012 role=fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2658,"completion_tokens":2808,"total_tokens":5466,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1685,"image_tokens":0},"cache_creation_input_tokens":0} | 32s
 generated: 2026-06-13T11:27:20.995Z -->
### HIGH: Constructor custom IDs ignored in `selectProvider`, `getStats`, `resetAll`

**Fix:** Store the constructor’s `primaryId`/`backupIds` as instance properties and replace all hardcoded constants with them.  
Also rework `resetAll` to iterate the status map directly (no need for IDs). This eliminates the `undefined`‑to‑`!` crash.

```diff
--- a/innomcp-node/src/services/providerFailover.ts
+++ b/innomcp-node/src/services/providerFailover.ts
@@ -72,6 +72,8 @@
   private readonly cooldownMs: number;
   private healthChecker: HealthCheckFn | null = null;
+  private readonly primaryId: string;
+  private readonly backupIds: string[];

   constructor(
     primaryId: string = DEFAULT_PRIMARY_ID,
@@ -91,6 +93,9 @@
         lastCheck: Date.now(),
       });
     }
+
+    this.primaryId = primaryId;
+    this.backupIds = backupIds;
   }

@@ -107,11 +112,11 @@
   public async selectProvider(_task?: string): Promise<string> {
-    const primaryStatus = this.statuses.get(DEFAULT_PRIMARY_ID)!;
+    const primaryStatus = this.statuses.get(this.primaryId)!;
     if (primaryStatus.healthy) {
-      this.activeProviderId = DEFAULT_PRIMARY_ID;
-      return DEFAULT_PRIMARY_ID;
+      this.activeProviderId = this.primaryId;
+      return this.primaryId;
     }

-    for (const backupId of DEFAULT_BACKUP_IDS) {
+    for (const backupId of this.backupIds) {
       const backupStatus = this.statuses.get(backupId);
@@ -124,7 +129,7 @@
     console.warn(
-      `[ProviderFailover] All providers unhealthy. Falling back to primary (${DEFAULT_PRIMARY_ID})`,
+      `[ProviderFailover] All providers unhealthy. Falling back to primary (${this.primaryId})`,
     );
-    this.activeProviderId = DEFAULT_PRIMARY_ID;
-    return DEFAULT_PRIMARY_ID;
+    this.activeProviderId = this.primaryId;
+    return this.primaryId;
   }
@@ -182,8 +187,8 @@
   public getStats(): { ... } {
-    const primary = this.statuses.get(DEFAULT_PRIMARY_ID)!;
-    const backups = DEFAULT_BACKUP_IDS
+    const primary = this.statuses.get(this.primaryId)!;
+    const backups = this.backupIds
       .map(id => this.statuses.get(id))
@@ -202,4 +207,12 @@
-    for (
-/* …truncated… */
+    for (const status of this.statuses.values()) {
+      status.healthy = true;
+      status.failCount = 0;
+      status.latencyMs = 0;
+      status.lastCheck = now;
     }
```

### HIGH: Cooldown bypass in `checkProvider`

**Fix:** If `shouldAttemptCheck` is false, directly return the stored healthy state regardless of whether it’s true or false. This enforces the circuit‑breaker cooldown.

```diff
--- a/innomcp-node/src/services/providerFailover.ts
+++ b/innomcp-node/src/services/providerFailover.ts
@@ -148,3 +148,3 @@
-    if (!shouldAttemptCheck && status.healthy) {
-      return true;
+    if (!shouldAttemptCheck) {
+      return status.healthy;
     }
```

### MED: Thundering herd / duplicate checks in `checkProvider`

**Fix:** Record `lastCheck` synchronously immediately before the async health probe. This prevents concurrent calls (or calls just after cooldown expiry) from passing the `shouldAttemptCheck` gate.

```diff
--- a/innomcp-node/src/services/providerFailover.ts
+++ b/innomcp-node/src/services/providerFailover.ts
@@ -154,6 +154,7 @@
     // Perform the actual health check
+    status.lastCheck = Date.now();               // <-- lock in the attempt time
     try {
       const result = await this.healthChecker(providerId);
       if (result.healthy) {
```

### LOW: Unnecessary `async` on `markFailed` and `markHealthy`

**Fix:** Remove the `async` keyword and change the return type to `void`. These are pure synchronous state mutations.

```diff
--- a/innomcp-node/src/services/providerFailover.ts
+++ b/innomcp-node/src/services/providerFailover.ts
@@ -132,3 +132,3 @@
-  public async markFailed(providerId: string): Promise<void> {
+  public markFailed(providerId: string): void {
     const status = this.statuses.get(providerId);
@@ -152,3 +152,3 @@
-  public async markHealthy(providerId: string, latencyMs: number): Promise<void> {
+  public markHealthy(providerId: string, latencyMs: number): void {
     const status = this.statuses.get(providerId);
```
