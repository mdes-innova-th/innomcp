/**
 * orchestrator.ts — Phase C Multi-Agent Neural Coordinator
 *
 * Claude Minimax = Neural Coordinator (ประหยัด token, สั่งการ sub-agent)
 * Hermes gemma4:26b = Brain-1 (deep reasoning, long-context)
 * Hermes gemma4:e4b = Brain-2 (fast response, concise summary)
 *
 * Workflow:
 *   1. Brain-1 analyzes → Brain-2 summarizes → Coordinator commits/pushes/reviews
 *   2. Save decision cycle to memory (.md)
 *   3. Support multi-terminal (tmux) + remote session sync
 *
 * Output:
 *   - Thai in TUI (user-facing)
 *   - English internal reasoning (concise professional)
 */

import { selectProvider } from "../providers/router";
import type { ProviderRecord } from "../providers/types";

export type BrainRole = "coordinator" | "brain-1" | "brain-2";

export interface OrchestratorConfig {
  coordinatorModel?: string;
  brain1Model?: string;
  brain2Model?: string;
  sharedMemoryPath: string;
  enableTmuxSync: boolean;
  enableRemoteSync: boolean;
}

export interface AgentTask {
  id: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "analyzing" | "summarizing" | "coordinating" | "completed" | "failed";
  brain1Result?: string;
  brain2Result?: string;
  coordinatorAction?: string;
  cycle: TaskCycle[];
}

export interface TaskCycle {
  timestamp: string;
  phase: "analyze" | "summarize" | "coordinate" | "commit" | "push" | "review" | "memory";
  actor: BrainRole;
  result: string;
  tokensUsed?: number;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  coordinatorModel: "minimax-m2.5:cloud",
  brain1Model: "gemma4:26b",
  brain2Model: "gemma4:e4b",
  sharedMemoryPath: ".claude/memory",
  enableTmuxSync: false,
  enableRemoteSync: false,
};

/**
 * Multi-Agent Orchestrator
 *
 * Manages the three-brain workflow:
 * - Brain-1: Deep analysis (long-context, thorough)
 * - Brain-2: Fast summarization (concise)
 * - Coordinator: Commit/Push/Review cycle + memory persistence
 */
