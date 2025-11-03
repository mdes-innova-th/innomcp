"use client";

import { useState, useEffect } from "react";
import { useRealTime } from "@/app/dashboard-echarts/context/RealTimeContext";
import LoadingSpinner from "@/app/components/common/ui/loading-spinner";
import { fetchWithApiProxy } from "@/app/lib/apiProxy";
import PlatformsDonutChart, {
  PlatformStat,
} from "@/app/dashboard-echarts/components/PlatformsDonutChart";

interface PlatformsCardProps {
  cornerLabel?: string;
}
// Static default colors (module-level constant to keep reference stable)
const DEFAULT_CHART_COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#22c55e", // green
  "#eab308", // yellow
  "#a855f7", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#f43f5e", // rose
  "#f59e42", // amber
];

const PlatformsCard = ({ cornerLabel }: PlatformsCardProps) => {
  const [data, setData] = useState<PlatformStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const host = process.env.NEXT_PUBLIC_NODE_HOST || "";
  const { lastUpdateTime } = useRealTime();

  const chartColors = DEFAULT_CHART_COLORS;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await fetchWithApiProxy(
          `${host}/api/urlstats/platforms`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        const resultData = result?.data || result || [];
        if (!Array.isArray(resultData) || resultData.length === 0) {
          setData([]);
          return;
        }
        // Map API response to PlatformStat[]
        const stats: PlatformStat[] = resultData.map(
          (item: { platform: string; url_count: number }) => ({
            platform: item.platform,
            count: item.url_count,
          })
        );
        setData(stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [host]);

  useEffect(() => {
    const refresh = async () => {
      try {
        setIsRefreshing(true);
        const result = await fetchWithApiProxy(
          `${host}/api/urlstats/platforms`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        const resultData = result?.data || result || [];
        if (!Array.isArray(resultData) || resultData.length === 0) return;
        const stats: PlatformStat[] = resultData.map(
          (item: { platform: string; url_count: number }) => ({
            platform: item.platform,
            count: item.url_count,
          })
        );
        setData(stats);
      } catch {
        // silent error
      } finally {
        setIsRefreshing(false);
      }
    };
    refresh();
  }, [lastUpdateTime, host]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-lg relative">
        {cornerLabel && (
          <div className="absolute top-0 right-0 bg-indigo-700 text-white text-xs font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">
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
          <div className="absolute top-0 right-0 bg-indigo-700 text-white text-xs font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">
            {cornerLabel}
          </div>
        )}
        <div className="text-center text-red-500 py-8">
          <p>{error}</p>
        </div>
      </div>
    );
  }


  return (
    <div className="bg-white rounded-lg p-6 shadow-lg relative">
      {cornerLabel && (
        <div className="absolute top-0 right-0 bg-indigo-700 text-white text-xs font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">
          {cornerLabel}
        </div>
      )}
      {isRefreshing && (
        <div className="flex absolute top-0 left-0 m-1 p-1 text-[15px] text-gray-700">
          <LoadingSpinner color="red" size="sm" type="dots" />
        </div>
      )}
      <PlatformsDonutChart data={data} colors={chartColors} />
    </div>
  );
};

export default PlatformsCard;
