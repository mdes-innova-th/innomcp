"use client";

import React from "react";
import Link from "next/link";
import ChatPage from "@/app/components/chat/ChatPage";
import GeolocationManager from "@/app/components/chat/GeolocationManager";
import { useAuth } from "@/app/context/AuthContext";
import { useTheme } from "@/app/context/ThemeContext";

export default function Page() {
  const { isGuestMode, capabilityLevel } = useAuth();
  const { theme } = useTheme();
  
  return (
    <div className="w-full">
      {/* Geolocation permission manager */}
      <GeolocationManager />
      
      {/* Responsive container - full width with smart padding */}
      <div className="w-full">
        <div className="mx-auto max-w-screen-2xl px-2 sm:px-4 md:px-6 lg:px-8 xl:px-12 2xl:px-16">
          {isGuestMode && (
            <div
              className={`mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-1.5 text-xs sm:text-sm ${
                theme === 'light'
                  ? 'border-amber-200/80 bg-amber-50/90 text-amber-950'
                  : 'border-amber-800/40 bg-amber-950/30 text-amber-100'
              }`}
            >
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                Guest
              </span>
              <span className="min-w-0 truncate">
                ใช้งานได้ประมาณ {capabilityLevel}% — ล็อกอินเพื่อเปิด context เต็มรูปแบบ
              </span>
              <Link
                href="/login"
                className={`ml-auto inline-flex items-center justify-center rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  theme === 'light'
                    ? 'bg-amber-900 text-amber-50 hover:bg-amber-950'
                    : 'bg-amber-200 text-amber-950 hover:bg-amber-100'
                }`}
              >
                เข้าสู่ระบบ
              </Link>
            </div>
          )}

          <ChatPage />
        </div>
      </div>
    </div>
  );
}
