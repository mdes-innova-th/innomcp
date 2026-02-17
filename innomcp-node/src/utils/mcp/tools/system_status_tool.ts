import { exec } from "node:child_process";
import type { MCPTool } from "../types";

export type SystemStatus = {
  status: "ok" | "partial_outage";
  message: string;
  machine_count: number | string;
  containers: string[];
};

const DOCKER_TIMEOUT_MS = 3000;
const DOCKER_PS_CMD = "docker ps --format \"{{.Names}}\"";

// Matches: evidence-db, evidence_db, or evidence (as a token)
const EVIDENCE_CONTAINER_RE = /(^|[-_])evidence($|[-_])|evidence[-_]?db/i;

function runDockerPs(): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(
      DOCKER_PS_CMD,
      {
        timeout: DOCKER_TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(String(stdout ?? ""));
      }
    );
  });
}

function parseContainerNames(stdout: string): string[] {
  const names = stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const n of names) {
    if (!seen.has(n)) {
      seen.add(n);
      unique.push(n);
    }
  }
  return unique;
}

export async function checkSystemHealth(): Promise<SystemStatus> {
  console.log("[SystemStatus] Checking infrastructure...");

  try {
    const stdout = await runDockerPs();
    const all = parseContainerNames(stdout);
    const matched = all.filter((name) => EVIDENCE_CONTAINER_RE.test(name));

    const result: SystemStatus = {
      status: "ok",
      message: "Docker CLI responsive.",
      machine_count: matched.length,
      containers: matched,
    };

    console.log(
      `[SystemStatus] ok machine_count=${result.machine_count} containers=${matched.join(",") || "(none)"}`
    );
    return result;
  } catch (error: any) {
    const isTimeout =
      error?.code === "ETIMEDOUT" ||
      error?.signal === "SIGTERM" ||
      /timed out/i.test(String(error?.message ?? ""));

    const result: SystemStatus = {
      status: "partial_outage",
      message: isTimeout
        ? "Docker CLI unresponsive, but process active."
        : "Docker CLI error, but process active.",
      machine_count: isTimeout ? "Unknown (CLI Timeout)" : "Unknown (CLI Error)",
      containers: [],
    };

    console.log(
      `[SystemStatus] fallback status=${result.status} reason=${isTimeout ? "timeout" : "error"}`
    );
    return result;
  }
}

export const SYSTEM_STATUS_TOOL_NAME = "system_status_tool";

export const SYSTEM_STATUS_TOOL_DEF: MCPTool = {
  name: SYSTEM_STATUS_TOOL_NAME,
  description:
    "Check local infrastructure status (Docker containers for evidence-db) with strict timeout to avoid hanging shells. Use when diagnosing evidence DB availability or Docker responsiveness.",
  category: "infra",
  keywords: ["docker", "evidence", "evidence db", "machine status", "สถานะเครื่อง", "เช็คระบบ", "infra"],
  examples: ["เช็คสถานะ evidence db", "docker ค้างไหม", "ตอนนี้มี evidence-db ออนไลน์กี่เครื่อง"],
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
};

export async function handleSystemStatusTool(): Promise<SystemStatus> {
  return checkSystemHealth();
}
