/**
 * Advanced Analytics Module
 * à¸§à¸´à¹€à¸„à¸£à¸²à¸°à¸«à¹Œà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸à¸²à¸£à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¹à¸šà¸šà¸¥à¸°à¹€à¸­à¸µà¸¢à¸”
 * 
 * Features:
 * - User behavior analytics
 * - Query pattern analysis
 * - Tool usage statistics
 * - Performance insights
 * 
 * @module utils/analytics
 */

import { logBoth } from '../mcpLogger';

/**
 * Analytics Event
 */
export interface AnalyticsEvent {
  timestamp: Date;
  eventType: 'query' | 'tool_usage' | 'error' | 'session_start' | 'session_end';
  userId?: string;
  sessionId: string;
  data: Record<string, any>;
}

/**
 * Query Pattern
 */
export interface QueryPattern {
  pattern: string;
  count: number;
  avgResponseTime: number;
  successRate: number;
  topTools: string[];
}

/**
 * Analytics Manager
 */
class AnalyticsManager {
  private events: AnalyticsEvent[] = [];
  private maxEvents = 10000;

  /**
   * Track event
   */
  trackEvent(event: Omit<AnalyticsEvent, 'timestamp'>): void {
    this.events.push({
      ...event,
      timestamp: new Date()
    });

    // Trim if needed
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }

