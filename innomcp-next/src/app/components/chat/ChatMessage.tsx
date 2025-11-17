"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

type Props = {
  html: string;
  className?: string;
};

export default function ChatMessage({ html, className }: Props) {
  return (
    <div className={className ?? ""}>
      <div className="prose prose-sm wrap-break-word dark:prose-invert">
        <ReactMarkdown
          rehypePlugins={[rehypeRaw]}
          components={
            {
              // Custom components can be added here if needed
            }
          }
        >
          {html}
        </ReactMarkdown>
      </div>
    </div>
  );
}
