"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/* -------------------------------------------------------------------------- */
/*  Shared Types                                                              */
/* -------------------------------------------------------------------------- */

export interface Notification {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  timestamp: number;
}

export interface NotificationInput {
  message: string;
  type?: Notification["type"];
}

export interface UserPreferences {
  language: "th" | "en";
  theme: "light" | "dark";
  autoSaveChat: boolean;
}

export interface ProviderStatus {
  name: string;
  healthy: boolean;
  latency: number; // ms
}

/* -------------------------------------------------------------------------- */
/*  Notification Context                                                      */
/* -------------------------------------------------------------------------- */

interface NotificationContextValue {
  notifications: Notification[];
  notify: (input: NotificationInput) => void;
  dismissNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timerRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    return () => {
      timerRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  const notify = useCallback(
    (input: NotificationInput) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newNotif: Notification = {
        id,
        message: input.message,
        type: input.type ?? "info",
        timestamp: Date.now(),
      };

      setNotifications((prev) => [...prev, newNotif]);

      const timeout = setTimeout(() => {
        dismissNotification(id);
      }, 5000);

      timerRef.current.set(id, timeout);
    },
    [/* no deps */],
  );

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const timeout = timerRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timerRef.current.delete(id);
    }
  }, []);

  const value = useMemo(
    () => ({ notifications, notify, dismissNotification }),
    [notifications, notify, dismissNotification],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return ctx;
}

/* -------------------------------------------------------------------------- */
/*  User Preferences Context                                                  */
/* -------------------------------------------------------------------------- */

interface UserPreferencesContextValue {
  preferences: UserPreferences;
  updatePreferences: (partial: Partial<UserPreferences>) => void;
}

const STORAGE_KEY_PREFS = "innomcp_preferences";

const DEFAULT_PREFERENCES: UserPreferences = {
  language: "th",
  theme: "light",
  autoSaveChat: true,
};

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(null);

function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    if (typeof window === "undefined") return DEFAULT_PREFERENCES;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PREFS);
      if (raw) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_PREFERENCES;
  });

  // Persist to localStorage whenever preferences change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(preferences));
    }
  }, [preferences]);

  const updatePreferences = useCallback(
    (partial: Partial<UserPreferences>) => {
      setPreferences((prev) => ({ ...prev, ...partial }));
    },
    [],
  );

  const value = useMemo(
    () => ({ preferences, updatePreferences }),
    [preferences, updatePreferences],
  );

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

function useUserPreferences() {
  const ctx = useContext(UserPreferencesContext);
  if (!ctx) {
    throw new Error(
      "useUserPreferences must be used within UserPreferencesProvider",
    );
  }
  return ctx;
}

/* -------------------------------------------------------------------------- */
/*  Provider Health Context                                                   */
/* -------------------------------------------------------------------------- */

interface ProviderHealthContextValue {
  mdesHealthy: boolean;
  providerStatuses: ProviderStatus[];
}

const ProviderHealthContext = createContext<ProviderHealthContextValue | null>(null);

function ProviderHealthProvider({ children }: { children: React.ReactNode }) {
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [mdesHealthy, setMdesHealthy] = useState(true);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/provider-health"); // Adjust to your actual endpoint
      if (res.ok) {
        const data = await res.json();
        setProviderStatuses(data.providers ?? []);
        setMdesHealthy(data.mdesHealthy ?? true);
      } else {
        // Fallback: assume healthy if endpoint unavailable
        setMdesHealthy(true);
        setProviderStatuses([]);
      }
    } catch {
      // Graceful degradation
      setMdesHealthy(true);
      setProviderStatuses([]);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30_000); // every 30 seconds
    return () => clearInterval(interval);
  }, [checkHealth]);

  const value = useMemo(
    () => ({ mdesHealthy, providerStatuses }),
    [mdesHealthy, providerStatuses],
  );

  return (
    <ProviderHealthContext.Provider value={value}>
      {children}
    </ProviderHealthContext.Provider>
  );
}

