"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface AuthContextType {
  isLoggedIn: boolean;
  setIsLoggedIn: (v: boolean) => void;
  userId: number | null;
  setUserId: (v: number | null) => void;
  userDispName: string | null;
  setUserDispName: (v: string | null) => void;
  userRoleId: number | null;
  setUserRoleId: (v: number | null) => void;
  hostname: string;
  setHostname: (v: string) => void;
  isAuthLoading: boolean;
  setIsAuthLoading: (v: boolean) => void;
  checkAuth: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [userDispName, setUserDispName] = useState<string | null>(null);
  const [userRoleId, setUserRoleId] = useState<number | null>(null);
  const [hostname, setHostname] = useState("localhost");
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Exported checkAuth function
  const checkAuth = async () => {
    if (typeof window !== "undefined") {
      setHostname(window.location.hostname);
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch("/api/user/login/auth", {
        method: "GET",
        credentials: "include",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        setUserDispName(data.user?.user_dispname || null);
        if (data.user && typeof data.user.user_id !== "undefined") {
          const id = Number(data.user.user_id);
          setUserId(!isNaN(id) ? id : null);
        } else {
          setUserId(null);
        }
        if (data.user && typeof data.user.userrole_id !== "undefined") {
          setUserRoleId(data.user.userrole_id);
        } else {
          setUserRoleId(null);
        }
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
        setUserDispName(null);
        setUserId(null);
        setUserRoleId(null);
      }
    } catch {
      setIsLoggedIn(false);
      setUserDispName(null);
      setUserId(null);
      setUserRoleId(null);
    } finally {
      setIsAuthLoading(false);
    }
  };

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
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        setIsLoggedIn,
        userId: userId,
        setUserId,
        userDispName: userDispName,
        setUserDispName,
        userRoleId: userRoleId,
        setUserRoleId,
        hostname,
        setHostname,
        isAuthLoading,
        setIsAuthLoading,
        checkAuth,
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
