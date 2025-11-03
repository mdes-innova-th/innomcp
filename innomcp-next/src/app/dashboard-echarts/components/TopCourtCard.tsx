"use client";

import { useState, useEffect } from "react";
import { useRef } from "react";
import { useRealTime } from "@/app/dashboard-echarts/context/RealTimeContext";
import LoadingSpinner from "@/app/components/common/ui/loading-spinner";
import { fetchWithApiProxy } from "@/app/lib/apiProxy";

interface TopCourtData {
  group_id: number;
  group_name: string;
  court_count: number;
  url_count: number;
  compliance_rate: number;
  total_orders?: number;
  total_urls?: number;
  percentage?: number;
}

interface TopCourtProps {
  cornerLabel?: string;
  toprank?: number; // จำนวนแถวที่แสดงผล (ไม่ใช่ limit ใน SQL)
}

const TopCourtCard = ({ cornerLabel, toprank }: TopCourtProps) => {
  const [data, setData] = useState<TopCourtData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const host = process.env.NEXT_PUBLIC_NODE_HOST || "";

  // Hook: generate a dynamic CSS class that sets width to the given percent.
  // This avoids using inline style attributes for dynamic widths.
  const dynamicStyleRef = useRef<HTMLStyleElement | null>(null);
  const ensureDynamicClass = (percent: number, key: string) => {
    const clamped = Math.max(0, Math.min(100, Math.round(percent * 100) / 100));
    const className = `pw-${clamped.toString().replace('.', '_')}-${key}`;
    if (!dynamicStyleRef.current) {
      const s = document.createElement('style');
      s.setAttribute('data-generated', 'progress-width');
      document.head.appendChild(s);
      dynamicStyleRef.current = s;
    }
    const sheet = dynamicStyleRef.current!;
    const css = `.${className} { width: ${clamped}%; }`;
    if (!sheet.innerHTML.includes(css)) {
      sheet.innerHTML += css;
    }
    return className;
  };

  // Generate random colors for categories
  const generateRandomColors = (count: number): string[] => {
    const colors = [
      "bg-red-500",
      "bg-blue-500",
      "bg-green-500",
      "bg-yellow-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-teal-500",
      "bg-orange-500",
      "bg-cyan-500",
      "bg-lime-500",
      "bg-emerald-500",
      "bg-violet-500",
      "bg-fuchsia-500",
      "bg-rose-500",
      "bg-amber-500",
    ];

    // Shuffle colors array to make selection more random
    const shuffled = [...colors].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, colors.length));
  };

  const { data: realtimeData, lastUpdateTime } = useRealTime();

  // Initial load
  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await fetchWithApiProxy(
          `${host}/api/urlstats/topcourt`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        const resultData = result?.data || result || [];
        if (!Array.isArray(resultData)) {
          console.warn("API response is not an array:", resultData);
          setData([]);
          return;
        }
        const validatedData = resultData.filter(
          (item: unknown): item is TopCourtData => {
            if (!item || typeof item !== "object" || item === null)
              return false;
            const obj = item as Record<string, unknown>;
            return (
              "group_id" in obj &&
              "group_name" in obj &&
              typeof obj.group_name === "string"
            );
          }
        );
        const sortedData = validatedData.sort(
          (a: TopCourtData, b: TopCourtData) =>
            (Number(b.court_count) || 0) - (Number(a.court_count) || 0)
        );
        if (mounted) setData(sortedData);
      } catch (err) {
        console.error("Error fetching top court categories:", err);
        if (mounted)
          setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    return () => {
      mounted = false;
    };
  }, [host]);

  // Realtime refresh (no spinner)
  useEffect(() => {
    if (!lastUpdateTime) return;
    let mounted = true;
    const refresh = async () => {
      try {
        setIsRefreshing(true);
        const result = await fetchWithApiProxy(
          `${host}/api/urlstats/topcourt`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        const resultData = result?.data || result || [];
        if (!Array.isArray(resultData)) return;
        const validatedData = resultData.filter(
          (item: unknown): item is TopCourtData => {
            if (!item || typeof item !== "object" || item === null)
              return false;
            const obj = item as Record<string, unknown>;
            return (
              "group_id" in obj &&
              "group_name" in obj &&
              typeof obj.group_name === "string"
            );
          }
        );
        const sortedData = validatedData.sort(
          (a: TopCourtData, b: TopCourtData) =>
            (Number(b.court_count) || 0) - (Number(a.court_count) || 0)
        );
        if (mounted) setData(sortedData);
      } catch (err) {
        console.error("Error refreshing top court categories:", err);
      } finally {
        if (mounted) setIsRefreshing(false);
      }
    };
    refresh();
    return () => {
      mounted = false;
    };
  }, [lastUpdateTime, host]);

  useEffect(() => {
    if (realtimeData) {
      console.log("[TopCourtCard] Realtime update received");
    }
  }, [realtimeData]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-lg relative">
        {cornerLabel && (
          <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">
            {cornerLabel}
          </div>
        )}
        <div className="flex justify-center items-center h-32">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-lg relative">
        {cornerLabel && (
          <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">
            {cornerLabel}
          </div>
        )}
        <div className="text-center text-red-500 py-8">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const colors = generateRandomColors(data.length);

  // Apply toprank limit to display only specified number of items
  const displayData = toprank && toprank > 0 ? data.slice(0, toprank) : data;

  // Get total court orders and URLs from the API response (all categories have the same total values)
  const totalCourtOrders = data.length > 0 ? data[0].total_orders || 0 : 0;
  const totalUrls = data.length > 0 ? data[0].total_urls || 0 : 0;

  return (
    <div className="bg-white rounded-lg p-6 shadow-lg relative">
      {cornerLabel && (
        <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">
          {cornerLabel}
        </div>
      )}
      {isRefreshing && (
 <div className="flex absolute top-0 left-0 m-1 p-1 text-[15px] text-gray-700">
            <LoadingSpinner color="red" size="sm" type="dots" />
        </div>
      )}
      <div className="inline-block font-semibold text-sm text-gray-400 p-0.5 rounded mb-2">
        {totalCourtOrders.toLocaleString()} ORDERS {" | "}
        {totalUrls.toLocaleString()} URLS
      </div>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {displayData.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>ไม่มีข้อมูล</p>
          </div>
        ) : (
          displayData.map((category, index) => {
            // Add safety checks for category object
            if (!category || typeof category !== "object") {
              console.warn("Invalid category data at index", index, category);
              return null;
            }

            const color = colors[index] || colors[0];
            const percentage = Number(category.compliance_rate) || 0;
            const progressWidth = Math.max(0, Math.min(percentage, 100)); // Ensure between 0-100
            const displayPercentage = percentage.toFixed(2);

            return (
              <div
                key={category.group_id || index}
                className="flex items-center"
              >
                {/* Category name */}
                <div className="w-32 text-sm text-gray-600 mr-3">
                  {category.group_name || "Unknown"}
                </div>

                {/* Court count and URL count */}
                <div className="inline w-20 text-sm text-gray-900 text-center mr-3 p-1">
                  <div>
                    {(Number(category.court_count) || 0).toLocaleString()}
                    <div className="inline text-xs text-gray-500 bg-gray-200 rounded p-1 ml-1">
                      {(Number(category.url_count) || 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="flex-1 bg-gray-200 rounded h-8 relative">
                  <div
                    className={`${color} h-8 rounded transition-all duration-300 ${ensureDynamicClass(progressWidth, String(category.group_id || index))}`}
                  ></div>
                  <span
                    className={`absolute inset-0 flex items-center justify-center font-semibold text-sm ${
                      percentage > 0 ? "text-gray-900" : "text-gray-200"
                    }`}
                  >
                    {displayPercentage}%
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TopCourtCard;
