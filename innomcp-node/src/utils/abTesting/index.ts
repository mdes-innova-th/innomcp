/**
 * A/B Testing Module
 * à¸—à¸”à¸ªà¸­à¸šà¸£à¸¹à¸›à¹à¸šà¸šà¸„à¸³à¸•à¸­à¸šà¹à¸¥à¸°à¹à¸«à¸¥à¹ˆà¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸•à¹ˆà¸²à¸‡à¸à¸±à¸™
 * 
 * Features:
 * - Multiple variants testing
 * - Traffic splitting
 * - Metrics tracking
 * - Winner selection
 * 
 * @module utils/abTesting
 */

import { logBoth } from '../mcpLogger';

/**
 * Variant
 */
export interface Variant {
  id: string;
  name: string;
  description: string;
  config: Record<string, any>;
  weight: number; // 0-100, percentage of traffic
}

/**
 * Experiment
 */
export interface Experiment {
  id: string;
  name: string;
  description: string;
  variants: Variant[];
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  targetMetric: string; // e.g., 'response_time', 'user_satisfaction'
}

/**
 * Experiment Result
 */
export interface ExperimentResult {
  experimentId: string;
  variantId: string;
  sessionId: string;
  timestamp: Date;
  metrics: Record<string, number>;
  success: boolean;
}

/**
 * Variant Statistics
 */
export interface VariantStats {
  variantId: string;
  totalTests: number;
  successCount: number;
  successRate: number;
  avgMetrics: Record<string, number>;
  confidence: number; // 0-100
}

/**
 * A/B Test Manager
 */
class ABTestManager {
  private experiments: Map<string, Experiment> = new Map();
  private results: Map<string, ExperimentResult[]> = new Map();
  private assignments: Map<string, string> = new Map(); // sessionId -> variantId

  /**
   * Create experiment
   */
  createExperiment(experiment: Omit<Experiment, 'startDate' | 'isActive'>): Experiment {
    const fullExperiment: Experiment = {
      ...experiment,
      startDate: new Date(),
      isActive: true
    };

    // Validate weights sum to 100
    const totalWeight = experiment.variants.reduce((sum, v) => sum + v.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error(`Variant weights must sum to 100, got ${totalWeight}`);
    }

    this.experiments.set(experiment.id, fullExperiment);
    this.results.set(experiment.id, []);

    logBoth('info', `[ABTest] Created experiment: ${experiment.name} (${experiment.variants.length} variants)`);

    return fullExperiment;
  }