  /**
   * Get query patterns
   */
  getQueryPatterns(limit: number = 10): QueryPattern[] {
    const queries = this.events.filter(e => e.eventType === 'query');
    const patterns = new Map<string, {
      count: number;
      responseTimes: number[];
      successes: number;
      tools: string[];
    }>();

    for (const query of queries) {
      const text = query.data.query?.toLowerCase() || '';
      const pattern = this.extractPattern(text);
      
      if (!patterns.has(pattern)) {
        patterns.set(pattern, {
          count: 0,
          responseTimes: [],
          successes: 0,
          tools: []
        });
      }

      const p = patterns.get(pattern)!;
      p.count++;
      if (query.data.responseTime) {
        p.responseTimes.push(query.data.responseTime);
      }
      if (query.data.success) {
        p.successes++;
      }
      if (query.data.tools) {
        p.tools.push(...query.data.tools);
      }
    }

    return Array.from(patterns.entries())
      .map(([pattern, data]) => ({
        pattern,
        count: data.count,
        avgResponseTime: data.responseTimes.length > 0
          ? data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length
          : 0,
        successRate: data.count > 0 ? (data.successes / data.count) * 100 : 0,
        topTools: this.getTopTools(data.tools, 3)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Extract query pattern
   */
  private extractPattern(query: string): string {
    // Weather patterns
    if (/à¸­à¸²à¸à¸²à¸¨|à¸à¸™|à¸£à¹‰à¸­à¸™|à¸«à¸™à¸²à¸§/.test(query)) {
      return 'à¸ªà¸ à¸²à¸žà¸­à¸²à¸à¸²à¸¨';
    }
    // Time patterns
    if (/à¹€à¸§à¸¥à¸²|à¹‚à¸¡à¸‡|à¸™à¸²à¸—à¸µ/.test(query)) {
      return 'à¸ªà¸­à¸šà¸–à¸²à¸¡à¹€à¸§à¸¥à¸²';
    }
    // Officeholder patterns
    if (/à¸™à¸²à¸¢à¸|à¸£à¸±à¸à¸¡à¸™à¸•à¸£à¸µ|à¸œà¸¹à¹‰à¸§à¹ˆà¸²/.test(query)) {
      return 'à¸œà¸¹à¹‰à¸”à¸³à¸£à¸‡à¸•à¸³à¹à¸«à¸™à¹ˆà¸‡';
    }
    // Location patterns
    if (/à¸—à¸µà¹ˆà¹„à¸«à¸™|à¸­à¸¢à¸¹à¹ˆà¸—à¸µà¹ˆ|à¸ªà¸–à¸²à¸™à¸—à¸µà¹ˆ/.test(query)) {
      return 'à¸ªà¸­à¸šà¸–à¸²à¸¡à¸ªà¸–à¸²à¸™à¸—à¸µà¹ˆ';
    }
    // Search patterns
    if (/à¸„à¹‰à¸™à¸«à¸²|à¸«à¸²|search/.test(query)) {
      return 'à¸„à¹‰à¸™à¸«à¸²à¸‚à¹‰à¸­à¸¡à¸¹à¸¥';
    }
    return 'à¸­à¸·à¹ˆà¸™à¹†';
  }

  /**
   * Get top tools
   */
  private getTopTools(tools: string[], limit: number): string[] {
    const counts = new Map<string, number>();
    for (const tool of tools) {
      counts.set(tool, (counts.get(tool) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tool]) => tool);
  }

  /**
   * Get user statistics
   */
  getUserStats(userId: string): {
    totalQueries: number;
    avgResponseTime: number;
    topPatterns: string[];
    activeSessions: number;
  } {
    const userEvents = this.events.filter(e => e.userId === userId);
    const queries = userEvents.filter(e => e.eventType === 'query');
    
    const responseTimes = queries
      .map(q => q.data.responseTime)
      .filter(t => typeof t === 'number');

    const patterns = this.getQueryPatterns(100)
      .slice(0, 5)
      .map(p => p.pattern);

    const sessions = new Set(userEvents.map(e => e.sessionId)).size;

    return {
      totalQueries: queries.length,
      avgResponseTime: responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0,
      topPatterns: patterns,
      activeSessions: sessions
    };
  }

  /**
   * Get hourly activity
   */
  getHourlyActivity(): Record<number, number> {
    const hourly: Record<number, number> = {};
    for (let i = 0; i < 24; i++) {
      hourly[i] = 0;
    }

    for (const event of this.events) {
      const hour = event.timestamp.getHours();
      hourly[hour]++;
    }

    return hourly;
  }

  /**
   * Get daily active users
   */
  getDailyActiveUsers(days: number = 7): Record<string, number> {
    const now = Date.now();
    const daily: Record<string, Set<string>> = {};

    for (let i = 0; i < days; i++) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      daily[dateStr] = new Set();
    }

    for (const event of this.events) {
      const dateStr = event.timestamp.toISOString().split('T')[0];
      if (daily[dateStr] && event.userId) {
        daily[dateStr].add(event.userId);
      }
    }

    return Object.fromEntries(
      Object.entries(daily).map(([date, users]) => [date, users.size])
    );
  }

  /**
   * Get error distribution
   */
  getErrorDistribution(): Record<string, number> {
    const errors = this.events.filter(e => e.eventType === 'error');
    const distribution: Record<string, number> = {};

    for (const error of errors) {
      const category = error.data.category || 'unknown';
      distribution[category] = (distribution[category] || 0) + 1;
    }

    return distribution;
  }

  /**
   * Get analytics summary
   */
  getSummary(): string {
    const queries = this.events.filter(e => e.eventType === 'query');
    const errors = this.events.filter(e => e.eventType === 'error');
    const patterns = this.getQueryPatterns(5);
    const hourly = this.getHourlyActivity();
    const peakHour = Object.entries(hourly).sort((a, b) => b[1] - a[1])[0];

    return `
Analytics Summary
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
Total Events: ${this.events.length}
Queries: ${queries.length}
Errors: ${errors.length}
Error Rate: ${((errors.length / this.events.length) * 100).toFixed(2)}%

Peak Hour: ${peakHour[0]}:00 (${peakHour[1]} events)

Top Query Patterns:
${patterns.map((p, i) => 
  `  ${i + 1}. ${p.pattern} (${p.count}x, ${p.avgResponseTime.toFixed(0)}ms avg)`
).join('\n')}
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
    `.trim();
  }
}

// Export singleton instance
export const analytics = new AnalyticsManager();

/**
 * Helper: Track query
 */
export function trackQuery(
  sessionId: string,
  query: string,
  responseTime: number,
  success: boolean,
  tools: string[],
  userId?: string
): void {
  analytics.trackEvent({
    eventType: 'query',
    sessionId,
    userId,
    data: { query, responseTime, success, tools }
  });
}

/**
 * Helper: Track error
 */
export function trackError(
  sessionId: string,
  category: string,
  error: any,
  userId?: string
): void {
  analytics.trackEvent({
    eventType: 'error',
    sessionId,
    userId,
    data: { category, error: error.message || String(error) }
  });
}

/**
 * Helper: Get analytics summary
 */
export function getAnalyticsSummary(): string {
  return analytics.getSummary();
}
