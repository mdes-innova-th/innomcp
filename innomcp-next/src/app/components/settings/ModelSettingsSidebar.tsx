"use client";

import { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

interface MDESModel {
  id: string;
  name: string;
}

interface Provider {
  id: string;
  name: string;
  type: string;
  endpoint?: string;
  apiKey?: string;
  models?: string[];
}

interface TestResult {
  success: boolean;
  message: string;
  latency?: number;
}

// ─────────────────────────────────────────────────────────────────
// Extracted Small Components
// ─────────────────────────────────────────────────────────────────

function ProviderList({
  providers,
  onRemove,
  onSelect,
}: {
  providers: Provider[];
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  if (providers.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center">
        ยังไม่มี Provider ที่เพิ่ม
      </p>
    );
  }
  return (
    <ul className="mt-3 space-y-2">
      {providers.map((p) => (
        <li
          key={p.id}
          className="flex items-center justify-between rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 text-sm"
        >
          <div className="flex flex-col">
            <span className="font-medium text-gray-800 dark:text-gray-100">{p.name}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{p.type}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelect(p.id)}
              className="text-blue-600 hover:text-blue-800 text-xs underline"
              title="เลือก"
            >
              เลือก
            </button>
            <button
              onClick={() => onRemove(p.id)}
              className="text-red-500 hover:text-red-700 text-xs underline"
              title="ลบ"
            >
              ลบ
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main Sidebar Component
// ─────────────────────────────────────────────────────────────────

interface ModelSettingsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ModelSettingsSidebar({ isOpen, onClose }: ModelSettingsSidebarProps) {
  // ── Tab state ────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"mdes" | "add" | "list" | "test">("mdes");

  // ── MDES data ────────────────────────────────────────
  const [mdesModels, setMdesModels] = useState<MDESModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [mdesStatus, setMdesStatus] = useState<"loading" | "healthy" | "unhealthy">("loading");
  const [mdesError, setMdesError] = useState<string | null>(null);

  // ── Provider management ─────────────────────────────
  const [providers, setProviders] = useState<Provider[]>([]); // would be synced with API
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [newProvider, setNewProvider] = useState({
    name: "",
    type: "ollama",
    endpoint: "",
    apiKey: "",
  });

  // ── Connection test ─────────────────────────────────
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  // ── Fetch MDES models & health ───────────────────
  const fetchMDESData = useCallback(async () => {
    setMdesStatus("loading");
    setMdesError(null);
    try {
      const res = await fetch("/api/mdes/models");
      if (!res.ok) throw new Error("ไม่สามารถโหลดข้อมูล MDES ได้");
      const data = await res.json();
      // Expected format: { models: [{ id, name }] }
      const models: MDESModel[] = data.models || data;
      setMdesModels(models);

      // Simple health check: if we get models, MDES is healthy
      setMdesStatus("healthy");
    } catch (err: any) {
      setMdesStatus("unhealthy");
      setMdesError(err.message || "ไม่สามารถเชื่อมต่อ MDES Ollama");
      setMdesModels([]);
    }
  }, []);

  useEffect(() => {
    if (isOpen && activeTab === "mdes") {
      fetchMDESData();
    }
  }, [isOpen, activeTab, fetchMDESData]);

  // ── Add provider ─────────────────────────────────
  const handleAddProvider = () => {
    if (!newProvider.name.trim()) return;
    const newP: Provider = {
      id: Date.now().toString(),
      name: newProvider.name.trim(),
      type: newProvider.type,
      endpoint: newProvider.endpoint.trim() || undefined,
      apiKey: newProvider.apiKey.trim() || undefined,
    };
    setProviders((prev) => [...prev, newP]);
    setNewProvider({ name: "", type: "ollama", endpoint: "", apiKey: "" });
    setShowAddProvider(false);
    // In real app: POST to /api/providers
  };

  const handleRemoveProvider = (id: string) => {
    setProviders((prev) => prev.filter((p) => p.id !== id));
    // In real app: DELETE /api/providers/:id
  };

  // ── Connection test ──────────────────────────────
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Simulate network request
      await new Promise((r) => setTimeout(r, 600));
      // In real app: test selected provider /api/test-connection
      setTestResult({
        success: true,
        message: "เชื่อมต่อสำเร็จ (simulation)",
        latency: 123,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "การเชื่อมต่อล้มเหลว",
      });
    } finally {
      setTesting(false);
    }
  };

  // ── UI Helpers ────────────────────────────────────
  const tabClass = (tab: typeof activeTab) =>
    `px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
      activeTab === tab
        ? "bg-white dark:bg-gray-800 text-blue-600 border-b-2 border-blue-600"
        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
    }`;

  // ───────────────────────────────────────────────────
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={`fixed top-0 right-0 h-full w-96 max-w-full z-50 bg-white dark:bg-gray-900 shadow-2xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        } flex flex-col`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            ตั้งค่า AI Provider
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="ปิด"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-4 pt-2">
          <button onClick={() => setActiveTab("mdes")} className={tabClass("mdes")}>
            MDES Ollama (หลัก)
          </button>
          <button onClick={() => setActiveTab("add")} className={tabClass("add")}>
            เพิ่ม Provider
          </button>
          <button onClick={() => setActiveTab("list")} className={tabClass("list")}>
            รายการ Provider
          </button>
          <button onClick={() => setActiveTab("test")} className={tabClass("test")}>
            ทดสอบการเชื่อมต่อ
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* ── MDES Ollama Section ──────────────────── */}
          {activeTab === "mdes" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-medium text-gray-700 dark:text-gray-200">
                  MDES Ollama
                </h3>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    mdesStatus === "loading"
                      ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      : mdesStatus === "healthy"
                      ? "bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-400"
                      : "bg-red-100 text-red-800 dark:bg-red-800/20 dark:text-red-400"
                  }`}
                >
                  {mdesStatus === "loading"
                    ? "กำลังโหลด..."
                    : mdesStatus === "healthy"
                    ? "เชื่อมต่อแล้ว"
                    : "ไม่สามารถเชื่อมต่อ"}
                </span>
              </div>

              {mdesError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-md">
                  ⚠️ {mdesError}
                </div>
              )}

              {mdesStatus !== "loading" && mdesModels.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    เลือกรุ่น
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 py-2 px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- เลือกรุ่น --</option>
                    {mdesModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.id})
                      </option>
                    ))}
                  </select>
                  {selectedModel && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      รุ่นที่เลือก: {selectedModel}
                    </p>
                  )}
                </div>
              )}

              {mdesStatus !== "loading" && mdesModels.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">ไม่มีรุ่นที่พร้อมใช้งาน</p>
              )}

              <button
                onClick={fetchMDESData}
                disabled={mdesStatus === "loading"}
                className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-md transition-colors"
              >
                <svg
                  className={`w-4 h-4 mr-2 ${mdesStatus === "loading" ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                โหลดข้อมูลใหม่
              </button>
            </div>
          )}

          {/* ── เพิ่ม Provider Section ────────────────── */}
          {activeTab === "add" && (
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-700 dark:text-gray-200">
                เพิ่ม Provider ใหม่
              </h3>

              {!showAddProvider ? (
                <button
                  onClick={() => setShowAddProvider(true)}
                  className="w-full py-2 border border-dashed border-gray-400 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-600 rounded-lg text-sm transition-colors"
                >
                  + เพิ่ม Provider ใหม่
                </button>
              ) : (
                <div className="space-y-3 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                      ชื่อ Provider
                    </label>
                    <input
                      type="text"
                      value={newProvider.name}
                      onChange={(e) =>
                        setNewProvider((p) => ({ ...p, name: e.target.value }))
                      }
                      placeholder="เช่น My Ollama"
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                      ประเภท
                    </label>
                    <select
                      value={newProvider.type}
                      onChange={(e) =>
                        setNewProvider((p) => ({ ...p, type: e.target.value }))
                      }
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="ollama">Ollama</option>
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="custom">อื่นๆ</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Endpoint URL
                    </label>
                    <input
                      type="text"
                      value={newProvider.endpoint}
                      onChange={(e) =>
                        setNewProvider((p) => ({ ...p, endpoint: e.target.value }))
                      }
                      placeholder="http://localhost:11434"
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                      API Key (ถ้ามี)
                    </label>
                    <input
                      type="password"
                      value={newProvider.apiKey}
                      onChange={(e) =>
                        setNewProvider((p) => ({ ...p, apiKey: e.target.value }))
                      }
                      placeholder="sk-..."
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleAddProvider}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
                    >
                      เพิ่ม
                    </button>
                    <button
                      onClick={() => setShowAddProvider(false)}
                      className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-md transition-colors"
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Provider List Section ────────────────── */}
          {activeTab === "list" && (
            <div>
              <h3 className="text-md font-medium text-gray-700 dark:text-gray-200 mb-2">
                รายการ Provider ทั้งหมด
              </h3>
              <ProviderList
                providers={providers}
                onRemove={handleRemoveProvider}
                onSelect={(id) => {
                  // Set selected provider globally or invoke change
                  console.log("Selected provider:", id);
                }}
              />
              {providers.length > 0 && (
                <p className="text-xs text-gray-400 mt-3">
                  คลิก &quot;เลือก&quot; เพื่อใช้งาน หรือ &quot;ลบ&quot; เพื่อเอาออก
                </p>
              )}
            </div>
          )}

          {/* ── Connection Test Section ────────────────── */}
          {activeTab === "test" && (
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-700 dark:text-gray-200">
                ทดสอบการเชื่อมต่อ
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ทดสอบการเชื่อมต่อไปยัง Provider ที่เลือก (หรือ MDES Ollama) เพื่อยืนยันว่าพร้อมใช้งาน
              </p>
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-md transition-colors"
              >
                {testing ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    กำลังทดสอบ...
                  </>
                ) : (
                  "ทดสอบการเชื่อมต่อ"
                )}
              </button>

              {testResult && (
                <div
                  className={`p-3 rounded-md text-sm ${
                    testResult.success
                      ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                      : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                    <span className="font-medium">{testResult.message}</span>
                  </div>
                  {testResult.latency && (
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      เวลาตอบสนอง: {testResult.latency} ms
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer (optional) */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-center text-gray-400 dark:text-gray-600">
            INNOMCP — Thailand Government AI Platform
          </p>
        </div>
      </div>
    </>
  );
}