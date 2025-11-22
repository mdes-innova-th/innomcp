"use client";

import { useState, useEffect } from "react";

export default function Footer() {
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  useEffect(() => {
    // Set the current year only on the client side to avoid hydration mismatch
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="fixed z-5 w-full text-center bottom-0 p-2 text-gray-500 text-sm bg-transparent">
      <div className="text-xs">
        by Digital Innovation, MDES
        <br />© {currentYear || "2025"} กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม
        Ministry of Digital Economy and Society
      </div>
    </footer>
  );
}
