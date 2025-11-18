"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

type Props = {
  html: string;
  className?: string;
};

export default function ChatMessage({ html, className }: Props) {
  return (
    <div className={className ?? ""}>
      <div className="prose prose-sm wrap-break-word dark:prose-invert">
        {
          /*
            Render markdown to React elements. We enable rehype-raw so any
            HTML embedded in the Markdown is parsed, but we immediately
            sanitize that HTML with rehype-sanitize to avoid XSS. The
            default schema from rehype-sanitize is used; if you need to
            allow additional tags/attributes, provide a custom schema.
          */
        }
        <ReactMarkdown rehypePlugins={[rehypeRaw, rehypeSanitize] as any} components={{}}>
          {html}
        </ReactMarkdown>
      </div>
    </div>
  );
}
