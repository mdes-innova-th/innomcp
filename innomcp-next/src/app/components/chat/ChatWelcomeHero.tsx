"use client";

import { useState, useEffect } from "react";

interface ChatWelcomeHeroProps {
  onQuerySelect: (query: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  isConnected: boolean;
  providerMode: "remote" | "local";
}

export default function ChatWelcomeHero({
  onQuerySelect,
  textareaRef,
  isConnected,
  providerMode,
}: ChatWelcomeHeroProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger fade-in animation after mount
    setMounted(true);
  }, []);

  return (
    <div className="flex min-h-full w-full items-center justify-center p-6">
      {/* Animated gradient background accent */}
      <div
        className={`
          w-full max-w-xl rounded-2xl border border-gray-100 bg-white/80 shadow-sm backdrop-blur-md
          transition-all duration-700 ease-out
          ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
      >
        {/* Subtle gradient bar on top */}
        <div className="h-1.5 w-full rounded-t-2xl bg-gradient-to-r from-blue-500 to-purple-500" />

        <div className="flex flex-col items-center px-8 py-10 text-center">
          {/* Main title */}
          <h1 className="bg-gradient-to-r from-blue-700 to-purple-700 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent md:text-6xl">
            INNOMCP
          </h1>

          {/* Thai subtitle */}
          <p className="mt-2 text-lg font-medium text-gray-600 md:text-xl">
            ศูนย์ MCP ภาครัฐ
          </p>

          {/* Tagline */}
          <p className="mt-1 text-sm text-gray-500">
            AI ภาครัฐที่ใช้ได้ 24 ชั่วโมง โดย MDES
          </p>

          {/* Capability icons row */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {[
              { icon: "🔧", label: "MCP Tools" },
              { icon: "🤖", label: "Multi‑Agent" },
              { icon: "🇹🇭", label: "Thai‑First" },
              { icon: "🏛️", label: "Government Data" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex flex-col items-center rounded-xl border border-gray-100 bg-gray-50/80 px-5 py-3 shadow-sm transition-shadow duration-200 hover:shadow-md"
              >
                <span className="text-2xl">{item.icon}</span>
                <span className="mt-1 text-xs font-medium text-gray-700">
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          {/* Connection status */}
          <div className="mt-6 flex items-center space-x-2 text-sm">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                isConnected
                  ? "bg-green-500 animate-pulse"
                  : "bg-red-500"
              }`}
            />
            <span
              className={`font-medium ${
                isConnected ? "text-green-700" : "text-red-600"
              }`}
            >
              {isConnected ? "MDES Ollama พร้อมใช้งาน" : "ออฟไลน์"}
            </span>
          </div>

          {/* Trust strip */}
          <p className="mt-4 text-xs text-gray-400">
            56+ เครื่องมือ MCP | 3 ประเภท AI | ภาษาไทยธรรมชาติ
          </p>
        </div>
      </div>
    </div>
  );
}