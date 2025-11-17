"use client";

import React from "react";
import DOMPurify from "dompurify";

type Props = {
  html: string;
  className?: string;
};

export default function ChatMessage({ html, className }: Props) {
  // DOMPurify expects a browser environment; this is a client component so
  // `window` should be available. Guard just in case.
  const clean = typeof window !== "undefined"
    ? DOMPurify.sanitize(html, {
        ALLOWED_ATTR: ["class", "src", "alt", "href", "title", "width", "height", "loading"],
      })
    : "";

  return (
    <div className={className ?? ""}>
      <div
        className="prose prose-sm wrap-break-word dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    </div>
  );
}
