/**
 * Explainability Module
 * à¸­à¸˜à¸´à¸šà¸²à¸¢à¹€à¸«à¸•à¸¸à¸œà¸¥à¸à¸²à¸£à¸•à¸±à¸”à¸ªà¸´à¸™à¹ƒà¸ˆà¸‚à¸­à¸‡à¸£à¸°à¸šà¸š
 * 
 * Features:
 * - Decision reasoning
 * - Data interpretation
 * - Confidence explanation
 * - User-friendly explanations
 * 
 * @module utils/explainability
 */

import { logBoth } from '../mcpLogger';

/**
 * Explanation Level
 */
export type ExplanationLevel = 'simple' | 'detailed' | 'technical';

/**
 * Decision Explanation
 */
export interface DecisionExplanation {
  decision: string;
  reasoning: string[];
  confidence: number;
  dataPoints: Array<{
    field: string;
    value: any;
    interpretation: string;
  }>;
  rules: Array<{
    rule: string;
    applied: boolean;
    reason?: string;
  }>;
}

/**
 * Explainability Manager
 */
class ExplainabilityManager {
  /**
   * Explain weather decision
   */
  explainWeatherDecision(data: {
    precipitation: number;
    weatherCode: number;
    rainChance?: number;
    temperature?: number;
  }): DecisionExplanation {
    const reasoning: string[] = [];
    const dataPoints: DecisionExplanation['dataPoints'] = [];
    const rules: DecisionExplanation['rules'] = [];
    let decision = 'à¹„à¸¡à¹ˆà¹à¸™à¹ˆà¸Šà¸±à¸”';
    let confidence = 50;

    // Analyze precipitation
    dataPoints.push({
      field: 'precipitation',
      value: data.precipitation,
      interpretation: data.precipitation > 0 
        ? `à¸¡à¸µà¸à¸™à¸•à¸ ${data.precipitation} mm`
        : 'à¹„à¸¡à¹ˆà¸¡à¸µà¸à¸™à¸•à¸'
    });

    if (data.precipitation > 0) {
      reasoning.push(`precipitation=${data.precipitation}mm > 0 â†’ à¸¡à¸µà¸à¸™à¸•à¸`);
      decision = 'à¸à¸™à¸•à¸';
      confidence = 90;
      
      rules.push({
        rule: 'precipitation > 0',
        applied: true,
        reason: 'à¸•à¸£à¸§à¸ˆà¸žà¸šà¸›à¸£à¸´à¸¡à¸²à¸“à¸à¸™'
      });
    } else {
      reasoning.push(`precipitation=${data.precipitation}mm = 0 â†’ à¹„à¸¡à¹ˆà¸¡à¸µà¸à¸™à¸•à¸`);
      decision = 'à¹„à¸¡à¹ˆà¸•à¸';
      confidence = 85;
      
      rules.push({
        rule: 'precipitation = 0',
        applied: true,
        reason: 'à¹„à¸¡à¹ˆà¸žà¸šà¸›à¸£à¸´à¸¡à¸²à¸“à¸à¸™'
      });
    }

    // Analyze weather code
    const rainCodes = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99];
    dataPoints.push({
      field: 'weatherCode',
      value: data.weatherCode,
      interpretation: rainCodes.includes(data.weatherCode)
        ? 'à¸£à¸«à¸±à¸ªà¸ªà¸ à¸²à¸žà¸­à¸²à¸à¸²à¸¨à¸šà¹ˆà¸‡à¸Šà¸µà¹‰à¸à¸™'
        : 'à¸£à¸«à¸±à¸ªà¸ªà¸ à¸²à¸žà¸­à¸²à¸à¸²à¸¨à¹„à¸¡à¹ˆà¸šà¹ˆà¸‡à¸Šà¸µà¹‰à¸à¸™'
    });

    if (rainCodes.includes(data.weatherCode)) {
      reasoning.push(`code=${data.weatherCode} â†’ à¸£à¸«à¸±à¸ªà¹ƒà¸™à¸Šà¸¸à¸”à¸à¸™`);
      if (decision === 'à¹„à¸¡à¹ˆà¸•à¸') {
        decision = 'à¹à¸™à¸§à¹‚à¸™à¹‰à¸¡à¸•à¸';
        confidence = 70;
        reasoning.push('à¸¡à¸µà¹à¸™à¸§à¹‚à¸™à¹‰à¸¡à¸à¸™à¸•à¸à¹à¸¡à¹‰à¹„à¸¡à¹ˆà¸¡à¸µ precipitation');
      }
      
      rules.push({
        rule: 'weatherCode in rain_codes',
        applied: true,
        reason: 'à¸£à¸«à¸±à¸ªà¸ªà¸ à¸²à¸žà¸­à¸²à¸à¸²à¸¨à¸šà¹ˆà¸‡à¸Šà¸µà¹‰à¸à¸™'
      });
    } else {
      rules.push({
        rule: 'weatherCode in rain_codes',
        applied: false,
        reason: 'à¸£à¸«à¸±à¸ªà¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸£à¸«à¸±à¸ªà¸à¸™'
      });
    }

