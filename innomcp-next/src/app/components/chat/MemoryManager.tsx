"use client";
import React, { useState, useEffect } from "react";

interface Memory {
  id: number;
  scope: string;
  key_name: string;
  value: string;
  updated_at: string;
}

const BACKEND =
  typeof window !== "undefined" && window.location.port === "3000"
    ? "http://localhost:3011"
    : "";

export default function MemoryManager({
  sessionId,
  onClose,
}: {
  sessionId?: string;
  onClose?: () => void;
}) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    const params = sessionId ? `?scope=session&sessionId=${sessionId}` : "";
    fetch(`${BACKEND}/api/memories${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setMemories(d.memories ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const handleSave = async () => {
    if (!newKey.trim() || !newValue.trim()) return;
    setSaving(true);
    await fetch(`${BACKEND}/api/memories`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: "session",
        keyName: newKey.trim(),
        value: newValue.trim(),
        sessionId,
      }),
    }).catch(() => {});
    setNewKey("");
    setNewValue("");
    setSaving(false);
    load();
  };

  const handleDelete = async (id: number) => {
    await fetch(`${BACKEND}/api/memories/${id}`, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => {});
    setMemories((m) => m.filter((x) => x.id !== id));
  };

  const filteredMemories = memories.filter(
    (m) =>
      m.key_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-3 p-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <p className="text-[12px] font-semibold text-foreground">
            🧠 Project Memory
          </p>
          <span className="bg-primary/10 text-primary rounded-full px-1.5 text-[10px]">
            💬 0
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground/60 hover:text-foreground"
            aria-label="Close memory panel"
          >
            ✕
          </button>
        )}
      </div>

      {/* Add new memory */}
      <div className="flex flex-col gap-1.5 rounded-lg border border-border/40 p-2.5">
        <p className="text-[10.5px] font-medium text-muted-foreground">
          เพิ่มความจำใหม่
        </p>
        <input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="ชื่อ (เช่น: model, project-goal)"
          className="rounded border border-border/40 bg-background px-2 py-1 text-[11.5px] text-foreground placeholder-muted-foreground/40 focus:outline-none"
        />
        <textarea
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="ค่า / บันทึก..."
          rows={2}
          className="rounded border border-border/40 bg-background px-2 py-1 text-[11.5px] text-foreground placeholder-muted-foreground/40 focus:outline-none resize-none"
        />
        <button
          onClick={handleSave}
          disabled={saving || !newKey.trim() || !newValue.trim()}
          className="rounded bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50 hover:bg-primary/90"
        >
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ค้นหาความจำ..."
          className="text-[12px] border border-border/40 rounded-lg px-3 py-1.5 bg-background text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder-muted-foreground/40"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>
      <p className="text-[10.5px] text-muted-foreground -mt-1">
        {filteredMemories.length} / {memories.length} memories
      </p>

      {/* Memory list */}
      {filteredMemories.length === 0 ? (
        <p className="text-center text-[11px] text-muted-foreground py-4">
          {searchTerm ? "ไม่พบผลลัพธ์" : "ยังไม่มีความจำ"}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filteredMemories.map((m) => (
            <div
              key={m.id}
              className="flex items-start gap-2 rounded-lg border border-border/30 bg-background/60 p-2"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-foreground truncate">
                  {m.key_name}
                </p>
                <p className="text-[10.5px] text-muted-foreground line-clamp-2 mt-0.5">
                  {m.value}
                </p>
                <p className="text-[9.5px] text-muted-foreground/40 mt-0.5">
                  {new Date(m.updated_at).toLocaleString("th-TH", {
                    timeZone: "Asia/Bangkok",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <button
                onClick={() => handleDelete(m.id)}
                className="text-muted-foreground/40 hover:text-rose-500 text-[11px] shrink-0"
                aria-label={`Delete memory: ${m.key_name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