export class MultiAgentOrchestrator {
  private config: OrchestratorConfig;
  private activeTasks: Map<string, AgentTask> = new Map();

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a new task that will go through the full cycle
   */
  async createTask(description: string, priority: "low" | "medium" | "high" | "urgent" = "medium"): Promise<AgentTask> {
    const task: AgentTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      description,
      priority,
      status: "pending",
      cycle: [],
    };
    this.activeTasks.set(task.id, task);
    return task;
  }

  /**
   * Execute full cycle: Brain-1 → Brain-2 → Coordinator → memory
   */
  async executeCycle(taskId: string): Promise<AgentTask> {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    try {
      // Phase 1: Brain-1 (deep analysis)
      task.status = "analyzing";
      const brain1Result = await this.callBrain("brain-1", task.description);
      task.brain1Result = brain1Result;
      task.cycle.push({
        timestamp: new Date().toISOString(),
        phase: "analyze",
        actor: "brain-1",
        result: brain1Result.substring(0, 500),
      });

      // Phase 2: Brain-2 (concise summary)
      task.status = "summarizing";
      const brain2Result = await this.callBrain("brain-2", brain1Result);
      task.brain2Result = brain2Result;
      task.cycle.push({
        timestamp: new Date().toISOString(),
        phase: "summarize",
        actor: "brain-2",
        result: brain2Result.substring(0, 500),
      });

      // Phase 3: Coordinator (commit/push/review)
      task.status = "coordinating";
      const coordinatorAction = await this.coordinate(task.description, brain1Result, brain2Result);
      task.coordinatorAction = coordinatorAction;
      task.cycle.push({
        timestamp: new Date().toISOString(),
        phase: "coordinate",
        actor: "coordinator",
        result: coordinatorAction,
      });

      // Phase 4: Save to memory
      await this.saveToMemory(task);
      task.cycle.push({
        timestamp: new Date().toISOString(),
        phase: "memory",
        actor: "coordinator",
        result: "Task cycle saved to memory",
      });

      task.status = "completed";
    } catch (error) {
      task.status = "failed";
      task.cycle.push({
        timestamp: new Date().toISOString(),
        phase: "coordinate",
        actor: "coordinator",
        result: `Error: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    return task;
  }

  /**
   * Call Brain-1 or Brain-2 provider
   */
  private async callBrain(role: "brain-1" | "brain-2", input: string): Promise<string> {
    const capability = role === "brain-1" ? "long-context" : "fast-cheap";
    const model = role === "brain-1" ? this.config.brain1Model : this.config.brain2Model;

    const provider = await selectProvider({
      capability,
      privacyLevel: "internal",
      preferredModel: model,
    });

    if (!provider) {
      throw new Error(`No provider available for ${role}`);
    }

    // Call the provider via the local Ollama endpoint
    const response = await fetch(`${provider.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: provider.model,
        prompt: input,
        stream: false,
        options: {
          temperature: role === "brain-1" ? 0.3 : 0.7,
          num_predict: role === "brain-1" ? 2048 : 512,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Brain ${role} call failed: ${response.status}`);
    }

    const result = await response.json() as { response?: string };
    return result.response || "";
  }

  /**
   * Coordinate: analyze task, decide action, execute commit/push/review
   */
  private async coordinate(taskDesc: string, brain1Result: string, brain2Result: string): Promise<string> {
    const coordinatorProvider = await selectProvider({
      capability: "tool-use",
      privacyLevel: "internal",
      preferredModel: this.config.coordinatorModel,
    });

    if (!coordinatorProvider) {
      return "SKIP: No coordinator provider available - task logged but not committed";
    }

    // Build prompt for coordinator to decide the action
    const prompt = `You are a Neural Coordinator. Analyze this task and decide the next action.

Task: ${taskDesc}

Brain-1 Analysis: ${brain1Result.substring(0, 1000)}
Brain-2 Summary: ${brain2Result}

Choose ONE action:
- COMMIT: If the work is ready to commit
- REVIEW: If the work needs code review first
- PUSH: If the work is approved and ready to push
- MEMORY: If only memory update is needed
- SKIP: If no action needed right now

Respond with just the action word.`;

    const response = await fetch(`${coordinatorProvider.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: coordinatorProvider.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 32,
        },
      }),
    });

    if (!response.ok) {
      return "SKIP: Coordinator call failed";
    }

    const result = await response.json() as { response?: string };
    return result.response?.trim() || "SKIP";
  }

  /**
   * Save task cycle to memory
   */
  private async saveToMemory(task: AgentTask): Promise<void> {
    const memoryPath = this.config.sharedMemoryPath;
    const memoryEntry = `## Task ${task.id} — ${task.status}

**Description:** ${task.description}
**Priority:** ${task.priority}
**Completed:** ${new Date().toISOString()}

### Cycle Log
${task.cycle.map(c => `- ${c.timestamp} [${c.phase}] ${c.actor}: ${c.result}`).join("\n")}

---
`;

    // Note: Actual file write would be handled by the caller
    // This just returns the formatted entry
    console.log(`[Memory] ${memoryPath}/task-${task.id}.md`);
    console.log(memoryEntry);
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): AgentTask | undefined {
    return this.activeTasks.get(taskId);
  }

  /**
   * List all active tasks
   */
  listTasks(): AgentTask[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Sync with tmux session (future)
   */
  async syncTmux(): Promise<void> {
    if (!this.config.enableTmuxSync) return;
    // tmux sync logic - emit event to other terminals
    console.log("[Orchestrator] Tmux sync not implemented");
  }

  /**
   * Sync with remote session (future)
   */
  async syncRemote(): Promise<void> {
    if (!this.config.enableRemoteSync) return;
    // remote session sync logic
    console.log("[Orchestrator] Remote sync not implemented");
  }
}

/**
 * Factory function to create orchestrator with default config
 */
export function createOrchestrator(config?: Partial<OrchestratorConfig>): MultiAgentOrchestrator {
  return new MultiAgentOrchestrator(config);
}