    // Analyze rain chance
    if (data.rainChance !== undefined) {
      dataPoints.push({
        field: 'rainChance',
        value: data.rainChance,
        interpretation: data.rainChance > 50
          ? `à¹‚à¸­à¸à¸²à¸ªà¸à¸™à¸ªà¸¹à¸‡ (${data.rainChance}%)`
          : `à¹‚à¸­à¸à¸²à¸ªà¸à¸™à¸•à¹ˆà¸³ (${data.rainChance}%)`
      });

      if (data.rainChance > 50) {
        reasoning.push(`rainChance=${data.rainChance}% > 50% â†’ à¸¡à¸µà¹à¸™à¸§à¹‚à¸™à¹‰à¸¡`);
        if (decision === 'à¹„à¸¡à¹ˆà¸•à¸') {
          decision = 'à¹à¸™à¸§à¹‚à¸™à¹‰à¸¡à¸•à¸';
          confidence = 65;
        }
        
        rules.push({
          rule: 'rainChance > 50%',
          applied: true,
          reason: 'à¹‚à¸­à¸à¸²à¸ªà¸à¸™à¸ªà¸¹à¸‡à¸à¸§à¹ˆà¸² 50%'
        });
      } else {
        rules.push({
          rule: 'rainChance > 50%',
          applied: false,
          reason: `à¹‚à¸­à¸à¸²à¸ªà¸à¸™à¸•à¹ˆà¸³ (${data.rainChance}%)`
        });
      }
    }

