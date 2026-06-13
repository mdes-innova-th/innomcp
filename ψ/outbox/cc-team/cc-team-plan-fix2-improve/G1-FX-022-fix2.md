<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from improve)
 member: FX-022 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2188,"completion_tokens":5129,"total_tokens":7317,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4712,"image_tokens":0},"cache_creation_input_tokens":0} | 49s
 generated: 2026-06-13T11:41:18.094Z -->
FILE: innomcp-node/src/geo/geo-tool-router.ts
<<<<<<< SEARCH
	public route(intent: GeoIntentResult): ToolPlan | null {
		if (intent.domain !== "weather" || intent.confidence < 0.6) return null;
=======
	public route(intent: GeoIntentResult): ToolPlan | null {
		if (intent == null) return null;
		if (intent.domain !== "weather" || intent.confidence < 0.6) return null;
>>>>>>> REPLACE

FILE: innomcp-node/src/geo/geo-tool-router.ts
<<<<<<< SEARCH
		if (intent.domain !== "weather" || intent.confidence < 0.6) return null;

		const { features, subdomain } = intent;
=======
		const conf = intent.confidence ?? 0;
		if (intent.domain !== "weather" || conf < 0.6) return null;

		const { features, subdomain } = intent;
>>>>>>> REPLACE

FILE: innomcp-node/src/geo/geo-tool-router.ts
<<<<<<< SEARCH
		const { features, subdomain } = intent;
		const hasCoords = features.has_coords && features.coords !== undefined;
=======
		const features = intent.features;
		if (!features) return null;
		const { subdomain } = intent;
		const hasCoords = features.has_coords && features.coords !== undefined;
>>>>>>> REPLACE

FILE: innomcp-node/src/geo/geo-tool-router.ts
<<<<<<< SEARCH
		const hasPlace = features.location_terms.length > 0;
		const place = features.location_terms.join(" ");
=======
		const locationTerms = features.location_terms.filter(t => t.trim());
		const hasPlace = locationTerms.length > 0;
		const place = locationTerms.join(" ");
>>>>>>> REPLACE
