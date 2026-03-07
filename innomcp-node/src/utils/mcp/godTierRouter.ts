/**
 * =====================================================
 * God-Tier Context-Aware Intent Engine (2026 Edition)
 * =====================================================
 * 
 * Based on add2.txt specifications:
 * - Multi-stage pipeline (Context Fusion → Hybrid Retrieval → Ambiguity Check → LLM Judge)
 * - Keyword + Semantic dual-layer routing
 * - Ambiguity gap detection (ถ้าคะแนน top1-top2 < threshold → ใช้ LLM ตัดสิน)
 * - Context-aware (รวม conversation history)
 * - DB-backed keyword training (learn from usage)
 * 
 * @author INNOMCP Team
 * @date 2026-01-20
 */

import { Ollama } from 'ollama';
import { LRUCache } from 'lru-cache';
import { withDbConnection } from '../db'; // MariaDB connection helper
import { logBoth } from '../mcpLogger';
import { KEYWORD_SNAPSHOT, type KeywordSource, type SnapshotKeyword } from './keywordSnapshot';

// ========================================
// Configuration (God-Tier Settings)
// ========================================

const CONFIG = {
  OLLAMA_HOST: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
  OLLAMA_REMOTE: process.env.OLLAMA_REMOTE_URL || 'https://ollama.mdes-innova.online',
  GPU_LAYERS: 99, // Force maximum GPU offloading
  EMBED_MODEL: 'nomic-embed-text', // Vector embedding model
  LLM_JUDGE: 'gemma3:4b', // ใช้ตัด ambiguity (fast + accurate)
  LLM_HEAVY: 'deepseek-r1:32b', // สำหรับ complex cases (optional)
  
  THRESHOLDS: {
    ACCEPTABLE: 0.55, // คะแนนขั้นต่ำที่ยอมรับได้
    AMBIGUITY_GAP: 0.08, // ถ้า top1-top2 < 0.08 → ถือว่า ambiguous
    HIGH_CONFIDENCE: 0.85, // ถ้า > 0.85 → เชื่อเลย ไม่ต้องถาม LLM
  },
  
  WEIGHTS: {
    KEYWORD: 0.7, // น้ำหนักของ keyword matching
    SEMANTIC: 0.3, // น้ำหนักของ semantic similarity
    CONTEXT_HISTORY: 0.15, // น้ำหนักของ conversation history
  },
  
  CACHE: {
    MAX_SIZE: 1000,
    TTL: 1000 * 60 * 60, // 1 hour
  },
  
  DB: {
    KEYWORD_CACHE_SIZE: 500,
    KEYWORD_REFRESH_INTERVAL: 1000 * 60 * 10, // 10 minutes
    FAILURE_BACKOFF_MS: 1000 * 60, // 60 seconds
  }
};

// ========================================
// Types & Interfaces
// ========================================

export interface ToolCategory {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  embedding?: number[];
  priority?: number;
  enabled?: boolean;
}

export interface RouterResult {
  category: string;
  confidence: number;
  isAmbiguous: boolean;
  usedFallback: boolean;
  reasoning: string;
  keywordSource?: KeywordSource;
  dbOperational?: boolean;
  matchedKeywords?: string[];
  semanticScore?: number;
  keywordScore?: number;
  responseTime?: number;
  aiMode?: 'local' | 'remote' | 'hybrid';
}

export interface ContextMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface DBKeyword {
  id: number;
  keyword: string;
  category: string;
  confidence_score: number;
  priority_level: string;
}

// ========================================
// Category Definitions (เพิ่มจาก MCP tools)
// ========================================

