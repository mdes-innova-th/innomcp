import { EmbeddingService } from "./types";

/**
 * Nomic Embedding Service
 * Primary: Ollama /api/embeddings (model: nomic-embed-text)
 * Fallback: Returns null (Pipeline handles fallback to Keyword)
 */
export class NomicEmbeddingService implements EmbeddingService {
    private endpoint: string;
    private model: string;
    private timeoutMs: number;

    constructor(
        endpoint: string = "http://localhost:11434/api/embeddings", 
        model: string = "nomic-embed-text",
        timeoutMs: number = 2000
    ) {
        this.endpoint = endpoint;
        this.model = model;
        this.timeoutMs = timeoutMs;
    }

    async embed(text: string): Promise<number[] | null> {
        if (!text || text.trim().length === 0) return null;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

            const response = await fetch(this.endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: this.model,
                    prompt: text
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                // Silent fallback
                return null;
            }

            const data = await response.json();
            return data.embedding; // 768-dim vector
            
        } catch (error) {
            // Silent fallback: return null so the system knows to use Keyword Search
            // Do not log error to console to prevent spam
            return null;
        }
    }
}
