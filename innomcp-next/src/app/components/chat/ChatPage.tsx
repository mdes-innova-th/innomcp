"use client";

import React, { useState, useEffect, useRef, useContext } from "react";
import ChatMessage, {
  MessageView,
  Message as MessageType,
} from "@/app/components/chat/ChatMessage";
import ChatSidebar, {
  ChatSummary as SidebarSummary,
} from "@/app/components/chat/ChatSidebar";
import ChatInput from "./ChatInput";
import FileUploadProgress from "@/app/components/common/FileUploadProgress";
import ThemeContext from "@/app/context/ThemeContext";
import type { ToolType } from "./ToolsTypeSelector";
import {
  buildChatTransportHistory,
  compactChatMessagesForStorage,
  isQuotaExceededError,
} from "../../../utils/chatStorage";
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
}

const CHAT_HISTORY_STORAGE_PLANS = [
  { maxMessages: 20, stripStructuredContent: false },
  { maxMessages: 12, stripStructuredContent: false },
  { maxMessages: 10, stripStructuredContent: true },
  { maxMessages: 5, stripStructuredContent: true },
] as const;

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

const STARTER_PROMPTS = [
  {
    icon: "🌦️",
    title: "อากาศวันนี้",
    description: "ถามแบบได้คำตอบพร้อมใช้งาน เช่น พกอะไร เดินทางช่วงไหนดี ฝนจะตกไหม",
    query: "ช่วยสรุปอากาศกรุงเทพฯ วันนี้แบบอ่านเร็ว พร้อมคำแนะนำก่อนออกจากบ้าน",
    accent: "from-sky-500/16 via-sky-500/8 to-transparent",
  },
  {
    icon: "📚",
    title: "สรุปหลายแหล่งให้จบในครั้งเดียว",
    description: "รวมข้อมูลหลายเครื่องมือแล้วเรียบเรียงเป็นคำตอบภาษาไทยที่อ่านง่าย",
    query: "ช่วยสรุปสาระสำคัญของพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคลแบบเข้าใจง่ายและใช้ได้จริง",
    accent: "from-emerald-500/16 via-emerald-500/8 to-transparent",
  },
  {
    icon: "🎨",
    title: "สั่งสร้างภาพเป็นภาษาไทย",
    description: "พิมพ์ concept, style, บรรยากาศ และอารมณ์ภาพเป็นไทยได้เลย",
    query: "สร้างภาพนักบินอวกาศยืนกลางทุ่งนาไทยตอนพระอาทิตย์ตก โทนภาพ cinematic สมจริง",
    accent: "from-pink-500/16 via-pink-500/8 to-transparent",
  },
  {
    icon: "🧭",
    title: "วิเคราะห์ต่อจากโจทย์คลุมเครือ",
    description: "เริ่มต้นสั้น ๆ แล้วค่อยให้ระบบช่วยขยายโจทย์ คัด route และถามต่อเมื่อจำเป็น",
    query: "ช่วยวางแผนค้นหาข้อมูลจังหวัดที่เหมาะจะจัดงานสัมมนาช่วงหน้าฝน โดยดูทั้งอากาศและการเดินทาง",
    accent: "from-amber-500/16 via-amber-500/8 to-transparent",
  },
] as const;

const WORKSPACE_PILLARS = [
  "โฟลว์สนทนาที่วางภาษาไทยเป็นหลัก",
  "คำตอบที่รู้จักเลือกเครื่องมือให้เหมาะกับงาน",
  "รองรับทั้งข้อมูล ภาพ และงานต่อเนื่องในบทสนทนาเดียว",
] as const;

function shouldForceCollapsedSidebar(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 1279px)").matches;
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
      localStorage.setItem("chatMessages", JSON.stringify(compacted));
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

