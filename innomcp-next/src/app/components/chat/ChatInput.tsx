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
      className={`w-full max-w-3xl mx-auto relative ${
        theme === "light" ? "bg-white" : "dark:bg-gray-800"
      } rounded-2xl shadow-lg px-6 py-4`}
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
      <div className="flex flex-col gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            adjustTextarea();
          }}
          rows={1}
          placeholder="มีอะไรให้ช่วยไหม?"
          className="w-full resize-none focus:outline-none transition-all max-h-60 overflow-y-auto"
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
              className="bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-200 rounded-full p-2 w- h-8 font-semibold shadow flex items-center gap-2 hover:bg-green-200 dark:hover:bg-green-800 transition-colors cursor-pointer"
              title="เริ่มการแชทใหม่"
            >
              <FontAwesomeIcon icon={faRefresh} />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              title="แนบไฟล์"
              className="bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-200 rounded-full p-2 w- h-8 font-semibold shadow flex items-center gap-2 hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors cursor-pointer"
            >
              <FontAwesomeIcon icon={faPaperclip} />
            </button>
          </div>
          <button
            onClick={isWaitingForResponse ? handleStop : sendMessage}
            disabled={!isSocketReady}
            className={`bg-linear-to-r from-indigo-500 to-blue-400 text-white rounded-lg px-6 py-2 font-semibold shadow transition-colors cursor-pointer ${
              !isSocketReady
                ? "opacity-50 cursor-not-allowed"
                : "hover:from-blue-400 hover:to-indigo-500"
            }`}
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
