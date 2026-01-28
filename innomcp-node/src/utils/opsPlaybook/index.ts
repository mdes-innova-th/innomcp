/**
 * Ops Playbook Module
 * à¹€à¸­à¸à¸ªà¸²à¸£à¸§à¸´à¸˜à¸µà¹à¸à¹‰à¹€à¸¡à¸·à¹ˆà¸­à¹à¸«à¸¥à¹ˆà¸‡à¸«à¸¥à¸±à¸à¸¥à¹ˆà¸¡
 * 
 * Features:
 * - Incident response procedures
 * - Fallback strategies
 * - Quick fixes for common issues
 * - Troubleshooting guide
 * 
 * @module utils/opsPlaybook
 */

import { logBoth } from '../mcpLogger';

/**
 * Incident Type
 */
export type IncidentType = 
  | 'api_down'
  | 'slow_response'
  | 'high_error_rate'
  | 'quota_exceeded'
  | 'cache_failure'
  | 'database_issue'
  | 'network_error';

/**
 * Playbook Entry
 */
export interface PlaybookEntry {
  incident: IncidentType;
  title: string;
  symptoms: string[];
  diagnosis: string[];
  solutions: Array<{
    priority: 'immediate' | 'short-term' | 'long-term';
    action: string;
    steps: string[];
    impact: string;
    rollback?: string;
  }>;
  preventiveMeasures: string[];
}

/**
 * Ops Playbook Manager
 */
class OpsPlaybookManager {
  private playbook: Map<IncidentType, PlaybookEntry> = new Map();

  constructor() {
    this.initializePlaybook();
  }

