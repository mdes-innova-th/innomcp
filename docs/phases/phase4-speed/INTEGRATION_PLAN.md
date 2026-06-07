# Integration Plan: Intelligence Pipeline

## 🎯 Goal

Integrate `IntelligencePipeline` into `innomcp-server-node/src/server.ts` to expose a high-performance, intelligent query endpoint.

## 📍 Integration Logic

Since the "Flash Selector" replaces the LLM for simple queries, we need an endpoint that accepts natural language, not just `CallTool` requests.

### 1. New Endpoint: `POST /api/generate` (or `/api/smart`)

- **Input**: `{ query: string, history?: any[] }`
- **Output**: SSE Stream (Server-Sent Events) of `PipelineEvent`.

### 2. Changes in `server.ts`

1.  **Import**:
    ```typescript
    import { IntelligencePipeline } from "./intelligence/pipeline";
    import { flashSelector } from "./intelligence/flashSelector";
    ```
2.  **Tool Collection**:
    - We need to gather all registered tools into a map `Record<string, Tool>`.
    - Since `mcpserver` stores tools, we might need to access them or maintain a separate map.
    - _Strategy_: Creating a `toolsMap` as we register tools, or extracting from `mcpserver` private state (risky).
    - _Better Strategy_: Just create a `toolsRegistry` object and pass it to both `mcpserver.registerTool` and `IntelligencePipeline`.

3.  **Feature Flag**:

    ```typescript
    const USE_INTELLIGENCE_PIPELINE =
      process.env.USE_INTELLIGENCE_PIPELINE === "true";
    ```

4.  **Route Handler**:
    ```typescript
    app.post("/api/smart", async (req, res) => {
      // ... Validation ...
      // Setup SSE headers
      res.setHeader("Content-Type", "text/event-stream");

      const pipeline = new IntelligencePipeline(toolsRegistry);
      pipeline.on("event", (e) => res.write(`data: ${JSON.stringify(e)}\n\n`));
      await pipeline.execute(req.body.query);
      res.end();
    });
    ```

## 🛠️ Validation

- Call `curl -X POST http://localhost:3012/api/smart -d '{"query":"อากาศเชียงใหม่"}'`
- Verify SSE response stream.
