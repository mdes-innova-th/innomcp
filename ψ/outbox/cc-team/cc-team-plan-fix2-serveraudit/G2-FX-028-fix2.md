<!-- cc-team deliverable
 group: G2 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-028 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2966,"completion_tokens":5998,"total_tokens":8964,"prompt_tokens_details":{"cached_tokens":2944,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5285,"image_tokens":0},"cache_creation_input_tokens":0} | 62s
 generated: 2026-06-13T12:04:54.684Z -->
FILE: innomcp-server-node/src/mcp/tools/thaiLawTool.ts
<<<<<<< SEARCH
        const query = args.query.toLowerCase();
        const type = args.type || "search";
=======
        const query = args.query.toLowerCase();
        if (!query.trim()) {
            return {
                content: [{ type: "text" as const, text: "กรุณาระบุคำค้นหา" }]
            };
        }
        const type = args.type || "search";
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/thaiLawTool.ts
<<<<<<< SEARCH
        // 2. Keyword Search
        else {
            for (const law of LAW_KNOWLEDGE_BASE) {
                 // Match Law Name
                 if (law.name.toLowerCase().includes(query) || law.short_name?.toLowerCase().includes(query)) {
                      metadata_info += `Found Law: ${law.name}\n`;
                      if (law.sections) results.push(...law.sections.map(s => ({...s, title: `${law.short_name} ม.${s.no} ${s.title}`})));
                 }
                 // Match Section Content
                 else if (law.sections) {
                     const matchedSections = law.sections.filter(s => 
                        s.content.toLowerCase().includes(query) || 
                        s.title?.toLowerCase().includes(query)
                     );
                     if (matchedSections.length > 0) {
                         results.push(...matchedSections.map(s => ({...s, title: `${law.short_name} ม.${s.no} ${s.title}`})));
                     }
                 }
            }
        }
=======
        // 2. Keyword Search
        else {
            for (const law of LAW_KNOWLEDGE_BASE) {
                 if (args.law_name_filter && !law.name.includes(args.law_name_filter) && !law.short_name?.includes(args.law_name_filter)) {
                     continue;
                 }
                 // Match Law Name
                 if (law.name.toLowerCase().includes(query) || law.short_name?.toLowerCase().includes(query)) {
                      metadata_info += `Found Law: ${law.name}\n`;
                      if (law.sections) results.push(...law.sections.map(s => ({...s, title: `${law.short_name} ม.${s.no} ${s.title}`})));
                 }
                 // Match Section Content
                 else if (law.sections) {
                     const matchedSections = law.sections.filter(s => 
                        s.content.toLowerCase().includes(query) || 
                        s.title?.toLowerCase().includes(query)
                     );
                     if (matchedSections.length > 0) {
                         results.push(...matchedSections.map(s => ({...s, title: `${law.short_name} ม.${s.no} ${s.title}`})));
                     }
                 }
            }
        }
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/thaiLawTool.ts
<<<<<<< SEARCH
            } catch {
                // DB unavailable — fall through to not-found
            }
=======
            } catch (err) {
                console.error("ThaiLaw DB fallback error:", err);
                return {
                    content: [{ type: "text" as const, text: "ระบบฐานข้อมูลไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง" }]
                };
            }
>>>>>>> REPLACE
