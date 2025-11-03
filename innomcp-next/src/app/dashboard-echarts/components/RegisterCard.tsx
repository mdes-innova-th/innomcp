import React, { useState, useEffect } from "react";
import { fetchWithApiProxy } from "@/app/lib/apiProxy";
import LoadingSpinner from "@/app/components/common/ui/loading-spinner";
import RegisterDonutChart, { RegisterStat } from "./RegisterDonutChart";

interface RegisterCardProps {
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

const RegisterCard: React.FC<RegisterCardProps> = ({ cornerLabel }) => {
  const [data, setData] = useState<RegisterStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const host = process.env.NEXT_PUBLIC_NODE_HOST || "";

  // Stable chart colors to avoid new array on each render
  const chartColors = DEFAULT_CHART_COLORS;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetchWithApiProxy(
          `${host}/api/urlstats/register-country`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        const resultData = response?.data || response || [];
        if (!Array.isArray(resultData) || resultData.length === 0) {
          setData([]);
          return;
        }
        setData(
          resultData.map((item: { country: string; count: number }) => ({
            country: item.country,
            count: item.count,
          }))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [host]);

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
      <RegisterDonutChart data={data} colors={chartColors} />
    </div>
  );
};

export default RegisterCard;
