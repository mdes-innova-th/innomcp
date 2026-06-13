<!-- cc-team deliverable
 group: G1 (Fix patches from improve audit findings)
 member: FIX-020 role=fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2572,"completion_tokens":4378,"total_tokens":6950,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2806,"image_tokens":0},"cache_creation_input_tokens":0} | 46s
 generated: 2026-06-13T11:30:24.795Z -->
### Finding 1 — HIGH: `NaN` in rank closure due to possibly undefined `p.priority`

**Fix** – guard with `(p.priority ?? 0)` so a missing priority defaults to zero.

```typescript
@@ -99,7 +99,7 @@
   const eligible = capabilityCandidates.length > 0 ? capabilityCandidates : candidates;
-  const rank = (p: ProviderRecord) => capabilityScore(p, opts.capabilities) * 100 + p.priority;
+  const rank = (p: ProviderRecord) => capabilityScore(p, opts.capabilities) * 100 + (p.priority ?? 0);
```

---

### Finding 2 — MEDIUM: `resolveApiKey` may be asynchronous but is called synchronously

**Fix** – make `resolveProviderEndpoint` async, `await` the key, and update the return type accordingly.

```typescript
@@ -134,10 +134,10 @@
-export function resolveProviderEndpoint(
+export async function resolveProviderEndpoint(
   providerId: string
-): { url: string; key: string; model: string } | null {
+): Promise<{ url: string; key: string; model: string } | null> {
   const provider = getProvider(providerId);
   if (!provider) return null;
 
-  const key = resolveApiKey(providerId) || "";
+  const key = await resolveApiKey(providerId) || "";
 
   return {
     url: provider.baseUrl,
```

---

### Finding 3 — MEDIUM: `resolveProviderEndpoint` returns possibly‑undefined `baseUrl` / `model`

**Fix** – validate that both are truthy strings after obtaining the provider record; return `null` and log a warning if missing.

```typescript
@@ -136,7 +136,12 @@
   const provider = getProvider(providerId);
   if (!provider) return null;
 
+  if (!provider.baseUrl || !provider.model) {
+    console.warn(`Provider ${providerId} is missing baseUrl or model`);
+    return null;
+  }
+
   const key = resolveApiKey(providerId) || "";
```

---

### Finding 4 — MEDIUM: `matchesPrivacy` treats `undefined` privacyLevel as non‑public, leaking providers

**Fix** – normalise a missing `privacyLevel` to `"public"` before comparing.

```typescript
@@ -47,7 +47,8 @@
 function matchesPrivacy(p: ProviderRecord, want?: PrivacyLevel): boolean {
   if (!want) return true;
-  // confidential demands confidential or internal; public demands any.
-  if (want === "confidential") return p.privacyLevel === "confidential" || p.privacyLevel === "internal";
-  if (want === "internal") return p.privacyLevel !== "public";
+  const level = p.privacyLevel ?? "public";
+  // confidential demands confidential or internal; public demands any.
+  if (want === "confidential") return level === "confidential" || level === "internal";
+  if (want === "internal") return level !== "public";
   return true;
 }
```

---

### Finding 5 — LOW: uncaught registry errors in `selectProvider` / `resolveProviderEndpoint`

**Fix** – wrap registry calls in `try`/`catch` and return safe fallback results (error reason for `selectProvider`, `null` for `resolveProviderEndpoint`).

**`selectProvider` patch** (full function replacement to show the added `try`/`catch`)

```typescript
export function selectProvider(opts: SelectOptions): SelectionResult {
  try {
    const all = listProviders().filter((p) => p.enabled);
    const candidates = all
      .filter((p) => matchesMode(p, opts.mode))
      .filter((p) => matchesPrivacy(p, opts.privacyLevel))
      .filter((p) => (opts.excludeDown !== false ? p.healthStatus !== "down" : true));

    if (candidates.length === 0) {
      return {
        provider: null,
        alternates: [],
        reason: "ไม่พบผู้ให้บริการที่เข้าเงื่อนไขการเลือก",
      };
    }

    const capabilityCandidates =
      opts.capabilities.length > 0
        ? candidates.filter((p) => capabilityScore(p, opts.capabilities) > 0)
        : candidates;
    const eligible = capabilityCandidates.length > 0 ? capabilityCandidates : candidates;
    const rank = (p: ProviderRecord) => capabilityScore(p, opts.capabilities) * 100 + (p.priority ?? 0);
    const preferred = opts.preferredProviderId
      ? eligible.find((p) => p.id === opts.preferredProviderId)
      : undefined;

    if (preferred && capabilityScore(preferred, opts.capabilities) > 0) {
      const alternates = eligible
        .filter((p) => p.id !== preferred.id)
        .sort((a, b) => rank(b) - rank(a));
      const matched = opts.capabilities.filter((c) => preferred.capabilities.includes(c));
      const reason =
        `เลือก ${preferred.displayName} ตาม provider ที่ผู้ใช้ระบุ` +
        (matched.length > 0 ? `: ตรงความสามารถ ${matched.join(", ")}` : "");
      return { provider: preferred, alternates, reason };
    }

    const ranked = eligible
      .map((p) => ({ p, score: rank(p) }))
      .sort((a, b) => b.score - a.score);

    const top = ranked[0].p;
    const alternates = ranked.slice(1).map((r) => r.p);
    const matched = opts.capabilities.filter((c) => top.capabilities.includes(c));
    const reason =
      `เลือก ${top.displayName} (priority=${top.priority})` +
      (matched.length > 0 ? `: ตรงความสามารถ ${matched.join(", ")}` : "");
    return { provider: top, alternates, reason };
  } catch (err) {
    return {
      provider: null,
      alternates: [],
      reason: `เกิดข้อผิดพลาดภายใน: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
```

**`resolveProviderEndpoint` patch** (added `try`/`catch` around the body)

```typescript
@@ -134,12 +134,18 @@
   providerId: string
 ): { url: string; key: string; model: string } | null {
-  const provider = getProvider(providerId);
-  if (!provider) return null;
+  try {
+    const provider = getProvider(providerId);
+    if (!provider) return null;
 
-  const key = resolveApiKey(providerId) || "";
+    const key = resolveApiKey(providerId) || "";
 
-  return {
-    url: provider.baseUrl,
-    key: key,
-    model: provider.model,
-  };
+    return {
+      url: provider.baseUrl,
+      key: key,
+      model: provider.model,
+    };
+  } catch (_err) {
+    return null;
+  }
 }
```
