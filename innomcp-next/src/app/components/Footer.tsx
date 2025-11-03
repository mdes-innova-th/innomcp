"use client";

import { useState, useEffect } from "react";

export default function Footer() {
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  useEffect(() => {
    // Set the current year only on the client side to avoid hydration mismatch
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="w-full text-center py-1.5 mt-1 bg-transparent site-footer">
      <h6 className=" text-white">by Digital Innovation, MDES</h6>
      <p className=" text-white ">
        © {currentYear || "2024"} กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม Ministry
        of Digital Economy and Society
      </p>
    </footer>
  );
}
