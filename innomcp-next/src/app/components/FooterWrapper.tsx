"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";

export default function FooterWrapper() {
  const pathname = usePathname();
  
  // Hide footer on chat page (home page)
  const isVisible = pathname !== "/";
  
  return <Footer isVisible={isVisible} />;
}
