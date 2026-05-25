"use client";

import React, { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGear,
  faPalette,
  faQuestion,
  faSignOutAlt,
  faBriefcase,
  faUser,
  faHome,
  faKey,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "@/app/context/AuthContext";
import { useTheme } from "@/app/context/ThemeContext";
import { useRouter } from "next/navigation";
import AgentLeaderboard from "./AgentLeaderboard";
import ModelSettingsPanel from "./ModelSettingsPanel";
import MemoryManager from "./MemoryManager";
import DashboardView from "./DashboardView";
import TaskDetailPanel from "./TaskDetailPanel";
import WorkspaceFileBrowser from "@/app/components/tools/WorkspaceFileBrowser";

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface ChatMessage {
  sender: "user" | "ai";
  text: string;
  fullText?: string;
  isAnimating?: boolean;
}

export interface ChatSummary {
  id: string;
  title: string;
  time: number;
  messages: ChatMessage[];
}

type Props = {
  summaries: ChatSummary[];
  activeId: string | null;
  isCollapsed: boolean;
  onToggle: () => void;
  onLoad: (s: ChatSummary) => void;
  onNewChat: () => void;
  onRename?: (id: string, newTitle: string) => void; // TODO #45
  onDelete?: (id: string) => void; // Phase 10.21 — delete chat
  theme: string;
};

// ─── Static Data ─────────────────────────────────────────────────────────────

const MDES_AGENTS = [
  { id: "conductor", name: "Conductor", role: "Orchestrator", emoji: "🎼" },
  { id: "analyst",   name: "Analyst",   role: "Data Analysis", emoji: "📊" },
  { id: "writer",    name: "Writer",    role: "Content Generation", emoji: "✍️" },
  { id: "coder",     name: "Coder",     role: "Code Assistant", emoji: "💻" },
  { id: "searcher",  name: "Searcher",  role: "Web Search", emoji: "🔍" },
  { id: "reviewer",  name: "Reviewer",  role: "Quality Review", emoji: "🔎" },
  { id: "planner",   name: "Planner",   role: "Task Planning", emoji: "📋" },
  { id: "advisor",   name: "Advisor",   role: "Decision Support", emoji: "🧠" },
  { id: "reporter",  name: "Reporter",  role: "Report Generation", emoji: "📝" },
];

const MCP_PLUGINS = [
  { id: "thai-geo",       name: "Thai Geo",       icon: "🗺️" },
  { id: "system-status",  name: "System Status",  icon: "📡" },
  { id: "knowledge",      name: "Knowledge",      icon: "📚" },
  { id: "evidence",       name: "Evidence",       icon: "🔬" },
  { id: "web-search",     name: "Web Search",     icon: "🌐" },
  { id: "file-manager",   name: "File Manager",   icon: "📁" },
  { id: "code-exec",      name: "Code Exec",      icon: "⚡" },
  { id: "image-gen",      name: "Image Gen",      icon: "🎨" },
  { id: "translator",     name: "Translator",     icon: "🌍" },
  { id: "calendar",       name: "Calendar",       icon: "📅" },
  { id: "email",          name: "Email",          icon: "📧" },
  { id: "analytics",      name: "Analytics",      icon: "📈" },
];

/**
 * LLM provider definitions shown in the Agent panel.
 * "alwaysActive" providers are always shown as online.
 * Others show as configurable (env-gated).
 */
const PROVIDERS = [
  {
    id: "mdes-ollama",
    name: "MDES Ollama Cloud",
    desc: "Primary remote LLM (always active)",
    icon: "☁️",
    dotColor: "bg-emerald-500",
    alwaysActive: true,
  },
  {
    id: "ollama-local",
    name: "Ollama Local",
    desc: "LOCAL_OLLAMA_BASE_URL or OLLAMA_BASE_URL",
    icon: "🖥️",
    dotColor: "bg-sky-400",
    alwaysActive: false,
    envHint: "Set LOCAL_OLLAMA_BASE_URL",
  },
  {
    id: "thai-llm",
    name: "ThaiLLM",
    desc: "THAI_LLM_MODEL",
    icon: "🇹🇭",
    dotColor: "bg-amber-400",
    alwaysActive: false,
    envHint: "Set THAI_LLM_MODEL",
  },
  {
    id: "gpt",
    name: "GPT (OpenAI)",
    desc: "OPENAI_API_KEY or GPT_API_KEY",
    icon: "🤖",
    dotColor: "bg-violet-400",
    alwaysActive: false,
    envHint: "Set OPENAI_API_KEY",
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    desc: "GITHUB_COPILOT_TOKEN or COPILOT_API_KEY",
    icon: "🐙",
    dotColor: "bg-rose-400",
    alwaysActive: false,
    envHint: "Set GITHUB_COPILOT_TOKEN",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(ms: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr  / 24);
  if (diffSec < 45)   return "just now";
  if (diffMin < 60)   return `${diffMin}m ago`;
  if (diffHr  < 24)   return `${diffHr}h ago`;
  if (diffDay === 1)  return "yesterday";
  if (diffDay < 7)    return `${diffDay}d ago`;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Slide-over Panel ─────────────────────────────────────────────────────────

type PanelId = "agent" | "plugins" | "scheduled" | "library" | "model-settings" | "memory" | "dashboard" | "task-detail" | "workspace" | null;

interface SlideOverProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  sidebarRight?: number;
}

const SlideOver: React.FC<SlideOverProps> = ({ open, title, onClose, children, sidebarRight }) => (
  <>
    {/* Backdrop */}
    {open && (
      <div
        className="fixed inset-0 z-50 bg-black/20 dark:bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
    )}
    {/* Panel — slides in from left, positioned next to the sidebar */}
    <div
      className={`fixed top-0 z-[60] flex h-full w-72 flex-col border-r border-border/50 bg-background shadow-xl transition-transform duration-300 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
      style={{ left: sidebarRight !== undefined ? `${sidebarRight}px` : "240px" }}
      aria-modal="true"
      role="dialog"
      aria-label={title}
    >
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">{children}</div>
    </div>
  </>
);

// ─── Nav Button ──────────────────────────────────────────────────────────────

interface NavBtnProps {
  icon: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  collapsed?: boolean;
  testId?: string;
}

const NavBtn: React.FC<NavBtnProps> = ({ icon, label, onClick, active, collapsed, testId }) => (
  <button
    onClick={onClick}
    data-testid={testId}
    title={collapsed ? label : undefined}
    className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
      active
        ? "bg-primary/10 text-primary"
        : "text-foreground/80 hover:bg-muted/60 hover:text-foreground"
    } ${collapsed ? "justify-center px-0" : ""}`}
  >
    <span className="shrink-0 text-base leading-none">{icon}</span>
    {!collapsed && <span className="truncate font-medium">{label}</span>}
  </button>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const ChatSidebar: React.FC<Props> = ({
  summaries,
  activeId,
  isCollapsed,
  onToggle,
  onLoad,
  onNewChat,
  onRename,
  onDelete,
  theme,
}) => {
  const [mounted, setMounted]         = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null); // TODO #45
  const [editTitle, setEditTitle]     = useState("");                  // TODO #45
  const [activePanel, setActivePanel] = useState<PanelId>(null);
  const [sidebarRight, setSidebarRight] = useState<number>(240);
  const [dbTasks, setDbTasks] = useState<Array<{ id: string; title: string; status: string; created_at: string }>>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [projects, setProjects] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("innomcp.projects") ?? '["MDES Operations"]'); }
    catch { return ["MDES Operations"]; }
  });
  const [activeProject, setActiveProject] = useState<string>(() =>
    localStorage.getItem("innomcp.activeProject") ?? "MDES Operations"
  );
  const [newProjectName, setNewProjectName] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);

  const createProject = (name: string) => {
    if (!name.trim() || projects.includes(name.trim())) return;
    const updated = [...projects, name.trim()];
    setProjects(updated);
    setActiveProject(name.trim());
    localStorage.setItem("innomcp.projects", JSON.stringify(updated));
    localStorage.setItem("innomcp.activeProject", name.trim());
    setShowNewProject(false);
    setNewProjectName("");
  };

  const switchProject = (name: string) => {
    setActiveProject(name);
    localStorage.setItem("innomcp.activeProject", name);
  };

  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef  = useRef<HTMLElement | null>(null);
  const { isLoggedIn, userDispName, userRoleId, logout } = useAuth();
  const { toggleTheme } = useTheme();
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);

  // Fetch recent tasks from DB — falls back to localStorage summaries if request fails or user is guest
  useEffect(() => {
    fetch("/api/tasks?limit=8", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.tasks?.length) setDbTasks(data.tasks); })
      .catch(() => {}); // silently fall back to summaries
  }, []);

  // Measure sidebar width whenever collapsed state changes or on mount
  useEffect(() => {
    const measure = () => {
      if (sidebarRef.current) {
        const rect = sidebarRef.current.getBoundingClientRect();
        setSidebarRight(rect.right);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [isCollapsed]);

  // Close user menu on outside click / Escape
  useEffect(() => {
    if (!showUserMenu) return;
    const onClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setShowUserMenu(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowUserMenu(false); };
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [showUserMenu]);

  // Ctrl+Shift+T — toggle theme
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleTheme]);

  const safeTheme = mounted ? theme : "light";

  const togglePanel = (id: PanelId) =>
    setActivePanel((prev) => (prev === id ? null : id));

  // ─── Tasks list (max 8) — DB tasks when available, else localStorage summaries ──
  const usingDbTasks = dbTasks.length > 0;
  const taskList = summaries.slice(0, 8);

  // ─── Task row ─────────────────────────────────────────────────────────────
  const TaskRow: React.FC<{ s: ChatSummary }> = ({ s }) => {
    const isActive = s.id === activeId;
    const isDone   = s.messages.length > 0;

    return (
      <li
        className={`group relative rounded-md transition-colors ${
          isActive ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted/60"
        }`}
      >
        {isActive && (
          <span
            aria-hidden="true"
            className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r bg-primary"
          />
        )}

        {editingId === s.id ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={() => {
              if (editTitle.trim() && onRename) onRename(s.id, editTitle.trim());
              setEditingId(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (editTitle.trim() && onRename) onRename(s.id, editTitle.trim());
                setEditingId(null);
              } else if (e.key === "Escape") {
                setEditingId(null);
              }
            }}
            autoFocus
            className={`w-full rounded-md border px-2 py-1.5 text-sm ${
              safeTheme === "light"
                ? "border-border bg-white text-foreground"
                : "border-white/15 bg-white/5 text-foreground"
            }`}
          />
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-2">
            <button
              onClick={() => onLoad(s)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              title={s.title}
              data-testid="chat-history-item"
            >
              <span
                className={`block min-w-0 flex-1 truncate text-[13px] font-medium leading-tight ${
                  isActive ? "text-primary" : "text-foreground"
                }`}
              >
                {s.title}
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                {isDone && (
                  <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    done
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground/70 whitespace-nowrap">
                  {relativeTime(s.time)}
                </span>
              </div>
            </button>

            {/* Rename / Delete — on hover */}
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              {onRename && (
                <button
                  onClick={() => { setEditingId(s.id); setEditTitle(s.title); }}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  title="Rename"
                  aria-label="Rename chat"
                  data-testid="chat-rename-btn"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => { if (confirm(`Delete "${s.title}"?`)) onDelete(s.id); }}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 dark:hover:text-rose-300"
                  title="Delete"
                  aria-label="Delete chat"
                  data-testid="chat-delete-btn"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
      </li>
    );
  };

  // ─── User menu popup ──────────────────────────────────────────────────────
  const UserMenuPopup = () => (
    <div
      className={`mt-1 overflow-hidden rounded-md border ${
        safeTheme === "light"
          ? "border-border bg-card shadow-md"
          : "border-white/10 bg-card shadow-lg"
      }`}
    >
      <button
        onClick={() => { router.push("/"); setShowUserMenu(false); }}
        className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] transition-colors ${
          safeTheme === "light" ? "text-foreground hover:bg-muted/60" : "text-foreground hover:bg-white/5"
        }`}
      >
        <FontAwesomeIcon icon={faHome} className="w-4" />
        <span>หน้าแรก</span>
      </button>

      {userRoleId === 0 && (
        <>
          <button
            onClick={() => { router.push("/apikey"); setShowUserMenu(false); }}
            className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] transition-colors ${
              safeTheme === "light" ? "text-foreground hover:bg-muted/60" : "text-foreground hover:bg-white/5"
            }`}
          >
            <FontAwesomeIcon icon={faKey} className="w-4" />
            <span>API Key</span>
          </button>
          <button
            onClick={() => { router.push("/user"); setShowUserMenu(false); }}
            className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] transition-colors ${
              safeTheme === "light" ? "text-foreground hover:bg-muted/60" : "text-foreground hover:bg-white/5"
            }`}
          >
            <FontAwesomeIcon icon={faUser} className="w-4" />
            <span>จัดการผู้ใช้</span>
          </button>
          <button
            onClick={() => { router.push("/admin"); setShowUserMenu(false); }}
            className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] transition-colors ${
              safeTheme === "light" ? "text-amber-700 hover:bg-amber-50" : "text-amber-300 hover:bg-amber-900/25"
            }`}
          >
            <span className="w-4 text-center text-xs">👑</span>
            <span>แผงผู้ดูแล</span>
          </button>
          <div className="my-1 border-t border-border/60" />
        </>
      )}

      <button
        onClick={() => { router.push("/workspace-settings"); setShowUserMenu(false); }}
        className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] transition-colors ${
          safeTheme === "light" ? "text-foreground hover:bg-muted/60" : "text-foreground hover:bg-white/5"
        }`}
      >
        <FontAwesomeIcon icon={faBriefcase} className="w-4" />
        <span>ตั้งค่า workspace</span>
      </button>
      <button
        onClick={() => { router.push("/personalization"); setShowUserMenu(false); }}
        className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] transition-colors ${
          safeTheme === "light" ? "text-foreground hover:bg-muted/60" : "text-foreground hover:bg-white/5"
        }`}
      >
        <FontAwesomeIcon icon={faPalette} className="w-4" />
        <span>ปรับแต่งส่วนตัว</span>
      </button>
      <button
        onClick={() => { router.push("/settings"); setShowUserMenu(false); }}
        className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] transition-colors ${
          safeTheme === "light" ? "text-foreground hover:bg-muted/60" : "text-foreground hover:bg-white/5"
        }`}
      >
        <FontAwesomeIcon icon={faGear} className="w-4" />
        <span>การตั้งค่า</span>
      </button>
      <button
        onClick={() => { router.push("/help"); setShowUserMenu(false); }}
        className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] transition-colors ${
          safeTheme === "light" ? "text-foreground hover:bg-muted/60" : "text-foreground hover:bg-white/5"
        }`}
      >
        <FontAwesomeIcon icon={faQuestion} className="w-4" />
        <span>ช่วยเหลือ</span>
      </button>
      <div className="my-1 border-t border-border/60" />
      <button
        onClick={async () => { await logout(); router.push("/login"); setShowUserMenu(false); }}
        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-900/20"
      >
        <FontAwesomeIcon icon={faSignOutAlt} className="w-4" />
        <span>ออกจากระบบ</span>
      </button>
    </div>
  );

  // ─── Slide-over: Agent ────────────────────────────────────────────────────
  const AgentPanelContent = () => (
    <AgentLeaderboard />
  );

  // ─── Slide-over: Plugins ──────────────────────────────────────────────────
  const PluginsPanelContent = () => (
    <div className="grid grid-cols-3 gap-2">
      {MCP_PLUGINS.map((p) => (
        <div
          key={p.id}
          className="flex flex-col items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 p-3 text-center hover:border-primary/30 hover:bg-primary/5 cursor-default"
        >
          <span className="text-2xl leading-none">{p.icon}</span>
          <span className="text-[11px] font-medium text-foreground leading-tight">{p.name}</span>
        </div>
      ))}
    </div>
  );

  // ─── Slide-over: Library ──────────────────────────────────────────────────
  const LibraryPanelContent = () =>
    summaries.length === 0 ? (
      <div className="mt-4 text-center text-sm text-muted-foreground">No saved tasks yet.</div>
    ) : (
      <ul className="flex flex-col gap-0.5">
        {summaries.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => { onLoad(s); setActivePanel(null); }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted/60"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{s.title}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(s.time)}</span>
            </button>
          </li>
        ))}
      </ul>
    );

  // ─── Collapsed strip ─────────────────────────────────────────────────────

  if (isCollapsed) {
    return (
      <aside
        className="relative flex h-full w-full flex-col items-center overflow-hidden border-r border-border/50 bg-background pt-3 pb-3 gap-2"
        data-testid="chat-sidebar"
      >
        {/* Toggle */}
        <button
          onClick={onToggle}
          aria-label="Expand sidebar"
          title="Expand sidebar"
          data-testid="toggle-sidebar-btn"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-background text-foreground hover:bg-muted/60"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>

        {/* New task */}
        <button
          onClick={onNewChat}
          title="New Task"
          data-testid="new-chat-btn"
          className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-r from-sky-500 to-emerald-500 text-white shadow-sm hover:opacity-90"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>

        <div className="mx-auto h-px w-6 bg-border/60" />

        {/* Nav icons */}
        <button
          onClick={() => { onToggle(); }}
          title="Agent"
          data-testid="sidebar-nav-agent"
          className="flex h-9 w-9 items-center justify-center rounded-md text-foreground/80 hover:bg-muted/60"
        >
          <span className="text-base leading-none">🤖</span>
        </button>
        <button
          onClick={() => { onToggle(); }}
          title="Plugins"
          data-testid="sidebar-nav-plugins"
          className="flex h-9 w-9 items-center justify-center rounded-md text-foreground/80 hover:bg-muted/60"
        >
          <span className="text-base leading-none">🔌</span>
        </button>
        <button
          onClick={() => { onToggle(); }}
          title="Scheduled"
          data-testid="sidebar-nav-scheduled"
          className="flex h-9 w-9 items-center justify-center rounded-md text-foreground/80 hover:bg-muted/60"
        >
          <span className="text-base leading-none">📅</span>
        </button>
        <button
          onClick={() => { onToggle(); }}
          title="Library"
          data-testid="sidebar-nav-library"
          className="flex h-9 w-9 items-center justify-center rounded-md text-foreground/80 hover:bg-muted/60"
        >
          <span className="text-base leading-none">📚</span>
        </button>
        <button
          onClick={() => { onToggle(); }}
          title="Model Settings"
          data-testid="sidebar-nav-model-settings"
          className="flex h-9 w-9 items-center justify-center rounded-md text-foreground/80 hover:bg-muted/60"
        >
          <span className="text-base leading-none">⚙️</span>
        </button>
        <button
          onClick={() => { onToggle(); }}
          title="Dashboard"
          data-testid="sidebar-nav-dashboard"
          className="flex h-9 w-9 items-center justify-center rounded-md text-foreground/80 hover:bg-muted/60"
        >
          <span className="text-base leading-none">📊</span>
        </button>

        {/* User avatar at bottom */}
        <div className="mt-auto">
          {isLoggedIn ? (
            <button
              title="Settings"
              onClick={() => router.push("/settings")}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary via-sky-500 to-violet-500 text-[13px] font-semibold text-white shadow-sm"
            >
              {(userDispName?.charAt(0) || "U").toUpperCase()}
            </button>
          ) : (
            <button
              title="Login"
              onClick={() => router.push("/login")}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-background text-foreground hover:bg-muted/60"
            >
              <FontAwesomeIcon icon={faKey} className="w-4" />
            </button>
          )}
        </div>
      </aside>
    );
  }

  // ─── Expanded sidebar ─────────────────────────────────────────────────────

  return (
    <>
      {/* Slide-over panels */}
      <SlideOver open={activePanel === "agent"}     title="🤖 Agent"     onClose={() => setActivePanel(null)} sidebarRight={sidebarRight}>
        <AgentPanelContent />
      </SlideOver>
      <SlideOver open={activePanel === "plugins"}   title="🔌 Plugins"   onClose={() => setActivePanel(null)} sidebarRight={sidebarRight}>
        <PluginsPanelContent />
      </SlideOver>
      <SlideOver open={activePanel === "scheduled"} title="📅 Scheduled" onClose={() => setActivePanel(null)} sidebarRight={sidebarRight}>
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="text-4xl leading-none">🚧</span>
          <div className="text-sm font-semibold text-foreground">Coming Soon</div>
          <div className="text-xs text-muted-foreground">Scheduled tasks will appear here.</div>
        </div>
      </SlideOver>
      <SlideOver open={activePanel === "library"}   title="📚 Library"   onClose={() => setActivePanel(null)} sidebarRight={sidebarRight}>
        <LibraryPanelContent />
      </SlideOver>
      <SlideOver open={activePanel === "model-settings"} title="⚙️ Model Settings" onClose={() => setActivePanel(null)} sidebarRight={sidebarRight}>
        <ModelSettingsPanel onClose={() => setActivePanel(null)} />
      </SlideOver>
      <SlideOver open={activePanel === "memory"} title="🧠 Memory" onClose={() => setActivePanel(null)} sidebarRight={sidebarRight}>
        <MemoryManager sessionId={activeId ?? undefined} onClose={() => setActivePanel(null)} />
      </SlideOver>
      <SlideOver open={activePanel === "dashboard"} title="📊 Dashboard" onClose={() => setActivePanel(null)} sidebarRight={sidebarRight}>
        <DashboardView onOpenChat={() => { setActivePanel(null); onNewChat(); }} />
      </SlideOver>
      <SlideOver open={activePanel === "task-detail"} title="📋 Task Detail" onClose={() => setActivePanel(null)} sidebarRight={sidebarRight}>
        {selectedTaskId ? (
          <TaskDetailPanel taskId={selectedTaskId} onClose={() => setActivePanel(null)} />
        ) : null}
      </SlideOver>
      <SlideOver open={activePanel === "workspace"} title="🗂️ Workspace Files" onClose={() => setActivePanel(null)} sidebarRight={sidebarRight}>
        <WorkspaceFileBrowser />
      </SlideOver>

      <aside
        ref={sidebarRef}
        className="relative flex h-full w-full flex-col overflow-hidden border-r border-border/50 bg-background"
        data-testid="chat-sidebar"
      >
        {/* ── Logo row ── */}
        <div className="flex items-center gap-2 px-3 py-3">
          {/* Logo icon */}
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-sky-500 to-emerald-500 text-white">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          </div>
          <span className="flex-1 text-sm font-bold tracking-wide text-foreground">INNOMCP</span>
          <button
            onClick={toggleTheme}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            aria-label="Toggle theme"
            title={safeTheme === "dark" ? "Switch to Light (Ctrl+Shift+T)" : "Switch to Dark (Ctrl+Shift+T)"}
          >
            {safeTheme === "dark" ? "☀️" : "🌙"}
          </button>
          <button
            onClick={onToggle}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            data-testid="toggle-sidebar-btn"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
        </div>

        {/* ── New Task button ── */}
        <div className="px-3 pb-3">
          <button
            onClick={onNewChat}
            data-testid="new-chat-btn"
            className="flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-sky-500 to-emerald-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Task
          </button>
        </div>

        <div className="mx-3 border-t border-border/50" />

        {/* ── Nav section ── */}
        <div className="flex flex-col gap-0.5 px-2 py-2">
          <NavBtn
            icon="🤖"
            label="Agent"
            onClick={() => togglePanel("agent")}
            active={activePanel === "agent"}
            testId="sidebar-nav-agent"
          />
          <NavBtn
            icon="🔌"
            label="Plugins"
            onClick={() => togglePanel("plugins")}
            active={activePanel === "plugins"}
            testId="sidebar-nav-plugins"
          />
          <NavBtn
            icon="📅"
            label="Scheduled"
            onClick={() => togglePanel("scheduled")}
            active={activePanel === "scheduled"}
            testId="sidebar-nav-scheduled"
          />
          <NavBtn
            icon="📚"
            label="Library"
            onClick={() => togglePanel("library")}
            active={activePanel === "library"}
            testId="sidebar-nav-library"
          />
          <NavBtn
            icon="⚙️"
            label="Model Settings"
            onClick={() => togglePanel("model-settings")}
            active={activePanel === "model-settings"}
            testId="sidebar-nav-model-settings"
          />
          <NavBtn
            icon="🧠"
            label="Memory"
            onClick={() => togglePanel("memory")}
            active={activePanel === "memory"}
            testId="sidebar-nav-memory"
          />
          <NavBtn
            icon="📊"
            label="Dashboard"
            onClick={() => togglePanel("dashboard")}
            active={activePanel === "dashboard"}
            testId="sidebar-nav-dashboard"
          />
          {isLoggedIn && (
            <NavBtn
              icon="📊"
              label="Dashboard"
              onClick={() => router.push("/dashboard")}
              testId="sidebar-nav-dashboard-page"
            />
          )}
          {isLoggedIn && (
            <NavBtn
              icon="📁"
              label="Projects"
              onClick={() => router.push("/projects")}
              testId="sidebar-nav-projects"
            />
          )}
          {isLoggedIn && (
            <NavBtn
              icon="🗂️"
              label="Workspace"
              onClick={() => togglePanel("workspace")}
              active={activePanel === "workspace"}
              testId="sidebar-nav-workspace"
            />
          )}
        </div>

        <div className="mx-3 border-t border-border/50" />

        {/* ── Projects section ── */}
        <div className="px-3 py-2">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Projects
            </span>
            <button
              title="New project"
              onClick={() => setShowNewProject(true)}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted/60 hover:text-foreground text-sm leading-none"
            >
              +
            </button>
          </div>
          <ul className="flex flex-col gap-0.5">
            {projects.map(p => (
              <li key={p} onClick={() => switchProject(p)}
                className={`flex items-center justify-between rounded-md px-2 py-1 text-[11.5px] cursor-pointer transition-colors ${
                  p === activeProject ? "bg-primary/8 text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}>
                <span className="truncate">{p}</span>
                {p === activeProject && <span className="text-[9px] text-primary/60">●</span>}
              </li>
            ))}
            {showNewProject ? (
              <li className="flex items-center gap-1 px-1">
                <input autoFocus value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") createProject(newProjectName); if (e.key === "Escape") setShowNewProject(false); }}
                  placeholder="ชื่อโปรเจกต์..."
                  className="flex-1 rounded border border-border/40 bg-background px-1.5 py-0.5 text-[11px] text-foreground focus:outline-none" />
                <button onClick={() => createProject(newProjectName)} className="text-[10px] text-primary">✓</button>
              </li>
            ) : (
              <li onClick={() => setShowNewProject(true)}
                className="flex items-center gap-1 px-2 py-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground cursor-pointer rounded">
                <span>＋</span><span>โปรเจกต์ใหม่</span>
              </li>
            )}
          </ul>
        </div>

        <div className="mx-3 border-t border-border/50" />

        {/* ── All Tasks section ── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-2">
          <div className="flex items-center justify-between pb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              All Tasks
            </span>
            {/* Show count from whichever source is active */}
            {(usingDbTasks ? dbTasks.length : summaries.length) > 8 && (
              <span className="text-[11px] text-muted-foreground/70">
                {usingDbTasks ? dbTasks.length : summaries.length}
              </span>
            )}
          </div>

          {(usingDbTasks ? dbTasks.length : taskList.length) === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 px-3 py-5 text-center">
              <div className="text-[12.5px] font-medium text-foreground">No tasks yet</div>
              <div className="mt-1 text-[11.5px] text-muted-foreground">
                Start a new task to get going
              </div>
            </div>
          ) : usingDbTasks ? (
            /* DB tasks — read-only display (title + status badge + time) */
            <ul className="flex flex-col gap-0.5 overflow-y-auto pb-2">
              {dbTasks.slice(0, 8).map((t) => (
                <li
                  key={t.id}
                  className={`flex items-center gap-2 rounded-md px-2 py-2 cursor-pointer hover:bg-muted/60 ${
                    selectedTaskId === t.id && activePanel === "task-detail"
                      ? "bg-primary/10 ring-1 ring-primary/20"
                      : ""
                  }`}
                  onClick={() => {
                    router.push(`/tasks/${t.id}`);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground leading-tight">
                    {t.title}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {t.status === "completed" && (
                      <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        done
                      </span>
                    )}
                    {t.status === "running" && (
                      <span className="inline-flex items-center rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                        running
                      </span>
                    )}
                    {t.status === "failed" && (
                      <span className="inline-flex items-center rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                        failed
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground/70 whitespace-nowrap">
                      {relativeTime(new Date(t.created_at).getTime())}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            /* localStorage summaries fallback */
            <ul className="flex flex-col gap-0.5 overflow-y-auto pb-2">
              {taskList.map((s) => (
                <TaskRow key={s.id} s={s} />
              ))}
            </ul>
          )}
        </div>

        {/* ── User / auth area ── */}
        {isLoggedIn ? (
          <div className="mt-auto border-t border-border/50" ref={userMenuRef}>
            <div className="p-2">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-foreground transition-colors hover:bg-primary/8"
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary via-sky-500 to-violet-500 text-[13px] font-semibold text-white shadow-sm ring-2 transition-all ${
                    showUserMenu ? "ring-primary/40 scale-105" : "ring-transparent"
                  }`}
                >
                  {(userDispName?.charAt(0) || "U").toUpperCase()}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="truncate text-[13.5px] font-medium leading-tight text-foreground">
                    {userDispName || "ผู้ใช้"}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    Settings & account
                  </div>
                </div>
                <FontAwesomeIcon
                  icon={faGear}
                  className={`text-xs text-muted-foreground transition-transform ${showUserMenu ? "rotate-90" : ""}`}
                />
              </button>
              {showUserMenu && <UserMenuPopup />}
            </div>
          </div>
        ) : (
          <div className="mt-auto space-y-2 border-t border-border/50 p-3">
            <div className="rounded-md border border-primary/20 bg-primary/[0.06] px-3 py-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                <span aria-hidden="true">✦</span>
                <span>Guest Mode</span>
              </div>
              <div className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
                Sign in to unlock history, AI features, and full quota.
              </div>
            </div>
            <button
              onClick={() => router.push("/login")}
              data-testid="sidebar-login-cta"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/92"
            >
              <FontAwesomeIcon icon={faKey} className="w-4" />
              <span>Sign In</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

export default ChatSidebar;
