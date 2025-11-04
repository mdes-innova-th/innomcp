"use client";

import React from "react";
import Logo from "@/assets/images/logo.svg";
import { useTheme } from "@/app/context/ThemeContext";
import { FaMoon, FaSun } from "react-icons/fa";
import { FaHome } from "react-icons/fa";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/app/context/AuthContext";
import { FaSignOutAlt, FaKey, FaUser } from "react-icons/fa";
import LoadingSpinner from "@/app/components/common/ui/loading-spinner";
import Image from "next/image";
import {
  buttonClass,
  logoutButtonClass,
  desktopButtonClass,
  disabledButtonClass,
} from "@/app/components/common/ui/button-styles";

import { fetchWithCSRF } from "@/utils/csrf";

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const {
    isLoggedIn,
    setIsLoggedIn,
    setUserId,
    userDispName: userDispName,
    setUserDispName,
    userRoleId: userRoleId,
    setUserRoleId,
    isAuthLoading,
  } = useAuth();

  // Logout logic with CSRF
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const response = await fetchWithCSRF("/api/user/logout", {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        setIsLoggedIn(false);
        setUserId(null);
        setUserDispName(null);
        setUserRoleId(null);
        // Use window.location.href instead of router.push to ensure a full page reload
        window.location.href = "/";
        setIsLoggingOut(false);
      } else {
        console.error("Logout failed with status:", response.status);
        setIsLoggingOut(false);
      }
    } catch (error) {
      console.error("Logout error:", error);
      setIsLoggingOut(false);
      // Fallback logout mechanism
      setIsLoggedIn(false);
      setUserId(null);
      setUserDispName(null);
      setUserRoleId(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("urPagination");
        window.location.href = "/";
      }
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("urPagination");
      }
    }
  };

  return (
    <header className="w-full text-gray-700 dark:text-gray-200">
      <div className="w-full flex justify-between items-center p-1 ms-5 sm:px-1 app-name-section">
        <div className="w-full h-full m-1 flex items-center justify-center">
          <div className="flex items-center justify-center">
            <div className="hidden sm:flex items-start">
              <Image
                src="/assets/images/mdes-new-logo.png"
                className="w-auto h-auto m-1 p-0 max-h-[150px] max-w-[250px]"
                alt="MDES Logo"
                loading="eager"
                width={250}
                height={150}
                unoptimized
              />
            </div>
            <div className="flex items-start">
              <Logo className="w-auto h-auto m-1 p-0 max-h-[100px] max-w-[200px]" aria-label="Logo" />
            </div>
          </div>
        </div>
        <div className="invisible">{/* Placeholder for balance */}</div>
      </div>
      {/* Bottom row: user/login menu */}
      <div className="w-full flex flex-wrap justify-center items-center py-1">
        {isAuthLoading ? (
          <LoadingSpinner color={theme === "dark" ? "white" : "black"} />
        ) : isLoggedIn ? (
          <>
            <div className="items-center gap-2 inline-flex">
              <span
                className="text-lg font-semibold mr-2"
                style={{
                  color: theme === 'dark' ? '#ffffff' : '#374151'
                }}
                title={userDispName || undefined}
              >
                สวัสดี {userDispName}
                {", "}
              </span>
              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  className="rounded-0 mb-2 flex items-center justify-center cursor-pointer transition-colors"
                  style={{
                    color: theme === 'dark' ? '#ffffff' : '#374151'
                  }}
                  aria-label="หน้าแรก"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = theme === 'dark' ? '#60a5fa' : '#3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = theme === 'dark' ? '#ffffff' : '#374151';
                  }}
                >
                  <FaHome size={23} />
                </Link>
                <button
                  onClick={toggleTheme}
                  aria-label={
                    theme === "dark"
                      ? "เปลี่ยนเป็นโหมดสว่าง"
                      : "เปลี่ยนเป็นโหมดมืด"
                  }
                  className="mx-2 px-3 py-1 rounded-lg border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2 shadow hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  {theme === "dark" ? (
                    <FaSun size={18} />
                  ) : (
                    <FaMoon size={18} />
                  )}
                </button>
              </div>
            </div>
            {/* ปุ่มสำหรับ userRoleId 0 (admin) */}
            {userRoleId === 0 && (
              <>
                <button
                  onClick={() => {
                    router.push("/apikey");
                  }}
                  className={`${buttonClass} ${desktopButtonClass} text-base mx-2`}
                >
                  <FaKey size={16} className="mr-1" />
                  API Key
                </button>
                <button
                  onClick={() => {
                    router.push("/user");
                  }}
                  className={`${buttonClass} ${desktopButtonClass} text-base mx-2`}
                >
                  <FaUser size={16} className="mr-1" />
                  จัดการผู้ใช้
                </button>
              </>
            )}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={`${logoutButtonClass} ${desktopButtonClass} ${
                isLoggingOut ? disabledButtonClass : ""
              } text-base`}
            >
              <FaSignOutAlt size={16} className="mr-1" />
              {isLoggingOut ? (
                <span className="flex items-center">
                  <LoadingSpinner color="red" />
                  <span className="ml-1">ออกจากระบบ...</span>
                </span>
              ) : (
                "ออกจากระบบ"
              )}
            </button>
          </>
        ) : null}
      </div>
    </header>
  );
}
