/**
 * Phase 4: Intelligent Pipeline Implementation
 *
 * STRATEGY: Parallel Execution with stream-like event emission.
 * SLA: TTFB < 1.5s
 */

import { FlashSelection, flashSelector } from "./flashSelector";
import { EventEmitter } from "events";
import { NomicEmbeddingService } from "../memory/embedding";
import { SimpleVectorStore } from "../memory/vectorStore";
import { FastPathLayer } from "./fastPathLayer"; // Import FastPathLayer
import path from "path";

export type PipelineEvent =
    | { type: "selection"; tool: FlashSelection | null; ms: number }
    | { type: "progress"; text: string; ms: number }
    | { type: "memory"; items: any[]; ms: number }
    | { type: "final_answer"; text: string; ms: number }
    | { type: "error"; message: string; ms: number }
    | { type: "tool_start"; name: string; args: any; ms: number }
    | { type: "tool_result"; result: any; ms: number };

export interface PipelineOptions {
  useFlash?: boolean;
  parallel?: boolean;
  maxTools?: number; 
  toolsRegistry?: Record<string, any>; 
  enableMemory?: boolean; 
}

export class IntelligencePipeline extends EventEmitter {
  private embeddingService: NomicEmbeddingService;
  private vectorStore: SimpleVectorStore;
  private flash = flashSelector;
  private fastPath = new FastPathLayer(); // Initialize FastPathLayer

  constructor(private tools: Record<string, any>) {
    super();
    // Initialize Memory System
    this.embeddingService = new NomicEmbeddingService();
    this.vectorStore = new SimpleVectorStore(path.resolve(__dirname, "../../data/memory.json"));
    this.vectorStore.load().catch(err => console.error("Failed to load memory:", err));
  }

  /**
   * Main Entrypoint
   */
    async *execute(query: string): AsyncGenerator<PipelineEvent> {
        const startedAt = Date.now();

        // 0) Fast Path Layer (Deterministic)
        // Checks for Math, History, or Explicit Memory Intent checks
        const fastResult = this.fastPath.process(query);

        if (fastResult) {
            // Case A: Immediate Response (Math / History)
            if (fastResult.response) {
                 yield {
                    type: "final_answer",
                    text: fastResult.response,
                    ms: Date.now() - startedAt
                };
                return;
            }

            // Case B: Memory Intent
            if (fastResult.action === "memory_pipeline") {
                 yield { type: "progress", text: "กำลังค้นความจำ (Fast Path)...", ms: Date.now() - startedAt };
                 const memory = await this.startMemoryLookup(query, startedAt);
                 if (memory && memory.length > 0) {
                     yield {
                        type: "final_answer",
                        text: `พบข้อมูลในความจำ ${memory.length} รายการ`,
                        ms: Date.now() - startedAt
                     };
                     yield { type: "memory", items: memory, ms: Date.now() - startedAt };
                 } else {
                     yield {
                        type: "final_answer",
                        text: "ไม่พบข้อมูลในความจำ (Memory Empty)",
                        ms: Date.now() - startedAt
                     };
                 }
                 return; // Exit after memory lookup (Do not trigger tools)
            }
        }

        // 1) Flash selection (fast path)
        const tool = this.flash.select(query);
        yield { type: "selection", tool, ms: Date.now() - startedAt };

        // 2) Start memory lookup in background (NON-BLOCKING)
        // This ensures TTFB stays fast even if embeddings/Ollama is slow.
        const memoryPromise = this.startMemoryLookup(query, startedAt);

        // 3) If tool is confident → DO NOT wait on memory (close SSE fast)
        if (tool && (tool.confidence ?? 0) >= 0.8) {
            yield {
                type: "final_answer",
                text: `Selected tool: ${tool.toolName} (confidence=${tool.confidence})`,
                ms: Date.now() - startedAt,
            };

            // Fire-and-forget: run memory lookup in background, but never extend this generator.
            // Intentionally ignore results here to keep SSE session short.
            void memoryPromise.catch(() => []);
            
            // EXECUTE TOOL
            if (tool.toolName) {
                try {
                    yield { type: "tool_start", name: tool.toolName, args: tool.args, ms: Date.now() - startedAt };
                    // We need to access the tool logic. The tool execution logic was in separate method.
                    // But we can call it here or emit.
                    // Wait, this class has `tools` registry.
                    
                    const toolImpl = this.tools[tool.toolName];
                    if (toolImpl) {
                         const result = await toolImpl.execute(tool.args);
                         yield { type: "tool_result", result, ms: Date.now() - startedAt };
                         yield { type: "final_answer", text: "Tool Executed Successfully", ms: Date.now() - startedAt }; 
                         // Check if we assume the client handles the result display?
                         // The Prompt "Final Response" in Spec implies we might need to format it.
                         // But for now, returning result is enough for MVP.
                    } else {
                        yield { type: "error", message: `Tool ${tool.toolName} implementation not found`, ms: Date.now() - startedAt };
                    }
                } catch (err: any) {
                    yield { type: "error", message: err.message, ms: Date.now() - startedAt };
                }
            }
            return;
        }

        // 4) Low confidence: immediately stream progress, but don't block
        yield { type: "progress", text: "กำลังค้นความจำ/เอกสารที่เกี่ยวข้อง…", ms: Date.now() - startedAt };

        // Wait for memory (since we have no confident tool)
        const memory = await memoryPromise;

        if (!memory || memory.length === 0) {
            yield {
                type: "final_answer",
                text: "ยังไม่พบข้อมูลความจำที่เกี่ยวข้อง (fallback).",
                ms: Date.now() - startedAt,
            };
            return;
        }

        // 5) Use memory as the main answer source (MVP)
        yield {
            type: "final_answer",
            text: `พบข้อมูลที่เกี่ยวข้อง ${memory.length} รายการ (พร้อมนำไปสรุป/ตอบต่อ)`,
            ms: Date.now() - startedAt,
        };
        yield { type: "memory", items: memory, ms: Date.now() - startedAt };
    }

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

  private async executeTool(name: string, args: any, startTime: number) {
      this.emit("event", {
          type: "tool_start",
          payload: { name, args },
          timestamp: performance.now() - startTime
      });

      const tool = this.tools[name];
      if (!tool) {
          throw new Error(`Tool ${name} not found in registry`);
      }

      // Execute
      try {
          const result = await tool.execute(args);
          this.emit("event", {
              type: "tool_result",
              payload: result,
              timestamp: performance.now() - startTime
          });
      } catch (err: any) {
           this.emit("event", {
              type: "error",
              payload: `Tool Execution Failed: ${err.message}`,
              timestamp: performance.now() - startTime
          });
      }
  }
}
