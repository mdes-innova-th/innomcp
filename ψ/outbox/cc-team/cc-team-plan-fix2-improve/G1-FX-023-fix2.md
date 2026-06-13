<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from improve)
 member: FX-023 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1591,"completion_tokens":7916,"total_tokens":9507,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":7294,"image_tokens":0},"cache_creation_input_tokens":0} | 75s
 generated: 2026-06-13T11:42:32.946Z -->
FILE: innomcp-node/src/geo/geo-service.ts
<<<<<<< SEARCH
    if (intentResult.domain !== "weather" || intentResult.confidence < 0.5) {
=======
    if (!intentResult || intentResult.domain !== "weather" || intentResult.confidence < 0.5) {
>>>>>>> REPLACE

FILE: innomcp-node/src/geo/geo-service.ts
<<<<<<< SEARCH
    // 3. Execute primary via Guard
    const rawPacket = await this.guard.executeWithGuard(
      () => this.dispatch(plan.primary.tool_name, plan.primary.params),
      plan.primary.tool_name,
    );
=======
    // 3. Execute primary via Guard
    let rawPacket;
    try {
      rawPacket = await this.guard.executeWithGuard(
        () => this.dispatch(plan.primary.tool_name, plan.primary.params),
        plan.primary.tool_name,
      );
    } catch (err) {
      console.error(`[GeoService] Primary tool ${plan.primary.tool_name} threw an exception:`, err);
      rawPacket = { error: String(err), data: null };
    }
>>>>>>> REPLACE

FILE: innomcp-node/src/geo/geo-service.ts
<<<<<<< SEARCH
    for (const fb of plan.fallbacks) {
=======
    for (const fb of plan.fallbacks ?? []) {
>>>>>>> REPLACE

FILE: innomcp-node/src/geo/geo-service.ts
<<<<<<< SEARCH
      const fbPacket = await this.guard.executeWithGuard(
        () => this.dispatch(fb.tool_name, fb.params),
        fb.tool_name,
      );
=======
      let fbPacket;
      try {
        fbPacket = await this.guard.executeWithGuard(
          () => this.dispatch(fb.tool_name, fb.params),
          fb.tool_name,
        );
      } catch (err) {
        console.error(`[GeoService] Fallback tool ${fb.tool_name} threw an exception:`, err);
        fbPacket = { error: String(err), data: null };
      }
>>>>>>> REPLACE

FILE: innomcp-node/src/geo/geo-service.ts
<<<<<<< SEARCH
    if (!rawPacket.error) {
=======
    if (rawPacket && !rawPacket.error) {
>>>>>>> REPLACE

FILE: innomcp-node/src/geo/geo-service.ts
<<<<<<< SEARCH
      if (!fbPacket.error) {
=======
      if (fbPacket && !fbPacket.error) {
>>>>>>> REPLACE

FILE: innomcp-node/src/geo/geo-service.ts
<<<<<<< SEARCH
    return rawPacket;
=======
    return this.aggregator.format(rawPacket);
>>>>>>> REPLACE
