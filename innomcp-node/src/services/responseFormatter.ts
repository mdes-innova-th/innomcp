export interface FormatOptions {
  renderMarkdown?: boolean;
  highlightCode?: boolean;
  sanitizeHtml?: boolean;
  maxLength?: number;
  locale?: 'th' | 'en';
}

export interface FormattedResponse {
  text: string;
  html?: string;
  codeBlocks: CodeBlock[];
  tables: string[][];
  hasMarkdown: boolean;
  estimatedReadTimeSeconds: number;
}

export interface CodeBlock {
  language: string;
  code: string;
  lineCount: number;
}

export default class ResponseFormatter {
  private static instance: ResponseFormatter;
  private streamBuffer = '';

  private constructor() {}

  static getInstance(): ResponseFormatter {
    if (!ResponseFormatter.instance) {
      ResponseFormatter.instance = new ResponseFormatter();
    }
    return ResponseFormatter.instance;
  }

  format(raw: string, options: FormatOptions = {}): FormattedResponse {
    const locale = options.locale ?? 'en';
    const text =
      typeof options.maxLength === 'number'
        ? this.truncate(raw, options.maxLength)
        : raw;
    const codeBlocks = this.extractCodeBlocks(text);
    const tables = this.extractTables(text);
    const hasMarkdown = this.hasMarkdown(text);
    const result: FormattedResponse = {
      text,
      codeBlocks,
      tables,
      hasMarkdown,
      estimatedReadTimeSeconds: this.estimateReadingTime(text, locale),
    };

    if (options.renderMarkdown) {
      const html = this.renderMarkdown(text);
      result.html = options.sanitizeHtml === false ? html : this.sanitize(html);
    }

    return result;
  }

  formatStream(chunk: string): string {
    this.streamBuffer += chunk;
    if (this.streamBuffer.includes('```')) {
      const fenceCount = (this.streamBuffer.match(/```/g) ?? []).length;
      if (fenceCount % 2 !== 0) {
        return '';
      }
    }

    const output = this.streamBuffer;
    this.streamBuffer = '';
    return output;
  }

  detectLanguage(code: string): string {
    const trimmed = code.trim();
    if (/^(import|export|type|interface|const|let|async function)\b/m.test(trimmed)) {
      return 'ts';
    }
    if (/^(def|import\s+\w+|from\s+\w+\s+import)\b/m.test(trimmed)) {
      return 'py';
    }
    if (/^\s*[{[]/.test(trimmed)) {
      return 'json';
    }
    if (/^(SELECT|INSERT|UPDATE|DELETE)\b/im.test(trimmed)) {
      return 'sql';
    }
    if (/^#!|^(npm|node|curl|powershell|git)\b/im.test(trimmed)) {
      return 'bash';
    }
    return 'text';
  }

  sanitize(html: string): string {
    return html
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+="[^"]*"/gi, '')
      .replace(/\son\w+='[^']*'/gi, '')
      .replace(/\sjavascript:/gi, '');
  }

  truncate(text: string, maxLength: number, ellipsis = '...'): string {
    if (text.length <= maxLength) {
      return text;
    }

    const boundary = Math.max(0, maxLength - ellipsis.length);
    const sliced = text.slice(0, boundary);
    const lastSpace = sliced.lastIndexOf(' ');
    if (lastSpace > Math.floor(boundary * 0.6)) {
      return `${sliced.slice(0, lastSpace)}${ellipsis}`;
    }
    return `${sliced}${ellipsis}`;
  }

  extractCodeBlocks(text: string): CodeBlock[] {
    const blocks: CodeBlock[] = [];
    const fencePattern = /```(\w+)?\r?\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;

    while ((match = fencePattern.exec(text)) !== null) {
      const language = match[1] || this.detectLanguage(match[2] ?? '');
      const code = match[2] ?? '';
      blocks.push({
        language,
        code,
        lineCount: code.length === 0 ? 0 : code.split(/\r?\n/).length,
      });
    }

    return blocks;
  }

  private hasMarkdown(text: string): boolean {
    return /(^#{1,6}\s)|(\*\*[^*]+\*\*)|(```)|(^\s*[-*]\s)|(\|.+\|)/m.test(text);
  }

  private extractTables(text: string): string[][] {
    const rows: string[][] = [];
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.includes('|') || /^:?-{3,}:?(\s*\|\s*:?-{3,}:?)+$/.test(trimmed.replace(/^\||\|$/g, ''))) {
        continue;
      }

      const cells = trimmed
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((cell) => cell.trim());
      if (cells.length > 1) {
        rows.push(cells);
      }
    }
    return rows;
  }

  private estimateReadingTime(text: string, locale: 'th' | 'en'): number {
    const words =
      locale === 'th'
        ? Math.max(1, Math.ceil(text.replace(/\s+/g, '').length / 6))
        : Math.max(1, text.trim().split(/\s+/).filter(Boolean).length);
    const wordsPerMinute = locale === 'th' ? 150 : 200;
    return Math.ceil((words / wordsPerMinute) * 60);
  }

  private renderMarkdown(text: string): string {
    const escaped = this.escapeHtml(text);
    return escaped
      .replace(/```(\w+)?\r?\n([\s\S]*?)```/g, (_match, lang: string, code: string) => {
        const cls = lang ? ` class="language-${this.escapeHtml(lang)}"` : '';
        return `<pre><code${cls}>${code}</code></pre>`;
      })
      .replace(/^######\s(.+)$/gm, '<h6>$1</h6>')
      .replace(/^#####\s(.+)$/gm, '<h5>$1</h5>')
      .replace(/^####\s(.+)$/gm, '<h4>$1</h4>')
      .replace(/^###\s(.+)$/gm, '<h3>$1</h3>')
      .replace(/^##\s(.+)$/gm, '<h2>$1</h2>')
      .replace(/^#\s(.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
