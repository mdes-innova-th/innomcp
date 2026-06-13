<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-002 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2139,"completion_tokens":6323,"total_tokens":8462,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5435,"image_tokens":0},"cache_creation_input_tokens":0} | 178s
 generated: 2026-06-13T11:56:39.442Z -->
FILE: innomcp-server-node/src/intelligence/flashSelector.ts
<<<<<<< SEARCH
        // Generic Weather (Fallback to current if no province)
        return {
            toolName: "weather", 
            confidence: 0.8,
            args: { location: "Bangkok", country: "TH" }, // Defaulting is risky/smart? Let's be safe: 
            // actually, if no location, maybe return NULL to let LLM handle it?
            // "Pre-think" says: if I don't know location, I shouldn't guess.
            // BUT, for "อากาศวันนี้" (Weather today), local user implies local context?
            // Let's return null to let LLM resolve location if not found.
            // Wait, DoD says "Thai-only optimization".
            // Let's support generic "weather" -> tmd_daily (which is Thailand wide?)
            reason: "weather_keyword_generic"
        };
        // If we found keywords but no province, we return NULL to let LLM do Entity Extraction?
        // OR we map to a tool that handles missing args well?
        // Let's return NULL for now to be safe, unless "generic" is requested.
        // Actually for the benchmark "���ยากรณ์อากาศที่เชียงใหม่", we need to hit.
=======
        return null;  // No province found, let LLM extract location
>>>>>>> REPLACE

FILE: innomcp-server-node/src/intelligence/flashSelector.ts
<<<<<<< SEARCH
    // 3. Currency
    if (EXCHANGE_KEYWORDS.some(k => q.includes(k))) {
        return {
            toolName: "currencyExchangeTool",
            confidence: 0.85, 
            args: { from: "USD", to: "THB", amount: 1 }, // Defaults, tool might handle formatting
            reason: "currency_keyword"
        };
    }
=======
    // 3. Currency
    if (EXCHANGE_KEYWORDS.some(k => q.includes(k))) {
        return null; // Defer to LLM for correct currencies and amount
    }
>>>>>>> REPLACE

FILE: innomcp-server-node/src/intelligence/flashSelector.ts
<<<<<<< SEARCH
        const knownProvinces = ["bangkok", "chiang mai", "phuket", "chon buri", "กรุงเทพ", "เชียงใหม่", "ภูเก็ต", "ชลบุรี", "โคราช", "นครราชสีมา"];
=======
        const knownProvinces = ["bangkok", "chiang mai", "phuket", "chon buri", "กรุงเทพ", "เชียงใหม่", "ภูเก็ต", "ชลบุรี", "โคราช", "นครราชสีมา"];
        const provinceNormalization: Record<string, string> = {
            "bangkok": "Bangkok", "chiang mai": "Chiang Mai", "phuket": "Phuket", "chon buri": "Chon Buri",
            "กรุงเทพ": "Bangkok", "เชียงใหม่": "Chiang Mai", "ภูเก็ต": "Phuket", "ชลบุรี": "Chon Buri",
            "โคราช": "Nakhon Ratchasima", "นครราชสีมา": "Nakhon Ratchasima"
        };
>>>>>>> REPLACE

FILE: innomcp-server-node/src/intelligence/flashSelector.ts
<<<<<<< SEARCH
                args: { province: foundProvince }, // This might need normalization, but good enough for Flash
=======
                args: { province: provinceNormalization[foundProvince] }, // Normalized canonical name
>>>>>>> REPLACE

FILE: innomcp-server-node/src/intelligence/flashSelector.ts
<<<<<<< SEARCH
  select(query: string): FlashSelection | null {
=======
  select(query: string): FlashSelection | null {
    if (typeof query !== 'string') return null;
>>>>>>> REPLACE
