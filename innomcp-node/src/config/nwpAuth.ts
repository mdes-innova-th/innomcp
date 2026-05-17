const NWP_REQUIRED_SCOPES = {
  nwp_daily_by_place: ["nwp.api.forecast_location"],
  nwp_hourly_by_place: ["nwp.api.location.forecast_hourly"],
  nwp_daily_by_location: ["nwp.api.location.forecast_daily"],
  nwp_hourly_by_location: ["nwp.api.location.forecast_hourly"],
  nwp_daily_by_region: ["nwp.api.forecast_area"],
  nwp_hourly_by_region: ["nwp.api.forecast_area"],
  nwp_daily: ["nwp.api.location.forecast_daily"],
  nwp_hourly: ["nwp.api.location.forecast_hourly"],
  nwp_area: ["nwp.api.forecast_area"],
} as const;

export type NwpToolName = keyof typeof NWP_REQUIRED_SCOPES;

export interface NwpTokenInfo {
  present: boolean;
  scopes: string[];
  malformed: boolean;
}

function normalizeToken(raw: string | undefined): string {
  const token = String(raw || "").trim();
  if (!token) return "";
  return token.toLowerCase().startsWith("bearer ") ? token.slice(token.indexOf(" ") + 1).trim() : token;
}

function decodeJwtPayloadSegment(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const json = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function inspectNwpToken(rawToken: string | undefined): NwpTokenInfo {
  const token = normalizeToken(rawToken);
  if (!token) {
    return { present: false, scopes: [], malformed: false };
  }

  const payload = decodeJwtPayloadSegment(token);
  if (!payload) {
    return { present: true, scopes: [], malformed: true };
  }

  const rawScopes = Array.isArray(payload.scopes) ? payload.scopes : [];
  const scopes = rawScopes
    .map((scope) => String(scope || "").trim())
    .filter(Boolean);

  return { present: true, scopes, malformed: false };
}

export function getMissingNwpScopes(
  toolName: string,
  tokenInfo: NwpTokenInfo
): string[] {
  const requiredScopes = NWP_REQUIRED_SCOPES[toolName as NwpToolName];
  if (!requiredScopes) return [];
  const owned = new Set(tokenInfo.scopes);
  return requiredScopes.filter((scope) => !owned.has(scope));
}

export function canCallNwpTool(toolName: string, rawToken: string | undefined): boolean {
  const tokenInfo = inspectNwpToken(rawToken);
  if (!tokenInfo.present || tokenInfo.malformed) return false;
  return getMissingNwpScopes(toolName, tokenInfo).length === 0;
}