<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from security)
 member: FX-005 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":3207,"completion_tokens":8000,"total_tokens":11207,"prompt_tokens_details":{"cached_tokens":3200,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":7715,"image_tokens":0},"cache_creation_input_tokens":0} | 81s
 generated: 2026-06-13T11:37:08.976Z -->
FILE: innomcp-node/src/services/dataAnalysisTool.ts
<<<<<<< SEARCH
  } else {
    const safePath = path.resolve(input.workspaceRoot, input.path.replace(/^\/+/, ""));
    if (!safePath.startsWith(input.workspaceRoot)) throw new Error("Path outside workspace");
    text = await fs.readFile(safePath, "utf-8");
  }
=======
  } else {
    if (!opts.workspaceRoot) throw new Error("Workspace root is required for file reading");
    const realWorkspaceRoot = await fs.realpath(opts.workspaceRoot);
    const safePath = path.resolve(opts.workspaceRoot, input.path.replace(/^\/+/, ""));
    const realPath = await fs.realpath(safePath);
    if (!realPath.startsWith(realWorkspaceRoot + path.sep) && realPath !== realWorkspaceRoot) {
      throw new Error("Path outside workspace");
    }
    const stat = await fs.stat(safePath);
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
    if (stat.size > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${stat.size} bytes (max ${MAX_FILE_SIZE})`);
    }
    text = await fs.read
