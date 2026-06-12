"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

interface AuthContextType {
  isLoggedIn: boolean;
  setIsLoggedIn: (v: boolean) => void;
  userId: number | null;
  setUserId: (v: number | null) => void;
  userEmail: string | null;
  setUserEmail: (v: string | null) => void;
  userDispName: string | null;
  setUserDispName: (v: string | null) => void;
  userRoleId: number | null;
  setUserRoleId: (v: number | null) => void;
  hostname: string;
  setHostname: (v: string) => void;
  isAuthLoading: boolean;
  setIsAuthLoading: (v: boolean) => void;
  isGuestMode: boolean;
  capabilityLevel: number;
  checkAuth: () => Promise<void>;
  login: (userData: { userId: number; email: string; displayName: string; roleId: number }) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userDispName, setUserDispName] = useState<string | null>(null);
  const [userRoleId, setUserRoleId] = useState<number | null>(null);
  const [hostname, setHostname] = useState("localhost");
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const BACKEND =
    typeof window !== "undefined" && window.location.port === "3000"
      ? "http://localhost:3015"
      : "";
  
  // Guest mode: users can use chat without login (50% capability by default)
  // Authenticated users get 100% capability
  const isGuestMode = !isLoggedIn;
  const capabilityLevel = isLoggedIn ? 100 : 50;

  // Exported checkAuth function
  const clearAuthState = useCallback(() => {
    setIsLoggedIn(false);
    setUserEmail(null);
    setUserDispName(null);
    setUserId(null);
    setUserRoleId(null);
  }, []);

  const applyUser = useCallback((user: Record<string, unknown> | null | undefined) => {
    if (!user) {
      clearAuthState();
      return;
    }

    const rawId = user.user_id ?? user.userId;
    const numericId =
      typeof rawId === "number"
        ? rawId
        : typeof rawId === "string"
        ? Number(rawId)
        : null;
    const rawRole = user.userrole_id ?? user.userRoleId ?? null;
    const numericRole =
      typeof rawRole === "number"
        ? rawRole
        : typeof rawRole === "string"
        ? Number(rawRole)
        : null;

    setUserEmail((user.user_email as string) ?? (user.userEmail as string) ?? null);
    setUserDispName(
      (user.user_dispname as string) ?? (user.userDispName as string) ?? null
    );
    setUserId(numericId !== null && !Number.isNaN(numericId) ? numericId : null);
    setUserRoleId(
      numericRole !== null && !Number.isNaN(numericRole) ? numericRole : null
    );
    setIsLoggedIn(true);
  }, [clearAuthState]);

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`${BACKEND}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      return response.ok;
    } catch {
      return false;
    }
  }, [BACKEND]);

  const checkAuth = useCallback(async () => {
    if (typeof window !== "undefined") {
      setHostname(window.location.hostname);
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${BACKEND}/api/auth/me`, {
        method: "GET",
        credentials: "include",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        applyUser(data.user);
      } else if (response.status === 401 || response.status === 403) {
        const refreshed = await refreshAuth();
        if (refreshed) {
          const retryResponse = await fetch(`${BACKEND}/api/auth/me`, {
            method: "GET",
            credentials: "include",
          });
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            applyUser(retryData.user);
          } else {
            clearAuthState();
          }
        } else {
          clearAuthState();
        }
      } else {
        clearAuthState();
      }
    } catch {
      clearAuthState();
    } finally {
      setIsAuthLoading(false);
    }
  }, [BACKEND, applyUser, clearAuthState, refreshAuth]);

  useEffect(() => {
    // Check if auth is optional (for demo/chat-only mode)
    const authMode = process.env.NEXT_PUBLIC_AUTH_MODE || 'required';
    if (authMode === 'optional') {
      // Skip auth check, allow anonymous access
      setIsLoggedIn(false);
      setIsAuthLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void checkAuth();
      }
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible" && isLoggedIn) {
        void refreshAuth();
      }
    }, 10 * 60 * 1000);

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(intervalId);
    };
  }, [checkAuth, isLoggedIn, refreshAuth]);

  // Login function
  const login = async (userData: { userId: number; email: string; displayName: string; roleId: number }) => {
    console.log('🔐 [AuthContext] Login called');
    console.log('👤 User Data:', {
      userId: userData.userId,
      email: userData.email,
      displayName: userData.displayName,
      roleId: userData.roleId
    });
    
    setUserId(userData.userId);
    setUserEmail(userData.email);
    setUserDispName(userData.displayName);
    setUserRoleId(userData.roleId);
    setIsLoggedIn(true);
    
    console.log(`✅ [AuthContext] Logged in as ${userData.displayName} (Capability: 100%)`);
  };

  // Logout function
  const logout = useCallback(async () => {
    console.log('🚪 [AuthContext] Logout called');
    try {
      await fetch(`${BACKEND}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      console.log('✅ [AuthContext] Logout successful');
    } catch (error) {
      console.error('❌ [AuthContext] Logout error:', error);
    } finally {
      clearAuthState();
      console.log('🔓 [AuthContext] User state cleared (now Guest - 50% capability)');
    }
  }, [BACKEND, clearAuthState]);

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        setIsLoggedIn,
        userId: userId,
        setUserId,
        userEmail: userEmail,
        setUserEmail,
        userDispName: userDispName,
        setUserDispName,
        userRoleId: userRoleId,
        isGuestMode,
        capabilityLevel,
        setUserRoleId,
        hostname,
        setHostname,
        isAuthLoading,
        setIsAuthLoading,
        checkAuth,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
