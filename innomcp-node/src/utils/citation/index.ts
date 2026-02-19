/**
 * Citation Tagging Module
 * จัดการ metadata ของแหล่งอ้างอิง และความน่าเชื่อถือ
 * 
 * @author MDES Development Team
 * @created 2026-01-11
 */

import { SourceReference } from '../../types/responses';

/**
 * Domain reliability mapping
 * กำหนดความน่าเชื่อถือตาม domain
 */
const DOMAIN_RELIABILITY: Record<string, 'high' | 'medium' | 'low'> = {
  // Government & Official
  'thaigov.go.th': 'high',
  'data.go.th': 'high',
  'tmd.go.th': 'high', // กรมอุตุนิยมวิทยา
  
  // Weather APIs
  'open-meteo.com': 'high',
  'openweathermap.org': 'high',
  'meteoblue.com': 'high',
  'accuweather.com': 'medium',
  
  // Search & Reference
  'wikipedia.org': 'medium',
  'google.com': 'medium',
  
  // Default
  'default': 'low',
};

/**
 * สร้าง SourceReference พร้อม metadata
 */
export function createSourceReference(
  name: string,
  url: string,
  options?: {
    dataAge?: number;
    checksum?: string;
  }
): SourceReference {
  const now = new Date().toISOString();
  const domain = extractDomain(url);
  const reliability = DOMAIN_RELIABILITY[domain] || DOMAIN_RELIABILITY['default'];
  
  return {
    name,
    url,
    accessedAt: now,
    reliability,
    dataAge: options?.dataAge,
    checksum: options?.checksum,
  };
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

/**
 * Calculate data freshness (0-100)
 * 100 = very fresh, 0 = very stale
 */
export function calculateFreshness(accessedAt: string, dataAge?: number): number {
  const now = Date.now();
  const accessed = new Date(accessedAt).getTime();
  const totalAge = Math.floor((now - accessed) / 1000) + (dataAge || 0);
  
  // Weather data: fresh within 5 minutes
  if (totalAge < 300) return 100;
  if (totalAge < 600) return 80;
  if (totalAge < 1800) return 60;
  if (totalAge < 3600) return 40;
  return 20;
}

/**
 * Validate source references
 */
export function validateSources(sources: SourceReference[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (sources.length === 0) {
    errors.push('No sources provided');
  }
  
  sources.forEach((source, index) => {
    if (!source.name || source.name.trim() === '') {
      errors.push(`Source ${index}: name is required`);
    }
    if (!source.url || !isValidUrl(source.url)) {
      errors.push(`Source ${index}: invalid URL`);
    }
    if (!source.accessedAt) {
      errors.push(`Source ${index}: accessedAt is required`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if URL is valid
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Format sources for display
 */
export function formatSourcesForDisplay(sources: SourceReference[]): string {
  if (sources.length === 0) {
    return '';
  }
  
  let display = '\n\n**แหล่งข้อมูล:**\n';
  
  sources.forEach((source, index) => {
    const freshness = calculateFreshness(source.accessedAt, source.dataAge);
    const reliabilityEmoji = {
      high: '🟢',
      medium: '🟡',
      low: '🔴',
    }[source.reliability];
    
    display += `${index + 1}. ${reliabilityEmoji} ${source.name}`;
    
    if (freshness >= 80) {
      display += ' (ข้อมูลใหม่)';
    } else if (freshness < 40) {
      display += ' (อาจเก่า)';
    }
    
    display += `\n   🔗 ${source.url}\n`;
  });
  
  return display;
}

/**
 * Merge sources from multiple responses
 */
export function mergeSources(
  sources1: SourceReference[],
  sources2: SourceReference[]
): SourceReference[] {
  const merged = [...sources1];
  
  sources2.forEach((source) => {
    const exists = merged.find((s) => s.url === source.url);
    if (!exists) {
      merged.push(source);
    }
  });
  
  // Sort by reliability then freshness
  return merged.sort((a, b) => {
    const reliabilityScore = { high: 3, medium: 2, low: 1 };
    const scoreA = reliabilityScore[a.reliability];
    const scoreB = reliabilityScore[b.reliability];
    
    if (scoreA !== scoreB) {
      return scoreB - scoreA; // high first
    }
    
    const freshnessA = calculateFreshness(a.accessedAt, a.dataAge);
    const freshnessB = calculateFreshness(b.accessedAt, b.dataAge);
    return freshnessB - freshnessA; // fresher first
  });
}
