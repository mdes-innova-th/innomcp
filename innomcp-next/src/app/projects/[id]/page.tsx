"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useProtectedRoute } from "@/app/hooks/useProtectedRoute";

const BACKEND =
  typeof window !== "undefined" && window.location.port === "3000"
    ? "http://localhost:3011"
    : "";

interface ProjectDetail {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  created_at: string;
}

interface ProjectMemory {
  id: number;
  key_name: string;
  value: string;
  updated_at: string;
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const { isLoggedIn, isAuthLoading } = useProtectedRoute();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [memories, setMemories] = useState<ProjectMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteValue, setNoteValue] = useState("");

  const projectId = String(params?.id ?? "");

  const loadProjectWorkspace = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    setError(null);
    try {
      const [projectResponse, memoryResponse] = await Promise.all([
        fetch(`${BACKEND}/api/projects/${projectId}`, { credentials: "include" }),
        fetch(
          `${BACKEND}/api/memories?scope=project&projectId=${encodeURIComponent(projectId)}`,
          { credentials: "include" }
        ),
      ]);

      if (!projectResponse.ok) {
        throw new Error(projectResponse.status === 404 ? "Project not found" : `HTTP ${projectResponse.status}`);
      }
      if (!memoryResponse.ok) {
        throw new Error(memoryResponse.status === 403 ? "Project memory access denied" : `HTTP ${memoryResponse.status}`);
      }

      const projectData = await projectResponse.json();
      const memoryData = await memoryResponse.json();
      setProject(projectData.project ?? null);
      setMemories(Array.isArray(memoryData.memories) ? memoryData.memories : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลด project workspace ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    document.title = "Project Workspace — INNOMCP";
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      void loadProjectWorkspace();
    }
  }, [isLoggedIn, loadProjectWorkspace]);

  const handleSaveMemory = async () => {
    const keyName = noteTitle.trim();
    const value = noteValue.trim();
    if (!projectId || !keyName || !value) return;

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${BACKEND}/api/memories`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "project",
          keyName,
          value,
          projectId,
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      setNoteTitle("");
      setNoteValue("");
      await loadProjectWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึก project memory ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-[12px] text-muted-foreground">
        <span className="animate-pulse">กำลังโหลด...</span>
      </div>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/projects"
            className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to Projects
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-[13px] text-muted-foreground">Project Workspace</span>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard?projectId=${encodeURIComponent(projectId)}`}
            className="rounded-lg border border-border/40 px-3 py-2 text-[12px] hover:bg-muted/20"
          >
            Dashboard
          </Link>
          <Link
            href={`/?projectId=${encodeURIComponent(projectId)}`}
            className="rounded-lg bg-primary px-3 py-2 text-[12px] text-primary-foreground hover:bg-primary/90"
          >
            Open Chat
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border/40 bg-background/70 p-8 text-center text-[12px] text-muted-foreground">
          <span className="animate-pulse">กำลังโหลด project workspace...</span>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/[0.06] p-5 text-[13px] text-rose-600 dark:text-rose-400">
          {error}
        </div>
      ) : project ? (
        <>
          <section className="rounded-2xl border border-border/40 bg-background/70 p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
                  style={{ backgroundColor: `${project.color ?? "#3b82f6"}20` }}
                >
                  {project.icon ?? "📁"}
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-foreground">{project.name}</h1>
                  <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">
                    {project.description?.trim() || "Project นี้พร้อมใช้เป็น shared context สำหรับ multi-agent chat, memory และงานที่ตามต่อกัน"}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-border/40 px-4 py-3 text-right text-[12px] text-muted-foreground">
                <div>{memories.length} memories</div>
                <div className="mt-1">
                  Created {new Date(project.created_at).toLocaleDateString("th-TH")}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/40 bg-muted/10 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Workspace
                </div>
                <div className="mt-2 text-[14px] font-medium text-foreground">
                  Project-scoped collaboration
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  ใช้ project นี้เป็น anchor สำหรับ brief, artifacts และ handoff ระหว่าง agent team
                </p>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/10 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Context Memory
                </div>
                <div className="mt-2 text-[14px] font-medium text-foreground">
                  Shared notes for the next run
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  เก็บเป้าหมาย, constraints, และ facts ที่ทีมลูกควรรู้ก่อนเริ่มงาน
                </p>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/10 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Next Step
                </div>
                <div className="mt-2 text-[14px] font-medium text-foreground">
                  Project-task binding
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  พร้อมสำหรับเฟสถัดไปที่ผูก tasks และ dashboard เข้ากับ project โดยตรง
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
            <div className="rounded-2xl border border-border/40 bg-background/70 p-5">
              <div className="mb-4">
                <h2 className="text-[15px] font-semibold text-foreground">Project Memory</h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  บันทึกบริบทสำคัญสำหรับงานยาวและการ handoff ข้ามรอบ
                </p>
              </div>

              <div className="mb-5 flex flex-col gap-2 rounded-xl border border-border/40 bg-muted/10 p-3">
                <input
                  value={noteTitle}
                  onChange={(event) => setNoteTitle(event.target.value)}
                  placeholder="หัวข้อ เช่น phase7-goal, deployment-note"
                  className="rounded-lg border border-border/40 bg-background px-3 py-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
                <textarea
                  value={noteValue}
                  onChange={(event) => setNoteValue(event.target.value)}
                  placeholder="รายละเอียด context ที่ agent ทีมถัดไปควรรู้"
                  rows={4}
                  className="resize-none rounded-lg border border-border/40 bg-background px-3 py-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveMemory}
                    disabled={saving || !noteTitle.trim() || !noteValue.trim()}
                    className="rounded-lg bg-primary px-4 py-2 text-[12px] text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "กำลังบันทึก..." : "Save Memory"}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {memories.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/50 p-6 text-center text-[12px] text-muted-foreground">
                    ยังไม่มี project memory — เติม brief แรกให้ทีมลูกใช้ต่อได้จากหน้านี้
                  </div>
                ) : (
                  memories.map((memory) => (
                    <div
                      key={memory.id}
                      className="rounded-xl border border-border/40 bg-background/60 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[13px] font-medium text-foreground">
                          {memory.key_name}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(memory.updated_at).toLocaleString("th-TH")}
                        </div>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-[12px] text-muted-foreground">
                        {memory.value}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border/40 bg-background/70 p-5">
              <h2 className="text-[15px] font-semibold text-foreground">Operator Notes</h2>
              <div className="mt-4 flex flex-col gap-3 text-[12px] text-muted-foreground">
                <div className="rounded-xl border border-border/40 bg-muted/10 p-4">
                  หน้า project นี้เชื่อม backend projects และ project memories จริงแล้ว ไม่ใช่ localStorage-only เหมือนเดิม
                </div>
                <div className="rounded-xl border border-border/40 bg-muted/10 p-4">
                  ownership ของ project memory จะถูกเช็กผ่าน project owner ก่อนอ่าน/เขียน ลดโอกาส cross-user leakage ใน phase นี้
                </div>
                <div className="rounded-xl border border-border/40 bg-muted/10 p-4">
                  เฟสถัดไปที่ควรตามทันทีคือผูก task creation/list/dashboard ให้มี `project_id` เพื่อให้ workspace นี้กลายเป็น chat multi-agent base จริงเต็มตัว
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
