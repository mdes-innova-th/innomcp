import { VectorStore, MemoryItem } from "./types";
import fs from "fs/promises";
import path from "path";

/**
 * Simple In-Memory Vector Store
 * Persists to JSON file.
 */
export class SimpleVectorStore implements VectorStore {
    private items: MemoryItem[] = [];
    private filePath: string;

    constructor(filePath: string = "./data/memory.json") {
        this.filePath = filePath;
    }

    async add(item: MemoryItem): Promise<void> {
        // Check for duplicate ID
        const index = this.items.findIndex(i => i.id === item.id);
        if (index >= 0) {
            this.items[index] = item; // Update
        } else {
            this.items.push(item);
        }
    }

    async search(queryVector: number[], limit: number = 5): Promise<MemoryItem[]> {
        if (!queryVector || queryVector.length === 0) return [];
        
        // Calculate Cosine Similarity for all items with embeddings
        const scored = this.items
            .filter(item => item.embedding && item.embedding.length === queryVector.length)
            .map(item => ({
                item,
                score: this.cosineSimilarity(queryVector, item.embedding!)
            }))
            .sort((a, b) => b.score - a.score); // Descending

        return scored.slice(0, limit).map(s => s.item);
    }

    async searchByKeyword(query: string, limit: number = 5): Promise<MemoryItem[]> {
        const lowerQuery = query.toLowerCase();
        return this.items
            .filter(item => item.content.toLowerCase().includes(lowerQuery))
            .slice(0, limit);
    }

    async save(): Promise<void> {
        try {
            const dir = path.dirname(this.filePath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(this.filePath, JSON.stringify(this.items, null, 2), "utf-8");
        } catch (err) {
            console.error(`[Memory] Failed to save vector store: ${(err as Error).message}`);
        }
    }

    async load(): Promise<void> {
        try {
            const data = await fs.readFile(this.filePath, "utf-8");
            this.items = JSON.parse(data);
        } catch (err) {
            // If file doesn't exist, start empty
            console.log(`[Memory] No existing memory file found at ${this.filePath}, starting fresh.`);
            this.items = [];
        }
    }

    private cosineSimilarity(vecA: number[], vecB: number[]): number {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
