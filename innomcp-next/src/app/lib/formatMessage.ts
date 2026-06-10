// formatMessage.ts — INNOMCP message formatting utilities

export type ContentBlock =
  | { type: 'text'; content: string }
  | { type: 'code'; language: string; code: string; filename?: string }
  | { type: 'table'; markdown: string }
  | { type: 'list'; items: string[]; ordered: boolean }
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'blockquote'; text: string }
  | { type: 'hr' }
  | { type: 'image'; src: string; alt?: string };

export function parseMessageToBlocks(text: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.match(/^```(\w*)/)) {
      const langMatch = line.match(/^```(\w*)/);
      const language = langMatch?.[1] || '';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'code', language, code: codeLines.join('\n') });
      i++;
      continue;
    }

    // Table
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableLines: string[] = [line];
      i++;
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'table', markdown: tableLines.join('\n') });
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length as 1|2|3, text: headingMatch[2] });
      i++;
      continue;
    }

    // HR
    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      blocks.push({ type: 'blockquote', text: line.slice(2) });
      i++;
      continue;
    }

    // Image
    const imgMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      blocks.push({ type: 'image', src: imgMatch[2], alt: imgMatch[1] });
      i++;
      continue;
    }

    // List
    if (line.match(/^[\s]*[-*+]\s/) || line.match(/^[\s]*\d+\.\s/)) {
      const ordered = Boolean(line.match(/^[\s]*\d+\./));
      const items: string[] = [];
      while (i < lines.length && (lines[i].match(/^[\s]*[-*+]\s/) || lines[i].match(/^[\s]*\d+\.\s/))) {
        items.push(lines[i].replace(/^[\s]*[-*+\d.]+\s/, ''));
        i++;
      }
      blocks.push({ type: 'list', items, ordered });
      continue;
    }

    // Default: text
    if (line.trim()) {
      blocks.push({ type: 'text', content: line });
    }
    i++;
  }

  return blocks;
}

export function extractCodeBlocks(text: string): Array<{ language: string; code: string }> {
  const results: Array<{ language: string; code: string }> = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    results.push({ language: match[1] || 'text', code: match[2].trim() });
  }
  return results;
}

export function extractMarkdownTables(text: string): string[] {
  const tables: string[] = [];
  const lines = text.split('\n');
  let tableLines: string[] = [];
  for (const line of lines) {
    if (line.includes('|') && line.trim().startsWith('|')) {
      tableLines.push(line);
    } else if (tableLines.length > 0) {
      tables.push(tableLines.join('\n'));
      tableLines = [];
    }
  }
  if (tableLines.length > 0) tables.push(tableLines.join('\n'));
  return tables;
}

export function detectContentType(text: string): 'simple' | 'rich' | 'code-heavy' | 'table-heavy' {
  const codeBlocks = (text.match(/```/g) || []).length;
  const tables = (text.match(/\|/g) || []).length;
  const headings = (text.match(/^#{1,3}\s/gm) || []).length;
  if (codeBlocks >= 4) return 'code-heavy';
  if (tables >= 20) return 'table-heavy';
  if (codeBlocks > 0 || headings > 0 || tables > 5) return 'rich';
  return 'simple';
}

export function sanitizeHTML(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/javascript:[^"']*/gi, '');
}

export function renderThaiText(text: string): string {
  return text;
}
