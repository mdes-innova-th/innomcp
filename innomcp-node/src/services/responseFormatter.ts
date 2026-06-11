```ts
import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';

/**
 * Options for formatting raw AI responses.
 */
export interface FormatOptions {
  /** Whether to render Markdown to HTML */
  renderMarkdown?: boolean;
  /** Whether to apply syntax highlighting hints to code blocks */
  highlightCode?: boolean;
  /** Whether to sanitize HTML in the raw text */
  sanitizeHtml?: boolean;
  /** Maximum character length after truncation (applied before rendering) */
  maxLength?: number;
  /** Locale for reading time estimation and word‑aware truncation */
  locale?: 'th' | 'en';
}

/**
 * Result of formatting a raw string.
 */
export interface FormattedResponse {
  /** Plain text representation (may be truncated or sanitised) */
  text: string;
  /** HTML representation if Markdown rendering is enabled */
  html?: string;
  /** Extracted code blocks with language detection */
  codeBlocks: CodeBlock[];
  /** Parsed table cells (each row is an array of cell strings) */
  tables: string[][];
  /** True if the original text contained any Markdown syntax */
  hasMarkdown: boolean;
  /** Estimated reading time in seconds (rounded up) */
  estimatedReadTimeSeconds: number;
}

/**
 * A single fenced code block found in the text.
 */
export interface CodeBlock {
  /** Detected or specified language (e.g. 'ts', 'js', 'py') */
  language: string;
  /** Raw code content inside the fence */
  code: string;
  /** Number of lines in the block */
  lineCount: number;
}

/**
 * Singleton service that formats AI response strings for front‑end display.
 * Handles Markdown rendering, table extraction, Thai reading time,
 * code detection, HTML sanitisation, and streaming chunk processing.
 */
export default class ResponseFormatter {
  private static instance: ResponseFormatter;
  private md: MarkdownIt;

  // Streaming state
  private streamBuffer: string[] = [];
  private streamInFence: boolean = false;
  private streamFenceLang: string = '';
  private streamFenceLines: string[] = [];

  private constructor() {
    this.md = new MarkdownIt({
      html: false,        //