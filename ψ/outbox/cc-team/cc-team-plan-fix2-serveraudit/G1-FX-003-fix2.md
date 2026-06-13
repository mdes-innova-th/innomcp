<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-003 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":2826,"completion_tokens":7000,"total_tokens":9826,"prompt_tokens_details":{"cached_tokens":2816,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":6656,"image_tokens":0},"cache_creation_input_tokens":0} | 68s
 generated: 2026-06-13T11:56:11.038Z -->
FILE: innomcp-server-node/src/intelligence/pipeline.ts
<<<<<<< SEARCH
  private embeddingService: NomicEmbeddingService;
  private vectorStore: SimpleVectorStore;
  private flash = flashSelector;
=======
  private embeddingService: NomicEmbeddingService;
  private vectorStore: SimpleVectorStore;
  private ready: Promise<void>;
  private flash = flashSelector;
>>>>>>> REPLACE

FILE: innomcp-server-node/src/intelligence/pipeline.ts
<<<<<<< SEARCH
    this.vectorStore = new SimpleVectorStore(path.resolve(__dirname, "../../data/memory.json"));
    this.vectorStore.load().catch(err => console.error("Failed to load memory:", err));
=======
    this.vectorStore = new SimpleVectorStore(path.resolve(__dirname, "../../data/memory.json"));
    this.ready = this.vectorStore.load().catch(err => console.error("Failed to load memory:", err));
>>>>>>> REPLACE

FILE: innomcp-server-node/src/intelligence/pipeline.ts
<<<<<<< SEARCH
    private async startMemoryLookup(query: string, startedAt: number): Promise<any[]> {
        try {
            // If embedding fails, embedding service returns null
            const vector = await this.embeddingService.embed(query);
            if (!vector) {
                // Fallback: keyword mode
                return await this.vectorStore.searchByKeyword(query, 5);
            }
            return await this.vectorStore.search(vector, 5);
        } catch {
            // Never throw upward: memory must not crash pipeline
            return [];
        }
    }
=======

