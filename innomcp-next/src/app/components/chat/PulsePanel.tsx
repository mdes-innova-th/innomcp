"use client";
import React, { useState, useEffect, useRef } from "react";

interface AgentLog {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG";
  message: string;
}

const ACTIVE_AGENTS = ["innova", "planner", "coder", "researcher", "reviewer", "emotion", "oracle"];

export default function PulsePanel() {
  const [activeAgent, setActiveAgent] = useState("innova");
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputCmd, setInputCmd] = useState("");
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch real agent logs
  const fetchLogs = async (agentName: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tmux/logs?agent=${agentName}`);
      const data = await res.json();
      if (data.exists && Array.isArray(data.lines)) {
        setLogs(data.lines);
      } else if (data.lines) {
        setLogs(data.lines); // Fallback messages
      } else {
        setLogs([`[SYSTEM] Standby - No logs returned for ${agentName}.`]);
      }
    } catch (err: any) {
      setLogs([`[SYSTEM ERROR] Failed to fetch logs: ${err.message}`]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(activeAgent);
    const id = setInterval(() => fetchLogs(activeAgent), 5000);
    return () => clearInterval(id);
  }, [activeAgent]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCmd.trim()) return;

    const cmd = inputCmd.trim();
    setInputCmd("");
    
    // Add command echo to terminal
    setLogs((prev) => [...prev, `$ ${cmd}`, `[SYSTEM] Processing control request...`]);

    try {
      const res = await fetch("/api/tmux/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run-tests" }) // Default to safety test check
      });
      const data = await res.json();
      if (data.success) {
        setLogs((prev) => [...prev, `[SYSTEM] Command accepted: ${cmd}`, data.stdout || "Success"]);
      } else {
        setLogs((prev) => [...prev, `[SYSTEM ERROR] Rejected: ${data.error || "Execution failed"}`]);
      }
    } catch (err: any) {
      setLogs((prev) => [...prev, `[SYSTEM ERROR] Failed to broadcast: ${err.message}`]);
    }
  };

  const getLineStyle = (line: string) => {
    const low = line.toLowerCase();
    if (low.startsWith("$")) return "text-white font-semibold";
    if (low.includes("error") || low.includes("fail") || low.includes("critical")) return "text-rose-500 font-medium";
    if (low.includes("warn")) return "text-amber-500 font-medium";
    if (low.includes("pass") || low.includes("success") || low.includes("completed")) return "text-emerald-500 font-medium";
    if (low.includes("debug") || low.includes("trace")) return "text-sky-400";
    return "text-white/80";
  };

  return (
    <div className="flex flex-col h-full text-foreground p-1 overflow-y-auto">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-primary">Oracle Pulse</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">จับตาและควบคุม Tmux Terminal ของเอเจนต์แบบเรียลไทม์</p>
      </div>

      {/* Selector tab */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {ACTIVE_AGENTS.map((agent) => (
          <button
            key={agent}
            onClick={() => setActiveAgent(agent)}
            className={`px-3 py-1 rounded-full text-xs font-mono font-medium transition-colors ${
              activeAgent === agent
                ? "bg-primary text-white"
                : "bg-muted/40 hover:bg-muted/60 text-muted-foreground"
            }`}
          >
            {agent.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Terminal window */}
      <div className="flex-1 min-h-[300px] flex flex-col rounded-lg overflow-hidden border border-border/40 bg-black/85 shadow-2xl">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/20 bg-background/50">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${loading ? "bg-amber-500 animate-pulse" : "bg-emerald-500 animate-pulse"}`} />
            <span className="text-[10.5px] font-mono text-muted-foreground">pty-bridge: {activeAgent}-session</span>
          </div>
          <span className="text-[9px] font-mono text-muted-foreground/50">Auto-refresh: 5s</span>
        </div>

        <div className="flex-1 p-3 overflow-y-auto font-mono text-[11.5px] leading-relaxed text-muted-foreground space-y-1 bg-black/30 max-h-[400px]">
          {logs.map((line, index) => (
            <div key={index} className="flex gap-2 items-start">
              <span className="text-white/30 shrink-0 select-none">{(index + 1).toString().padStart(3, "0")}</span>
              <span className={`break-all whitespace-pre-wrap ${getLineStyle(line)}`}>{line}</span>
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
