"use client";

import React, { useState, useEffect } from "react";
import ProviderList from "./ProviderList";

type Section =
  | "general"
  | "providers"
  | "models"
  | "privacy"
  | "advanced"
  | "about";

interface INNOMCPSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  section?: Section;
}

const sections: { key: Section; label: string; icon: string }[] = [
  { key: "general", label: "ทั่วไป", icon: "⚙️" },
  { key: "providers", label: "AI Provider", icon: "🔌" },
  { key: "models", label: "โมเดล", icon: "🤖" },
  { key: "privacy", label: "ความเป็นส่วนตัว", icon: "🔒" },
  { key: "advanced", label: "ขั้นสูง", icon: "🛠️" },
  { key: "about", label: "เกี่ยวกับ", icon: "ℹ️" },
];

const INNOMCPSettingsPanel: React.FC<INNOMCPSettingsPanelProps> = ({
  isOpen,
  onClose,
  section,
}) => {
  // Active section state (respecting initial prop)
  const [activeSection, setActiveSection] = useState<Section>(
    section || "general"
  );

  // Sync with prop changes (e.g., if parent changes section)
  useEffect(() => {
    if (section) setActiveSection(section);
  }, [section]);

  // ------ Settings state (placeholders – in real app, use context/store) ------
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [language, setLanguage] = useState<"TH" | "EN">("TH");
  const [compactMode, setCompactMode] = useState(false);
  const [sound, setSound] = useState(true);
  const [defaultModel, setDefaultModel] = useState("innomp-7b");
  const [chatMode, setChatMode] = useState("balanced");
  const [telemetryOptOut, setTelemetryOptOut] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [wsUrl, setWsUrl] = useState("wss://innomp.example.com/ws");

  // ----- Action handlers (placeholder) -----
  const handleClearHistory = () => {
    if (confirm("คุณต้องการลบประวัติการสนทนาทั้งหมดใช่หรือไม่?")) {
      alert("ประวัติการสนทนาถูกลบเรียบร้อยแล้ว");
    }
  };

  const handleExportData = () => {
    alert("กำลังเตรียมข้อมูลสำหรับการส่งออก...");
  };

  const handleClearCache = () => {
    if (confirm("คุณต้องการล้างแคชใช่หรือไม่?")) {
      alert("แคชถูกล้างเรียบร้อยแล้ว");
    }
  };

  const handleAddProvider = () => {
    alert("เพิ่ม Provider (ฟังก์ชันตัวอย่าง)");
  };

  // ----- Render each section's content -----
  const renderSectionContent = () => {
    switch (activeSection) {
      case "general":
        return (
          <div className="space-y-6">
            {/* Theme */}
            <div>
              <label className="block text-sm font-medium mb-1">ธีม</label>
              <select
                value={theme}
                onChange={(e) =>
                  setTheme(e.target.value as "light" | "dark" | "system")
                }
                className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
              >
                <option value="system">ระบบ</option>
                <option value="light">สว่าง</option>
                <option value="dark">มืด</option>
              </select>
            </div>

            {/* Language */}
            <div>
              <label className="block text-sm font-medium mb-1">ภาษา</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setLanguage("TH")}
                  className={`flex-1 py-2 rounded-md border ${
                    language === "TH"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  }`}
                >
                  ไทย
                </button>
                <button
                  onClick={() => setLanguage("EN")}
                  className={`flex-1 py-2 rounded-md border ${
                    language === "EN"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  }`}
                >
                  English
                </button>
              </div>
            </div>

            {/* Compact mode */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">โหมดกระชับ</span>
              <button
                onClick={() => setCompactMode(!compactMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  compactMode ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    compactMode ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Sound */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">เสียง</span>
              <button
                onClick={() => setSound(!sound)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  sound ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    sound ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        );

      case "providers":
        return (
          <div className="space-y-4">
            <button
              onClick={handleAddProvider}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition"
            >
              เพิ่ม Provider
            </button>
            <div className="border rounded-md p-2 dark:border-gray-700">
              <ProviderList onAddProvider={() => {}} />
            </div>
          </div>
        );

      case "models":
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-1">
                โมเดลเริ่มต้น
              </label>
              <input
                type="text"
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
                placeholder="ชื่อโมเดล"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                โหมดการสนทนา
              </label>
              <select
                value={chatMode}
                onChange={(e) => setChatMode(e.target.value)}
                className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
              >
                <option value="balanced">สมดุล</option>
                <option value="creative">สร้างสรรค์</option>
                <option value="precise">แม่นยำ</option>
              </select>
            </div>
          </div>
        );

      case "privacy":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                ไม่เข้าร่วมการเก็บข้อมูลการใช้งาน
              </span>
              <button
                onClick={() => setTelemetryOptOut(!telemetryOptOut)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  telemetryOptOut
                    ? "bg-blue-600"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    telemetryOptOut ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <button
              onClick={handleClearHistory}
              className="w-full py-2 px-4 border border-red-300 text-red-600 rounded-md hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 transition"
            >
              ลบประวัติการสนทนา
            </button>
            <button
              onClick={handleExportData}
              className="w-full py-2 px-4 border border-gray-300 rounded-md hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 transition"
            >
              ส่งออกข้อมูล
            </button>
          </div>
        );

      case "advanced":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">โหมดดีบัก</span>
              <button
                onClick={() => setDebugMode(!debugMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  debugMode ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    debugMode ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                WebSocket URL (แทนที่)
              </label>
              <input
                type="text"
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
                placeholder="ws://..."
              />
            </div>
            <button
              onClick={handleClearCache}
              className="w-full py-2 px-4 border border-gray-300 rounded-md hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 transition"
            >
              ล้างแคช
            </button>
          </div>
        );

      case "about":
        return (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-bold">INNOMCP</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                เวอร์ชัน v10.17
              </p>
            </div>
            <div className="border-t pt-4 space-y-2 text-sm">
              <a
                href="https://github.com/innomp"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-blue-600 hover:underline"
              >
                GitHub
              </a>
              <a
                href="/docs"
                className="block text-blue-600 hover:underline"
              >
                เอกสาร
              </a>
              <a
                href="/terms"
                className="block text-blue-600 hover:underline"
              >
                ข้อตกลงการใช้งาน
              </a>
              <a
                href="/privacy-policy"
                className="block text-blue-600 hover:underline"
              >
                นโยบายความเป็นส่วนตัว
              </a>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* Overlay backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Sidebar panel */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-80 sm:w-96 bg-white dark:bg-gray-900 shadow-xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            ตั้งค่า
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="ปิด"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body: left nav + right content */}
        <div className="flex h-[calc(100%-4rem)]">
          {/* Left navigation */}
          <nav className="w-16 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-4 space-y-2">
            {sections.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                className={`w-12 h-12 flex flex-col items-center justify-center rounded-lg transition-colors text-xs ${
                  activeSection === item.key
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
                title={item.label}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="scale-75 origin-top">{item.label.slice(0, 2)}</span>
              </button>
            ))}
          </nav>

          {/* Right content area */}
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-base font-semibold mb-4 text-gray-700 dark:text-gray-200">
              {sections.find((s) => s.key === activeSection)?.label}
            </h3>
            {renderSectionContent()}
          </div>
        </div>
      </div>
    </>
  );
};

export default INNOMCPSettingsPanel;