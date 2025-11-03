"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from "react";

export interface ViolationGroup {
  id: string;
  name: string;
}

interface ViolationGroupContextProps {
  violationGroups: ViolationGroup[];
  loading: boolean;
  selectedGroups: string[];
  setSelectedGroups: (ids: string[]) => void;
}

const ViolationGroupContext = createContext<
  ViolationGroupContextProps | undefined
>(undefined);

const host =
  process.env.NEXT_PUBLIC_NODE_HOST || "http://localhost:3010";

export function ViolationGroupProvider({
  children,
  storageKey = "violationGroupsSelected",
}: {
  children: ReactNode;
  storageKey?: string;
}) {
  const [violationGroups, setViolationGroups] = useState<ViolationGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const fetchedRef = useRef(false);

  // Fetch violation groups only once
  useEffect(() => {
    if (fetchedRef.current) return;
    setLoading(true);
    fetchedRef.current = true;
    interface ViolationGroupApiItem {
      group_id?: string;
      value?: string;
      group_name?: string;
      label?: string;
    }

    interface ViolationGroupApiResponse {
      data: ViolationGroupApiItem[];
    }

    import("@/app/lib/apiProxy").then(({ fetchWithApiProxy }) => {
      fetchWithApiProxy(`${host}/api/urlstats/violation-groups`)
        .then((data: ViolationGroupApiResponse) => {
          setViolationGroups(
            (Array.isArray(data.data) ? data.data : []).map(
              (item: ViolationGroupApiItem, idx: number) => ({
                id: item.group_id || item.value || String(idx),
                name: item.group_name || item.label || "-",
              })
            )
          );
          setLoading(false);
        })
        .catch(() => setLoading(false));
    });
  }, []);

  // Load selectedGroups from localStorage after violationGroups loaded
  useEffect(() => {
    if (violationGroups.length > 0) {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          try {
            const arr = JSON.parse(stored);
            if (Array.isArray(arr)) {
              // sync เฉพาะ id ที่ยังมีอยู่
              const validIds = violationGroups.map((g) => g.id);
              const filtered = arr.filter((id) => validIds.includes(id));
              setSelectedGroups(filtered);
            }
          } catch {}
        }
      }
    }
  }, [violationGroups, storageKey]);

  // Save selectedGroups to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && violationGroups.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(selectedGroups));
    }
  }, [selectedGroups, violationGroups.length, storageKey]);

  return (
    <ViolationGroupContext.Provider
      value={{ violationGroups, loading, selectedGroups, setSelectedGroups }}
    >
      {children}
    </ViolationGroupContext.Provider>
  );
}

export function useViolationGroups() {
  const ctx = useContext(ViolationGroupContext);
  if (!ctx)
    throw new Error(
      "useViolationGroups must be used within ViolationGroupProvider"
    );
  return ctx;
}
