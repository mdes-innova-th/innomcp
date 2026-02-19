/**
 * Cross-Source Consensus Module
 * à¸ˆà¸±à¸”à¸à¸²à¸£à¸„à¸§à¸²à¸¡à¸‚à¸±à¸”à¹à¸¢à¹‰à¸‡à¸£à¸°à¸«à¸§à¹ˆà¸²à¸‡à¹à¸«à¸¥à¹ˆà¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥
 * 
 * Features:
 * - Compare data from multiple sources
 * - Timestamp-based decision
 * - Confidence scoring
 * - Conflict resolution
 * 
 * @module utils/consensus
 */

import { logBoth } from '../mcpLogger';

/**
 * Source Data
 */
export interface SourceData<T> {
  source: string;
  data: T;
  timestamp: Date;
  reliability?: number; // 0-100
  metadata?: Record<string, any>;
}

/**
 * Consensus Result
 */
export interface ConsensusResult<T> {
  value: T;
  confidence: number; // 0-100
  sources: string[];
  conflicts: Array<{
    field: string;
    values: Array<{ source: string; value: any }>;
    resolution: string;
  }>;
  notes?: string[];
}

/**
 * Consensus Strategy
 */
export type ConsensusStrategy = 
  | 'newest'        // à¹€à¸¥à¸·à¸­à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹ƒà¸«à¸¡à¹ˆà¸ªà¸¸à¸”
  | 'most_reliable' // à¹€à¸¥à¸·à¸­à¸à¹à¸«à¸¥à¹ˆà¸‡à¸—à¸µà¹ˆà¹€à¸Šà¸·à¹ˆà¸­à¸–à¸·à¸­à¸—à¸µà¹ˆà¸ªà¸¸à¸”
  | 'majority'      // à¹€à¸¥à¸·à¸­à¸à¸„à¹ˆà¸²à¸—à¸µà¹ˆà¹€à¸ˆà¸­à¸šà¹ˆà¸­à¸¢à¸ªà¸¸à¸”
  | 'average';      // à¹€à¸‰à¸¥à¸µà¹ˆà¸¢ (à¸ªà¸³à¸«à¸£à¸±à¸šà¸•à¸±à¸§à¹€à¸¥à¸‚)

/**
 * Consensus Manager
 */
class ConsensusManager {
  /**
   * Build consensus from multiple sources
   */
  buildConsensus<T>(
    sources: SourceData<T>[],
    strategy: ConsensusStrategy = 'newest',
    options?: {
      fieldWeights?: Record<string, number>;
      minSources?: number;
      conflictThreshold?: number;
    }
  ): ConsensusResult<T> {
    if (sources.length === 0) {
      throw new Error('No sources provided for consensus');
    }

    if (sources.length === 1) {
      return {
        value: sources[0].data,
        confidence: 100,
        sources: [sources[0].source],
        conflicts: []
      };
    }

    logBoth('info', `[Consensus] Building consensus from ${sources.length} sources using ${strategy} strategy`);

    const conflicts: ConsensusResult<T>['conflicts'] = [];
    const notes: string[] = [];
    let selectedSource: SourceData<T>;
    let confidence = 100;

    // Apply strategy
    switch (strategy) {
      case 'newest':
        selectedSource = this.selectNewest(sources);
        notes.push(`Selected newest data from ${selectedSource.source}`);
        break;

      case 'most_reliable':
        selectedSource = this.selectMostReliable(sources);
        confidence = selectedSource.reliability || 80;
        notes.push(`Selected most reliable source: ${selectedSource.source} (${confidence}%)`);
        break;

      case 'majority':
        selectedSource = this.selectMajority(sources);
        notes.push(`Selected majority value from ${selectedSource.source}`);
        break;

      case 'average':
        selectedSource = this.selectAverage(sources);
        notes.push(`Averaged values from ${sources.length} sources`);
        break;

      default:
        selectedSource = sources[0];
    }

    // Detect conflicts
    const detectedConflicts = this.detectConflicts(sources, selectedSource);
    if (detectedConflicts.length > 0) {
      conflicts.push(...detectedConflicts);
      confidence = Math.max(50, confidence - (detectedConflicts.length * 10));
      notes.push(`${detectedConflicts.length} conflicts detected, confidence reduced`);
    }

    return {
      value: selectedSource.data,
      confidence,
      sources: sources.map(s => s.source),
      conflicts,
      notes
    };
  }

  /**
   * Select newest source (recent timestamp wins)
   */
  private selectNewest<T>(sources: SourceData<T>[]): SourceData<T> {
    return sources.reduce((newest, current) => 
      current.timestamp > newest.timestamp ? current : newest
    );
  }

  /**
   * Select most reliable source
   */
  private selectMostReliable<T>(sources: SourceData<T>[]): SourceData<T> {
    return sources.reduce((best, current) => {
      const currentReliability = current.reliability || 50;
      const bestReliability = best.reliability || 50;
      return currentReliability > bestReliability ? current : best;
    });
  }