  /**
   * Initialize default playbook
   */
  private initializePlaybook(): void {
    // API Down
    this.playbook.set('api_down', {
      incident: 'api_down',
      title: 'à¹à¸«à¸¥à¹ˆà¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸«à¸¥à¸±à¸à¸¥à¹ˆà¸¡ (API Down)',
      symptoms: [
        'API à¸•à¸­à¸šà¸à¸¥à¸±à¸š 500/502/503',
        'Connection timeout',
        'DNS resolution failed',
        'SSL certificate error'
      ],
      diagnosis: [
        'à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š health check endpoint',
        'à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š network connectivity',
        'à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š SSL certificate expiry',
        'à¸”à¸¹ error logs'
      ],
      solutions: [
        {
          priority: 'immediate',
          action: 'à¸ªà¸¥à¸±à¸šà¹„à¸›à¹ƒà¸Šà¹‰à¹à¸«à¸¥à¹ˆà¸‡à¸ªà¸³à¸£à¸­à¸‡',
          steps: [
            '1. à¹€à¸›à¸´à¸”à¹ƒà¸Šà¹‰ fallback source à¹ƒà¸™ config',
            '2. Update routing logic to use secondary source',
            '3. Monitor secondary source health',
            '4. Alert team about primary source failure'
          ],
          impact: 'à¸¥à¸”à¸„à¸¸à¸“à¸ à¸²à¸žà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹€à¸¥à¹‡à¸à¸™à¹‰à¸­à¸¢ à¹à¸•à¹ˆà¸£à¸°à¸šà¸šà¸—à¸³à¸‡à¸²à¸™à¸•à¹ˆà¸­à¹„à¸”à¹‰',
          rollback: 'Switch back to primary when health check passes'
        },
        {
          priority: 'short-term',
          action: 'à¸¥à¸” load à¸šà¸™ API',
          steps: [
            '1. à¹€à¸žà¸´à¹ˆà¸¡ cache TTL à¸Šà¸±à¹ˆà¸§à¸„à¸£à¸²à¸§ (5 à¸™à¸²à¸—à¸µ â†’ 15 à¸™à¸²à¸—à¸µ)',
            '2. à¸¥à¸” concurrent requests',
            '3. Enable request throttling',
            '4. Use cached data when available'
          ],
          impact: 'à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸­à¸²à¸ˆà¹€à¸à¹ˆà¸²à¸‚à¸¶à¹‰à¸™ à¹à¸•à¹ˆà¸¥à¸” load à¸šà¸™ API',
          rollback: 'Restore original cache TTL and rate limits'
        },
        {
          priority: 'long-term',
          action: 'à¸›à¸£à¸±à¸šà¸›à¸£à¸¸à¸‡à¸£à¸°à¸šà¸š resilience',
          steps: [
            '1. Implement circuit breaker pattern',
            '2. Add more fallback sources',
            '3. Improve cache strategy',
            '4. Setup monitoring and alerts'
          ],
          impact: 'à¸£à¸°à¸šà¸šà¸—à¸™à¸—à¸²à¸™à¸•à¹ˆà¸­ failure à¸¡à¸²à¸à¸‚à¸¶à¹‰à¸™',
          rollback: 'N/A - permanent improvement'
        }
      ],
      preventiveMeasures: [
        'à¸•à¸±à¹‰à¸‡ health check monitoring à¸—à¸¸à¸ 1 à¸™à¸²à¸—à¸µ',
        'à¸¡à¸µ fallback source à¸žà¸£à¹‰à¸­à¸¡à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¸•à¸¥à¸­à¸”',
        'à¸—à¸”à¸ªà¸­à¸š failover scenario à¹€à¸›à¹‡à¸™à¸›à¸£à¸°à¸ˆà¸³',
        'à¸¡à¸µ SLA agreement à¸à¸±à¸š API provider'
      ]
    });

    // Slow Response
    this.playbook.set('slow_response', {
      incident: 'slow_response',
      title: 'à¸£à¸°à¸šà¸šà¸•à¸­à¸šà¸Šà¹‰à¸² (Slow Response)',
      symptoms: [
        'Response time > 5 à¸§à¸´à¸™à¸²à¸—à¸µ',
        'User complaints about slow responses',
        'Timeout errors à¹€à¸žà¸´à¹ˆà¸¡à¸‚à¸¶à¹‰à¸™',
        'CPU usage à¸ªà¸¹à¸‡'
      ],
      diagnosis: [
        'à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š response time metrics',
        'à¸”à¸¹ slow query logs',
        'à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š cache hit rate',
        'Profile code performance'
      ],
      solutions: [
        {
          priority: 'immediate',
          action: 'à¹€à¸žà¸´à¹ˆà¸¡à¸›à¸£à¸°à¸ªà¸´à¸—à¸˜à¸´à¸ à¸²à¸ž cache',
          steps: [
            '1. à¹€à¸žà¸´à¹ˆà¸¡ cache TTL (2 à¸™à¸²à¸—à¸µ â†’ 5 à¸™à¸²à¸—à¸µ)',
            '2. Warm up cache with popular queries',
            '3. Enable aggressive caching',
            '4. Use stale-while-revalidate'
          ],
          impact: 'Response time à¸¥à¸”à¸¥à¸‡ 50-70%',
          rollback: 'Restore original cache TTL'
        },
        {
          priority: 'immediate',
          action: 'à¸¥à¸” complexity à¸‚à¸­à¸‡ query',
          steps: [
            '1. à¸¥à¸” top-k results (10 â†’ 5)',
            '2. Disable non-essential features',
            '3. Use faster algorithms',
            '4. Reduce parallel requests'
          ],
          impact: 'Response time à¹€à¸£à¹‡à¸§à¸‚à¸¶à¹‰à¸™ à¹à¸•à¹ˆà¸œà¸¥à¸¥à¸±à¸žà¸˜à¹Œà¸™à¹‰à¸­à¸¢à¸¥à¸‡',
          rollback: 'Restore original top-k and features'
        },
        {
          priority: 'short-term',
          action: 'Scale up resources',
          steps: [
            '1. à¹€à¸žà¸´à¹ˆà¸¡ server instances',
            '2. Increase memory allocation',
            '3. Add load balancer',
            '4. Use CDN for static assets'
          ],
          impact: 'à¸£à¸°à¸šà¸šà¸£à¸­à¸‡à¸£à¸±à¸š load à¹„à¸”à¹‰à¸¡à¸²à¸à¸‚à¸¶à¹‰à¸™',
          rollback: 'Scale down when load decreases'
        }
      ],
      preventiveMeasures: [
        'à¸•à¸±à¹‰à¸‡ performance monitoring à¹à¸¥à¸° alerts',
        'à¸—à¸³ load testing à¹€à¸›à¹‡à¸™à¸›à¸£à¸°à¸ˆà¸³',
        'Optimize database queries',
        'Use connection pooling'
      ]
    });

    // High Error Rate
    this.playbook.set('high_error_rate', {
      incident: 'high_error_rate',
      title: 'à¸­à¸±à¸•à¸£à¸² Error à¸ªà¸¹à¸‡ (High Error Rate)',
      symptoms: [
        'Error rate > 5%',
        'Many 4xx/5xx responses',
        'Exception logs à¹€à¸žà¸´à¹ˆà¸¡à¸‚à¸¶à¹‰à¸™',
        'User complaints'
      ],
      diagnosis: [
        'à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š error logs by type',
        'à¸”à¸¹ error distribution',
        'Check for pattern in errors',
        'Review recent deployments'
      ],
      solutions: [
        {
          priority: 'immediate',
          action: 'Rollback à¸–à¹‰à¸²à¹€à¸à¸´à¸”à¸ˆà¸²à¸ deployment',
          steps: [
            '1. à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸§à¹ˆà¸² error à¹€à¸žà¸´à¹ˆà¸¡à¸«à¸¥à¸±à¸‡ deploy à¹„à¸«à¸¡',
            '2. Rollback to previous version',
            '3. Monitor error rate after rollback',
            '4. Investigate root cause'
          ],
          impact: 'à¸£à¸°à¸šà¸šà¸à¸¥à¸±à¸šà¸¡à¸²à¸—à¸³à¸‡à¸²à¸™à¹„à¸”à¹‰à¸›à¸à¸•à¸´',
          rollback: 'Re-deploy after fixing issues'
        },
        {
          priority: 'immediate',
          action: 'à¹€à¸žà¸´à¹ˆà¸¡ error handling',
          steps: [
            '1. Add try-catch blocks',
            '2. Implement graceful degradation',
            '3. Use fallback responses',
            '4. Log errors for analysis'
          ],
          impact: 'à¸¥à¸” error rate, à¹à¸•à¹ˆà¸­à¸²à¸ˆà¸¡à¸µ degraded functionality',
          rollback: 'Remove extra error handling when root cause fixed'
        },
        {
          priority: 'short-term',
          action: 'à¹à¸à¹‰à¹„à¸‚ root cause',
          steps: [
            '1. à¸§à¸´à¹€à¸„à¸£à¸²à¸°à¸«à¹Œ error patterns',
            '2. Fix bugs in code',
            '3. Add unit tests',
            '4. Deploy fix with testing'
          ],
          impact: 'à¹à¸à¹‰à¸›à¸±à¸à¸«à¸²à¸–à¸²à¸§à¸£',
          rollback: 'N/A - permanent fix'
        }
      ],
      preventiveMeasures: [
        'Setup error tracking à¹à¸¥à¸° monitoring',
        'à¸—à¸³ comprehensive testing à¸à¹ˆà¸­à¸™ deploy',
        'Use canary deployments',
        'à¸¡à¸µ automated rollback'
      ]
    });

    // Quota Exceeded
    this.playbook.set('quota_exceeded', {
      incident: 'quota_exceeded',
      title: 'à¹‚à¸„à¸§à¸•à¹‰à¸² API à¸«à¸¡à¸” (Quota Exceeded)',
      symptoms: [
        'API returns 429 (Too Many Requests)',
        'Quota exceeded errors',
        'Service degradation',
        'Rate limit errors'
      ],
      diagnosis: [
        'à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š API quota usage',
        'à¸”à¸¹ request patterns',
        'Check for unusual traffic',
        'Review rate limiting config'
      ],
      solutions: [
        {
          priority: 'immediate',
          action: 'à¹ƒà¸Šà¹‰ cached data',
          steps: [
            '1. Serve from cache whenever possible',
            '2. Increase cache TTL dramatically',
            '3. Disable cache invalidation temporarily',
            '4. Use stale cache if needed'
          ],
          impact: 'à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸­à¸²à¸ˆà¹€à¸à¹ˆà¸² à¹à¸•à¹ˆà¸£à¸°à¸šà¸šà¸—à¸³à¸‡à¸²à¸™à¸•à¹ˆà¸­à¹„à¸”à¹‰',
          rollback: 'Restore normal cache behavior when quota resets'
        },
        {
          priority: 'immediate',
          action: 'à¸ªà¸¥à¸±à¸šà¹„à¸› free API',
          steps: [
            '1. Switch to free alternative APIs',
            '2. Use lower-tier API keys',
            '3. Implement API key rotation',
            '4. Rate limit user requests'
          ],
          impact: 'à¸„à¸¸à¸“à¸ à¸²à¸žà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸­à¸²à¸ˆà¸¥à¸”à¸¥à¸‡',
          rollback: 'Switch back to premium API when quota available'
        },
        {
          priority: 'short-term',
          action: 'à¹€à¸žà¸´à¹ˆà¸¡ quota à¸«à¸£à¸·à¸­à¸‹à¸·à¹‰à¸­à¹€à¸žà¸´à¹ˆà¸¡',
          steps: [
            '1. Contact API provider',
            '2. Upgrade to higher tier',
            '3. Purchase additional quota',
            '4. Request temporary increase'
          ],
          impact: 'à¸„à¹ˆà¸²à¹ƒà¸Šà¹‰à¸ˆà¹ˆà¸²à¸¢à¹€à¸žà¸´à¹ˆà¸¡à¸‚à¸¶à¹‰à¸™',
          rollback: 'Downgrade when traffic decreases'
        }
      ],
      preventiveMeasures: [
        'Monitor quota usage daily',
        'Setup alerts at 70%, 90% usage',
        'Implement aggressive caching',
        'Use multiple API providers'
      ]
    });

    // Cache Failure
    this.playbook.set('cache_failure', {
      incident: 'cache_failure',
      title: 'Cache à¸¥à¹‰à¸¡à¹€à¸«à¸¥à¸§ (Cache Failure)',
      symptoms: [
        'Cache hit rate à¸¥à¸”à¸¥à¸‡à¸­à¸¢à¹ˆà¸²à¸‡à¸£à¸§à¸”à¹€à¸£à¹‡à¸§',
        'Response time à¹€à¸žà¸´à¹ˆà¸¡à¸‚à¸¶à¹‰à¸™',
        'Direct API calls à¹€à¸žà¸´à¹ˆà¸¡à¸‚à¸¶à¹‰à¸™',
        'Memory usage à¸œà¸´à¸”à¸›à¸à¸•à¸´'
      ],
      diagnosis: [
        'à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š cache service health',
        'à¸”à¸¹ cache hit/miss metrics',
        'Check memory usage',
        'Review cache configuration'
      ],
      solutions: [
        {
          priority: 'immediate',
          action: 'Restart cache service',
          steps: [
            '1. Backup cache data if possible',
            '2. Restart cache service',
            '3. Warm up cache with popular data',
            '4. Monitor cache health'
          ],
          impact: 'Cache hit rate à¸à¸¥à¸±à¸šà¸¡à¸²à¸›à¸à¸•à¸´',
          rollback: 'N/A - service restart'
        },
        {
          priority: 'immediate',
          action: 'Use in-memory fallback',
          steps: [
            '1. Enable in-memory cache',
            '2. Use Map-based cache',
            '3. Limit cache size',
            '4. Implement LRU eviction'
          ],
          impact: 'Performance à¸¥à¸”à¸¥à¸‡à¹€à¸¥à¹‡à¸à¸™à¹‰à¸­à¸¢',
          rollback: 'Switch back to Redis when available'
        },
        {
          priority: 'short-term',
          action: 'à¹à¸à¹‰à¹„à¸‚ cache configuration',
          steps: [
            '1. Review cache TTL settings',
            '2. Adjust memory limits',
            '3. Configure eviction policy',
            '4. Test cache behavior'
          ],
          impact: 'Cache à¸—à¸³à¸‡à¸²à¸™à¸¡à¸µà¸›à¸£à¸°à¸ªà¸´à¸—à¸˜à¸´à¸ à¸²à¸žà¸¡à¸²à¸à¸‚à¸¶à¹‰à¸™',
          rollback: 'Restore previous config if issues'
        }
      ],
      preventiveMeasures: [
        'Monitor cache health continuously',
        'Setup cache backup strategy',
        'Test cache failover regularly',
        'Use distributed cache'
      ]
    });

    logBoth('info', '[OpsPlaybook] Initialized playbook with 5 incident types');
  }

