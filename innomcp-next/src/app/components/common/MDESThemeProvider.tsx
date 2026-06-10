"use client";

import React, { useEffect, useState } from "react";

interface MDESThemeProviderProps {
  children: React.ReactNode;
}

const LIGHT_VARS = `
  --mdes-chat-bg: oklch(0.985 0 0);
  --mdes-message-user: oklch(0.95 0.02 265);
  --mdes-message-ai: oklch(1 0 0);
  --mdes-accent-ring: #1a3c6e;
  --mdes-primary: #1a3c6e;
  --mdes-primary-light: #2d5a9e;
  --mdes-accent: #c8973e;
`;

const DARK_VARS = `
  --mdes-chat-bg: oklch(0.08 0 0);
  --mdes-message-user: oklch(0.15 0.03 265);
  --mdes-message-ai: oklch(0.11 0 0);
  --mdes-accent-ring: #2d5a9e;
  --mdes-primary: #2d5a9e;
  --mdes-primary-light: #4a7cbf;
  --mdes-accent: #e8b85e;
`;

export default function MDESThemeProvider({ children }: MDESThemeProviderProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const current = stored ?? (prefersDark ? "dark" : "light");
    setTheme(current);

    const observer = new MutationObserver(() => {
      const newTheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
      setTheme(newTheme);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const vars = theme === "dark" ? DARK_VARS : LIGHT_VARS;

  return (
    <>
      <style>{`:root { ${vars} }`}</style>
      {children}
    </>
  );
}
