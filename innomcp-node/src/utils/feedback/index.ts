/**
 * Feedback System
 * à¸£à¸±à¸š feedback à¸ˆà¸²à¸à¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¹€à¸žà¸·à¹ˆà¸­à¸›à¸£à¸±à¸šà¸›à¸£à¸¸à¸‡à¸£à¸°à¸šà¸š
 * 
 * Features:
 * - User feedback collection
 * - Rating system (1-5 stars)
 * - Comment collection
 * - Feedback analytics
 * 
 * @module utils/feedback
 */

import { logBoth } from '../mcpLogger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Feedback Entry
 */
export interface FeedbackEntry {
  id: string;
  timestamp: Date;
  sessionId: string;
  userId?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  category: 'accuracy' | 'speed' | 'helpfulness' | 'ui' | 'other';
  comment?: string;
  queryContext?: string;
  responseContext?: string;
  metadata?: Record<string, any>;
}

/**
 * Feedback Statistics
 */
export interface FeedbackStats {
  totalFeedback: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  categoryBreakdown: Record<string, { count: number; avgRating: number }>;
  recentFeedback: FeedbackEntry[];
}

/**
 * Feedback Manager
 */
class FeedbackManager {
  private feedbacks: FeedbackEntry[] = [];
  private feedbackDir = path.join(process.cwd(), 'logs', 'feedback');
  private maxInMemory = 1000;
  private autoFlushThreshold = 100;

  constructor() {
    this.ensureFeedbackDir();
    this.loadRecentFeedback();
  }

  /**
   * Ensure feedback directory exists
   */
  private ensureFeedbackDir(): void {
    if (!fs.existsSync(this.feedbackDir)) {
      fs.mkdirSync(this.feedbackDir, { recursive: true });
      logBoth('info', `[Feedback] Created directory: ${this.feedbackDir}`);
    }
  }

