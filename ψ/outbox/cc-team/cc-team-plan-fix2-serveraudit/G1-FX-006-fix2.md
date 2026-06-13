<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-006 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1179,"completion_tokens":3244,"total_tokens":4423,"prompt_tokens_details":{"cached_tokens":1152,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2925,"image_tokens":0},"cache_creation_input_tokens":0} | 36s
 generated: 2026-06-13T11:55:39.852Z -->
FILE: innomcp-server-node/src/mcp/knowledge/types/law.ts
<<<<<<< SEARCH
}

// Main Entity
export const ThaiLawEntitySchema = z.object({
=======
}

export const LawSectionSchema = z.object({
    no: z.string(),
    title: z.string().optional(),
    content: z.string(),
    keywords: z.array(z.string()).optional()
});

// Main Entity
export const ThaiLawEntitySchema = z.object({
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/knowledge/types/law.ts
<<<<<<< SEARCH
    sections: z.array(z.custom<LawSection>()).optional(),
=======
    sections: z.array(LawSectionSchema).optional(),
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/knowledge/types/law.ts
<<<<<<< SEARCH
    published_date: z.string().optional(), // YYYY-MM-DD
=======
    published_date: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/).optional(), // YYYY-MM-DD
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/knowledge/types/law.ts
<<<<<<< SEARCH
    last_updated: z.string()
=======
    last_updated: z.string().datetime()
>>>>>>> REPLACE
