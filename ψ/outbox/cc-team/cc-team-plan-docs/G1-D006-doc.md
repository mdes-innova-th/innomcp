<!-- cc-team deliverable
 group: G1 (Doc generation)
 member: D006 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":2413,"completion_tokens":837,"total_tokens":3250,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":253,"image_tokens":0},"cache_creation_input_tokens":0} | 10s
 generated: 2026-06-13T11:19:48.941Z -->
- **`ColdDocument`** – Represents a single document loaded into the corpus. Contains metadata (path, title, tags, domain, file size, last updated) and a list of text chunks.  
  - **@property** `id`: Unique identifier using the `cold:` prefix and relative path.  
  - **@property** `chunks`: Sub-divided by `chunkText()` with overlapping boundaries (500-char chunks, 100-char overlap).  

- **`ColdChunk`** – A contiguous segment of text from a `ColdDocument`, with its position within the original file (start/end line numbers).  
  - **@property** `id`: Unique chunk ID `${documentId}:chunk:${index}`.  

- **`ColdRetrievalResult`** – Result of a search: a matched chunk, its parent document, a TF‑IDF relevance score, and the source type (`RetrievalSource` from `answerContract`).  

- **`ColdRetriever`** – Document-based retriever using TF‑IDF on a local corpus of markdown/text files. No external vector database. Must call `loadCorpus()` before `search()`.  

  - **`loadCorpus(corpusDir: string): Promise<{ docCount: number; chunkCount: number }>`**  
    Scans `corpusDir` for `.md` and `.txt` files (ignores `node_modules`, `.git`, hidden dotfiles, and empty files). Parses YAML front‑matter for `tags`, infers domain from file path patterns (e.g., `weather`, `evidence`). Chunks each document with 100‑character overlap. Builds an IDF map from the entire corpus.  
    - **Returns** object with counts; returns `{ docCount: 0, chunkCount: 0 }` if directory missing.  
    - **Caveat**: Only re‑loads from scratch; call again to refresh.  

  - **`search(query: string, options?: { maxResults?: number; domain?: string }): ColdRetrievalResult[]`**  
    Performs TF‑IDF scoring of query against all chunks (or filtered by domain). Results sorted by descending score.  
    - **@param** `options.maxResults` – Default `5`.  
    - **@param** `options.domain` – If provided, only returns chunks from documents whose `metadata.domain` matches.  
    - **Returns** empty array if not initialized or no documents loaded.  
    - **Caveat**: Tokenization is simple (lowercase split on non‑word characters) and may not handle all languages equally. IDF is computed once at load time and not updated incrementally.
