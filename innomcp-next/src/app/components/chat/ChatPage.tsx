"use client";

import React, { useState, useEffect, useRef, useContext } from "react";
import Image from "next/image";
import HeaderChat from "@/app/components/chat/HeaderChat";
import ChatMessage from "@/app/components/chat/ChatMessage";
import ThemeContext from "@/app/context/ThemeContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUp,
  faPlus,
  faCopy,
  faRefresh,
} from "@fortawesome/free-solid-svg-icons";

// Define the type for a chat message
interface ChatMessage {
  sender: "user" | "ai";
  text: string;
  // For AI messages, store the full text for animation
  fullText?: string;
  isAnimating?: boolean;
}

const ChatPage: React.FC = () => {
  const { theme } = useContext(ThemeContext) as { theme: string };
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // For typewriter effect
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // For editing AI message
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [input, setInput] = useState("");
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [isSocketReady, setIsSocketReady] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // Load messages from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem("chatMessages");
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        setMessages(parsedMessages);
      } catch (error) {
        console.error("Error loading messages from localStorage:", error);
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

  // Scroll chat to bottom when messages change
  useEffect(() => {
    const chatDiv = chatContainerRef.current;
    if (chatDiv) {
      chatDiv.scrollTop = chatDiv.scrollHeight;
    }
  }, [messages]);

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
            setMessages(message.messages);
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
      const message = { text: input, messages };
      console.log("Sending message to WebSocket:", message); // Debug log
      socket.send(JSON.stringify(message));
      setMessages([...messages, { sender: "user", text: input }]);
      setInput("");
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
    setMessages([]);
    localStorage.removeItem("chatMessages");
    setInput("");
    setSelectedImage(null);
    setSelectedFile(null);
    console.log("Started new chat, history cleared");
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

  useEffect(() => {
    // adjust when input changes (and on mount)
    adjustTextarea();
    // also adjust on window resize in case layout changes
    const handler = () => adjustTextarea();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [input]);

  // Add animation dots when waiting for AI response
  const DotsAnimation: React.FC = () => {
    const [dots, setDots] = useState(".");

    useEffect(() => {
      const interval = setInterval(() => {
        setDots((prev) => (prev.length < 3 ? prev + "." : "."));
      }, 300);
      return () => clearInterval(interval);
    }, []);

    return <span>{dots}</span>;
  };

  // Typing dots for AI balloon (three bouncing dots)
  const TypingDots: React.FC = () => {
    return (
      <span className="inline-flex items-center gap-1">
        <span
          className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500 animate-[bounce_0.45s_linear_infinite]"
          style={{ animationDelay: "0s" }}
        />
        <span
          className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500 animate-[bounce_0.45s_linear_infinite]"
          style={{ animationDelay: "0.08s" }}
        />
        <span
          className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500 animate-[bounce_0.45s_linear_infinite]"
          style={{ animationDelay: "0.16s" }}
        />
      </span>
    );
  };

  // Add debug logs to check WebSocket and waiting state
  useEffect(() => {
    console.log("isSocketReady:", isSocketReady);
    console.log("isWaitingForResponse:", isWaitingForResponse);
  }, [isSocketReady, isWaitingForResponse]);

  return (
    <div className="flex flex-col items-center overflow-hidden max-h-screen">
      <HeaderChat />
      <div className="flex flex-col flex-1 w-full items-center justify-start pt-8">
        <div className="w-full max-w-3xl bg-white/95 dark:bg-gray-900/95 rounded-2xl shadow-lg px-6 py-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-end w-full">
              <div
                className="text-sm"
                title={isSocketReady ? "เชื่อมต่อ" : "ตัดการเชื่อมต่อ"}
              >
                <span
                  className={
                    isSocketReady
                      ? "inline-block w-2.5 h-2.5 rounded-full bg-green-500 animate-[pulse_2s_ease-in-out_infinite]"
                      : "inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-[pulse_0.5s_ease-in-out_infinite]"
                  }
                />
              </div>
            </div>
            <div
              className="flex flex-col gap-2 overflow-y-auto max-h-96"
              ref={chatContainerRef}
            >
              {messages.map((message, index) => {
                const isAI = message.sender === "ai";
                const isEditing = editingIndex === index;
                return (
                  <div
                    key={index}
                    className={`relative group p-2 rounded-lg ${
                      message.sender === "user"
                        ? "max-w-xs self-start pr-5 bg-blue-500 text-white text-left rounded-bl-none"
                        : "max-w-full self-start pr-5 ml-6 mb-5 bg-gray-300 text-black text-left rounded-br-none"
                    }`}
                  >
                    {/* Show copy icon on hover for both user and AI messages */}
                    {!message.isAnimating && (
                      <div className="absolute top-1 right-0 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <button
                          title="คัดลอกข้อความ"
                          className={`pointer-events-auto cursor-pointer ${
                            message.sender === "user"
                              ? "text-white hover:text-black"
                              : "text-gray-500 hover:text-black"
                          }`}
                          onClick={() => {
                            navigator.clipboard.writeText(message.text);
                          }}
                        >
                          <FontAwesomeIcon icon={faCopy} />
                        </button>
                      </div>
                    )}
                    {/* AI message: editing mode */}
                    {isAI && isEditing ? (
                      <div>
                        <textarea
                          className="w-full rounded border border-gray-400 p-2 text-black bg-white mb-2"
                          value={editValue}
                          rows={Math.max(2, editValue.split("\n").length)}
                          onChange={(e) => setEditValue(e.target.value)}
                          autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            className="text-blue-600 hover:text-blue-800 cursor-pointer"
                            title="บันทึก"
                            onClick={() => {
                              setMessages((msgs) => {
                                const updated = [...msgs];
                                updated[index] = {
                                  ...updated[index],
                                  text: editValue,
                                  fullText: editValue,
                                  isAnimating: false,
                                };
                                return updated;
                              });
                              setEditingIndex(null);
                            }}
                          >
                            <FontAwesomeIcon icon={faCopy} />
                          </button>
                          <button
                            className="text-gray-500 hover:text-red-600 cursor-pointer"
                            title="ยกเลิก"
                            onClick={() => setEditingIndex(null)}
                          >
                            <FontAwesomeIcon icon={faCopy} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap wrap-break-word">
                        {isAI ? (
                          <ChatMessage html={message.text} />
                        ) : (
                          message.text
                        )}
                        {isAI && message.isAnimating && (
                          <span className="ml-2 inline-block align-middle text-gray-600">
                            <TypingDots />
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {/* When waiting for AI response (no message yet), show a typing balloon */}
              {isWaitingForResponse &&
                (!messages.length ||
                  messages[messages.length - 1].sender !== "ai" ||
                  !messages[messages.length - 1].isAnimating) && (
                  <div
                    className={`relative p-2 rounded-lg max-w-full self-start pr-5 ml-6 mb-5 bg-gray-300 text-black text-left rounded-br-none`}
                  >
                    <div className="whitespace-pre-wrap flex items-center">
                      <TypingDots />
                    </div>
                  </div>
                )}
            </div>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                adjustTextarea();
              }}
              rows={3}
              className="rounded-xl border border-gray-300 dark:border-gray-700 p-3 text-base bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white resize-none w-full focus:ring-0 focus:outline-none"
              placeholder="พิมพ์ข้อความที่นี่..."
            />
            {selectedImage && (
              <div className="relative w-fit mt-2">
                <Image
                  src={selectedImage}
                  alt="preview"
                  width={160}
                  height={96}
                  className="max-w-40 max-h-24 rounded-lg border object-contain"
                />
                <button
                  onClick={handleRemoveImage}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow hover:bg-red-600 cursor-pointer"
                  title="ลบรูป"
                >
                  &times;
                </button>
              </div>
            )}
            <div className="flex gap-4 mt-2 justify-between">
              <div className="flex gap-2">
                <button
                  onClick={handleNewChat}
                  className="bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-200 rounded-lg px-4 py-2 font-semibold shadow flex items-center gap-2 hover:bg-green-200 dark:hover:bg-green-800 transition-colors cursor-pointer"
                  title="เริ่มการแชทใหม่"
                >
                  <FontAwesomeIcon icon={faRefresh} />
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-200 rounded-lg px-4 py-2 font-semibold shadow flex items-center gap-2 hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors cursor-pointer"
                >
                  <FontAwesomeIcon icon={faPlus} />
                </button>
              </div>
              <button
                onClick={sendMessage}
                disabled={!isSocketReady || isWaitingForResponse}
                className={`bg-linear-to-r from-indigo-500 to-blue-400 text-white rounded-lg px-6 py-2 font-semibold shadow transition-colors cursor-pointer ${
                  !isSocketReady || isWaitingForResponse
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:from-blue-400 hover:to-indigo-500"
                }`}
              >
                {isSocketReady ? (
                  <FontAwesomeIcon icon={faArrowUp} className="font-bold" />
                ) : (
                  <span className="font-bold">
                    กำลังติดต่อ AI
                    <DotsAnimation />
                  </span>
                )}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
