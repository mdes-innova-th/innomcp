"use client";

import React, { useState } from "react";
import Image from "next/image";
import { FaMoon, FaSun } from "react-icons/fa";
import { useTheme } from "@/app/context/ThemeContext";

const HUB_LINKS = [
  {
    href: "https://wddsb.dataxo.info/complex-chart",
    label: "Complex Chart",
    description: "ดูข้อมูลเชิงภาพและกราฟแบบเจาะลึก",
    icon: "📈",
  },
  {
    href: "https://wddsb.dataxo.info/search-url",
    label: "ค้นหา URL",
    description: "ค้นหาและสำรวจแหล่งข้อมูลภายนอกอย่างรวดเร็ว",
    icon: "🔎",
  },
  {
    href: "https://aoc.dataxo.info",
    label: "AOC Platform",
    description: "เปิดระบบ AOC เพื่อทำงานต่อในอีกพื้นที่หนึ่ง",
    icon: "🛰️",
  },
] as const;

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const [showMDESHub, setShowMDESHub] = useState(false);

  const openHubLink = (href: string) => {
    window.open(href, "_blank", "noopener,noreferrer");
    setShowMDESHub(false);
  };

  return (
    <header className="sticky top-0 z-60 border-b border-border/50 bg-background/96 shadow-[0_1px_0_0_oklch(0_0_0/0.05)] backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-5 lg:px-6">

        {/* Left — unified brand: InnoMCP | MDES Workspace */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative hidden h-9 w-28 shrink-0 sm:block md:w-36">
            <Image
              src="/logo.png"
              alt="InnoMCP"
              fill
              sizes="(max-width: 768px) 112px, 144px"
              className="object-contain object-left"
            />
          </div>

          {/* Hairline divider */}
          <div className="hidden h-5 w-px shrink-0 bg-border/60 sm:block" aria-hidden="true" />

          {/* MDES brand inline — no card/border box */}
          <div className="flex min-w-0 items-center gap-2">
            <div className="relative h-6 w-20 shrink-0 sm:w-24">
              <Image
                src="/mdes-new-logo.png"
                alt="MDES"
                fill
                sizes="(max-width: 640px) 80px, 96px"
                className="object-contain object-left"
              />
            </div>
            <div className="hidden min-w-0 lg:block">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/75">
                Operations
              </div>
              <div className="text-[11.5px] font-medium leading-none text-foreground/70">
                MDES Workspace
              </div>
            </div>
          </div>
        </div>

        {/* Right — compact action buttons */}
        <div className="flex items-center gap-1 sm:gap-1.5">

          {/* Theme toggle — icon-only ghost with a 360° spin on switch.
              Phase 10.37 — adds aria-pressed for screen readers + subtle hover ring. */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-pressed={theme === "dark"}
            aria-label={theme === "dark" ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"}
            title={theme === "dark" ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"}
            data-testid="theme-toggle"
            className="group/themetoggle relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
          >
            <span
              key={theme}
              className="inline-flex items-center justify-center transition-transform duration-500 motion-reduce:transition-none"
              style={{ animation: "theme-spin 380ms ease-out" }}
            >
              {theme === "dark"
                ? <FaSun className="text-[13.5px] text-amber-400 group-hover/themetoggle:text-amber-300" />
                : <FaMoon className="text-[13.5px] text-sky-600 group-hover/themetoggle:text-sky-500" />}
            </span>
          </button>

          {/* MDES Hub — compact, label only on sm+ */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMDESHub((v) => !v)}
              aria-expanded={showMDESHub}
              aria-haspopup="true"
              title="เปิด MDES Hub"
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              <Image
                src={theme === "light" ? "/Mdeshub-icon-light-bg.png" : "/Mdeshub-icon.png"}
                alt="MDES Hub"
                width={85}
                height={56}
                sizes="36px"
                className="h-6 w-auto object-contain"
              />
              <span className="hidden text-[12px] font-medium sm:inline">MDES Hub</span>
              <svg
                className={`h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform ${showMDESHub ? "rotate-180" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {showMDESHub && (
              <>
                <button
                  type="button"
                  aria-label="ปิดเมนู MDES Hub"
                  className="fixed inset-0 z-[64] cursor-default bg-transparent"
                  onClick={() => setShowMDESHub(false)}
                />
                <div className="absolute right-0 top-full z-[65] mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border/70 bg-card/97 p-1.5 shadow-xl backdrop-blur-xl">
                  <div className="px-3 py-2">
                    <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-primary/80">
                      MDES Hub
                    </div>
                    <div className="mt-0.5 text-[12px] leading-5 text-muted-foreground">
                      เปิดเครื่องมือภายนอกที่ใช้ร่วมกับ workspace
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    {HUB_LINKS.map((link) => (
                      <button
                        key={link.href}
                        type="button"
                        onClick={() => openHubLink(link.href)}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-primary/8"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[15px]">
                          {link.icon}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-foreground">{link.label}</div>
                          <div className="mt-0.5 text-[11.5px] leading-4 text-muted-foreground">
                            {link.description}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
