"use client";
import React, { useState, useEffect, useRef } from "react";

interface AgentLog {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG";
  message: string;
}

export default function PulsePanel() {
  const [activeAgent, setActiveAgent] = useState("bigboss");
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [inputCmd, setInputCmd] = useState("");
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  const mockLogs: Record<string, AgentLog[]> = {
    bigboss: [
      { timestamp: "23:54:10", level: "INFO", message: "Conductor / Orchestrator initialized." },
      { timestamp: "23:54:12", level: "INFO", message: "Spawning subagents: debugger, reviewer, builder." },
      { timestamp: "23:54:15", level: "INFO", message: "Broadcasting event: 'TaskStarted' containing project scope" },
      { timestamp: "23:54:20", level: "INFO", message: "Awaiting reports from builder..." }
    ],
    debugger: [
      { timestamp: "23:54:11", level: "INFO", message: "Debugger attached to workspace C:/Users/USER-NT/DEV/innomcp" },
      { timestamp: "23:54:13", level: "DEBUG", message: "Reading project config file .agents/agents.yaml" },
      { timestamp: "23:54:14", level: "INFO", message: "Validating registry: 4 active branches mapped." },
      { timestamp: "23:54:18", level: "WARN", message: "Branch 'agents/debugger' is 2 commits behind parent branch 'dev'." }
    ],
    builder: [
      { timestamp: "23:54:11", level: "INFO", message: "Builder worktree initialized at agents/builder" },
      { timestamp: "23:54:13", level: "INFO", message: "Building packages/opencode with single bundle targeting..." },
      { timestamp: "23:54:19", level: "INFO", message: "Compilation completed in 4.2s. Output: dist/opencode-windows-x64" },
      { timestamp: "23:54:21", level: "INFO", message: "Running bun run typecheck - 0 errors found." }
    ],
    reviewer: [
      { timestamp: "23:54:11", level: "INFO", message: "Reviewer workspace ready." },
      { timestamp: "23:54:14", level: "INFO", message: "Auditing layout changes in ChatSidebar.tsx" },
      { timestamp: "23:54:16", level: "INFO", message: "Security check passed: 0 vulnerabilities found in dependencies." }
    ]
  };

  useEffect(() => {
    setLogs(mockLogs[activeAgent] || []);
  }, [activeAgent]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCmd.trim()) return;
    const now = new Date().toLocaleTimeString("en-US", { hour12: false });
    const userLog: AgentLog = { timestamp: now, level: "INFO", message: `$ ${inputCmd}` };
    const responseLog: AgentLog = {
      timestamp: now,
      level: "DEBUG",
      message: `Executing tool command: ${inputCmd}... (OK)`
    };
    setLogs((prev) => [...prev, userLog, responseLog]);
    setInputCmd("");
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "ERROR": return "text-rose-500 font-semibold";
      case "WARN": return "text-amber-500 font-semibold";
      case "DEBUG": return "text-sky-400";
      default: return "text-emerald-500";
    }
  };

  return (
    <div className="flex flex-col h-full text-foreground p-1 overflow-y-auto">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-primary">Oracle Pulse</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">จับตาและควบคุม Tmux Terminal ของเอเจนต์แบบเรียลไทม์</p>
      </div>

      {/* Selector tab */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {Object.keys(mockLogs).map((agent) => (
          <button
            key={agent}
            onClick={() => setActiveAgent(agent)}
            className={`px-3 py-1 rounded-full text-xs font-mono font-medium transition-colors ${
              activeAgent === agent
                ? "bg-primary text-white"
                : "bg-muted/40 hover:bg-muted/60 text-muted-foreground"
            }`}
          >
            {agent}
          </button>
        ))}
      </div>

      {/* Terminal window */}
      <div className="flex-1 min-h-[300px] flex flex-col rounded-lg overflow-hidden border border-border/40 bg-black/85 shadow-2xl">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/20 bg-background/50">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10.5px] font-mono text-muted-foreground">pty-bridge: {activeAgent}-session</span>
        </div>

        <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] leading-relaxed text-muted-foreground space-y-1 bg-black/30">
          {logs.map((log, index) => (
            <div key={index} className="flex gap-2 items-start">
              <span className="text-white/30 shrink-0">{log.timestamp}</span>
              <span className={`shrink-0 ${getLevelColor(log.level)}`}>[{log.level}]</span>
              <span className="text-white/85 break-all whitespace-pre-wrap">{log.message}</span>
            </div>
          ))}
          <div ref={terminalEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleCommand} className="flex items-center gap-2 px-3 py-2 border-t border-border/20 bg-background/30">
          <span className="font-mono text-xs text-primary">{">"}</span>
          <input
            type="text"
            value={inputCmd}
            onChange={(e) => setInputCmd(e.target.value)}
            placeholder={`สั่งการไปยัง ${activeAgent}...`}
            className="flex-1 bg-transparent border-none outline-none text-xs font-mono text-white placeholder:text-white/20"
          />
          <button
            type="submit"
            className="px-2.5 py-1 rounded text-[10px] font-mono font-bold bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20"
          >
            SEND
          </button>
        </form>
      </div>
    </div>
  );
}