  /**
   * Select majority value
   */
  private selectMajority<T>(sources: SourceData<T>[]): SourceData<T> {
    // Count occurrences of each value (simple string comparison)
    const valueCounts = new Map<string, { count: number; source: SourceData<T> }>();
    
    for (const source of sources) {
      const key = JSON.stringify(source.data);
      const existing = valueCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        valueCounts.set(key, { count: 1, source });
      }
    }

    // Find most common value
    let maxCount = 0;
    let majoritySource = sources[0];

    for (const { count, source } of valueCounts.values()) {
      if (count > maxCount) {
        maxCount = count;
        majoritySource = source;
      }
    }

    return majoritySource;
  }

  /**
   * Select average (for numeric data)
   */
  private selectAverage<T>(sources: SourceData<T>[]): SourceData<T> {
    // This is simplified - assumes data has numeric fields
    const averaged = { ...sources[0] };
    
    // Get all keys from first source
    const firstData = sources[0].data as any;
    if (typeof firstData === 'object' && firstData !== null) {
      for (const key in firstData) {
        const values = sources
          .map(s => (s.data as any)[key])
          .filter(v => typeof v === 'number');
        
        if (values.length > 0) {
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          (averaged.data as any)[key] = avg;
        }
      }
    }

    return averaged;
  }

  /**
   * Detect conflicts between sources
   */
  private detectConflicts<T>(
    sources: SourceData<T>[],
    selected: SourceData<T>
  ): ConsensusResult<T>['conflicts'] {
    const conflicts: ConsensusResult<T>['conflicts'] = [];

    // Compare each source with selected
    for (const source of sources) {
      if (source.source === selected.source) continue;

      const differences = this.findDifferences(
        selected.data,
        source.data,
        selected.source,
        source.source
      );

      conflicts.push(...differences);
    }

    return conflicts;
  }

  /**
   * Find differences between two data objects
   */
  private findDifferences<T>(
    data1: T,
    data2: T,
    source1: string,
    source2: string,
    prefix: string = ''
  ): ConsensusResult<T>['conflicts'] {
    const conflicts: ConsensusResult<T>['conflicts'] = [];

    if (typeof data1 !== 'object' || typeof data2 !== 'object') {
      if (data1 !== data2) {
        conflicts.push({
          field: prefix || 'value',
          values: [
            { source: source1, value: data1 },
            { source: source2, value: data2 }
          ],
          resolution: `Used ${source1} (newer timestamp)`
        });
      }
      return conflicts;
    }

    // Compare object fields
    const keys = new Set([
      ...Object.keys(data1 as any),
      ...Object.keys(data2 as any)
    ]);

    for (const key of keys) {
      const val1 = (data1 as any)[key];
      const val2 = (data2 as any)[key];

      if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        const fieldPath = prefix ? `${prefix}.${key}` : key;
        
        conflicts.push({
          field: fieldPath,
          values: [
            { source: source1, value: val1 },
            { source: source2, value: val2 }
          ],
          resolution: `Used ${source1} (newer timestamp)`
        });
      }
    }

    return conflicts;
  }

  /**
   * Validate consensus quality
   */
  validateConsensus<T>(result: ConsensusResult<T>): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check confidence threshold
    if (result.confidence < 70) {
      issues.push(`Low confidence: ${result.confidence}%`);
    }

    // Check number of sources
    if (result.sources.length < 2) {
      issues.push('Only one source available');
    }

    // Check conflicts
    if (result.conflicts.length > 3) {
      issues.push(`High number of conflicts: ${result.conflicts.length}`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Get consensus summary
   */
  getSummary<T>(result: ConsensusResult<T>): string {
    const validation = this.validateConsensus(result);
    
    let summary = `
Consensus Summary
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
Confidence: ${result.confidence}%
Sources: ${result.sources.join(', ')}
Conflicts: ${result.conflicts.length}

`;

    if (result.conflicts.length > 0) {
      summary += 'Conflicts Detected:\n';
      for (const conflict of result.conflicts) {
        summary += `  â€¢ ${conflict.field}:\n`;
        for (const val of conflict.values) {
          summary += `    - ${val.source}: ${JSON.stringify(val.value)}\n`;
        }
        summary += `    â†’ ${conflict.resolution}\n`;
      }
      summary += '\n';
    }

    if (result.notes && result.notes.length > 0) {
      summary += 'Notes:\n';
      for (const note of result.notes) {
        summary += `  â€¢ ${note}\n`;
      }
      summary += '\n';
    }

    summary += `Validation: ${validation.valid ? 'âœ“ Valid' : 'âœ— Invalid'}\n`;
    if (validation.issues.length > 0) {
      summary += 'Issues:\n';
      for (const issue of validation.issues) {
        summary += `  - ${issue}\n`;
      }
    }

    summary += 'â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”';
    return summary.trim();
  }
}

// Export singleton instance
export const consensus = new ConsensusManager();

/**
 * Helper: Build consensus
 */
export function buildConsensus<T>(
  sources: SourceData<T>[],
  strategy?: ConsensusStrategy
): ConsensusResult<T> {
  return consensus.buildConsensus(sources, strategy);
}

/**
 * Helper: Validate consensus
 */
export function validateConsensus<T>(result: ConsensusResult<T>) {
  return consensus.validateConsensus(result);
}