const CATEGORIES: ToolCategory[] = [
  {
    id: 'evidence',
    name: 'Evidence Analysis (Detect)',
    description: 'ตรวจสอบสถานะเครื่อง, หลักฐานค้าง, และ Threat ล่าสุดจากระบบ Detect',
    keywords: [
      'evidence',
      'threat',
      'nip',
      'record',
      'ตรวจสอบหลักฐาน',
      'คนร้าย',
      'ภัยคุกคาม',
      'สถานะเครื่อง',
      'เครื่องออนไลน์',
      'เครื่องออฟไลน์',
      'ออนไลน์',
      'ออฟไลน์',
      'online',
      'offline',
      'server',
      'machine',
      'machines',
    ],
    priority: 1,
    enabled: true,
  },
  {
    id: 'weather',
    name: 'Weather Forecasting (NWP/TMD)',
    description: 'พยากรณ์อากาศ สภาพอากาศ รายวัน รายชั่วโมง ทั้งประเทศ',
    keywords: ['พยากรณ์', 'อากาศ', 'สภาพอากาศ', 'รายวัน', 'รายชั่วโมง', 'nwp', 'tmd', 'ฝน', 'อุณหภูมิ', 'ภูมิภาค'],
    priority: 1,
    enabled: true,
  },
  {
    id: 'nasa',
    name: 'NASA Space & Astronomy',
    description: 'ข้อมูลอวกาศ ดาราศาสตร์ ภาพจาก NASA APOD',
    keywords: ['nasa', 'อวกาศ', 'ดาว', 'ดาวเคราะห์', 'ดวงจันทร์', 'apod', 'astronomy', 'space'],
    priority: 2,
    enabled: true,
  },
  {
    id: 'worldbank',
    name: 'World Bank Economic Data',
    description: 'ข้อมูลเศรษฐกิจโลก GDP ประชากร ตัวชี้วัดประเทศ',
    keywords: ['worldbank', 'gdp', 'เศรษฐกิจ', 'ประชากร', 'รายได้', 'ธนาคารโลก', 'economic'],
    priority: 2,
    enabled: true,
  },
  {
    id: 'calculator',
    name: 'Mathematical Calculations',
    description: 'คำนวณทางคณิตศาสตร์ บวก ลบ คูณ หาร factorial ฟังก์ชันต่างๆ',
    keywords: ['คำนวณ', 'บวก', 'ลบ', 'คูณ', 'หาร', 'factorial', '!', '+', '-', '*', '/', '=', 'sqrt', 'pow'],
    priority: 3,
    enabled: true,
  },
  {
    id: 'datetime',
    name: 'Date & Time Operations',
    description: 'วันที่ เวลา ปัจจุบัน การแปลงเขตเวลา',
    keywords: ['วันนี้', 'เวลา', 'วันที่', 'ปัจจุบัน', 'timezone', 'date', 'time'],
    priority: 3,
    enabled: true,
  },
  {
    id: 'translation',
    name: 'Language Translation',
    description: 'แปลภาษา ไทย-อังกฤษ อังกฤษ-ไทย',
    keywords: ['แปล', 'translate', 'แปลภาษา', 'ภาษา', 'language'],
    priority: 2,
    enabled: true,
  },
  {
    id: 'qrcode',
    name: 'QR Code Generator',
    description: 'สร้าง QR Code จากข้อความ URL',
    keywords: ['qr', 'qrcode', 'qr code', 'สร้าง qr', 'barcode'],
    priority: 3,
    enabled: true,
  },
  {
    id: 'ocr',
    name: 'OCR Text Extraction',
    description: 'อ่านข้อความจากภาพ Optical Character Recognition',
    keywords: ['ocr', 'อ่านข้อความ', 'อ่านภาพ', 'extract text', 'text from image'],
    priority: 2,
    enabled: true,
  },
  {
    id: 'visualization',
    name: 'Data Visualization (Charts)',
    description: 'สร้างกราฟ แผนภูมิ ECharts',
    keywords: ['กราฟ', 'แผนภูมิ', 'chart', 'graph', 'plot', 'visualize', 'echarts'],
    priority: 2,
    enabled: true,
  },
  {
    id: 'files',
    name: 'File Processing (PDF/Excel/Word)',
    description: 'อ่านไฟล์ PDF Excel Word',
    keywords: ['pdf', 'excel', 'word', 'ไฟล์', 'อ่านไฟล์', 'file', 'document'],
    priority: 2,
    enabled: true,
  },
  {
    id: 'thai_knowledge',
    name: 'Thai Knowledge & Geography',
    description: 'ข้อมูลประเทศไทย จังหวัด อำเภอ ตำบล ภูมิศาสตร์ ประวัติศาสตร์ กฎหมาย วัฒนธรรม',
    keywords: ['ประเทศไทย', 'จังหวัด', 'อำเภอ', 'ตำบล', 'ภาค', 'ภูมิศาสตร์', 'ประวัติศาสตร์', 'กฎหมาย', 'ศาสนา', 'วัฒนธรรม', 'thai', 'thailand', 'province', 'geo', 'knowledge'],
    priority: 1,
    enabled: true,
  },
  {
    id: 'general',
    name: 'General Assistance',
    description: 'คำถามทั่วไป ข้อมูลทั่วไป fallback category',
    keywords: ['ช่วย', 'help', 'คือ', 'อะไร', 'what', 'how'],
    priority: 10, // lowest priority (fallback)
    enabled: true,
  },
];

