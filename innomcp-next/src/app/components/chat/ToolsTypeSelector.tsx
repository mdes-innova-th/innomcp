"use client";

import React, { useEffect, useRef, useState } from "react";

export type ToolType = "auto" | "weather" | "calculation" | "art" | "data" | "datetime" | "officer";

interface ToolsTypeSelectorProps {
  /** Kept for API compatibility; currently unused after removing the in-dropdown new-chat shortcut. */
  onNewChat?: () => void;
  onToolTypeChange?: (type: ToolType) => void;
  theme: string;
}

interface ToolMeta {
  id: ToolType;
  name: string;
  description: string;
  icon: string;
}

const TOOL_TYPES: ToolMeta[] = [
  { id: "auto", name: "อัตโนมัติ", description: "ให้ AI เลือกเครื่องมือเอง", icon: "🤖" },
  { id: "weather", name: "สภาพอากาศ", description: "อุตุนิยมและพยากรณ์", icon: "🌤️" },
  { id: "calculation", name: "คำนวณ", description: "สูตรและเลขศาสตร์", icon: "🔢" },
  { id: "art", name: "ภาพและกราฟ", description: "สร้างภาพและแผนภูมิ", icon: "🎨" },
  { id: "data", name: "ข้อมูล", description: "World Bank · NASA · Archive", icon: "📊" },
  { id: "datetime", name: "วัน-เวลา", description: "ปฏิทินและเวลาปัจจุบัน", icon: "⏰" },
  { id: "officer", name: "เจ้าหน้าที่", description: "งานเจ้าหน้าที่ MDES", icon: "🧑‍💼" },
];

const ToolsTypeSelector: React.FC<ToolsTypeSelectorProps> = ({
  onToolTypeChange,
  theme: _theme,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ToolType>("auto");
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const savedType = localStorage.getItem("selectedToolType") as ToolType | null;
    if (savedType && TOOL_TYPES.some((t) => t.id === savedType)) {
      setSelectedType(savedType);
    }
  }, []);

  // Close on escape — easier keyboard exit than blind backdrop click
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const handleTypeSelect = (type: ToolType) => {
    setSelectedType(type);
    localStorage.setItem("selectedToolType", type);
    onToolTypeChange?.(type);
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  const activeTool = TOOL_TYPES.find((t) => t.id === selectedType) ?? TOOL_TYPES[0];

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border/70 bg-background px-2.5 text-[13px] font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-primary/8 aria-expanded:border-primary/40 aria-expanded:bg-primary/8"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={`เครื่องมือ: ${activeTool.name} — ${activeTool.description}`}
      >
        <span className="text-base leading-none" aria-hidden="true">
          {activeTool.icon}
        </span>
        <span className="hidden truncate sm:inline">{activeTool.name}</span>
        <svg
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            aria-label="ปิดเมนูเครื่องมือ"
            className="fixed inset-0 z-[80] cursor-default bg-transparent"
            onClick={() => setIsOpen(false)}
          />

          <div
            role="listbox"
            aria-label="เลือกเครื่องมือ"
            className="absolute bottom-full left-0 z-[90] mb-2 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-border/70 bg-card shadow-lg"
          >
            <div className="border-b border-border/60 px-3 py-2">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                เครื่องมือ
              </div>
              <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground/85">
                เลือกแนวทางที่อยากให้ AI ใช้
              </div>
            </div>

            <ul className="max-h-[60vh] space-y-0.5 overflow-y-auto p-1.5">
              {TOOL_TYPES.map((tool) => {
                const isSelected = selectedType === tool.id;
                return (
                  <li key={tool.id}>
                    <button
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleTypeSelect(tool.id)}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors ${
                        isSelected
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted/60"
                      }`}
                    >
                      <span className="text-lg leading-none" aria-hidden="true">
                        {tool.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium leading-tight">
                          {tool.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] leading-snug text-muted-foreground">
                          {tool.description}
                        </span>
                      </span>
                      {isSelected && (
                        <svg
                          className="h-4 w-4 shrink-0 text-primary"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M5 12l5 5L20 7" />
                        </svg>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default ToolsTypeSelector;
