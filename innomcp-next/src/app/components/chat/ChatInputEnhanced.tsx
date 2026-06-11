// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import ChatInput from "./ChatInput"; // existing component
import type { ChangeEvent } from "react";

// --- Local internal components for enhanced features (can be extracted to separate files) ---

function SlashCommandMenu({
  visible,
  onSelect,
  onClose,
}: {
  visible: boolean;
  onSelect: (command: string) => void;
  onClose: () => void;
}) {
  if (!visible) return null;

  const commands = [
    { label: "/ล้างการสนทนา", value: "/clear" },
    { label: "/เปลี่ยนโมเดล", value: "/model" },
    { label: "/เริ่มใหม่", value: "/reset" },
    { label: "/ส่งออกเป็น PDF", value: "/export" },
    { label: "/เปิดพื้นที่ทำงาน", value: "/workspace" },
  ];

  const handleClick = (cmd: string) => {
    onSelect(cmd);
    onClose();
  };

  return (
    <div className="absolute bottom-full left-0 mb-2 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 overflow-hidden">
      <div className="p-1">
        <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          คำสั่ง
        </p>
        {commands.map((cmd) => (
          <button
            key={cmd.value}
            onClick={() => handleClick(cmd.value)}
            className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 rounded-md transition-colors"
          >
            {cmd.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MDESStreamIndicator({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div className="w-full px-4 py-1.5 bg-gradient-to-r from-blue-600/30 via-purple-600/30 to-blue-600/30 border-b border-blue-500/30">
      <div className="flex items-center gap-2 text-xs text-blue-200">
        <span className="relative flex h-2 w-2 mr-1">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
        </span>
        กำลังสร้างการตอบกลับ...
      </div>
    </div>
  );
}

function ProviderStatusBar({
  providerMode,
  currentModel,
}: {
  providerMode: "remote" | "local";
  currentModel?: string;
}) {
  const modeLabel = providerMode === "remote" ? "คลาวด์" : "ภายในเครื่อง";
  const modelName = currentModel || "ค่าเริ่มต้น";

  return (
    <div className="w-full flex items-center justify-between px-4 py-1.5 text-xs text-gray-400 border-t border-gray-800 bg-gray-950/80 backdrop-blur-sm">
      <span>
        โหมด: <span className="text-gray-200 font-medium">{modeLabel}</span>
      </span>
      <span>
        โมเดล: <span className="text-gray-200 font-medium">{modelName}</span>
      </span>
    </div>
  );
}

function ComposerEnhancedBar({
  onToggleWorkspace,
  agentCount,
  onFileUploadClick,
}: {
  onToggleWorkspace?: () => void;
  agentCount?: number;
  onFileUploadClick: () => void;
}) {
  return (
    <div className="w-full flex items-center gap-2 px-3 py-2 border-t border-gray-800 bg-gray-950/60 backdrop-blur-sm">
      <button
        onClick={onFileUploadClick}
        className="px-3 py-1.5 text-xs rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors flex items-center gap-1.5"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 5a2 2 0 012-2h3l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" clipRule="evenodd" />
        </svg>
        เพิ่มไฟล์
      </button>

      {onToggleWorkspace && (
        <button
          onClick={onToggleWorkspace}
          className="px-3 py-1.5 text-xs rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors flex items-center gap-1.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 6a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2zm0 6a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z" />
          </svg>
          พื้นที่ทำงาน
        </button>
      )}

      {agentCount !== undefined && agentCount > 0 && (
        <div className="px-3 py-1.5 text-xs rounded-lg bg-gray-800 text-gray-300 flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-1.22-3.614A4.001 4.001 0 0118 15v1h-2z" />
          </svg>
          ตัวแทน: {agentCount}
        </div>
      )}
    </div>
  );
}

// --- Main Enhanced Chat Input ---

interface ChatInputEnhancedProps {
  // forwarded ChatInput props
  input: string;
  setInput: (v: string) => void;
  isWaitingForResponse: boolean;
  isSocketReady: boolean;
  sendMessage: () => void;
  handleStop: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  handleRemoveImage: () => void;
  selectedImage: string | null;
  setSelectedImage: (v: string | null) => void;
  selectedFile: File | null;
  setSelectedFile: (v: File | null) => void;
  adjustTextarea: () => void;
  theme: string;

  // enhanced props
  providerMode: "remote" | "local";
  currentModel?: string;
  streamStatus?: string;
  agentCount?: number;
  onToggleWorkspace?: () => void;
}

const ChatInputEnhanced: React.FC<ChatInputEnhancedProps> = ({
  // spread the rest of props for ChatInput, but we need to pass them individually
  input,
  setInput,
  isWaitingForResponse,
  isSocketReady,
  sendMessage,
  handleStop,
  textareaRef,
  fileInputRef,
  handleFileUpload,
  handleRemoveImage,
  selectedImage,
  setSelectedImage,
  selectedFile,
  setSelectedFile,
  adjustTextarea,
  theme,
  providerMode,
  currentModel,
  streamStatus,
  agentCount,
  onToggleWorkspace,
}) => {
  const [slashMenuVisible, setSlashMenuVisible] = useState(false);

  // Show slash menu when input starts with "/", hide otherwise
  useEffect(() => {
    if (input.startsWith("/")) {
      setSlashMenuVisible(true);
    } else {
      setSlashMenuVisible(false);
    }
  }, [input]);

  const handleCommandSelect = useCallback(
    (cmd: string) => {
      // Instead of just "/", we replace the entire input with the command + a space
      // But if the user already typed "/s", we should replace it? For simplicity, set input to the command
      const afterSlash = input.slice(1); // text after slash
      // If the current input matches the start of a command, we can autocomplete,
      // but here we just set the full command string. The user can then continue.
      setInput(cmd + " ");
      setSlashMenuVisible(false);
    },
    [input, setInput],
  );

  // Determine if we are streaming: isWaitingForResponse and maybe streamStatus indicates streaming
  const isStreaming = isWaitingForResponse && (streamStatus !== undefined && streamStatus !== "idle");

  // File upload click handler triggers the hidden file input
  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="relative w-full">
      {/* Streaming indicator */}
      <MDESStreamIndicator visible={isStreaming} />

      {/* Input area with slash command menu overlay */}
      <div className="relative">
        <ChatInput
          input={input}
          setInput={setInput}
          isWaitingForResponse={isWaitingForResponse}
          isSocketReady={isSocketReady}
          sendMessage={sendMessage}
          handleStop={handleStop}
          textareaRef={textareaRef}
          fileInputRef={fileInputRef}
          handleFileUpload={handleFileUpload}
          handleRemoveImage={handleRemoveImage}
          selectedImage={selectedImage}
          setSelectedImage={setSelectedImage}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          adjustTextarea={adjustTextarea}
          theme={theme}
        />

        {/* Slash command menu */}
        <SlashCommandMenu
          visible={slashMenuVisible}
          onSelect={handleCommandSelect}
          onClose={() => setSlashMenuVisible(false)}
        />
      </div>

      {/* Composer enhanced bar (below input) */}
      <ComposerEnhancedBar
        onToggleWorkspace={onToggleWorkspace}
        agentCount={agentCount}
        onFileUploadClick={triggerFileUpload}
      />

      {/* Provider status bar */}
      <ProviderStatusBar
        providerMode={providerMode}
        currentModel={currentModel}
      />
    </div>
  );
};

export default ChatInputEnhanced;