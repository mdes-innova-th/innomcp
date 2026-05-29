"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";

type RecheckState = "idle" | "checking" | "done";

export function useProtectedRoute() {
  const router = useRouter();
  const { isLoggedIn, isAuthLoading, checkAuth } = useAuth();
  const [recheckState, setRecheckState] = useState<RecheckState>("idle");
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isLoggedIn || isAuthLoading || recheckState !== "idle") {
      return;
    }

    setRecheckState("checking");

    void checkAuth().finally(() => {
      if (mountedRef.current) {
        setRecheckState("done");
      }
    });
  }, [checkAuth, isAuthLoading, isLoggedIn, recheckState]);

  useEffect(() => {
    if (isLoggedIn || isAuthLoading || recheckState !== "done") {
      return;
    }
    router.replace("/login");
  }, [isAuthLoading, isLoggedIn, recheckState, router]);

  return {
    isLoggedIn,
    isAuthLoading: isAuthLoading || recheckState === "checking",
  };
}
