/**
 * Phase 6: Memory & RAG Types
 */

export type MemoryType = "file" | "tool_result" | "db_row" | "conversation";

export interface MemoryItem {
    id: string;
    content: string;
    type: MemoryType;
    metadata?: Record<string, any>;
    embedding?: number[]; // Vector representation
    timestamp: number;
}

export interface EmbeddingService {
    /**
     * Generate embedding vector for text.
     * Returns null if service fails and fallback is not possible/applicable.
     */
    embed(text: string): Promise<number[] | null>;
}

export interface VectorStore {
    /**
     * Add item to store.
     * If item has no embedding, store implementation might generate it or throw.
     */
    add(item: MemoryItem): Promise<void>;

    /**
     * Search for similar items.
     */
    search(queryVector: number[], limit?: number): Promise<MemoryItem[]>;
    
    /**
     * Search by Keyword (Fallback).
     */
    searchByKeyword(query: string, limit?: number): Promise<MemoryItem[]>;

    /**
     * Persist to disk (if applicable).
     */
    save(): Promise<void>;
    
    /**
     * Load from disk (if applicable).
     */
    load(): Promise<void>;
}
