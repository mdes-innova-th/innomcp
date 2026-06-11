"use client";

import React from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProviderPreset {
  readonly name: string;
  readonly type: string;
  readonly baseUrl: string;
  readonly needsKey: boolean;
  readonly icon: string;
  readonly color: string;
  readonly description: string;
}

export interface ProviderQuickAddProps {
  readonly onAdd: (preset: ProviderPreset) => void;
  readonly className?: string;
}

// ---------------------------------------------------------------------------
// Preset data
// ---------------------------------------------------------------------------

const PROVIDER_PRESETS: readonly ProviderPreset[] = [
  {
    name: "OpenAI / ChatGPT",
    type: "openai",
    baseUrl: "https://api.openai.com/v1",
    needsKey: true,
    icon: "🤖",
    color: "from-emerald-500 to-teal-600",
    description: "ต้องการ API Key",
  },
  {
    name: "Groq (Fast)",
    type: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    needsKey: true,
    icon: "🚀",
    color: "from-orange-500 to-rose-500",
    description: "เร็วที่สุด ต้องการ Key",
  },
  {
    name: "Ollama Local",
    type: "ollama",
    baseUrl: "http://localhost:11434/v1",
    needsKey: false,
    icon: "💻",
    color: "from-indigo-500 to-purple-600",
    description: "ฟรี ติดตั้งในเครื่อง",
  },
] as const;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface PresetCardProps {
  readonly preset: ProviderPreset;
  readonly onClick: (preset: ProviderPreset) => void;
}

function PresetCard({ preset, onClick }: PresetCardProps): React.ReactElement {
  const handleClick = (): void => {
    onClick(preset);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(preset);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`เลือกผู้ให้บริการ ${preset.name} - ${preset.description}`}
      className={`
        group relative flex cursor-pointer flex-col items-center gap-4
        rounded-2xl border border-slate-200 bg-white p-6
        shadow-sm transition-all duration-300 ease-out
        hover:scale-[1.03] hover:shadow-xl hover:border-transparent
        focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/50
        active:scale-[0.98]
        dark:border-slate-700 dark:bg-slate-800/80
        dark:hover:border-transparent
      `}
    >
      {/* Gradient background on hover */}
      <div
        className={`
          pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br
          ${preset.color}
          opacity-0 transition-opacity duration-300 ease-out
          group-hover:opacity-100
        `}
        aria-hidden="true"
      />

      {/* Icon container */}
      <div
        className={`
          relative z-10 flex h-20 w-20 items-center justify-center
          rounded-2xl bg-slate-100 text-4xl
          transition-all duration-300 ease-out
          group-hover:bg-white/25 group-hover:text-white group-hover:shadow-lg
          dark:bg-slate-700
          dark:group-hover:bg-white/20
        `}
        aria-hidden="true"
      >
        <span className="transition-transform duration-300 ease-out group-hover:scale-110">
          {preset.icon}
        </span>
      </div>

      {/* Text content */}
      <div
        className={`
          relative z-10 flex flex-col items-center gap-1 text-center
          transition-colors duration-300 ease-out
          group-hover:text-white
          dark:text-slate-200
        `}
      >
        <h3 className="text-lg font-bold leading-tight tracking-tight">
          {preset.name}
        </h3>
        <p
          className={`
            text-sm font-medium text-slate-500
            transition-colors duration-300 ease-out
            group-hover:text-white/85
            dark:text-slate-400
            dark:group-hover:text-white/80
          `}
        >
          {preset.description}
        </p>
      </div>

      {/* Key badge */}
      {preset.needsKey ? (
        <span
          className={`
            relative z-10 inline-flex items-center gap-1.5
            rounded-full border border-amber-200 bg-amber-50
            px-3 py-1 text-xs font-semibold text-amber-700
            transition-all duration-300 ease-out
            group-hover:border-white/40 group-hover:bg-white/20
            group-hover:text-white
            dark:border-amber-700/50 dark:bg-amber-900/30 dark:text-amber-400
            dark:group-hover:border-white/30 dark:group-hover:text-white
          `}
          aria-label="ต้องใช้ API Key"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
            />
          </svg>
          API Key
        </span>
      ) : (
        <span
          className={`
            relative z-10 inline-flex items-center gap-1.5
            rounded-full border border-green-200 bg-green-50
            px-3 py-1 text-xs font-semibold text-green-700
            transition-all duration-300 ease-out
            group-hover:border-white/40 group-hover:bg-white/20
            group-hover:text-white
            dark:border-green-700/50 dark:bg-green-900/30 dark:text-green-400
            dark:group-hover:border-white/30 dark:group-hover:text-white
          `}
          aria-label="ไม่ต้องใช้ API Key"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          ไม่ต้องใช้ Key
        </span>
      )}

      {/* Hover arrow indicator */}
      <div
        className={`
          relative z-10 mt-1 flex items-center gap-1 text-xs font-medium
          text-slate-400 opacity-0 transition-all duration-300 ease-out
          group-hover:opacity-100 group-hover:text-white/70
          dark:text-slate-500
        `}
        aria-hidden="true"
      >
        <span>คลิกเพื่อเพิ่ม</span>
        <svg
          className="h-3.5 w-3.5 transition-transform duration-300 ease-out group-hover:translate-x-0.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
          />
        </svg>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function ProviderQuickAdd({
  onAdd,
  className = "",
}: ProviderQuickAddProps): React.ReactElement {
  const handlePresetClick = (preset: ProviderPreset): void => {
    onAdd(preset);
  };

  return (
    <section
      className={`flex flex-col gap-5 ${className}`}
      aria-labelledby="provider-quick-add-heading"
    >
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2
          id="provider-quick-add-heading"
          className="text-xl font-bold tracking-tight text-slate-900 dark:text-white"
        >
          ⚡ เพิ่มผู้ให้บริการด่วน
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          เลือกผู้ให้บริการยอดนิยมเพื่อเริ่มต้นใช้งานทันที
        </p>
      </div>

      {/* Cards grid */}
      <div
        className={`
          grid gap-4
          grid-cols-1
          sm:grid-cols-2
          lg:grid-cols-3
        `}
        role="list"
        aria-label="รายการผู้ให้บริการยอดนิยม"
      >
        {PROVIDER_PRESETS.map((preset) => (
          <div key={preset.type} role="listitem">
            <PresetCard preset={preset} onClick={handlePresetClick} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Named exports for constants (useful for testing / external reference)
// ---------------------------------------------------------------------------

export { PROVIDER_PRESETS };
export { PresetCard };

// ---------------------------------------------------------------------------
// Default export
// ---------------------------------------------------------------------------

export default ProviderQuickAdd;