// ========================================
// God-Tier Router Class
// ========================================

export class GodTierRouter {
  private ollama: Ollama;
  private ollamaRemote: Ollama;
  private cache: LRUCache<string, RouterResult>;
  private categories: ToolCategory[] = CATEGORIES.filter(c => c.enabled);
  private dbKeywords: Map<string, DBKeyword[]> = new Map(); // category -> keywords
  private lastKeywordRefresh: number = 0;
  private keywordSource: KeywordSource = 'defaults';
  private dbOperational: boolean = false;
  private dbBackoffUntil: number = 0;
  private lastDbFailureLogAt: number = 0;
  private initialized: boolean = false;
  
  constructor() {
    // Dual Ollama clients (local + remote)
    this.ollama = new Ollama({ host: CONFIG.OLLAMA_HOST });
    this.ollamaRemote = new Ollama({ host: CONFIG.OLLAMA_REMOTE });
    
    // LRU Cache สำหรับ routing results
    this.cache = new LRUCache({
      max: CONFIG.CACHE.MAX_SIZE,
      ttl: CONFIG.CACHE.TTL,
      updateAgeOnGet: true,
    });
    
    logBoth('info', '[GodTierRouter] 🎯 God-Tier Router initialized');
  }
  
  // ========================================
  // Stage 0: Initialization (Pre-calc Embeddings)
  // ========================================
  
  public async initialize(): Promise<void> {
    if (this.initialized) {
      logBoth('info', '[GodTierRouter] Already initialized, skipping...');
      return;
    }
    
    try {
      logBoth('info', '[GodTierRouter] 🚀 Initializing God-Tier Router...');
      
      // 1. Load keywords from DB
      await this.loadKeywords();
      
      // 2. Pre-calculate embeddings for all categories
      await this.precalculateEmbeddings();
      
      this.initialized = true;
      logBoth('info', `[GodTierRouter] ✅ Initialized with ${this.categories.length} categories`);
    } catch (error) {
      logBoth('error', `[GodTierRouter] ❌ Initialization failed: ${error}`);
      throw error;
    }
  }
  
  private getKeywordMode(): 'auto' | 'db' | 'snapshot' | 'defaults' {
    const raw = String(process.env.GODTIER_KEYWORDS_SOURCE || 'auto').trim().toLowerCase();
    if (raw === 'db' || raw === 'snapshot' || raw === 'defaults') return raw;
    return 'auto';
  }

  private loadKeywordsFromSnapshot(): number {
    this.dbKeywords.clear();

    const rows: DBKeyword[] = (KEYWORD_SNAPSHOT || [])
      .filter((k: SnapshotKeyword) => !!k && typeof k.keyword === 'string' && typeof k.category === 'string')
      .map((k: SnapshotKeyword, idx: number) => ({
        id: idx + 1,
        keyword: String(k.keyword),
        category: String(k.category),
        confidence_score: Number(k.confidence_score),
        priority_level: String(k.priority_level),
      }));

    for (const row of rows) {
      const existing = this.dbKeywords.get(row.category) || [];
      existing.push(row);
      this.dbKeywords.set(row.category, existing);
    }

    return rows.length;
  }

