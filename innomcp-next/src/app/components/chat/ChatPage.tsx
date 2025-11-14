"use client";

import React, { useState, useEffect, useRef, useContext } from "react";
import Image from "next/image";
import HeaderChat from "@/app/components/HeaderChat";
import ThemeContext from "@/app/context/ThemeContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUp, faPlus, faEdit, faCopy, faSave, faTimes } from "@fortawesome/free-solid-svg-icons";

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
  // Scroll chat to bottom when messages change
  useEffect(() => {
    const chatDiv = chatContainerRef.current;
    if (chatDiv) {
      chatDiv.scrollTop = chatDiv.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const ws = new WebSocket(
      (process.env.NEXT_PUBLIC_NODE_WS_HOST || "ws://localhost:3010") + "/chat"
    );

    ws.onopen = () => {
      console.log("WebSocket connection established with Node.js server");
      setIsSocketReady(true); // Set socket as ready
    };

    ws.onmessage = async (event) => {
      try {
        console.log("Received WebSocket message:", event.data);

        let data = event.data;

        // Check if the data is a Blob and convert it to text
        if (data instanceof Blob) {
          data = await data.text();
        }

        const message = JSON.parse(data);

        // Log when message is empty
        if (!data || Object.keys(data).length === 0) {
          console.warn("Received empty message from WebSocket:", data);
          setIsWaitingForResponse(false);
          return;
        }

        if (message.text) {
          setMessages((prevMessages) => {
            // ถ้า message ล่าสุดเป็น ai ให้รวมข้อความ (typewriter: update fullText, text)
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
                { sender: "ai", text: "", fullText: message.text, isAnimating: true },
              ];
            }
          });
          setIsWaitingForResponse(false);
        } else if (message.error) {
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

      // Log additional details if available
      if (error instanceof Event && error.target instanceof WebSocket) {
        console.error("WebSocket readyState:", error.target.readyState);
        console.error("WebSocket URL:", error.target.url);
      }

      setIsSocketReady(false);
      setIsWaitingForResponse(false);
    };

    ws.onclose = (event) => {
      console.log("WebSocket connection closed:", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      setIsSocketReady(false);
      setIsWaitingForResponse(false);
    };

    setSocket(ws);

    return () => {
      ws.close();
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
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
    };
  }, [messages]);

  const sendMessage = () => {
    if (
      socket &&
      isSocketReady && // Ensure WebSocket is ready
      input.trim() !== "" &&
      !isWaitingForResponse
    ) {
      const message: ChatMessage = { sender: "user", text: input };
      console.log("Sending message to WebSocket:", message); // Debug log
      socket.send(JSON.stringify(message));
      setMessages([...messages, message]);
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

  const adjustTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    if (typeof window === "undefined") return;
    const computed = window.getComputedStyle(el);
    const lineHeight = parseFloat(computed.lineHeight) || 20;
    const paddingTop = parseFloat(computed.paddingTop) || 0;
    const paddingBottom = parseFloat(computed.paddingBottom) || 0;
    const maxHeight = lineHeight * 10 + paddingTop + paddingBottom;
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
      }, 500);
      return () => clearInterval(interval);
    }, []);

    return <span>{dots}</span>;
  };

  // Add debug logs to check WebSocket and waiting state
  useEffect(() => {
    console.log("isSocketReady:", isSocketReady);
    console.log("isWaitingForResponse:", isWaitingForResponse);
  }, [isSocketReady, isWaitingForResponse]);

  return (
    <div className="flex flex-col items-center overflow-hidden min-h-screen">
      <HeaderChat />
      <div className="flex flex-col flex-1 w-full items-center justify-center">
        <div className="w-full max-w-3xl bg-white/95 dark:bg-gray-900/95 rounded-2xl shadow-lg p-4">
          <div className="flex flex-col gap-2">
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
                        ? "max-w-xs self-start bg-blue-500 text-white text-left rounded-bl-none"
                        : "max-w-2xl self-start ml-4 bg-gray-300 text-black text-left rounded-br-none"
                    }`}
                  >
                    {/* AI message: show edit/copy icons */}
                    {isAI && !isEditing && (
                      <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          title="แก้ไขข้อความ"
                          className="text-gray-500 hover:text-blue-600"
                          onClick={() => {
                            setEditingIndex(index);
                            setEditValue(message.text);
                          }}
                        >
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                        <button
                          title="คัดลอกข้อความ"
                          className="text-gray-500 hover:text-green-600"
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
                          onChange={e => setEditValue(e.target.value)}
                          autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            className="text-blue-600 hover:text-blue-800"
                            title="บันทึก"
                            onClick={() => {
                              setMessages(msgs => {
                                const updated = [...msgs];
                                updated[index] = { ...updated[index], text: editValue, fullText: editValue, isAnimating: false };
                                return updated;
                              });
                              setEditingIndex(null);
                            }}
                          >
                            <FontAwesomeIcon icon={faSave} />
                          </button>
                          <button
                            className="text-gray-500 hover:text-red-600"
                            title="ยกเลิก"
                            onClick={() => setEditingIndex(null)}
                          >
                            <FontAwesomeIcon icon={faTimes} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {message.text}
                        {isAI && message.isAnimating && <span className="animate-pulse">|</span>}
                      </>
                    )}
                  </div>
                );
              })}
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
              placeholder="Type your message..."
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
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow hover:bg-red-600"
                  title="ลบรูป"
                >
                  &times;
                </button>
              </div>
            )}
            <div className="flex gap-4 mt-2 justify-between">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-200 rounded-lg px-6 py-2 font-semibold shadow flex items-center gap-2 hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
              >
                <FontAwesomeIcon icon={faPlus} />
              </button>
              <button
                onClick={sendMessage}
                disabled={!isSocketReady || isWaitingForResponse}
                className={`bg-linear-to-r from-indigo-500 to-blue-400 text-white rounded-lg px-6 py-2 font-semibold shadow transition-colors ${
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
