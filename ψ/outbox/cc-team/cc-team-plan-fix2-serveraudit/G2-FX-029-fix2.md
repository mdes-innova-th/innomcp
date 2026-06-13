<!-- cc-team deliverable
 group: G2 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-029 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":2198,"completion_tokens":7000,"total_tokens":9198,"prompt_tokens_details":{"cached_tokens":2176,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":6189,"image_tokens":0},"cache_creation_input_tokens":0} | 68s
 generated: 2026-06-13T12:06:03.018Z -->
FILE: innomcp-server-node/src/mcp/tools/thaiReligionTool.ts
<<<<<<< SEARCH
    execute: async (args: z.infer<typeof ThaiReligionToolInputSchema>) => {
        const query = args.query.toLowerCase();
        const results: any[] = [];

        for (const item of RELIGION_KNOWLEDGE_BASE) {
             // Filter by Type (Map string input to Enum or just compare as string if compatible)
             // Schema defines specific strings, Item uses Enum. 
             // Logic: If arg provided, check if item.type string matches uppercase arg? 
             // Actually input types are "place" | "person" ...
             // Internal types are TEMPLE | MONK ...
             // We need a mapping.
             if (args.type) {
                 const typeMap: Record<string, ReligionType> = {
                     "place": ReligionType.TEMPLE,
                     "person": ReligionType.MONK,
                     "concept": ReligionType.TRADITION,
                     "calendar": ReligionType.TRADITION
                 };
                 if (item.type !== typeMap[args.type]) continue;
             }
             
             // Filter by Province (for Temples)
             if (args.province && item.attributes?.location?.province !== args.province) continue;

             // Match Name or Alt Names
             const matchName = item.name.includes(query) || item.alt_names?.some(n => n.toLowerCase().includes(query));
             const matchDesc = item.description.includes(query);

             if (matchName || matchDesc) {
                 results.push(item);
             }
        }

        if (results.length === 0) {
             return {
                content: [{
                    type: "text" as const,
                    text: `ไม่พบข้อมูลทางศาสนาหรือวัฒนธรรมที่ตรงกับ "${args.query}"`
                }]
            };
        }

        // Format Output
        const formattedText = results.map(item => {
            let info = `## ${item.name}`;
            if (item.alt_names) info += ` (${item.alt_names.join(", ")})`;
            info += `\n${item.description}`;
            
            if (item.attributes?.location) {
                info += `\n📍 ที่ตั้ง: ${item.attributes.location.province}`;
            }
            if (item.attributes?.importance) {
                info += `\n⭐ ความสำคัญ: ${item.attributes.importance.join(", ")}`;
            }
            return info;
        }).join("\n\n");

        return {
             content: [{
                 type: "text" as const,
                 text: formattedText
            }]
        };
    }
=======
    execute: async (args: z.infer<typeof ThaiReligionToolInputSchema>) => {
        try {
            if (!args.query || !args.query.trim()) {
                return {
                    content: [{
                        type: "text" as const,
                        text: "กรุณาระบุคำค้นหา (Query is empty)"
                    }]
                };
            }
            const query = args.query.toLowerCase();
            const results: any[] = [];

            for (const item of RELIGION_KNOWLEDGE_BASE) {
                 // Filter by Type (Map string input to Enum or just compare as string if compatible)
                 // Schema defines specific strings, Item uses Enum. 
                 // Logic: If arg provided, check if item.type string matches uppercase arg? 
                 // Actually input types are "place" | "person" ...
                 // Internal types are TEMPLE | MONK ...
                 // We need a mapping.
                 if (args.type) {
                     const typeMap: Record<string, ReligionType> = {
                         "place": ReligionType.TEMPLE,
                         "person": ReligionType.MONK,
                         "concept": ReligionType.TRADITION,
                         "calendar": Religion
