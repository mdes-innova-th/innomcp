"use client";

import React, { useState, useEffect, useRef, useContext, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ChatMessage, {
  MessageView,
  Message as MessageType,
} from "@/app/components/chat/ChatMessage";
import ChatSidebar, {
  ChatSummary as SidebarSummary,
} from "@/app/components/chat/ChatSidebar";
import ChatInput, { type ProviderMode } from "./ChatInput";
import FileUploadProgress from "@/app/components/common/FileUploadProgress";
import ThemeContext from "@/app/context/ThemeContext";
import { useAuth } from "@/app/context/AuthContext";
import { useToast } from "@/app/context/ToastContext";
import type { ToolType } from "./ToolsTypeSelector";
// Phase 10.68 � unified ChatMode replaces AIMode + ReasoningMode
import { type ChatMode } from "./ChatModeSelector";
import {
  buildChatTransportHistory,
  compactChatMessagesForStorage,
  isQuotaExceededError,
} from "../../../utils/chatStorage";
import dynamic from "next/dynamic";
import MultiAgentPanel from "@/app/components/chat/MultiAgentPanel";
import PlanViewer from "@/app/components/chat/PlanViewer";
import StarterPromptsGrid from "@/app/components/chat/StarterPromptsGrid";
import AgentWorkspacePanel from "@/app/components/chat/AgentWorkspacePanel";
import OfficeTeamPanel from "@/app/components/chat/OfficeTeamPanel";
import OraclePatternPanel from "@/app/components/chat/OraclePatternPanel";
import PulsePanel from "@/app/components/chat/PulsePanel";
import { useAgentEventStream } from "@/app/components/chat/useAgentEventStream";
import KeyboardShortcutsPanel, { useKeyboardShortcutsPanel } from "@/app/components/chat/KeyboardShortcutsPanel";
import type { Artifact } from "@/app/components/chat/ArtifactPanel";
import { buildPlanFromEvents } from "../../../utils/planExtractor";
import type { ApprovalRequest } from "@/app/components/chat/ApprovalGate";
import { useTaskNotifications } from "@/app/hooks/useTaskNotifications";
import { useRoomWebSocket } from "@/app/hooks/useRoomWebSocket";
import TypingIndicator from "@/app/components/chat/TypingIndicator";
import { ErrorBoundary } from "@/app/components/common/ErrorBoundary";
import OnboardingModal from "@/app/components/common/OnboardingModal";
import GuidedTour from "@/app/components/common/GuidedTour";
import ActiveModelBadge from "@/app/components/chat/ActiveModelBadge";
import StatusRibbon from "@/app/components/chat/StatusRibbon";
import MDESBrandHeader from "@/app/components/chat/MDESBrandHeader";
import ManusWorkspacePanel from "@/app/components/chat/ManusWorkspacePanel";
import CollapsibleAgentWrapper from "@/app/components/chat/CollapsibleAgentWrapper";
import ModelSettingsPanel from "@/app/components/chat/ModelSettingsPanel";
import ChatEmptyStateManager from "@/app/components/chat/ChatEmptyStateManager";
import SlashCommandMenu from "@/app/components/chat/SlashCommandMenu";
import MDESStreamIndicator from "@/app/components/chat/MDESStreamIndicator";
import InlineFeedbackBar from "@/app/components/chat/InlineFeedbackBar";
import FloatingStatusBadge from "@/app/components/chat/FloatingStatusBadge";

// Phase 4 � lazy-load panel/modal components not needed on initial paint
const ThinkingModal = dynamic(() => import("@/app/components/chat/ThinkingModal"), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-4 text-muted-foreground text-[12px] animate-pulse">กำลังโหลด...</div>,
});
const ArtifactPanel = dynamic(() => import("@/app/components/chat/ArtifactPanel"), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-4 text-muted-foreground text-[12px] animate-pulse">กำลังโหลด...</div>,
});
const ApprovalGate = dynamic(() => import("@/app/components/chat/ApprovalGate"), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-4 text-muted-foreground text-[12px] animate-pulse">กำลังโหลด...</div>,
});
const CommandPalette = dynamic(() => import("@/app/components/common/CommandPalette"), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-4 text-muted-foreground text-[12px] animate-pulse">กำลังโหลด...</div>,
});
// icons are used in ChatInput; not needed here

// Define the type for a chat message
// `structuredContent` can contain typed data returned by server tools (e.g. { chartSvg })
// We preserve that structure so the UI can render rich content (images, charts, etc.)
interface ChatMessage {
  sender: "user" | "ai";
  text: string;
  // For AI messages, store the full text for animation
  fullText?: string;
  isAnimating?: boolean;
  structuredContent?: any;
  toolsUsed?: string[]; // Track which tools were used for this message
  // Progress tracking properties
  isProgress?: boolean;
  progressStage?: string;
  elapsedTime?: number;
  mdesEnhanced?: boolean; // true when MDES agents upgraded this message
  // Phase 10.27 � wall-clock receipt + roundtrip latency (ms)
  timestamp?: number;
  isComplete?: boolean;
  elapsedMs?: number;
  followUpSuggestions?: string[];
  responseTime?: number;
}

const CHAT_HISTORY_STORAGE_PLANS = [
  { maxMessages: 20, stripStructuredContent: false },
  { maxMessages: 12, stripStructuredContent: false },
  { maxMessages: 10, stripStructuredContent: true },
  { maxMessages: 5, stripStructuredContent: true },
] as const;

// P1-3: localStorage history versioning + corruption guard
const CHAT_HISTORY_VERSION = 2;
const MOJIBAKE_RE = /�|(?:\?{3,})/;

function migrateChatHistory(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw)) return null;
  const filtered = (raw as unknown[]).filter((m): m is ChatMessage => {
    if (!m || typeof m !== "object") return false;
    const msg = m as Record<string, unknown>;
    if (msg.sender !== "user" && msg.sender !== "ai") return false;
    if (typeof msg.text !== "string") return false;
    if (MOJIBAKE_RE.test(msg.text)) return false;
    return true;
  });
  return filtered;
}

const CHAT_SUMMARY_STORAGE_PLANS = [
  { maxSummaries: 10, maxMessages: 12, stripStructuredContent: false },
  { maxSummaries: 8, maxMessages: 8, stripStructuredContent: true },
  { maxSummaries: 5, maxMessages: 5, stripStructuredContent: true },
] as const;

const CHAT_HISTORY_CONTEXT_LIMIT = 20;

const TOOL_TYPE_META: Record<ToolType, {
  label: string;
  description: string;
  icon: string;
}> = {
  auto: {
    label: "อัตโนมัติ",
    description: "ให้ AI เลือกเครื่องมือที่เหมาะเอง",
    icon: "🤖",
  },
  weather: {
    label: "สภาพอากาศ",
    description: "เน้นข้อมูลอุตุนิยมวิทยาและพยากรณ์",
    icon: "🌤️",
  },
  calculation: {
    label: "คำนวณ",
    description: "เหมาะกับสูตร ตัวเลข และการวิเคราะห์เชิงตรรกะ",
    icon: "🔢",
  },
  art: {
    label: "ภาพและกราฟ",
    description: "สร้างภาพ กราฟ และผลลัพธ์เชิงภาพ",
    icon: "🎨",
  },
  data: {
    label: "ข้อมูลอ้างอิง",
    description: "ดึงข้อมูลจากแหล่งความรู้และ APIs ภายนอก",
    icon: "📊",
  },
  datetime: {
    label: "วันและเวลา",
    description: "งานที่เกี่ยวกับเวลา ปฏิทิน และช่วงเวลา",
    icon: "⏰",
  },
  officer: {
    label: "เจ้าหน้าที่",
    description: "โหมดงานราชการและข้อมูลภายในเจ้าหน้าที่",
    icon: "🧑‍💼",
  },
};

const QUICK_ACTIONS = [
  { icon: "📊", label: "วิเคราะห์ข้อมูล", prompt: "วิเคราะห์ข้อมูลนี้แล้วสร้างกราฟให้หน่อย" },
  { icon: "💻", label: "เขียนโค้ด", prompt: "ช่วยเขียนโค้ดสำหรับ [อธิบาย feature ที่ต้องการ]" },
  { icon: "🔍", label: "ค้นคว้าข้อมูล", prompt: "ค้นหาข้อมูลเกี่ยวกับ [หัวข้อ] แล้วสรุปให้" },
  { icon: "📝", label: "เขียนรายงาน", prompt: "เขียนรายงานเรื่อง [หัวข้อ] ให้หน่อย" },
] as const;

const WORKSPACE_PILLARS = [
  "โฟลว์สนทนาที่วางภาษาไทยเป็นหลัก",
  "คำตอบที่รู้จักเลือกเครื่องมือให้เหมาะกับงาน",
  "รองรับทั้งข้อมูล ภาพ และงานต่อเนื่องในบทสนทนาเดียว",
] as const;

function shouldForceCollapsedSidebar(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 1279px)").matches;
}

