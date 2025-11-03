import React, { useRef, useEffect } from "react";
import * as echarts from "echarts";

export type PlatformStat = {
  platform: string;
  count: number;
};

interface PlatformsDonutChartProps {
  data: PlatformStat[];
  colors?: string[];
}

const PlatformsDonutChart: React.FC<PlatformsDonutChartProps> = ({
  data,
  colors = [],
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    if (!data || data.length === 0) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const option = {
      tooltip: {
        trigger: "item",
        formatter: "{b}: {c} ({d}%)",
      },
      // place legend on the right as a vertical list and keep it from overlapping the pie
      legend: {
        orient: "vertical",
        right: 12,
        top: "middle",
        align: "left",
        formatter: (name: string) => name,
        // use scroll mode and show 4 columns per page (ECharts v6+ supports `columns`)
        type: "scroll",
        columns: 4,
        pageButtonPosition: "end",
        data: data.map((d) => d.platform),
      },
      series: [
        {
          name: "Platforms",
          type: "pie",
          // shift pie to the left so the legend on the right doesn't overlap it
          center: ["38%", "50%"],
          radius: ["45%", "65%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 8,
            borderColor: "#fff",
            borderWidth: 2,
          },
          color: colors.length ? colors : undefined,
          label: {
            show: true,
            position: "outside",
            formatter: "{b}: {c}",
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: "bold",
            },
          },
          labelLine: {
            show: true,
          },
          data: data.map((d) => ({ value: d.count, name: d.platform })),
        },
      ],
    };

    chartInstance.current.setOption(option);

    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, [data, colors]);

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div ref={chartRef} className="h-80 w-full" />
    </div>
  );
};

export default PlatformsDonutChart;
