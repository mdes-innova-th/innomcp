"use client";
import Image from "next/image";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/app/components/common/ui/loading-spinner";
import { useAuth } from "@/app/context/AuthContext";

import { handleFormLogin } from "./handlers/handleFormLogin";
import { handleNameLogin } from "./handlers/handleNameLogin";
import { handleThaiDLogin } from "./handlers/handleThaiDLogin";
import { handlePostMessageLogin } from "./handlers/handlePostMessageLogin";
import { isClientWebView } from "@/utils/webViewDetection";
import { fetchWithCSRF } from "@/utils/csrf";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState(""); // Add display name
  const [birthDate, setBirthDate] = useState(""); // Add birthdate
  const [formError, setFormError] = useState(""); // Error for username/password form
  const [nameFormError, setNameFormError] = useState(""); // Error for name/birthdate form
  const [postMessageError, setPostMessageError] = useState(""); // Error for postMessage login (separate from name form)
  const [thaidError, setThaidError] = useState(""); // Error for ThaiD login
  const [isFormLoading, setIsFormLoading] = useState(false); // Loading for form login
  const [isNameFormLoading, setIsNameFormLoading] = useState(false); // Loading for name/birthdate form login
  const [isPostMessageLoading, setIsPostMessageLoading] = useState(false); // Loading for postMessage login
  const [isThaidLoading, setIsThaidLoading] = useState(false); // Loading for ThaiD login
  const [isLoggedOut] = useState(false);
  const router = useRouter();
  const { isLoggedIn, isAuthLoading, checkAuth } = useAuth();

  // Config flags for login methods with boolean type
  const loginThaid = process.env.NEXT_PUBLIC_LOGIN_THAID === "true";
  const loginForm = process.env.NEXT_PUBLIC_LOGIN_FORM === "true";
  const loginFormName = process.env.NEXT_PUBLIC_LOGIN_FORM_NAME === "true";
  const registrationButton =
    process.env.NEXT_PUBLIC_REGISTRATION_BUTTON === "true";
  const resetPasswordButton =
    process.env.NEXT_PUBLIC_RESETPASSWORD_BUTTON === "true";

  // If set to true, hide all login UI when running inside a WebView
  const webviewHideLogin =
    process.env.NEXT_PUBLIC_WEBVIEW_HIDE_LOGIN === "true";
  const hideLoginUI = webviewHideLogin && isClientWebView();

  const host = process.env.NEXT_PUBLIC_HOST || "http://localhost:3001";

  // Use state for test params and postmessage log
  const [topParams, setTopParams] = useState({});
  const [typeParam, setTypeParam] = useState("");
  const [fnameParam, setFnameParam] = useState("");
  const [lnameParam, setLnameParam] = useState("");
  const [birthParam, setBirthParam] = useState("");
  const [appidParam, setAppidParam] = useState("");
  const [targetParam, setTargetParam] = useState("");
  const [paramPostMessage, setParamPostMessage] = useState({});
  const [initialPostMessage, setInitialPostMessage] = useState({});
  const [typePostMessage, setTypePostMessage] = useState("");
  const [fnamePostMessage, setFnamePostMessage] = useState("");
  const [lnamePostMessage, setLnamePostMessage] = useState("");
  const [birthPostMessage, setBirthPostMessage] = useState("");
  const [appidPostMessage, setAppidPostMessage] = useState("");
  const [targetPostMessage, setTargetPostMessage] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      setTopParams(searchParams.get("params") || {});
      setTypeParam(searchParams.get("type") || "");
      setFnameParam(searchParams.get("firstname") || "");
      setLnameParam(searchParams.get("lastname") || "");
      setBirthParam(searchParams.get("birthdate") || "");
      setAppidParam(searchParams.get("appid") || "");
      setTargetParam(searchParams.get("target") || "");
    }
  }, []);

  // เก็บค่า param postMessage ที่ส่งมา (ถ้ามี) เพื่อใช้ในการ log
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("postMessageLoginData");
        if (stored) {
          const parsed = JSON.parse(stored);
          setParamPostMessage(parsed || {});
          setInitialPostMessage(parsed || {});
          setTypePostMessage(parsed.type || "");
          setFnamePostMessage(parsed.firstName || "");
          setLnamePostMessage(parsed.lastName || "");
          setBirthPostMessage(parsed.birthDate || "");
          setAppidPostMessage(parsed.appid || "");
          setTargetPostMessage(parsed.target || "");
        }
      } catch (e) {
        console.error("[Login] Error parsing postMessageLoginData", e);
      }
    }
  }, []);

  useEffect(() => {
    // ส่ง log ไป backend เมื่อ param พร้อม (หลัง mount)
    if (typeof window !== "undefined") {
      fetchWithCSRF("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topParams,
          typeParam,
          fnameParam,
          lnameParam,
          birthParam,
          appidParam,
          targetParam,
          paramPostMessage,
          initialPostMessage,
          typePostMessage,
          fnamePostMessage,
          lnamePostMessage,
          birthPostMessage,
          appidPostMessage,
          targetPostMessage,
          source: "login-page",
        }),
      });
    } else {
      // กรณี SSR ที่ไม่มี window ให้ส่ง log แบบระบุว่าไม่มี window
      fetchWithCSRF("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "window-undefined": true,
        }),
      });
    }
  }, [
    typeParam,
    fnameParam,
    lnameParam,
    birthParam,
    appidParam,
    targetParam,
    typePostMessage,
    fnamePostMessage,
    lnamePostMessage,
    birthPostMessage,
    appidPostMessage,
    targetPostMessage,
    topParams,
    paramPostMessage,
    initialPostMessage,
  ]);

  // ถ้า login แล้วให้ไปที่หน้า /
  useEffect(() => {
    if (isLoggedIn) {
      router.push("/");
    }
  }, [isLoggedIn, isLoggedOut, router, isAuthLoading]);

  // ตรวจจับ WebView
  useEffect(() => {
    const detectWebView = () => {
      const webViewDetected = isClientWebView();
      if (webViewDetected) {
        console.log("[Login] WebView detected");
      }
    };

    detectWebView();
  }, []);

  // จัดการ ThaiD callback และ postMessage
  useEffect(() => {
    // เพิ่มตัวรับ post message เพื่อรับข้อมูลล็อกอินจากหน้าต่างอื่น
    const messageHandler = (event: MessageEvent) => {
      // ตรวจสอบ origin เพื่อความปลอดภัย (แก้ไขเป็น domain ที่เชื่อถือได้)
      const envOrigins = process.env.NEXT_PUBLIC_POSTMESSAGE_ORIGIN
        ? process.env.NEXT_PUBLIC_POSTMESSAGE_ORIGIN.split(",").map((o) =>
            o.trim()
          )
        : [];

      // Fallback to same origin if env not set
      const fallbackOrigins = [window.location.origin];
      const trustedOrigins = Array.from(
        new Set([...envOrigins, ...fallbackOrigins])
      );

      if (!trustedOrigins.length) {
        console.warn(
          "[Login] Trusted origins are not defined. This may block incoming postMessage."
        );
      }

      // Normalize origin value (some contexts may provide null/empty origin like file:// or sandboxed frames)
      const msgOrigin = event.origin || "null";

      // Allow messages if:
      // - origin is in trustedOrigins
      // - message explicitly targets this endpoint (used by /simpost simulation)
      // - message was posted from the same window (event.source === window)
      // - special-case null/file origins for local/test scenarios
      const allowedByOrigin =
        trustedOrigins.includes(msgOrigin) ||
        trustedOrigins.includes("*") ||
        event.data?.target === "/user/login" ||
        event.source === window ||
        msgOrigin === "null" ||
        msgOrigin === "file://";

      if (!allowedByOrigin) {
        console.warn(`[Login] Untrusted origin: ${event.origin}`);
        return;
      }

      // Support two message shapes: legacy {type: 'postMessageLogin', ...} or {type: 'user/login', payload: {...}}
      if (event.data?.type === "user/login") {
        const { firstName, lastName, birthDate, appid, apiKey } =
          event.data.payload || {};
        if (firstName && lastName && birthDate) {
          console.log("[Login] isPostMessageLoading:", isPostMessageLoading);
          // Pass event.source and event.origin so the handler can reply correctly
          handlePostMessageLogin({
            firstName,
            lastName,
            birthDate,
            appid: appid ? String(appid) : "",
            apiKey: apiKey ? String(apiKey) : "",
            host,
            checkAuth,
            setIsPostMessageLoading,
            setPostMessageError,
            source: event.source,
            origin: event.origin,
          });
        } else {
          console.log("[Login] Invalid payload received:", event.data);
          console.error("[Login] Invalid payload received:", event.data);
        }
      } else if (event.data?.type === "postMessageLogin") {
        const { firstName, lastName, birthDate, target, appid, apiKey } =
          event.data || {};
        setAppidPostMessage(appid || "");
        // setApiKeyPostMessage(apiKey || ""); // ไม่จำเป็นต้องเก็บใน state ถ้าไม่ได้ใช้แสดงผล
        // Accept messages coming from /simpost that include a target property
        if (target && target !== "/user/login") {
          // Ignore messages intended for a different target
          return;
        }
        if (firstName && lastName && birthDate && appid && apiKey) {
          handlePostMessageLogin({
            firstName,
            lastName,
            birthDate,
            appid: String(appid),
            apiKey: String(apiKey),
            host,
            checkAuth,
            setIsPostMessageLoading,
            setPostMessageError,
            source: event.source,
            origin: event.origin,
          });
        } else {
          const missing = [];
          if (!firstName) missing.push("ชื่อ");
          if (!lastName) missing.push("นามสกุล");
          if (!birthDate) missing.push("วันเกิด");
          if (!appid) missing.push("appid");
          if (!apiKey) missing.push("apiKey");
          setPostMessageError(
            `ข้อมูลล็อกอินผ่าน postMessage ไม่ครบ: ${missing.join(", ")}`
          );
          console.error(
            "[Login] Invalid postMessageLogin payload:",
            event.data
          );
        }
      }
    };

    window.addEventListener("message", messageHandler);

    // Fallback: if the sender stored data in sessionStorage before a same-tab navigation
    try {
      const pending = sessionStorage.getItem("postMessageLoginData");
      if (pending) {
        const parsed = JSON.parse(pending);
        if (parsed?.type === "postMessageLogin") {
          const { firstName, lastName, birthDate } = parsed;
          if (firstName && lastName && birthDate) {
            console.log(
              "[Login] Found pending postMessage data in sessionStorage, processing..."
            );
            handlePostMessageLogin({
              firstName,
              lastName,
              birthDate,
              appid: parsed.appid ? String(parsed.appid) : "",
              apiKey: parsed.apiKey ? String(parsed.apiKey) : "",
              host,
              checkAuth,
              setIsPostMessageLoading,
              setPostMessageError,
              source: window,
              origin: window.location.origin,
            });
            sessionStorage.removeItem("postMessageLoginData");
          } else {
            // Show modal if missing fields
            const missing = [];
            if (!firstName) missing.push("ชื่อ");
            if (!lastName) missing.push("นามสกุล");
            if (!birthDate) missing.push("วันเกิด");
            setPostMessageError(
              `ท่านยังไม่ได้ล็อกอิน: โปรดกลับไปล็อกอินบนหน้าแอปพลิเคชัน`
            );
            console.log(
              `[Login] Incomplete postMessage data in sessionStorage, missing: ${missing.join(
                ", "
              )}`
            );
            sessionStorage.removeItem("postMessageLoginData");
          }
        }
      }
    } catch {
      // ignore sessionStorage errors
    }

    return () => {
      window.removeEventListener("message", messageHandler);
    };
  }, [host, checkAuth, isPostMessageLoading]);

  //ห้ามไม่ให้มีอักขระพิเศษใน username และใส่ได้เฉพาะรูปแบบอีเมลที่ถูกต้อง
  const handleUserNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Clear form error when user starts typing
    if (formError) setFormError("");
    // Allow only English letters, numbers, _, -, ., and @
    const usernameRegex = /^[a-zA-Z0-9_.@-]*$/;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (usernameRegex.test(value) || emailRegex.test(value)) {
      setUsername(value);
    }
  };

  // Handle password change with error clearing
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Clear form error when user starts typing
    if (formError) setFormError("");
    setPassword(e.target.value.trim());
  };

  // อนุญาตให้กรอกชื่อที่แสดงได้ทั้งภาษาไทยและภาษาอังกฤษ พร้อมข้อจำกัด
  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Clear name form error when user starts typing
    if (nameFormError) setNameFormError("");

    // ตรวจสอบอักขระที่อนุญาต: ไทย, อังกฤษ, ตัวเลข, ช่องว่าง, จุด, ขีด
    const allowedCharsRegex = /^[a-zA-Z0-9ก-๙\s.\-]*$/;

    // ตรวจสอบความยาว (สูงสุด 100 ตัวอักษร)
    if (value.length <= 100 && allowedCharsRegex.test(value)) {
      // ป้องกันช่องว่างติดกันเกิน 1 ตัว
      const normalizedValue = value.replace(/\s{2,}/g, " ");
      setDisplayName(normalizedValue);
    }
  };

  // Handle birth date change with error clearing
  const handleBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Clear name form error when user starts typing
    if (nameFormError) setNameFormError("");
    setBirthDate(e.target.value);
  };

  // ฟังก์ชันสำหรับล็อกอินด้วย username/password

  // Wrapper สำหรับเรียก handler ที่แยกไฟล์
  const handleFormLoginWrapper = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleFormLogin({
      username,
      password,
      host,
      checkAuth,
      setFormError,
      setIsFormLoading,
    });
  };
  const handleNameLoginWrapper = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleNameLogin({
      displayName,
      birthDate,
      host,
      checkAuth,
      setNameFormError,
      setIsNameFormLoading,
    });
  };

  const handleThaiDLoginWrapper = async () => {
    if (isThaidLoading) return;
    await handleThaiDLogin({
      host,
      setThaidError,
      setIsThaidLoading,
    });
  };

  // ถ้ากำลังเช็ค authen (โหลด context) ให้แสดง LoadingSpinner ก่อน ไม่แสดงฟอร์ม
  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-300 dark:bg-gray-600">
        <LoadingSpinner color="white" />
      </div>
    );
  }

  // ถ้า login แล้ว ให้แสดง LoadingSpinner ขณะรอ redirect
  if (isLoggedIn) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner color="gray" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-start pt-10 m-3">
      {/* Modal for postMessage-based login errors */}
      {postMessageError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full flex flex-col items-center">
            <p className="text-red-600 text-lg font-semibold mb-2 text-center">
              ไม่สามารถเข้าใช้งานได้
            </p>
            <p className="text-gray-800 text-center mb-4">{postMessageError}</p>
          </div>
        </div>
      )}
      {/* ไม่แสดงฟอร์มล็อกอินเมื่อ NEXT_PUBLIC_LOGIN_FORM=false */}
      {loginForm && !hideLoginUI && (
        <form
          onSubmit={handleFormLoginWrapper}
          className="bg-white p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-md mx-auto"
        >
          <h2 className="text-xl sm:text-2xl text-gray-700 dark:text-gray-700 font-bold mb-4 text-center">
            ล็อกอิน
          </h2>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm sm:text-base font-medium mb-1">
              อีเมล หรือ Username
            </label>
            <input
              type="text"
              value={username}
              onChange={handleUserNameChange}
              className="w-full px-3 py-2 border border-gray-400 rounded-md text-black text-base"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm sm:text-base font-medium mb-1">
              รหัสผ่าน
            </label>
            <input
              type="password"
              value={password}
              onChange={handlePasswordChange}
              className="w-full px-3 py-2 border border-gray-400 rounded-md text-black text-base"
              required
            />
          </div>
          <p className="text-red-500 mb-3 text-sm">{formError}</p>
          <button
            type="submit"
            disabled={isFormLoading}
            className={`w-full text-base ${
              isFormLoading
                ? "bg-green-950 cursor-not-allowed"
                : "bg-green-700 hover:bg-green-600 cursor-pointer"
            } text-white font-medium py-2 rounded-md mb-3`}
          >
            {isFormLoading ? (
              <div className="flex items-center justify-center">
                <LoadingSpinner />
                <span className="ml-2">กำลังยืนยันตัวตน</span>
              </div>
            ) : (
              "เข้าใช้งาน"
            )}
          </button>
        </form>
      )}

      {/* ฟอร์มล็อกอินด้วยชื่อและวันเดือนปีเกิด */}
      {loginFormName && !hideLoginUI && (
        <form
          onSubmit={handleNameLoginWrapper}
          className="bg-white p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-md mx-auto mt-2"
        >
          <h2 className="text-xl sm:text-2xl text-gray-700 dark:text-gray-700 font-bold mb-4 text-center">
            ล็อกอินด้วยชื่อและวันเกิด
          </h2>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm sm:text-base font-medium mb-1">
              ชื่อ-นามสกุล
            </label>
            <input
              type="text"
              value={displayName}
              onChange={handleDisplayNameChange}
              placeholder="ระบุชื่อ-นามสกุลที่ลงทะเบียนไว้ (2-100 ตัวอักษร)"
              className="w-full px-3 py-2 border border-gray-400 rounded-md text-black text-base"
              maxLength={100}
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm sm:text-base font-medium mb-1">
              วันเดือนปีเกิด
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={handleBirthDateChange}
              max={new Date().toISOString().split("T")[0]} // ป้องกันการเลือกวันที่ในอนาคต
              className="w-full px-3 py-2 border border-gray-400 rounded-md text-black text-base"
              required
            />
          </div>
          <p className="text-red-500 mb-3 text-sm">{nameFormError}</p>
          <button
            type="submit"
            disabled={isNameFormLoading}
            className={`w-full text-base ${
              isNameFormLoading
                ? "bg-green-950 cursor-not-allowed"
                : "bg-green-700 hover:bg-green-600 cursor-pointer"
            } text-white font-medium py-2 rounded-md mb-3`}
          >
            {isNameFormLoading ? (
              <div className="flex items-center justify-center">
                <LoadingSpinner />
                <span className="ml-2">กำลังยืนยันตัวตน</span>
              </div>
            ) : (
              "เข้าใช้งาน"
            )}
          </button>
        </form>
      )}

      {/* ThaID Login Button - แสดงแยกจากฟอร์ม */}
      {loginThaid && !hideLoginUI && (
        <div className="w-full max-w-md mx-auto mt-4">
          {thaidError && (
            <p className="text-red-500 mb-3 text-sm text-center">
              {thaidError}
            </p>
          )}
          <button
            type="button"
            onClick={handleThaiDLoginWrapper}
            disabled={isThaidLoading}
            className={`w-full text-base ${
              isThaidLoading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-950 hover:bg-blue-700 cursor-pointer"
            } disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 rounded-md mb-3 flex items-center justify-center gap-2`}
          >
            {isThaidLoading ? (
              <LoadingSpinner color="white" />
            ) : (
              <span className="items-center justify-center inline-flex">
                เข้าใช้งานด้วย{" "}
                <Image
                  src={`/api/proxy-image?endpoint=assets/images/thaid.png`}
                  className="object-contain rounded-md inline-flex"
                  alt="ThaID"
                  width={70}
                  height={40}
                  unoptimized
                />
              </span>
            )}
          </button>
        </div>
      )}

      {/* แสดงข้อความเมื่อไม่มีฟอร์มล็อกอินใดๆ */}
      {!loginForm && !loginThaid && (
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-md mx-auto text-center">
          <h2 className="text-xl sm:text-2xl text-gray-700 font-bold mb-4">
            การล็อกอินไม่พร้อมใช้งาน
          </h2>
          <p className="text-gray-600">ระบบล็อกอินถูกปิดการใช้งานชั่วคราว</p>
        </div>
      )}

      {/* Links for reset password and registration */}
      <div className="w-full max-w-md mx-auto mt-4">
        {resetPasswordButton && (
          <button
            type="button"
            onClick={() => router.push("/user/resetpwd")}
            className="w-full text-blue-500 py-2 hover:bg-blue-100 rounded-md hover:text-blue-700 text-base mb-2 transition-colors"
          >
            ลืมรหัสผ่าน?
          </button>
        )}

        {registrationButton && (
          <button
            type="button"
            onClick={() => router.push("/user/register")}
            className="w-full text-blue-500 py-2 hover:bg-blue-100 rounded-md hover:text-blue-700 text-base transition-colors"
          >
            สมัครสมาชิก
          </button>
        )}
      </div>
    </div>
  );
}
