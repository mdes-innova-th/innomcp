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
      {/* Guest mode banner - 🔥 2026 FIX: top-16 no my-8, gap-2px, beautiful gradient */}
      {isGuestMode && (
        <div 
          className={`fixed top-16 left-0 right-0 z-40 px-4 py-3 text-center text-sm border-b shadow-sm ${
            theme === 'light' 
              ? 'bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 text-amber-900 border-amber-200' 
              : 'bg-gradient-to-r from-amber-950/40 via-yellow-950/40 to-amber-950/40 text-amber-200 border-amber-800/50 backdrop-blur-sm'
          }`}
          style={{ marginTop: '2px' }}
        >
          <span>🎯 คุณกำลังใช้งานในโหมดผู้เยี่ยมชม (ประสิทธิภาพ {capabilityLevel}%) • </span>
          <Link 
            href="/login" 
            className={`underline font-semibold transition-colors ${
              theme === 'light' ? 'hover:text-amber-700' : 'hover:text-amber-100'
            }`}
          >
            เข้าสู่ระบบ
          </Link>
          <span> เพื่อใช้งานเต็มประสิทธิภาพ (100%)</span>
        </div>
      )}
      
      {/* Geolocation permission manager */}
      <GeolocationManager />
      
      {/* Responsive container - full width with smart padding */}
      <div className="w-full">
        <div className="mx-auto max-w-screen-2xl px-2 sm:px-4 md:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <ChatPage />
        </div>
      </div>
    </div>
  );
}
