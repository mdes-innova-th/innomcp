/**
 * DB-Backed Phrases Cache
 * Loads FastPath phrases from MariaDB, caches in Redis (60s TTL)
 * Fallback to in-memory if Redis unavailable
 */

import mysql from 'mysql2/promise';
import { redisClient } from '../utils/redis';
import logger from '../utils/logger';

const CACHE_KEY = 'fastpath:phrases:v1';
const CACHE_TTL = 60; // seconds

// In-memory fallback cache
let inMemoryCache: Record<string, string[]> | null = null;
let inMemoryCacheExpiry: number = 0;

export interface PhraseDictionary {
  [category: string]: string[];
}

/**
 * Get phrases from DB with Redis cache
 */
export async function getDbBackedPhrases(): Promise<PhraseDictionary> {
  // Try Redis first
  try {
    if (redisClient) {
      const cached = await redisClient.get(CACHE_KEY);
      if (cached) {
        logger.debug('[DB Phrases] Cache hit (Redis)');
        return JSON.parse(cached);
      }
    }
  } catch (err) {
    logger.warn('[DB Phrases] Redis get failed', { error: String(err) });
  }

  // Check in-memory cache
  const now = Date.now();
  if (inMemoryCache && inMemoryCacheExpiry > now) {
    logger.debug('[DB Phrases] Cache hit (in-memory)');
    return inMemoryCache;
  }

  // Load from database
  logger.info('[DB Phrases] Loading from database');
  const phrases = await loadPhrasesFromDb();

  // Cache in Redis
  try {
    if (redisClient) {
      await redisClient.set(CACHE_KEY, JSON.stringify(phrases), 'EX', CACHE_TTL);
      logger.debug('[DB Phrases] Cached in Redis', { ttl: CACHE_TTL });
    }
  } catch (err) {
    logger.warn('[DB Phrases] Redis set failed', { error: String(err) });
  }

  // Cache in-memory as fallback
  inMemoryCache = phrases;
  inMemoryCacheExpiry = now + (CACHE_TTL * 1000);

  return phrases;
}

/**
 * Load phrases from MariaDB
 */
async function loadPhrasesFromDb(): Promise<PhraseDictionary> {
  const dbUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;
  
  if (!dbUrl) {
    logger.warn('[DB Phrases] No database URL configured, returning empty dictionary');
    return {};
  }

  let conn: mysql.Connection | null = null;
  
  try {
    conn = await mysql.createConnection(dbUrl);
    
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT category, phrase, lang 
       FROM fastpath_phrases 
       WHERE enabled = 1 
       ORDER BY category, phrase`
    );

    const map: PhraseDictionary = {};
    let count = 0;

    for (const row of rows) {
      const cat = String(row.category || '').trim();
      const phrase = String(row.phrase || '').trim().toLowerCase();
      
      if (!cat || !phrase) continue;

      if (!map[cat]) {
        map[cat] = [];
      }
      
      map[cat].push(phrase);
      count++;
    }

    logger.info('[DB Phrases] Loaded from database', { 
      categories: Object.keys(map).length,
      totalPhrases: count 
    });

    return map;

  } catch (err: any) {
    logger.error('[DB Phrases] Database load failed', { 
      error: err.message,
      code: err.code 
    });
    return {};
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}

/**
 * Merge hardcoded and DB-backed phrases
 * DB phrases override hardcoded ones with same key
 */
export function mergeDictionaries(
  hardcoded: PhraseDictionary,
  dbPhrases: PhraseDictionary
): PhraseDictionary {
  const merged: PhraseDictionary = { ...hardcoded };

  for (const [category, phrases] of Object.entries(dbPhrases)) {
    if (!merged[category]) {
      merged[category] = [];
    }
    
    // Add DB phrases, avoiding duplicates
    for (const phrase of phrases) {
      const normalized = phrase.toLowerCase().trim();
      if (!merged[category].some(p => p.toLowerCase().trim() === normalized)) {
        merged[category].push(phrase);
      }
    }
  }

  return merged;
}

/**
 * Clear cache (for testing or manual refresh)
 */
export async function clearPhrasesCache(): Promise<void> {
  try {
    if (redisClient) {
      await redisClient.del(CACHE_KEY);
      logger.info('[DB Phrases] Cache cleared (Redis)');
    }
  } catch (err) {
    logger.warn('[DB Phrases] Redis del failed', { error: String(err) });
  }

  inMemoryCache = null;
  inMemoryCacheExpiry = 0;
  logger.info('[DB Phrases] Cache cleared (in-memory)');
}

/**
 * Refresh phrases cache immediately
 */
export async function refreshPhrasesCache(): Promise<PhraseDictionary> {
  await clearPhrasesCache();
  return await getDbBackedPhrases();
}
