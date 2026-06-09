"use client";
import React, { useState, useEffect } from "react";

interface AgentMember {
  name: string;
  role: string;
  avatar: string;
  model: string;
  color: string;
}

const AGENT_TEAM: AgentMember[] = [
  { name: "INNOVA", role: "Mother Orchestrator", avatar: "🤖", model: "gemma4:26b", color: "border-fuchsia-500 text-fuchsia-400" },
  { name: "PLANNER", role: "Strategic Planner", avatar: "🧠", model: "qwen3.5:27b", color: "border-indigo-500 text-indigo-400" },
  { name: "CODER", role: "Software Engineer", avatar: "💻", model: "qwen2.5-c:32b", color: "border-emerald-500 text-emerald-400" },
  { name: "RESEARCHER", role: "Fact Finder", avatar: "🔍", model: "llama3.1:8b", color: "border-sky-500 text-sky-400" },
  { name: "REVIEWER", role: "Code Auditor", avatar: "🧐", model: "deepseek-c:33b", color: "border-amber-500 text-amber-400" },
  { name: "EMOTION", role: "Morale Monitor", avatar: "🎭", model: "qwen3.5:9b", color: "border-rose-500 text-rose-400" },
  { name: "ORACLE", role: "Memory Keeper", avatar: "🔮", model: "phi3:medium", color: "border-teal-500 text-teal-400" }
];

export default function OfficeTeamPanel() {
  const [sessionActive, setSessionActive] = useState(false);
  const [checking, setChecking] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [workingAgent, setWorkingAgent] = useState<string | null>(null);
  const [animationTick, setAnimationTick] = useState(0);

  // Poll status of TMUX session
  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/tmux/control");
      const data = await res.json();
      setSessionActive(!!data.isRunning);
    } catch {
      setSessionActive(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const id = setInterval(checkStatus, 15000);
    return () => clearInterval(id);
  }, []);

  // Animation cycle for wobble/jumping effect
  useEffect(() => {
    if (!sessionActive) return;
    const animId = setInterval(() => {
      setAnimationTick((t) => (t + 1) % 4);
      // Randomly switch working agent to simulate activity
      if (Math.random() > 0.6) {
        const idx = Math.floor(Math.random() * AGENT_TEAM.length);
        setWorkingAgent(AGENT_TEAM[idx].name);
      }
    }, 1200);
    return () => clearInterval(animId);
  }, [sessionActive]);

  const handleControl = async (action: string) => {
    setActionLoading(action);
    try {
      const res = await fetch("/api/tmux/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (data.success) {
        if (action === "start") setSessionActive(true);
        if (action === "stop") {
          setSessionActive(false);
          setWorkingAgent(null);
        }
        alert(`ดำเนินการสำเร็จ: ${action}`);
      } else {
        alert(`เกิดข้อผิดพลาด: ${data.error || "Unknown"}`);
      }
    } catch (err: any) {
      alert(`การเชื่อมต่อล้มเหลว: ${err.message}`);
    } finally {
      setActionLoading(null);
      checkStatus();
    }
  };

  return (
    <div className="bg-background border border-border/60 rounded-xl p-4 shadow-sm space-y-4">
      {/* Title & Status */}
      <div className="flex items-center justify-between border-b border-border/20 pb-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <span>🏢</span> Office Agents Team
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">กองทัพเอเจนต์ระดับโปรเกรดรันบน TMUX Multiplexer</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
            sessionActive
              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
              : "bg-muted/40 text-muted-foreground border border-border/40"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${sessionActive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
            {sessionActive ? "SWARM ACTIVE" : "OFFLINE"}
          </span>
        </div>
      </div>

      {/* Agents grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 py-1">
        {AGENT_TEAM.map((agent) => {
          const isWorking = sessionActive && (workingAgent === agent.name || workingAgent === null);
          const animationClass = isWorking
            ? animationTick === 0 ? "translate-y-[-4px] rotate-[-2deg]" :
              animationTick === 2 ? "translate-y-[-2px] rotate-[2deg]" : ""
            : "";

          return (
            <div
              key={agent.name}
              className={`flex flex-col items-center justify-center p-3 rounded-lg border bg-muted/20 transition-all duration-300 ${
                isWorking && sessionActive
                  ? "border-primary/50 shadow-md shadow-primary/5"
                  : "border-border/30"
              }`}
            >
              {/* Animated Avatar */}
              <div
                className={`w-12 h-12 rounded-full border-2 bg-background flex items-center justify-center text-xl transition-all duration-300 ${agent.color} ${animationClass}`}
              >
                {agent.avatar}
              </div>

              {/* Info */}
              <div className="text-center mt-2.5 space-y-0.5">
                <p className="text-xs font-bold text-foreground">{agent.name}</p>
                <p className="text-[9.5px] text-muted-foreground truncate max-w-[80px]" title={agent.role}>
                  {agent.role}
                </p>
                <p className="text-[8.5px] font-mono text-muted-foreground/60 truncate max-w-[80px]">
                  {agent.model}
                </p>
              </div>

              {/* Status Dot */}
              <div className="mt-2 flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${
                  !sessionActive ? "bg-muted-foreground/40" :
                  isWorking ? "bg-emerald-500 animate-ping" : "bg-sky-500"
                }`} />
                <span className="text-[8px] text-muted-foreground/75 uppercase">
                  {!sessionActive ? "offline" : isWorking ? "working" : "idle"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls panel */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-border/20">
        <button
          onClick={() => handleControl("start")}
          disabled={sessionActive || !!actionLoading}
          className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-primary text-white hover:bg-primary/95 disabled:opacity-50 transition-all shadow-sm"
        >
          {actionLoading === "start" ? "Starting..." : "🚀 Run Swarm"}
        </button>
        <button
          onClick={() => handleControl("stop")}
          disabled={!sessionActive || !!actionLoading}
          className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 transition-all shadow-sm"
        >
          {actionLoading === "stop" ? "Stopping..." : "🛑 Kill Swarm"}
        </button>
        <button
          onClick={() => handleControl("auto-heal")}
          disabled={!!actionLoading}
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm"
        >
          {actionLoading === "auto-heal" ? "Healing..." : "🔧 Auto-Heal"}
        </button>
        <button
          onClick={() => handleControl("run-tests")}
          disabled={!!actionLoading}
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 transition-all shadow-sm"
        >
          {actionLoading === "run-tests" ? "Testing..." : "🧪 Run Tests"}
        </button>
        <button
          onClick={checkStatus}
          disabled={checking}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted/40 border border-border/40 text-muted-foreground hover:bg-muted/65 transition-all ml-auto"
        >
          {checking ? "Refreshing..." : "⟳ Refresh"}
        </button>
      </div>
    </div>
  );
}
