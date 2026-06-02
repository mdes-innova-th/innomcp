"use client";
import React from "react";

interface Props {
  /** Array of latency values in ms (up to 10) */
  samples: number[];
  width?: number;
  height?: number;
}

/**
 * Tiny SVG sparkline showing latency trend.
 * Green when trend is improving (last < first), red when worsening.
 */
export default function LatencySparkline({ samples, width = 44, height = 16 }: Props) {
  if (!samples || samples.length < 2) {
    return (
      <span className="text-[9px] text-muted-foreground/40 tabular-nums">—</span>
    );
  }

  const max = Math.max(...samples, 1);
  const min = Math.min(...samples, 0);
  const range = max - min || 1;
  const pad = 1;

  const pts = samples.map((v, i) => {
    const x = pad + (i / (samples.length - 1)) * (width - pad * 2);
    const y = pad + ((1 - (v - min) / range) * (height - pad * 2));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const trend = samples[samples.length - 1] - samples[0];
  const color = trend <= 0
    ? "stroke-emerald-500 dark:stroke-emerald-400"   // improving
    : "stroke-amber-500 dark:stroke-amber-400";       // worsening

  const lastMs = samples[samples.length - 1];
  const label = lastMs >= 1000 ? `${(lastMs / 1000).toFixed(1)}s` : `${lastMs}ms`;

  return (
    <span className="inline-flex items-center gap-1" title={`Last 10 calls — latest: ${label}`}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        fill="none"
        className="shrink-0"
        aria-hidden
      >
        <polyline
          points={pts.join(" ")}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={color}
        />
      </svg>
      <span className="text-[9px] tabular-nums text-muted-foreground">{label}</span>
    </span>
  );
}
