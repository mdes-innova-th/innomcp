/**
 * Search Optimization Module
 * à¸›à¸£à¸±à¸šà¸›à¸£à¸¸à¸‡ search performance à¹à¸¥à¸° relevance
 * 
 * Features:
 * - Query expansion
 * - Result ranking
 * - Search cache
 * - Relevance scoring
 * 
 * @module utils/searchOptimization
 */

import { logBoth } from '../mcpLogger';

/**
 * Search Query Expansion
 */
export interface ExpandedQuery {
  original: string;
  expanded: string[];
  synonyms: string[];
  relatedTerms: string[];
}

/**
 * Search Result with Score
 */
export interface ScoredResult {
  title: string;
  url: string;
  snippet: string;
  score: number;
  relevanceFactors: {
    titleMatch: number;
    contentMatch: number;
    freshness: number;
    authority: number;
  };
}

/**
 * Query Optimizer
 */
class SearchOptimizer {
  private queryCache: Map<string, ExpandedQuery> = new Map();
  private thaiSynonyms: Map<string, string[]> = new Map([
    ['à¸­à¸²à¸à¸²à¸¨', ['à¸ªà¸ à¸²à¸žà¸­à¸²à¸à¸²à¸¨', 'à¸­à¸²à¸à¸²à¸¨', 'à¸ à¸¹à¸¡à¸´à¸­à¸²à¸à¸²à¸¨', 'à¸ªà¸ à¸²à¸žà¸­à¸²à¸à¸²à¸¨']],
    ['à¸à¸™', ['à¸à¸™à¸•à¸', 'à¸à¸™', 'à¸à¸™à¸Ÿà¹‰à¸²à¸„à¸°à¸™à¸­à¸‡', 'à¸›à¸£à¸´à¸¡à¸²à¸“à¸à¸™']],
    ['à¸£à¹‰à¸­à¸™', ['à¸­à¸²à¸à¸²à¸¨à¸£à¹‰à¸­à¸™', 'à¸£à¹‰à¸­à¸™', 'à¸­à¸¸à¸“à¸«à¸ à¸¹à¸¡à¸´à¸ªà¸¹à¸‡']],
    ['à¸«à¸™à¸²à¸§', ['à¸­à¸²à¸à¸²à¸¨à¸«à¸™à¸²à¸§', 'à¸«à¸™à¸²à¸§', 'à¸­à¸¸à¸“à¸«à¸ à¸¹à¸¡à¸´à¸•à¹ˆà¸³']],
    ['à¸à¸£à¸¸à¸‡à¹€à¸—à¸ž', ['à¸à¸£à¸¸à¸‡à¹€à¸—à¸žà¸¡à¸«à¸²à¸™à¸„à¸£', 'à¸à¸—à¸¡.', 'Bangkok']],
    ['à¹€à¸Šà¸µà¸¢à¸‡à¹ƒà¸«à¸¡à¹ˆ', ['à¸ˆ.à¹€à¸Šà¸µà¸¢à¸‡à¹ƒà¸«à¸¡à¹ˆ', 'Chiang Mai']],
  ]);

  /**
   * Expand query with synonyms
   */
  expandQuery(query: string): ExpandedQuery {
    // Check cache
    const cached = this.queryCache.get(query);
    if (cached) {
      return cached;
    }

    const words = query.split(/\s+/);
    const expanded: string[] = [query];
    const synonyms: string[] = [];
    const relatedTerms: string[] = [];

    // Find synonyms for each word
    for (const word of words) {
      const wordSynonyms = this.thaiSynonyms.get(word);
      if (wordSynonyms) {
        synonyms.push(...wordSynonyms);
        
        // Generate expanded queries
        for (const synonym of wordSynonyms) {
          if (synonym !== word) {
            const expandedQuery = query.replace(word, synonym);
            if (!expanded.includes(expandedQuery)) {
              expanded.push(expandedQuery);
            }
          }
        }
      }
    }

    // Add related terms based on context
    if (/à¸­à¸²à¸à¸²à¸¨|à¸à¸™|à¸£à¹‰à¸­à¸™|à¸«à¸™à¸²à¸§/.test(query)) {
      relatedTerms.push('à¸žà¸¢à¸²à¸à¸£à¸“à¹Œà¸­à¸²à¸à¸²à¸¨', 'à¸­à¸¸à¸“à¸«à¸ à¸¹à¸¡à¸´', 'à¸„à¸§à¸²à¸¡à¸Šà¸·à¹‰à¸™');
    }

    const result: ExpandedQuery = {
      original: query,
      expanded,
      synonyms,
      relatedTerms
    };

    // Cache result
    this.queryCache.set(query, result);
    return result;
  }

