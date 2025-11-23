"use client";

import React from "react";
import { useTheme } from "@/app/context/ThemeContext";
import { FaMoon, FaSun } from "react-icons/fa";
import { FaHome } from "react-icons/fa";
import { useRouter, usePathname } from "next/navigation";
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
  const pathname = usePathname();
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
    <>
      <header
        className={`fixed inset-x-0 top-0 flex flex-col text-gray-700 dark:text-gray-200 z-50 ${
          theme === "dark" ? "bg-gray-950/90" : "bg-indigo-900"
        } shadow-md`}
      >
        <div className="w-full flex justify-between items-center px-5 py-1 app-name-section">
          <div className="w-full h-full m-1 flex items-center justify-center">
            <div className="flex items-center justify-center">
              <div className="hidden sm:flex items-start">
                <div className="relative m-2 w-40 h-10">
                  <Image
                    src="/mdes-new-logo.png"
                    className="object-contain"
                    alt="MDES Logo"
                    priority
                    fill
                  />
                </div>
              </div>
              <div className="flex items-start">
                <div className="relative m-2 w-40 h-10">
                  <Image
                    src="/logo.png"
                    className="object-contain h-12"
                    alt="InnoMCP Logo"
                    priority
                    fill
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() =>
                      router.push("https://wddsb.dataxo.info/complex-chart")
                    }
                    className={`px-4 py-2 ${
                      pathname === "/complex-chart"
                        ? "bg-indigo-500 border-2 border-indigo-400"
                        : "bg-none"
                    } text-white rounded-3xl hover:bg-indigo-500 transition flex items-center gap-2 cursor-pointer`}
                  >
                    <i className="fa-solid fa-chart-column text-2xl"></i>
                    COMPLEX CHART
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      router.push("https://wddsb.dataxo.info/search-url")
                    }
                    className={`px-4 py-2 ${
                      pathname === "/search-url"
                        ? "bg-indigo-500 border-2 border-indigo-400"
                        : "bg-none"
                    } text-white rounded-3xl hover:bg-indigo-500 transition flex items-center gap-2 cursor-pointer`}
                  >
                    <i className="fa-solid fa-search text-2xl"></i>
                    ค้นหา URL
                  </button>
                  <Image
                    src="/aoc-mule.png"
                    alt="AOC Logo"
                    width={50}
                    height={24}
                    onClick={() => router.push("https://aoc.dataxo.info")}
                    className="cursor-pointer"
                  />
                </div>
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
                  className={`text-lg font-semibold mr-2 ${
                    theme === "dark" ? "text-white" : "text-gray-700"
                  }`}
                  title={userDispName || undefined}
                >
                  สวัสดี {userDispName}
                  {", "}
                </span>
                <div className="flex items-center gap-2">
                  <Link
                    href="/"
                    className={`rounded-0 mb-2 flex items-center justify-center cursor-pointer transition-colors ${
                      theme === "dark"
                        ? "text-white hover:text-blue-400"
                        : "text-gray-700 hover:text-blue-500"
                    }`}
                    aria-label="หน้าแรก"
                  >
                    <FaHome size={23} />
                  </Link>
                  {/* Theme toggle removed from inline header — now rendered as a fixed bottom-left button below */}
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

      {/* Fixed theme toggle button at bottom-left */}
      <button
        onClick={toggleTheme}
        aria-label={
          theme === "dark" ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"
        }
        title={theme === "dark" ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
        className="fixed left-2 bottom-2 z-99 w-11 h-11 p-2 rounded-full border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-700 dark:text-gray-200 shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-transform transform hover:scale-105 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 cursor-pointer"
      >
        {theme === "dark" ? <FaSun size={20} /> : <FaMoon size={20} />}
        <span className="sr-only">
          {theme === "dark" ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
        </span>
      </button>
    </>
  );
}
