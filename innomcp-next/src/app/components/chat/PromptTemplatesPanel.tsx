"use client";

import React, { useState, useEffect, useCallback } from "react";

const BACKEND =
  typeof window !== "undefined" && window.location.port === "3000"
    ? "http://localhost:3011"
    : "";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;
  category: "research" | "code" | "data" | "write" | "custom";
  icon: string;
  usageCount: number;
  createdAt?: string;
}

interface Props {
  onUseTemplate?: (prompt: string) => void;
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "all",      label: "All" },
  { id: "research", label: "🔍 Research" },
  { id: "code",     label: "💻 Code" },
  { id: "data",     label: "📊 Data" },
  { id: "write",    label: "📝 Write" },
  { id: "custom",   label: "⚙️ Custom" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

const ICON_OPTIONS = ["✨", "🔍", "💻", "📊", "📝", "⚙️"];

// ─── Component ────────────────────────────────────────────────────────────────

const PromptTemplatesPanel: React.FC<Props> = ({ onUseTemplate }) => {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<CategoryId>("all");
  const [showNewForm, setShowNewForm] = useState(false);

  // New template form state
  const [newName, setNewName]         = useState("");
  const [newPrompt, setNewPrompt]     = useState("");
  const [newCategory, setNewCategory] = useState<PromptTemplate["category"]>("custom");
  const [newIcon, setNewIcon]         = useState("✨");
  const [creating, setCreating]       = useState(false);

  // ── Fetch templates ──────────────────────────────────────────────────────
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/api/templates`);
      const data: PromptTemplate[] = res.ok ? await res.json() : [];
      setTemplates(data);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  // ── Filtered + sorted list ───────────────────────────────────────────────
  const filtered = templates
    .filter((t) => activeCategory === "all" || t.category === activeCategory)
    .sort((a, b) =>
      b.usageCount !== a.usageCount
        ? b.usageCount - a.usageCount
        : new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
    );

  // ── Use template ─────────────────────────────────────────────────────────
  const handleUse = (template: PromptTemplate) => {
    onUseTemplate?.(template.prompt);

    // Fire-and-forget PATCH to increment usage count
    fetch(`${BACKEND}/api/templates/${template.id}/use`, {
      method: "PATCH",
    }).catch(() => {});

    // Optimistically bump count in local state
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === template.id ? { ...t, usageCount: t.usageCount + 1 } : t
      )
    );
  };

  // ── Create template ──────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newName.trim() || !newPrompt.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${BACKEND}/api/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          prompt: newPrompt.trim(),
          category: newCategory,
          icon: newIcon,
        }),
      });
      if (res.ok) {
        setNewName("");
        setNewPrompt("");
        setNewCategory("custom");
        setNewIcon("✨");
        setShowNewForm(false);
        await fetchTemplates();
      }
    } catch {
      // silently ignore — panel stays open
    } finally {
      setCreating(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id as CategoryId)}
            className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
              activeCategory === cat.id
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Template list */}
      {loading ? (
        <div className="py-8 text-center text-[12px] text-muted-foreground animate-pulse">
          กำลังโหลด templates...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 py-8 text-center">
          <div className="text-2xl leading-none mb-2">📭</div>
          <div className="text-[12.5px] font-medium text-foreground">
            ยังไม่มี template ในหมวดนี้
          </div>
          <div className="mt-1 text-[11.5px] text-muted-foreground">
            กด "+ New Template" เพื่อสร้างใหม่
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((template) => (
            <li
              key={template.id}
              className="flex items-start gap-3 rounded-xl border border-border/40 p-3 hover:bg-muted/20 transition-colors"
            >
              {/* Icon */}
              <span className="shrink-0 text-2xl leading-none mt-0.5">
                {template.icon}
              </span>

              {/* Body */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-semibold text-foreground">
                    {template.name}
                  </span>
                  {template.usageCount > 0 && (
                    <span className="shrink-0 inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      ×{template.usageCount}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground leading-snug">
                  {template.prompt.length > 60
                    ? template.prompt.slice(0, 60) + "…"
                    : template.prompt}
                </p>
              </div>

              {/* Use button */}
              <button
                onClick={() => handleUse(template)}
                className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors whitespace-nowrap"
              >
                ▶ Use
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* New Template toggle / form */}
      {showNewForm ? (
        <div className="rounded-xl border border-border/50 bg-muted/10 p-3 flex flex-col gap-2">
          <div className="text-[12px] font-semibold text-foreground mb-1">
            + New Template
          </div>

          {/* Icon picker */}
          <div className="flex gap-1.5">
            {ICON_OPTIONS.map((ico) => (
              <button
                key={ico}
                onClick={() => setNewIcon(ico)}
                className={`h-7 w-7 rounded-md text-base leading-none transition-colors ${
                  newIcon === ico
                    ? "bg-primary/15 ring-1 ring-primary/40"
                    : "hover:bg-muted/60"
                }`}
              >
                {ico}
              </button>
            ))}
          </div>

          {/* Name */}
          <input
            type="text"
            placeholder="Template name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full rounded-md border border-border/40 bg-background px-2.5 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />

          {/* Category */}
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as PromptTemplate["category"])}
            className="w-full rounded-md border border-border/40 bg-background px-2.5 py-1.5 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            <option value="research">🔍 Research</option>
            <option value="code">💻 Code</option>
            <option value="data">📊 Data</option>
            <option value="write">📝 Write</option>
            <option value="custom">⚙️ Custom</option>
          </select>

          {/* Prompt textarea */}
          <textarea
            placeholder="Prompt content..."
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-border/40 bg-background px-2.5 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
          />

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowNewForm(false)}
              className="rounded-md px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim() || !newPrompt.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {creating ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowNewForm(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/60 py-2.5 text-[12px] font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
        >
          <span>+</span>
          <span>New Template</span>
        </button>
      )}
    </div>
  );
};

export default PromptTemplatesPanel;