    return {
      decision,
      reasoning,
      confidence,
      dataPoints,
      rules
    };
  }

  /**
   * Format explanation for user
   */
  formatExplanation(
    explanation: DecisionExplanation,
    level: ExplanationLevel = 'simple'
  ): string {
    let text = '';

    // Add decision
    text += `à¸„à¸³à¸•à¸­à¸š: ${explanation.decision}\n`;
    text += `à¸„à¸§à¸²à¸¡à¸¡à¸±à¹ˆà¸™à¹ƒà¸ˆ: ${explanation.confidence}%\n\n`;

    if (level === 'simple') {
      // Simple explanation - just main reasoning
      text += 'à¹€à¸«à¸•à¸¸à¸œà¸¥:\n';
      if (explanation.reasoning.length > 0) {
        text += `â€¢ ${explanation.reasoning[0]}\n`;
      }
    } else if (level === 'detailed') {
      // Detailed explanation - all reasoning
      text += 'à¹€à¸«à¸•à¸¸à¸œà¸¥à¸à¸²à¸£à¸•à¸±à¸”à¸ªà¸´à¸™à¹ƒà¸ˆ:\n';
      for (const reason of explanation.reasoning) {
        text += `â€¢ ${reason}\n`;
      }
      
      text += '\nà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸—à¸µà¹ˆà¹ƒà¸Šà¹‰:\n';
      for (const dp of explanation.dataPoints) {
        text += `â€¢ ${dp.field}: ${dp.value} â†’ ${dp.interpretation}\n`;
      }
    } else if (level === 'technical') {
      // Technical explanation - everything
      text += 'à¹€à¸«à¸•à¸¸à¸œà¸¥à¸à¸²à¸£à¸•à¸±à¸”à¸ªà¸´à¸™à¹ƒà¸ˆ:\n';
      for (const reason of explanation.reasoning) {
        text += `â€¢ ${reason}\n`;
      }
      
      text += '\nà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸—à¸µà¹ˆà¸§à¸´à¹€à¸„à¸£à¸²à¸°à¸«à¹Œ:\n';
      for (const dp of explanation.dataPoints) {
        text += `â€¢ ${dp.field}: ${dp.value}\n`;
        text += `  â†’ ${dp.interpretation}\n`;
      }
      
      text += '\nà¸à¸Žà¸—à¸µà¹ˆà¹ƒà¸Šà¹‰à¸•à¸±à¸”à¸ªà¸´à¸™à¹ƒà¸ˆ:\n';
      for (const rule of explanation.rules) {
        const icon = rule.applied ? 'âœ“' : 'âœ—';
        text += `${icon} ${rule.rule}\n`;
        if (rule.reason) {
          text += `  â†’ ${rule.reason}\n`;
        }
      }
    }

    return text.trim();
  }

  /**
   * Explain time decision
   */
  explainTimeDecision(data: {
    currentTime: Date;
    timezone: string;
    formatted: string;
  }): DecisionExplanation {
    return {
      decision: data.formatted,
      reasoning: [
        `à¸­à¹ˆà¸²à¸™à¹€à¸§à¸¥à¸²à¸ˆà¸²à¸à¸£à¸°à¸šà¸š: ${data.currentTime.toISOString()}`,
        `à¹à¸›à¸¥à¸‡à¹€à¸›à¹‡à¸™à¹€à¸‚à¸•à¹€à¸§à¸¥à¸²: ${data.timezone}`,
        `à¸ˆà¸±à¸”à¸£à¸¹à¸›à¹à¸šà¸šà¹€à¸›à¹‡à¸™à¸ à¸²à¸©à¸²à¹„à¸—à¸¢: ${data.formatted}`
      ],
      confidence: 100,
      dataPoints: [
        {
          field: 'timezone',
          value: data.timezone,
          interpretation: 'à¹€à¸‚à¸•à¹€à¸§à¸¥à¸²à¸‚à¸­à¸‡à¹„à¸—à¸¢'
        },
        {
          field: 'currentTime',
          value: data.currentTime.toISOString(),
          interpretation: 'à¹€à¸§à¸¥à¸²à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™à¸ˆà¸²à¸à¸£à¸°à¸šà¸š'
        }
      ],
      rules: [
        {
          rule: 'Use system time',
          applied: true,
          reason: 'à¹€à¸§à¸¥à¸²à¸ˆà¸²à¸à¸£à¸°à¸šà¸š server'
        }
      ]
    };
  }

  /**
   * Explain search decision
   */
  explainSearchDecision(data: {
    query: string;
    resultsCount: number;
    sources: string[];
    topResult?: {
      title: string;
      url: string;
      score: number;
    };
  }): DecisionExplanation {
    const reasoning: string[] = [
      `à¸„à¹‰à¸™à¸«à¸²à¸„à¸³à¸§à¹ˆà¸² "${data.query}"`,
      `à¸žà¸š ${data.resultsCount} à¸œà¸¥à¸¥à¸±à¸žà¸˜à¹Œ`,
      `à¹ƒà¸Šà¹‰à¹à¸«à¸¥à¹ˆà¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥: ${data.sources.join(', ')}`
    ];

    if (data.topResult) {
      reasoning.push(
        `à¹€à¸¥à¸·à¸­à¸à¸œà¸¥à¸¥à¸±à¸žà¸˜à¹Œà¸­à¸±à¸™à¸”à¸±à¸š 1: ${data.topResult.title} (à¸„à¸°à¹à¸™à¸™: ${data.topResult.score})`
      );
    }

    return {
      decision: data.resultsCount > 0 ? 'à¸žà¸šà¸œà¸¥à¸¥à¸±à¸žà¸˜à¹Œ' : 'à¹„à¸¡à¹ˆà¸žà¸šà¸œà¸¥à¸¥à¸±à¸žà¸˜à¹Œ',
      reasoning,
      confidence: data.resultsCount > 0 ? 90 : 100,
      dataPoints: [
        {
          field: 'query',
          value: data.query,
          interpretation: 'à¸„à¸³à¸„à¹‰à¸™à¸«à¸²à¸ˆà¸²à¸à¸œà¸¹à¹‰à¹ƒà¸Šà¹‰'
        },
        {
          field: 'resultsCount',
          value: data.resultsCount,
          interpretation: `à¸ˆà¸³à¸™à¸§à¸™à¸œà¸¥à¸¥à¸±à¸žà¸˜à¹Œà¸—à¸µà¹ˆà¸žà¸š`
        }
      ],
      rules: [
        {
          rule: 'resultsCount > 0',
          applied: data.resultsCount > 0,
          reason: data.resultsCount > 0 ? 'à¸žà¸šà¸œà¸¥à¸¥à¸±à¸žà¸˜à¹Œ' : 'à¹„à¸¡à¹ˆà¸žà¸šà¸œà¸¥à¸¥à¸±à¸žà¸˜à¹Œ'
        }
      ]
    };
  }
}

// Export singleton instance
export const explainability = new ExplainabilityManager();

/**
 * Helper: Explain weather decision
 */
export function explainWeather(data: Parameters<typeof explainability.explainWeatherDecision>[0]): string {
  const explanation = explainability.explainWeatherDecision(data);
  return explainability.formatExplanation(explanation, 'simple');
}

/**
 * Helper: Explain with custom level
 */
export function explain(
  explanation: DecisionExplanation,
  level?: ExplanationLevel
): string {
  return explainability.formatExplanation(explanation, level);
}
