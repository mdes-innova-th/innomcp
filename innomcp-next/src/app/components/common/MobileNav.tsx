"use client";

import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", icon: "💬", label: "Chat" },
  { href: "/dashboard", icon: "📊", label: "Dashboard" },
  { href: "/task-history", icon: "📋", label: "History" },
  { href: "/projects", icon: "📁", label: "Projects" },
] as const;

export default function MobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden border-t border-border/40 bg-background/95 backdrop-blur-sm">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-muted-foreground hover:text-foreground transition-colors active:scale-95"
        >
          <span className="text-[20px] leading-none">{item.icon}</span>
          <span className="text-[10px]">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
