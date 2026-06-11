// LazyPanels.tsx
// INNOMCP Thailand government AI platform by MDES (กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม)
// Lazy-loaded panel registry to reduce initial bundle size using Next.js dynamic imports

import dynamic from "next/dynamic";

// Shared loading skeleton for all lazy panels
const loading = () => <div className="animate-pulse bg-muted/30 rounded-md h-20 m-4" />;

// Re-export each heavy panel as a dynamic component (client-side only, no SSR)
export const LazyManusWorkspacePanel = dynamic(
  () => import("./ManusWorkspacePanel"),
  { ssr: false, loading }
);

export const LazyModelSettingsPanel = dynamic(
  () => import("./ModelSettingsPanel"),
  { ssr: false, loading }
);

export const LazyMultiAgentPanel = dynamic(
  () => import("./MultiAgentPanel"),
  { ssr: false, loading }
);

export const LazyCommandPaletteV2 = dynamic(
  () => import("../common/MDESCommandPaletteV2"),
  { ssr: false, loading }
);

export const LazyINNOMCPSettings = dynamic(
  () => import("../settings/INNOMCPSettingsPanel"),
  { ssr: false, loading }
);

export const LazyWorkspaceFileBrowser = dynamic(
  () => import("./WorkspaceFileBrowser"),
  { ssr: false, loading }
);

export const LazySystemStatusPanel = dynamic(
  () => import("./SystemStatusPanel"),
  { ssr: false, loading }
);

export const LazyAnalyticsPanel = dynamic(
  () => import("./MDESAnalyticsPanel"),
  { ssr: false, loading }
);