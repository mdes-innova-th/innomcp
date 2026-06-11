/**
 * InnoMCP Node - AI Response Formatter
 * 
 * Formats raw AI text for frontend consumption, supporting Thai language
 * optimization and safe HTML stripping.
 */

interface FormattedResponse {
  text: string;              // cleaned plain text (markdown stripped)
  markdown: string;          // original markdown (after sanitization)
  hasCode: boolean;
  hasTable: boolean;
  hasImages: boolean;
  codeLanguages: string[];
  wordCount: number;
  estimatedReadTime: number; // seconds
  isThai: boolean;
  quality: 'high' | 'medium' | 'low';
}

class ResponseFormatter {
  /**
   * Main formatting pipeline: sanitizes HTML, extracts features,
   * counts words (Thai-aware), estimates readability and quality.
   */
  format(rawText: string): FormattedResponse {
    const sanitized = this.sanitize(rawText);
    const markdown = sanitized;
    const plainText = this.stripMarkdown(sanitized);
    const codeBlocks = this.extractCodeBlocks(sanitized);
    const hasCode = codeBlocks.length > 0;
    const codeLanguages = [...new Set(codeBlocks.map(b => b.language).filter(Boolean))];
    const hasTable = /^\|.*\|[\r\n]+[\s\S]*\|[-\s|:]+/m.test(sanitized);
    const hasImages = /!\[.*?\]\(.+?\)/g.test(sanitized) || /<img\b/gi.test(sanitized);
    const isThai = this.detectIsThai(plainText);
    const wordCount = isThai ? this.countWordsThai(plainText) : this.countWordsEnglish(plainText);
    const estimatedReadTime = Math.ceil((wordCount / 200) * 60); // 200 wpm

    let quality: FormattedResponse['quality'] = 'low';
    if (wordCount >= 100 || hasCode || hasTable) quality = 'high';
    else if (wordCount >= 30) quality = 'medium';

    return {
      text: plainText,
      markdown,
      hasCode,
      hasTable,
      hasImages,
      codeLanguages,
      wordCount,
      estimatedReadTime,
      isThai,
      quality,
    };
  }

  /**
   * Remove any dangerous HTML tags and leave safe text.
   * All tags are stripped to prevent XSS.
   */
  sanitize(text: string): string {
    // Remove all HTML tags (including script, iframe, img, etc.)
    return text.replace(/<[^>]*>/g, '');
  }

  /**
   * Extract code blocks demarcated by triple backticks.
   * Returns array of { language, code }.
   */
  extractCodeBlocks(text: string): Array<{ language: string; code: string }> {
    const regex = /