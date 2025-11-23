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
import ThemeContext from "@/app/context/ThemeContext";
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

  const hasMessages = messages.length > 0;

  // Chat input is always visible; removed scroll-hide logic

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  // Load data from localStorage on mount
  useEffect(() => {
    setMounted(true);

    // Load sidebar collapsed state
    try {
      const savedCollapsed = localStorage.getItem("isSidebarCollapsed");
      if (savedCollapsed !== null) {
        setIsSidebarCollapsed(savedCollapsed === "true");
      }
    } catch (e) {
      // ignore localStorage errors
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
  }, []);

  // Save messages to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      // Limit to last 50 messages to prevent storage bloat
      const limitedMessages = messages.slice(-50);
      localStorage.setItem("chatMessages", JSON.stringify(limitedMessages));
    }
  }, [messages]);

  // Persist summaries when changed
  useEffect(() => {
    try {
      localStorage.setItem("chatSummaries", JSON.stringify(chatSummaries));
    } catch (err) {
      console.error("Error saving chat summaries:", err);
    }
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

  // Scroll the messages container to bottom when messages change
  useEffect(() => {
    if (messagesRef.current) {
      try {
        messagesRef.current.scrollTo({
          top: messagesRef.current.scrollHeight,
          behavior: "auto",
        });
      } catch (e) {
        // ignore
        messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
      }
    }
  }, [messages]);

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

          const message = JSON.parse(data);

          if (!data || Object.keys(message || {}).length === 0) {
            console.warn("Received empty message from WebSocket:", data);
            setIsWaitingForResponse(false);
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
          // Handle history update from server
          else if (message.type === "history-update" && message.messages) {
            console.log(
              "[Frontend] Received history update with",
              message.messages.length,
              "messages"
            );
            console.log("[Frontend] History update messages:", message.messages);
            // Preserve structuredContent from previous messages if available
            const messagesWithContent = message.messages.map((msg: any, idx: number) => {
              if (msg.sender === "ai" && !msg.structuredContent && message.structuredContent) {
                // If this is the last AI message and structuredContent is provided at the root level
                if (idx === message.messages.length - 1) {
                  return { ...msg, structuredContent: message.structuredContent };
                }
              }
              return msg;
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

  const sendMessage = () => {
    if (
      socket &&
      isSocketReady && // Ensure WebSocket is ready
      input.trim() !== "" &&
      !isWaitingForResponse
    ) {
      // include a unique messageId to allow server-side deduplication
      const messageId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const message = { text: input, messages, messageId };
      console.log("Sending message to WebSocket:", message); // Debug log
      socket.send(JSON.stringify(message));
      setMessages([...messages, { sender: "user", text: input }]);
      setInput("");
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
      setSelectedFile(file);
      if (file.type.startsWith("image/")) {
        const imageUrl = URL.createObjectURL(file);
        setSelectedImage(imageUrl);
      } else {
        setSelectedImage(null);
      }
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
        messages: messages.slice(-50),
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
    localStorage.setItem(
      "chatMessages",
      JSON.stringify(summary.messages || [])
    );
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

  // Typing UI is handled inside MessageView

  // Add debug logs to check WebSocket and waiting state
  useEffect(() => {
    console.log("isSocketReady:", isSocketReady);
    console.log("isWaitingForResponse:", isWaitingForResponse);
  }, [isSocketReady, isWaitingForResponse]);

  return (
    <div className="max-w-6xl items-center mx-auto px-6">
      <div
        className={`mx-auto w-2/3 ${hasMessages ? "pb-32" : "pb-6"}`}
        ref={messagesRef}
      >
        <div className="flex flex-col gap-2 pb-6">
          {messages.map((message, index) => (
            <MessageView
              key={index}
              message={message as MessageType}
              index={index}
              onUpdate={updateMessage}
            />
          ))}
          {/* When waiting for AI response (no message yet), show a typing balloon */}
          {isWaitingForResponse &&
            (!messages.length ||
              messages[messages.length - 1].sender !== "ai" ||
              !messages[messages.length - 1].isAnimating) && (
              <div
                className={`relative p-2 max-w-full self-start pr-5 mb-5 text-left`}
              >
                <span className="inline-flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500 animate-bounce"
                    style={{ animationDelay: "0s" }}
                  />
                  <span
                    className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500 animate-bounce"
                    style={{ animationDelay: "0.08s" }}
                  />
                  <span
                    className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500 animate-bounce"
                    style={{ animationDelay: "0.16s" }}
                  />
                </span>
              </div>
            )}
        </div>
      </div>

      <div
        className={`${
          hasMessages
            ? "fixed z-50 w-full mx-auto bottom-0 left-0 right-0 justify-center items-center flex"
            : "absolute z-50 w-full mx-auto top-0 bottom-0 left-0 right-0 justify-center items-center flex"
        }`}
      >
        <div className="w-full max-w-3xl mx-auto"
        >
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
          />
        </div>
      </div>
      <div className="absolute left-4 top-0 z-120">
        <ChatSidebar
          summaries={chatSummaries}
          activeId={activeSummaryId}
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed((v) => !v)}
          onLoad={loadSummary}
          theme={theme}
        />
      </div>
    </div>
  );
};

export default ChatPage;
