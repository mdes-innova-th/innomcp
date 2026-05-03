"use client";

import { useState, useEffect } from "react";

interface FooterProps {
  variant?: "default" | "compact";
  align?: "center" | "left" | "right";
  companyName?: string;
  isVisible?: boolean;
}

export default function Footer({
  variant = "default",
  align = "center",
  companyName = "กองนวัตกรรมด้านดิจิทัล",
  isVisible = true
}: FooterProps) {
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  useEffect(() => {
    // Set the current year only on the client side to avoid hydration mismatch
    setCurrentYear(new Date().getFullYear());
  }, []);

  // Alignment classes
  const alignmentClasses = {
    center: "justify-center text-center",
    left: "justify-start text-left",
    right: "justify-end text-right"
  };

  // Compact footer for chat page
  if (variant === "compact") {
    return (
      <footer 
        className={`w-full bg-card/50 backdrop-blur-sm transition-all duration-300 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'
        }`}
      >
        <div className="container mx-auto px-4 py-3">
          <div className={`flex ${alignmentClasses[align]}`}>
            <p className="text-xs text-muted-foreground">
              by {companyName} © {currentYear || "2025"} กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม
            </p>
          </div>
        </div>
      </footer>
    );
  }

  // Default footer
  return (
    <footer 
      className={`w-full bg-card transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'
      }`}
    >
      <div className="container mx-auto px-4 py-4">
        <div className="text-center">
          <div className="text-sm font-medium text-foreground mb-2">
            {companyName}
          </div>
          <div className="text-xs text-muted-foreground">
            © {currentYear || "2025"} กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม
            <br />
            Ministry of Digital Economy and Society
          </div>
        </div>
      </div>
    </footer>
  );
}
