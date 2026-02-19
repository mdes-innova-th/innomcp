"use client";

import React, { useState } from "react";
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
  
  const [showMDESHub, setShowMDESHub] = useState(false);

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

  // เพิ่ม state สำหรับ animated gradient position
  const [gradientPosition, setGradientPosition] = React.useState(0);

  // เพิ่ม mouse move handler สำหรับ animated gradient
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const percentX = e.clientX / window.innerWidth;
      const bgPos = percentX * 100;
      setGradientPosition(bgPos);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <>
      <header
        style={{
          background: theme === 'dark' 
            ? '#000000'
            : `linear-gradient(to right, #ECF4F1 20%, #E8F7F2 40%, #E6F2EE 60%, #F0F8F5 80%, #EDF6F3 100%)`,
          backgroundSize: theme === 'dark' ? '100% 100%' : '200% 100%',
          backgroundPosition: theme === 'dark' ? '0% 0%' : `${gradientPosition}% 0%`,
          transition: 'background 0.2s ease-out, background-position 0.2s ease-out',
        }}
        className={`sticky top-0 z-60 h-16 shadow-md border-b border-border`}
      >
        <div className="w-full flex justify-between items-center px-5 py-1 app-name-section h-full">
          <div className="w-full h-full m-1 flex items-center justify-between">
            <div className="flex items-center justify-between w-full h-full">
              <div className="hidden sm:flex items-center h-full">
                <div className="relative m-2 w-48 h-14">
                  <Image
                    src="/logo.png"
                    className="object-contain"
                    alt="InnoMCP Logo"
                    priority
                    fill
                  />
                </div>
              </div>
              <div className="flex items-center h-full">
                <div className="relative m-2 w-40 h-10">
                  <Image
                    src="/mdes-new-logo.png"
                    className="object-contain"
                    alt="MDES Logo"
                    priority
                    fill
                  />
                </div>

                {/* MDES Hub Dropdown - Icon Only */}
                <div className="relative flex items-center h-full">
                  <button
                    type="button"
                    onClick={() => setShowMDESHub(!showMDESHub)}
                    onBlur={() => setTimeout(() => setShowMDESHub(false), 200)}
                    className={`group p-0 transition-all duration-300 hover:scale-110 cursor-pointer bg-transparent border-none outline-none relative ${
                      theme === 'dark' ? 'bg-black' : 'bg-transparent'
                    }`}
                    title="MDES Hub"
                  >
                    <Image
                      src={theme === 'light' ? '/Mdeshub-icon-light-bg.png' : '/Mdeshub-icon.png'}
                      alt="MDES Hub"
                      width={85}
                      height={56}
                      className="object-contain"
                    />
                    {/* Animated underline highlight */}
                    <span
                      className="pointer-events-none absolute left-4 right-4 bottom-1 h-1 rounded-full bg-gradient-to-r from-primary/60 via-accent/80 to-primary/60 opacity-0 group-hover:opacity-100 group-focus:opacity-100 scale-x-0 group-hover:scale-x-100 group-focus:scale-x-100 transition-all duration-300 origin-center"
                    />
                  </button>

                  {showMDESHub && (
                    <div className="absolute top-full mt-2 right-0 bg-card text-card-foreground rounded-lg shadow-2xl border border-border min-w-[220px] z-[65] overflow-hidden animate-fadeInUp">
                      <div className="py-2">
                        <button
                          type="button"
                          onClick={() => {
                            router.push("https://wddsb.dataxo.info/complex-chart");
                            setShowMDESHub(false);
                          }}
                          className="w-full px-4 py-3 flex items-center gap-3 text-left relative overflow-hidden group transition-colors duration-300"
                        >
                          {/* Animated background highlight */}
                          <span className="absolute left-2 right-2 top-0 bottom-0 bg-accent/20 opacity-0 group-hover:opacity-100 group-focus:opacity-100 scale-x-0 group-hover:scale-x-100 group-focus:scale-x-100 transition-all duration-300 rounded-lg z-0" />
                          <i className="fa-solid fa-chart-column text-xl text-secondary z-10"></i>
                          <span className="font-medium z-10">Complex Chart</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            router.push("https://wddsb.dataxo.info/search-url");
                            setShowMDESHub(false);
                          }}
                          className="w-full px-4 py-3 flex items-center gap-3 text-left relative overflow-hidden group transition-colors duration-300"
                        >
                          <span className="absolute left-2 right-2 top-0 bottom-0 bg-accent/20 opacity-0 group-hover:opacity-100 group-focus:opacity-100 scale-x-0 group-hover:scale-x-100 group-focus:scale-x-100 transition-all duration-300 rounded-lg z-0" />
                          <i className="fa-solid fa-search text-xl text-secondary z-10"></i>
                          <span className="font-medium z-10">ค้นหา URL</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            router.push("https://aoc.dataxo.info");
                            setShowMDESHub(false);
                          }}
                          className="w-full px-4 py-3 flex items-center gap-3 text-left relative overflow-hidden group transition-colors duration-300"
                        >
                          <span className="absolute left-2 right-2 top-0 bottom-0 bg-accent/20 opacity-0 group-hover:opacity-100 group-focus:opacity-100 scale-x-0 group-hover:scale-x-100 group-focus:scale-x-100 transition-all duration-300 rounded-lg z-0" />
                          <Image
                            src="/aoc-mule.png"
                            alt="AOC"
                            width={24}
                            height={24}
                            className="object-contain z-10"
                          />
                          <span className="font-medium z-10">AOC Platform</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="invisible">{/* Placeholder for balance */}</div>
        </div>
        {/* User menu moved to ChatSidebar dropdown */}
      </header>
    </>
  );
}