function extractArtifacts(text: string, messageId: string): Artifact[] {
  const arts: Artifact[] = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]+?)```/g;
  let match;
  let idx = 0;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const lang = match[1] || "text";
    const content = match[2].trim();
    if (content.length > 100) {
      arts.push({
        id: `${messageId}-${idx++}`,
        name: `artifact-${idx}.${lang === "markdown" || lang === "md" ? "md" : lang}`,
        type:
          lang === "markdown" || lang === "md"
            ? "markdown"
            : lang === "json"
            ? "json"
            : lang === "csv"
            ? "csv"
            : lang === "html"
            ? "html"
            : "code",
        content,
        language: lang,
        createdAt: Date.now(),
        taskId: messageId,
      });
    }
  }
  return arts;
}

function persistMessagesToLocalStorage(messages: ChatMessage[]): void {
  if (messages.length === 0) {
    localStorage.removeItem("chatMessages");
    return;
  }

  for (const plan of CHAT_HISTORY_STORAGE_PLANS) {
    try {
      const compacted = compactChatMessagesForStorage(messages as unknown as Array<Record<string, unknown>>, plan.maxMessages, {
        stripStructuredContent: plan.stripStructuredContent,
      });
      localStorage.setItem("chatMessages", JSON.stringify({ v: CHAT_HISTORY_VERSION, messages: compacted }));
      return;
    } catch (error) {
      if (!isQuotaExceededError(error)) {
        console.error("Error saving messages to localStorage:", error);
        return;
      }
    }
  }

  console.warn("[ChatStorage] Could not persist chatMessages within localStorage quota");
  localStorage.removeItem("chatMessages");
}

function persistSummariesToLocalStorage(summaries: SidebarSummary[]): void {
  for (const plan of CHAT_SUMMARY_STORAGE_PLANS) {
    try {
      const compacted = summaries.slice(0, plan.maxSummaries).map((summary) => ({
        ...summary,
        messages: compactChatMessagesForStorage(summary.messages as unknown as Array<Record<string, unknown>>, plan.maxMessages, {
          stripStructuredContent: plan.stripStructuredContent,
        }) as unknown as SidebarSummary["messages"],
      }));
      localStorage.setItem("chatSummaries", JSON.stringify(compacted));
      return;
    } catch (error) {
      if (!isQuotaExceededError(error)) {
        console.error("Error saving chat summaries:", error);
        return;
      }
    }
  }

  console.warn("[ChatStorage] Could not persist chatSummaries within localStorage quota");
  localStorage.removeItem("chatSummaries");
}

// StatusRibbon is now imported from ./StatusRibbon (standalone component)

function shouldUseMdesFinal(existing: string, next: string, isProgress?: boolean): boolean {
  const current = existing.trim();
  const candidate = next.trim();
  if (!candidate) return false;
  if (isProgress) return true;
  if (current.length < 30) return true;
  if (/processing|thinking|working|deterministic/i.test(current)) return true;
  return candidate.length > current.length * 1.6 && current.length < 240;
}

const ChatPage: React.FC = () => {
  const { theme } = useContext(ThemeContext) as { theme: string };
  const { isGuestMode, capabilityLevel } = useAuth();
  const { notify } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeProjectId =
    searchParams.get("projectId") ||
    searchParams.get("project_id") ||
    undefined;
  const [shortcutsOpen, setShortcutsOpen] = useKeyboardShortcutsPanel();
  const [thinkingModalOpen, setThinkingModalOpen] = useState(false);
  const numericProjectId = activeProjectId ? parseInt(activeProjectId, 10) || null : null;
  const [wsToken, setWsToken] = useState<string | null>(null);
  const { typingUsers, sendTypingStart, sendTypingStop } = useRoomWebSocket({ projectId: numericProjectId, token: wsToken });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false);
  const [slashMenuVisible, setSlashMenuVisible] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [multiAgentOpen, setMultiAgentOpen] = useState(false);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [artifactPanelOpen, setArtifactPanelOpen] = useState(false);
  const [planViewerOpen, setPlanViewerOpen] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Stored compact chat summaries (keeps up to last 10)
  // Use the SidebarSummary type for compatibility
  const [chatSummaries, setChatSummaries] = useState<SidebarSummary[]>([]);
  const [activeSummaryId, setActiveSummaryId] = useState<string | null>(null);
  // Sidebar collapsed state (persisted)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);
  // For typewriter effect
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // For editing AI message (handled inside MessageView)
  const [input, setInput] = useState("");
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  // Phase 10.15: MultiAgent Panel state
  const [expandAll, setExpandAll] = useState(false);
  const { state: agentStreamState, send: sendAgentStream, reset: resetAgentStream } = useAgentEventStream();
  // Phase 3 � browser notifications when agent task completes
  useTaskNotifications(agentStreamState.events, isWaitingForResponse);

  // Phase 3 � in-page toast when agent task completes (complements browser notification)
  const prevIsStreamingForToastRef = useRef<boolean>(false);
  useEffect(() => {
    const wasStreaming = prevIsStreamingForToastRef.current;
    prevIsStreamingForToastRef.current = isWaitingForResponse;
    // Only fire once per completion: wasStreaming=true ? isWaitingForResponse=false
    if (!wasStreaming || isWaitingForResponse) return;
    const hasFinalAnswer = agentStreamState.events.some((e) => e.type === "final_answer");
    if (!hasFinalAnswer) return;
    notify("งานเสร็จแล้ว ✓", "success");
  }, [agentStreamState.events, isWaitingForResponse, notify]);

  const activeAgentStreamRequestRef = useRef<string | null>(null);
  const [isSocketReady, setIsSocketReady] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const isStoppedRef = useRef(false);
  // Phase 10.27 � wall-clock timestamp captured when the user hits send.
  // Used to stamp responseTime onto the AI reply when it lands.
  const lastSendAtRef = useRef<number | null>(null);
  const sendMessageRef = useRef<() => Promise<void>>(() => Promise.resolve());
  // Phase 3 CSV � prefix injected by ChatInput before sendMessage fires
  const csvPrefixRef = useRef<string>("");
  // Phase 10.61 � keep the working-indicator visible for =1500 ms after a send,
  // so fast-fallback models (e.g. qwen2.5:0.5b returning a cached acknowledgment
  // in <200 ms) still produce a visible "typing" affordance. Without this, the
  // working-indicator can flicker off before the user perceives any feedback,
  // and Playwright's animate-bounce-visible assertion races the response.
  const [stickyWorkingTick, setStickyWorkingTick] = useState(0);
  const stickyWorkingUntilRef = useRef<number>(0);
  const isWorkingSticky = stickyWorkingUntilRef.current > Date.now();
  
  // File upload progress tracking (TODO #40)
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileSize, setUploadFileSize] = useState(0);
  const [uploadFileName, setUploadFileName] = useState("");
  const maxFileSize = 5 * 1024 * 1024; // 5 MB limit

  const hasMessages = messages.length > 0;
  const activeConversationTitle = activeSummaryId
    ? chatSummaries.find((summary) => summary.id === activeSummaryId)?.title || "บทสนทนาปัจจุบัน"
    : "การสนทนาใหม่";
  const workspaceState = !isSocketReady
    ? {
        title: "Backend offline",
        detail: "ยังเชื่อมต่อ websocket ไม่ได้",
        tone: "bg-rose-500/12 text-rose-800 dark:bg-rose-400/16 dark:text-rose-200",
        dot: "bg-rose-500",
      }
    : isWaitingForResponse
    ? {
        title: "กำลังตอบกลับ",
        detail: "ระบบกำลังประมวลผลคำตอบล่าสุด",
        tone: "bg-amber-500/12 text-amber-800 dark:bg-amber-400/16 dark:text-amber-200",
        dot: "bg-amber-500",
      }
    : {
        title: "พร้อมใช้งาน",
        detail: "เครื่องมือและ AI พร้อมรับคำสั่ง",
        tone: "bg-emerald-500/12 text-emerald-800 dark:bg-emerald-400/16 dark:text-emerald-200",
        dot: "bg-emerald-500",
      };

  // Chat input is always visible; removed scroll-hide logic

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  // Count messages added while user is scrolled up � badge on the floating button.
  const [unreadCount, setUnreadCount] = useState(0);
  const prevMessagesLenRef = useRef(0);
  const [, setIsChatActive] = useState(false); // tracks composer focus for future hooks
  const [selectedToolType, setSelectedToolType] = useState<ToolType>("auto");
  // Phase 10.68 � single ChatMode drives both AI backend & agent count
  const [chatMode, setChatMode] = useState<ChatMode>("normal");
  // Provider mode � "remote" = MDES Cloud Ollama, "local" = localhost:11434
  const [providerMode, setProviderMode] = useState<ProviderMode>("remote");
  const activeToolMeta = TOOL_TYPE_META[selectedToolType] || TOOL_TYPE_META.auto;

  // PAS-5: Approval gate state � risky tool actions require user confirmation
  const [pendingApproval, setPendingApproval] = useState<ApprovalRequest | null>(null);
  const approvalCallbacks = useRef<Map<string, (approved: boolean) => void>>(new Map());
  // Holds the approvalId from the pending shell gate so onApprovalConfirmed can call approve-and-exec
  // Map keyed by approvalId — supports concurrent terminals each awaiting approval
  const pendingShellApprovals = useRef<Map<string, boolean>>(new Map());

  // Load data from localStorage on mount
  useEffect(() => {
    setMounted(true);

    // Check for thinking mode query parameter
    if (searchParams.get("thinkingMode") === "true") {
      setThinkingModalOpen(true);
      // Clean up URL
      window.history.replaceState(null, "", "/");
    }

    // Load sidebar collapsed state
    try {
      const forceCollapsed = shouldForceCollapsedSidebar();
      const savedCollapsed = localStorage.getItem("innomcp-sidebar-state");
      if (savedCollapsed !== null && !forceCollapsed) {
        setIsSidebarCollapsed(savedCollapsed === "collapsed");
      } else {
        setIsSidebarCollapsed(forceCollapsed || savedCollapsed === "collapsed");
      }
    } catch (e) {
      // ignore localStorage errors
      setIsSidebarCollapsed(shouldForceCollapsedSidebar());
    }

    const savedMessages = localStorage.getItem("chatMessages");
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        // P1-3: versioned envelope or legacy bare array
        const storedVersion = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>).v : undefined;
        const rawArray = parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>).messages
          : parsed;
        const migrated = migrateChatHistory(rawArray);
        if (migrated === null) {
          // hopelessly corrupt — start fresh
          localStorage.removeItem("chatMessages");
        } else {
          if (storedVersion !== CHAT_HISTORY_VERSION) {
            // re-save with current version
            localStorage.setItem("chatMessages", JSON.stringify({ v: CHAT_HISTORY_VERSION, messages: migrated }));
          }
          setMessages(migrated);
        }
      } catch (error) {
        console.error("Error loading messages from localStorage:", error);
        localStorage.removeItem("chatMessages");
      }
    }
    // load summaries
    const savedSummaries = localStorage.getItem("chatSummaries");
    if (savedSummaries) {
      try {
        setChatSummaries(JSON.parse(savedSummaries));
      } catch (err) {
        console.error("Error loading chat summaries:", err);
      }
    }

    // Load selected tool type (used to derive uiMode)
    try {
      const savedType = localStorage.getItem("selectedToolType") as ToolType;
      if (savedType) setSelectedToolType(savedType);
    } catch {
      // ignore
    }
  }, []);

  // Phase 10 — fetch a WS-compatible JWT for the room WebSocket (httpOnly cookie
  // cannot be read by JS, so we ask the backend to echo it as JSON).
  useEffect(() => {
    const BACKEND =
      typeof window !== 'undefined' && window.location.port === '3000'
        ? 'http://localhost:3015'
        : '';
    fetch(BACKEND + '/api/auth/ws-token', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.token) setWsToken(data.token);
      })
      .catch(() => {
        // Silently ignore — guests and unauthenticated users won't get a token,
        // and the hook will simply stay disconnected.
      });
  }, []);

  // Phase 5 � first-time user onboarding: show modal after 500ms if not yet seen
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (!localStorage.getItem("innomcp-onboarding-done")) {
          setShowOnboarding(true);
        }
      } catch {
        // ignore localStorage errors (e.g. private browsing restrictions)
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 1279px)");
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsSidebarCollapsed(true);
      }
    };

    if (mediaQuery.matches) {
      setIsSidebarCollapsed(true);
    }

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [mounted]);

  // Save messages to localStorage whenever messages change
  useEffect(() => {
    persistMessagesToLocalStorage(messages);
  }, [messages]);

  // Persist summaries when changed
  useEffect(() => {
    persistSummariesToLocalStorage(chatSummaries);
  }, [chatSummaries]);

  // persist sidebar collapsed state
  useEffect(() => {
    if (mounted) {
      try {
        localStorage.setItem(
          "innomcp-sidebar-state",
          isSidebarCollapsed ? "collapsed" : "expanded"
        );
      } catch (e) {
        // ignore
      }
    }
  }, [isSidebarCollapsed, mounted]);

  // Scroll the page to bottom when messages change (document-level scroll)
  useEffect(() => {
    if (!isNearBottom) return;
    setTimeout(() => {
      try {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
      } catch {
        window.scrollTo(0, document.documentElement.scrollHeight);
      }
    }, 100);
  }, [messages, isNearBottom]);

  // Keep scrolling during animation (only if near bottom)
  useEffect(() => {
    const scrollInterval = setInterval(() => {
      if (isWaitingForResponse && isNearBottom) {
        window.scrollTo(0, document.documentElement.scrollHeight);
      }
    }, 300);
    return () => clearInterval(scrollInterval);
  }, [isWaitingForResponse, isNearBottom]);

  // Detect scroll position using window scroll (single browser scrollbar)
  useEffect(() => {
    const handleScroll = () => {
      const distanceFromBottom =
        document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      const threshold = 120;
      const nearBottom = distanceFromBottom < threshold;
      setIsNearBottom(nearBottom);
      setShowScrollButton(!nearBottom && messages.length > 0);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [messages.length]);

  // Function to scroll to bottom (used by floating button)
  const scrollToBottom = () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    setUnreadCount(0);
  };

  // Increment unread when new AI messages arrive while user scrolled up;
  // clear when user returns to bottom.
  useEffect(() => {
    const prevLen = prevMessagesLenRef.current;
    const newLen = messages.length;
    if (newLen > prevLen && !isNearBottom) {
      // Only count messages that are AI replies (user's own messages don't bug them).
      let aiAdded = 0;
      for (let i = prevLen; i < newLen; i++) {
        if (messages[i]?.sender === "ai" && !messages[i]?.isProgress) aiAdded++;
      }
      if (aiAdded > 0) setUnreadCount((c) => c + aiAdded);
    }
    if (isNearBottom && unreadCount > 0) setUnreadCount(0);
    prevMessagesLenRef.current = newLen;
  }, [messages, isNearBottom, unreadCount]);

  // (Previously: scroll detection and hiding input while scrolling.)
  // That behavior was removed to keep the ChatInput always visible.

  useEffect(() => {
    // Use refs for mutable objects so closures see latest
    const wsRef = { current: socket } as { current: WebSocket | null };
    const reconnectAttemptsRef = { current: 0 } as { current: number };
    let reconnectTimer: number | null = null;

    const createWebSocket = () => {
      const url =
        (process.env.NEXT_PUBLIC_NODE_WS_HOST || "ws://localhost:3015") +
        "/chat";
      console.log("Attempting to connect to WebSocket at:", url);
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch (err) {
        console.error("Failed to create WebSocket:", err);
        // schedule reconnect
        reconnectAttemptsRef.current++;
        const baseDelay =
          1000 * Math.min(30, Math.pow(2, reconnectAttemptsRef.current));
        const jitter = Math.floor(Math.random() * 300);
        const delay = Math.min(30000, baseDelay) + jitter;
        console.log(
          `Retrying WebSocket create in ${delay}ms (attempt ${reconnectAttemptsRef.current})`
        );
        if (reconnectTimer) window.clearTimeout(reconnectTimer);
        reconnectTimer = window.setTimeout(
          () => createWebSocket(),
          delay
        ) as unknown as number;
        return null as any;
      }
      wsRef.current = ws;
      setSocket(ws);

      ws.onopen = () => {
        console.log("WebSocket open", ws.url);
        reconnectAttemptsRef.current = 0;
        setIsSocketReady(true);
      };

      ws.onmessage = async (event) => {
        if (isStoppedRef.current) return;
        try {
          console.log("Received WebSocket message:", event.data);

          let data = event.data;
          if (data instanceof Blob) {
            data = await data.text();
          }

          let message;
          try {
            message = JSON.parse(data);
          } catch (e) {
            console.error("Failed to parse WebSocket message:", e);
            return;
          }

          if (!message) return;
          
          if (message.type === "done") {
             console.log("Received DONE signal");
             setIsWaitingForResponse(false);
             // Phase 6 � dispatch response time for ActiveModelBadge
             if (lastSendAtRef.current) {
               window.dispatchEvent(new CustomEvent("innomcp-response-time", {
                 detail: { ms: Date.now() - lastSendAtRef.current }
               }));
             }
             return;
          }
           
          // Strict null safety: Drop messages without sender (except potentially control messages if any?)
          // User requested strict check. backend sendSafe ensures sender exists.
          if (!message.sender) {
             console.warn("Ignored message missing sender:", message);
             return;
          }

          // Handle incoming streaming chunk (append as-is)
          if (message.type === "chunk" && message.text) {
            console.log("[Frontend] Received chunk response:", message.text);
            console.log("[Frontend] Chunk structuredContent:", message.structuredContent);
            // Stamp responseTime + timestamp on the first chunk only (= "TTFT").
            const sentAt = lastSendAtRef.current;
            const now = Date.now();
            const firstChunkResponseTime = sentAt ? now - sentAt : undefined;
            setMessages((prevMessages) => {
              const lastMsg = prevMessages[prevMessages.length - 1];
              // Phase C.01 fix: if the last AI message is a *progress* placeholder
              // (isProgress:true), append the real chunk as a NEW message instead
              // of concatenating � prevents "????????..." bleeding into the answer.
              if (
                prevMessages.length > 0 &&
                lastMsg.sender === "ai" &&
                !(lastMsg as any).isProgress
              ) {
                const updatedMessages = [...prevMessages];
                const last = updatedMessages[updatedMessages.length - 1];
                const newFullText = (last.fullText || last.text) + message.text;
                updatedMessages[updatedMessages.length - 1] = {
                  ...last,
                  fullText: newFullText,
                  // preserve structuredContent if server sends it with this chunk
                  structuredContent: message.structuredContent ?? last.structuredContent,
                  isAnimating: true,
                };
                console.log("[Frontend] Updated last AI message with structuredContent:", updatedMessages[updatedMessages.length - 1].structuredContent);
                return updatedMessages;
              } else {
                return [
                  ...prevMessages,
                  {
                    sender: "ai",
                    text: "",
                    fullText: message.text,
                    structuredContent: message.structuredContent,
                    isAnimating: true,
                    timestamp: now,
                    responseTime: firstChunkResponseTime,
                  },
                ];
              }
            });
            // keep isWaitingForResponse=true until final history-update arrives
          }
          // Handle progress indicator
          else if (message.type === "progress") {
            console.log("[Frontend] Progress update:", message.text, message.stage);
            setMessages((prevMessages) => {
              const lastMsg = prevMessages[prevMessages.length - 1];
              // ????? AI message ?????????????????????????? ??????????????
              if (lastMsg && lastMsg.sender === "ai" && !lastMsg.fullText) {
                const updatedMessages = [...prevMessages];
                updatedMessages[updatedMessages.length - 1] = {
                  ...lastMsg,
                  text: message.text,
                  isProgress: true,
                  progressStage: message.stage,
                  elapsedTime: message.elapsed
                };
                return updatedMessages;
              } else if (!lastMsg || lastMsg.sender !== "ai") {
                // ????? placeholder message ?????? progress
                return [
                  ...prevMessages,
                  {
                    sender: "ai",
                    text: message.text,
                    fullText: "",
                    isProgress: true,
                    progressStage: message.stage,
                    elapsedTime: message.elapsed
                  },
                ];
              }
              return prevMessages;
            });
          }
          // Handle history update from server
          else if (message.type === "history-update" && message.messages) {
            console.log(
              "[Frontend] Received history update with",
              message.messages.length,
              "messages"
            );
            console.log("[Frontend] History update messages:", message.messages);
            console.log("[Frontend] Tools used:", message.toolsUsed);
            // Preserve structuredContent and toolsUsed from previous messages if available
            // SANITIZE: Filter out nulls/undefined/missing sender
            const rawMessages = (message.messages ?? []).filter((m: any) => m && m.sender);
            
            const messagesWithContent = rawMessages.map((msg: any, idx: number) => {
              if (msg.sender === "ai" && !msg.structuredContent && message.structuredContent) {
                // If this is the last AI message and structuredContent is provided at the root level
                if (idx === rawMessages.length - 1) {
                  return { 
                    ...msg, 
                    structuredContent: message.structuredContent,
                    toolsUsed: message.toolsUsed || msg.toolsUsed 
                  };
                }
              }
              // Preserve toolsUsed if it exists in the message
              return msg.toolsUsed ? msg : { ...msg, toolsUsed: message.toolsUsed };
            });
            console.log("[Frontend] Messages with content:", messagesWithContent);
            setMessages(messagesWithContent);
            setIsWaitingForResponse(false);
          }
          // Handle regular text response
          else if (
            message.text &&
            message.type !== "mcp-status" &&
            message.type !== "mcp-context"
          ) {
            console.log("[Frontend] Received text response:", message.text);
            const sentAt = lastSendAtRef.current;
            const now = Date.now();
            const responseTime = sentAt ? now - sentAt : undefined;
            setMessages((prevMessages) => {
              if (
                  prevMessages.length > 0 &&
                  prevMessages[prevMessages.length - 1].sender === "ai"
                ) {
                const updatedMessages = [...prevMessages];
                const last = updatedMessages[updatedMessages.length - 1];
                const newFullText = (last.fullText || last.text) + message.text;
                updatedMessages[updatedMessages.length - 1] = {
                  ...last,
                  fullText: newFullText,
                  // attach structured content (chartSvg etc.) if present
                  structuredContent: message.structuredContent ?? last.structuredContent,
                  isAnimating: true,
                  timestamp: last.timestamp || now,
                  responseTime: last.responseTime || responseTime,
                };
                return updatedMessages;
              } else {
                return [
                  ...prevMessages,
                  {
                    sender: "ai",
                    text: "",
                    fullText: message.text,
                    structuredContent: message.structuredContent,
                    isAnimating: true,
                    timestamp: now,
                    responseTime,
                  },
                ];
              }
            });
            setIsWaitingForResponse(false);
          } else if (message.error) {
            console.error("[Frontend] Server error:", message.error);
            // Phase C.01 fix: insert a visible error bubble so the user doesn't
            // see an empty response � silent drops are worse than a clear message.
            setMessages((prev) => [
              ...prev,
              {
                sender: "ai" as const,
                text: `⚠️ ขออภัย ระบบพบปัญหา: ${String(message.error).slice(0, 200)}`,
                fullText: `⚠️ ขออภัย ระบบพบปัญหา: ${String(message.error).slice(0, 200)}`,
                isAnimating: false,
                timestamp: Date.now(),
              },
            ]);
            notify("ระบบพบข้อผิดพลาด กรุณาลองใหม่อีกครั้ง", "error");
            setIsWaitingForResponse(false);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
          setIsWaitingForResponse(false);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsSocketReady(false);
        setIsWaitingForResponse(false);
      };

      ws.onclose = (event) => {
        console.log("WebSocket closed", {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        setIsSocketReady(false);
        setIsWaitingForResponse(false);

        // schedule reconnect with exponential backoff + jitter
        reconnectAttemptsRef.current++;
        const baseDelay =
          1000 * Math.min(30, Math.pow(2, reconnectAttemptsRef.current));
        const jitter = Math.floor(Math.random() * 300);
        const delay = Math.min(30000, baseDelay) + jitter;
        console.log(
          `Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`
        );
        if (reconnectTimer) window.clearTimeout(reconnectTimer);
        reconnectTimer = window.setTimeout(() => {
          createWebSocket();
        }, delay) as unknown as number;
      };

      return ws;
    };

    // start initial connection
    createWebSocket();

    return () => {
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {}
      }
    };
  }, []);

  // Typewriter effect for AI messages (word by word)
  useEffect(() => {
    // Find the last animating AI message
    const lastIndex = messages.length - 1;
    if (lastIndex < 0) return;
    const lastMsg = messages[lastIndex];
    if (lastMsg.sender !== "ai" || !lastMsg.isAnimating) return;

    const fullText = lastMsg.fullText || "";
    const currentText = lastMsg.text || "";
    // Split by word
    const fullWords = fullText.split(/(\s+)/); // keep spaces
    const currentWords = currentText.split(/(\s+)/);
    if (currentWords.length >= fullWords.length) {
      // Animation done
      if (lastMsg.isAnimating) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[lastIndex] = {
            ...updated[lastIndex],
            text: fullText,
            isAnimating: false,
          };
          return updated;
        });
      }
      return;
    }
    // Animate next word
    animationTimeoutRef.current && clearTimeout(animationTimeoutRef.current);
    animationTimeoutRef.current = setTimeout(() => {
      setMessages((prev) => {
        const updated = [...prev];
        const msg = updated[lastIndex];
        const nextText = fullWords.slice(0, currentWords.length + 1).join("");
        updated[lastIndex] = {
          ...msg,
          text: nextText,
        };
        return updated;
      });
    }, 120); // 120ms per word
    // Cleanup on unmount
    return () => {
      if (animationTimeoutRef.current)
        clearTimeout(animationTimeoutRef.current);
    };
  }, [messages]);

  // MDES bridge: when SSE pipeline produces a final_answer, upgrade the last AI message
  // This connects the MDES enriched text to the main chat bubble.
  // Guard: skip if WS already delivered structured tool results (weather, chart, etc.)
  useEffect(() => {
    const activeMessageId = activeAgentStreamRequestRef.current;
    const mdesText = agentStreamState.finalText;
    if (!activeMessageId) return;
    if (agentStreamState.activeMessageId !== activeMessageId) return;
    if (!mdesText || mdesText.length < 30) return;
    if (agentStreamState.status !== "done") return;

    setMessages((prev) => {
      const lastAiIdx = prev.map((m, i) => ({ m, i }))
        .filter(({ m }) => m.sender === "ai" && !m.isProgress)
        .pop()?.i;
      if (lastAiIdx === undefined) return prev;
      const lastAi = prev[lastAiIdx];
      // Don't override weather pipeline or chart structured content
      if (
        lastAi.structuredContent?.weatherPipeline ||
        lastAi.structuredContent?.weatherPayload ||
        lastAi.structuredContent?.chartSvg
      ) return prev;
      // Monotonic: final text must not be shorter than what's already shown.
      // If WS already produced a longer answer, keep WS text � only annotate mdesEnhanced.
      const existing = String(lastAi.fullText || lastAi.text || "");
      const nextText = shouldUseMdesFinal(existing, mdesText, lastAi.isProgress)
        ? mdesText
        : existing;
      const updated = [...prev];
      updated[lastAiIdx] = {
        ...lastAi,
        text: nextText,
        fullText: nextText,
        isAnimating: false,
        mdesEnhanced: true,
        isComplete: true,
        elapsedMs: lastSendAtRef.current ? Date.now() - lastSendAtRef.current : undefined,
      };
      return updated;
    });
    activeAgentStreamRequestRef.current = null;

    // PAS-1: extract artifacts from final text
    if (mdesText && mdesText.length > 0) {
      const newArts = extractArtifacts(mdesText, activeMessageId ?? String(Date.now()));
      if (newArts.length > 0) {
        setArtifacts(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const deduplicated = newArts.filter(a => !existingIds.has(a.id));
          return deduplicated.length > 0 ? [...prev, ...deduplicated] : prev;
        });
      }
    }
  }, [agentStreamState.activeMessageId, agentStreamState.finalText, agentStreamState.status]);

  // MDES streaming preview: show concierge/critic answer while other agents still running.
  // Monotonic: only update if the new preview is strictly longer than what is shown,
  // so the bubble grows forward and never flips backwards mid-stream.
  useEffect(() => {
    const activeMessageId = activeAgentStreamRequestRef.current;
    if (!activeMessageId) return;
    if (agentStreamState.activeMessageId !== activeMessageId) return;
    if (agentStreamState.status !== "streaming") return;
    const deltas = agentStreamState.events.filter(
      (ev) => ev.type === "agent_delta" && (ev.publicSummary?.length ?? 0) > 30
    );
    const pick =
      deltas.find((ev) => ev.agentId === "stylist") ||
      deltas.find((ev) => ev.agentId === "concierge") ||
      deltas.find((ev) => ev.agentId === "critic");
    if (!pick?.publicSummary) return;

    const previewText = pick.publicSummary.replace(/\.\.\.$/, "") + " ?";
    setMessages((prev) => {
      const lastAiIdx = prev.map((m, i) => ({ m, i }))
        .filter(({ m }) => m.sender === "ai" && !m.isProgress)
        .pop()?.i;
      if (lastAiIdx === undefined) return prev;
      const last = prev[lastAiIdx];
      if (last.structuredContent?.weatherPipeline || last.structuredContent?.chartSvg) return prev;
      const existing = String(last.fullText || last.text || "");
      // Forward-only: skip if preview wouldn't extend the visible answer.
      // Strip trailing "?" before comparing so the cursor isn't counted as growth.
      const prevCore = existing.replace(/\s*?\s*$/, "");
      const nextCore = previewText.replace(/\s*?\s*$/, "");
      if (nextCore.length <= prevCore.length) return prev;
      const updated = [...prev];
      updated[lastAiIdx] = { ...last, text: previewText, fullText: previewText, isAnimating: false };
      return updated;
    });
  }, [agentStreamState.activeMessageId, agentStreamState.events, agentStreamState.status]);

  useEffect(() => {
    const activeMessageId = activeAgentStreamRequestRef.current;
    if (activeMessageId && agentStreamState.activeMessageId !== activeMessageId) return;
    if (
      agentStreamState.status === "error" ||
      (agentStreamState.status === "done" && !agentStreamState.finalText)
    ) {
      activeAgentStreamRequestRef.current = null;
    }
  }, [agentStreamState.activeMessageId, agentStreamState.finalText, agentStreamState.status]);

  useEffect(() => {
    const suggestions = agentStreamState.suggestions;
    if (!suggestions || suggestions.length === 0) return;
    setMessages((prev) => {
      const lastAiIdx = prev.map((m, i) => ({ m, i }))
        .filter(({ m }) => m.sender === "ai" && !m.isProgress)
        .pop()?.i;
      if (lastAiIdx === undefined) return prev;
      const updated = [...prev];
      updated[lastAiIdx] = { ...updated[lastAiIdx], followUpSuggestions: suggestions };
      return updated;
    });
  }, [agentStreamState.suggestions]);

  const sendMessage = async () => {
    // Phase 3 CSV � prepend any CSV attachment summary to the user text
    const effectiveInput = csvPrefixRef.current
      ? `${csvPrefixRef.current}\n${input}`
      : input;
    csvPrefixRef.current = "";

    if (
      socket &&
      isSocketReady && // Ensure WebSocket is ready
      effectiveInput.trim() !== "" &&
      !isWaitingForResponse
    ) {
      // include a unique messageId to allow server-side deduplication
      const messageId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      
      // ?? FIX: Send file attachment with message
      let fileData = null;
      if (selectedFile) {
        // Convert file to base64 for WebSocket transmission
        const reader = new FileReader();
        fileData = await new Promise((resolve) => {
          reader.onloadend = () => {
            resolve({
              name: selectedFile.name,
              type: selectedFile.type,
              size: selectedFile.size,
              data: reader.result // base64 string
            });
          };
          reader.readAsDataURL(selectedFile);
        });
      }
      
      const transportHistory = buildChatTransportHistory(
        messages as unknown as Array<Record<string, unknown>>,
        CHAT_HISTORY_CONTEXT_LIMIT
      );
      // Phase 10.68 � map ChatMode ? conductor params
      // providerMode overrides the default local/hybrid selection:
      //   "remote" ? always use MDES Cloud, "local" ? always use localhost
      const derivedMode =
        providerMode === "remote"
          ? chatMode === "multiagent" ? "hybrid" : "remote"
          : "local";
      const derivedReasoning = chatMode === "multiagent" ? "thinking" : "normal";
      const message = {
        text: effectiveInput,
        messages: transportHistory,
        messageId,
        file: fileData,
        preferredMode: derivedMode,
        toolHint: selectedToolType,
        reasoningMode: derivedReasoning,
        uiMode: selectedToolType // P0-9: send the selected mode for ALL modes (was officer-only)
      };

      // Phase C.06: stamp send time BEFORE socket.send so that if the first
      // chunk arrives synchronously (localhost sub-ms), sentAt is already set.
      lastSendAtRef.current = Date.now();
      console.log("[ChatMode]", chatMode, "→ mode:", derivedMode, "reasoning:", derivedReasoning);
      socket.send(JSON.stringify(message));
      // Phase 6 � notify RateLimitIndicator that a request was sent
      window.dispatchEvent(new CustomEvent("innomcp-request-sent"));
      // Phase 10.15: fire SSE channel for MultiAgentPanel
      resetAgentStream();
      activeAgentStreamRequestRef.current = messageId;
      sendAgentStream({
        message: effectiveInput,
        sessionId: activeSummaryId ?? undefined,
        projectId: activeProjectId,
        preferredMode: derivedMode,
        toolHint: selectedToolType,
        reasoningMode: derivedReasoning,
        clientMessageId: messageId,
      });
      
      // Add user message to UI (include file indicator)
      const userMessage: ChatMessage = {
        sender: "user",
        text: effectiveInput,
        ...(selectedFile && { 
          fileInfo: { 
            name: selectedFile.name, 
            type: selectedFile.type,
            url: selectedImage || undefined
          } 
        })
      };
      setMessages(prev => [...prev, userMessage]); // P0-2: functional update avoids stale-state race if backend responds before this commits

      // Jump to bottom when user sends message
      setTimeout(() => scrollToBottom(), 150);
      
      // Clear input and file selection
      setInput("");
      setSelectedFile(null);
      setSelectedImage(null);
      setIsStopped(false);
      isStoppedRef.current = false;
      // lastSendAtRef already stamped above (before socket.send) � do not re-stamp here.
      // Phase 10.61 � guarantee =1500 ms of working-indicator visibility.
      stickyWorkingUntilRef.current = Date.now() + 1500;
      setStickyWorkingTick((t) => t + 1);
      setTimeout(() => setStickyWorkingTick((t) => t + 1), 1500);
      setIsWaitingForResponse(true);
      setWorkspaceOpen(false);
      setPlanViewerOpen(false);
      setArtifactPanelOpen(false);
      setModelSettingsOpen(false);
      window.dispatchEvent(new CustomEvent("innomcp-close-transient-panels"));
    } else if (socket && !isSocketReady) {
      console.error(
        "WebSocket is not ready. Please wait for the connection to be established."
      );
    }
  };
  sendMessageRef.current = sendMessage;

  // PAS-5: Approval gate � call this to request user confirmation for risky actions
  const requestApproval = useCallback((req: Omit<ApprovalRequest, "id" | "requestedAt">): Promise<boolean> => {
    return new Promise((resolve) => {
      const id = `approval-${Date.now()}`;
      approvalCallbacks.current.set(id, resolve);
      setPendingApproval({ ...req, id, requestedAt: Date.now() });
    });
  }, []);

  const handleApprove = (id: string) => {
    approvalCallbacks.current.get(id)?.(true);
    approvalCallbacks.current.delete(id);
    setPendingApproval(null);
  };

  const handleDeny = (id: string) => {
    approvalCallbacks.current.get(id)?.(false);
    approvalCallbacks.current.delete(id);
    setPendingApproval(null);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      // Start upload progress tracking
      setIsUploading(true);
      setUploadFileName(file.name);
      setUploadFileSize(file.size);
      setUploadProgress(0);
      
      // Check file size
      if (file.size > maxFileSize) {
        notify(`ไฟล์ใหญ่เกินไป — ขนาดสูงสุด ${maxFileSize / (1024 * 1024)} MB`, "error", 5000);
        setIsUploading(false);
        return;
      }
      
      // Simulate upload progress (in real app, use XMLHttpRequest with progress events)
      const simulateUpload = () => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += 10;
          setUploadProgress(progress);
          
          if (progress >= 100) {
            clearInterval(interval);
            // Complete upload after 2 seconds
            setTimeout(() => {
              setIsUploading(false);
              setSelectedFile(file);
              if (file.type.startsWith("image/")) {
                const imageUrl = URL.createObjectURL(file);
                setSelectedImage(imageUrl);
              } else {
                setSelectedImage(null);
              }
            }, 2000);
          }
        }, 200);
      };
      
      simulateUpload();
    }
  };

  // ?? unused drag/drop handler

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setSelectedFile(null);
  };

  const handleNewChat = () => {
    // Stop any ongoing request (same as handleStop)
    activeAgentStreamRequestRef.current = null;
    resetAgentStream();
    setIsWaitingForResponse(false);
    setIsStopped(true);
    isStoppedRef.current = true;
    
    // If there is an active conversation, save a compact summary before clearing
    if (messages && messages.length > 0) {
      const makeTitle = (msgs: ChatMessage[]) => {
        // Prefer the first user message, else first AI message, else fallback to timestamp
        const firstUser = msgs.find(
          (m) => m.sender === "user" && m.text?.trim()
        );
        const firstAI = msgs.find(
          (m) => m.sender === "ai" && (m.fullText || m.text)
        );
        const raw =
          (firstUser && firstUser.text) ||
          (firstAI && (firstAI.fullText || firstAI.text)) ||
          "การแชท";
        // single-line, limit length
        const single = raw.replace(/\s+/g, " ").trim();
        return single.length > 40 ? single.slice(0, 37) + "..." : single;
      };

      const summary: SidebarSummary = {
        id: String(Date.now()),
        time: Date.now(),
        title: makeTitle(messages),
        messages: compactChatMessagesForStorage(
          messages as unknown as Array<Record<string, unknown>>,
          12,
          { stripStructuredContent: false }
        ) as unknown as SidebarSummary["messages"],
      };

      // prepend and keep max 10
      setChatSummaries((prev) => {
        const updated = [
          summary,
          ...prev.filter((s) => s.title !== summary.title),
        ];
        return updated.slice(0, 10);
      });
    }

    setMessages([]);
    localStorage.removeItem("chatMessages");
    setInput("");
    setSelectedImage(null);
    setSelectedFile(null);
    setActiveSummaryId(null);
    console.log("Started new chat, history cleared (and summary saved)");

    if (shouldForceCollapsedSidebar()) {
      setIsSidebarCollapsed(true);
    }

    // Focus the input so user can type immediately after clearing
    setTimeout(() => {
      try {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      } catch (e) {
        // ignore
      }
    }, 0);
  };

  const loadSummary = (summary: SidebarSummary) => {
    activeAgentStreamRequestRef.current = null;
    resetAgentStream();
    setMessages(summary.messages || []);
    setActiveSummaryId(summary.id);
    // persist messages to storage as current active
    persistMessagesToLocalStorage((summary.messages || []) as unknown as ChatMessage[]);

    if (shouldForceCollapsedSidebar()) {
      setIsSidebarCollapsed(true);
    }
  };

  // TODO #45: Handle chat rename
  const handleRename = (id: string, newTitle: string) => {
    const updated = chatSummaries.map((s) =>
      s.id === id ? { ...s, title: newTitle } : s
    );
    setChatSummaries(updated);
    // No need to call saveSummariesToStorage - useEffect handles this

    // If renaming active chat, update localStorage metadata
    if (id === activeSummaryId) {
      try {
        localStorage.setItem("chatTitle", newTitle);
      } catch (e) {
        // ignore
      }
    }
  };

  // Phase 10.21: delete a chat from history. If the deleted chat is the
  // currently-active one, clear the canvas (the auto-save effect will then
  // not re-create the summary because messages is empty).
  const handleDeleteSummary = (id: string) => {
    setChatSummaries((prev) => prev.filter((s) => s.id !== id));
    if (id === activeSummaryId) {
      activeAgentStreamRequestRef.current = null;
      resetAgentStream();
      setMessages([]);
      setActiveSummaryId(null);
      try {
        localStorage.removeItem("chatTitle");
      } catch {}
    }
  };

  const handleStop = () => {
    // P1-1: emit cancel frame to backend before clearing local state
    const cancelId = activeAgentStreamRequestRef.current;
    if (socket && socket.readyState === WebSocket.OPEN && cancelId) {
      socket.send(JSON.stringify({ type: "cancel", messageId: cancelId }));
    }
    activeAgentStreamRequestRef.current = null;
    resetAgentStream();
    setIsWaitingForResponse(false);
    setIsStopped(true);
    isStoppedRef.current = true;
    setMessages((prev) => {
      if (
        prev.length > 0 &&
        prev[prev.length - 1].sender === "ai" &&
        prev[prev.length - 1].isAnimating
      ) {
        return prev.slice(0, -1);
      }
      return prev;
    });
  };

  const adjustTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    if (typeof window === "undefined") return;
    const computed = window.getComputedStyle(el);
    const lineHeight = parseFloat(computed.lineHeight) || 20;
    const paddingTop = parseFloat(computed.paddingTop) || 0;
    const paddingBottom = parseFloat(computed.paddingBottom) || 0;
    const maxHeight = lineHeight * 12 + paddingTop + paddingBottom;
    const newHeight = Math.min(el.scrollHeight, maxHeight);

    el.style.height = `${newHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  };

  // Focus and select the textarea when the page mounts (mounted flag set)
  useEffect(() => {
    if (mounted && textareaRef.current) {
      try {
        textareaRef.current.focus();
        textareaRef.current.select();
      } catch (e) {
        // ignore focus errors
      }
    }
  }, [mounted]);

  const updateMessage = (idx: number, msg: MessageType) => {
    setMessages((prev) => {
      const updated = [...prev];
      updated[idx] = msg;
      return updated;
    });
  };

  // TODO #41: Handle retry/regenerate request
  const handleRetry = (idx: number) => {
    if (!socket || !isSocketReady || isWaitingForResponse) {
      console.warn("Cannot retry: socket not ready or already waiting");
      return;
    }

    // Find the previous user message
    let userMessageIdx = idx - 1;
    while (userMessageIdx >= 0 && messages[userMessageIdx].sender !== "user") {
      userMessageIdx--;
    }

    if (userMessageIdx < 0 || !messages[userMessageIdx]) {
      console.error("Cannot find previous user message to retry");
      return;
    }

    const userMessage = messages[userMessageIdx];
    
    // Remove the AI response we're retrying
    setMessages((prev) => prev.slice(0, idx));
    
    // Resend the user message with conversation history
    const messageId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const transportHistory = buildChatTransportHistory(
      messages as unknown as Array<Record<string, unknown>>,
      CHAT_HISTORY_CONTEXT_LIMIT
    );
    const retryDerivedMode =
      providerMode === "remote"
        ? chatMode === "multiagent" ? "hybrid" : "remote"
        : "local";
    const message = {
      text: userMessage.text,
      messages: transportHistory.slice(0, Math.max(0, transportHistory.length - 1)),
      messageId,
      // P1-2: carry file/attachment from original user message (matches send path)
      file: (userMessage as any).fileInfo ?? null,
      preferredMode: retryDerivedMode,
      toolHint: selectedToolType,
      reasoningMode: chatMode === "multiagent" ? "thinking" : "normal",
      uiMode: selectedToolType // P0-9: send the selected mode for ALL modes (retry path)
    };

    socket.send(JSON.stringify(message));
    resetAgentStream();
    activeAgentStreamRequestRef.current = messageId;
    sendAgentStream({
      message: userMessage.text,
      sessionId: activeSummaryId ?? undefined,
      preferredMode: retryDerivedMode,
      toolHint: selectedToolType,
      reasoningMode: chatMode === "multiagent" ? "thinking" : "normal",
      clientMessageId: messageId,
    });
    setIsStopped(false);
    isStoppedRef.current = false;
    setIsWaitingForResponse(true);
  };

  // Typing UI is handled inside MessageView

  // Phase 10.15: Ctrl+O toggle for MultiAgentPanel
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "o") {
        e.preventDefault();
        setExpandAll((v) => !v);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Phase 10.21: power-user hotkeys.
  //   Ctrl/Cmd + K ? start new chat (matches Slack/Linear pattern)
  //   Ctrl/Cmd + /  ? focus the composer textarea
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      if (e.key === "/") {
        // Always allow � power users hit it from anywhere to jump back.
        e.preventDefault();
        const el = textareaRef.current;
        if (el) {
          el.focus();
          // Scroll into view for very long pages.
          el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // handleNewChat is a stable callback for this component; intentional empty deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase 3 iter 1 � global navigation shortcuts: Ctrl+D, Ctrl+P, Ctrl+H
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl || e.shiftKey) return;
      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      switch (e.key.toLowerCase()) {
        case 'd': e.preventDefault(); router.push('/dashboard'); break;
        case 'p': e.preventDefault(); router.push('/projects'); break;
        case 'h': e.preventDefault(); router.push('/task-history'); break;
        case 'k': e.preventDefault(); setCmdPaletteOpen(true); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [router]);

  // Phase 6 � open keyboard shortcuts panel via custom event (from ChatSidebar ? button / Ctrl+/)
  useEffect(() => {
    const handler = () => setShortcutsOpen(true);
    window.addEventListener("innomcp-open-shortcuts", handler);
    return () => window.removeEventListener("innomcp-open-shortcuts", handler);
  }, [setShortcutsOpen]);

  // Phase 5 � Prompt Templates: listen for template selections from ChatSidebar library panel
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const prompt = e.detail?.prompt;
      if (prompt) {
        setInput(prompt);
        // Focus the textarea so the user can review/send immediately
        setTimeout(() => {
          try {
            textareaRef.current?.focus();
          } catch {
            // ignore focus errors
          }
        }, 50);
      }
    };
    window.addEventListener("innomcp-use-template", handler as EventListener);
    return () => window.removeEventListener("innomcp-use-template", handler as EventListener);
  }, []);


  // Hydration guard: prevent SSR/client mismatch when localStorage has messages
  if (!mounted) {
    return (
      <div className="chat-workspace-bg flex min-h-[calc(100vh-6rem)] items-center justify-center px-6">
        <div className="chat-elevated-panel max-w-md rounded-2xl px-6 py-6 text-center">
          <div className="font-display text-2xl text-foreground">กำลังเปิดพื้นที่สนทนา</div>
          <div className="mt-2 text-sm leading-6 text-muted-foreground">
            โหลดประวัติการสนทนา โมเดลที่เลือก และสถานะเครื่องมือก่อนเริ่มงาน
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex">
      <div className="pointer-events-none fixed inset-0 chat-workspace-bg" />

      <KeyboardShortcutsPanel open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Slash command menu — appears when user types "/" */}
      <SlashCommandMenu
        visible={slashMenuVisible && input === "/"}
        query=""
        onSelect={(cmd) => { cmd.action(setInput); setSlashMenuVisible(false); setInput(""); }}
        onClose={() => setSlashMenuVisible(false)}
      />

      {/* MDES stream indicator — floating bottom-center when AI is working */}
      <FloatingStatusBadge
        status={isWaitingForResponse ? "thinking" : agentStreamState.status === "done" ? "done" : "idle"}
      />

      {/* Provider Management — openclaude-style model settings panel */}
      {modelSettingsOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[460px] border-l border-border/60 bg-background/98 shadow-2xl backdrop-blur-sm overflow-y-auto manus-panel-enter">
          <ErrorBoundary componentName="ModelSettingsPanel">
            <ModelSettingsPanel onClose={() => setModelSettingsOpen(false)} />
          </ErrorBoundary>
        </div>
      )}

      {/* INNOMCP Manus Workspace — persistent right-side panel */}
      {workspaceOpen && (
        <ErrorBoundary componentName="ManusWorkspacePanel">
          <ManusWorkspacePanel
            events={agentStreamState.events}
            artifacts={artifacts}
            isStreaming={isWaitingForResponse}
            isOpen={workspaceOpen}
            onClose={() => setWorkspaceOpen(false)}
            className="fixed inset-y-0 right-0 z-40 w-full sm:w-[380px] manus-panel-enter"
          />
        </ErrorBoundary>
      )}

      {/* PAS-1: Artifact Panel � floats below agent workspace panel */}
      {artifactPanelOpen && (
        <div className="fixed inset-x-2 top-[calc(50vh+0.5rem)] z-40 max-h-[40vh] overflow-y-auto rounded-xl border border-border/50 bg-background/95 shadow-xl backdrop-blur-sm p-3 sm:inset-x-auto sm:right-4 sm:top-[calc(20rem+1rem)] sm:w-80 sm:max-h-[calc(100vh-22rem)]">
          <ErrorBoundary componentName="ArtifactPanel">
            <ArtifactPanel
              artifacts={artifacts}
              onClose={() => setArtifactPanelOpen(false)}
            />
          </ErrorBoundary>
        </div>
      )}

      {/* PAS-2: Plan Viewer � vertical phase timeline, floats right side */}
      {planViewerOpen && (
        <div className="fixed inset-x-2 top-16 z-[39] max-h-[40vh] overflow-y-auto sm:inset-x-auto sm:right-[calc(1rem+20rem+0.5rem)] sm:top-20 sm:w-72 sm:max-h-[calc(100vh-6rem)]">
          <div className="rounded-xl border border-border/60 bg-background/95 p-3 shadow-sm backdrop-blur">
            <ErrorBoundary componentName="PlanViewer">
              <PlanViewer
                plan={buildPlanFromEvents(agentStreamState.events, agentStreamState.activeMessageId ?? "")}
                onClose={() => setPlanViewerOpen(false)}
              />
            </ErrorBoundary>
          </div>
        </div>
      )}

      {/* Floating "?" button � power-users discover Ctrl+K, Ctrl+/, etc. */}
      <button
        onClick={() => setShortcutsOpen(true)}
        data-testid="open-shortcuts-btn"
        className="fixed bottom-4 right-4 z-40 hidden h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/95 text-muted-foreground shadow-md transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-foreground lg:flex"
        aria-label="ดูคีย์ลัด (กด ? เพื่อเปิด)"
        title="คีย์ลัด — กด ?"
      >
        <span className="font-mono text-sm font-semibold">?</span>
      </button>

      {!isSidebarCollapsed && (
        <button
          className="fixed inset-0 z-[54] bg-black/20 lg:hidden"
          aria-label="ปิด sidebar"
          onClick={() => setIsSidebarCollapsed(true)}
        />
      )}

      <button
        className={`group fixed left-4 top-[6.75rem] z-[60] flex h-11 items-center gap-2 rounded-xl border border-border/70 bg-background/92 px-2.5 shadow-lg transition-all duration-300 hover:border-primary/30 hover:bg-primary/8 lg:hidden ${
          isSidebarCollapsed ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsSidebarCollapsed(false)}
        aria-label="เปิดเมนูประวัติการสนทนา"
        data-testid="open-sidebar-btn"
      >
        <svg className="h-5 w-5 text-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12h18M3 6h18M3 18h12" />
        </svg>
        {chatSummaries.length > 0 && (
          <span
            data-testid="sidebar-unread-count"
            className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/12 px-1.5 font-mono text-[11px] font-semibold text-primary"
            title={`${chatSummaries.length} บทสนทนาในประวัติ`}
          >
            {chatSummaries.length > 99 ? "99+" : chatSummaries.length}
          </span>
        )}
      </button>

      {/* Sidebar - stays above chat content but below nav */}
      <div className={`fixed left-0 top-16 bottom-0 z-[60] transition-all duration-300 ${
        isSidebarCollapsed
          ? '-translate-x-full lg:translate-x-0 lg:w-14'
          : 'translate-x-0 w-[min(20rem,85vw)] lg:w-72'
      }`}>
        <ChatSidebar
          summaries={chatSummaries}
          activeId={activeSummaryId}
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed((v) => !v)}
          onLoad={loadSummary}
          onNewChat={handleNewChat}
          onRename={handleRename}
          onDelete={handleDeleteSummary}
          theme={theme}
          motherActive={chatMode === "multiagent"}
          chatMode={chatMode}
          onChatModeChange={setChatMode}
          selectedToolType={selectedToolType}
          onToolTypeChange={setSelectedToolType}
          providerMode={providerMode}
          onProviderModeChange={setProviderMode}
        />
      </div>

      {/* Main content area — natural page flow, no inner scroll */}
      <div className={`relative flex-1 transition-all duration-300 ${
        isSidebarCollapsed ? 'ml-0 lg:ml-14' : 'ml-0 lg:ml-72'
      }`}>
        {/* MDES Brand Header — Manus.ai-style sticky top bar */}
        <MDESBrandHeader
          isSocketReady={isSocketReady}
          isWaitingForResponse={isWaitingForResponse}
          streamStatus={agentStreamState.status}
          agentCount={agentStreamState.events.filter(e => e.agentId && e.agentId !== "conductor" && e.agentId !== "broker").length > 0
            ? new Set(agentStreamState.events.filter(e => e.agentId && e.agentId !== "conductor" && e.agentId !== "broker").map(e => e.agentId!)).size
            : undefined}
          providerMode={providerMode}
          onProviderModeChange={setProviderMode}
          onToggleWorkspace={() => setWorkspaceOpen(v => !v)}
          workspaceOpen={workspaceOpen}
          onToggleMultiAgent={() => setMultiAgentOpen(v => !v)}
          onToggleModelSettings={() => setModelSettingsOpen(v => !v)}
          modelSettingsOpen={modelSettingsOpen}
          conversationTitle={hasMessages ? activeConversationTitle : undefined}
        />
        <div className="relative z-10 w-full px-3 sm:px-5 lg:px-6 xl:px-8">
          <div className={`mx-auto w-full max-w-[88rem] pt-3 ${hasMessages ? 'pb-3' : 'pb-6'}`}>
            {hasMessages ? (
              <div className="mb-3 flex items-center gap-2 px-1">
                <h1 className="font-display min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground sm:text-base">
                  {activeConversationTitle}
                </h1>
                <StatusRibbon
                  isSocketReady={isSocketReady}
                  isWaitingForResponse={isWaitingForResponse}
                  streamStatus={agentStreamState.status}
                />
                <span
                  className="hidden shrink-0 items-center gap-2 text-xs text-muted-foreground sr-only"
                  title={workspaceState.detail}
                >
                  <span>{activeToolMeta.label}</span>
                  <span aria-hidden="true">·</span>
                  <span>{chatSummaries.length} บทสนทนา</span>
                  <span aria-hidden="true">·</span>
                  <span>{workspaceState.title}</span>
                </span>
                {/* Phase 6 � Model Router status: active provider + last response latency */}
                <ActiveModelBadge />
                {artifacts.length > 0 && (
                  <button
                    onClick={() => setArtifactPanelOpen(v => !v)}
                    className="ml-1 shrink-0 inline-flex items-center gap-1 rounded-md border border-border/50 bg-background/80 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                    title="เปิด/ปิด Artifact Panel"
                  >
                    <span>📄</span>
                    <span>Artifacts ({artifacts.length})</span>
                  </button>
                )}
                {agentStreamState.events.length > 0 && (
                  <button
                    onClick={() => setPlanViewerOpen(p => !p)}
                    className="ml-1 shrink-0 inline-flex items-center gap-1 rounded-md border border-border/50 bg-background/80 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                    title="เปิด/ปิด Plan Viewer"
                  >
                    <span>📋</span>
                    <span>Plan</span>
                  </button>
                )}
              </div>
            ) : null}

            {!hasMessages && !isWaitingForResponse ? (
              <div className="flex min-h-0 flex-1 flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(16rem,1fr)] lg:items-start">
                <section className="flex flex-col gap-4">
                  {/* Manus-style: hero handled by ChatEmptyStateManager below */}
                  <div className="relative hidden">
                    <div aria-hidden="true" />
                    <div className="relative flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-emerald-500/15 via-primary/15 to-sky-500/15 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-primary/85">
                        <span aria-hidden="true">✨</span>
                        การสนทนาใหม่
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11.5px] font-medium text-muted-foreground">
                        <span className={`h-1.5 w-1.5 rounded-full ${workspaceState.dot}`} aria-hidden="true" />
                        {workspaceState.title}
                      </span>
                      <span className="text-[11.5px] text-muted-foreground/70">�</span>
                      <span className="text-[11.5px] text-muted-foreground">
                        {activeToolMeta.icon} {activeToolMeta.label}
                      </span>
                    </div>

                    <h1 className="font-display relative mt-3 max-w-3xl text-[1.65rem] font-semibold leading-tight text-foreground sm:text-[2rem]">
                      สวัสดี{" "}
                      <span className="bg-gradient-to-r from-emerald-500 via-primary to-sky-500 bg-clip-text text-transparent dark:from-emerald-300 dark:via-primary dark:to-sky-300">
                        ถาม วิเคราะห์ หรือสั่งงาน
                      </span>
                      {" "}เป็นภาษาไทยได้เลย
                    </h1>

                    <p className="relative mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
                      INNOMCP เลือกเครื่องมือที่เหมาะกับคำถามให้อัตโนมัติ — อากาศ TMD/NWP, สถิติ World Bank,
                      ภาพ AI, สร้างเอกสาร PDF/DOCX, ค่าเงิน, ข่าว RSS และอีกหลายแหล่ง
                    </p>

                    {/* Phase 10.54 � sales-grade trust strip: shows scale at a glance. */}
                    <div className="relative mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-mono font-semibold text-foreground/85 tabular-nums">56+</span>
                        <span>เครื่องมือ MCP</span>
                      </span>
                      <span className="h-3 w-px bg-border/60" aria-hidden="true" />
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-mono font-semibold text-foreground/85 tabular-nums">3</span>
                        <span>โหมด AI (local / cloud / hybrid)</span>
                      </span>
                      <span className="h-3 w-px bg-border/60" aria-hidden="true" />
                      <span className="inline-flex items-center gap-1.5">
                        <span aria-hidden="true">⚡</span>
                        <span>MDES multi-agent</span>
                      </span>
                      <span className="h-3 w-px bg-border/60" aria-hidden="true" />
                      <span className="inline-flex items-center gap-1.5">
                        <span aria-hidden="true">🇹🇭</span>
                        <span>ภาษาไทยเป็นหลัก</span>
                      </span>
                    </div>
                  </div>

                  {!isSocketReady && (
                    <div
                      className="flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-[13px] text-amber-800 ring-1 ring-amber-500/20 dark:text-amber-200 dark:ring-amber-400/20"
                      role="status"
                    >
                      <span className="relative inline-flex h-3 w-3 shrink-0 items-center justify-center" aria-hidden="true">
                        <span className="absolute inline-flex h-3 w-3 animate-radar-ping rounded-full bg-amber-500/70" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                      </span>
                      <span>กำลังเชื่อมต่อระบบ AI — เมื่อพร้อมแล้วช่องส่งข้อความจะเปิดให้ใช้</span>
                    </div>
                  )}

                  <TypingIndicator typingUsers={typingUsers} />
                  <ChatInput
                    input={input}
                    setInput={setInput}
                    selectedImage={selectedImage}
                    setSelectedImage={setSelectedImage}
                    selectedFile={selectedFile}
                    setSelectedFile={setSelectedFile}
                    handleNewChat={handleNewChat}
                    handleFileUpload={handleFileUpload}
                    handleRemoveImage={handleRemoveImage}
                    sendMessage={sendMessage}
                    handleStop={handleStop}
                    isSocketReady={isSocketReady}
                    isWaitingForResponse={isWaitingForResponse}
                    textareaRef={textareaRef}
                    fileInputRef={fileInputRef}
                    adjustTextarea={adjustTextarea}
                    theme={theme}
                    layoutMode="empty"
                    onFocus={() => setIsChatActive(true)}
                    onBlur={() => setIsChatActive(false)}
                    onAddArtifact={(a) => { setArtifacts(prev => [...prev, a]); }}
                    setCsvPrefix={(s) => { csvPrefixRef.current = s; }}
                  />

                  {/* Manus-style empty state manager — ChatWelcomeHero + QuickActions + StarterPromptsGrid */}
                  <ChatEmptyStateManager
                    isConnected={isSocketReady}
                    onQuerySelect={setInput}
                    textareaRef={textareaRef}
                    providerMode={providerMode}
                    hasMessages={hasMessages}
                  />

                  {/* Quick action cards � 2�2 grid */}
                  <div className="mt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        เริ่มต้นเร็ว
                      </h2>
                      <button
                        onClick={() => window.dispatchEvent(new CustomEvent("innomcp-open-panel", { detail: { panel: "library" } }))}
                        className="text-[11.5px] text-primary hover:underline"
                      >
                        📋 ดู Templates →
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
                      {QUICK_ACTIONS.map((action) => (
                        <button
                          key={action.label}
                          onClick={() => setInput(action.prompt)}
                          className="rounded-xl border border-border/40 bg-background/60 p-3.5 text-left hover:bg-muted/30 transition-all"
                        >
                          <span className="text-lg leading-none" aria-hidden="true">{action.icon}</span>
                          <span className="mt-1.5 block text-[12.5px] font-medium text-foreground">{action.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Right rail � single tips card; hidden on small (req 1: hide non-critical) */}
                <aside className="hidden lg:block">
                  <div className="rounded-xl border border-border/70 bg-card p-4">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      เคล็ดลับการใช้งาน
                    </h2>
                    <ul className="mt-3 space-y-2.5 text-[13.5px] leading-6 text-foreground/85">
                      {WORKSPACE_PILLARS.slice(0, 3).map((pillar, index) => (
                        <li key={pillar} className="flex gap-2.5">
                          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 font-mono text-[11px] font-semibold text-primary">
                            {index + 1}
                          </span>
                          <span className="min-w-0">{pillar}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-5 border-t border-border/60 pt-4">
                      <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        <span aria-hidden="true">🎨</span>
                        สั่งสร้างภาพให้ดี
                      </h2>
                      {/* Phase 10.55 � image prompt recipe as labeled rows
                          instead of bullet dots. Easier to scan and looks
                          like a checklist users can mentally tick off. */}
                      <ul className="mt-2.5 space-y-1.5 text-[12.5px] leading-5">
                        <li className="flex gap-2">
                          <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-wider text-primary/80">subject</span>
                          <span className="text-muted-foreground">คน · สัตว์ · สถานที่</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-wider text-primary/80">style</span>
                          <span className="text-muted-foreground">cinematic / watercolor / editorial</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-wider text-primary/80">scene</span>
                          <span className="text-muted-foreground">เช่น ทุ่งนาไทยตอนเย็น</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-wider text-primary/80">focus</span>
                          <span className="text-muted-foreground">สี · แสง · มุมกล้อง</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </aside>
              </div>
            ) : (
              /* Messages � natural document flow, no inner scroll container */
              <div ref={messagesRef} className="mx-auto max-w-[50rem] pb-36 pt-1">
                <div className="flex flex-col gap-4">
                  {(() => {
                    const visible = messages
                      .filter(Boolean)
                      .filter((m) => m.sender);
                    const lastAiIdx = (() => {
                      for (let i = visible.length - 1; i >= 0; i--) {
                        if (visible[i].sender === "ai") return i;
                      }
                      return -1;
                    })();
                    const showInlinePanel =
                      agentStreamState.status !== "idle" || agentStreamState.events.length > 0;
                    return visible.map((message, index) => {
                      const inlinePanel =
                        showInlinePanel && index === lastAiIdx ? (
                          <ErrorBoundary componentName="MultiAgentPanel">
                            <MultiAgentPanel
                              events={agentStreamState.events}
                              status={agentStreamState.status}
                              expandAll={expandAll}
                              onToggleExpandAll={() => setExpandAll((v) => !v)}
                              inline
                              defaultCollapsed
                            />
                          </ErrorBoundary>
                        ) : null;
                      return (
                        <MessageView
                          key={index}
                          message={message as MessageType}
                          index={index}
                          onUpdate={updateMessage}
                          onRetry={handleRetry}
                          onFollowUp={(text) => {
                            setInput(text);
                            setTimeout(() => sendMessageRef.current(), 50);
                          }}
                          inlineExtras={inlinePanel}
                        />
                      );
                    });
                  })()}
                  {/* When no AI message yet but SSE is already streaming, anchor a compact panel at bottom */}
                  {(agentStreamState.status !== "idle" || agentStreamState.events.length > 0) &&
                    !messages.some((m) => m.sender === "ai") && (
                      <ErrorBoundary componentName="MultiAgentPanel">
                        <MultiAgentPanel
                          events={agentStreamState.events}
                          status={agentStreamState.status}
                          expandAll={expandAll}
                          onToggleExpandAll={() => setExpandAll((v) => !v)}
                          inline
                          defaultCollapsed
                        />
                      </ErrorBoundary>
                    )}
                  {(isWaitingForResponse || isWorkingSticky) &&
                    (!messages.length ||
                      messages[messages.length - 1].sender !== "ai" ||
                      !messages[messages.length - 1].isAnimating ||
                      isWorkingSticky) && (() => {
                    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
                    const stage = lastMsg && (lastMsg as any).isProgress ? (lastMsg as any).progressStage as string : undefined;
                    const dotColor = stage === "processing"
                      ? "bg-amber-400 dark:bg-amber-400/80"
                      : stage === "thinking"
                      ? "bg-blue-400 dark:bg-blue-400/80"
                      : "bg-secondary dark:bg-secondary/80";

                    // Count distinct MDES agents currently active from SSE events
                    const mdesAgents = new Set<string>();
                    for (const ev of agentStreamState.events) {
                      if (ev.agentId && ev.agentId !== "conductor" && ev.agentId !== "broker") {
                        mdesAgents.add(ev.agentId);
                      }
                    }
                    const mdesCount = mdesAgents.size;
                    const isMdesStreaming = agentStreamState.status === "streaming";
                    const capabilityLine = isGuestMode
                      ? `Guest ${capabilityLevel}% · จำกัดบริบท/เครื่องมือ`
                      : `User ${capabilityLevel}% · เปิดความสามารถเต็ม`;
                    const mdesLine = isMdesStreaming && mdesCount >= 1
                      ? `⚡ MDES กำลังคิด... (${mdesCount} ตัวแทน)`
                      : "กำลังสรุปและจัดรูปคำตอบให้อ่านง่าย";

                    return (
                      <div
                        data-testid="working-indicator"
                        className="chat-elevated-panel relative max-w-sm overflow-hidden rounded-xl px-4 py-3 text-left animate-bubble-in"
                      >
                        {/* Top progress shimmer bar */}
                        <span
                          aria-hidden="true"
                          className="absolute inset-x-0 top-0 h-0.5 overflow-hidden"
                        >
                          <span
                            className={`block h-full bg-gradient-to-r from-transparent via-primary/60 to-transparent ${
                              isMdesStreaming ? "agent-shimmer-active" : ""
                            }`}
                            style={{ ['--agent-accent' as any]: 'oklch(0.65 0.18 265)' }}
                          />
                        </span>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                            ระบบกำลังทำงาน
                          </span>
                          {isMdesStreaming && mdesCount > 0 && (
                            <span
                              className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-700 dark:text-emerald-300"
                              title={`${mdesCount} MDES agents in flight`}
                            >
                              ⚡ {mdesCount}
                            </span>
                          )}
                        </div>
                        <div className="mt-2.5 flex items-center gap-3">
                          <span className="inline-flex items-center gap-1">
                            <span className={`h-2 w-2 rounded-full ${dotColor} animate-bounce [animation-delay:0s]`} />
                            <span className={`h-2 w-2 rounded-full ${dotColor} animate-bounce [animation-delay:120ms]`} />
                            <span className={`h-2 w-2 rounded-full ${dotColor} animate-bounce [animation-delay:240ms]`} />
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-[13.5px] text-foreground">{mdesLine}</div>
                            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{capabilityLine}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Sticky composer � viewport-sticky, single browser scrollbar */}
          {(hasMessages || isWaitingForResponse) && (
            <div className="sticky bottom-20 md:bottom-4 z-30 mx-auto mt-3 w-full max-w-[50rem] rounded-xl bg-background/96 pb-1 pt-1 backdrop-blur-sm">
              {/* Phase 10.34 � soft fade above the composer so messages don't
                  clip into the textarea on a hard line. Pointer-events-none
                  so the user can still click through near the edge. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -top-6 inset-x-0 h-6 bg-gradient-to-b from-transparent to-background/96"
              />
              {showScrollButton && (
                <button
                  onClick={scrollToBottom}
                  data-testid="scroll-to-bottom-btn"
                  className={`group absolute -top-12 right-2 z-10 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/95 px-3 py-2 text-card-foreground shadow-md transition-all hover:bg-primary/10 hover:border-primary/30 ${
                    isWaitingForResponse ? "animate-pulse-soft" : ""
                  }`}
                  title={
                    unreadCount > 0
                      ? `กลับไปด้านล่าง • ${unreadCount} ข้อความใหม่`
                      : "กลับไปด้านล่าง"
                  }
                  aria-label="Scroll to bottom"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14M19 12l-7 7-7-7" />
                  </svg>
                  {unreadCount > 0 && (
                    <span
                      data-testid="scroll-unread-badge"
                      className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground shadow-sm"
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                  {isWaitingForResponse && unreadCount === 0 && (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
                  )}
                </button>
              )}

              {!isSocketReady && (
                <div
                  data-testid="ws-not-ready-banner"
                  role="status"
                  className="mb-2 flex items-center justify-center gap-2 rounded-md bg-amber-500/10 px-3 py-1.5 text-center text-[12px] text-amber-800 ring-1 ring-amber-500/20 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-400/20"
                >
                  <span className="relative inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center" aria-hidden="true">
                    <span className="absolute inline-flex h-2.5 w-2.5 animate-radar-ping rounded-full bg-amber-500/70" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                  </span>
                  <span>กำลังเชื่อมต่อระบบ — รอสักครู่ก่อนส่งข้อความ</span>
                </div>
              )}

              <TypingIndicator typingUsers={typingUsers} />
              {/* Keep starter prompts in compact mode after conversation starts */}
              {messages.length > 0 && messages.length <= 4 && (
                <StarterPromptsGrid
                  onSelect={(query) => {
                    setInput(query);
                    textareaRef.current?.focus();
                  }}
                  textareaRef={textareaRef}
                  reduced
                />
              )}
              <ChatInput
                input={input}
                setInput={setInput}
                selectedImage={selectedImage}
                setSelectedImage={setSelectedImage}
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
                handleNewChat={handleNewChat}
                handleFileUpload={handleFileUpload}
                handleRemoveImage={handleRemoveImage}
                sendMessage={sendMessage}
                handleStop={handleStop}
                isSocketReady={isSocketReady}
                isWaitingForResponse={isWaitingForResponse}
                textareaRef={textareaRef}
                fileInputRef={fileInputRef}
                adjustTextarea={adjustTextarea}
                theme={theme}
                layoutMode="conversation"
                onFocus={() => setIsChatActive(true)}
                onBlur={() => setIsChatActive(false)}
                onAddArtifact={(a) => { setArtifacts(prev => [...prev, a]); }}
                setCsvPrefix={(s) => { csvPrefixRef.current = s; }}
              />
            </div>
          )}
          
          {/* File Upload Progress (TODO #40) */}
          {isUploading && (
            <FileUploadProgress
              uploadProgress={uploadProgress}
              fileSize={uploadFileSize}
              maxSize={maxFileSize}
              fileName={uploadFileName}
              onComplete={() => {
                setIsUploading(false);
                setUploadProgress(0);
              }}
            />
          )}
        </div>
      </div>

      {/* ThinkingModal � popup opens from ?thinkingMode=true or /living-chat redirect */}
      <ThinkingModal
        open={thinkingModalOpen}
        onClose={() => setThinkingModalOpen(false)}
      />

      {/* PAS-5: Approval Gate � intercepts risky tool actions for user confirmation */}
      <ApprovalGate
        request={pendingApproval}
        onApprove={handleApprove}
        onDeny={handleDeny}
      />

      {/* Command Palette � Ctrl+K opens quick navigation and task search */}
      <CommandPalette open={cmdPaletteOpen} onClose={() => setCmdPaletteOpen(false)} />

      {/* Phase 5 � first-time user onboarding modal */}
      <OnboardingModal
        open={showOnboarding}
        onClose={() => {
          try {
            localStorage.setItem("innomcp-onboarding-done", "true");
          } catch {
            // ignore
          }
          setShowOnboarding(false);
        }}
        onStartTour={() => setTourActive(true)}
      />

      {/* Phase 6 � guided tour overlay */}
      <GuidedTour active={tourActive} onComplete={() => setTourActive(false)} />
    </div>
  );
};

export default ChatPage;
