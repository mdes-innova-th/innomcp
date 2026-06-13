<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from improve)
 member: FX-009 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":2851,"completion_tokens":8000,"total_tokens":10851,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":6657,"image_tokens":0},"cache_creation_input_tokens":0} | 80s
 generated: 2026-06-13T11:34:39.035Z -->
FILE: innomcp-node/src/services/responseFormatter.ts
<<<<<<< SEARCH
export interface FormatOptions {
=======
import DOMPurify from 'dompurify';

export interface FormatOptions {
>>>>>>> REPLACE

FILE: innomcp-node/src/services/responseFormatter.ts
<<<<<<< SEARCH
  sanitize(html: string): string {
    return html
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+="[^"]*"/gi, '')
      .replace(/\son\w+='[^']*'/gi, '')
      .replace(/\sjavascript:/gi, '');
  }
=======
  sanitize(html: string): string {
    return DOMPurify.sanitize(html);
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/responseFormatter.ts
<<<<<<< SEARCH
  private static instance: ResponseFormatter;
  private streamBuffer = '';

  private constructor() {}
=======
  private static instance: ResponseFormatter;

  private constructor() {}
>>>>>>> REPLACE

FILE: innomcp-node/src/services/responseFormatter.ts
<<<<<<< SEARCH
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
=======
  formatStream(chunk: string, state: { buffer: string }): string {
    state.buffer += chunk;
    if (state.buffer.includes('```')) {
      const fenceCount = (state.buffer.match(/```/g) ?? []).length;
      if (fenceCount % 2 !== 0) {
        return '';
      }
    }

    const output = state.buffer;
    state.buffer = '';
    return output;
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/responseFormatter.ts
<<<<<<< SEARCH
  detectLanguage(code: string): string {
=======
  endStream(state: { buffer: string }): string {
    const remaining = state.buffer;
    state.buffer = '';
    return remaining;
  }

  detectLanguage(code: string): string {
>>>>>>> REPLACE

FILE: innomcp-node/src/services/responseFormatter.ts
<<<<<<< SEARCH
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
=======
  private renderMarkdown(text: string): string {
    const escaped = this.escapeHtml(text);
    const codeBlocks: string[] = [];
    let index = 0;
    const withPlaceholders = escaped.replace(/```(\w+)?\r?\n([\s\S]*?)```/g, (_match, lang: string, code: string) => {
      const cls = lang ? ` class="language-${this.escapeHtml(lang)}"` : '';
      const placeholder = `%%CODEBLOCK_${index}%%`;
      codeBlocks[index] = `<pre><code${cls}>${code}</code></pre>`;
      index++;
      return placeholder;
    });
    const formatted = withPlaceholders
      .replace(/^######\s(.+)$/gm, '<h6>$1</h6>')
      .replace(/^#####\s(.+)$/gm, '<h5>$1</h5>')
      .replace(/^####\s(.+)$/gm, '<h4>$1</h4>')
      .replace(/^###\s(.+)$/gm, '<h3>$1</h3>')
      .replace(/^##\s(.+)$/gm, '<h2>$1</h2>')
      .replace(/^#\s(.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
    return formatted.replace(/%%CODEBLOCK_(\d+)%%/g, (_match, id) => codeBlocks[parseInt(id, 10)]);
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/responseFormatter.ts
<<<<<<< SEARCH
  truncate(text: string, maxLength: number, ellipsis = '...'): string {
    if (text.length <= maxLength) {
      return text;
    }

    const boundary = Math.max(0, maxLength -
