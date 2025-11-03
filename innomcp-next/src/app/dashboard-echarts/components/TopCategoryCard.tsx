"use client";

import { useState, useEffect, useRef } from "react";
import { useRealTime } from "@/app/dashboard-echarts/context/RealTimeContext";
import LoadingSpinner from "@/app/components/common/ui/loading-spinner";
import { fetchWithApiProxy } from "@/app/lib/apiProxy";

interface TopCategoryData {
  group_id: number;
  group_name: string;
  contract_count: number;
  compliance_rate: number;
  total_urls?: number;
  percentage?: number;
}

interface TopCategoryProps {
  cornerLabel?: string;
  toprank?: number; // จำนวนแถวที่แสดงผล (ไม่ใช่ limit ใน SQL)
}

const TopCategoryCard = ({ cornerLabel, toprank }: TopCategoryProps) => {
  const [data, setData] = useState<TopCategoryData[]>([]);
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
          `${host}/api/urlstats/topcategory`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        const resultData = result?.data || result || [];
        const sortedData = resultData.sort(
          (a: TopCategoryData, b: TopCategoryData) =>
            b.contract_count - a.contract_count
        );

        if (mounted) setData(sortedData);
      } catch (err) {
        console.error("Error fetching top categories:", err);
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
          `${host}/api/urlstats/topcategory`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        const resultData = result?.data || result || [];
        const sortedData = resultData.sort(
          (a: TopCategoryData, b: TopCategoryData) =>
            b.contract_count - a.contract_count
        );
        if (mounted) setData(sortedData);
      } catch (err) {
        console.error("Error refreshing top categories:", err);
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
      console.log("[TopCategoryCard] Realtime update received");
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

  // Get total URLs from the API response (all categories have the same total_urls value)
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
        {totalUrls.toLocaleString()} URLs
      </div>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {displayData.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>ไม่มีข้อมูล</p>
          </div>
        ) : (
          displayData.map((category, index) => {
            const color = colors[index] || colors[0];
            const percentage = category.percentage || 0;
            const displayPercentage = percentage.toFixed(2);

            // For progress bar width, use the actual percentage but ensure minimum visibility for very small values
            const progressWidth = Math.max(percentage, 0.5);

            return (
              <div key={category.group_id} className="flex items-center">
                {/* Category name */}
                <div className="w-32 text-sm text-gray-600 mr-3">
                  {category.group_name}
                </div>

                {/* Contract count */}
                <div className="w-16 text-sm text-gray-600 text-center mr-3">
                  {category.contract_count.toLocaleString()}
                </div>

                {/* Progress bar */}
                <div className="flex-1 bg-gray-200 rounded h-8 relative">
                  <div
                    className={`${color} h-8 rounded transition-all duration-300 ${ensureDynamicClass(progressWidth, String(category.group_id))}`}
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

export default TopCategoryCard;