  /**
   * Get variant for session
   */
  getVariant(experimentId: string, sessionId: string): Variant | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || !experiment.isActive) {
      return null;
    }

    // Check if session already assigned
    const assignmentKey = `${experimentId}:${sessionId}`;
    const existingVariant = this.assignments.get(assignmentKey);
    if (existingVariant) {
      return experiment.variants.find(v => v.id === existingVariant) || null;
    }

    // Assign new variant based on weights
    const variant = this.assignVariant(experiment.variants, sessionId);
    this.assignments.set(assignmentKey, variant.id);

    logBoth('info', `[ABTest] Assigned session ${sessionId} to variant ${variant.id}`);

    return variant;
  }

  /**
   * Assign variant based on weights
   */
  private assignVariant(variants: Variant[], sessionId: string): Variant {
    // Use session ID for deterministic assignment (same session gets same variant)
    const hash = this.hashString(sessionId);
    const random = (hash % 100) + 1; // 1-100

    let cumulative = 0;
    for (const variant of variants) {
      cumulative += variant.weight;
      if (random <= cumulative) {
        return variant;
      }
    }

    // Fallback to first variant
    return variants[0];
  }

  /**
   * Hash string to number
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Record result
   */
  recordResult(result: Omit<ExperimentResult, 'timestamp'>): void {
    const fullResult: ExperimentResult = {
      ...result,
      timestamp: new Date()
    };

    const results = this.results.get(result.experimentId);
    if (results) {
      results.push(fullResult);
    }

    logBoth('info', `[ABTest] Recorded result for experiment ${result.experimentId}, variant ${result.variantId}`);
  }

  /**
   * Get variant statistics
   */
  getVariantStats(experimentId: string, variantId: string): VariantStats | null {
    const results = this.results.get(experimentId);
    if (!results) return null;

    const variantResults = results.filter(r => r.variantId === variantId);
    if (variantResults.length === 0) return null;

    const successCount = variantResults.filter(r => r.success).length;
    const successRate = (successCount / variantResults.length) * 100;

    // Calculate average metrics
    const avgMetrics: Record<string, number> = {};
    const metricSums: Record<string, number> = {};
    const metricCounts: Record<string, number> = {};

    for (const result of variantResults) {
      for (const [key, value] of Object.entries(result.metrics)) {
        metricSums[key] = (metricSums[key] || 0) + value;
        metricCounts[key] = (metricCounts[key] || 0) + 1;
      }
    }

    for (const key in metricSums) {
      avgMetrics[key] = metricSums[key] / metricCounts[key];
    }

    // Calculate confidence (simple: based on sample size)
    const confidence = Math.min(100, (variantResults.length / 100) * 100);

    return {
      variantId,
      totalTests: variantResults.length,
      successCount,
      successRate,
      avgMetrics,
      confidence
    };
  }

  /**
   * Get experiment results
   */
  getExperimentResults(experimentId: string): Map<string, VariantStats> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return new Map();

    const stats = new Map<string, VariantStats>();

    for (const variant of experiment.variants) {
      const variantStats = this.getVariantStats(experimentId, variant.id);
      if (variantStats) {
        stats.set(variant.id, variantStats);
      }
    }

    return stats;
  }

  /**
   * Get winning variant
   */
  getWinner(experimentId: string, metric: string = 'successRate'): {
    variant: Variant;
    stats: VariantStats;
  } | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return null;

    const allStats = this.getExperimentResults(experimentId);
    if (allStats.size === 0) return null;

    let bestVariant: Variant | null = null;
    let bestStats: VariantStats | null = null;
    let bestValue = -Infinity;

    for (const variant of experiment.variants) {
      const stats = allStats.get(variant.id);
      if (!stats) continue;

      // Only consider variants with enough confidence
      if (stats.confidence < 70) continue;

      let value: number;
      if (metric === 'successRate') {
        value = stats.successRate;
      } else if (stats.avgMetrics[metric] !== undefined) {
        value = stats.avgMetrics[metric];
      } else {
        continue;
      }

      if (value > bestValue) {
        bestValue = value;
        bestVariant = variant;
        bestStats = stats;
      }
    }

    if (!bestVariant || !bestStats) return null;

    return { variant: bestVariant, stats: bestStats };
  }

  /**
   * Stop experiment
   */
  stopExperiment(experimentId: string): void {
    const experiment = this.experiments.get(experimentId);
    if (experiment) {
      experiment.isActive = false;
      experiment.endDate = new Date();
      logBoth('info', `[ABTest] Stopped experiment: ${experiment.name}`);
    }
  }

  /**
   * Get experiment summary
   */
  getSummary(experimentId: string): string {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return 'Experiment not found';

    const allStats = this.getExperimentResults(experimentId);
    const winner = this.getWinner(experimentId);

    let summary = `
A/B Test Summary: ${experiment.name}
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
Status: ${experiment.isActive ? 'Active' : 'Stopped'}
Started: ${experiment.startDate.toLocaleString()}
${experiment.endDate ? `Ended: ${experiment.endDate.toLocaleString()}` : ''}

Variants:
`;

    for (const variant of experiment.variants) {
      const stats = allStats.get(variant.id);
      summary += `\n  ${variant.name} (${variant.weight}% traffic)\n`;
      
      if (stats) {
        summary += `    Tests: ${stats.totalTests}\n`;
        summary += `    Success Rate: ${stats.successRate.toFixed(1)}%\n`;
        summary += `    Confidence: ${stats.confidence.toFixed(0)}%\n`;
        
        for (const [metric, value] of Object.entries(stats.avgMetrics)) {
          summary += `    Avg ${metric}: ${value.toFixed(2)}\n`;
        }
      } else {
        summary += `    No data yet\n`;
      }
    }

    if (winner) {
      summary += `\nWinner: ${winner.variant.name} ðŸ†\n`;
      summary += `  Success Rate: ${winner.stats.successRate.toFixed(1)}%\n`;
    }

    summary += 'â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”';
    return summary.trim();
  }

  /**
   * Initialize default experiments
   */
  initializeDefaultExperiments(): void {
    // Response style experiment
    this.createExperiment({
      id: 'response-style-1',
      name: 'Response Style Test',
      description: 'Test different response formats',
      variants: [
        {
          id: 'control',
          name: 'Control (Current)',
          description: 'Standard response format',
          config: { style: 'standard' },
          weight: 50
        },
        {
          id: 'concise',
          name: 'Concise',
          description: 'Shorter, more direct responses',
          config: { style: 'concise' },
          weight: 50
        }
      ],
      targetMetric: 'user_satisfaction'
    });

    // Data source experiment
    this.createExperiment({
      id: 'weather-source-1',
      name: 'Weather Data Source Test',
      description: 'Test different weather data sources',
      variants: [
        {
          id: 'open-meteo',
          name: 'Open-Meteo',
          description: 'Use Open-Meteo as primary',
          config: { primary: 'open-meteo', fallback: 'tmd' },
          weight: 50
        },
        {
          id: 'tmd',
          name: 'TMD',
          description: 'Use TMD as primary',
          config: { primary: 'tmd', fallback: 'open-meteo' },
          weight: 50
        }
      ],
      targetMetric: 'response_time'
    });

    logBoth('info', '[ABTest] Initialized default experiments');
  }
}

// Export singleton instance
export const abTest = new ABTestManager();

/**
 * Helper: Get variant
 */
export function getABTestVariant(experimentId: string, sessionId: string): Variant | null {
  return abTest.getVariant(experimentId, sessionId);
}

/**
 * Helper: Record result
 */
export function recordABTestResult(result: Omit<ExperimentResult, 'timestamp'>): void {
  abTest.recordResult(result);
}

/**
 * Helper: Get winner
 */
export function getABTestWinner(experimentId: string) {
  return abTest.getWinner(experimentId);
}

// Auto-initialize
abTest.initializeDefaultExperiments();
