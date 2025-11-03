"use client";

import { useState, useEffect } from "react";
import { useRealTime } from "@/app/dashboard-echarts/context/RealTimeContext";
import LoadingSpinner from "@/app/components/common/ui/loading-spinner";
import { fetchWithApiProxy } from "@/app/lib/apiProxy";

interface TopOfficeData {
  department_id: number;
  department_name: string;
  url_count: number;
  total_urls?: number;
  percentage?: number;
}

interface TopOfficeProps {
  cornerLabel?: string;
  toprank?: number; // จำนวนแถวที่แสดงผล (ไม่ใช่ limit ใน SQL)
}

const TopOfficeCard = ({ cornerLabel, toprank }: TopOfficeProps) => {
  const [data, setData] = useState<TopOfficeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const host = process.env.NEXT_PUBLIC_NODE_HOST || "";
  const { data: realtimeData, lastUpdateTime } = useRealTime();

  // Log that a realtime update was received (do not log the actual payload)
  useEffect(() => {
    if (realtimeData) {
      console.log("[TopOfficeCard] Realtime update received");
    }
  }, [realtimeData]);

  // Initial load and when host changes -> show loading spinner
  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchWithApiProxy(
          `${host}/api/urlstats/topoffice`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!mounted) return;
        setData(result?.data || result || []);
      } catch (err) {
        console.error("Error fetching top organizations:", err);
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    fetchData();
    return () => {
      mounted = false;
    };
  }, [host]);

  // Realtime refresh -> do not flip to loading spinner
  useEffect(() => {
    if (!lastUpdateTime) return;
    let mounted = true;
    const refresh = async () => {
      try {
        setIsRefreshing(true);
        const result = await fetchWithApiProxy(
          `${host}/api/urlstats/topoffice`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        if (!mounted) return;
        setData(result?.data || result || []);
      } catch (err) {
        console.error("Error refreshing top organizations:", err);
        if (!mounted) return;
        // keep existing data, optionally surface a soft error
      } finally {
        if (!mounted) return;
        setIsRefreshing(false);
      }
    };
    refresh();
    return () => {
      mounted = false;
    };
  }, [lastUpdateTime, host]);

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

  // Apply toprank limit to display only specified number of items
  const displayData = toprank && toprank > 0 ? data.slice(0, toprank) : data;

  // Get total URLs from the API response (all items should have the same total_urls value)
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
          displayData.map((org, index) => {
            const rank = index + 1;
            const rankColors = [
              "bg-green-600", // Rank 1
              "bg-purple-500", // Rank 2
              "bg-blue-500", // Rank 3
              "bg-blue-300", // Rank 4 and beyond
            ];
            const rankColor = rankColors[rank - 1] || rankColors[3];

            return (
              <div
                key={org.department_id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  <div
                    className={`w-8 h-8 flex items-center justify-center rounded-full text-white font-bold ${rankColor} mr-4`}
                  >
                    {rank}
                  </div>
                  <div>
                    <div className="font-medium text-gray-800">
                      {org.department_name}
                    </div>
                  </div>
                </div>
                <div
                  className={`text-right flex items-center justify-center rounded text-white font-bold ${rankColor} px-2`}
                >
                  {org.url_count.toLocaleString()}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TopOfficeCard;
