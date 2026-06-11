"use client";

import React from "react";
import type { FC, ReactNode } from "react";

// ────────────────────────────── ModelBadge ──────────────────────────────
interface ModelBadgeProps {
  model: string;
  size?: "xs" | "sm";
}

export const ModelBadge: FC<ModelBadgeProps> = ({ model, size = "sm" }) => {
  const sizeClasses =
    size === "xs"
      ? "text-xs px-2 py-0.5"
      : "text-sm px-2.5 py-1";

  return (
    <span
      className={`inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 font-medium text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-400 ${sizeClasses}`}
    >
      {model}
    </span>
  );
};
ModelBadge.displayName = "ModelBadge";

// ────────────────────────────── ProviderTypeBadge ──────────────────────────────
type ProviderType = "mdes" | "openai" | "anthropic" | "local" | "custom";

const providerLabelMap: Record<ProviderType, string> = {
  mdes: "MDES",
  openai: "OpenAI",
  anthropic: "Anthropic",
  local: "ภายในองค์กร",
  custom: "กำหนดเอง",
};

const providerColorMap: Record<ProviderType, string> = {
  mdes: "bg-blue-600 text-white",
  openai: "bg-emerald-600 text-white",
  anthropic: "bg-purple-600 text-white",
  local: "bg-amber-600 text-white",
  custom: "bg-gray-600 text-white",
};

interface ProviderTypeBadgeProps {
  type: ProviderType;
}

export const ProviderTypeBadge: FC<ProviderTypeBadgeProps> = ({ type }) => {
  const label = providerLabelMap[type] ?? type;
  const colorClasses = providerColorMap[type] ?? "bg-gray-400 text-white";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-none ${colorClasses}`}
    >
      {label}
    </span>
  );
};
ProviderTypeBadge.displayName = "ProviderTypeBadge";

// ────────────────────────────── StatusBadge ──────────────────────────────
type Status = "online" | "offline" | "degraded";

const statusLabelMap: Record<Status, string> = {
  online: "ออนไลน์",
  offline: "ออฟไลน์",
  degraded: "ประสิทธิภาพลดลง",
};

const statusColorMap: Record<Status, { dot: string; text: string }> = {
  online: { dot: "bg-emerald-500", text: "text-emerald-800 dark:text-emerald-300" },
  offline: { dot: "bg-red-500", text: "text-red-800 dark:text-red-300" },
  degraded: { dot: "bg-amber-500", text: "text-amber-800 dark:text-amber-300" },
};

interface StatusBadgeProps {
  status: Status;
  latencyMs?: number;
}

export const StatusBadge: FC<StatusBadgeProps> = ({ status, latencyMs }) => {
  const label = statusLabelMap[status] ?? status;
  const colors = statusColorMap[status] ?? { dot: "bg-gray-400", text: "text-gray-800" };
  const latencyText = latencyMs != null ? ` (${latencyMs}ms)` : "";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium dark:border-gray-700 ${colors.text}`}
    >
      <span className={`h-2 w-2 rounded-full ${colors.dot}`} aria-hidden="true" />
      {label}
      {latencyText}
    </span>
  );
};
StatusBadge.displayName = "StatusBadge";

// ────────────────────────────── CapabilityBadge ──────────────────────────────
interface CapabilityBadgeProps {
  capability: string;
}

export const CapabilityBadge: FC<CapabilityBadgeProps> = ({ capability }) => (
  <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 dark:bg-teal-500/10 dark:text-teal-400">
    {capability}
  </span>
);
CapabilityBadge.displayName = "CapabilityBadge";

// ────────────────────────────── ProvinceBadge ──────────────────────────────
interface ProvinceBadgeProps {
  province: string;
  region?: string;
}

export const ProvinceBadge: FC<ProvinceBadgeProps> = ({ province, region }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
    <span>{province}</span>
    {region && (
      <span className="opacity-70">({region})</span>
    )}
  </span>
);
ProvinceBadge.displayName = "ProvinceBadge";

// ────────────────────────────── VersionBadge ──────────────────────────────
type VersionType = "stable" | "beta" | "dev";

const versionTypeLabelMap: Record<VersionType, string> = {
  stable: "เสถียร",
  beta: "เบต้า",
  dev: "กำลังพัฒนา",
};

const versionColorMap: Record<VersionType, string> = {
  stable: "bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400",
  beta: "bg-orange-100 text-orange-800 dark:bg-orange-500/10 dark:text-orange-400",
  dev: "bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400",
};

interface VersionBadgeProps {
  version: string;
  type?: VersionType;
}

export const VersionBadge: FC<VersionBadgeProps> = ({ version, type = "stable" }) => {
  const colorClasses = versionColorMap[type] ?? versionColorMap.stable;
  const label = versionTypeLabelMap[type] ?? version;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${colorClasses}`}
    >
      {version}
      <span className="ml-1.5 opacity-70">{label}</span>
    </span>
  );
};
VersionBadge.displayName = "VersionBadge";

// ────────────────────────────── GovTierBadge ──────────────────────────────
type GovTier = "public" | "restricted" | "confidential";

const tierLabelMap: Record<GovTier, string> = {
  public: "สาธารณะ",
  restricted: "จำกัดการเข้าถึง",
  confidential: "ความลับ",
};

const tierColorMap: Record<GovTier, string> = {
  public: "bg-green-600 text-white",
  restricted: "bg-amber-600 text-white",
  confidential: "bg-red-600 text-white",
};

interface GovTierBadgeProps {
  tier: GovTier;
}

export const GovTierBadge: FC<GovTierBadgeProps> = ({ tier }) => {
  const label = tierLabelMap[tier] ?? tier;
  const colorClasses = tierColorMap[tier] ?? "bg-gray-600 text-white";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${colorClasses}`}
    >
      {label}
    </span>
  );
};
GovTierBadge.displayName = "GovTierBadge";