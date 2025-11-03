import { fetchWithCSRF } from "@/utils/csrf";

interface LoginResponseMessage {
  type: "loginSuccess" | "loginFailure";
  message: string;
  error?: string;
  userData?: {
    user_id?: number;
    username?: string;
    user_dispname?: string;
    userrole_id?: number;
    [key: string]: unknown;
  };
  timestamp: number;
}

export async function handlePostMessageLogin({
  firstName,
  lastName,
  birthDate,
  appid,
  apiKey,
  host,
  checkAuth,
  setIsPostMessageLoading,
  setPostMessageError,
  source,
  origin,
}: {
  firstName: string;
  lastName: string;
  birthDate: string;
  appid: string;
  apiKey: string;
  host: string;
  checkAuth: () => Promise<void>;
  setIsPostMessageLoading: (loading: boolean) => void;
  setPostMessageError: (msg: string) => void;
  source?: MessageEventSource | null;
  origin?: string;
}) {
  try {
    setIsPostMessageLoading(true);
    setPostMessageError("");
    let csrfToken = "";
    try {
      const csrfResponse = await fetch("/api/csrf");
      const csrfData = await csrfResponse.json();
      csrfToken = csrfData.csrfToken;
    } catch {
      setPostMessageError("ไม่สามารถขอโทเค็น CSRF สำหรับการล็อกอินได้");
      setIsPostMessageLoading(false);
      return;
    }
    const requestBody = { firstName, lastName, birthDate, appid, apiKey };
    const requestHeaders = {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    };
    const response = await fetchWithCSRF(
      `${host}/api/user/login/auth-postmessage`,
      {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      }
    );
    const targetOrigin = origin ?? "*";
    const postReply = (msg: LoginResponseMessage) => {
      try {
        if (source && typeof (source as Window)?.postMessage === "function") {
          (source as Window).postMessage(msg, targetOrigin);
          return;
        }
        if (window.opener && typeof window.opener.postMessage === "function") {
          window.opener.postMessage(msg, targetOrigin);
          return;
        }
        if (
          window.parent &&
          window.parent !== window &&
          typeof window.parent.postMessage === "function"
        ) {
          window.parent.postMessage(msg, targetOrigin);
          return;
        }
      } catch {}
    };
    if (response.status === 401) {
      setPostMessageError("ข้อมูลการยืนยันตัวตนไม่ถูกต้อง");
      postReply({
        type: "loginFailure",
        error: "Authentication failed",
        message: "ข้อมูลการยืนยันตัวตนไม่ถูกต้อง",
        timestamp: Date.now(),
      });
    } else if (response.status === 403) {
      setPostMessageError("การเข้าถึงถูกปฏิเสธ กรุณาลองใหม่อีกครั้ง");
      postReply({
        type: "loginFailure",
        error: "Access forbidden",
        message: "การเข้าถึงถูกปฏิเสธ",
        timestamp: Date.now(),
      });
    } else if (!response.ok) {
      setPostMessageError(
        "ไม่สามารถล็อกอินผ่าน Post Message ได้ กรุณาลองใหม่อีกครั้ง"
      );
      postReply({
        type: "loginFailure",
        error: "Server error",
        message: "ไม่สามารถล็อกอินผ่าน Post Message ได้",
        timestamp: Date.now(),
      });
    } else {
      await checkAuth();
      try {
        const userData = await response.json();
        postReply({
          type: "loginSuccess",
          message: "ล็อกอินสำเร็จ",
          userData: userData || { displayName: `${firstName} ${lastName}` },
          timestamp: Date.now(),
        });
      } catch {
        postReply({
          type: "loginSuccess",
          message: "ล็อกอินสำเร็จ",
          timestamp: Date.now(),
        });
      }
    }
  } catch {
    setPostMessageError("เกิดข้อผิดพลาดในการล็อกอินผ่าน Post Message");
  } finally {
    setIsPostMessageLoading(false);
  }
}