  /**
   * Score search results by relevance
   */
  scoreResults(results: any[], query: string): ScoredResult[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);

    return results.map(result => {
      const titleLower = (result.title || '').toLowerCase();
      const snippetLower = (result.snippet || '').toLowerCase();

      // Title match score (0-40)
      let titleMatch = 0;
      for (const word of queryWords) {
        if (titleLower.includes(word)) {
          titleMatch += 10;
        }
      }
      titleMatch = Math.min(titleMatch, 40);

      // Content match score (0-30)
      let contentMatch = 0;
      for (const word of queryWords) {
        const count = (snippetLower.match(new RegExp(word, 'g')) || []).length;
        contentMatch += count * 5;
      }
      contentMatch = Math.min(contentMatch, 30);

      // Freshness score (0-15)
      let freshness = 10; // Default medium freshness
      if (result.publishedAt) {
        const daysAgo = (Date.now() - new Date(result.publishedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysAgo < 7) freshness = 15;
        else if (daysAgo < 30) freshness = 10;
        else freshness = 5;
      }

      // Authority score (0-15)
      let authority = 5; // Default low authority
      const domain = result.domain || '';
      if (/\.go\.th|\.ac\.th/.test(domain)) {
        authority = 15; // Government/edu domains
      } else if (/wikipedia|bbc|reuters|thairath|nationtv/.test(domain)) {
        authority = 10; // Well-known sources
      }

      const totalScore = titleMatch + contentMatch + freshness + authority;

      return {
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        score: totalScore,
        relevanceFactors: {
          titleMatch,
          contentMatch,
          freshness,
          authority
        }
      };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Filter low-quality results
   */
  filterResults(scoredResults: ScoredResult[], minScore: number = 20): ScoredResult[] {
    return scoredResults.filter(r => r.score >= minScore);
  }

  /**
   * Deduplicate results by URL
   */
  deduplicateResults(results: ScoredResult[]): ScoredResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      const url = result.url.toLowerCase();
      if (seen.has(url)) {
        return false;
      }
      seen.add(url);
      return true;
    });
  }

  /**
   * Get search suggestions
   */
  getSuggestions(partialQuery: string): string[] {
    const suggestions: string[] = [];
    const lowerQuery = partialQuery.toLowerCase();

    // Check synonyms map
    for (const [word, synonyms] of this.thaiSynonyms) {
      if (word.startsWith(lowerQuery)) {
        suggestions.push(word);
      }
      for (const synonym of synonyms) {
        if (synonym.toLowerCase().startsWith(lowerQuery)) {
          suggestions.push(synonym);
        }
      }
    }

    return [...new Set(suggestions)].slice(0, 5);
  }

  /**
   * Optimize search strategy
   */
  optimizeSearchStrategy(query: string): {
    useCache: boolean;
    topK: number;
    timeout: number;
  } {
    const words = query.split(/\s+/).length;
    
    return {
      useCache: words <= 3, // Cache simple queries
      topK: words > 5 ? 10 : 5, // More results for complex queries
      timeout: words > 5 ? 10000 : 5000 // Longer timeout for complex queries
    };
  }
}

// Export singleton instance
export const searchOptimizer = new SearchOptimizer();

/**
 * Helper: Expand query
 */
export function expandSearchQuery(query: string): ExpandedQuery {
  return searchOptimizer.expandQuery(query);
}

/**
 * Helper: Score results
 */
export function scoreSearchResults(results: any[], query: string): ScoredResult[] {
  return searchOptimizer.scoreResults(results, query);
}

/**
 * Helper: Filter low-quality results
 */
export function filterLowQualityResults(scoredResults: ScoredResult[], minScore?: number): ScoredResult[] {
  return searchOptimizer.filterResults(scoredResults, minScore);
}

/**
 * Helper: Get suggestions
 */
export function getSearchSuggestions(partialQuery: string): string[] {
  return searchOptimizer.getSuggestions(partialQuery);
}