  private async loadKeywords(): Promise<void> {
    const mode = this.getKeywordMode();
    const now = Date.now();

    // Always mark refresh time so we don't spam retries on every request.
    this.lastKeywordRefresh = now;

    if (mode === 'defaults') {
      this.dbKeywords.clear();
      this.keywordSource = 'defaults';
      this.dbOperational = false;
      logBoth('info', `[GodTierRouter] 📚 Keywords source=defaults (hardcoded only)`);
      return;
    }

    if (mode === 'snapshot') {
      const count = this.loadKeywordsFromSnapshot();
      this.keywordSource = 'snapshot';
      this.dbOperational = false;
      logBoth('info', `[GodTierRouter] 📚 Keywords source=snapshot (rows=${count})`);
      return;
    }

    // mode=auto|db: try DB unless we're in backoff.
    if (now < this.dbBackoffUntil) {
      if (mode === 'db') {
        this.dbKeywords.clear();
        this.keywordSource = 'defaults';
        this.dbOperational = false;
        logBoth('warn', `[GodTierRouter] ⚠️ DB backoff active; keywords fall back to defaults (until ${new Date(this.dbBackoffUntil).toISOString()})`);
        return;
      }

      const count = this.loadKeywordsFromSnapshot();
      this.keywordSource = 'snapshot';
      this.dbOperational = false;
      logBoth('warn', `[GodTierRouter] ⚠️ DB backoff active; keywords fall back to snapshot (rows=${count})`);
      return;
    }

    try {
      this.dbKeywords.clear();

      const rows = await withDbConnection(async (conn) => {
        const [result] = await conn.query<any[]>(`
          SELECT id, keyword, category, confidence_score, priority_level
          FROM keyword_training
          WHERE confidence_score >= 0.7
          ORDER BY priority_level, confidence_score DESC
        `);
        return result;
      });

      rows.forEach((row: DBKeyword) => {
        const existing = this.dbKeywords.get(row.category) || [];
        existing.push(row);
        this.dbKeywords.set(row.category, existing);
      });

      this.keywordSource = 'db';
      this.dbOperational = true;
      logBoth('info', `[GodTierRouter] 📚 Keywords source=db (rows=${rows.length})`);
      return;
    } catch (error) {
      this.dbOperational = false;
      this.dbBackoffUntil = Date.now() + CONFIG.DB.FAILURE_BACKOFF_MS;
      const nowTs = Date.now();
      const errCode = String((error as any)?.code || 'DB_ERROR');
      const errMsg = String((error as any)?.message || error || 'unknown').replace(/\s+/g, ' ').slice(0, 180);
      if (nowTs - this.lastDbFailureLogAt > 15000) {
        this.lastDbFailureLogAt = nowTs;
        logBoth('warn', `[GodTierRouter] ⚠️ DB keyword load failed code=${errCode}; fallback mode active (backoff=${CONFIG.DB.FAILURE_BACKOFF_MS}ms)`);
        logBoth('warn', `[GodTierRouter] ⚠️ DB error summary: ${errMsg}`);
      }

      if (mode === 'db') {
        this.dbKeywords.clear();
        this.keywordSource = 'defaults';
        this.dbOperational = false;
        logBoth('warn', `[GodTierRouter] ⚠️ Keywords fall back to defaults (db-only mode)`);
        return;
      }

      const count = this.loadKeywordsFromSnapshot();
      if (count > 0) {
        this.keywordSource = 'snapshot';
        this.dbOperational = false;
        logBoth('warn', `[GodTierRouter] ⚠️ Keywords fall back to snapshot (rows=${count})`);
      } else {
        this.dbKeywords.clear();
        this.keywordSource = 'defaults';
        this.dbOperational = false;
        logBoth('warn', `[GodTierRouter] ⚠️ Snapshot empty; keywords fall back to defaults`);
      }
    }
  }
  
  private async precalculateEmbeddings(): Promise<void> {
    const promises = this.categories.map(async (cat) => {
      try {
        const fullText = `${cat.name}. ${cat.description}. Keywords: ${cat.keywords.join(', ')}`;
        const response = await this.ollama.embeddings({
          model: CONFIG.EMBED_MODEL,
          prompt: fullText,
        });
        cat.embedding = response.embedding;
      } catch (error) {
        logBoth('warn', `[GodTierRouter] ⚠️ Embedding failed for ${cat.id}: ${error}`);
      }
    });
    
    await Promise.all(promises);
    const successCount = this.categories.filter(c => c.embedding).length;
    logBoth('info', `[GodTierRouter] 🎯 Pre-calculated ${successCount}/${this.categories.length} embeddings`);
  }
  
  // ========================================
  // Stage 1: Context Fusion (เอา history มาร่วม)
  // ========================================
  
