"use client";

import "@/app/dashboard-echarts/styles/dashboard.css";
import "@/app/dashboard-echarts/styles/legend.css";

import React, { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";

import { ChartDisplayOptions } from "@/app/dashboard-echarts/components/complexchart/base/filter/ChartDisplayOptions";
import { useReportMode } from "@/app/dashboard-echarts/hooks/useReportMode";

export interface DataPoint {
  x: string | number;
  y: number;
  group?: string;
  label?: string;
  color?: string;
  [key: string]: unknown;
}

export interface ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface DashboardChartProps {
  data: DataPoint[];
  type?:
    | "bar"
    | "line"
    | "pie"
    | "bubble"
    | "scatter"
    | "radar"
    | "heatmap"
    | "area";
  title?: string;
  height?: number;
  width?: number;
  /**
   * Controls how far (in x-axis units) bubbles are randomly scattered around
   * their cluster center. Useful to create a 'jitter' effect so bubbles don't
   * overlap exactly. Default is 0 (no scatter).
   */
  bubbleScatterRadius?: number;
  margin?: ChartMargin;
  colors?: string[];
  showTitle?: boolean;
  showDataLabels?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  showLegend?: boolean;
  forReport?: boolean;
  onBarLabelClick?: (label: string) => void;
  onBubbleLabelClick?: (label: string) => void;
  onLineLabelClick?: (x: string | number, group?: string) => void;
  legendClassName?: string;
  area?: boolean;
  areaOpacity?: number;
  labelFormatter?: (value: number, label?: string) => string;
  stacked?: boolean;
  /** If true, numeric values are displayed in thousands (e.g. 1.2k) */
  displayInThousands?: boolean;
  titleClassName?: string;
  isDonut?: boolean;
  /** Controls the thickness of the donut chart. Value between 0 and 1. Higher values make the donut thinner. Default is 0.18 */
  donutThickness?: number;
  /** Controls the border radius (rounded corners) for pie/donut chart segments. Default is 0 (no rounded corners) */
  borderRadius?: number;
  stackedAxis?: "x" | "y";
}

const DashboardChartRender: React.FC<DashboardChartProps> = ({
  data,
  type = "bar",
  title,
  height = 500,
  width = 600,
  // a small default scatter so bubble charts show scattered layout by default
  bubbleScatterRadius = 0.6,
  colors = ["#4f46e5", "#3b82f6", "#0ea5e9", "#06b6d4", "#14b8a6"],
  showTitle = true,
  showDataLabels = true,
  showXAxis = true,
  showYAxis = true,
  showLegend = true,
  forReport = false,
  onBarLabelClick,
  onBubbleLabelClick,
  onLineLabelClick,
  area = false,
  areaOpacity = 0.18,
  labelFormatter,
  stacked = false,
  stackedAxis = "y",
  isDonut = false,
  donutThickness = 0.18,
  borderRadius = 0,
  displayInThousands = false,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.EChartsType | null>(null);
  const previousChartType = useRef<string | undefined>(undefined);
  const [displayOptions, setDisplayOptions] = useState<{
    showTitle: boolean;
    showDataLabels: boolean;
    showXAxis: boolean;
    showYAxis: boolean;
    showLegend: boolean;
    chartType?:
      | "bar"
      | "line"
      | "pie"
      | "bubble"
      | "scatter"
      | "radar"
      | "heatmap"
      | "area";
    stacked?: boolean;
    stackedAxis?: "x" | "y";
    darkMode?: boolean;
    decalPattern?: "none" | "dots" | "lines" | "grid";
    decalScale?: number;
    decalColor?: string;
  }>({
    showTitle,
    showDataLabels,
    showXAxis,
    showYAxis,
    showLegend,
    chartType: type,
    stacked,
    stackedAxis,
    darkMode: false,
    decalPattern: "none",
    decalScale: 1,
    decalColor: "#000000",
  });

  // Use the shared hook to detect report/preview mode. This hook checks the
  // provided chartRef and the document for the `data-for-report` attribute
  // and sets up observers to react to changes reliably.
  const isReportMode = useReportMode(chartRef);

  // Helper to format numeric values. If `labelFormatter` prop is provided it
  // takes precedence. When `displayInThousands` is true numbers >= 1000 are
  // displayed with a 'k' suffix (and 'M' for millions). Trailing .0 is
  // stripped for neatness.
  const formatValue = (value: number, label?: string) => {
    const v = typeof value === "number" ? value : Number(value);
    if (typeof labelFormatter === "function") return labelFormatter(v, label);
    if (!displayInThousands) return String(v);
    const abs = Math.abs(v);
    if (abs >= 1000000) {
      const r = (v / 1000000).toFixed(1).replace(/\.0$/, "");
      return `${r}M`;
    }
    if (abs >= 1000) {
      const r = (v / 1000).toFixed(1).replace(/\.0$/, "");
      return `${r}k`;
    }
    return String(v);
  };

  // Initialize chart instance once on mount and dispose on unmount.
  useEffect(() => {
    if (!chartRef.current) return;
    if (!chartInstance.current)
      chartInstance.current = echarts.init(chartRef.current);
    const chart = chartInstance.current;

    const getGroup = (d: DataPoint) => {
      if (typeof d.group === "string") return d.group;
      if (
        "category" in d &&
        typeof (d as unknown as { category?: unknown }).category === "string"
      )
        return (d as unknown as { category?: string }).category as string;
      if (typeof d.label === "string") return d.label;
      return "default";
    };

    const getGroups = () => Array.from(new Set(data.map((d) => getGroup(d))));
    const groups = getGroups();

    let effectiveType = displayOptions.chartType ?? type;
    // data attribute still overrides if present (e.g., embedding)
    const attr = chartRef.current.getAttribute("data-chart-type");
    if (attr) effectiveType = attr as typeof type;

    // treat explicit "area" type as line + area mode for convenience
    const isAreaType =
      effectiveType === "area" || (effectiveType === "line" && area);

    let showLegendFinal = displayOptions.showLegend && showLegend;
    // For bubble charts, by default show the legend (user requested visible legend for bubbles)
    if (effectiveType === "bubble") showLegendFinal = true;

    const legendFormatter = undefined;

    const common: echarts.EChartsOption = {
      title: {
        show: displayOptions.showTitle && !!title,
        text: title || "",
        left: "center",
        textStyle: {
          // make the title larger and more prominent
          fontSize: 18,
          fontWeight: 600,
        },
        top: 0,
      },
      tooltip: {
        trigger: effectiveType === "pie" ? "item" : "axis",
        textStyle: { fontSize: 13 },
      },
      grid: {
        top: 0,
        bottom: showLegendFinal ? 50 : 20,
        left: 0,
        right: 0,
        containLabel: true,
      },
      legend: {
        show: showLegendFinal,
        data: groups,
        bottom: 0,
        left: "center",
        orient: "horizontal",
        itemWidth: 20,
        itemHeight: 14,
        // space between legend items
        itemGap: 12,
        // internal padding for the legend box [top, right, bottom, left]
        padding: [4, 8, 0, 8],
        textStyle: { fontSize: 14 },
        // default formatter (show legend text)
        formatter: legendFormatter as unknown as (name: string) => string,
      },
      color: colors,
    };

    // Apply dark mode colors if requested by display options
    const dark = !!displayOptions.darkMode;
    const textColor = dark ? "#E5E7EB" : undefined; // light text for dark mode
    if (dark) {
      // background and some global text colors
      (common as unknown as echarts.EChartsOption).backgroundColor = "#0b1220";
      if (common.title)
        (common.title as echarts.TitleComponentOption).textStyle = {
          ...((common.title as echarts.TitleComponentOption)
            .textStyle as Record<string, unknown>),
          color: textColor,
        };
      if (common.legend)
        (common.legend as echarts.LegendComponentOption).textStyle = {
          ...((common.legend as echarts.LegendComponentOption)
            .textStyle as Record<string, unknown>),
          color: textColor,
        };
      if (common.tooltip)
        (common.tooltip as echarts.TooltipComponentOption).textStyle = {
          ...((common.tooltip as echarts.TooltipComponentOption)
            .textStyle as Record<string, unknown>),
          color: textColor,
        };
    }

    let option: echarts.EChartsOption = {};

    if (effectiveType === "pie") {
      // For pie charts, use individual data items directly to preserve custom properties
      const seriesData = data.map((d) => {
        const item: Record<string, unknown> = {
          name: d.x?.toString() || getGroup(d),
          value: typeof d.y === "number" ? d.y : 0,
        };

        // Add custom itemStyle if provided (for empty segments)
        if (d.itemStyle && typeof d.itemStyle === "object") {
          item.itemStyle = d.itemStyle;
        }

        // Disable interactions for empty segments
        if (d.isEmpty) {
          item.emphasis = { disabled: true };
          item.select = { disabled: true };
          // Also disable tooltip for empty segments
          item.tooltip = { show: false };
        }

        return item;
      });

      const inner =
        isDonut ?? false ? Math.min(width, height) * donutThickness : 0;
      option = {
        ...common,
        series: [
          {
            type: "pie",
            radius: [inner, Math.min(width, height) * 0.35],
            center: ["50%", "55%"],
            data: seriesData,
            itemStyle: {
              borderRadius: borderRadius, // Use configurable border radius
            },
            label: {
              show: displayOptions.showDataLabels,
              formatter: (params: unknown) => {
                const p = params as { value?: unknown; name?: string };
                const val =
                  typeof p.value === "number" ? p.value : Number(p.value);
                return `${p.name}: ${formatValue(val, p.name)}`;
              },
              fontSize: 12,
            },
            emphasis: {
              // make hovered slice stand out
              itemStyle: {
                shadowBlur: 30,
                shadowOffsetX: 0,
                shadowColor: "rgba(0,0,0,0.45)",
                borderWidth: 4,
                borderRadius: borderRadius, // Use configurable border radius on hover
              },
              label: { fontSize: 16, fontWeight: "bold" },
            },
          },
        ],
      };
    } else if (effectiveType === "bubble") {
      // For bubble charts, create one scatter series per group so each group's
      // bubbles can have their own color and label. Each DataPoint may provide
      // a color and an optional label. We'll position bubbles along the X axis
      // by their index within the group so they don't overlap completely.
      const groupsList = groups.length ? groups : ["default"];

      // We'll center clusters by offsetting indices within each group
      const series = groupsList.map((g, gi) => {
        const pointsRaw = data.filter(
          (d) => getGroup(d) === g && typeof d.y === "number"
        );
        const points = pointsRaw.map((d, idx) => {
          // center by offsetting indices so cluster is around x=0
          const count = pointsRaw.length || 1;
          const offset = (count - 1) / 2;
          // add a small random jitter to x so bubbles are scattered
          // around their nominal index position. The jitter range is
          // [-bubbleScatterRadius, +bubbleScatterRadius]. A radius of 0
          // disables scattering.
          const baseX = idx - offset;
          const jitter =
            typeof bubbleScatterRadius === "number" && bubbleScatterRadius > 0
              ? (Math.random() * 2 - 1) * bubbleScatterRadius
              : 0;
          const x = baseX + jitter;
          const value = d.y as number;
          // previous sizing — scale by 0.5 to reduce size by 50%
          const baseSize = Math.max(6, Math.sqrt(Math.max(0, value)) * 4);
          const size = Math.max(4, Math.round(baseSize * 0.5));
          return {
            name: d.label || g,
            value: [x, value, size],
            symbolSize: size,
            itemStyle: { color: d.color || colors[gi % colors.length] },
          };
        });

        // determine a representative color for the series (first point color or fallback)
        const firstPoint = points.length
          ? (points[0] as Record<string, unknown>)
          : undefined;
        const seriesColor =
          firstPoint &&
          firstPoint.itemStyle &&
          (firstPoint.itemStyle as Record<string, unknown>).color
            ? ((firstPoint.itemStyle as Record<string, unknown>)
                .color as string)
            : colors[gi % colors.length];

        return {
          name: g,
          type: "scatter",
          data: points,
          itemStyle: { color: seriesColor },
          encode: { x: 0, y: 1 },
          symbolSize: (val: unknown) => (Array.isArray(val) ? val[2] : 8),
          label: {
            // show numeric value inside the bubble (centered)
            show: displayOptions.showDataLabels,
            formatter: (params: unknown) => {
              // params.value for scatter is [x, y, size]
              const p = params as { value?: unknown[]; name?: string };
              const val =
                Array.isArray(p.value) && typeof p.value[1] === "number"
                  ? (p.value[1] as number)
                  : undefined;
              return typeof val === "number" ? formatValue(val, p.name) : "";
            },
            position: "inside",
            fontSize: 12,
            color: "#000",
            fontWeight: 600,
            align: "center",
            verticalAlign: "middle",
          },
          emphasis: {
            focus: "series",
            scale: true,
            itemStyle: {
              borderWidth: 4,
              borderColor: "#000",
              shadowBlur: 20,
              shadowColor: "rgba(0,0,0,0.4)",
            },
            // show label on hover / focus so numeric value appears on mouseover or touch
            label: { show: true, fontSize: 16, fontWeight: 600 },
          },
        } as echarts.SeriesOption;
      });

      // compute x extents to center clusters
      const allXVals: number[] = [];
      series.forEach((s) => {
        const sObj = s as unknown as { data?: unknown[] };
        const dataArr = sObj.data;
        if (Array.isArray(dataArr)) {
          dataArr.forEach((pt: unknown) => {
            if (pt && typeof pt === "object") {
              const v = (pt as Record<string, unknown>).value;
              if (Array.isArray(v) && typeof v[0] === "number")
                allXVals.push(v[0] as number);
            }
          });
        }
      });
      const minX = allXVals.length ? Math.min(...allXVals) : -1;
      const maxX = allXVals.length ? Math.max(...allXVals) : 1;
      const padding = Math.max(1, (maxX - minX) * 0.2);

      option = {
        ...common,
        // For bubble charts we want item/tooltips so hovering or touching a
        // bubble shows its value. Use triggerOn that includes click so
        // touch devices will show the tooltip on tap.
        tooltip: {
          trigger: "item",
          // include click so mobile/touch devices show tooltip on tap
          triggerOn: "mousemove|click",
          // Use a small typed callback so we can extract the numeric 'y'
          // when value is an array [x, y, size]. Avoid `any` by using a
          // local narrowed type.
          formatter: (params: unknown) => {
            const p = params as {
              value?: unknown;
              name?: string;
              seriesName?: string;
            };
            let val: unknown = p.value;
            if (Array.isArray(p.value)) val = (p.value as unknown[])[1];
            const seriesName = p.seriesName ? `${p.seriesName}<br/>` : "";
            const name = p.name ? `${p.name}: ` : "";
            return `${seriesName}${name}${
              typeof val === "number" ? formatValue(val, p.name) : String(val)
            }`;
          },
        },
        xAxis: {
          show: false,
          type: "value",
          min: minX - padding,
          max: maxX + padding,
        },
        yAxis: { show: false, type: "value" },
        series,
      };
    } else {
      // For category-based charts (bar/line/area/scatter when categorical X)
      const categories = Array.from(new Set(data.map((d) => String(d.x))));
      const groupsList = groups.length ? groups : ["default"];
      const series = groupsList.map((g, gi) => {
        const values = categories.map((cat) => {
          const found = data.find(
            (d) => String(d.x) === String(cat) && getGroup(d) === g
          );
          return found ? (typeof found.y === "number" ? found.y : 0) : 0;
        });
        if (effectiveType === "bar") {
          const base: echarts.BarSeriesOption = {
            name: g,
            type: "bar",
            data: values,
            itemStyle: {
              color: colors[gi % colors.length],
              borderRadius: [4, 4, 4, 4],
            },
            label: {
              show: displayOptions.showDataLabels,
              fontSize: 14,
              formatter: (params: unknown) => {
                const p = params as { value: number; name?: string };
                return formatValue(p.value, p.name);
              },
            },
            emphasis: {
              focus: "series",
              itemStyle: {
                borderWidth: 4,
                borderColor: "#000",
                shadowBlur: 18,
                shadowColor: "rgba(0,0,0,0.35)",
                borderRadius: [4, 4, 4, 4], // เพิ่มมุมมนทั้ง 4 มุม
              },
              label: { fontSize: 16, fontWeight: 600 },
            },
          } as echarts.BarSeriesOption;
          if (displayOptions.stacked)
            (base as unknown as Record<string, unknown>).stack = "stack";
          return base as echarts.SeriesOption;
        }
        const baseLine: echarts.LineSeriesOption = {
          name: g,
          type: "line",
          data: values,
          smooth: true,
          itemStyle: { color: colors[gi % colors.length] },
          symbolSize: 8,
          label: {
            show: displayOptions.showDataLabels,
            fontSize: 14,
            formatter: (params: unknown) => {
              const p = params as { value: number; name?: string };
              return formatValue(p.value, p.name);
            },
          },
          emphasis: {
            focus: "series",
            scale: true,
            itemStyle: {
              borderWidth: 4,
              borderColor: "#000",
              shadowBlur: 20,
              shadowColor: "rgba(0,0,0,0.35)",
            },
            label: { fontSize: 16, fontWeight: 600 },
          },
        } as echarts.LineSeriesOption;
        // apply area when requested or when type is explicit "area"
        if (isAreaType)
          (baseLine as unknown as Record<string, unknown>).areaStyle = {
            opacity: areaOpacity,
          };
        if (displayOptions.stacked)
          (baseLine as unknown as Record<string, unknown>).stack = "stack";
        return baseLine as echarts.SeriesOption;
      });
      // Default axes: category on X, value on Y. If stacking axis is X and chart is bar,
      // swap axes to get horizontal stacked bars (category on Y, value on X).
      const stackingAxis = displayOptions.stackedAxis ?? "y";
      const isHorizontalBar = effectiveType === "bar" && stackingAxis === "x";
      option = {
        ...common,
        tooltip: { trigger: "axis" },
        xAxis: isHorizontalBar
          ? { type: "value", show: displayOptions.showXAxis }
          : {
              type: "category",
              data: categories,
              show: displayOptions.showXAxis,
              axisLabel: { rotate: 45 },
            },
        yAxis: isHorizontalBar
          ? {
              type: "category",
              data: categories,
              show: displayOptions.showYAxis,
            }
          : { type: "value", show: displayOptions.showYAxis },
        series,
      };
    }

    // scatter (numeric x/y) — map DataPoint.x, DataPoint.y directly
    if (effectiveType === "scatter") {
      const scatterData = data
        .filter((d) => typeof d.x !== "undefined" && typeof d.y === "number")
        .map((d) => {
          const x = typeof d.x === "number" ? d.x : parseFloat(String(d.x));
          const y = d.y as number;
          return {
            name: d.label || getGroup(d),
            value: [x, y],
            itemStyle: { color: d.color || colors[0] },
          };
        });
      option = {
        ...common,
        // scatter charts should also use item tooltips so individual points
        // display their values on hover / touch.
        tooltip: {
          trigger: "item",
          triggerOn: "mousemove|click",
          formatter: (params: unknown) => {
            const p = params as { value?: unknown; name?: string };
            let val: unknown = p.value;
            if (Array.isArray(p.value)) val = (p.value as unknown[])[1];
            const name = p.name ? `${p.name}: ` : "";
            return `${name}${
              typeof val === "number"
                ? formatValue(val as number, p.name)
                : String(val)
            }`;
          },
        },
        xAxis: { type: "value", show: displayOptions.showXAxis },
        yAxis: { type: "value", show: displayOptions.showYAxis },
        series: [
          {
            type: "scatter",
            data: scatterData,
            symbolSize: (val: unknown) => (Array.isArray(val) ? 8 : 8),
            label: {
              show: displayOptions.showDataLabels,
              formatter: (params: unknown) => {
                const p = params as { value?: unknown; name?: string };
                let val: unknown = p.value;
                if (Array.isArray(p.value)) val = (p.value as unknown[])[1];
                return typeof val === "number"
                  ? formatValue(val as number, p.name)
                  : p.name || "";
              },
            },
            emphasis: {
              label: { show: true, fontSize: 16, fontWeight: 600 },
            },
          },
        ],
      };
    }

    // radar — assume categories are unique x values; each group becomes a series
    if (effectiveType === "radar") {
      const indicators = Array.from(new Set(data.map((d) => String(d.x)))).map(
        (cat) => ({
          name: cat,
          max: Math.max(
            1,
            ...data
              .filter((d) => String(d.x) === cat)
              .map((d) => (typeof d.y === "number" ? d.y : 0))
          ),
        })
      );
      const groupsList = groups.length ? groups : ["default"];
      const series = groupsList.map((g, gi) => {
        const values = indicators.map((ind) => {
          const found = data.find(
            (d) => String(d.x) === ind.name && getGroup(d) === g
          );
          return found ? (typeof found.y === "number" ? found.y : 0) : 0;
        });
        return {
          name: g,
          type: "radar",
          data: [{ value: values, name: g }],
          itemStyle: { color: colors[gi % colors.length] },
        } as echarts.SeriesOption;
      });
      option = {
        ...common,
        radar: { indicator: indicators },
        series,
      };
    }

    // heatmap — assume data.x and data.group (or y) define grid, use index mapping
    if (effectiveType === "heatmap") {
      // x-axis from unique x, y-axis from unique group or unique label
      const xs = Array.from(new Set(data.map((d) => String(d.x))));
      const ys = Array.from(new Set(data.map((d) => getGroup(d))));
      const data3 = data.map((d) => [
        xs.indexOf(String(d.x)),
        ys.indexOf(getGroup(d)),
        typeof d.y === "number" ? d.y : 0,
      ]);
      option = {
        ...common,
        xAxis: { type: "category", data: xs, show: displayOptions.showXAxis },
        yAxis: { type: "category", data: ys, show: displayOptions.showYAxis },
        visualMap: {
          min: Math.min(...data3.map((r) => r[2])),
          max: Math.max(...data3.map((r) => r[2])),
          calculable: true,
          // color gradient: low -> high. Ensure the highest values are red.
          inRange: {
            color: [
              "#00bbff",
              "#aadd22",
              "#effd00",
              "#ffef00",
              "#fdae22",
              "#ff0000",
            ],
          },
          // position the visualMap vertically on the right for clarity
          orient: "vertical",
          right: 10,
          bottom: 100,
        },
        series: [
          {
            name: "heatmap",
            type: "heatmap",
            data: data3,
            label: {
              show: displayOptions.showDataLabels,
              formatter: (params: unknown) => {
                const p = params as { value?: unknown[] };
                const v =
                  Array.isArray(p.value) && typeof p.value[2] === "number"
                    ? (p.value[2] as number)
                    : typeof p.value === "number"
                    ? (p.value as number)
                    : undefined;
                return typeof v === "number" ? formatValue(v) : "";
              },
            },
          },
        ],
      };
    }

    // If a decal pattern is selected, attach a simple decal object to each series itemStyle.
    const decal = ((): Record<string, unknown> | undefined => {
      const p = displayOptions.decalPattern || "none";
      if (!p || p === "none") return undefined;
      const defaultColor = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
      const color = displayOptions.decalColor || defaultColor;
      const scale = (displayOptions.decalScale || 1) as number;
      const s1 = Math.max(1, Math.round(1 * scale));
      const s2 = Math.max(2, Math.round(2 * scale));
      const s6 = Math.max(3, Math.round(6 * scale));
      switch (p) {
        case "dots":
          return {
            type: "dot",
            backgroundColor: "transparent",
            color,
            dashArrayX: [s1, s2],
            dashArrayY: [s1, s2],
          } as Record<string, unknown>;
        case "lines":
          return {
            type: "line",
            backgroundColor: "transparent",
            color,
            dashArrayX: [s6, s2],
          } as Record<string, unknown>;
        case "grid":
          return {
            type: "rect",
            backgroundColor: "transparent",
            color,
            dashArrayX: [s6, s6],
            dashArrayY: [s6, s6],
          } as Record<string, unknown>;
        default:
          return undefined;
      }
    })();

    if (decal) {
      const seriesArr = (option as echarts.EChartsOption).series as unknown;
      if (Array.isArray(seriesArr)) {
        (seriesArr as unknown[]).forEach((s) => {
          const ss = s as Record<string, unknown>;
          ss.itemStyle = {
            ...((ss.itemStyle as Record<string, unknown>) || {}),
            decal,
          };
          // if labels are white on dark background, adjust label color
          if (dark && ss.label)
            ss.label = {
              ...((ss.label as Record<string, unknown>) || {}),
              color: textColor,
            } as unknown;
        });
      }
    }

    chart.setOption(option);

    // Attach click handler. Keep a single handler (remove previous) so updates
    // don't cause duplicate handlers.
    chart.off("click");
    chart.on("click", (params: unknown) => {
      if (!params) return;
      const p = params as echarts.ECElementEvent;
      const comp = (p as unknown as Record<string, unknown>).componentType as
        | string
        | undefined;
      const sType = (p as unknown as Record<string, unknown>).seriesType as
        | string
        | undefined;
      const name = (p as unknown as Record<string, unknown>).name as
        | string
        | undefined;
      const seriesName = (p as unknown as Record<string, unknown>)
        .seriesName as string | undefined;
      const dataItem = (p as unknown as Record<string, unknown>).data;
      if (comp === "series") {
        if (sType === "bar" && typeof onBarLabelClick === "function" && name)
          onBarLabelClick(String(name));
        if (sType === "line" && typeof onLineLabelClick === "function")
          onLineLabelClick(name as string, seriesName);
        if (sType === "scatter" && typeof onBubbleLabelClick === "function")
          onBubbleLabelClick(
            String(
              name ||
                (dataItem &&
                  (dataItem as unknown as Record<string, unknown>).name) ||
                ""
            )
          );
      }
    });

    const resizeObserver = new ResizeObserver(() => chart.resize());
    if (chartRef.current) resizeObserver.observe(chartRef.current);

    // We only want to dispose the chart on unmount. The surrounding effect
    // is mount-only because it has no dynamic dependencies (except refs).
    return () => {
      resizeObserver.disconnect();
      chart.off("click");
      chart.dispose();
      chartInstance.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update chart options when relevant props/state change. Use `setOption`
  // with `notMerge=false` and `lazyUpdate=true` so only the changed parts are
  // merged into the existing chart instead of recreating it. This keeps the
  // instance alive and avoids flicker or full reload.
  useEffect(() => {
    const chart = chartInstance.current;
    if (!chart) return;

    // The option generation code is unchanged; build option as before.
    const getGroup = (d: DataPoint) => {
      if (typeof d.group === "string") return d.group;
      if (
        "category" in d &&
        typeof (d as unknown as { category?: unknown }).category === "string"
      )
        return (d as unknown as { category?: string }).category as string;
      if (typeof d.label === "string") return d.label;
      return "default";
    };

    const getGroups = () => Array.from(new Set(data.map((d) => getGroup(d))));
    const groups = getGroups();

    let effectiveType = displayOptions.chartType ?? type;
    const attr = chartRef.current?.getAttribute("data-chart-type");
    if (attr) effectiveType = attr as typeof type;

    const isAreaType =
      effectiveType === "area" || (effectiveType === "line" && area);

    let showLegendFinal = displayOptions.showLegend && showLegend;
    if (effectiveType === "bubble") showLegendFinal = true;

    const legendFormatter = undefined;

    const common: echarts.EChartsOption = {
      title: {
        show: displayOptions.showTitle && !!title,
        text: title || "",
        left: "center",
        textStyle: {
          fontSize: 18,
          fontWeight: 600,
        },
        top: 0,
      },
      tooltip: {
        trigger: effectiveType === "pie" ? "item" : "axis",
        textStyle: { fontSize: 13 },
      },
      grid: {
        top: 0,
        bottom: showLegendFinal ? 50 : 20,
        left: 0,
        right: 0,
        containLabel: true,
      },
      legend: {
        show: showLegendFinal,
        data: groups,
        bottom: 0,
        left: "center",
        orient: "horizontal",
        itemWidth: 20,
        itemHeight: 14,
        itemGap: 12,
        padding: [4, 8, 0, 8],
        textStyle: { fontSize: 14 },
        formatter: legendFormatter as unknown as (name: string) => string,
      },
      color: colors,
    };

    const dark = !!displayOptions.darkMode;
    const textColor = dark ? "#E5E7EB" : undefined;
    if (dark) {
      (common as unknown as echarts.EChartsOption).backgroundColor = "#0b1220";
      if (common.title)
        (common.title as echarts.TitleComponentOption).textStyle = {
          ...((common.title as echarts.TitleComponentOption)
            .textStyle as Record<string, unknown>),
          color: textColor,
        };
      if (common.legend)
        (common.legend as echarts.LegendComponentOption).textStyle = {
          ...((common.legend as echarts.LegendComponentOption)
            .textStyle as Record<string, unknown>),
          color: textColor,
        };
      if (common.tooltip)
        (common.tooltip as echarts.TooltipComponentOption).textStyle = {
          ...((common.tooltip as echarts.TooltipComponentOption)
            .textStyle as Record<string, unknown>),
          color: textColor,
        };
    }

    let option: echarts.EChartsOption = {};

    if (effectiveType === "pie") {
      // For pie charts, use individual data items directly to preserve custom properties
      const seriesData = data.map((d) => {
        const item: Record<string, unknown> = {
          name: d.x?.toString() || getGroup(d),
          value: typeof d.y === "number" ? d.y : 0,
        };

        // Add custom itemStyle if provided (for empty segments)
        if (d.itemStyle && typeof d.itemStyle === "object") {
          item.itemStyle = d.itemStyle;
        }

        // Disable interactions for empty segments
        if (d.isEmpty) {
          item.emphasis = { disabled: true };
          item.select = { disabled: true };
          // Also disable tooltip for empty segments
          item.tooltip = { show: false };
        }

        return item;
      });

      const inner =
        isDonut ?? false ? Math.min(width, height) * donutThickness : 0;
      option = {
        ...common,
        series: [
          {
            type: "pie",
            radius: [inner, Math.min(width, height) * 0.35],
            center: ["50%", "55%"],
            data: seriesData,
            itemStyle: {
              borderRadius: borderRadius, // Use configurable border radius
            },
            label: {
              show: displayOptions.showDataLabels,
              formatter: (params: unknown) => {
                const p = params as { value?: unknown; name?: string };
                const val =
                  typeof p.value === "number" ? p.value : Number(p.value);
                return `${p.name}: ${formatValue(val, p.name)}`;
              },
              fontSize: 12,
            },
            emphasis: {
              itemStyle: {
                shadowBlur: 30,
                shadowOffsetX: 0,
                shadowColor: "rgba(0,0,0,0.45)",
                borderWidth: 4,
                borderRadius: borderRadius, // Use configurable border radius on hover
              },
              label: { fontSize: 16, fontWeight: "bold" },
            },
          },
        ],
      };
    } else if (effectiveType === "bubble") {
      const groupsList = groups.length ? groups : ["default"];
      const series = groupsList.map((g, gi) => {
        const pointsRaw = data.filter(
          (d) => getGroup(d) === g && typeof d.y === "number"
        );
        const points = pointsRaw.map((d, idx) => {
          const count = pointsRaw.length || 1;
          const offset = (count - 1) / 2;
          const baseX = idx - offset;
          const jitter =
            typeof bubbleScatterRadius === "number" && bubbleScatterRadius > 0
              ? (Math.random() * 2 - 1) * bubbleScatterRadius
              : 0;
          const x = baseX + jitter;
          const value = d.y as number;
          const baseSize = Math.max(6, Math.sqrt(Math.max(0, value)) * 4);
          const size = Math.max(4, Math.round(baseSize * 0.5));
          return {
            name: d.label || g,
            value: [x, value, size],
            symbolSize: size,
            itemStyle: { color: d.color || colors[gi % colors.length] },
          };
        });

        const firstPoint = points.length
          ? (points[0] as Record<string, unknown>)
          : undefined;
        const seriesColor =
          firstPoint &&
          firstPoint.itemStyle &&
          (firstPoint.itemStyle as Record<string, unknown>).color
            ? ((firstPoint.itemStyle as Record<string, unknown>)
                .color as string)
            : colors[gi % colors.length];

        return {
          name: g,
          type: "scatter",
          data: points,
          itemStyle: { color: seriesColor },
          encode: { x: 0, y: 1 },
          symbolSize: (val: unknown) => (Array.isArray(val) ? val[2] : 8),
          label: {
            show: displayOptions.showDataLabels,
            formatter: (params: unknown) => {
              const p = params as { value?: unknown[]; name?: string };
              const val =
                Array.isArray(p.value) && typeof p.value[1] === "number"
                  ? (p.value[1] as number)
                  : undefined;
              return typeof val === "number" ? formatValue(val, p.name) : "";
            },
            position: "inside",
            fontSize: 12,
            color: "#000",
            fontWeight: 600,
            align: "center",
            verticalAlign: "middle",
          },
          emphasis: {
            focus: "series",
            scale: true,
            itemStyle: {
              borderWidth: 4,
              borderColor: "#000",
              shadowBlur: 20,
              shadowColor: "rgba(0,0,0,0.4)",
            },
            label: { show: true, fontSize: 16, fontWeight: 600 },
          },
        } as echarts.SeriesOption;
      });

      const allXVals: number[] = [];
      series.forEach((s) => {
        const sObj = s as unknown as { data?: unknown[] };
        const dataArr = sObj.data;
        if (Array.isArray(dataArr)) {
          dataArr.forEach((pt: unknown) => {
            if (pt && typeof pt === "object") {
              const v = (pt as Record<string, unknown>).value;
              if (Array.isArray(v) && typeof v[0] === "number")
                allXVals.push(v[0] as number);
            }
          });
        }
      });
      const minX = allXVals.length ? Math.min(...allXVals) : -1;
      const maxX = allXVals.length ? Math.max(...allXVals) : 1;
      const padding = Math.max(1, (maxX - minX) * 0.2);

      option = {
        ...common,
        tooltip: {
          trigger: "item",
          triggerOn: "mousemove|click",
          formatter: (params: unknown) => {
            const p = params as {
              value?: unknown;
              name?: string;
              seriesName?: string;
            };
            let val: unknown = p.value;
            if (Array.isArray(p.value)) val = (p.value as unknown[])[1];
            const seriesName = p.seriesName ? `${p.seriesName}<br/>` : "";
            const name = p.name ? `${p.name}: ` : "";
            return `${seriesName}${name}${
              typeof val === "number" ? formatValue(val, p.name) : String(val)
            }`;
          },
        },
        xAxis: {
          show: false,
          type: "value",
          min: minX - padding,
          max: maxX + padding,
        },
        yAxis: { show: false, type: "value" },
        series,
      };
    } else {
      const categories = Array.from(new Set(data.map((d) => String(d.x))));
      const groupsList = groups.length ? groups : ["default"];
      const series = groupsList.map((g, gi) => {
        const values = categories.map((cat) => {
          const found = data.find(
            (d) => String(d.x) === String(cat) && getGroup(d) === g
          );
          return found ? (typeof found.y === "number" ? found.y : 0) : 0;
        });
        if (effectiveType === "bar") {
          const base: echarts.BarSeriesOption = {
            name: g,
            type: "bar",
            data: values,
            itemStyle: {
              color: colors[gi % colors.length],
              borderRadius: [4, 4, 4, 4], // เพิ่มมุมมนทั้ง 4 มุม
            },
            label: {
              show: displayOptions.showDataLabels,
              fontSize: 14,
              formatter: (params: unknown) => {
                const p = params as { value: number; name?: string };
                return formatValue(p.value, p.name);
              },
            },
            emphasis: {
              focus: "series",
              itemStyle: {
                borderWidth: 4,
                borderColor: "#000",
                shadowBlur: 18,
                shadowColor: "rgba(0,0,0,0.35)",
                borderRadius: [4, 4, 4, 4], // เพิ่มมุมมนทั้ง 4 มุม
              },
              label: { fontSize: 16, fontWeight: 600 },
            },
          } as echarts.BarSeriesOption;
          if (displayOptions.stacked)
            (base as unknown as Record<string, unknown>).stack = "stack";
          return base as echarts.SeriesOption;
        }
        const baseLine: echarts.LineSeriesOption = {
          name: g,
          type: "line",
          data: values,
          smooth: true,
          itemStyle: { color: colors[gi % colors.length] },
          symbolSize: 8,
          label: {
            show: displayOptions.showDataLabels,
            fontSize: 14,
            formatter: (params: unknown) => {
              const p = params as { value: number; name?: string };
              return formatValue(p.value, p.name);
            },
          },
          emphasis: {
            focus: "series",
            scale: true,
            itemStyle: {
              borderWidth: 4,
              borderColor: "#000",
              shadowBlur: 20,
              shadowColor: "rgba(0,0,0,0.35)",
            },
            label: { fontSize: 16, fontWeight: 600 },
          },
        } as echarts.LineSeriesOption;
        if (isAreaType)
          (baseLine as unknown as Record<string, unknown>).areaStyle = {
            opacity: areaOpacity,
          };
        if (displayOptions.stacked)
          (baseLine as unknown as Record<string, unknown>).stack = "stack";
        return baseLine as echarts.SeriesOption;
      });
      const stackingAxis = displayOptions.stackedAxis ?? "y";
      const isHorizontalBar = effectiveType === "bar" && stackingAxis === "x";
      option = {
        ...common,
        tooltip: { trigger: "axis" },
        xAxis: isHorizontalBar
          ? { type: "value", show: displayOptions.showXAxis }
          : {
              type: "category",
              data: categories,
              show: displayOptions.showXAxis,
              axisLabel: { rotate: 45 },
            },
        yAxis: isHorizontalBar
          ? {
              type: "category",
              data: categories,
              show: displayOptions.showYAxis,
            }
          : { type: "value", show: displayOptions.showYAxis },
        series,
      };
    }

    if (effectiveType === "scatter") {
      const scatterData = data
        .filter((d) => typeof d.x !== "undefined" && typeof d.y === "number")
        .map((d) => {
          const x = typeof d.x === "number" ? d.x : parseFloat(String(d.x));
          const y = d.y as number;
          return {
            name: d.label || getGroup(d),
            value: [x, y],
            itemStyle: { color: d.color || colors[0] },
          };
        });
      option = {
        ...common,
        tooltip: {
          trigger: "item",
          triggerOn: "mousemove|click",
          formatter: (params: unknown) => {
            const p = params as { value?: unknown; name?: string };
            let val: unknown = p.value;
            if (Array.isArray(p.value)) val = (p.value as unknown[])[1];
            const name = p.name ? `${p.name}: ` : "";
            return `${name}${
              typeof val === "number"
                ? formatValue(val as number, p.name)
                : String(val)
            }`;
          },
        },
        xAxis: { type: "value", show: displayOptions.showXAxis },
        yAxis: { type: "value", show: displayOptions.showYAxis },
        series: [
          {
            type: "scatter",
            data: scatterData,
            symbolSize: (val: unknown) => (Array.isArray(val) ? 8 : 8),
            label: {
              show: displayOptions.showDataLabels,
              formatter: (params: unknown) => {
                const p = params as { value?: unknown; name?: string };
                let val: unknown = p.value;
                if (Array.isArray(p.value)) val = (p.value as unknown[])[1];
                return typeof val === "number"
                  ? formatValue(val as number, p.name)
                  : p.name || "";
              },
            },
            emphasis: {
              label: { show: true, fontSize: 16, fontWeight: 600 },
            },
          },
        ],
      };
    }

    if (effectiveType === "radar") {
      const indicators = Array.from(new Set(data.map((d) => String(d.x)))).map(
        (cat) => ({
          name: cat,
          max: Math.max(
            1,
            ...data
              .filter((d) => String(d.x) === cat)
              .map((d) => (typeof d.y === "number" ? d.y : 0))
          ),
        })
      );
      const groupsList = groups.length ? groups : ["default"];
      const series = groupsList.map((g, gi) => {
        const values = indicators.map((ind) => {
          const found = data.find(
            (d) => String(d.x) === ind.name && getGroup(d) === g
          );
          return found ? (typeof found.y === "number" ? found.y : 0) : 0;
        });
        return {
          name: g,
          type: "radar",
          data: [{ value: values, name: g }],
          itemStyle: { color: colors[gi % colors.length] },
        } as echarts.SeriesOption;
      });
      option = {
        ...common,
        radar: { indicator: indicators },
        series,
      };
    }

    if (effectiveType === "heatmap") {
      const xs = Array.from(new Set(data.map((d) => String(d.x))));
      const ys = Array.from(new Set(data.map((d) => getGroup(d))));
      const data3 = data.map((d) => [
        xs.indexOf(String(d.x)),
        ys.indexOf(getGroup(d)),
        typeof d.y === "number" ? d.y : 0,
      ]);
      option = {
        ...common,
        xAxis: { type: "category", data: xs, show: displayOptions.showXAxis },
        yAxis: { type: "category", data: ys, show: displayOptions.showYAxis },
        visualMap: {
          min: Math.min(...data3.map((r) => r[2])),
          max: Math.max(...data3.map((r) => r[2])),
          calculable: true,
          inRange: {
            color: [
              "#00bbff",
              "#aadd22",
              "#effd00",
              "#ffef00",
              "#fdae22",
              "#ff0000",
            ],
          },
          orient: "vertical",
          right: 10,
          bottom: 100,
        },
        series: [
          {
            name: "heatmap",
            type: "heatmap",
            data: data3,
            label: {
              show: displayOptions.showDataLabels,
              formatter: (params: unknown) => {
                const p = params as { value?: unknown[] };
                const v =
                  Array.isArray(p.value) && typeof p.value[2] === "number"
                    ? (p.value[2] as number)
                    : typeof p.value === "number"
                    ? (p.value as number)
                    : undefined;
                return typeof v === "number" ? formatValue(v) : "";
              },
            },
          },
        ],
      };
    }

    const decal = ((): Record<string, unknown> | undefined => {
      const p = displayOptions.decalPattern || "none";
      if (!p || p === "none") return undefined;
      const defaultColor = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
      const color = displayOptions.decalColor || defaultColor;
      const scale = (displayOptions.decalScale || 1) as number;
      const s1 = Math.max(1, Math.round(1 * scale));
      const s2 = Math.max(2, Math.round(2 * scale));
      const s6 = Math.max(3, Math.round(6 * scale));
      switch (p) {
        case "dots":
          return {
            type: "dot",
            backgroundColor: "transparent",
            color,
            dashArrayX: [s1, s2],
            dashArrayY: [s1, s2],
          } as Record<string, unknown>;
        case "lines":
          return {
            type: "line",
            backgroundColor: "transparent",
            color,
            dashArrayX: [s6, s2],
          } as Record<string, unknown>;
        case "grid":
          return {
            type: "rect",
            backgroundColor: "transparent",
            color,
            dashArrayX: [s6, s6],
            dashArrayY: [s6, s6],
          } as Record<string, unknown>;
        default:
          return undefined;
      }
    })();

    if (decal) {
      const seriesArr = (option as echarts.EChartsOption).series as unknown;
      if (Array.isArray(seriesArr)) {
        (seriesArr as unknown[]).forEach((s) => {
          const ss = s as Record<string, unknown>;
          ss.itemStyle = {
            ...((ss.itemStyle as Record<string, unknown>) || {}),
            decal,
          };
          if (dark && ss.label)
            ss.label = {
              ...((ss.label as Record<string, unknown>) || {}),
              color: textColor,
            } as unknown;
        });
      }
    }

    // Check if chart type changed to determine if we need full re-render
    const chartTypeChanged = previousChartType.current !== effectiveType;
    previousChartType.current = effectiveType;

    // Use notMerge=true when chart type changes to fully re-render the chart
    // Use notMerge=false (merge) and lazyUpdate=true for other updates to avoid full re-render.
    chart.setOption(option, chartTypeChanged, true);

    // Rebind click handler to ensure callbacks are up-to-date.
    chart.off("click");
    chart.on("click", (params: unknown) => {
      if (!params) return;
      const p = params as echarts.ECElementEvent;
      const comp = (p as unknown as Record<string, unknown>).componentType as
        | string
        | undefined;
      const sType = (p as unknown as Record<string, unknown>).seriesType as
        | string
        | undefined;
      const name = (p as unknown as Record<string, unknown>).name as
        | string
        | undefined;
      const seriesName = (p as unknown as Record<string, unknown>)
        .seriesName as string | undefined;
      const dataItem = (p as unknown as Record<string, unknown>).data;

      // Check if this is an empty segment (no name) and prevent click
      if (sType === "pie" && (!name || name === "")) {
        return; // Don't handle clicks on empty segments
      }

      if (comp === "series") {
        if (sType === "bar" && typeof onBarLabelClick === "function" && name)
          onBarLabelClick(String(name));
        if (sType === "line" && typeof onLineLabelClick === "function")
          onLineLabelClick(name as string, seriesName);
        if (sType === "scatter" && typeof onBubbleLabelClick === "function")
          onBubbleLabelClick(
            String(
              name ||
                (dataItem &&
                  (dataItem as unknown as Record<string, unknown>).name) ||
                ""
            )
          );
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data,
    type,
    colors,
    displayOptions,
    area,
    areaOpacity,
    stacked,
    title,
    showLegend,
    displayInThousands,
    labelFormatter,
    bubbleScatterRadius,
    height,
    width,
    isDonut,
  ]);

  return (
    <div className="space-y-4">
      {!forReport && !isReportMode && (
        <ChartDisplayOptions
          {...displayOptions}
          onOptionsChange={setDisplayOptions}
        />
      )}
      <div
        ref={chartRef}
        className="w-full h-full"
        style={{ minHeight: `${height + 70}px` }}
      />
    </div>
  );
};

export default DashboardChartRender;
