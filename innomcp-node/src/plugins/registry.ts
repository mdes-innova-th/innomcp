/**
 * plugins/registry.ts — In-memory Plugin Registry
 *
 * Phase 4 foundation. Holds built-in plugins pre-registered at startup.
 * DB persistence is deferred to a future phase.
 */

export interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  type: "tool" | "ui" | "provider" | "webhook";
  config: Record<string, unknown>;
  installedAt: string;
}

// In-memory registry (Phase 4 foundation — DB persistence in future)
const plugins = new Map<string, Plugin>();

// Built-in plugins pre-registered at startup
const BUILT_IN: Plugin[] = [
  {
    id: "shell-exec",
    name: "Shell Executor",
    description: "Run shell commands safely",
    version: "1.0.0",
    enabled: true,
    type: "tool",
    config: {},
    installedAt: new Date().toISOString(),
  },
  {
    id: "web-fetch",
    name: "Web Fetcher",
    description: "Fetch and parse web pages",
    version: "1.0.0",
    enabled: true,
    type: "tool",
    config: {},
    installedAt: new Date().toISOString(),
  },
  {
    id: "data-analyzer",
    name: "Data Analyzer",
    description: "Analyze CSV/JSON data",
    version: "1.0.0",
    enabled: true,
    type: "tool",
    config: {},
    installedAt: new Date().toISOString(),
  },
  {
    id: "mdes-provider",
    name: "MDES Ollama",
    description: "MDES remote LLM provider",
    version: "2.0.0",
    enabled: true,
    type: "provider",
    config: {},
    installedAt: new Date().toISOString(),
  },
];

/**
 * Register built-in plugins if they are not already in the map.
 * Called once at application startup.
 */
export function ensureBuiltIns(): void {
  for (const plugin of BUILT_IN) {
    if (!plugins.has(plugin.id)) {
      plugins.set(plugin.id, { ...plugin });
    }
  }
}

/** Return all registered plugins as an array. */
export function listPlugins(): Plugin[] {
  return Array.from(plugins.values());
}

/** Retrieve a single plugin by id, or undefined if not found. */
export function getPlugin(id: string): Plugin | undefined {
  return plugins.get(id);
}

/**
 * Toggle a plugin's enabled state.
 * Returns the updated Plugin, or null if the id is not found.
 */
export function togglePlugin(id: string, enabled: boolean): Plugin | null {
  const plugin = plugins.get(id);
  if (!plugin) return null;
  plugin.enabled = enabled;
  plugins.set(id, plugin);
  return plugin;
}
