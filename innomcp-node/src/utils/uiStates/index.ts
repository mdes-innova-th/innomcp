/**
 * UI States Module
 * à¸ˆà¸±à¸”à¸à¸²à¸£à¸ªà¸–à¸²à¸™à¸°à¸à¸²à¸£à¹à¸ªà¸”à¸‡à¸œà¸¥ UI à¸ªà¸³à¸«à¸£à¸±à¸š Frontend
 * 
 * Features:
 * - Loading states
 * - Data verification states
 * - Fallback states
 * - Error states
 * 
 * @module utils/uiStates
 */

import { logBoth } from '../mcpLogger';

/**
 * UI State Type
 */
export type UIStateType = 
  | 'idle'
  | 'loading'
  | 'verifying'
  | 'success'
  | 'fallback'
  | 'error';

/**
 * UI State
 */
export interface UIState {
  type: UIStateType;
  message?: string;
  progress?: number; // 0-100
  details?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * State Transition
 */
export interface StateTransition {
  from: UIStateType;
  to: UIStateType;
  timestamp: Date;
  duration?: number;
}

/**
 * UI State Manager
 */
class UIStateManager {
  private currentState: UIState = {
    type: 'idle',
    timestamp: new Date()
  };

  private stateHistory: StateTransition[] = [];
  private maxHistory = 50;

  // Pre-defined messages in Thai
  private messages: Record<UIStateType, Record<string, string>> = {
    idle: {
      default: 'à¸žà¸£à¹‰à¸­à¸¡à¹ƒà¸Šà¹‰à¸‡à¸²à¸™'
    },
    loading: {
      default: 'à¸à¸³à¸¥à¸±à¸‡à¸”à¸¶à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥...',
      weather: 'à¸à¸³à¸¥à¸±à¸‡à¸”à¸¶à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ªà¸ à¸²à¸žà¸­à¸²à¸à¸²à¸¨...',
      time: 'à¸à¸³à¸¥à¸±à¸‡à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¹€à¸§à¸¥à¸²...',
      search: 'à¸à¸³à¸¥à¸±à¸‡à¸„à¹‰à¸™à¸«à¸²à¸‚à¹‰à¸­à¸¡à¸¹à¸¥...',
      officeholder: 'à¸à¸³à¸¥à¸±à¸‡à¸”à¸¶à¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸œà¸¹à¹‰à¸”à¸³à¸£à¸‡à¸•à¸³à¹à¸«à¸™à¹ˆà¸‡...'
    },
    verifying: {
      default: 'à¸à¸³à¸¥à¸±à¸‡à¸¢à¸·à¸™à¸¢à¸±à¸™à¹à¸«à¸¥à¹ˆà¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥...',
      sources: 'à¸à¸³à¸¥à¸±à¸‡à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¹à¸«à¸¥à¹ˆà¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥...',
      crosscheck: 'à¸à¸³à¸¥à¸±à¸‡ cross-check à¸‚à¹‰à¸­à¸¡à¸¹à¸¥...',
      consensus: 'à¸à¸³à¸¥à¸±à¸‡à¸ªà¸£à¹‰à¸²à¸‡ consensus...'
    },
    success: {
      default: 'à¸ªà¸³à¹€à¸£à¹‡à¸ˆ',
      complete: 'à¹€à¸ªà¸£à¹‡à¸ˆà¸ªà¸¡à¸šà¸¹à¸£à¸“à¹Œ'
    },
    fallback: {
      default: 'à¹ƒà¸Šà¹‰à¹à¸«à¸¥à¹ˆà¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ªà¸³à¸£à¸­à¸‡',
      primary_failed: 'à¹à¸«à¸¥à¹ˆà¸‡à¸«à¸¥à¸±à¸à¹„à¸¡à¹ˆà¸žà¸£à¹‰à¸­à¸¡à¹ƒà¸Šà¹‰à¸‡à¸²à¸™ à¹ƒà¸Šà¹‰à¹à¸«à¸¥à¹ˆà¸‡à¸ªà¸³à¸£à¸­à¸‡',
      limited: 'à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ˆà¸³à¸à¸±à¸” à¸à¸³à¸¥à¸±à¸‡à¹ƒà¸Šà¹‰à¹à¸«à¸¥à¹ˆà¸‡à¸ªà¸³à¸£à¸­à¸‡'
    },
    error: {
      default: 'à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”',
      network: 'à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”à¹€à¸„à¸£à¸·à¸­à¸‚à¹ˆà¸²à¸¢',
      timeout: 'à¸«à¸¡à¸”à¹€à¸§à¸¥à¸²à¸£à¸­ à¸à¸£à¸¸à¸“à¸²à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆ',
      api: 'à¸šà¸£à¸´à¸à¸²à¸£à¸Šà¸±à¹ˆà¸§à¸„à¸£à¸²à¸§à¹„à¸¡à¹ˆà¸žà¸£à¹‰à¸­à¸¡à¹ƒà¸Šà¹‰à¸‡à¸²à¸™',
      parse: 'à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸›à¸£à¸°à¸¡à¸§à¸¥à¸œà¸¥à¸‚à¹‰à¸­à¸¡à¸¹à¸¥'
    }
  };

