"use client";

import React, { useState, useEffect, useRef, useContext } from "react";
import Image from "next/image";
import HeaderChat from "@/app/components/HeaderChat";
import ThemeContext from "@/app/context/ThemeContext";
import { AiOutlinePlus } from "react-icons/ai";

// Define the type for a chat message
interface ChatMessage {
  sender: "user" | "ai";
  text: string;
}

const ChatPage: React.FC = () => {
  const { theme } = useContext(ThemeContext) as { theme: string };
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [isSocketReady, setIsSocketReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const ws = new WebSocket(
      process.env.NEXT_PUBLIC_NODE_WS_HOST || "ws://localhost:3010"
    );

    ws.onopen = () => {
      console.log("WebSocket connection established with Node.js server");
      setIsSocketReady(true); // Set socket as ready
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setMessages((prevMessages) => [
        ...prevMessages,
        { sender: "ai", text: message.text },
      ]);
      setIsWaitingForResponse(false); // Allow sending new messages after receiving a response
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed");
      setIsSocketReady(false); // Set socket as not ready
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, []);

  const sendMessage = () => {
    if (
      socket &&
      isSocketReady && // Ensure WebSocket is ready
      input.trim() !== "" &&
      !isWaitingForResponse
    ) {
      const message: ChatMessage = { sender: "user", text: input };
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
    // Reset height so scrollHeight is measured correctly
    el.style.height = "auto";
    if (typeof window === "undefined") return;
    const computed = window.getComputedStyle(el);
    const lineHeight = parseFloat(computed.lineHeight) || 20;
    const paddingTop = parseFloat(computed.paddingTop) || 0;
    const paddingBottom = parseFloat(computed.paddingBottom) || 0;
    const maxHeight = lineHeight * 10 + paddingTop + paddingBottom;
    const newHeight = Math.min(el.scrollHeight, maxHeight);

    // Apply new height only to the textarea
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

  return (
    <div className={`flex flex-col items-center overflow-hidden min-h-screen`}>
      <HeaderChat />
      <div className="flex flex-col flex-1 w-full items-center justify-center">
        <div className="w-full max-w-3xl bg-white/95 dark:bg-gray-900/95 rounded-2xl shadow-lg p-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 overflow-y-auto max-h-96">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`p-2 rounded-lg max-w-xs ${
                    message.sender === "user"
                      ? "bg-blue-500 text-white self-end"
                      : "bg-gray-300 text-black self-start"
                  }`}
                >
                  {message.text}
                </div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                adjustTextarea();
              }}
              rows={3} // Increase default height
              className="rounded-xl border border-gray-300 dark:border-gray-700 p-3 text-base bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white resize-none w-full focus:ring-0 focus:outline-none" // Remove border on focus
              placeholder="Type your message..."
              style={{ height: "auto", overflowY: "hidden" }}
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
                <AiOutlinePlus />
              </button>
              <button
                onClick={sendMessage}
                disabled={!isSocketReady || isWaitingForResponse} // Disable button if WebSocket is not ready or waiting for response
                className={`bg-linear-to-r from-indigo-500 to-blue-400 text-white rounded-lg px-6 py-2 font-semibold shadow transition-colors ${
                  !isSocketReady || isWaitingForResponse
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:from-blue-400 hover:to-indigo-500"
                }`}
              >
                {isSocketReady ? "Send" : "Connecting..."}
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
