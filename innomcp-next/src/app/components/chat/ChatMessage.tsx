"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

type Props = {
  html: string;
  className?: string;
};

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] || []), "style", "class"], // Allow style and class attributes on all elements for color and styling support
  },
};

export default function ChatMessage({ html, className }: Props) {
  return (
    <div className={className ?? ""}>
      <div className="prose prose-sm wrap-break-word dark:prose-invert">
        {/*
            Render markdown to React elements. We enable remark-gfm for GitHub Flavored Markdown,
            rehype-raw so any HTML embedded in the Markdown is parsed, but we immediately
            sanitize that HTML with rehype-sanitize to avoid XSS. We allow style attributes
            to support color text and other styling.
          */}
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
          components={{
            table: ({ children }) => (
              <table className="border-collapse border border-gray-300 dark:border-gray-600">
                {children}
              </table>
            ),
            th: ({ children }) => (
              <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 bg-gray-100 dark:bg-gray-800">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                {children}
              </td>
            ),
          }}
        >
          {html}
        </ReactMarkdown>
      </div>
    </div>
  );
}
