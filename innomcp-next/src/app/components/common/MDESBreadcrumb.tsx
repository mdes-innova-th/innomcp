"use client";

import React from "react";
import Link from "next/link";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface MDESBreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * MDESBreadcrumb – Breadcrumb navigation for INNOMCP.
 * Uses Thai labels and MDES indigo accent for the active item.
 * Accessible with `role="navigation"` and `aria-label="เส้นทาง"`.
 */
export default function MDESBreadcrumb({ items, className = "" }: MDESBreadcrumbProps) {
  return (
    <nav
      aria-label="เส้นทาง"
      className={`w-full ${className}`.trim()}
    >
      <ol className="flex items-center list-none p-0 m-0">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isActive = !item.href && isLast; // last item without href is active

          return (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <span
                  className="mx-2 text-gray-400 select-none"
                  aria-hidden="true"
                >
                  ›
                </span>
              )}

              {item.href ? (
                <Link
                  href={item.href}
                  className="text-gray-600 hover:text-indigo-600 transition-colors duration-150"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={`font-medium ${
                    isActive
                      ? "text-indigo-700"
                      : "text-gray-600"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}