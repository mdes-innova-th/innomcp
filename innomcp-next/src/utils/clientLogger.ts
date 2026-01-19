// innomcp-next/src/utils/clientLogger.ts
// Client-side logger for user interactions (browser-side only)

export type UserActionType = 
  | 'click'
  | 'input'
  | 'scroll'
  | 'mouse_move'
  | 'key_press'
  | 'form_submit'
  | 'navigation'
  | 'api_call'
  | 'error';

export interface UserAction {
  type: UserActionType;
  timestamp: string;
  element?: string;
  value?: any;
  mousePosition?: { x: number; y: number };
  url?: string;
  cookies?: string;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

const LOG_MODE = typeof window !== 'undefined' 
  ? (window as any).__INNOMCP_LOG_MODE__ || 'dev'
  : 'dev';

const shouldLog = (level: 'debug' | 'info' | 'warn' | 'error'): boolean => {
  if (LOG_MODE === 'prod') {
    return level === 'warn' || level === 'error';
  }
  if (LOG_MODE === 'test') {
    return level !== 'debug'; // Skip debug in test mode
  }
  // dev mode: log everything
  return true;
};

// Buffer for batch sending
let actionBuffer: UserAction[] = [];
const BUFFER_SIZE = 10;
const FLUSH_INTERVAL = 5000; // 5 seconds

// Send logs to backend API
const sendLogsToBackend = async (actions: UserAction[]) => {
  if (!shouldLog('info')) return;

  try {
    await fetch('/api/logs/user-actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ actions }),
    });
  } catch (error) {
    console.error('[ClientLogger] Failed to send logs:', error);
  }
};

// Flush buffer
const flushBuffer = () => {
  if (actionBuffer.length > 0) {
    const toSend = [...actionBuffer];
    actionBuffer = [];
    sendLogsToBackend(toSend);
  }
};

// Setup periodic flush
if (typeof window !== 'undefined') {
  setInterval(flushBuffer, FLUSH_INTERVAL);
  
  // Flush before page unload
  window.addEventListener('beforeunload', flushBuffer);
}

// Get session ID from cookies or generate
const getSessionId = (): string => {
  if (typeof document === 'undefined') return 'ssr';
  
  const match = document.cookie.match(/sessionId=([^;]+)/);
  if (match) return match[1];
  
  const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  document.cookie = `sessionId=${newSessionId}; path=/; max-age=86400`; // 24 hours
  return newSessionId;
};

// Get user ID from cookies
const getUserId = (): string | undefined => {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(/userId=([^;]+)/);
  return match ? match[1] : undefined;
};

// Log user action
export const logUserAction = (
  type: UserActionType,
  element?: string,
  value?: any,
  metadata?: Record<string, any>
) => {
  if (!shouldLog('debug') && type !== 'error') return;

  const action: UserAction = {
    type,
    timestamp: new Date().toISOString(),
    element,
    value,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    sessionId: getSessionId(),
    userId: getUserId(),
    metadata,
  };

  // Add to buffer
  actionBuffer.push(action);

  // Flush if buffer is full
  if (actionBuffer.length >= BUFFER_SIZE) {
    flushBuffer();
  }

  // Log to console in dev mode
  if (LOG_MODE === 'dev') {
    console.log(`[UserAction] ${type}:`, { element, value, metadata });
  }
};

// Track mouse position (throttled)
let lastMouseLog = 0;
const MOUSE_LOG_THROTTLE = 1000; // Log mouse position every 1 second

export const trackMousePosition = (x: number, y: number) => {
  if (!shouldLog('debug')) return;

  const now = Date.now();
  if (now - lastMouseLog > MOUSE_LOG_THROTTLE) {
    lastMouseLog = now;
    logUserAction('mouse_move', 'window', { x, y }, { mousePosition: { x, y } });
  }
};

// Auto-setup event listeners
export const setupUserTracking = () => {
  if (typeof window === 'undefined' || !shouldLog('debug')) return;

  // Track mouse movement (throttled)
  document.addEventListener('mousemove', (e) => {
    trackMousePosition(e.clientX, e.clientY);
  });

  // Track clicks
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const element = target.tagName + (target.id ? `#${target.id}` : '') + 
                    (target.className ? `.${target.className.split(' ').join('.')}` : '');
    logUserAction('click', element, undefined, {
      mousePosition: { x: e.clientX, y: e.clientY },
      timestamp: new Date().toISOString(),
    });
  });

  // Track form submissions
  document.addEventListener('submit', (e) => {
    const target = e.target as HTMLFormElement;
    logUserAction('form_submit', target.id || target.className, undefined, {
      action: target.action,
      method: target.method,
    });
  });

  // Track errors
  window.addEventListener('error', (e) => {
    logUserAction('error', 'window', e.message, {
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      stack: e.error?.stack,
    });
  });

  console.log('[ClientLogger] User tracking initialized');
};

// Initialize on load
if (typeof window !== 'undefined') {
  if (document.readyState === 'complete') {
    setupUserTracking();
  } else {
    window.addEventListener('load', setupUserTracking);
  }
}
