/**
 * MCPClient Type Definitions
 * Interfaces and types for the MCP client system
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  category: string;
  keywords: string[];
  examples: string[];
}

export interface MCPResource {
  name: string;
  title?: string;
  description?: string;
  uriTemplate?: string;
  inputSchema?: any;
}

export interface MCPClientConfig {
  name: string;
  version: string;
  transport?: {
    command: string;
    args: string[];
  };
  serverUrl?: string;
}

export interface ToolSelectionCache {
  query: string;
  tools: string[];
  timestamp: number;
}

export interface ConversationContext {
  query: string;
  tools: string[];
  timestamp: number;
}

export interface ToolPattern {
  keywords: string[];
  toolPattern: RegExp;
  priority: "high" | "medium" | "low";
  category?: string;
}

/**
 * Tool Chaining Interfaces
 */

export interface ToolChainStep {
  toolName: string;
  args?: any;
  dependsOn?: number[]; // index ของ steps ก่อนหน้าที่ต้องรอ
  description: string;
  condition?: string; // เงื่อนไขในการ execute (optional)
}

export interface ToolChainPlan {
  steps: ToolChainStep[];
  reasoning: string;
  isChainable: boolean;
}

export interface ChainExecutionResult {
  step: number;
  toolName: string;
  description: string;
  result?: any;
  error?: string;
  success: boolean;
  executionTime?: number;
}

export interface MessageClassification {
  type: "greeting" | "general_question" | "action_request" | "unknown";
  canAnswerDirectly: boolean;
  confidence: number;
}
