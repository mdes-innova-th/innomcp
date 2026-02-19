/**
 * Context Memory System
 * à¸ˆà¸³à¸šà¸£à¸´à¸šà¸—à¸à¸²à¸£à¸ªà¸™à¸—à¸™à¸²à¹à¸¥à¸°à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸œà¸¹à¹‰à¹ƒà¸Šà¹‰
 * 
 * Features:
 * - Conversation history
 * - User preferences
 * - Location memory
 * - Session management
 * 
 * @module utils/context
 */

import { logBoth } from '../mcpLogger';

/**
 * Message in conversation
 */
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * User Preferences
 */
export interface UserPreferences {
  language?: 'th' | 'en';
  location?: string;
  timezone?: string;
  units?: 'metric' | 'imperial';
  notifications?: boolean;
}

/**
 * Conversation Context
 */
export interface ConversationContext {
  sessionId: string;
  userId?: string;
  messages: Message[];
  preferences: UserPreferences;
  metadata: Record<string, any>;
  createdAt: Date;
  lastActivityAt: Date;
}

/**
 * Context Memory Manager
 */
class ContextMemoryManager {
  private contexts: Map<string, ConversationContext> = new Map();
  private maxMessages = 50; // Max messages per session
  private sessionTimeout = 3600000; // 1 hour in ms

  /**
   * Create new session
   */
  createSession(sessionId: string, userId?: string): ConversationContext {
    const context: ConversationContext = {
      sessionId,
      userId,
      messages: [],
      preferences: {},
      metadata: {},
      createdAt: new Date(),
      lastActivityAt: new Date()
    };

    this.contexts.set(sessionId, context);
    logBoth('info', `[Context] Session created: ${sessionId}`);
    return context;
  }

  /**
   * Get session context
   */
  getSession(sessionId: string): ConversationContext | undefined {
    const context = this.contexts.get(sessionId);
    
    if (!context) {
      return undefined;
    }

    // Check session timeout
    const now = new Date().getTime();
    const lastActivity = context.lastActivityAt.getTime();
    
    if (now - lastActivity > this.sessionTimeout) {
      this.contexts.delete(sessionId);
      logBoth('info', `[Context] Session expired: ${sessionId}`);
      return undefined;
    }

    return context;
  }

  /**
   * Get or create session
   */
  getOrCreateSession(sessionId: string, userId?: string): ConversationContext {
    let context = this.getSession(sessionId);
    
    if (!context) {
      context = this.createSession(sessionId, userId);
    }

    return context;
  }