  /**
   * Get playbook entry
   */
  getPlaybook(incident: IncidentType): PlaybookEntry | undefined {
    return this.playbook.get(incident);
  }

  /**
   * Get all incident types
   */
  getIncidentTypes(): IncidentType[] {
    return Array.from(this.playbook.keys());
  }

  /**
   * Search playbook by symptom
   */
  searchBySymptom(symptom: string): PlaybookEntry[] {
    const results: PlaybookEntry[] = [];
    const searchTerm = symptom.toLowerCase();

    for (const entry of this.playbook.values()) {
      const hasSymptom = entry.symptoms.some(s => 
        s.toLowerCase().includes(searchTerm)
      );
      if (hasSymptom) {
        results.push(entry);
      }
    }

    return results;
  }

  /**
   * Format playbook entry
   */
  formatPlaybook(incident: IncidentType): string {
    const entry = this.playbook.get(incident);
    if (!entry) return 'Incident type not found';

    let output = `
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ðŸš¨ ${entry.title}
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

ðŸ“Š SYMPTOMS (à¸­à¸²à¸à¸²à¸£):
${entry.symptoms.map(s => `  â€¢ ${s}`).join('\n')}

ðŸ” DIAGNOSIS (à¸à¸²à¸£à¸§à¸´à¸™à¸´à¸ˆà¸‰à¸±à¸¢):
${entry.diagnosis.map(d => `  â€¢ ${d}`).join('\n')}

ðŸ’Š SOLUTIONS (à¸§à¸´à¸˜à¸µà¹à¸à¹‰):
`;

    for (const solution of entry.solutions) {
      const priorityIcon = 
        solution.priority === 'immediate' ? 'ðŸ”´' :
        solution.priority === 'short-term' ? 'ðŸŸ¡' : 'ðŸŸ¢';
      
      output += `\n${priorityIcon} ${solution.action.toUpperCase()}\n`;
      output += `   Steps:\n`;
      output += solution.steps.map(s => `   ${s}`).join('\n') + '\n';
      output += `   Impact: ${solution.impact}\n`;
      if (solution.rollback) {
        output += `   Rollback: ${solution.rollback}\n`;
      }
    }

    output += `\nðŸ›¡ï¸ PREVENTIVE MEASURES (à¸à¸²à¸£à¸›à¹‰à¸­à¸‡à¸à¸±à¸™):\n`;
    output += entry.preventiveMeasures.map(m => `  â€¢ ${m}`).join('\n');
    output += '\nâ”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”';

    return output;
  }

  /**
   * Get quick reference guide
   */
  getQuickReference(): string {
    let output = `
Ops Playbook Quick Reference
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

Available Incident Types:
`;

    for (const [type, entry] of this.playbook) {
      output += `\n${type}: ${entry.title}\n`;
      output += `  Immediate action: ${entry.solutions[0]?.action || 'See playbook'}\n`;
    }

    output += '\nâ”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”';
    return output;
  }
}

// Export singleton instance
export const opsPlaybook = new OpsPlaybookManager();

/**
 * Helper: Get playbook
 */
export function getPlaybook(incident: IncidentType): PlaybookEntry | undefined {
  return opsPlaybook.getPlaybook(incident);
}

/**
 * Helper: Format playbook
 */
export function formatPlaybook(incident: IncidentType): string {
  return opsPlaybook.formatPlaybook(incident);
}

/**
 * Helper: Search by symptom
 */
export function searchPlaybookBySymptom(symptom: string): PlaybookEntry[] {
  return opsPlaybook.searchBySymptom(symptom);
}

/**
 * Helper: Get quick reference
 */
export function getQuickReference(): string {
  return opsPlaybook.getQuickReference();
}
