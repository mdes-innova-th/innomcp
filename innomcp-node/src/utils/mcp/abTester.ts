/**
 * =====================================================
 * A/B Testing System - Remote vs Hybrid Mode Comparison
 * =====================================================
 * 
 * Purpose:
 * - เปรียบเทียบประสิทธิภาพระหว่าง Remote AI (gemma3:4b@remote) กับ Hybrid AI (remote primary, local fallback)
 * - บันทึกเวลาตอบ, คะแนน confidence, ผลลัพธ์
 * - สร้าง dashboard เปรียบเทียบ
 * 
 * Usage:
 * ```typescript
 * const tester = getABTester();
 * const result = await tester.compareModesการ(userQuery, sessionId);
 * // result.winner = 'remote' | 'hybrid'
 * // result.details = { remote: {...}, hybrid: {...} }
 * ```
 * 
 * @author INNOMCP Team
 * @date 2026-01-20
 */

import { Ollama } from 'ollama';
import { withDbConnection } from '../db';
import { logBoth } from '../mcpLogger';
import { getGodTierRouter } from './godTierRouter';

// ========================================
// Configuration
// ========================================

const CONFIG = {
  OLLAMA_LOCAL: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
  OLLAMA_REMOTE: process.env.OLLAMA_REMOTE_URL || 'https://ollama.mdes-innova.online',
  PRIMARY_MODEL: 'gemma3:4b',
  FAST_MODEL: 'qwen2.5:0.5b',
  HEAVY_MODEL: 'deepseek-r1:32b',
  
  TIMEOUTS: {
    REMOTE: 30000, // 30 seconds
    LOCAL: 15000,  // 15 seconds
  },
  
  COMPARISON: {
    MIN_CONFIDENCE_DELTA: 0.05, // ต้องต่างกันขั้นต่ำ 5% ถึงจะถือว่า "ชนะ"
    TIME_WEIGHT: 0.4, // น้ำหนักของเวลาตอบในการตัดสิน winner
    CONFIDENCE_WEIGHT: 0.6, // น้ำหนักของคะแนน confidence
  }
};

// ========================================
// Types
// ========================================

export interface ABTestResult {
  testId: string;
  query: string;
  winner: 'remote' | 'hybrid' | 'tie';
  confidenceDelta: number;
  timeDelta: number;
  details: {
    remote: {
      responseTime: number;
      confidence: number;
      category: string;
      answer: string;
      error?: string;
    };
    hybrid: {
      responseTime: number;
      confidence: number;
      category: string;
      answer: string;
      usedFallback: boolean;
      error?: string;
    };
  };
  recommendation: string;
  timestamp: Date;
}

export interface ABTestStats {
  totalTests: number;
  remoteWins: number;
  hybridWins: number;
  ties: number;
  avgRemoteTime: number;
  avgHybridTime: number;
  avgRemoteConfidence: number;
  avgHybridConfidence: number;
  remoteErrors: number;
  hybridErrors: number;
  hybridFallbackRate: number;
}

// ========================================
// A/B Tester Class
// ========================================

export class ABTester {
  private ollamaLocal: Ollama;
  private ollamaRemote: Ollama;
  private router = getGodTierRouter();
  private testCounter: number = 0;
  
  constructor() {
    this.ollamaLocal = new Ollama({ host: CONFIG.OLLAMA_LOCAL });
    this.ollamaRemote = new Ollama({ host: CONFIG.OLLAMA_REMOTE });
    logBoth('info', '[ABTester] 🧪 A/B Testing System initialized');
  }
  
  // ========================================
  // Main Comparison Method
  // ========================================
  
  public async compareModes(
    userQuery: string,
    sessionId: string,
    history: any[] = []
  ): Promise<ABTestResult> {
    const testId = `AB-${Date.now()}-${++this.testCounter}`;
    
    logBoth('info', `[ABTester] 🧪 Starting A/B test ${testId}`);
    
    try {
      // Run both modes in parallel
      const [remoteResult, hybridResult] = await Promise.allSettled([
        this.runRemoteMode(userQuery, history),
        this.runHybridMode(userQuery, history),
      ]);
      
      // Extract results
      const remote = remoteResult.status === 'fulfilled'
        ? remoteResult.value
        : this.buildErrorResult('remote', remoteResult.reason);
      
      const hybrid = hybridResult.status === 'fulfilled'
        ? hybridResult.value
        : this.buildErrorResult('hybrid', hybridResult.reason);
      
      // Determine winner
      const winner = this.determineWinner(remote, hybrid);
      
      // Calculate deltas
      const confidenceDelta = Math.abs(remote.confidence - hybrid.confidence);
      const timeDelta = remote.responseTime - hybrid.responseTime;
      
      // Build recommendation
      const recommendation = this.buildRecommendation(winner, remote, hybrid);
      
      // Build result object
      const result: ABTestResult = {
        testId,
        query: userQuery,
        winner,
        confidenceDelta,
        timeDelta,
        details: { remote, hybrid },
        recommendation,
        timestamp: new Date(),
      };
      
      // Log to database
      await this.logABTest(result, sessionId);
      
      logBoth('info', `[ABTester] ✅ Test ${testId} complete: ${winner} wins (Δconfidence=${confidenceDelta.toFixed(2)}, Δtime=${timeDelta}ms)`);
      
      return result;
      
    } catch (error) {
      logBoth('error', `[ABTester] ❌ A/B test failed: ${error}`);
      throw error;
    }
  }
  
