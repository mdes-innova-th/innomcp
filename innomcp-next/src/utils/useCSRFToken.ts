// CSRF logic removed; file intentionally left blank.
"use client";
import { useState, useEffect, useCallback } from "react";
import { getCSRFToken} from "@/utils/csrf";

export function useCSRFToken() {
  const [csrfToken, setCsrfToken] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ดึง token ครั้งแรก
  useEffect(() => {
    let isMounted = true;
    const fetchToken = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getCSRFToken();
        if (isMounted) setCsrfToken(token ?? "");
      } catch {
        setError("ไม่สามารถดึง CSRF token ได้");
      } finally {
        setLoading(false);
      }
    };
    fetchToken();
    return () => {
      isMounted = false;
    };
  }, []);

  // ฟังก์ชัน refresh token
  const refreshToken = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getCSRFToken();
      setCsrfToken(token ?? "");
      return token ?? "";
    } catch {
      setError("ไม่สามารถ refresh CSRF token ได้");
      return "";
    } finally {
      setLoading(false);
    }
  }, []);

  return { csrfToken, loading, error, refreshToken };
}

