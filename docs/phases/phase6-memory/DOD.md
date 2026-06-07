# Definition of Done - Phase 6: Memory & RAG

## 1. Architecture & Core

- [ ] `EmbeddingService` implemented with `nomic-embed-text`.
- [ ] **Fallback Mechanism** active: Switches to Keyword Search if Embedding fails/timeouts.
- [ ] `SimpleVectorStore` implemented (In-memory or File-backed JSON is fine for MVP).

## 2. Integration

- [ ] `IntelligencePipeline` updated to support `memory` capability.
- [ ] **Performance**: Memory lookup does not block high-confidence tool execution (verified async).
- [ ] `workspace-storage` indexing: Can index `.txt` and `.md` files.

## 3. Tools

- [ ] `rag_tool` (or `memory_tool`) exposed to MCP.
  - Input: `query`
  - Output: Relevant context chunks.

## 4. Quality & Testing

- [ ] **Unit Test**: Mock Ollama failure -> Verify Fallback triggers.
- [ ] **Integration Test**: Upload file -> Search content -> Verify retrieval.
- [ ] **Benchmark**: RAG overhead is measured.

## 5. Documentation

- [ ] Updated `architecture/memory.md`.
- [ ] User guide for using RAG features.