  // ========================================
  // Remote Mode Runner
  // ========================================
  
  private async runRemoteMode(
    query: string,
    history: any[]
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      // 1. Route to category
      const routeResult = await this.router.route(query, history, 'remote');
      
      // 2. Call remote AI
      const response = await this.ollamaRemote.chat({
        model: CONFIG.PRIMARY_MODEL,
        messages: [
          { role: 'system', content: 'You are a helpful AI assistant. Answer concisely in Thai.' },
          { role: 'user', content: query }
        ],
        options: {
          temperature: 0.7,
          num_predict: 500,
        },
      });
      
      const responseTime = Date.now() - startTime;
      
      return {
        responseTime,
        confidence: routeResult.confidence,
        category: routeResult.category,
        answer: response.message.content,
      };
      
    } catch (error) {
      logBoth('error', `[ABTester] Remote mode error: ${error}`);
      throw error;
    }
  }
  
  // ========================================
  // Hybrid Mode Runner
  // ========================================
  
  private async runHybridMode(
    query: string,
    history: any[]
  ): Promise<any> {
    const startTime = Date.now();
    let usedFallback = false;
    
    try {
      // 1. Route to category
      const routeResult = await this.router.route(query, history, 'hybrid');
      
      // 2. Try remote first
      let response;
      try {
        const remotePromise = this.ollamaRemote.chat({
          model: CONFIG.PRIMARY_MODEL,
          messages: [
            { role: 'system', content: 'You are a helpful AI assistant. Answer concisely in Thai.' },
            { role: 'user', content: query }
          ],
          options: { temperature: 0.7, num_predict: 500 },
        });
        
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Remote timeout')), CONFIG.TIMEOUTS.REMOTE)
        );
        
        response = await Promise.race([remotePromise, timeout]) as any;
        
      } catch (remoteError) {
        // 3. Fallback to local
        logBoth('warn', `[ABTester] Remote failed, fallback to local: ${remoteError}`);
        usedFallback = true;
        
        response = await this.ollamaLocal.chat({
          model: CONFIG.PRIMARY_MODEL,
          messages: [
            { role: 'system', content: 'You are a helpful AI assistant. Answer concisely in Thai.' },
            { role: 'user', content: query }
          ],
          options: { temperature: 0.7, num_predict: 500 },
        });
      }
      
      const responseTime = Date.now() - startTime;
      
      return {
        responseTime,
        confidence: routeResult.confidence,
        category: routeResult.category,
        answer: response.message.content,
        usedFallback,
      };
      
    } catch (error) {
      logBoth('error', `[ABTester] Hybrid mode error: ${error}`);
      throw error;
    }
  }
  
  // ========================================
  // Winner Determination Logic
  // ========================================
  
  private determineWinner(
    remote: any,
    hybrid: any
  ): 'remote' | 'hybrid' | 'tie' {
    // If one failed, other wins
    if (remote.error && !hybrid.error) return 'hybrid';
    if (hybrid.error && !remote.error) return 'remote';
    if (remote.error && hybrid.error) return 'tie';
    
    // Calculate composite scores
    const remoteScore = this.calculateScore(remote);
    const hybridScore = this.calculateScore(hybrid);
    
    const diff = Math.abs(remoteScore - hybridScore);
    
    // If difference < threshold, it's a tie
    if (diff < 0.05) return 'tie';
    
    return remoteScore > hybridScore ? 'remote' : 'hybrid';
  }
  
  private calculateScore(result: any): number {
    // Normalize time (lower is better, max 30s)
    const timeScore = Math.max(0, 1 - (result.responseTime / 30000));
    
    // Confidence score (higher is better)
    const confidenceScore = result.confidence;
    
    // Weighted average
    return (
      timeScore * CONFIG.COMPARISON.TIME_WEIGHT +
      confidenceScore * CONFIG.COMPARISON.CONFIDENCE_WEIGHT
    );
  }
  
  // ========================================
  // Recommendation Builder
  // ========================================
  
  private buildRecommendation(
    winner: string,
    remote: any,
    hybrid: any
  ): string {
    if (winner === 'tie') {
      return 'ผลลัพธ์ใกล้เคียงกัน ใช้ Remote mode เพื่อความเสถียร';
    }
    
    if (winner === 'remote') {
      if (remote.responseTime < hybrid.responseTime) {
        return `Remote เร็วกว่า ${hybrid.responseTime - remote.responseTime}ms และมั่นใจกว่า`;
      }
      return 'Remote ให้ผลลัพธ์ที่ดีกว่า';
    }
    
    if (winner === 'hybrid') {
      if (hybrid.usedFallback) {
        return `Hybrid ชนะเพราะ remote ล้มเหลว (fallback ไปใช้ local สำเร็จ)`;
      }
      if (hybrid.responseTime < remote.responseTime) {
        return `Hybrid เร็วกว่า ${remote.responseTime - hybrid.responseTime}ms`;
      }
      return 'Hybrid ให้ผลลัพธ์ที่ดีกว่า';
    }
    
    return 'ไม่สามารถตัดสินได้';
  }
  
  // ========================================
  // Error Handler
  // ========================================
  
  private buildErrorResult(mode: string, error: any): any {
    return {
      responseTime: 0,
      confidence: 0,
      category: 'error',
      answer: '',
      error: String(error),
      usedFallback: mode === 'hybrid',
    };
  }
  
  // ========================================
  // Database Logging
  // ========================================
  
  private async logABTest(
    result: ABTestResult,
    sessionId: string
  ): Promise<void> {
    try {
      await withDbConnection(async (conn) => {
        // Log query first
        const [queryResult] = await conn.query<any>(
          `INSERT INTO query_logs (session_id, query_text, detected_category, ai_mode, response_time_ms, success)
           VALUES (?, ?, ?, 'ab-test', ?, TRUE)`,
          [sessionId, result.query, result.details.remote.category, result.details.remote.responseTime]
        );
        const queryLogId = queryResult.insertId;
        
        // Log A/B test result
        await conn.query(
          `INSERT INTO ab_test_results (
            query_log_id, test_type, variant_a, variant_b,
            variant_a_time_ms, variant_b_time_ms,
            variant_a_result, variant_b_result,
            winner, confidence_delta
          ) VALUES (?, 'mode-comparison', 'remote', 'hybrid', ?, ?, ?, ?, ?, ?)`,
          [
            queryLogId,
            result.details.remote.responseTime,
            result.details.hybrid.responseTime,
            JSON.stringify(result.details.remote),
            JSON.stringify(result.details.hybrid),
              result.winner,
              result.confidenceDelta,
            ]
          );
          logBoth('info', `[ABTester] 📊 Logged A/B test result: ${result.testId}`);
        });
      } catch (error) {
        logBoth('warn', `[ABTester] ⚠️ Failed to log A/B test: ${error}`);
      }
    }

  // ========================================
  // Statistics Retrieval
  // ========================================

  public async getStats(days: number = 7): Promise<ABTestStats> {
    try {
      return await withDbConnection(async (conn) => {
        const [rows] = await conn.query<any[]>(`
          SELECT 
            COUNT(*) as total_tests,
            SUM(CASE WHEN winner = 'remote' THEN 1 ELSE 0 END) as remote_wins,
            SUM(CASE WHEN winner = 'hybrid' THEN 1 ELSE 0 END) as hybrid_wins,
            SUM(CASE WHEN winner = 'tie' THEN 1 ELSE 0 END) as ties,
            AVG(variant_a_time_ms) as avg_remote_time,
            AVG(variant_b_time_ms) as avg_hybrid_time,
            AVG(confidence_delta) as avg_confidence_delta
          FROM ab_test_results
          WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        `, [days]);
        
        if (rows.length === 0) {
          return this.emptyStats();
        }
        
        const row = rows[0];
        
        // Parse hybrid results for fallback rate
        const [hybridRows] = await conn.query<any[]>(`
          SELECT variant_b_result
          FROM ab_test_results
          WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        `, [days]);
        
        let fallbackCount = 0;
        hybridRows.forEach(r => {
          try {
            const data = JSON.parse(r.variant_b_result);
            if (data.usedFallback) fallbackCount++;
          } catch (e) {}
        });
        
        return {
          totalTests: row.total_tests || 0,
          remoteWins: row.remote_wins || 0,
          hybridWins: row.hybrid_wins || 0,
          ties: row.ties || 0,
          avgRemoteTime: Math.round(row.avg_remote_time || 0),
          avgHybridTime: Math.round(row.avg_hybrid_time || 0),
          avgRemoteConfidence: 0, // TODO: parse from variant_a_result
          avgHybridConfidence: 0, // TODO: parse from variant_b_result
          remoteErrors: 0, // TODO: count errors from variant_a_result
          hybridErrors: 0, // TODO: count errors from variant_b_result
          hybridFallbackRate: fallbackCount / (row.total_tests || 1),
        };
      });
      
    } catch (error) {
      logBoth('error', `[ABTester] ❌ Failed to get stats: ${error}`);
      return this.emptyStats();
    }
  }
  
  private emptyStats(): ABTestStats {
    return {
      totalTests: 0,
      remoteWins: 0,
      hybridWins: 0,
      ties: 0,
      avgRemoteTime: 0,
      avgHybridTime: 0,
      avgRemoteConfidence: 0,
      avgHybridConfidence: 0,
      remoteErrors: 0,
      hybridErrors: 0,
      hybridFallbackRate: 0,
    };
  }
}

// ========================================
// Singleton Export
// ========================================

let abTesterInstance: ABTester | null = null;

export function getABTester(): ABTester {
  if (!abTesterInstance) {
    abTesterInstance = new ABTester();
  }
  return abTesterInstance;
}
