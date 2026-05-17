/**
 * Intelligent Semantic Router for Hybrid Mode (2026 SOTA)
 * ใช้ Vector Embeddings แทน Keyword Matching แบบเดิม
 * เฉพาะเมื่อ AI_MODE = "hybrid" เท่านั้น
 */

import { Ollama } from 'ollama';
import { LRUCache } from 'lru-cache';
import { logBoth } from './mcpLogger';

// Configuration
const CONFIG = {
  OLLAMA_HOST: process.env.LOCAL_OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
  EMBED_MODEL: 'nomic-embed-text', // Lightweight & Fast embedding model
  SIMILARITY_THRESHOLD: 0.45,      // ความเหมือนต่ำกว่านี้ = Unknown
  HYBRID_WEIGHT: 0.3,              // Keyword (0.3) vs Semantic (0.7)
  CACHE_MAX_SIZE: 500,             // เก็บ 500 queries
  CACHE_TTL: 1000 * 60 * 60        // 1 ชั่วโมง
};

// Category Interface
export interface SemanticCategory {
  id: string;
  description: string; // สำคัญมาก! ใช้สร้าง Vector
  keywords: string[];  // Fallback สำหรับ quick matching
  embedding?: number[]; // Vector cache
}

// Tool Categories - เพิ่ม description ละเอียดเพื่อ Semantic Matching
export const SEMANTIC_CATEGORIES: SemanticCategory[] = [
  {
    id: 'weather',
    description: 'Weather forecasts, temperature, rain predictions, climate data, atmospheric conditions, and meteorological information from TMD and NWP sources.',
    keywords: ['weather', 'อากาศ', 'ฝน', 'อุณหภูมิ', 'tmd', 'nwp', 'พยากรณ์']
  },
  {
    id: 'nasa',
    description: 'Space exploration, NASA missions, astronomy pictures (APOD), planetary data, Mars rovers, telescope observations, and space science.',
    keywords: ['nasa', 'space', 'อวกาศ', 'ดาว', 'apod', 'mars', 'telescope', 'นาซ่า', 'ภารกิจ', 'ข้อมูล']
  },
  {
    id: 'calculation',
    description: 'Mathematical calculations, arithmetic operations, factorial, algebra, unit conversions, and numerical problem solving.',
    keywords: ['calculate', 'math', 'คำนวณ', 'factorial', '+', '-', '*', '/', '=']
  },
  {
    id: 'time',
    description: 'Current time, date queries, timezone conversions, calendar information, and temporal data.',
    keywords: ['time', 'date', 'เวลา', 'วันที่', 'clock', 'calendar', 'กี่โมง', 'ตอนนี้']
  },
  {
    id: 'worldbank',
    description: 'Economic data, GDP statistics, world bank indicators, country development metrics, and financial data.',
    keywords: ['gdp', 'economy', 'worldbank', 'เศรษฐกิจ', 'economic']
  },
  {
    id: 'data_visualization',
    description: 'Creating charts, graphs, data visualization with ECharts, plotting data, and visual analytics.',
    keywords: ['chart', 'graph', 'plot', 'แผนภูมิ', 'กราฟ', 'visualize']
  },
  {
    id: 'file_operations',
    description: 'Reading files, writing documents, PDF parsing, Excel operations, file management, and document processing.',
    keywords: ['file', 'read', 'write', 'pdf', 'excel', 'document', 'ไฟล์']
  },
  {
    id: 'image_generation',
    description: 'Drawing images, creating graphics with Canvas API, generating visual content, and image manipulation.',
    keywords: ['draw', 'image', 'canvas', 'วาด', 'รูป', 'ภาพ', 'generate']
  },
  {
    id: 'ocr',
    description: 'Optical Character Recognition, text extraction from images, reading text in photos, and image-to-text conversion.',
    keywords: ['ocr', 'read image', 'extract text', 'อ่านภาพ', 'ข้อความจากรูป']
  },
  {
    id: 'translation',
    description: 'Language translation between Thai, English, Chinese, and other languages. Text translation and language conversion.',
    keywords: ['translate', 'แปล', 'แปลภาษา', 'translation', 'language']
  },
  {
    id: 'general',
    description: 'General knowledge questions, explanations, definitions, theories, concepts, philosophical questions, and conversational queries.',
    keywords: ['explain', 'what is', 'อธิบาย', 'คืออะไร', 'ทำไม', 'why', 'how', 'ทฤษฎี', 'ai', 'artificial']
  }
];

export class IntelligentRouter {
  private ollama: Ollama;
  private cache: LRUCache<string, string>;
  private categories: SemanticCategory[] = SEMANTIC_CATEGORIES;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private cacheHits = 0; // 🧠 Track cache hits
  private cacheMisses = 0; // 🧠 Track cache misses

