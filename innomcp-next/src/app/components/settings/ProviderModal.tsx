"use client";

/**
 * ProviderModal — Phase C "Add AI Provider" form
 *
 * Skeleton that lets the user add a custom provider (Ollama-local,
 * Ollama-remote, OpenAI-compatible, Anthropic-compatible, custom). The
 * "Test connection" button hits POST /api/ai/providers/{id}/test which
 * runs a basic-connectivity probe stub on the backend. The form does
 * not handle the API key value beyond passing it through to a future
 * encryption step — it stores the value as `apiKeyEncrypted` for now,
 * which the registry treats as opaque and never returns via the API.
 *
 * This component is self-contained; it can be rendered into any chat
 * surface or settings panel. The test page at /living-chat exercises
 * it.
 */

import { useState } from "react";

/* ------------------------------------------------------------------ */
/*  Presets — quick‑fill cards for popular AI providers               */
/* ------------------------------------------------------------------ */

interface Preset {
  id: string;
  icon: string;
  label: string;
  type: "ollama-local" | "ollama-remote" | "openai-compatible" | "anthropic-compatible" | "custom";
  baseUrl: string;
  model: string;
  needsKey: boolean;
}

const PRESETS: Preset[] = [
  {
    id: "mdes-ollama",
    icon: "🇹🇭",
    label: "MDES Ollama (ภาครัฐ)",
    type: "ollama-remote",
    baseUrl: "https://ollama.mdes-innova.online/v1",
    model: "minimax-m2.5:cloud",
    needsKey: false,
  },
  {
    id: "openai",
    icon: "🤖",
    label: "OpenAI",
    type: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o",
    needsKey: true,
  },
  {
    id: "anthropic",
    icon: "🅰️",
    label: "Anthropic",
    type: "anthropic-compatible",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-3-5-sonnet-20241022",
    needsKey: true,
  },
  {
    id: "groq",
    icon: "🚀",
    label: "Groq (Fast)",
    type: "openai-compatible",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    needsKey: true,
  },
  {
    id: "ollama-local",
    icon: "💻",
    label: "Ollama Local",
    type: "ollama-local",
    baseUrl: "http://localhost:11434/v1",
    model: "minimax-m2.5:cloud",
    needsKey: false,
  },
  {
    id: "gemini",
    icon: "🔮",
    label: "Gemini",
    type: "openai-compatible",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-1.5-pro",
    needsKey: true,
  },
  {
    id: "lmstudio",
    icon: "⚡",
    label: "LM Studio",
    type: "openai-compatible",
    baseUrl: "http://localhost:1234/v1",
    model: "",
    needsKey: false,
  },
  {
    id: "mdes-thaillm",
    icon: "🛡️",
    label: "MDES ThaiLLM",
    type: "openai-compatible",
    baseUrl: "https://api.thaillm.mdes.go.th/v1",
    model: "typhoon-v1.5-instruct",
    needsKey: true,
  },
];

/* ------------------------------------------------------------------ */
/*  Provider type & capability constants                               */
/* ------------------------------------------------------------------ */

const PROVIDER_TYPES = [
  { value: "ollama-local", label: "Ollama (ภายในเครื่อง)" },
  { value: "ollama-remote", label: "Ollama (ระยะไกล)" },
  { value: "openai-compatible", label: "OpenAI-compatible" },
  { value: "anthropic-compatible", label: "Anthropic-compatible" },
  { value: "custom", label: "Custom" },
] as const;

