// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import ProviderCard from "./ProviderCard";

// Types
interface Provider {
  id: string;
  name: string;
  description?: string;
  endpoint?: string;
  apiKey?: string;
  enabled: boolean;
  priority: number;
  isDefault: boolean;
  healthStatus?: "online" | "offline" | "unknown";
  // add other fields as needed
}

interface ProviderListProps {
  onAddProvider: () => void;
  className?: string;
}

// Drag and drop helpers (simplified)
interface DragItem {
  index: number;
}

export default function ProviderList({ onAddProvider, className = "" }: ProviderListProps) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [healthCheckLoading, setHealthCheckLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragItem = useRef<DragItem | null>(null);
  const dragOverItem = useRef<DragItem | null>(null);

  // Fetch providers on mount
  const fetchProviders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/providers");
      if (!res.ok) throw new Error("ไม่สามารถโหลดรายชื่อผู้ให้บริการได้");
      const data: Provider[] = await res.json();
      // Sort by priority (default first)
      data.sort((a, b) => a.priority - b.priority);
      setProviders(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // Separate default provider (MDES Ollama) from custom ones
  const defaultProvider = providers.find(p => p.isDefault) || null;
  const customProviders = providers.filter(p => !p.isDefault);

  // Total count
  const totalCount = providers.length;

  // Health check all providers
  const handleHealthCheck = async () => {
    setHealthCheckLoading(true);
    try {
      const res = await fetch("/api/ai/providers/health-check", { method: "POST" });
      if (!res.ok) throw new Error("ไม่สามารถตรวจสอบสถานะได้");
      const statuses: { id: string; healthStatus: "online" | "offline" | "unknown" }[] = await res.json();
      setProviders(prev =>
        prev.map(p => {
          const update = statuses.find(s => s.id === p.id);
          if (update) {
            return { ...p, healthStatus: update.healthStatus };
          }
          return p;
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการตรวจสอบสถานะ");
    } finally {
      setHealthCheckLoading(false);
    }
  };

  // Bulk enable/disable custom providers
  const handleBulkToggle = async (enabled: boolean) => {
    try {
      const res = await fetch("/api/ai/providers/bulk-toggle", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, providerIds: customProviders.map(p => p.id) }),
      });
      if (!res.ok) throw new Error("ไม่สามารถสลับสถานะผู้ให้บริการได้");
      // Update local state
      setProviders(prev =>
        prev.map(p => (p.isDefault ? p : { ...p, enabled }))
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    }
  };

  // Handle reorder after drag and drop
  const updatePriorities = async (newOrder: Provider[]) => {
    // Prepare payload with new priorities
    const payload = [
      ...(defaultProvider ? [{ id: defaultProvider.id, priority: 0 }] : []),
      ...newOrder.map((p, index) => ({ id: p.id, priority: index + 1 })),
    ];

    try {
      const res = await fetch("/api/ai/providers/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providers: payload }),
      });
      if (!res.ok) throw new Error("ไม่สามารถอัปเดตลำดับผู้ให้บริการได้");
      // Update local state with new priorities
      const updatedProviders = providers.map(p => {
        const entry = payload.find(e => e.id === p.id);
        if (entry) return { ...p, priority: entry.priority };
        return p;
      });
      updatedProviders.sort((a, b) => a.priority - b.priority);
      setProviders(updatedProviders);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      // Revert to original order maybe? We'll keep UI state as is for now
    }
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    dragItem.current = { index };
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = { index };
  };

  const handleDragEnd = () => {
    if (dragItem.current && dragOverItem.current) {
      const dragIndex = dragItem.current.index;
      const dropIndex = dragOverItem.current.index;

      if (dragIndex !== dropIndex) {
        // Reorder custom providers array
        const newCustom = [...customProviders];
        const draggedItem = newCustom[dragIndex];
        newCustom.splice(dragIndex, 1);
        newCustom.splice(dropIndex, 0, draggedItem);

        // Update priorities via API
        updatePriorities(newCustom);

        // Optimistically update local state (will be overwritten by API response if successful)
        const fullList = defaultProvider ? [defaultProvider, ...newCustom] : newCustom;
        setProviders(fullList.map((p, i) => ({ ...p, priority: i })));
      }
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // Delete handler (passed to ProviderCard for custom providers)
  const handleDelete = async (providerId: string) => {
    try {
      const res = await fetch(`/api/ai/providers/${providerId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("ไม่สามารถลบผู้ให้บริการได้");
      setProviders(prev => prev.filter(p => p.id !== providerId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    }
  };

  // Toggle single provider (passed to ProviderCard)
  const handleToggle = async (providerId: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/ai/providers/${providerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error("ไม่สามารถสลับสถานะผู้ให้บริการได้");
      setProviders(prev =>
        prev.map(p => (p.id === providerId ? { ...p, enabled } : p))
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-24 bg-gray-100 rounded"></div>
          <div className="h-24 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-900">ผู้ให้บริการ AI</h2>
          <span className="inline-flex items-center justify-center px-3 py-1 text-sm font-medium bg-primary-100 text-primary-700 rounded-full">
            ทั้งหมด {totalCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleHealthCheck}
            disabled={healthCheckLoading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {healthCheckLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                กำลังตรวจสอบ...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                ตรวจสอบสถานะ
              </>
            )}
          </button>
          <button
            onClick={onAddProvider}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            เพิ่มใหม่
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Default provider (MDES Ollama) */}
      {defaultProvider && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">ค่าเริ่มต้น</span>
          <ProviderCard
            provider={defaultProvider}
            onToggle={(enabled: boolean) => handleToggle(defaultProvider.id, enabled)}
            onDelete={() => {}} // cannot delete
            disableDelete
            disableDrag
          />
        </div>
      )}

      {/* Custom providers section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">ผู้ให้บริการเพิ่มเติม</h3>
          {customProviders.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkToggle(true)}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                เปิดทั้งหมด
              </button>
              <button
                onClick={() => handleBulkToggle(false)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                ปิดทั้งหมด
              </button>
            </div>
          )}
        </div>

        {customProviders.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-gray-300 rounded-xl">
            <svg className="h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-600 mb-4">ยังไม่มีผู้ให้บริการเพิ่มเติม</p>
            <button
              onClick={onAddProvider}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              เพิ่มผู้ให้บริการ
            </button>
          </div>
        ) : (
          /* Provider list with drag and drop */
          <div className="space-y-3">
            {customProviders.map((provider, index) => (
              <div
                key={provider.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragEnter={() => handleDragEnter(index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                className="cursor-grab active:cursor-grabbing"
              >
                <ProviderCard
                  provider={provider}
                  onToggle={(enabled: boolean) => handleToggle(provider.id, enabled)}
                  onDelete={() => handleDelete(provider.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}