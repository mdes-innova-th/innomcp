import React from "react";

interface ChartDisplayOptionsProps {
  showTitle: boolean;
  showDataLabels: boolean;
  showXAxis: boolean;
  showYAxis: boolean;
  showLegend: boolean;
  decalPattern?: "none" | "dots" | "lines" | "grid";
  decalScale?: number;
  decalColor?: string;
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
  selectedGroups?: string[];
  onOptionsChange: (options: {
    showTitle: boolean;
    showDataLabels: boolean;
    showXAxis: boolean;
    showYAxis: boolean;
    showLegend: boolean;
    decalPattern?: "none" | "dots" | "lines" | "grid";
    decalScale?: number;
    decalColor?: string;
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
    selectedGroups?: string[];
  }) => void;
}

export function ChartDisplayOptions({
  showTitle,
  showDataLabels,
  showXAxis,
  showYAxis,
  showLegend = false,
  decalPattern = "none",
  decalScale = 1,
  decalColor = "#000000",
  chartType = "line",
  stacked = false,
  stackedAxis = "y",
  selectedGroups = [],
  onOptionsChange,
}: ChartDisplayOptionsProps) {
  const handleChange =
    (
      optionName:
        | "showTitle"
        | "showDataLabels"
        | "showXAxis"
        | "showYAxis"
        | "showLegend"
        | "stacked"
        | "stackedAxis"
        | "decalPattern"
        | "decalScale"
    ) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onOptionsChange({
        showTitle: optionName === "showTitle" ? e.target.checked : showTitle,
        showDataLabels:
          optionName === "showDataLabels" ? e.target.checked : showDataLabels,
        showXAxis: optionName === "showXAxis" ? e.target.checked : showXAxis,
        showYAxis: optionName === "showYAxis" ? e.target.checked : showYAxis,
        showLegend: optionName === "showLegend" ? e.target.checked : showLegend,
        chartType,
        stacked: optionName === "stacked" ? e.target.checked : stacked,
        // preserve current stackedAxis when toggling other options
        stackedAxis,
        selectedGroups,
        decalPattern,
        decalScale,
        decalColor,
      });
    };

  const handleAxisChange = (axis: "x" | "y") => () => {
    onOptionsChange({
      showTitle,
      showDataLabels,
      showXAxis,
      showYAxis,
      showLegend,
      // selecting an axis implies stacking should be enabled so the radio visibly selects
      stacked: true,
      stackedAxis: axis,
      chartType,
      selectedGroups,
    });
  };

  const handleChartTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as
      | "bar"
      | "line"
      | "pie"
      | "bubble"
      | "scatter"
      | "radar"
      | "heatmap"
      | "area";
    onOptionsChange({
      showTitle,
      showDataLabels,
      showXAxis,
      showYAxis,
      showLegend,
      decalPattern,
      decalScale,
      decalColor,
      chartType: next,
      stacked,
      stackedAxis,
      selectedGroups,
    });
  };

  const handleDecalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as "none" | "dots" | "lines" | "grid";
    onOptionsChange({
      showTitle,
      showDataLabels,
      showXAxis,
      showYAxis,
      showLegend,
      decalPattern: next,
      decalScale,
      decalColor,
      chartType,
      stacked,
      stackedAxis,
      selectedGroups,
    });
  };

  const handleDecalScaleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = Number(e.target.value) || 1;
    onOptionsChange({
      showTitle,
      showDataLabels,
      showXAxis,
      showYAxis,
      showLegend,
      decalPattern,
      decalScale: next,
      decalColor,
      chartType,
      stacked,
      stackedAxis,
      selectedGroups,
    });
  };

  const handleDecalColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value || "#000000";
    onOptionsChange({
      showTitle,
      showDataLabels,
      showXAxis,
      showYAxis,
      showLegend,
      decalPattern,
      decalScale,
      decalColor: next,
      chartType,
      stacked,
      stackedAxis,
      selectedGroups,
    });
  };

  return (
    <div className="flex flex-wrap gap-4 p-2 border border-gray-200 rounded shadow-sm bg-white">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={showTitle}
          onChange={handleChange("showTitle")}
          className="rounded border-gray-300 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">แสดงชื่อกราฟ</span>
      </label>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={showDataLabels}
          onChange={handleChange("showDataLabels")}
          className="rounded border-gray-300 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">แสดงค่าข้อมูล</span>
      </label>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={showXAxis}
          onChange={handleChange("showXAxis")}
          className="rounded border-gray-300 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">แสดงแกน X</span>
      </label>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={showYAxis}
          onChange={handleChange("showYAxis")}
          className="rounded border-gray-300 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">แสดงแกน Y</span>
      </label>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={showLegend}
          onChange={handleChange("showLegend")}
          className="rounded border-gray-300 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">แสดงคำอธิบาย</span>
      </label>

      <div className="flex items-center border-1 rounded border-gray-400 px-1">
        <label className="text-sm text-gray-600">ชนิดกราฟ:</label>
        <select
          value={chartType}
          onChange={handleChartTypeChange}
          className="rounded border border-gray-300 px-2 py-1 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-400 focus:outline-none"
        >
          <option value="line">Line</option>
          <option value="bar">Bar</option>
          <option value="area">Area</option>
          <option value="pie">Pie</option>
          <option value="bubble">Bubble</option>
          <option value="scatter">Scatter</option>
          <option value="radar">Radar</option>
          <option value="heatmap">Heatmap</option>
        </select>
      </div>

      <div className="flex items-center gap-3 border rounded border-gray-400 px-2 py-1">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={stacked}
            onChange={handleChange("stacked")}
            className="rounded border-gray-300 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Stack</span>
        </label>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Axis:</span>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="radio"
              name="stackedAxis"
              checked={stackedAxis === "y"}
              onChange={handleAxisChange("y")}
              className="rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Y</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="radio"
              name="stackedAxis"
              checked={stackedAxis === "x"}
              onChange={handleAxisChange("x")}
              className="rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">X</span>
          </label>
        </div>
      </div>

      <div className="flex items-center gap-2 border-1 rounded border-gray-400 px-2 py-1">
        <label className="text-sm text-gray-600">Decal:</label>
        <select
          value={decalPattern}
          onChange={handleDecalChange}
          className="rounded border border-gray-300 px-2 py-1 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-400 focus:outline-none"
        >
          <option value="none">ไม่มี</option>
          <option value="dots">จุด</option>
          <option value="lines">เส้น</option>
          <option value="grid">ตาราง</option>
        </select>

        {decalPattern !== "none" && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">ขนาด:</label>
            <select
              value={String(decalScale)}
              onChange={handleDecalScaleChange}
              className="rounded border border-gray-300 px-2 py-1 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-400 focus:outline-none"
            >
              <option value="0.5">เล็ก</option>
              <option value="1">ปกติ</option>
              <option value="1.5">ใหญ่</option>
              <option value="2">ใหญ่สุด</option>
            </select>
            <label className="text-sm text-gray-600">สี:</label>
            <input
              type="color"
              value={decalColor}
              onChange={handleDecalColorChange}
              title="เลือกสีแพทเทิร์น"
              className="w-6 h-6 p-0 border-0"
            />
          </div>
        )}
      </div>
    </div>
  );
}