  /**
   * Set state
   */
  setState(
    type: UIStateType,
    options?: {
      message?: string;
      messageKey?: string;
      progress?: number;
      details?: string;
      metadata?: Record<string, any>;
    }
  ): UIState {
    const previousState = this.currentState;
    const previousType = previousState.type;

    // Get message
    let message = options?.message;
    if (!message && options?.messageKey) {
      message = this.messages[type][options.messageKey] || this.messages[type].default;
    }
    if (!message) {
      message = this.messages[type].default;
    }

    // Create new state
    const newState: UIState = {
      type,
      message,
      progress: options?.progress,
      details: options?.details,
      timestamp: new Date(),
      metadata: options?.metadata
    };

    this.currentState = newState;

    // Record transition
    const transition: StateTransition = {
      from: previousType,
      to: type,
      timestamp: new Date(),
      duration: Date.now() - previousState.timestamp.getTime()
    };

    this.stateHistory.push(transition);
    
    // Trim history
    if (this.stateHistory.length > this.maxHistory) {
      this.stateHistory.shift();
    }

    logBoth('info', `[UIState] ${previousType} â†’ ${type}: ${message}`);

    return newState;
  }

  /**
   * Get current state
   */
  getState(): UIState {
    return { ...this.currentState };
  }

  /**
   * Set loading state
   */
  setLoading(context?: string, progress?: number): UIState {
    return this.setState('loading', {
      messageKey: context || 'default',
      progress
    });
  }

  /**
   * Set verifying state
   */
  setVerifying(context?: string, details?: string): UIState {
    return this.setState('verifying', {
      messageKey: context || 'default',
      details
    });
  }

  /**
   * Set success state
   */
  setSuccess(message?: string): UIState {
    return this.setState('success', {
      message: message || this.messages.success.default
    });
  }

  /**
   * Set fallback state
   */
  setFallback(reason?: string, details?: string): UIState {
    return this.setState('fallback', {
      messageKey: reason || 'default',
      details
    });
  }

  /**
   * Set error state
   */
  setError(errorType?: string, details?: string): UIState {
    return this.setState('error', {
      messageKey: errorType || 'default',
      details
    });
  }

  /**
   * Set idle state
   */
  setIdle(): UIState {
    return this.setState('idle');
  }

  /**
   * Get state history
   */
  getHistory(limit?: number): StateTransition[] {
    if (limit) {
      return this.stateHistory.slice(-limit);
    }
    return [...this.stateHistory];
  }

  /**
   * Get average transition time
   */
  getAverageTransitionTime(fromType?: UIStateType, toType?: UIStateType): number {
    let transitions = this.stateHistory.filter(t => t.duration !== undefined);

    if (fromType) {
      transitions = transitions.filter(t => t.from === fromType);
    }
    if (toType) {
      transitions = transitions.filter(t => t.to === toType);
    }

    if (transitions.length === 0) return 0;

    const sum = transitions.reduce((acc, t) => acc + (t.duration || 0), 0);
    return sum / transitions.length;
  }

  /**
   * Create UI state for response
   */
  createResponseState(data: {
    success: boolean;
    fallback?: boolean;
    error?: any;
    sources?: string[];
    duration?: number;
  }): UIState {
    if (data.error) {
      return this.setError('api', data.error.message || String(data.error));
    }

    if (data.fallback) {
      return this.setFallback('primary_failed', `à¹ƒà¸Šà¹‰à¹à¸«à¸¥à¹ˆà¸‡à¸ªà¸³à¸£à¸­à¸‡: ${data.sources?.join(', ')}`);
    }

    if (data.success) {
      const details = data.sources ? `à¹à¸«à¸¥à¹ˆà¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥: ${data.sources.join(', ')}` : undefined;
      return this.setState('success', { details });
    }

    return this.setError('default');
  }

  /**
   * Get state summary
   */
  getSummary(): string {
    const recentHistory = this.getHistory(10);
    const avgLoadingTime = this.getAverageTransitionTime('loading');
    const avgVerifyingTime = this.getAverageTransitionTime('verifying');

    let summary = `
UI State Summary
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
Current State: ${this.currentState.type}
Message: ${this.currentState.message || 'N/A'}
`;

    if (this.currentState.progress !== undefined) {
      summary += `Progress: ${this.currentState.progress}%\n`;
    }

    if (this.currentState.details) {
      summary += `Details: ${this.currentState.details}\n`;
    }

    summary += `
Performance:
  Avg Loading Time: ${avgLoadingTime.toFixed(0)}ms
  Avg Verifying Time: ${avgVerifyingTime.toFixed(0)}ms

Recent Transitions (last 10):
`;

    for (const transition of recentHistory) {
      summary += `  ${transition.from} â†’ ${transition.to} (${transition.duration || 0}ms)\n`;
    }

    summary += 'â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”';
    return summary.trim();
  }

  /**
   * Format state for frontend
   */
  formatForFrontend(): {
    type: UIStateType;
    message: string;
    progress?: number;
    details?: string;
    timestamp: string;
  } {
    return {
      type: this.currentState.type,
      message: this.currentState.message || '',
      progress: this.currentState.progress,
      details: this.currentState.details,
      timestamp: this.currentState.timestamp.toISOString()
    };
  }
}

// Export singleton instance
export const uiState = new UIStateManager();

/**
 * Helper: Set loading
 */
export function setLoadingState(context?: string, progress?: number): UIState {
  return uiState.setLoading(context, progress);
}

/**
 * Helper: Set verifying
 */
export function setVerifyingState(context?: string, details?: string): UIState {
  return uiState.setVerifying(context, details);
}

/**
 * Helper: Set success
 */
export function setSuccessState(message?: string): UIState {
  return uiState.setSuccess(message);
}

/**
 * Helper: Set fallback
 */
export function setFallbackState(reason?: string, details?: string): UIState {
  return uiState.setFallback(reason, details);
}

/**
 * Helper: Set error
 */
export function setErrorState(errorType?: string, details?: string): UIState {
  return uiState.setError(errorType, details);
}

/**
 * Helper: Get current state
 */
export function getCurrentUIState(): UIState {
  return uiState.getState();
}

/**
 * Helper: Format for frontend
 */
export function formatUIStateForFrontend() {
  return uiState.formatForFrontend();
}
