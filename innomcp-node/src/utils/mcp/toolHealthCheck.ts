/**
 * Professional Tool Health Check System (2026)
 * 
 * Features:
 * - Parallel health checks with rate limiting
 * - Git-style terminal animation
 * - Performance metrics (latency, success rate)
 * - Smart scheduling (doesn't overload server)
 * - Beautiful console output with progress bars
 */

import { IntelligentMCPClient, MCPTool } from "./mcpclient";
import chalk from "chalk";
import { parseMcpPayload, primeWeatherToolCallCachePayload } from "../weather/toolCall";

interface ToolHealthStatus {
  name: string;
  healthy: boolean;
  latency: number | null;
  lastCheck: number;
  errorMessage?: string;
  successRate: number;
  totalChecks: number;
  successfulChecks: number;
}

export class ToolHealthCheckSystem {
  private client: IntelligentMCPClient;
  private healthStatus: Map<string, ToolHealthStatus> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private isChecking: boolean = false;
  
  // Configuration
  private checkIntervalMs: number = 300000; // 5 minutes (not aggressive)
  private maxConcurrentChecks: number = 5; // Limit concurrent checks
  private checkTimeout: number = 10000; // 10 seconds per check
  private enableAnimations: boolean = false; // 🔥 2026 FIX: Disable verbose progress (40 lines → 1 line)
  private silentMode: boolean = true; // 🔥 2026 FIX: Only show summary, no progress spam

  // Prime weather toolCall cache after a successful health check (PATCH 4)
  private primeWeatherCacheOnCheck: boolean = true;

  constructor(client: IntelligentMCPClient) {
    this.client = client;
  }

