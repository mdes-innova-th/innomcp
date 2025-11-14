"use client";

import { useTheme } from "@/app/context/ThemeContext";
import { useRouter, usePathname } from "next/navigation";

interface HeaderDashboardProps {
  appname?: string;
}

export default function HeaderChat({ appname }: HeaderDashboardProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const displayAppname =
    appname || process.env.NEXT_PUBLIC_APPNAME || "InnoMCP";

  return (
    <header
      className={`p-4 ${
        theme === "light"
          ? "bg-indigo-700 text-white"
          : "bg-gray-800 text-white"
      }`}
    >
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{displayAppname}</h1>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => router.push("/complex-chart")}
            className={`px-4 py-2 ${pathname === "/complex-chart" ? "bg-indigo-500 border-2 border-indigo-400" : "bg-none"} text-white rounded-3xl hover:bg-indigo-500 transition flex items-center gap-2 cursor-pointer`}
          >
            <i className="fa-solid fa-chart-column text-2xl"></i>
            COMPLEX CHART
          </button>
          <button
            type="button"
            onClick={() => router.push("/search-url")}
            className={`px-4 py-2 ${pathname === "/search-url" ? "bg-indigo-500 border-2 border-indigo-400" : "bg-none"} text-white rounded-3xl hover:bg-indigo-500 transition flex items-center gap-2 cursor-pointer`}
          >
            <i className="fa-solid fa-search text-2xl"></i>
            ค้นหา URL
          </button>
        </div>
      </div>
    </header>
  );
}
