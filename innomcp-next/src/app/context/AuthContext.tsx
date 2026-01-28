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
  
  // Guest mode: users can use chat without login (50% capability by default)
  // Authenticated users get 100% capability
  const isGuestMode = !isLoggedIn;
  const capabilityLevel = isLoggedIn ? 100 : 50;

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
        setUserEmail(data.user?.user_email || null);
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
        setUserEmail(null);
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
  const logout = async () => {
    console.log('🚪 [AuthContext] Logout called');
    try {
      await fetch('http://localhost:3011/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      console.log('✅ [AuthContext] Logout successful');
    } catch (error) {
      console.error('❌ [AuthContext] Logout error:', error);
    } finally {
      setIsLoggedIn(false);
      setUserId(null);
      setUserEmail(null);
      setUserDispName(null);
      setUserRoleId(null);
      console.log('🔓 [AuthContext] User state cleared (now Guest - 50% capability)');
    }
  };

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
