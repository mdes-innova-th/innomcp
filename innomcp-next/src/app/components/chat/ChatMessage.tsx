"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { useTheme } from "@/app/context/ThemeContext";

type Props = {
  html: string;
  className?: string;
};

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] || []), "class"], // Allow class attributes on all elements for styling; do NOT allow inline `style` to reduce XSS risk
  },
};

export default function ChatMessage({ html, className }: Props) {
  return (
    <div className={className ?? ""}>
      <div className="prose prose-sm wrap-break-word dark:prose-invert">
        {/*
            Render markdown to React elements. We enable remark-gfm for GitHub Flavored Markdown.
            IMPORTANT: We DO NOT enable `rehype-raw` (do not parse raw HTML inside markdown)
            to avoid the risk of executing or injecting unsafe HTML. Any HTML-like text will
            be rendered as literal text. We still include `rehype-sanitize` for defense-in-depth
            if other rehype plugins are used, and to ensure nodes are safe should you enable
            additional rehype processing later.
          */}
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeSanitize, schema]]}
          components={{
            h1: ({ children }) => (
              <h1 className={`text-4xl font-bold mb-4 ${useTheme().theme === "dark" ? "text-gray-100" : "text-black"}`}>
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className={`text-3xl font-bold mb-3 ${useTheme().theme === "dark" ? "text-gray-100" : "text-black"}`}>
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className={`text-2xl font-bold mb-2 ${useTheme().theme === "dark" ? "text-gray-100" : "text-black"}`}>
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4 className={`text-xl font-bold mb-2 ${useTheme().theme === "dark" ? "text-gray-100" : "text-black"}`}>
                {children}
              </h4>
            ),
            h5: ({ children }) => (
              <h5 className={`text-lg font-bold mb-1 ${useTheme().theme === "dark" ? "text-gray-100" : "text-black"}`}>
                {children}
              </h5>
            ),
            h6: ({ children }) => (
              <h6 className={`text-base font-bold mb-1 ${useTheme().theme === "dark" ? "text-gray-100" : "text-black"}`}>
                {children}
              </h6>
            ),
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
