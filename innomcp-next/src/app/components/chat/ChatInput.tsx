"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUp,
  faPaperclip,
  faRefresh,
  faStop,
} from "@fortawesome/free-solid-svg-icons";
import AIModelSelector from "./AIModelSelector";
import ToolsTypeSelector, { type ToolType } from "./ToolsTypeSelector";

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  selectedImage: string | null;
  setSelectedImage: (value: string | null) => void;
  selectedFile: File | null;
  setSelectedFile: (value: File | null) => void;
  handleNewChat: () => void;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveImage: () => void;
  sendMessage: () => void;
  handleStop: () => void;
  isSocketReady: boolean;
  isWaitingForResponse: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  adjustTextarea: () => void;
  theme: string;
  onToolTypeChange?: (type: ToolType) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  selectedImage,
  setSelectedImage,
  selectedFile,
  setSelectedFile,
  handleNewChat,
  handleFileUpload,
  handleRemoveImage,
  sendMessage,
  handleStop,
  isSocketReady,
  isWaitingForResponse,
  textareaRef,
  fileInputRef,
  adjustTextarea,
  theme,
  onToolTypeChange,
  onFocus,
  onBlur,
}) => {
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

  useEffect(() => {
    // adjust when input changes
    adjustTextarea();
    // also adjust on window resize in case layout changes
    const handler = () => adjustTextarea();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [input, adjustTextarea]);

  return (
    <div
      className="w-full max-w-3xl mx-auto relative bg-card border border-border/60 rounded-2xl shadow-[0_2px_16px_oklch(0_0_0/0.05)] px-6 py-4"
    >
      <div
        className="absolute top-2 right-2 text-sm"
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
      <div className="flex flex-col pt-4 pb-0">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            adjustTextarea();
          }}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={(e) => {
            // Enter to send message (Shift+Enter for new line)
            if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey) {
              e.preventDefault();
              if (input.trim() && isSocketReady && !isWaitingForResponse) {
                sendMessage();
              }
            }
            // Shift+Enter allows new line (default textarea behavior)
          }}
          rows={1}
          placeholder="ถามอากาศวันนี้หรือเรื่องใดก็ได้... (Enter เพื่อส่ง, Shift+Enter เพื่อเว้นบรรทัด)"
          className="w-full resize-none bg-transparent focus:outline-none transition-all max-h-60 overflow-y-auto placeholder:text-muted-foreground/60"
          data-testid="chat-input"
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
        <div className="flex gap-4 pt-8 pb-0 justify-between">
          <div className="flex gap-2">
            {/* Dropdown with New Chat and Tools Type Selector */}
            <ToolsTypeSelector 
              onNewChat={handleNewChat}
              onToolTypeChange={onToolTypeChange}
              theme={theme}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              title="แนบไฟล์"
              className="bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary/80 rounded-full p-2 w-9 h-9 font-semibold shadow-sm flex items-center justify-center hover:bg-primary/20 dark:hover:bg-primary/30 hover:scale-105 transition-all duration-200 cursor-pointer"
            >
              <FontAwesomeIcon icon={faPaperclip} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <AIModelSelector theme={theme} />
            <button
              onClick={isWaitingForResponse ? handleStop : sendMessage}
              disabled={!isSocketReady}
              className={`bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-6 py-2 font-semibold shadow-md transition-all duration-200 cursor-pointer ${
                !isSocketReady
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:shadow-lg hover:scale-105"
              }`}
              data-testid="send-btn"
              title={isWaitingForResponse ? "หยุดการตอบ" : "ส่งข้อความ (Enter)"}
            >
              {isWaitingForResponse ? (
                <FontAwesomeIcon icon={faStop} className="font-bold" />
              ) : isSocketReady ? (
                <FontAwesomeIcon icon={faArrowUp} className="font-bold" />
              ) : (
                <span className="font-bold">
                  กำลังติดต่อ AI
                  <DotsAnimation />
                </span>
              )}
            </button>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