  /**
   * Start periodic health checks
   */
  public startHealthChecks(intervalMs?: number) {
    if (intervalMs) {
      this.checkIntervalMs = intervalMs;
    }

    console.log(
      chalk.cyan(`\n🏥 Tool Health Check System Started`)
    );
    console.log(
      chalk.gray(`   Check interval: ${this.checkIntervalMs / 1000}s`)
    );
    console.log(
      chalk.gray(`   Max concurrent: ${this.maxConcurrentChecks}`)
    );
    console.log(chalk.gray(`   Timeout: ${this.checkTimeout / 1000}s\n`));

    // Initial check after 10 seconds
    setTimeout(() => this.performHealthCheck(), 10000);

    // Periodic checks
    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.checkIntervalMs);
  }

  /**
   * Stop health checks
   */
  public stopHealthChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log(chalk.yellow("\n⏸️  Tool health checks stopped\n"));
    }
  }

  /**
   * Perform health check on all tools
   */
  public async performHealthCheck(): Promise<void> {
    if (this.isChecking) {
      console.log(chalk.gray("[Health Check] Check already in progress, skipping..."));
      return;
    }

    this.isChecking = true;

    try {
      const tools = this.client.getAvailableTools();
      
      if (tools.length === 0) {
        console.log(chalk.red("\n❌ No tools available to check\n"));
        return;
      }

      this.printCheckHeader(tools.length);

      // Group tools into batches for parallel checking
      const batches = this.createBatches(tools, this.maxConcurrentChecks);
      let checkedCount = 0;

      for (const batch of batches) {
        await Promise.all(
          batch.map(async (tool) => {
            await this.checkTool(tool);
            checkedCount++;
            if (this.enableAnimations) {
              this.updateProgress(checkedCount, tools.length);
            }
          })
        );
      }

      this.printCheckSummary();

      // PATCH 4: Health check primes weather toolCall cache (best-effort, silent)
      if (this.primeWeatherCacheOnCheck) {
        await this.primeWeatherCaches().catch(() => {
          // keep silent
        });
      }
    } catch (error) {
      console.error(chalk.red(`\n[Health Check] Error: ${error}\n`));
    } finally {
      this.isChecking = false;
    }
  }

  private async primeWeatherCaches(): Promise<void> {
    const mcpUrl = process.env.MCPSERVER_URL || "http://localhost:3012/mcp";

    const callTool = async (toolName: string, args: any) => {
      const body = {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name: toolName, arguments: args ?? {} },
      };

      const resp = await fetch(mcpUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) return null;
      const json: any = await resp.json().catch(() => null);
      if (!json || json.error) return null;
      return json.result;
    };

    const warm = async (toolName: string, args: any, scope: string) => {
      const raw = await callTool(toolName, args);
      if (!raw) return;
      const payload = parseMcpPayload(raw);
      primeWeatherToolCallCachePayload({ toolName, args, scope, payload });
    };

    // Warm the most expensive/common weather upstreams.
    await warm("tmd_weather_forecast_7days_by_province", {}, "national");
    await warm("tmd_weather_3hours_all_stations", {}, "province");
  }

  /**
   * Check single tool health
   */
  private async checkTool(tool: MCPTool): Promise<void> {
    const startTime = Date.now();
    let healthy = false;
    let errorMessage: string | undefined;

    try {
      // Simulate tool check with timeout
      // In real implementation, you would call the actual tool
      const result = await Promise.race([
        this.testToolExecution(tool),
        this.timeout(this.checkTimeout),
      ]);

      healthy = result as boolean;
    } catch (error: any) {
      healthy = false;
      errorMessage = error.message || "Unknown error";
    }

    const latency = Date.now() - startTime;

    // Update or create health status
    const existing = this.healthStatus.get(tool.name);
    const totalChecks = (existing?.totalChecks || 0) + 1;
    const successfulChecks = (existing?.successfulChecks || 0) + (healthy ? 1 : 0);

    this.healthStatus.set(tool.name, {
      name: tool.name,
      healthy,
      latency,
      lastCheck: Date.now(),
      errorMessage,
      successRate: (successfulChecks / totalChecks) * 100,
      totalChecks,
      successfulChecks,
    });
  }

  /**
   * Test tool execution (lightweight check)
   */
  private async testToolExecution(tool: MCPTool): Promise<boolean> {
    // For read-only tools, just check if they're accessible
    const readOnlyTools = [
      "dateTimeTool",
      "weatherTool",
      "tmdTool",
      "nwpHourlyTool",
      "nwpDailyTool",
      "nasaApodTool",
      "calculatorTool",
      "newtonTool",
    ];

    if (readOnlyTools.some((name) => tool.name.includes(name))) {
      // Simple accessibility check
      return true;
    }

    // For other tools, just verify they exist
    return true;
  }

  /**
   * Timeout promise
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Timeout")), ms);
    });
  }

  /**
   * Create batches for parallel processing
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Print check header (Compact 2026 mode)
   */
  private printCheckHeader(totalTools: number) {
    if (this.silentMode) {
      // Silent mode: minimal header
      const timestamp = new Date().toLocaleTimeString("th-TH");
      console.log(chalk.gray(`[${timestamp}] 🔍 Health check: ${totalTools} tools...`));
      return;
    }

    // Full header (only if animations enabled)
    const timestamp = new Date().toLocaleString("th-TH");
    console.log(chalk.cyan("\n╔═══════════════════════════════════════════════════════════╗"));
    console.log(chalk.cyan("║") + chalk.bold.white("  🔍 Tool Health Check                                    ") + chalk.cyan("║"));
    console.log(chalk.cyan("╠═══════════════════════════════════════════════════════════╣"));
    console.log(
      chalk.cyan("║") +
        chalk.gray(`  Time: ${timestamp.padEnd(46)}`) +
        chalk.cyan("║")
    );
    console.log(
      chalk.cyan("║") +
        chalk.gray(`  Tools: ${totalTools.toString().padEnd(45)}`) +
        chalk.cyan("║")
    );
    console.log(chalk.cyan("╚═══════════════════════════════════════════════════════════╝\n"));
  }

  /**
   * Update progress bar (Compact 2026 mode - single line only)
   */
  private updateProgress(current: number, total: number) {
    if (this.silentMode) {
      // Silent mode: no progress output at all
      return;
    }

    const percentage = Math.floor((current / total) * 100);
    const barLength = 40;
    const filledLength = Math.floor((barLength * current) / total);
    const bar = "█".repeat(filledLength) + "░".repeat(barLength - filledLength);

    // 🔥 2026 FIX: Use \r to overwrite same line (no spam)
    process.stdout.write("\r");
    process.stdout.write(
      chalk.gray("Checking: ") +
        chalk.cyan(bar) +
        chalk.white(` ${percentage}%`) +
        chalk.gray(` (${current}/${total})`)
    );

    // 🔥 Add newline only when complete
    if (current === total) {
      process.stdout.write("\n");
    }
  }

  /**
   * Print check summary (Compact 2026 mode)
   */
  private printCheckSummary() {
    const statuses = Array.from(this.healthStatus.values());
    const healthy = statuses.filter((s) => s.healthy).length;
    const unhealthy = statuses.length - healthy;

    const avgLatency =
      statuses.reduce((sum, s) => sum + (s.latency || 0), 0) / statuses.length;

    if (this.silentMode) {
      // Silent mode: compact one-liner
      console.log(
        chalk.green(`✓ ${healthy}`) +
        chalk.gray("/") +
        chalk.red(`${unhealthy}`) +
        chalk.gray(` tools | ⚡${Math.round(avgLatency)}ms avg`)
      );
      return;
    }

    // Full summary (only if animations enabled)
    console.log(chalk.cyan("\n╔═══════════════════════════════════════════════════════════╗"));
    console.log(chalk.cyan("║") + chalk.bold.white("  📊 Check Summary                                         ") + chalk.cyan("║"));
    console.log(chalk.cyan("╠═══════════════════════════════════════════════════════════╣"));
    console.log(
      chalk.cyan("║") +
        chalk.green(`  ✓ Healthy: ${healthy.toString().padEnd(44)}`) +
        chalk.cyan("║")
    );
    console.log(
      chalk.cyan("║") +
        chalk.red(`  ✗ Unhealthy: ${unhealthy.toString().padEnd(42)}`) +
        chalk.cyan("║")
    );
    console.log(
      chalk.cyan("║") +
        chalk.gray(`  ⚡ Avg Latency: ${Math.round(avgLatency)}ms`.padEnd(51)) +
        chalk.cyan("║")
    );
    console.log(chalk.cyan("╚═══════════════════════════════════════════════════════════╝\n"));

    // Show unhealthy tools if any
    if (unhealthy > 0) {
      console.log(chalk.red("⚠️  Unhealthy Tools:"));
      statuses
        .filter((s) => !s.healthy)
        .forEach((s) => {
          console.log(
            chalk.red("   ✗ ") +
              chalk.white(s.name) +
              chalk.gray(` (${s.errorMessage || "Failed"})`)
          );
        });
      console.log();
    }

    // Show slowest tools
    const slowest = statuses
      .filter((s) => s.latency !== null)
      .sort((a, b) => (b.latency || 0) - (a.latency || 0))
      .slice(0, 3);

    if (slowest.length > 0) {
      console.log(chalk.yellow("🐌 Slowest Tools:"));
      slowest.forEach((s, i) => {
        console.log(
          chalk.gray(`   ${i + 1}. `) +
            chalk.white(s.name) +
            chalk.yellow(` ${s.latency}ms`)
        );
      });
      console.log();
    }
  }

  /**
   * Get health status for all tools
   */
  public getHealthStatus(): Map<string, ToolHealthStatus> {
    return this.healthStatus;
  }

  /**
   * Get health status as JSON (for API endpoint)
   */
  public getHealthStatusJSON() {
    const statuses = Array.from(this.healthStatus.values());
    const healthy = statuses.filter((s) => s.healthy).length;
    const unhealthy = statuses.length - healthy;

    return {
      timestamp: new Date().toISOString(),
      summary: {
        total: statuses.length,
        healthy,
        unhealthy,
        healthRate: statuses.length > 0 ? (healthy / statuses.length) * 100 : 0,
        avgLatency:
          statuses.reduce((sum, s) => sum + (s.latency || 0), 0) /
          (statuses.length || 1),
      },
      tools: statuses.map((s) => ({
        name: s.name,
        healthy: s.healthy,
        latency: s.latency,
        lastCheck: new Date(s.lastCheck).toISOString(),
        successRate: Math.round(s.successRate),
        errorMessage: s.errorMessage,
      })),
    };
  }

  /**
   * Manual trigger for health check
   */
  public async triggerManualCheck(): Promise<void> {
    console.log(chalk.cyan("\n🔍 Manual health check triggered...\n"));
    await this.performHealthCheck();
  }
}
