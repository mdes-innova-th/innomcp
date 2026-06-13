<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from improve)
 member: FX-020 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2666,"completion_tokens":7210,"total_tokens":9876,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5538,"image_tokens":0},"cache_creation_input_tokens":0} | 64s
 generated: 2026-06-13T11:41:19.917Z -->
FILE: innomcp-node/src/providers/router.ts
<<<<<<< SEARCH
export function selectProvider(opts: SelectOptions): SelectionResult {
  const all = listProviders().filter((p) => p.enabled);
  const candidates = all
    .filter((p) => matchesMode(p, opts.mode))
    .filter((p) => matchesPrivacy(p, opts.privacyLevel))
    .filter((p) => (opts.excludeDown !== false ? p.healthStatus !== "down" : true));

  if (candidates.length === 0) {
    return {
      provider: null,
      alternates: [],
      reason: "ไม่พบผู้ให้บริการที่เข้าเงื่อนไขการเลือก",
    };
  }

  const capabilityCandidates =
    opts.capabilities.length > 0
      ? candidates.filter((p) => capabilityScore(p, opts.capabilities) > 0)
      : candidates;
  const eligible = capabilityCandidates.length > 0 ? capabilityCandidates : candidates;
  const rank = (p: ProviderRecord) => capabilityScore(p, opts.capabilities) * 100 + p.priority;
  const preferred = opts.preferredProviderId
    ? eligible.find((p) => p.id === opts.preferredProviderId)
    : undefined;

  if (preferred && capabilityScore(preferred, opts.capabilities) > 0) {
    const alternates = eligible
      .filter((p) => p.id !== preferred.id)
      .sort((a, b) => rank(b) - rank(a));
    const matched = opts.capabilities.filter((c) => preferred.capabilities.includes(c));
    const reason =
      `เลือก ${preferred.displayName} ตาม provider ที่ผู้ใช้ระบุ` +
      (matched.length > 0 ? `: ตรงความสามารถ ${matched.join(", ")}` : "");

    return { provider: preferred, alternates, reason };
  }

  const ranked = eligible
    .map((p) => ({
      p,
      score: rank(p),
    }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0].p;
  const alternates = ranked.slice(1).map((r) => r.p);
  const matched = opts.capabilities.filter((c) => top.capabilities.includes(c));
  const reason =
    `เลือก ${top.displayName} (priority=${top.priority})` +
    (matched.length > 0 ? `: ตรงความสามารถ ${matched.join(", ")}` : "");

  return { provider: top, alternates, reason };
}
=======
export function selectProvider(opts: SelectOptions): SelectionResult {
  try {
    const all = listProviders().filter((p) => p.enabled);
    const candidates = all
      .filter((p) => matchesMode(p, opts.mode))
      .filter((p) => matchesPrivacy(p, opts.privacyLevel))
      .filter((p) => (opts.excludeDown !== false ? p.healthStatus !== "down" : true));

    if (candidates.length === 0) {
      return {
        provider: null,
        alternates: [],
        reason: "ไม่พบผู้ให้บริการที่เข้าเงื่อนไขการเลือก",
      };
    }

    const capabilityCandidates =
      opts.capabilities.length > 0
        ? candidates.filter((p) => capabilityScore(p, opts.capabilities) > 0)
        : candidates;
    const eligible = capabilityCandidates.length > 0 ? capabilityCandidates : candidates;
    const rank = (p: ProviderRecord) => capabilityScore(p, opts.capabilities) * 100 + (p.priority ?? 0);
    const preferred = opts.preferredProviderId
      ? eligible.find((p) => p.id === opts.preferredProviderId)
      : undefined;

    if (preferred && capabilityScore(preferred, opts.capabilities) > 0) {
      const alternates = eligible
        .filter((p) => p.id !== preferred.id)
        .sort((a, b) => rank(b) - rank(a));
      const matched = opts.capabilities.filter((c) => preferred.capabilities.includes(c));
      const reason =
        `เลือก ${preferred.displayName} ตาม provider ที่ผู้ใช้ระบุ` +
        (matched.length > 0 ? `: ตรงความสามารถ ${matched.join(", ")}` : "");

      return { provider: preferred, alternates, reason };
    }

    const ranked = eligible
      .map((p) => ({
        p,
        score: rank(p),
      }))
      .sort((a, b) => b.score - a.score);

    const top = ranked[0].p;
    const alternates = ranked.slice(1).map((r) => r.p);
    const matched = opts.capabilities.filter((c) => top.capabilities.includes(c));
    const reason =
      `เลือก ${top.displayName} (priority=${top.priority})` +
      (matched.length > 0 ? `: ตรงความสามารถ ${matched.join(", ")}` : "");

    return { provider: top, alternates, reason };
  } catch (error) {
    return {
      provider: null,
      alternates: [],
      reason: "เกิดข้อผิดพลาดระหว่างการเลือกผู้ให้บริการ",
    };
  }
}
>>>>>>> REPLACE

FILE: innomcp-node/src/providers/router.ts
<<<<<<< SEARCH
function matchesPrivacy(p: ProviderRecord, want?: PrivacyLevel): boolean {
  if (!want) return true;
  // confidential demands confidential or internal; public demands any.
  if (want === "confidential") return p.privacyLevel === "confidential" || p.privacyLevel === "internal";
  if (want === "internal") return p.privacyLevel !== "public";
  return true;
}
=======
function matchesPrivacy(p: ProviderRecord, want?: PrivacyLevel): boolean {
  if (!want) return true;
  const privacy = p.privacyLevel ?? "public";
  // confidential demands confidential or internal; public demands any.
  if (want === "confidential") return privacy === "confidential" || privacy === "internal";
  if (want === "internal") return privacy !== "public";
  return true;
}
>>>>>>> REPLACE

FILE: innomcp-node/src/providers/router.ts
<<<<<<< SEARCH
/**
 * Resolve the endpoint config for an env-gated provider by ID.
 * Returns null for unknown or registry-managed providers.
 */
export function resolveProviderEndpoint(
  providerId: string
): { url: string; key: string; model: string } | null {
  const provider = getProvider(providerId);
  if (!provider) return null;

  const key = resolveApiKey(providerId) || "";

  return {
    url: provider.baseUrl,
    key: key,
    model: provider.model,
  };
}
=======
/**
 * Resolve the endpoint config for an env-gated provider by ID.
 * Returns null for unknown or registry-managed providers, or if required fields are missing.
 */
export function resolveProviderEndpoint(
  providerId: string
): { url: string; key: string; model: string } | null {
  try {
    const provider = getProvider(providerId);
    if (!provider) return null;
    if (!provider.baseUrl || !provider.model) return null;

    const key = resolveApiKey(providerId) || "";

    return {
      url: provider.baseUrl,
      key,
      model: provider.model,
    };
  } catch (error) {
    return null;
  }
}
>>>>>>> REPLACE

SKIP: `resolveApiKey` is a synchronous function (imported from the registry); no async issue present.