const ChatPage: React.FC = () => {
  const { theme } = useContext(ThemeContext) as { theme: string };
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
  const [isSocketReady, setIsSocketReady] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const isStoppedRef = useRef(false);
  
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
  const [, setIsChatActive] = useState(false); // tracks composer focus for future hooks
  const [selectedToolType, setSelectedToolType] = useState<ToolType>("auto");
  const activeToolMeta = TOOL_TYPE_META[selectedToolType] || TOOL_TYPE_META.auto;

  // Load data from localStorage on mount
  useEffect(() => {
    setMounted(true);

    // Load sidebar collapsed state
    try {
      const forceCollapsed = shouldForceCollapsedSidebar();
      const savedCollapsed = localStorage.getItem("isSidebarCollapsed");
      if (savedCollapsed !== null && !forceCollapsed) {
        setIsSidebarCollapsed(savedCollapsed === "true");
      } else {
        setIsSidebarCollapsed(forceCollapsed || savedCollapsed === "true");
      }
    } catch (e) {
      // ignore localStorage errors
      setIsSidebarCollapsed(shouldForceCollapsedSidebar());
    }

    const savedMessages = localStorage.getItem("chatMessages");
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        setMessages(parsedMessages);
      } catch (error) {
        console.error("Error loading messages from localStorage:", error);
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
          "isSidebarCollapsed",
          isSidebarCollapsed ? "true" : "false"
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
  };

  // (Previously: scroll detection and hiding input while scrolling.)
  // That behavior was removed to keep the ChatInput always visible.

  useEffect(() => {
    // Use refs for mutable objects so closures see latest
    const wsRef = { current: socket } as { current: WebSocket | null };
    const reconnectAttemptsRef = { current: 0 } as { current: number };
    let reconnectTimer: number | null = null;

    const createWebSocket = () => {
      const url =
        (process.env.NEXT_PUBLIC_NODE_WS_HOST || "ws://localhost:3011") +
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
              // ถ้ามี AI message อยู่แล้วแต่ยังไม่มีเนื้อหา แสดงว่ากำลังรอ
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
                // สร้าง placeholder message สำหรับ progress
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
                  },
                ];
              }
            });
            setIsWaitingForResponse(false);
          } else if (message.error) {
            console.log("[Frontend] Received error response:", message.error);
            console.error("Server error:", message.error);
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

  const sendMessage = async () => {
    if (
      socket &&
      isSocketReady && // Ensure WebSocket is ready
      input.trim() !== "" &&
      !isWaitingForResponse
    ) {
      // include a unique messageId to allow server-side deduplication
      const messageId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      
      // 🔧 FIX: Send file attachment with message
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
      const message = { 
        text: input, 
        messages: transportHistory, 
        messageId,
        file: fileData, // Include file data if available
        uiMode: selectedToolType === "officer" ? "officer" : undefined
      };
      
      console.log("Sending message to WebSocket:", {
        textLength: input.length,
        historySize: transportHistory.length,
        hasFile: Boolean(fileData),
        uiMode: message.uiMode || "auto",
      });
      socket.send(JSON.stringify(message));
      
      // Add user message to UI (include file indicator)
      const userMessage: ChatMessage = { 
        sender: "user", 
        text: input,
        ...(selectedFile && { 
          fileInfo: { 
            name: selectedFile.name, 
            type: selectedFile.type,
            url: selectedImage || undefined
          } 
        })
      };
      setMessages([...messages, userMessage]);
      
      // Jump to bottom when user sends message
      setTimeout(() => scrollToBottom(), 150);
      
      // Clear input and file selection
      setInput("");
      setSelectedFile(null);
      setSelectedImage(null);
      setIsStopped(false);
      isStoppedRef.current = false;
      setIsWaitingForResponse(true); // Prevent sending new messages until a response is received
    } else if (socket && !isSocketReady) {
      console.error(
        "WebSocket is not ready. Please wait for the connection to be established."
      );
    }
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
        alert(`ไฟล์ใหญ่เกินไป! ขนาดสูงสุด ${maxFileSize / (1024 * 1024)} MB`);
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

  // ลบ unused drag/drop handler

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setSelectedFile(null);
  };

  const handleNewChat = () => {
    // Stop any ongoing request (same as handleStop)
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

  const handleStop = () => {
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
    const message = { 
      text: userMessage.text, 
      messages: transportHistory.slice(0, Math.max(0, transportHistory.length - 1)),
      messageId 
    };
    
    console.log("Retrying message:", {
      textLength: userMessage.text.length,
      historySize: message.messages.length,
    });
    socket.send(JSON.stringify(message));
    setIsStopped(false);
    isStoppedRef.current = false;
    setIsWaitingForResponse(true);
  };

  // Typing UI is handled inside MessageView

  // Add debug logs to check WebSocket and waiting state
  useEffect(() => {
    console.log("isSocketReady:", isSocketReady);
    console.log("isWaitingForResponse:", isWaitingForResponse);
  }, [isSocketReady, isWaitingForResponse]);

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

      {!isSidebarCollapsed && (
        <button
          className="fixed inset-0 z-[54] bg-black/20 lg:hidden"
          aria-label="ปิด sidebar"
          onClick={() => setIsSidebarCollapsed(true)}
        />
      )}

      <button
        className={`fixed left-4 top-[6.75rem] z-[60] flex h-11 w-11 items-center justify-center rounded-xl border border-border/70 bg-background/92 shadow-lg transition-all duration-300 hover:border-primary/25 hover:bg-primary/8 lg:hidden ${
          isSidebarCollapsed ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsSidebarCollapsed(false)}
        aria-label="เปิด sidebar"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12h18M3 6h18M3 18h12" />
        </svg>
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
          theme={theme}
        />
      </div>

      {/* Main content area — natural page flow, no inner scroll */}
      <div className={`relative flex-1 transition-all duration-300 ${
        isSidebarCollapsed ? 'ml-0 lg:ml-14' : 'ml-0 lg:ml-72'
      }`}>
        <div className="relative z-10 w-full px-3 sm:px-5 lg:px-6 xl:px-8">
          <div className={`mx-auto w-full max-w-[88rem] pt-3 ${hasMessages ? 'pb-3' : 'pb-6'}`}>
            {hasMessages ? (
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={`inline-flex h-2 w-2 shrink-0 rounded-full ${workspaceState.dot}`} aria-hidden="true" />
                <h1 className="font-display min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground sm:text-base">
                  {activeConversationTitle}
                </h1>
                <span
                  className="hidden shrink-0 items-center gap-2 text-xs text-muted-foreground sm:inline-flex"
                  title={workspaceState.detail}
                >
                  <span>{activeToolMeta.label}</span>
                  <span aria-hidden="true">·</span>
                  <span>{chatSummaries.length} เซสชัน</span>
                  <span aria-hidden="true">·</span>
                  <span>{workspaceState.title}</span>
                </span>
              </div>
            ) : null}

            {!hasMessages && !isWaitingForResponse ? (
              <div className="flex min-h-0 flex-1 flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(16rem,1fr)] lg:items-start">
                <section className="flex flex-col gap-4">
                  {/* Hero — single statement, not two restating ones (req 2: reduce duplicated copy) */}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-primary/85">
                        การสนทนาใหม่
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11.5px] font-medium text-muted-foreground">
                        <span className={`h-1.5 w-1.5 rounded-full ${workspaceState.dot}`} aria-hidden="true" />
                        {workspaceState.title}
                      </span>
                      <span className="text-[11.5px] text-muted-foreground/70">·</span>
                      <span className="text-[11.5px] text-muted-foreground">
                        {activeToolMeta.icon} {activeToolMeta.label}
                      </span>
                    </div>

                    <h1 className="font-display mt-3 max-w-3xl text-[1.65rem] font-semibold leading-tight text-foreground sm:text-[2rem]">
                      สวัสดี ถาม วิเคราะห์ หรือสั่งงานเป็นภาษาไทยได้เลย
                    </h1>
                  </div>

                  {!isSocketReady && (
                    <div
                      className="rounded-md bg-rose-500/8 px-3 py-2 text-[13px] text-rose-800 ring-1 ring-rose-500/15 dark:text-rose-200"
                      role="status"
                    >
                      backend ยังไม่ตอบกลับ — การส่งข้อความจะพร้อมเมื่อ websocket เชื่อมต่อสำเร็จ
                    </div>
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
                    layoutMode="empty"
                    onToolTypeChange={(t) => setSelectedToolType(t)}
                    onFocus={() => setIsChatActive(true)}
                    onBlur={() => setIsChatActive(false)}
                  />

                  {/* Starter prompts — shorter copy + grid that adapts (req 9) */}
                  <div className="mt-1">
                    <div className="mb-2 flex items-center justify-between">
                      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        ตัวอย่างคำถาม
                      </h2>
                      <span className="text-[11.5px] text-muted-foreground">กดเพื่อใส่ใน input</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {STARTER_PROMPTS.map((prompt) => (
                        <button
                          key={prompt.query}
                          onClick={() => setInput(prompt.query)}
                          className="group flex min-w-0 items-start gap-2.5 rounded-md border border-border/70 bg-card p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/4"
                        >
                          <span className="text-lg leading-none" aria-hidden="true">
                            {prompt.icon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-semibold text-foreground transition-colors group-hover:text-primary">
                              {prompt.title}
                            </span>
                            <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-5 text-muted-foreground">
                              {prompt.query}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Right rail — single tips card; hidden on small (req 1: hide non-critical) */}
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
                      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        สั่งสร้างภาพให้ดี
                      </h2>
                      <ul className="mt-2.5 space-y-1.5 text-[12.5px] leading-5 text-muted-foreground">
                        <li>· subject — คน สัตว์ สถานที่</li>
                        <li>· style — cinematic / watercolor / editorial</li>
                        <li>· ฉาก — เช่น ทุ่งนาไทยตอนเย็น</li>
                        <li>· จุดเน้น — สี แสง มุมกล้อง</li>
                      </ul>
                    </div>
                  </div>
                </aside>
              </div>
            ) : (
              /* Messages — natural document flow, no inner scroll container */
              <div ref={messagesRef} className="mx-auto max-w-[50rem] pb-36 pt-1">
                <div className="flex flex-col gap-4">
                  {messages
                    .filter(Boolean)
                    .filter((m) => m.sender)
                    .map((message, index) => (
                      <MessageView
                        key={index}
                        message={message as MessageType}
                        index={index}
                        onUpdate={updateMessage}
                        onRetry={handleRetry}
                      />
                    ))}

                  {isWaitingForResponse &&
                    (!messages.length ||
                      messages[messages.length - 1].sender !== "ai" ||
                      !messages[messages.length - 1].isAnimating) && (() => {
                    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
                    const stage = lastMsg && (lastMsg as any).isProgress ? (lastMsg as any).progressStage as string : undefined;
                    const dotColor = stage === "processing"
                      ? "bg-amber-400 dark:bg-amber-400/80"
                      : stage === "thinking"
                      ? "bg-blue-400 dark:bg-blue-400/80"
                      : "bg-secondary dark:bg-secondary/80";

                    return (
                      <div className="chat-elevated-panel max-w-sm rounded-lg px-4 py-3 text-left">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">ระบบกำลังทำงาน</div>
                        <div className="mt-2 flex items-center gap-3">
                          <span className="inline-flex items-center gap-1">
                            <span className={`h-2 w-2 rounded-full ${dotColor} animate-bounce [animation-delay:0s]`} />
                            <span className={`h-2 w-2 rounded-full ${dotColor} animate-bounce [animation-delay:80ms]`} />
                            <span className={`h-2 w-2 rounded-full ${dotColor} animate-bounce [animation-delay:160ms]`} />
                          </span>
                          <div className="text-sm text-foreground">กำลังสรุปและจัดรูปคำตอบให้อ่านง่าย</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Sticky composer — viewport-sticky, single browser scrollbar */}
          {(hasMessages || isWaitingForResponse) && (
            <div className="sticky bottom-4 z-30 mx-auto mt-3 w-full max-w-[50rem] rounded-xl bg-background/96 pb-1 pt-1 shadow-[0_-1px_0_0_hsl(var(--border)/.25)] backdrop-blur-sm">
              {showScrollButton && (
                <button
                  onClick={scrollToBottom}
                  className="absolute -top-12 right-2 z-10 rounded-full border border-border/70 bg-background/92 p-2.5 text-card-foreground shadow-md transition-colors hover:bg-primary/8"
                  title="กลับไปด้านล่าง"
                  aria-label="Scroll to bottom"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 5v14M19 12l-7 7-7-7" />
                  </svg>
                </button>
              )}

              {!isSocketReady && (
                <div className="mb-2 rounded-md bg-rose-500/8 px-3 py-1.5 text-center text-xs text-rose-700 ring-1 ring-rose-500/15 dark:bg-rose-400/10 dark:text-rose-200 dark:ring-rose-400/18">
                  backend ยังไม่ตอบกลับ การส่งข้อความจะพร้อมเมื่อ websocket เชื่อมต่อสำเร็จ
                </div>
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
                onToolTypeChange={(t) => setSelectedToolType(t)}
                onFocus={() => setIsChatActive(true)}
                onBlur={() => setIsChatActive(false)}
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
    </div>
  );
};

export default ChatPage;