  private mergeContext(
    query: string,
    history: ContextMessage[] = []
  ): string {
    if (history.length === 0) return query;
    
    // เอา 2 ข้อความล่าสุดมาเป็น context
    const recentHistory = history.slice(-2);
    const contextStrings = recentHistory.map(
      msg => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}`
    );
    
    return `Context: ${contextStrings.join(' | ')} | Current Query: ${query}`;
  }
  
  // ========================================
  // Stage 2: Hybrid Retrieval (Keyword + Semantic)
  // ========================================
  
  private async hybridRetrieval(
    query: string,
    fullQuery: string
  ): Promise<{ category: string; score: number; reasoning: string }[]> {
    // 2.1 Keyword Matching (Fast Path)
    const keywordResults = this.keywordMatch(query);
    
    // 2.2 Semantic Matching (Deep Understanding)
    const semanticResults = await this.semanticMatch(fullQuery);
    
    // 2.3 Merge Results (Weighted Average)
    const merged = this.mergeScores(keywordResults, semanticResults);
    
    return merged.sort((a, b) => b.score - a.score);
  }
  
  private keywordMatch(query: string): Map<string, { score: number; matched: string[] }> {
    const queryLower = query.toLowerCase();
    const results = new Map<string, { score: number; matched: string[] }>();
    
    logBoth('info', `[GodTierRouter] 🔍 Keyword matching for: "${query}"`);
    logBoth('info', `[GodTierRouter] 📚 DB keywords loaded: ${Array.from(this.dbKeywords.entries()).map(([k, v]) => `${k}=${v.length}`).join(', ')}`);
    
    for (const cat of this.categories) {
      let score = 0;
      const matched: string[] = [];
      
      // Check hardcoded keywords
      for (const kw of cat.keywords) {
        if (queryLower.includes(kw.toLowerCase())) {
          score += 1;
          matched.push(kw);
        }
      }
      
      // Check DB keywords (with confidence weighting)
      const dbKws = this.dbKeywords.get(cat.id) || [];
      logBoth('info', `[GodTierRouter] 🔎 Checking category "${cat.id}": ${dbKws.length} DB keywords available`);
      for (const dbKw of dbKws) {
        if (queryLower.includes(dbKw.keyword.toLowerCase())) {
          const conf = Number(dbKw.confidence_score); // ✅ บังคับเป็น number
          const safeConf = Number.isFinite(conf) ? conf : 0;

          score += safeConf;
          matched.push(dbKw.keyword);
          // score += dbKw.confidence_score;
          // matched.push(dbKw.keyword);
          logBoth('info', `[GodTierRouter] ✅ Match! "${dbKw.keyword}" in query (score +${dbKw.confidence_score})`);
        }
      }
      
      if (score > 0) {
        results.set(cat.id, { score, matched });
        logBoth('info', `[GodTierRouter] 📊 ${cat.id}: score=${score.toFixed(2)}, matched=[${matched.join(', ')}]`);
      }
    }
    
    return results;
  }
  
  private async semanticMatch(fullQuery: string): Promise<Map<string, number>> {
    const results = new Map<string, number>();
    
    try {
      const response = await this.ollama.embeddings({
        model: CONFIG.EMBED_MODEL,
        prompt: fullQuery,
        options: { num_gpu_layers: CONFIG.GPU_LAYERS } as any,
      });
      const queryVector = response.embedding;
      
      for (const cat of this.categories) {
        if (cat.embedding) {
          const similarity = this.cosineSimilarity(queryVector, cat.embedding);
          results.set(cat.id, similarity);
        }
      }
    } catch (error) {
      logBoth('warn', `[GodTierRouter] ⚠️ Semantic matching failed: ${error}`);
    }
    
    return results;
  }
  
  private mergeScores(
    keywordResults: Map<string, { score: number; matched: string[] }>,
    semanticResults: Map<string, number>
  ): { category: string; score: number; reasoning: string }[] {
    const merged: { category: string; score: number; reasoning: string }[] = [];
    
    const allCategories = new Set([
      ...Array.from(keywordResults.keys()),
      ...Array.from(semanticResults.keys()),
    ]);
    
    for (const catId of allCategories) {
      const kwData = keywordResults.get(catId);
      const semScore = semanticResults.get(catId) || 0;
      const kwScore = kwData ? kwData.score / 5 : 0; // normalize keyword score
      
      const finalScore =
        kwScore * CONFIG.WEIGHTS.KEYWORD +
        semScore * CONFIG.WEIGHTS.SEMANTIC;
      
      const reasoning = kwData
        ? `Keyword match: ${kwData.matched.join(', ')} | Semantic: ${(semScore * 100).toFixed(1)}%`
        : `Semantic: ${(semScore * 100).toFixed(1)}%`;
      
      merged.push({ category: catId, score: finalScore, reasoning });
    }
    
    return merged;
  }
  
  // ========================================
  // Stage 3: Ambiguity Check (ตรวจสอบความชัดเจน)
  // ========================================
  
  private checkAmbiguity(
    top1: { category: string; score: number },
    top2: { category: string; score: number } | undefined
  ): boolean {
    if (!top2) return false; // มีตัวเลือกเดียว ไม่ ambiguous
    
    const gap = top1.score - top2.score;
    return gap < CONFIG.THRESHOLDS.AMBIGUITY_GAP;
  }
  
  // ========================================
  // Stage 4: LLM Judge (ตัดสินเมื่อไม่แน่ใจ)
  // ========================================
  
  private async llmJudge(
    query: string,
    top1: { category: string; score: number },
    top2: { category: string; score: number }
  ): Promise<{ category: string; reasoning: string }> {
    try {
      const cat1 = this.categories.find(c => c.id === top1.category);
      const cat2 = this.categories.find(c => c.id === top2.category);
      
      const judgePrompt = `
คำถามของผู้ใช้: "${query}"

เครื่องมือที่เลือกได้ 2 ตัว:
A. ${cat1?.name} (${(top1.score * 100).toFixed(1)}%) - ${cat1?.description}
B. ${cat2?.name} (${(top2.score * 100).toFixed(1)}%) - ${cat2?.description}

โปรดเลือกเครื่องมือที่เหมาะสมที่สุด โดยตอบแค่ "A" หรือ "B" พร้อมเหตุผลสั้นๆ 1 บรรทัด
รูปแบบ: "A เพราะ..." หรือ "B เพราะ..."
`.trim();
      
      const judgeStart = Date.now();
      const response = await this.ollama.chat({
        model: CONFIG.LLM_JUDGE,
        messages: [{ role: 'user', content: judgePrompt }],
        options: { temperature: 0, num_predict: 100, num_gpu_layers: CONFIG.GPU_LAYERS } as any,
      });
      const judgeTime = Date.now() - judgeStart;
      
      const answer = response.message.content.trim();
      const chosenCategory = answer.startsWith('A') ? top1.category : top2.category;
      
      logBoth('info', `[GodTierRouter] 🤔 LLM Judge decision (${judgeTime}ms): ${answer}`);
      
      return { category: chosenCategory, reasoning: `LLM Judge: ${answer}` };
    } catch (error) {
      logBoth('error', `[GodTierRouter] ❌ LLM Judge failed: ${error}`);
      return { category: top1.category, reasoning: 'Judge failed, using Top 1' };
    }
  }
  
  // ========================================
  // Main Routing Method
  // ========================================
  
  public async route(
    userQuery: string,
    history: ContextMessage[] = [],
    aiMode: 'local' | 'remote' | 'hybrid' = 'remote'
  ): Promise<RouterResult> {
    const startTime = Date.now();
    
    try {
      // Ensure initialized
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Refresh keywords if needed
      if (Date.now() - this.lastKeywordRefresh > CONFIG.DB.KEYWORD_REFRESH_INTERVAL) {
        await this.loadKeywords();
      }
      
      // Stage 1: Context Fusion
      const fullQuery = this.mergeContext(userQuery, history);
      
      // Check cache
      const cacheKey = `${userQuery}:${history.length}`;
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey)!;
        logBoth('info', `[GodTierRouter] 💾 Cache hit: ${cached.category}`);
        return cached;
      }
      
      // Stage 2: Hybrid Retrieval
      const scoredResults = await this.hybridRetrieval(userQuery, fullQuery);
      
      if (scoredResults.length === 0) {
        return this.fallbackResult('general', 'No matches found', startTime);
      }
      
      const top1 = scoredResults[0];
      const top2 = scoredResults[1];
      
      // High confidence → immediate return
      if (top1.score >= CONFIG.THRESHOLDS.HIGH_CONFIDENCE) {
        return this.buildResult(top1.category, top1.score, false, false, top1.reasoning, startTime, aiMode);
      }
      
      // Low confidence → fallback
      if (top1.score < CONFIG.THRESHOLDS.ACCEPTABLE) {
        return this.fallbackResult('general', 'Low confidence', startTime);
      }
      
      // Stage 3: Ambiguity Check
      const isAmbiguous = this.checkAmbiguity(top1, top2);
      
      if (isAmbiguous && top2) {
        logBoth('warn', `[GodTierRouter] 🤔 Ambiguous: ${top1.category} (${top1.score.toFixed(2)}) vs ${top2.category} (${top2.score.toFixed(2)})`);
        
        // Stage 4: LLM Judge
        const judgeResult = await this.llmJudge(userQuery, top1, top2);
        
        // Log ambiguity case to DB
        this.logAmbiguityCase(userQuery, top1, top2, judgeResult.category);
        
        return this.buildResult(
          judgeResult.category,
          top1.score,
          true,
          true,
          judgeResult.reasoning,
          startTime,
          aiMode
        );
      }
      
      // Normal case: clear winner
      const result = this.buildResult(
        top1.category,
        top1.score,
        false,
        false,
        top1.reasoning,
        startTime,
        aiMode
      );
      
      // Cache result
      this.cache.set(cacheKey, result);
      
      // Log to DB
      this.logQuery(userQuery, top1.category, aiMode, Date.now() - startTime, true);
      
      return result;
      
    } catch (error) {
      logBoth('error', `[GodTierRouter] ❌ Routing failed: ${error}`);
      return this.fallbackResult('general', `Error: ${error}`, startTime);
    }
  }
  
  // ========================================
  // Helper Methods
  // ========================================
  
  private buildResult(
    category: string,
    confidence: number,
    isAmbiguous: boolean,
    usedFallback: boolean,
    reasoning: string,
    startTime: number,
    aiMode: 'local' | 'remote' | 'hybrid'
  ): RouterResult {
    const responseTime = Date.now() - startTime;
    
    return {
      category,
      confidence,
      isAmbiguous,
      usedFallback,
      reasoning,
      keywordSource: this.keywordSource,
      dbOperational: this.dbOperational,
      responseTime,
      aiMode,
    };
  }
  
  private fallbackResult(
    category: string,
    reason: string,
    startTime: number
  ): RouterResult {
    return {
      category,
      confidence: 0.5,
      isAmbiguous: false,
      usedFallback: true,
      reasoning: reason,
      keywordSource: this.keywordSource,
      dbOperational: this.dbOperational,
      responseTime: Date.now() - startTime,
    };
  }
  
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magA * magB);
  }
  
  // ========================================
  // DB Logging Methods
  // ========================================
  
  private async logQuery(
    query: string,
    category: string,
    aiMode: string,
    responseTime: number,
    success: boolean
  ): Promise<void> {
    if (!this.dbOperational) {
      return;
    }
    try {
      await withDbConnection(async (conn) => {
        await conn.query(
          `INSERT INTO query_logs (query_text, detected_category, ai_mode, response_time_ms, success)
           VALUES (?, ?, ?, ?, ?)`,
          [query, category, aiMode, responseTime, success]
        );
      });
    } catch (error) {
      this.dbOperational = false;
      this.dbBackoffUntil = Date.now() + CONFIG.DB.FAILURE_BACKOFF_MS;
      logBoth('warn', `[GodTierRouter] ⚠️ Query log failed: ${error}`);
    }
  }
  
  private async logAmbiguityCase(
    query: string,
    top1: { category: string; score: number },
    top2: { category: string; score: number },
    decision: string
  ): Promise<void> {
    if (!this.dbOperational) {
      return;
    }
    try {
      await withDbConnection(async (conn) => {
        const [result] = await conn.query<any>(
          `INSERT INTO query_logs (query_text, detected_category, ai_mode, success)
           VALUES (?, ?, 'remote', TRUE)`,
          [query, decision]
        );
        const queryLogId = result.insertId;
        
        const gap = top1.score - top2.score;
        
        await conn.query(
          `INSERT INTO ambiguity_cases (query_log_id, top1_category, top1_score, top2_category, top2_score, score_gap, llm_judge_decision)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [queryLogId, top1.category, top1.score, top2.category, top2.score, gap, decision]
        );
      });
    } catch (error) {
      this.dbOperational = false;
      this.dbBackoffUntil = Date.now() + CONFIG.DB.FAILURE_BACKOFF_MS;
      logBoth('warn', `[GodTierRouter] ⚠️ Ambiguity log failed: ${error}`);
    }
  }
}

// ========================================
// Singleton Export
// ========================================

let routerInstance: GodTierRouter | null = null;

export function getGodTierRouter(): GodTierRouter {
  if (!routerInstance) {
    routerInstance = new GodTierRouter();
  }
  return routerInstance;
}

// Trigger restart

// Trigger restart: 2026-01-20 15:19:47

// Trigger restart for debug: 16:40:57

// Trigger DB reload: 16:56:56
