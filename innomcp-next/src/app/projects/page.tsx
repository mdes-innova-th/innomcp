"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/app/context/AuthContext";

const BACKEND =
  typeof window !== "undefined" && window.location.port === "3000"
    ? "http://localhost:3011"
    : "";

interface Project {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  created_at: string;
}

const PRESET_COLORS = [
  { value: "#3b82f6", label: "Blue" },
  { value: "#10b981", label: "Emerald" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Red" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#06b6d4", label: "Cyan" },
];

const PRESET_ICONS = ["📁", "📊", "🔬", "💡", "🎯"];

export default function ProjectsPage() {
  const router = useRouter();
  const { isLoggedIn, isAuthLoading } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New project form state
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formColor, setFormColor] = useState("#3b82f6");
  const [formIcon, setFormIcon] = useState("📁");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Projects — INNOMCP";
  }, []);

  useEffect(() => {
    if (!isAuthLoading && !isLoggedIn) {
      router.replace("/login");
    }
  }, [isAuthLoading, isLoggedIn, router]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchProjects();
    }
  }, [isLoggedIn]);

  async function fetchProjects() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${BACKEND}/api/projects`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProjects(data.projects ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "โหลดโปรเจกต์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;
    try {
      setSubmitting(true);
      setFormError(null);
      const res = await fetch(`${BACKEND}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formName.trim(),
          description: formDesc.trim() || undefined,
          color: formColor,
          icon: formIcon,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      // Reset form and refresh
      setFormName("");
      setFormDesc("");
      setFormColor("#3b82f6");
      setFormIcon("📁");
      setShowForm(false);
      await fetchProjects();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "สร้างโปรเจกต์ไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-[12px]">
        <span className="animate-pulse">กำลังโหลด...</span>
      </div>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground text-[13px] flex items-center gap-1 transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-[13px] px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {showForm ? "ยกเลิก" : "+ New Project"}
        </button>
      </div>

      {/* Inline Create Form */}
      {showForm && (
        <div className="mb-8 rounded-xl border border-border/40 bg-muted/10 p-5">
          <h2 className="text-[14px] font-medium mb-4">สร้างโปรเจกต์ใหม่</h2>
          <form onSubmit={handleCreateProject} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-[12px] text-muted-foreground mb-1">
                ชื่อโปรเจกต์ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="เช่น Research 2026"
                required
                className="w-full text-[13px] px-3 py-2 rounded-lg border border-border/40 bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[12px] text-muted-foreground mb-1">
                คำอธิบาย (ไม่บังคับ)
              </label>
              <input
                type="text"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="โปรเจกต์นี้เกี่ยวกับ..."
                className="w-full text-[13px] px-3 py-2 rounded-lg border border-border/40 bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            {/* Icon picker */}
            <div>
              <label className="block text-[12px] text-muted-foreground mb-2">
                ไอคอน
              </label>
              <div className="flex gap-2">
                {PRESET_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setFormIcon(icon)}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg border text-lg transition-colors ${
                      formIcon === icon
                        ? "border-primary bg-primary/10"
                        : "border-border/40 hover:border-border"
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div>
              <label className="block text-[12px] text-muted-foreground mb-2">
                สี
              </label>
              <div className="flex gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setFormColor(c.value)}
                    title={c.label}
                    className={`w-7 h-7 rounded-full transition-transform ${
                      formColor === c.value
                        ? "ring-2 ring-offset-2 ring-foreground scale-110"
                        : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>

            {formError && (
              <p className="text-[12px] text-red-500">{formError}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={submitting || !formName.trim()}
                className="text-[13px] px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "กำลังสร้าง..." : "สร้างโปรเจกต์"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-[13px] px-4 py-2 rounded-lg border border-border/40 hover:bg-muted/20 transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground text-[12px]">
          <span className="animate-pulse">กำลังโหลดโปรเจกต์...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <p className="text-[13px] text-red-500">{error}</p>
          <button
            onClick={fetchProjects}
            className="text-[12px] px-3 py-1.5 rounded-lg border border-border/40 hover:bg-muted/20 transition-colors"
          >
            ลองใหม่
          </button>
        </div>
      ) : projects.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center h-56 gap-4 text-center">
          <span className="text-5xl">📁</span>
          <div>
            <p className="text-[14px] font-medium">ยังไม่มีโปรเจกต์</p>
            <p className="text-[12px] text-muted-foreground mt-1">
              สร้างโปรเจกต์แรกเพื่อเริ่มต้นจัดการงานของคุณ
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="text-[13px] px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            สร้างโปรเจกต์แรก
          </button>
        </div>
      ) : (
        /* Project grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard?project_id=${project.id}`}
              className="rounded-xl border border-border/40 bg-background/60 hover:bg-muted/20 transition-colors p-4 cursor-pointer block"
            >
              {/* Color accent bar */}
              <div
                className="w-full h-1 rounded-full mb-3 opacity-70"
                style={{ backgroundColor: project.color ?? "#3b82f6" }}
              />
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none mt-0.5">
                  {project.icon ?? "📁"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium truncate">
                    {project.name}
                  </p>
                  {project.description && (
                    <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground/60 mt-2">
                    {formatDate(project.created_at)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
