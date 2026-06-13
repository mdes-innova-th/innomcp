<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from security)
 member: FX-004 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3470,"completion_tokens":5972,"total_tokens":9442,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4832,"image_tokens":0},"cache_creation_input_tokens":0} | 56s
 generated: 2026-06-13T11:32:58.563Z -->
FILE: innomcp-node/src/services/coldRetriever.ts
<<<<<<< SEARCH
  async loadCorpus(corpusDir: string): Promise<{ docCount: number; chunkCount: number }> {
    this.documents = [];
    this.idfMap = new Map();

    if (!fs.existsSync(corpusDir)) {
      console.warn(`[ColdRetriever] Corpus directory not found: ${corpusDir}`);
      return { docCount: 0, chunkCount: 0 };
    }

    const files = this.listFiles(corpusDir);
    const allowedExts = [".md", ".txt"];

    let totalChunks = 0;
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!allowedExts.includes(ext)) continue;

      // Skip dotfiles and hidden dirs
      if (file.includes("node_modules") || file.includes(".git")) continue;

      try {
        const content = fs.readFileSync(file, "utf-8");
        if (content.trim().length === 0) continue;

        const relativePath = path.relative(corpusDir, file).replace(/\\/g, "/");
        const docId = `cold:${relativePath}`;
        const tags = extractTags(content, relativePath);
        const stat = fs.statSync(file);

        const doc: ColdDocument = {
          id: docId,
          path: relativePath,
          title: extractTitle(content, file),
          content,
          chunks: chunkText(content, docId),
          metadata: {
            updatedAt: stat.mtime.toISOString(),
            domain: inferDomain(tags, relativePath),
            tags,
            fileSize: stat.size,
          },
        };

        this.documents.push(doc);
        totalChunks += doc.chunks.length;
      } catch (err) {
        console.warn(`[ColdRetriever] Failed to load ${file}:`, err);
      }
    }

    this.buildIDF();
    this.initialized = true;
    console.log(`[ColdRetriever] Loaded ${this.documents.length} docs, ${totalChunks} chunks from ${corpusDir}`);
    return { docCount: this.documents.length, chunkCount: totalChunks };
  }
=======
  async loadCorpus(corpusDir: string): Promise<{ docCount: number; chunkCount: number }> {
    this.documents = [];
    this.idfMap = new Map();

    // Resolve and verify corpus directory path containment
    const resolvedCorpusDir = path.resolve(corpusDir);
    const allowedBase = path.resolve(__dirname, "..", "..", "corpus"); // Configure as needed
    if (!resolvedCorpusDir.startsWith(allowedBase + path.sep)) {
      console.warn(`[ColdRetriever] Corpus directory ${corpusDir} is outside allowed base ${allowedBase}`);
      return { docCount: 0, chunkCount: 0 };
    }

    if (!fs.existsSync(resolvedCorpusDir)) {
      console.warn(`[ColdRetriever] Corpus directory not found: ${resolvedCorpusDir}`);
      return { docCount: 0, chunkCount: 0 };
    }

    const files = this.listFiles(resolvedCorpusDir);
    const allowedExts = [".md", ".txt"];

    let totalChunks = 0;
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!allowedExts.includes(ext)) continue;

      // Skip dotfiles and hidden dirs
      if (file.includes("node_modules") || file.includes(".git")) continue;

      try {
        // Skip symbolic links to prevent path traversal
        const fileStat = fs.lstatSync(file);
        if (fileStat.isSymbolicLink()) {
          console.warn(`[ColdRetriever] Skipping symlink: ${file}`);
          continue;
        }

        const content = fs.readFileSync(file, "utf-8");
        if (content.trim().length === 0) continue;

        const relativePath = path.relative(resolvedCorpusDir, file).replace(/\\/g, "/");
        const docId = `cold:${relativePath}`;
        const tags = extractTags(content, relativePath);

        const doc: ColdDocument = {
          id: docId,
          path: relativePath,
          title: extractTitle(content, file),
          content,
          chunks: chunkText(content, docId),
          metadata: {
            updatedAt: fileStat.mtime.toISOString(),
            domain: inferDomain(tags, relativePath),
            tags,
            fileSize: fileStat.size,
          },
        };

        this.documents.push(doc);
        totalChunks += doc.chunks.length;
      } catch (err) {
        console.warn(`[ColdRetriever] Failed to load ${file}:`, err);
      }
    }

    this.buildIDF();
    this.initialized = true;
    console.log(`[ColdRetriever] Loaded ${this.documents.length} docs, ${totalChunks} chunks from ${resolvedCorpusDir}`);
    return { docCount: this.documents.length, chunkCount: totalChunks };
  }
>>>>>>> REPLACE
