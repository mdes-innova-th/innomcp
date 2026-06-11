"use client";

import React, { useEffect, useState } from "react";
import MDESThemeProvider from "@/app/components/common/MDESThemeProvider";
import { INNOMCPProvider } from "@/app/context/INNOMCPProvider";
import ARIALiveRegion from "@/app/components/common/ARIALiveRegion";
import SkipNavigation from "@/app/components/common/SkipNavigation";
import MDESToastSystem from "@/app/components/common/MDESToastSystem";
import PWAInstallPrompt from "@/app/components/common/PWAInstallPrompt";
import MDESOnboarding from "@/app/components/common/MDESOnboarding";
import INNOMCPOfflineBanner from "@/app/components/common/INNOMCPOfflineBanner";
// useTour + useOnlineStatus stubbed below until hooks exist
const useTour = () => ({ tourActive: false, startTour: () => {}, endTour: () => {} });
const useOnlineStatus = () => ({ isOnline: true, isReconnecting: false });

export interface INNOMCPAppShellProps {
  children: React.ReactNode;
}

/**
 * INNOMCPAppShell — Root application wrapper.
 * 
 * Provides theming, global state, accessibility, and optional UI elements
 * such as offline banner, product tour, onboarding, and PWA prompt.
 */
export const INNOMCPAppShell: React.FC<INNOMCPAppShellProps> = ({
  children,
}) => {
  const { tourActive } = useTour();
  const { isOnline } = useOnlineStatus();

  return (
    <MDESThemeProvider>
      <INNOMCPProvider>
        {/* Screen‑reader live region for dynamic announcements */}
        <ARIALiveRegion>{null}</ARIALiveRegion>

        {/* Skip‑to‑content link for keyboard users */}
        <SkipNavigation />

        {/* Global toast notification system */}
        <MDESToastSystem toasts={[]} onDismiss={() => {}} />

        {/* PWA install prompt (only rendered when criteria met) */}
        <PWAInstallPrompt />

        {/* First‑time user onboarding flow (checks localStorage automatically) */}
        <MDESOnboarding isOpen={false} onComplete={() => {}} onSkip={() => {}} />

        {/* Fixed offline banner – visible only when disconnected */}
        {!isOnline && <INNOMCPOfflineBanner isConnected={false} />}

        {/* In‑app product tour (controlled via context) */}
        {/* MDESProductTour placeholder - implement when tour hook is ready */}

        {/* Application content */}
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
      </INNOMCPProvider>
    </MDESThemeProvider>
  );
};