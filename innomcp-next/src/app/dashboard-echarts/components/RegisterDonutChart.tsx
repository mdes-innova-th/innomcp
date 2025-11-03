import React, { useRef, useEffect } from "react";
import * as echarts from "echarts";

export type RegisterStat = {
  country: string;
  count: number;
};

interface RegisterDonutChartProps {
  data: RegisterStat[];
  colors?: string[];
}

const RegisterDonutChart: React.FC<RegisterDonutChartProps> = ({
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

    // helper: estimate text width for the longest legend label
    const estimateMaxLabelWidth = (labels: string[]) => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return 0;
        // approximate font used by ECharts legend (12px default)
        ctx.font =
          "12px system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial";
        let max = 0;
        for (const l of labels) {
          const m = ctx.measureText(l).width;
          if (m > max) max = m;
        }
        return max;
      } catch {
        return 0;
      }
    };

    const render = () => {
      if (!chartRef.current || !chartInstance.current) return;

      const containerWidth = chartRef.current.clientWidth || 600;
      const labels = data.map((d) => d.country);
      const maxLabelPx = estimateMaxLabelWidth(labels);

      // approximate width needed for legend: item box + gap + text
      const itemBox = 24; // marker + padding
      const legendPadding = 24; // left/right padding inside legend area
      const estimatedLegendWidth = Math.min(
        Math.max(maxLabelPx + itemBox + legendPadding, 100),
        containerWidth * 0.45
      );

      // available width for pie area
      const availablePieWidth = Math.max(
        containerWidth - estimatedLegendWidth - 24,
        containerWidth * 0.35
      );

      // center X percent based on available pie width
      const centerX = (availablePieWidth / 2 / containerWidth) * 100;

      const option = {
        tooltip: {
          trigger: "item",
          formatter: "{b}: {c} ({d}%)",
        },
        // vertical legend on the right, use scroll if items overflow
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
        },
        series: [
          {
            name: "Register Stats",
            type: "pie",
            center: [`${centerX}%`, "50%"],
            radius: ["40%", "60%"],
            avoidLabelOverlap: false,
            itemStyle: {
              borderRadius: 10,
              borderColor: "#fff",
              borderWidth: 2,
            },
            label: {
              // show labels outside the pie with name, count and percent
              show: true,
              position: "outside",
              formatter: "{b}: {c} ({d}%)",
            },
            emphasis: {
              label: {
                show: true,
                fontSize: "16",
                fontWeight: "bold",
              },
            },
            labelLine: {
              show: true,
            },
            data: data.map((item, index) => ({
              value: item.count,
              name: item.country,
              itemStyle: {
                color: colors[index % colors.length],
              },
            })),
          },
        ],
      } as echarts.EChartsOption;

      chartInstance.current.setOption(option);
    };

    // initial render
    render();

    // resize handling: re-render on resize to recalc center
    const onResize = () => {
      try {
        chartInstance.current?.resize();
      } catch {}
      render();
    };

    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, [data, colors]);

  return <div ref={chartRef} className="h-80 w-full" />;
};

export default RegisterDonutChart;