  constructor() {
    this.ollama = new Ollama({ host: CONFIG.OLLAMA_HOST });
    this.cache = new LRUCache({ 
      max: CONFIG.CACHE_MAX_SIZE, 
      ttl: CONFIG.CACHE_TTL 
    });
  }

  /**
   * 🔥 INIT PHASE: Pre-calculate category vectors (ทำครั้งเดียวตอน startup)
   */
  public async initialize(): Promise<void> {
    // Prevent multiple initializations
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      logBoth('info', '🚀 [Semantic Router] Initializing vector embeddings...');
      
      const promises = this.categories.map(async (cat) => {
        try {
          const response = await this.ollama.embeddings({ 
            model: CONFIG.EMBED_MODEL, 
            prompt: cat.description 
          });
          cat.embedding = response.embedding;
          logBoth('debug', `  ✓ ${cat.id}: ${response.embedding.length}D vector`);
        } catch (error) {
          logBoth('error', `  ✗ ${cat.id}: ${error}`);
        }
      });

      await Promise.all(promises);
      this.isInitialized = true;
      logBoth('info', `✅ [Semantic Router] Ready: ${this.categories.filter(c => c.embedding).length}/${this.categories.length} categories vectorized.`);
    } catch (error) {
      logBoth('error', `❌ [Semantic Router] Initialization failed: ${error}`);
      throw error;
    }
  }

  /**
   * 🧠 CORE: Cosine Similarity (Vector Math)
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return (magnitudeA === 0 || magnitudeB === 0) ? 0 : dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * ⚡ HYBRID ROUTING: Keyword (fast) + Semantic (smart)
   */
  public async categorize(userQuery: string): Promise<string> {
    // Auto-initialize if needed
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const normalizedQuery = userQuery.toLowerCase();

    // Step 1: Cache Hit (เร็วที่สุด <1ms)
    if (this.cache.has(normalizedQuery)) {
      const cached = this.cache.get(normalizedQuery)!;
      this.cacheHits++; // 🧠 Track cache hit
      logBoth('debug', `[Semantic Router] Cache hit: "${userQuery.substring(0, 30)}..." → ${cached} (0ms)`);
      return cached;
    }

    this.cacheMisses++; // 🧠 Track cache miss

    // Step 2: Keyword Exact Match (เร็ว ~1ms)
    const keywordMatch = this.categories.find(c => 
      c.keywords.some(k => normalizedQuery.includes(k.toLowerCase()))
    );
    
    if (keywordMatch) {
      this.cache.set(normalizedQuery, keywordMatch.id);
      const elapsed = Date.now() - startTime;
      logBoth('debug', `[Semantic Router] Keyword match: "${userQuery.substring(0, 30)}..." → ${keywordMatch.id} (${elapsed}ms)`);
      return keywordMatch.id;
    }

    // Step 3: Semantic Matching (ฉลาด ~100-500ms)
    try {
      const response = await this.ollama.embeddings({ 
        model: CONFIG.EMBED_MODEL, 
        prompt: userQuery 
      });
      const queryVector = response.embedding;

      let bestCategory = 'general';
      let maxScore = -1;
      const scores: { [key: string]: number } = {};

      for (const cat of this.categories) {
        if (!cat.embedding) continue;
        const score = this.cosineSimilarity(queryVector, cat.embedding);
        scores[cat.id] = score;
        
        if (score > maxScore) {
          maxScore = score;
          bestCategory = cat.id;
        }
      }

      // Threshold check
      const finalResult = maxScore >= CONFIG.SIMILARITY_THRESHOLD ? bestCategory : 'general';
      const elapsed = Date.now() - startTime;

      // Log top 3 scores for debugging
      const top3 = Object.entries(scores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([id, score]) => `${id}:${score.toFixed(3)}`)
        .join(', ');
      
      logBoth('info', `[Semantic Router] Semantic match: "${userQuery.substring(0, 40)}..." → ${finalResult} (${elapsed}ms) [${top3}]`);

      // Cache result
      this.cache.set(normalizedQuery, finalResult);
      return finalResult;

    } catch (error) {
      logBoth('error', `⚠️ [Semantic Router] Error (fallback to keyword): ${error}`);
      return 'general'; // Fail-safe
    }
  }

  /**
   * 📊 Get cache statistics
   */
  public getCacheStats(): { size: number; max: number; hitRate: number; hits: number; total: number } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      size: this.cache.size,
      max: CONFIG.CACHE_MAX_SIZE,
      hitRate: total > 0 ? (this.cacheHits / total) : 0,
      hits: this.cacheHits,
      total
    };
  }

  /**
   * 🧹 Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
    logBoth('info', '[Semantic Router] Cache cleared');
  }
}

// Singleton instance
let routerInstance: IntelligentRouter | null = null;

export function getSemanticRouter(): IntelligentRouter {
  if (!routerInstance) {
    routerInstance = new IntelligentRouter();
  }
  return routerInstance;
}
