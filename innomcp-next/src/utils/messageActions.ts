/**
 * Chat Message Actions Utilities
 * Copy, retry, edit, delete functionality
 */

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Format response time for display
 */
export function formatResponseTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

/**
 * Format token count for display
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1000000).toFixed(1)}M`;
}

/**
 * Get relative time string
 */
export function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 10) return 'เมื่อสักครู่';
  if (seconds < 60) return `${seconds} วินาทีที่แล้ว`;
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  if (days < 7) return `${days} วันที่แล้ว`;
  
  const date = new Date(timestamp);
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Share message text
 */
export async function shareMessage(text: string, title = 'INNOMCP Chat'): Promise<boolean> {
  try {
    if (navigator.share) {
      await navigator.share({
        title,
        text,
      });
      return true;
    }
    
    // Fallback to copy
    return await copyToClipboard(text);
  } catch (error) {
    console.error('Failed to share message:', error);
    return false;
  }
}

/**
 * Download message as file
 */
export function downloadMessage(text: string, filename = `message-${Date.now()}.txt`): void {
  try {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to download message:', error);
  }
}

/**
 * Sanitize message text for display
 */
export function sanitizeMessageText(text: string): string {
  // Remove any potential XSS vectors while preserving markdown
  return text
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

/**
 * Truncate long text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Word count (approximate for Thai/English)
 */
export function getWordCount(text: string): number {
  // Count Thai characters as individual words
  const thaiChars = (text.match(/[\u0E00-\u0E7F]/g) || []).length;
  // Count English words
  const englishWords = text.match(/[a-zA-Z]+/g) || [];
  return thaiChars + englishWords.length;
}

/**
 * Character count (excluding whitespace)
 */
export function getCharCount(text: string): number {
  return text.replace(/\s/g, '').length;
}

/**
 * Check if text contains code
 */
export function containsCode(text: string): boolean {
  return /```|`[^`]+`|\{|\}|\[|\]|function|const|let|var|=>/.test(text);
}

/**
 * Extract code blocks from markdown
 */
export function extractCodeBlocks(text: string): Array<{language: string, code: string}> {
  const blocks: Array<{language: string, code: string}> = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      code: match[2].trim(),
    });
  }
  
  return blocks;
}

/**
 * Highlight search term in text
 */
export function highlightSearchTerm(text: string, searchTerm: string): string {
  if (!searchTerm) return text;
  const regex = new RegExp(`(${searchTerm})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}