  /**
   * Add message to conversation
   */
  addMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, any>
  ): void {
    const context = this.getOrCreateSession(sessionId);

    const message: Message = {
      role,
      content,
      timestamp: new Date(),
      metadata
    };

    context.messages.push(message);
    context.lastActivityAt = new Date();

    // Trim old messages if needed
    if (context.messages.length > this.maxMessages) {
      const removed = context.messages.length - this.maxMessages;
      context.messages = context.messages.slice(removed);
      logBoth('info', `[Context] Trimmed ${removed} old messages from session ${sessionId}`);
    }
  }

  /**
   * Get conversation history
   */
  getHistory(sessionId: string, limit?: number): Message[] {
    const context = this.getSession(sessionId);
    
    if (!context) {
      return [];
    }

    if (limit) {
      return context.messages.slice(-limit);
    }

    return context.messages;
  }

  /**
   * Get recent user queries
   */
  getRecentQueries(sessionId: string, limit: number = 5): string[] {
    const context = this.getSession(sessionId);
    
    if (!context) {
      return [];
    }

    return context.messages
      .filter(m => m.role === 'user')
      .slice(-limit)
      .map(m => m.content);
  }

  /**
   * Update user preferences
   */
  updatePreferences(sessionId: string, preferences: Partial<UserPreferences>): void {
    const context = this.getOrCreateSession(sessionId);
    context.preferences = { ...context.preferences, ...preferences };
    context.lastActivityAt = new Date();
    
    logBoth('info', `[Context] Preferences updated for session ${sessionId}`);
  }

  /**
   * Get user preferences
   */
  getPreferences(sessionId: string): UserPreferences {
    const context = this.getSession(sessionId);
    return context?.preferences || {};
  }

  /**
   * Set metadata
   */
  setMetadata(sessionId: string, key: string, value: any): void {
    const context = this.getOrCreateSession(sessionId);
    context.metadata[key] = value;
    context.lastActivityAt = new Date();
  }

  /**
   * Get metadata
   */
  getMetadata(sessionId: string, key: string): any {
    const context = this.getSession(sessionId);
    return context?.metadata[key];
  }

  /**
   * Remember location
   */
  rememberLocation(sessionId: string, location: string): void {
    this.updatePreferences(sessionId, { location });
    logBoth('info', `[Context] Location remembered: ${location} for session ${sessionId}`);
  }

  /**
   * Get remembered location
   */
  getLocation(sessionId: string): string | undefined {
    return this.getPreferences(sessionId).location;
  }

  /**
   * Clear session
   */
  clearSession(sessionId: string): void {
    this.contexts.delete(sessionId);
    logBoth('info', `[Context] Session cleared: ${sessionId}`);
  }

  /**
   * Get active sessions count
   */
  getActiveSessionsCount(): number {
    // Clean up expired sessions first
    const now = new Date().getTime();
    
    for (const [sessionId, context] of this.contexts) {
      const lastActivity = context.lastActivityAt.getTime();
      if (now - lastActivity > this.sessionTimeout) {
        this.contexts.delete(sessionId);
      }
    }

    return this.contexts.size;
  }

  /**
   * Get session summary
   */
  getSessionSummary(sessionId: string): string {
    const context = this.getSession(sessionId);
    
    if (!context) {
      return 'Session not found';
    }

    const userMessages = context.messages.filter(m => m.role === 'user').length;
    const assistantMessages = context.messages.filter(m => m.role === 'assistant').length;
    const duration = new Date().getTime() - context.createdAt.getTime();
    const durationMin = Math.floor(duration / 60000);

    return `
Session: ${sessionId}
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
Duration: ${durationMin} minutes
Messages: ${context.messages.length} (User: ${userMessages}, Assistant: ${assistantMessages})
Last Activity: ${context.lastActivityAt.toLocaleString('th-TH')}
Location: ${context.preferences.location || 'Not set'}
Language: ${context.preferences.language || 'Not set'}
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
    `.trim();
  }

  /**
   * Extract context for AI
   */
  getContextForAI(sessionId: string): string {
    const context = this.getSession(sessionId);
    
    if (!context) {
      return 'No previous context';
    }

    const recentMessages = this.getHistory(sessionId, 10);
    const location = context.preferences.location;
    const language = context.preferences.language;

    let contextText = '';

    if (location) {
      contextText += `User's location: ${location}\n`;
    }

    if (language) {
      contextText += `Preferred language: ${language}\n`;
    }

    if (recentMessages.length > 0) {
      contextText += '\nRecent conversation:\n';
      for (const msg of recentMessages) {
        contextText += `${msg.role}: ${msg.content}\n`;
      }
    }

    return contextText.trim();
  }

  /**
   * Check if user asked similar question recently
   */
  hasSimilarRecentQuery(sessionId: string, query: string, threshold: number = 0.7): boolean {
    const recentQueries = this.getRecentQueries(sessionId, 5);
    
    if (recentQueries.length === 0) {
      return false;
    }

    const normalizedQuery = query.toLowerCase().trim();

    for (const pastQuery of recentQueries) {
      const normalizedPast = pastQuery.toLowerCase().trim();
      
      // Simple similarity check: if 70% of words match
      const queryWords = normalizedQuery.split(/\s+/);
      const pastWords = normalizedPast.split(/\s+/);
      
      const matchCount = queryWords.filter(word => 
        pastWords.includes(word)
      ).length;
      
      const similarity = matchCount / Math.max(queryWords.length, pastWords.length);
      
      if (similarity >= threshold) {
        return true;
      }
    }

    return false;
  }
}

// Export singleton instance
export const contextMemory = new ContextMemoryManager();

/**
 * Helper: Add user message
 */
export function addUserMessage(sessionId: string, content: string, metadata?: Record<string, any>): void {
  contextMemory.addMessage(sessionId, 'user', content, metadata);
}

/**
 * Helper: Add assistant message
 */
export function addAssistantMessage(sessionId: string, content: string, metadata?: Record<string, any>): void {
  contextMemory.addMessage(sessionId, 'assistant', content, metadata);
}

/**
 * Helper: Get conversation history
 */
export function getConversationHistory(sessionId: string, limit?: number): Message[] {
  return contextMemory.getHistory(sessionId, limit);
}

/**
 * Helper: Remember location
 */
export function rememberLocation(sessionId: string, location: string): void {
  contextMemory.rememberLocation(sessionId, location);
}

/**
 * Helper: Get remembered location
 */
export function getRememberedLocation(sessionId: string): string | undefined {
  return contextMemory.getLocation(sessionId);
}

/**
 * Helper: Get context for AI
 */
export function getContextForAI(sessionId: string): string {
  return contextMemory.getContextForAI(sessionId);
}
