<!-- cc-team deliverable
 group: VQA (Visual QA + frontend completion tasks)
 member: VQA-19 role=dev model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":100,"completion_tokens":1180,"total_tokens":1280,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":141,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 34s
 generated: 2026-06-12T04:21:53.309Z -->
export function formatBytes(bytes: number): string {
  if (bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const unitIndex = Math.min(i, units.length - 1);
  const value = bytes / Math.pow(k, unitIndex);

  const formatted = value >= 100 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 0) return '0s';
  if (ms < 1000) return `${Math.round(ms)}ms`;

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}d`);
    parts.push(`${hours % 24}h`);
  } else if (hours > 0) {
    parts.push(`${hours}h`);
    parts.push(`${minutes % 60}m`);
  } else if (minutes > 0) {
    parts.push(`${minutes}m`);
    parts.push(`${seconds % 60}s`);
  } else {
    parts.push(`${seconds}s`);
  }

  return parts.join(' ');
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 0) {
    const absDiff = Math.abs(diffMs);
    if (absDiff < 1000) return 'just now';
    if (absDiff < 60 * 1000) return 'in a few seconds';
    if (absDiff < 2 * 60 * 1000) return 'in a minute';
    if (absDiff < 60 * 60 * 1000) return `in ${Math.floor(absDiff / (60 * 1000))} minutes`;
    if (absDiff < 2 * 60 * 60 * 1000) return 'in an hour';
    if (absDiff < 24 * 60 * 60 * 1000) return `in ${Math.floor(absDiff / (60 * 60 * 1000))} hours`;
    if (absDiff < 2 * 24 * 60 * 60 * 1000) return 'in a day';
    return `in ${Math.floor(absDiff / (24 * 60 * 60 * 1000))} days`;
  }

  if (diffMs < 1000) return 'just now';
  if (diffMs < 60 * 1000) return 'a few seconds ago';
  if (diffMs < 2 * 60 * 1000) return 'a minute ago';
  if (diffMs < 60 * 60 * 1000) {
    const minutes = Math.floor(diffMs / (60 * 1000));
    return `${minutes} minutes ago`;
  }
  if (diffMs < 2 * 60 * 60 * 1000) return 'an hour ago';
  if (diffMs < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    return `${hours} hours ago`;
  }
  if (diffMs < 2 * 24 * 60 * 60 * 1000) return 'yesterday';
  if (diffMs < 30 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    return `${days} days ago`;
  }
  if (diffMs < 365 * 24 * 60 * 60 * 1000) {
    const months = Math.floor(diffMs / (30 * 24 * 60 * 60 * 1000));
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
  const years = Math.floor(diffMs / (365 * 24 * 60 * 60 * 1000));
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

export function truncate(text: string, maxLength: number): string {
  if (maxLength < 0) return '';
  if (text.length <= maxLength) return text;
  if (maxLength <= 3) return text.slice(0, maxLength);

  return text.slice(0, maxLength - 3) + '...';
}
