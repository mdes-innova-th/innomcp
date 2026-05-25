"use client";

/**
 * ModelSettingsPanel — configure and test a custom model endpoint.
 *
 * Supports 6 provider presets: MDES Ollama, Ollama Local, LM Studio,
 * vLLM, OpenAI-compatible, Custom HTTP.
 *
 * Settings are persisted to localStorage under the `innomcp.model.*` keys
 * so they survive page reloads without hitting a DB.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";

const BACKEND =
  typeof window !== "undefined" && window.location.port === "3000"
    ? "http://localhost:3011"
    : "";

interface ProviderPreset {
  id: string;
  label: string;
  defaultUrl: string;
  needsKey: boolean;
  defaultModel: string;
}

interface TestResult {
  success: boolean;
  latencyMs: number;
  error?: string;
  sample?: string;
}

type HealthStatus = "healthy" | "degraded" | "down" | "unknown";

interface ProviderHealthResult {
  id: string;
  displayName: string;
  healthStatus: HealthStatus;
  latencyMs: number;
}

interface Props {
  onClose?: () => void;
}

export default function ModelSettingsPanel({ onClose }: Props) {
  const [presets, setPresets] = useState<ProviderPreset[]>([]);
  const [selectedId, setSelectedId] = useState("mdes");
  const [baseUrl, setBaseUrl] = useState("https://ollama.mdes-innova.online/v1");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("gemma3:12b");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [testingCall, setTestingCall] = useState(false);
  const [callResult, setCallResult] = useState<{ response: string; durationMs: number } | null>(null);
  const [callError, setCallError] = useState(false);
  const [healthResults, setHealthResults] = useState<ProviderHealthResult[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const healthIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const r = await fetch(`${BACKEND}/api/providers/health-check`, {
        method: "POST",
        credentials: "include",
      });
      if (r.ok) {
        const data = (await r.json()) as { results: ProviderHealthResult[] };
        setHealthResults(data.results ?? []);
      }
    } catch {
      // silently ignore — health UI degrades gracefully
    } finally {
      setHealthLoading(false);
    }
  }, []);

  // Fetch health on mount and refresh every 60 s
  useEffect(() => {
    fetchHealth();
    healthIntervalRef.current = setInterval(fetchHealth, 60_000);
    return () => {
      if (healthIntervalRef.current !== null) {
        clearInterval(healthIntervalRef.current);
      }
    };
  }, [fetchHealth]);

  // Load presets from backend
  useEffect(() => {
    fetch(`${BACKEND}/api/model-settings/providers`)
      .then((r) => r.json())
      .then((d: { providers?: ProviderPreset[] }) =>
        setPresets(d.providers ?? [])
      )
      .catch(() => {});
  }, []);

  // Restore from localStorage on mount
  useEffect(() => {
    const storedProvider = localStorage.getItem("innomcp.model.provider");
    const storedUrl = localStorage.getItem("innomcp.model.baseUrl");
    const storedKey = localStorage.getItem("innomcp.model.apiKey");
    const storedModel = localStorage.getItem("innomcp.model.name");
    if (storedProvider) setSelectedId(storedProvider);
    if (storedUrl) setBaseUrl(storedUrl);
    if (storedKey) setApiKey(storedKey);
    if (storedModel) setModelName(storedModel);
  }, []);

  const handleProviderSelect = (id: string) => {
    setSelectedId(id);
    const preset = presets.find((p) => p.id === id);
    if (preset) {
      setBaseUrl(preset.defaultUrl);
      setModelName(preset.defaultModel);
      if (!preset.needsKey) setApiKey("");
    }
    setResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const r = await fetch(`${BACKEND}/api/model-settings/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          baseUrl,
          apiKey: apiKey || undefined,
          modelName,
          provider: selectedId,
        }),
      });
      const data = (await r.json()) as TestResult;
      setResult(data);
    } catch {
      setResult({ success: false, latencyMs: 0, error: "Cannot reach backend" });
    }
    setTesting(false);
  };

  const handleTestCall = async () => {
    setTestingCall(true);
    setCallResult(null);
    setCallError(false);
    try {
      const r = await fetch(`${BACKEND}/api/providers/test-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          providerId: selectedId || "seed-mdes-ollama",
          message: "สวัสดี ทดสอบการเชื่อมต่อ",
        }),
      });
      if (!r.ok) throw new Error("Non-OK response");
      const data = (await r.json()) as { response: string; durationMs: number };
      setCallResult(data);
    } catch {
      setCallError(true);
    }
    setTestingCall(false);
  };

  const handleSave = () => {
    localStorage.setItem("innomcp.model.provider", selectedId);
    localStorage.setItem("innomcp.model.baseUrl", baseUrl);
    localStorage.setItem("innomcp.model.apiKey", apiKey);
    localStorage.setItem("innomcp.model.name", modelName);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
    onClose?.();
  };

  return (
    <div className="flex flex-col gap-4 p-1" data-testid="model-settings-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-foreground">Model Settings</p>
        {onClose && (
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/60 hover:text-foreground"
            aria-label="Close model settings"
          >
            ✕
          </button>
        )}
      </div>

      {/* Provider Health */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-medium text-muted-foreground">
            Provider Health
          </label>
          <button
            onClick={fetchHealth}
            disabled={healthLoading}
            data-testid="provider-health-refresh-btn"
            className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground/60 transition-colors hover:text-foreground disabled:opacity-50"
            aria-label="Refresh provider health"
          >
            {healthLoading ? "Checking..." : "Refresh"}
          </button>
        </div>
        {healthResults.length === 0 ? (
          <p className="text-[10.5px] text-muted-foreground/40">
            {healthLoading ? "Checking providers…" : "No health data yet"}
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5" data-testid="provider-health-list">
            {healthResults.map((item) => {
              const dotChar =
                item.healthStatus === "unknown" ? "○" : "●";
              const dotColor =
                item.healthStatus === "healthy"
                  ? "text-emerald-500"
                  : item.healthStatus === "degraded"
                  ? "text-amber-500"
                  : item.healthStatus === "down"
                  ? "text-rose-500"
                  : "text-muted-foreground";
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-1.5 text-[11px] text-foreground/80"
                >
                  <span className={`${dotColor} text-[10px] leading-none`} aria-hidden="true">
                    {dotChar}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.displayName}</span>
                  {item.latencyMs > 0 && (
                    <span className="shrink-0 text-[10px] text-muted-foreground/60">
                      {item.latencyMs}ms
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Provider pills */}
      {presets.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-muted-foreground">Provider</label>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p.id}
                onClick={() => handleProviderSelect(p.id)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] transition-colors ${
                  selectedId === p.id
                    ? "border-primary/50 bg-primary/8 font-medium text-foreground"
                    : "border-border/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Base URL */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-muted-foreground">Base URL</label>
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="http://localhost:11434/v1"
          data-testid="model-settings-baseurl"
          className="rounded-lg border border-border/50 bg-background px-3 py-1.5 text-[12px] text-foreground placeholder-muted-foreground/40 focus:border-primary/40 focus:outline-none"
        />
      </div>

      {/* API Key */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-muted-foreground">
          API Key{" "}
          <span className="text-muted-foreground/50">(optional)</span>
        </label>
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          type="password"
          placeholder="sk-..."
          data-testid="model-settings-apikey"
          className="rounded-lg border border-border/50 bg-background px-3 py-1.5 font-mono text-[12px] text-foreground placeholder-muted-foreground/40 focus:border-primary/40 focus:outline-none"
        />
      </div>

      {/* Model name */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-muted-foreground">Model Name</label>
        <input
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          placeholder="gemma3:12b"
          data-testid="model-settings-modelname"
          className="rounded-lg border border-border/50 bg-background px-3 py-1.5 font-mono text-[12px] text-foreground placeholder-muted-foreground/40 focus:border-primary/40 focus:outline-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleTest}
          disabled={testing || !baseUrl || !modelName}
          data-testid="model-settings-test-btn"
          className="flex-1 rounded-lg border border-border/60 py-1.5 text-[12px] text-foreground transition-colors hover:bg-muted/30 disabled:opacity-50"
        >
          {testing ? "Testing..." : "Test Connection"}
        </button>
        <button
          onClick={handleTestCall}
          disabled={testingCall}
          data-testid="model-settings-test-call-btn"
          className="flex-1 rounded-lg border border-border/60 py-1.5 text-[12px] text-foreground transition-colors hover:bg-muted/30 disabled:opacity-50"
        >
          {testingCall ? "กำลังทดสอบ..." : "🤖 Test AI Call"}
        </button>
        <button
          onClick={handleSave}
          data-testid="model-settings-save-btn"
          className="flex-1 rounded-lg bg-primary py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90"
        >
          {saved ? "Saved!" : "Save"}
        </button>
      </div>

      {/* Test result */}
      {result && (
        <div
          data-testid="model-settings-test-result"
          className={`rounded-lg border p-2.5 text-[11.5px] ${
            result.success
              ? "border-emerald-500/20 bg-emerald-500/8 text-emerald-700 dark:text-emerald-400"
              : "border-rose-500/20 bg-rose-500/8 text-rose-700 dark:text-rose-400"
          }`}
        >
          {result.success ? (
            <div className="flex flex-col gap-0.5">
              <p className="font-medium">Connected — {result.latencyMs}ms</p>
              {result.sample && (
                <p className="text-[10.5px] opacity-70">Response: &ldquo;{result.sample}&rdquo;</p>
              )}
            </div>
          ) : (
            <p>
              {result.error ?? "Connection failed"} ({result.latencyMs}ms)
            </p>
          )}
        </div>
      )}

      {/* Test AI Call result */}
      {(callResult || callError) && (
        <div
          data-testid="model-settings-call-result"
          className={`rounded-lg border px-3 py-2 text-[11.5px] mt-2 ${
            callResult
              ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-400"
              : "border-rose-500/20 bg-rose-500/8 text-rose-700 dark:text-rose-400"
          }`}
        >
          {callResult
            ? `✅ ${callResult.durationMs}ms — "${callResult.response.slice(0, 100)}"`
            : "❌ ไม่สามารถเชื่อมต่อได้"}
        </div>
      )}

      {/* Footer hint */}
      <p className="text-[10.5px] text-muted-foreground/50">
        Settings saved to localStorage. Reload to apply to chat.
      </p>
    </div>
  );
}
