"use client";

import React, { useEffect, useRef, useState } from "react";
// Note: we intentionally use a fetchedRef to fetch groups only once to avoid
// reloading/fetching when the user toggles selections.
import LoadingSpinner from "@/app/components/common/ui/loading-spinner";
import { fetchWithApiProxy } from "@/app/lib/apiProxy";

interface Props {
  selectedGroups: string[];
  setSelectedGroups: (ids: string[]) => void;
  // optional callback to inform parent about all available group ids
  onAvailableGroups?: (ids: string[]) => void;
  // when true, disable all interactions (used while searching)
  disabled?: boolean;
}

export default function ViolationGroupSelector({
  selectedGroups,
  setSelectedGroups,
  onAvailableGroups,
  disabled = false,
}: Props) {
  const [violationGroups, setViolationGroups] = useState<
    { id: string; name: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedGroups.length > 0 &&
        selectedGroups.length < violationGroups.length;
    }
  }, [selectedGroups, violationGroups]);

  useEffect(() => {
    // Fetch groups only once on mount. Avoid re-fetching when user toggles
    // selectedGroups (that would cause visible reloads).
    if (fetchedRef.current) return;

    let cancelled = false;
    setLoading(true);
    const host = process.env.NEXT_PUBLIC_NODE_HOST || "";
    interface ViolationGroupApiItem {
      group_id?: string;
      value?: string;
      group_name?: string;
      label?: string;
    }

    function findArrayInData(
      obj: unknown,
      depth = 0,
      maxDepth = 3
    ): ViolationGroupApiItem[] | null {
      if (depth > maxDepth) return null;
      if (Array.isArray(obj)) return obj as ViolationGroupApiItem[];
      if (obj && typeof obj === "object") {
        const rec = obj as Record<string, unknown>;
        // Check direct children
        for (const key of Object.keys(rec)) {
          const val = rec[key];
          if (Array.isArray(val)) return val as ViolationGroupApiItem[];
        }
        // Recurse into children
        for (const key of Object.keys(rec)) {
          const val = rec[key];
          const found = findArrayInData(val, depth + 1, maxDepth);
          if (found) return found;
        }
      }
      return null;
    }

    fetchWithApiProxy(`${host}/api/urlstats/violation-groups`)
      .then((data: unknown) => {
        if (cancelled) return;
        let items: ViolationGroupApiItem[] = [];
        try {
          const found = findArrayInData(data, 0, 4);
          if (found && Array.isArray(found)) items = found;
        } catch (err) {
          console.error(
            "[ViolationGroupSelector] error normalizing response:",
            err,
            data
          );
          items = [];
        }

        const mapped = items.map(
          (item: ViolationGroupApiItem, idx: number) => ({
            id: item.group_id || item.value || String(idx),
            name: item.group_name || item.label || "-",
          })
        );

        if (mapped.length > 0) {
          setViolationGroups(mapped);

          // Inform parent about available groups so parent can decide
          // whether 'all' is selected and optimize requests accordingly.
          try {
            if (typeof onAvailableGroups === "function") {
              onAvailableGroups(mapped.map((m) => m.id));
            }
          } catch (err) {
            console.error(
              "[ViolationGroupSelector] onAvailableGroups callback error:",
              err
            );
          }

          // If parent has no persisted selection, default to selecting all groups
          try {
            if ((selectedGroups || []).length === 0 && mapped.length > 0) {
              setSelectedGroups(mapped.map((m) => m.id));
            }
          } catch (err) {
            console.error(
              "[ViolationGroupSelector] setSelectedGroups error:",
              err
            );
          }

          fetchedRef.current = true;
        } else {
          console.warn(
            "[ViolationGroupSelector] fetched empty groups array, will retry on next open."
          );
        }
      })
      .catch((err) => {
        // Surface errors to browser console for easier debugging
        console.error("[ViolationGroupSelector] fetch error:", err);
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
    // only run once on mount; onAvailableGroups is stable in our usage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAvailableGroups]);

  return (
    <div>
      <label
        className={`block text-sm font-medium text-gray-700 mb-2 select-none transition-colors ${
          disabled
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer hover:text-blue-600"
        }`}
        onClick={() => {
          if (disabled) return;
          setVisible((v) => !v);
        }}
        onTouchStart={() => {
          if (disabled) return;
          setVisible((v) => !v);
        }}
      >
        <span className="flex items-center gap-1">
          ประเภทความผิด
          <span className="text-xs text-gray-500">{visible ? "▼" : "▶"}</span>
        </span>
      </label>

      {visible && (
        <>
          {loading ? (
            <span className="flex items-center gap-2 text-xs text-gray-400">
              <LoadingSpinner size="sm" color="blue" />
            </span>
          ) : violationGroups.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <label
                className={`flex items-center gap-1 px-2 py-1 rounded shadow-sm border transition-colors ${
                  // when not disabled keep original white card style
                  !disabled
                    ? "bg-white border-gray-200"
                    : // when disabled and everything selected, show subtle blue highlight
                    selectedGroups.length === violationGroups.length &&
                      violationGroups.length > 0
                    ? "bg-blue-50 border-blue-300"
                    : "bg-white border-gray-200 opacity-80"
                }`}
              >
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={
                    selectedGroups.length === violationGroups.length &&
                    violationGroups.length > 0
                  }
                  onChange={() => {
                    if (disabled) return;
                    if (selectedGroups.length === violationGroups.length) {
                      setSelectedGroups([]);
                    } else {
                      setSelectedGroups(violationGroups.map((g) => g.id));
                    }
                  }}
                  disabled={disabled}
                  className="rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-700 dark:text-gray-700">
                  เลือกทั้งหมด
                </span>
              </label>

              {violationGroups.map((group) => {
                const isSelected = selectedGroups.includes(group.id);
                return (
                  <label
                    key={group.id + group.name}
                    className={`flex items-center gap-1 px-2 py-1 rounded shadow-sm border transition-colors ${
                      !disabled
                        ? "bg-white border-gray-200"
                        : isSelected
                        ? // when disabled but selected -> highlight clearly (keep text color consistent)
                          "bg-blue-50 border-blue-300"
                        : // when disabled and not selected -> dim
                          "bg-white border-gray-200 opacity-80"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (disabled) return;
                        let updated: string[];
                        if (e.target.checked) {
                          updated = [...selectedGroups, group.id];
                        } else {
                          updated = selectedGroups.filter(
                            (id) => id !== group.id
                          );
                        }
                        setSelectedGroups(updated);
                      }}
                      disabled={disabled}
                      className="rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span
                      className={`text-xs text-gray-700 dark:text-gray-700 ${
                        isSelected && disabled ? "font-semibold" : ""
                      }`}
                    >
                      {group.name}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <span className="text-xs text-gray-400">
              ไม่สามารถแสดงประเภทความผิดได้
            </span>
          )}
        </>
      )}
    </div>
  );
}
