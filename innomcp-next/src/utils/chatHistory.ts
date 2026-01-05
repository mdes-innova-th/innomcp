/**
 * Chat History Management Utilities
 * Professional chat session storage and management
 */

export interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  fullText?: string;
  timestamp?: number;
  structuredContent?: any;
  tokens?: number;
  responseTime?: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  created: number;
  updated: number;
  tokenCount?: number;
}

const STORAGE_KEY = 'innomcp-chat-sessions';
const CURRENT_SESSION_KEY = 'innomcp-current-session';
const MAX_SESSIONS = 50;

/**
 * Get all saved chat sessions
 */
export function getAllSessions(): ChatSession[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading chat sessions:', error);
    return [];
  }
}

/**
 * Save a chat session
 */
export function saveSession(session: ChatSession): void {
  try {
    const sessions = getAllSessions();
    const existingIndex = sessions.findIndex(s => s.id === session.id);
    
    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.unshift(session);
    }
    
    // Keep only recent sessions
    const trimmed = sessions.slice(0, MAX_SESSIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Error saving chat session:', error);
  }
}

/**
 * Get current active session
 */
export function getCurrentSession(): ChatSession | null {
  try {
    const stored = localStorage.getItem(CURRENT_SESSION_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading current session:', error);
    return null;
  }
}

/**
 * Set current active session
 */
export function setCurrentSession(session: ChatSession | null): void {
  try {
    if (session) {
      localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(CURRENT_SESSION_KEY);
    }
  } catch (error) {
    console.error('Error setting current session:', error);
  }
}

/**
 * Create new session from messages
 */
export function createSession(messages: ChatMessage[]): ChatSession {
  const now = Date.now();
  const title = generateSessionTitle(messages);
  const tokenCount = messages.reduce((sum, msg) => sum + (msg.tokens || 0), 0);
  
  return {
    id: `session-${now}`,
    title,
    messages,
    created: now,
    updated: now,
    tokenCount,
  };
}

/**
 * Generate title from first messages
 */
function generateSessionTitle(messages: ChatMessage[]): string {
  if (messages.length === 0) return 'การสนทนาใหม่';
  
  const firstUser = messages.find(m => m.sender === 'user');
  if (firstUser) {
    const text = firstUser.text.trim();
    return text.length > 40 ? text.substring(0, 40) + '...' : text;
  }
  
  return `การสนทนา ${new Date().toLocaleDateString('th-TH')}`;
}

/**
 * Delete a session
 */
export function deleteSession(sessionId: string): void {
  try {
    const sessions = getAllSessions();
    const filtered = sessions.filter(s => s.id !== sessionId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    
    // Clear current if deleted
    const current = getCurrentSession();
    if (current?.id === sessionId) {
      setCurrentSession(null);
    }
  } catch (error) {
    console.error('Error deleting session:', error);
  }
}

/**
 * Export session as JSON
 */
export function exportSessionJSON(session: ChatSession): void {
  try {
    const json = JSON.stringify(session, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${session.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting session:', error);
  }
}

/**
 * Export session as plain text
 */
export function exportSessionText(session: ChatSession): void {
  try {
    let text = `# ${session.title}\n`;
    text += `Created: ${new Date(session.created).toLocaleString('th-TH')}\n\n`;
    text += `---\n\n`;
    
    session.messages.forEach((msg, idx) => {
      const sender = msg.sender === 'user' ? 'ผู้ใช้' : 'AI';
      const time = msg.timestamp 
        ? new Date(msg.timestamp).toLocaleTimeString('th-TH') 
        : '';
      text += `[${idx + 1}] ${sender}${time ? ` (${time})` : ''}:\n`;
      text += `${msg.text}\n\n`;
    });
    
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${session.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting session text:', error);
  }
}

/**
 * Search messages across all sessions
 */
export function searchSessions(query: string): Array<{session: ChatSession, matches: number}> {
  try {
    const sessions = getAllSessions();
    const lowerQuery = query.toLowerCase();
    
    return sessions
      .map(session => {
        const matches = session.messages.filter(msg => 
          msg.text.toLowerCase().includes(lowerQuery)
        ).length;
        return { session, matches };
      })
      .filter(result => result.matches > 0)
      .sort((a, b) => b.matches - a.matches);
  } catch (error) {
    console.error('Error searching sessions:', error);
    return [];
  }
}

/**
 * Clear all chat history
 */
export function clearAllSessions(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CURRENT_SESSION_KEY);
    localStorage.removeItem('chatMessages'); // Legacy key
    localStorage.removeItem('chatSummaries'); // Legacy key
  } catch (error) {
    console.error('Error clearing sessions:', error);
  }
}

/**
 * Get session statistics
 */
export function getSessionStats(session: ChatSession): {
  messageCount: number;
  userMessages: number;
  aiMessages: number;
  totalTokens: number;
  avgResponseTime: number;
} {
  const messageCount = session.messages.length;
  const userMessages = session.messages.filter(m => m.sender === 'user').length;
  const aiMessages = session.messages.filter(m => m.sender === 'ai').length;
  const totalTokens = session.tokenCount || 0;
  
  const responseTimes = session.messages
    .filter(m => m.responseTime)
    .map(m => m.responseTime!);
  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;
  
  return {
    messageCount,
    userMessages,
    aiMessages,
    totalTokens,
    avgResponseTime,
  };
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'เมื่อสักครู่';
  if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
  if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
  
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Estimate token count (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~1 token per 4 characters for Thai/English mix
  return Math.ceil(text.length / 4);
}
