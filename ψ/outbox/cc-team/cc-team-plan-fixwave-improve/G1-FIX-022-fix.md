<!-- cc-team deliverable
 group: G1 (Fix patches from improve audit findings)
 member: FIX-022 role=fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2091,"completion_tokens":2424,"total_tokens":4515,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1742,"image_tokens":0},"cache_creation_input_tokens":0} | 27s
 generated: 2026-06-13T11:30:45.344Z -->
## 1. HIGH – `route`: guard against `null`/`undefined` `intent`

```diff
--- a/innomcp-node/src/geo/geo-tool-router.ts
+++ b/innomcp-node/src/geo/geo-tool-router.ts
@@ -15,6 +15,7 @@ export class GeoRouter {
 	 * Returns null when the intent is not actionable.
 	 */
 	public route(intent: GeoIntentResult): ToolPlan | null {
+		if (intent == null) return null;
 		if (intent.domain !== "weather" || intent.confidence < 0.6) return null;

 		const { features, subdomain } = intent;
```

## 2. HIGH – `route`: guard against missing/null `features`

```diff
--- a/innomcp-node/src/geo/geo-tool-router.ts
+++ b/innomcp-node/src/geo/geo-tool-router.ts
@@ -18,6 +18,7 @@ export class GeoRouter {
 		if (intent.domain !== "weather" || intent.confidence < 0.6) return null;

 		const { features, subdomain } = intent;
+		if (!features) return null;
 		const hasCoords = features.has_coords && features.coords !== undefined;
 		const hasPlace = features.location_terms.length > 0;
 		const place = features.location_terms.join(" ");
```

## 3. MEDIUM – `route`: treat missing confidence as `0`

```diff
--- a/innomcp-node/src/geo/geo-tool-router.ts
+++ b/innomcp-node/src/geo/geo-tool-router.ts
@@ -15,7 +15,8 @@ export class GeoRouter {
 	 * Returns null when the intent is not actionable.
 	 */
 	public route(intent: GeoIntentResult): ToolPlan | null {
-		if (intent.domain !== "weather" || intent.confidence < 0.6) return null;
+		const conf = intent.confidence ?? 0;
+		if (intent.domain !== "weather" || conf < 0.6) return null;

 		const { features, subdomain } = intent;
 		const hasCoords = features.has_coords && features.coords !== undefined;
```

## 4. LOW – `route`: filter whitespace-only location terms

```diff
--- a/innomcp-node/src/geo/geo-tool-router.ts
+++ b/innomcp-node/src/geo/geo-tool-router.ts
@@ -19,8 +19,9 @@ export class GeoRouter {
 		const { features, subdomain } = intent;
 		const hasCoords = features.has_coords && features.coords !== undefined;
-		const hasPlace = features.location_terms.length > 0;
-		const place = features.location_terms.join(" ");
+		const filteredTerms = features.location_terms.filter(t => t.trim());
+		const hasPlace = filteredTerms.length > 0;
+		const place = filteredTerms.join(" ");

 		// No location info at all → cannot route
 		if (!hasCoords && !hasPlace) return null;
```