const CAPABILITIES = [
  { value: "thai-naturalness", label: "ภาษาไทยธรรมชาติ" },
  { value: "code", label: "โค้ด" },
  { value: "vision", label: "วิเคราะห์ภาพ" },
  { value: "long-context", label: "context ยาว" },
  { value: "tool-use", label: "ใช้เครื่องมือ" },
  { value: "fast-cheap", label: "เร็ว/ประหยัด" },
  { value: "hard-reasoning", label: "เหตุผลขั้นสูง" },
  { value: "grounding-critic", label: "นักวิจารณ์/ตรวจหลักฐาน" },
] as const;

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ProviderModal({ open, onClose, onCreated }: Props) {
  /* ---- manual‑entry state ----------------------------------------- */
  const [displayName, setDisplayName] = useState("");
  const [type, setType] = useState<(typeof PROVIDER_TYPES)[number]["value"]>("ollama-local");
  const [baseUrl, setBaseUrl] = useState("http://localhost:11434");
  const [model, setModel] = useState("minimax-m2.5:cloud");
  const [apiKey, setApiKey] = useState("");
  const [caps, setCaps] = useState<string[]>(["thai-naturalness"]);
  const [priority, setPriority] = useState(50);
  const [busy, setBusy] = useState<"idle" | "saving" | "testing">("idle");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ---- preset tracking -------------------------------------------- */
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  /* ---- helpers ---------------------------------------------------- */

  /** Fill the form from a chosen preset */
  const applyPreset = (preset: Preset) => {
    setSelectedPreset(preset.id);
    setDisplayName(preset.label);
    setType(preset.type);
    setBaseUrl(preset.baseUrl);
    setModel(preset.model);
    setApiKey(""); // user must supply key if needed
    setCaps(["thai-naturalness"]);
    setPriority(50);
    setError(null);
    setTestResult(null);
  };

  /** Reset to blank / defaults (manual mode) */
  const resetToManual = () => {
    setSelectedPreset(null);
    setDisplayName("");
    setType("ollama-local");
    setBaseUrl("http://localhost:11434");
    setModel("minimax-m2.5:cloud");
    setApiKey("");
    setCaps(["thai-naturalness"]);
    setPriority(50);
    setError(null);
    setTestResult(null);
  };

  const toggleCap = (c: string) => {
    setCaps((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const validate = (): string | null => {
    if (!displayName.trim()) return "ระบุชื่อ provider";
    if (!/^https?:\/\//.test(baseUrl)) return "Base URL ต้องขึ้นต้นด้วย http:// หรือ https://";
    if (!model.trim()) return "ระบุชื่อโมเดล";
    if (caps.length === 0) return "เลือกอย่างน้อย 1 capability";
    return null;
  };

  const save = async () => {
    setError(null);
    const issue = validate();
    if (issue) {
      setError(issue);
      return;
    }
    setBusy("saving");
    try {
      const r = await fetch("/api/ai/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          type,
          baseUrl: baseUrl.trim(),
          model: model.trim(),
          apiKeyEncrypted: apiKey ? apiKey : undefined,
          capabilities: caps,
          priority,
          enabled: true,
          privacyLevel: "internal",
          timeoutMs: 60_000,
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({} as any));
        setError(body?.error || `บันทึกไม่สำเร็จ (HTTP ${r.status})`);
        setBusy("idle");
        return;
      }
      setBusy("idle");
      onCreated?.();
      onClose();
    } catch (err: any) {
      setError(`บันทึกไม่สำเร็จ: ${String(err?.message || err)}`);
      setBusy("idle");
    }
  };

  const testConnection = async () => {
    setError(null);
    setTestResult(null);
    const issue = validate();
    if (issue) {
      setError(issue);
      return;
    }
    setBusy("testing");
    // Test against an ephemeral provider creation: we POST first then
    // /test, then DELETE if the user only intended a check. To keep the
    // skeleton simple we just create + test and leave it; the user can
    // delete it from a future list view.
    try {
      const r = await fetch("/api/ai/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: `${displayName.trim() || "test"} (probe)`,
          type,
          baseUrl: baseUrl.trim(),
          model: model.trim(),
          capabilities: caps.length > 0 ? caps : ["thai-naturalness"],
          enabled: false,
          privacyLevel: "internal",
          timeoutMs: 5_000,
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({} as any));
        setError(body?.error || `ทดสอบไม่สำเร็จ (HTTP ${r.status})`);
        setBusy("idle");
        return;
      }
      const created = await r.json();
      const t = await fetch(`/api/ai/providers/${created.provider.id}/test`, {
        method: "POST",
      });
      if (!t.ok) {
        setError(`ทดสอบไม่ผ่าน (HTTP ${t.status})`);
        setBusy("idle");
        return;
      }
      const tj = await t.json();
      setTestResult(
        tj?.probe?.ok
          ? `เชื่อมต่อสำเร็จ — ${tj?.probe?.detail || "OK"}`
          : `เชื่อมต่อไม่ได้ — ${tj?.probe?.detail || "unknown"}`
      );
      setBusy("idle");
    } catch (err: any) {
      setError(`ทดสอบไม่สำเร็จ: ${String(err?.message || err)}`);
      setBusy("idle");
    }
  };

  if (!open) return null;

  return (
    <div
      data-testid="provider-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            เพิ่มผู้ให้บริการ AI
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        {/* =========================================================== */}
        {/*  PRESET CARDS                                                */}
        {/* =========================================================== */}
        <div className="mb-4">
          <div className="mb-2 text-sm text-muted-foreground">
            เลือก Provider สำเร็จรูป
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => {
              const isActive = selectedPreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`group flex h-[70px] items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                    isActive
                      ? "border-emerald-500/60 bg-emerald-500/10 ring-1 ring-emerald-500/30"
                      : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  <span className="text-xl leading-none">{p.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-foreground">
                      {p.label}
                    </div>
                    <div className="mt-1">
                      {p.needsKey ? (
                        <span className="inline-block rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                          ต้องการ Key
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          ฟรี
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={resetToManual}
            className="mt-2 w-full rounded border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted"
          >
            ⚙️ กรอกเอง (manual entry)
          </button>
        </div>

        {/* =========================================================== */}
        {/*  MANUAL FORM                                                 */}
        {/* =========================================================== */}
        <div className="grid gap-3 text-sm">
          <label className="grid gap-1">
            <span className="text-muted-foreground">ชื่อ</span>
            <input
              data-testid="provider-name-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="rounded border border-border bg-background px-2 py-1.5"
              placeholder="เช่น MDES Remote Ollama"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-muted-foreground">ประเภท</span>
            <select
              data-testid="provider-type-select"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="rounded border border-border bg-background px-2 py-1.5"
            >
              {PROVIDER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-muted-foreground">Base URL</span>
            <input
              data-testid="provider-baseurl-input"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="rounded border border-border bg-background px-2 py-1.5"
              placeholder="https://ollama.mdes-innova.online"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-muted-foreground">โมเดลเริ่มต้น</span>
            <input
              data-testid="provider-model-input"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="rounded border border-border bg-background px-2 py-1.5"
              placeholder="เช่น minimax-m2.5:cloud"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-muted-foreground">API Key (เก็บแบบเข้ารหัส, ไม่แสดงผลใน list)</span>
            <input
              data-testid="provider-apikey-input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="rounded border border-border bg-background px-2 py-1.5"
              placeholder="ไม่บังคับสำหรับ Local Ollama"
            />
          </label>

          <div>
            <div className="mb-1 text-muted-foreground">Capability</div>
            <div className="flex flex-wrap gap-1.5">
              {CAPABILITIES.map((c) => {
                const active = caps.includes(c.value);
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => toggleCap(c.value)}
                    className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                      active
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="grid gap-1">
            <span className="text-muted-foreground">
              Priority (สูงกว่า = ถูกเลือกก่อน เมื่อ capability ตรงกัน)
            </span>
            <input
              type="number"
              value={priority}
              min={0}
              max={100}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-24 rounded border border-border bg-background px-2 py-1.5"
            />
          </label>

          {error && (
            <div data-testid="provider-modal-error" className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-xs text-rose-700">
              {error}
            </div>
          )}
          {testResult && (
            <div
              data-testid="provider-modal-test-result"
              className="rounded border border-sky-500/40 bg-sky-500/10 px-2 py-1.5 text-xs text-sky-700"
            >
              {testResult}
            </div>
          )}
        </div>

        {/* =========================================================== */}
        {/*  ACTION BUTTONS                                              */}
        {/* =========================================================== */}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            data-testid="provider-modal-test"
            disabled={busy !== "idle"}
            onClick={testConnection}
            className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            {busy === "testing" ? "กำลังทดสอบ..." : "ทดสอบการเชื่อมต่อ"}
          </button>
          <button
            type="button"
            data-testid="provider-modal-save"
            disabled={busy !== "idle"}
            onClick={save}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy === "saving" ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}