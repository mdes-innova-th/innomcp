"use client";

import { useEffect } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { useRouter } from "next/navigation";
import { useTheme } from "@/app/context/ThemeContext";
import LoadingSpinner from "@/app/components/common/ui/loading-spinner";
import SearchURL from "@/app/dashboard-echarts/components/searchurl/SearchURL";
import HeaderDashboard from "@/app/components/HeaderDashboard";

// Search URL Page Component
function SearchURLPageContent() {
  const { theme } = useTheme();

  return (
    // กำหนด layout ของหน้าให้ใกล้เคียงหรือเหมือนกับ page.tsx หน้าแรก
    <div
      className={`min-h-screen mx-4 mt-8 ${
        theme === "light" ? "bg-gray-100" : "bg-transparent"
      }`}
    >
      <HeaderDashboard />

      <div className="p-6">
        <div className="bg-white rounded-lg p-6 shadow-lg">
          <SearchURL />
        </div>
      </div>
    </div>
  );
}

// Main Export
export default function SearchURLPage() {
  const { isLoggedIn, isAuthLoading } = useAuth();
  const router = useRouter();

  // Redirect once auth check completes and user is not logged in
  useEffect(() => {
    if (!isAuthLoading && !isLoggedIn) {
      router.push("/user/login");
    }
  }, [isAuthLoading, isLoggedIn, router]);

  if (isAuthLoading) {
    return (
      <div className="w-full flex items-center justify-center p-8">
        <span className="text-sm text-gray-600">
          <LoadingSpinner color="light-gray" />
        </span>
      </div>
    );
  }

  if (!isLoggedIn) return null; // already redirecting

  return <SearchURLPageContent />;
}