  /**
   * Load recent feedback from disk
   */
  private loadRecentFeedback(): void {
    try {
      const files = fs.readdirSync(this.feedbackDir)
        .filter(f => f.endsWith('.jsonl'))
        .sort()
        .reverse();

      if (files.length === 0) return;

      // Load latest file
      const latestFile = path.join(this.feedbackDir, files[0]);
      const content = fs.readFileSync(latestFile, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l);

      this.feedbacks = lines.slice(-100).map(line => {
        const parsed = JSON.parse(line);
        return {
          ...parsed,
          timestamp: new Date(parsed.timestamp)
        };
      });

      logBoth('info', `[Feedback] Loaded ${this.feedbacks.length} recent feedback entries`);
    } catch (error) {
      logBoth('error', `[Feedback] Failed to load recent feedback: ${error}`);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add feedback
   */
  addFeedback(feedback: Omit<FeedbackEntry, 'id' | 'timestamp'>): string {
    const entry: FeedbackEntry = {
      ...feedback,
      id: this.generateId(),
      timestamp: new Date()
    };

    this.feedbacks.push(entry);

    // Trim if needed
    if (this.feedbacks.length > this.maxInMemory) {
      this.feedbacks.shift();
    }

    // Auto-flush if threshold reached
    if (this.feedbacks.length >= this.autoFlushThreshold) {
      this.flush();
    }

    logBoth('info', `[Feedback] Added: ${entry.rating} stars for ${entry.category}`);
    return entry.id;
  }

  /**
   * Get feedback by ID
   */
  getFeedback(id: string): FeedbackEntry | undefined {
    return this.feedbacks.find(f => f.id === id);
  }

  /**
   * Get recent feedback
   */
  getRecentFeedback(limit: number = 10): FeedbackEntry[] {
    return this.feedbacks.slice(-limit);
  }

  /**
   * Get feedback by rating
   */
  getFeedbackByRating(rating: 1 | 2 | 3 | 4 | 5, limit?: number): FeedbackEntry[] {
    const filtered = this.feedbacks.filter(f => f.rating === rating);
    return limit ? filtered.slice(-limit) : filtered;
  }

  /**
   * Get feedback by category
   */
  getFeedbackByCategory(category: string, limit?: number): FeedbackEntry[] {
    const filtered = this.feedbacks.filter(f => f.category === category);
    return limit ? filtered.slice(-limit) : filtered;
  }

  /**
   * Get feedback by session
   */
  getFeedbackBySession(sessionId: string): FeedbackEntry[] {
    return this.feedbacks.filter(f => f.sessionId === sessionId);
  }

  /**
   * Get statistics
   */
  getStatistics(): FeedbackStats {
    if (this.feedbacks.length === 0) {
      return {
        totalFeedback: 0,
        averageRating: 0,
        ratingDistribution: {},
        categoryBreakdown: {},
        recentFeedback: []
      };
    }

    // Rating distribution
    const ratingDistribution: Record<number, number> = {};
    for (let i = 1; i <= 5; i++) {
      ratingDistribution[i] = 0;
    }
    this.feedbacks.forEach(f => {
      ratingDistribution[f.rating]++;
    });

    // Average rating
    const totalRating = this.feedbacks.reduce((sum, f) => sum + f.rating, 0);
    const averageRating = totalRating / this.feedbacks.length;

    // Category breakdown
    const categoryBreakdown: Record<string, { count: number; avgRating: number }> = {};
    const categories = [...new Set(this.feedbacks.map(f => f.category))];
    
    for (const category of categories) {
      const categoryFeedback = this.feedbacks.filter(f => f.category === category);
      const categoryRating = categoryFeedback.reduce((sum, f) => sum + f.rating, 0);
      
      categoryBreakdown[category] = {
        count: categoryFeedback.length,
        avgRating: categoryRating / categoryFeedback.length
      };
    }

    return {
      totalFeedback: this.feedbacks.length,
      averageRating,
      ratingDistribution,
      categoryBreakdown,
      recentFeedback: this.getRecentFeedback(5)
    };
  }

  /**
   * Flush feedback to disk
   */
  flush(): void {
    if (this.feedbacks.length === 0) return;

    try {
      const date = new Date().toISOString().split('T')[0];
      const filename = `feedback_${date}.jsonl`;
      const filepath = path.join(this.feedbackDir, filename);

      const lines = this.feedbacks.map(f => JSON.stringify(f)).join('\n') + '\n';
      
      fs.appendFileSync(filepath, lines, 'utf-8');
      
      logBoth('info', `[Feedback] Flushed ${this.feedbacks.length} entries to ${filename}`);
    } catch (error) {
      logBoth('error', `[Feedback] Failed to flush: ${error}`);
    }
  }

  /**
   * Get feedback summary
   */
  getSummary(): string {
    const stats = this.getStatistics();
    
    if (stats.totalFeedback === 0) {
      return 'No feedback collected yet';
    }

    const stars = (rating: number) => 'â­'.repeat(rating);

    return `
Feedback Summary
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
Total Feedback: ${stats.totalFeedback}
Average Rating: ${stats.averageRating.toFixed(2)} ${stars(Math.round(stats.averageRating))}

Rating Distribution:
  5 â­â­â­â­â­: ${stats.ratingDistribution[5] || 0} (${((stats.ratingDistribution[5] || 0) / stats.totalFeedback * 100).toFixed(1)}%)
  4 â­â­â­â­:   ${stats.ratingDistribution[4] || 0} (${((stats.ratingDistribution[4] || 0) / stats.totalFeedback * 100).toFixed(1)}%)
  3 â­â­â­:     ${stats.ratingDistribution[3] || 0} (${((stats.ratingDistribution[3] || 0) / stats.totalFeedback * 100).toFixed(1)}%)
  2 â­â­:       ${stats.ratingDistribution[2] || 0} (${((stats.ratingDistribution[2] || 0) / stats.totalFeedback * 100).toFixed(1)}%)
  1 â­:         ${stats.ratingDistribution[1] || 0} (${((stats.ratingDistribution[1] || 0) / stats.totalFeedback * 100).toFixed(1)}%)

Category Breakdown:
${Object.entries(stats.categoryBreakdown).map(([cat, data]) => 
  `  ${cat}: ${data.count} (avg: ${data.avgRating.toFixed(2)})`
).join('\n')}
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
    `.trim();
  }

  /**
   * Get low-rated feedback for review
   */
  getLowRatedFeedback(threshold: number = 3, limit: number = 10): FeedbackEntry[] {
    return this.feedbacks
      .filter(f => f.rating <= threshold)
      .slice(-limit);
  }

  /**
   * Get feedback with comments
   */
  getFeedbackWithComments(limit: number = 10): FeedbackEntry[] {
    return this.feedbacks
      .filter(f => f.comment && f.comment.length > 0)
      .slice(-limit);
  }
}

// Export singleton instance
export const feedbackManager = new FeedbackManager();

/**
 * Helper: Add user feedback
 */
export function addUserFeedback(
  sessionId: string,
  rating: 1 | 2 | 3 | 4 | 5,
  category: 'accuracy' | 'speed' | 'helpfulness' | 'ui' | 'other',
  comment?: string,
  userId?: string
): string {
  return feedbackManager.addFeedback({
    sessionId,
    userId,
    rating,
    category,
    comment
  });
}

/**
 * Helper: Get feedback statistics
 */
export function getFeedbackStats(): FeedbackStats {
  return feedbackManager.getStatistics();
}

/**
 * Helper: Get feedback summary
 */
export function getFeedbackSummary(): string {
  return feedbackManager.getSummary();
}