function useProviderHealth() {
  const ctx = useContext(ProviderHealthContext);
  if (!ctx) {
    throw new Error(
      "useProviderHealth must be used within ProviderHealthProvider",
    );
  }
  return ctx;
}

/* -------------------------------------------------------------------------- */
/*  Chat History Context                                                      */
/* -------------------------------------------------------------------------- */

interface ChatConversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: number;
}

interface ChatHistoryContextValue {
  totalConversations: number;
  clearAllHistory: () => void;
}

const STORAGE_KEY_CHAT = "innomcp_chat_history";

const ChatHistoryContext = createContext<ChatHistoryContextValue | null>(null);

function ChatHistoryProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<ChatConversation[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CHAT);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return [];
  });

  // You may want to synchronise conversations array with localStorage
  // For now we only need totalConversations and clearAllHistory.
  // If conversations are modified elsewhere, they should update this list.

  const totalConversations = conversations.length;

  const clearAllHistory = useCallback(() => {
    setConversations([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY_CHAT);
    }
  }, []);

  const value = useMemo(
    () => ({ totalConversations, clearAllHistory }),
    [totalConversations, clearAllHistory],
  );

  return (
    <ChatHistoryContext.Provider value={value}>
      {children}
    </ChatHistoryContext.Provider>
  );
}

function useChatHistory() {
  const ctx = useContext(ChatHistoryContext);
  if (!ctx) {
    throw new Error(
      "useChatHistory must be used within ChatHistoryProvider",
    );
  }
  return ctx;
}

/* -------------------------------------------------------------------------- */
/*  INNOMCP Combined Context                                                  */
/* -------------------------------------------------------------------------- */

interface INNOMCPContextValue {
  notifications: Notification[];
  notify: (n: NotificationInput) => void;
  dismissNotification: (id: string) => void;
  preferences: UserPreferences;
  updatePreferences: (partial: Partial<UserPreferences>) => void;
  mdesHealthy: boolean;
  providerStatuses: ProviderStatus[];
  totalConversations: number;
  clearAllHistory: () => void;
}

const INNOMCPContext = createContext<INNOMCPContextValue | null>(null);

function INNOMCPInnerProvider({ children }: { children: React.ReactNode }) {
  const { notifications, notify, dismissNotification } = useNotifications();
  const { preferences, updatePreferences } = useUserPreferences();
  const { mdesHealthy, providerStatuses } = useProviderHealth();
  const { totalConversations, clearAllHistory } = useChatHistory();

  const value = useMemo<INNOMCPContextValue>(
    () => ({
      notifications,
      notify,
      dismissNotification,
      preferences,
      updatePreferences,
      mdesHealthy,
      providerStatuses,
      totalConversations,
      clearAllHistory,
    }),
    [
      notifications,
      notify,
      dismissNotification,
      preferences,
      updatePreferences,
      mdesHealthy,
      providerStatuses,
      totalConversations,
      clearAllHistory,
    ],
  );

  return (
    <INNOMCPContext.Provider value={value}>{children}</INNOMCPContext.Provider>
  );
}

export function INNOMCPProvider({ children }: { children: React.ReactNode }) {
  return (
    <NotificationProvider>
      <UserPreferencesProvider>
        <ProviderHealthProvider>
          <ChatHistoryProvider>
            <INNOMCPInnerProvider>{children}</INNOMCPInnerProvider>
          </ChatHistoryProvider>
        </ProviderHealthProvider>
      </UserPreferencesProvider>
    </NotificationProvider>
  );
}

/**
 * Hook to access the unified INNOMCP global state.
 * Must be used within INNOMCPProvider.
 */
export function useINNOMCP(): INNOMCPContextValue {
  const ctx = useContext(INNOMCPContext);
  if (!ctx) {
    throw new Error("useINNOMCP must be used within INNOMCPProvider");
  }
  return ctx;
}

/* Optional re‑exports for convenience */
export { NotificationContext, NotificationProvider, useNotifications } from "./notification-context"; // not needed but can be useful; omitted for self‑containment