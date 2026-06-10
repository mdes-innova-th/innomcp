"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type {
  ChatMessage,
  Artifact,
  ChatMode,
  ToolType,
} from "@/types/chat";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type ProviderMode = "remote" | "local";

export interface ChatState {
  messages: ChatMessage[];
  input: string;
  isWaitingForResponse: boolean;
  isSocketReady: boolean;
  hasMessages: boolean;
  activeSummaryId: string | null;
  workspaceOpen: boolean;
  modelSettingsOpen: boolean;
  multiAgentOpen: boolean;
  providerMode: ProviderMode;
  artifacts: Artifact[];
  chatMode: ChatMode;
  selectedToolType: ToolType;
}

export interface ChatActions {
  setInput: (v: string) => void;
  sendMessage: () => Promise<void>;
  handleStop: () => void;
  handleNewChat: () => void;
  toggleWorkspace: () => void;
  toggleModelSettings: () => void;
  toggleMultiAgent: () => void;
  setProviderMode: (mode: ProviderMode) => void;
  addArtifact: (a: Artifact) => void;
  setActiveSummaryId: (id: string | null) => void;
  setChatMode: (mode: ChatMode) => void;
  setSelectedToolType: (type: ToolType) => void;
}

export interface ChatStateConfig {
  /** Initial provider mode (defaults to localStorage or "remote") */
  initialProviderMode?: ProviderMode;
  /** WebSocket URL for remote communication */
  wsUrl?: string;
  /** localStorage keys prefix */
  storagePrefix?: string;
  /** Default chat mode */
  initialChatMode?: ChatMode;
  /** Default tool type */
  initialToolType?: ToolType;
  /** Called when an error occurs in the socket flow */
  onError?: (error: Event | string) => void;
}

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const DEFAULT_WS_URL = "wss://ollama-ws.mdes-innova.online/chat";
const STORAGE_PREFIX = "innomcp_chat";
const DEFAULT_CHAT_MODE: ChatMode = "general"; // adjust to actual default
const DEFAULT_TOOL_TYPE: ToolType = "none";      // adjust

// --------------------------------------------------------------------------
// Action types for the reducer
// --------------------------------------------------------------------------

type Action =
  | { type: "SET_INPUT"; payload: string }
  | { type: "SET_MESSAGES"; payload: ChatMessage[] }
  | { type: "ADD_MESSAGE"; payload: ChatMessage }
  | { type: "UPDATE_LAST_MESSAGE"; payload: Partial<ChatMessage> }
  | { type: "SET_WAITING"; payload: boolean }
  | { type: "SET_SOCKET_READY"; payload: boolean }
  | { type: "CLEAR_MESSAGES" }
  | { type: "SET_ACTIVE_SUMMARY_ID"; payload: string | null }
  | { type: "TOGGLE_WORKSPACE" }
  | { type: "TOGGLE_MODEL_SETTINGS" }
  | { type: "TOGGLE_MULTI_AGENT" }
  | { type: "SET_PROVIDER_MODE"; payload: ProviderMode }
  | { type: "ADD_ARTIFACT"; payload: Artifact }
  | { type: "SET_CHAT_MODE"; payload: ChatMode }
  | { type: "SET_SELECTED_TOOL_TYPE"; payload: ToolType }
  | { type: "RESET_STATE"; payload?: Partial<ChatState> };

// --------------------------------------------------------------------------
// Reducer
// --------------------------------------------------------------------------

function chatStateReducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case "SET_INPUT":
      return { ...state, input: action.payload };
    case "SET_MESSAGES":
      return {
        ...state,
        messages: action.payload,
        hasMessages: action.payload.length > 0,
      };
    case "ADD_MESSAGE":
      return {
        ...state,
        messages: [...state.messages, action.payload],
        hasMessages: true,
      };
    case "UPDATE_LAST_MESSAGE": {
      if (state.messages.length === 0) return state;
      const updated = [...state.messages];
      const last = updated[updated.length - 1];
      updated[updated.length - 1] = { ...last, ...action.payload };
      return { ...state, messages: updated };
    }
    case "SET_WAITING":
      return { ...state, isWaitingForResponse: action.payload };
    case "SET_SOCKET_READY":
      return { ...state, isSocketReady: action.payload };
    case "CLEAR_MESSAGES":
      return {
        ...state,
        messages: [],
        hasMessages: false,
        isWaitingForResponse: false,
        activeSummaryId: null,
        artifacts: [],
      };
    case "SET_ACTIVE_SUMMARY_ID":
      return { ...state, activeSummaryId: action.payload };
    case "TOGGLE_WORKSPACE":
      return { ...state, workspaceOpen: !state.workspaceOpen };
    case "TOGGLE_MODEL_SETTINGS":
      return { ...state, modelSettingsOpen: !state.modelSettingsOpen };
    case "TOGGLE_MULTI_AGENT":
      return { ...state, multiAgentOpen: !state.multiAgentOpen };
    case "SET_PROVIDER_MODE":
      return { ...state, providerMode: action.payload };
    case "ADD_ARTIFACT":
      return { ...state, artifacts: [...state.artifacts, action.payload] };
    case "SET_CHAT_MODE":
      return { ...state, chatMode: action.payload };
    case "SET_SELECTED_TOOL_TYPE":
      return { ...state, selectedToolType: action.payload };
    case "RESET_STATE":
      return { ...initialChatState, ...action.payload };
    default:
      return state;
  }
}

// --------------------------------------------------------------------------
// Initial state helper
// --------------------------------------------------------------------------

const initialChatState: ChatState = {
  messages: [],
  input: "",
  isWaitingForResponse: false,
  isSocketReady: false,
  hasMessages: false,
  activeSummaryId: null,
  workspaceOpen: false,
  modelSettingsOpen: false,
  multiAgentOpen: false,
  providerMode: "remote",
  artifacts: [],
  chatMode: DEFAULT_CHAT_MODE,
  selectedToolType: DEFAULT_TOOL_TYPE,
};

// --------------------------------------------------------------------------
// Hook
// --------------------------------------------------------------------------

export function useChatState(config?: ChatStateConfig): {
  state: ChatState;
  actions: ChatActions;
} {
  const {
    initialProviderMode,
    wsUrl = DEFAULT_WS_URL,
    storagePrefix = STORAGE_PREFIX,
    initialChatMode = DEFAULT_CHAT_MODE,
    initialToolType = DEFAULT_TOOL_TYPE,
    onError,
  } = config ?? {};

  // --- State persistence keys ---
  const messagesKey = `${storagePrefix}_messages`;
  const providerModeKey = `${storagePrefix}_providerMode`;
  const chatModeKey = `${storagePrefix}_chatMode`;
  const toolTypeKey = `${storagePrefix}_toolType`;

  // --- Load persisted providerMode (overrides initial) ---
  const persistedMode = useRef<ProviderMode | null>(null);
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(providerModeKey);
    if (stored === "remote" || stored === "local") {
      persistedMode.current = stored;
    }
  }

  const finalProviderMode = persistedMode.current ?? initialProviderMode ?? "remote";

  // --- Reducer ---
  const [state, dispatch] = useReducer(chatStateReducer, {
    ...initialChatState,
    providerMode: finalProviderMode,
    chatMode: initialChatMode ?? DEFAULT_CHAT_MODE,
    selectedToolType: initialToolType ?? DEFAULT_TOOL_TYPE,
  });

  // --- WebSocket refs ---
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmounting = useRef(false);

  // --- Load persisted messages & chat mode on mount ---
  useEffect(() => {
    try {
      const storedMessages = localStorage.getItem(messagesKey);
      if (storedMessages) {
        const parsed: ChatMessage[] = JSON.parse(storedMessages);
        if (Array.isArray(parsed)) {
          dispatch({ type: "SET_MESSAGES", payload: parsed });
        }
      }
    } catch (e) {
      console.warn("Failed to load messages from localStorage", e);
    }

    try {
      const storedChatMode = localStorage.getItem(chatModeKey);
      if (storedChatMode) {
        dispatch({ type: "SET_CHAT_MODE", payload: storedChatMode as ChatMode });
      }
    } catch (e) {
      console.warn("Failed to load chat mode from localStorage", e);
    }

    try {
      const storedToolType = localStorage.getItem(toolTypeKey);
      if (storedToolType) {
        dispatch({ type: "SET_SELECTED_TOOL_TYPE", payload: storedToolType as ToolType });
      }
    } catch (e) {
      console.warn("Failed to load tool type from localStorage", e);
    }
  }, [messagesKey, chatModeKey, toolTypeKey]);

  // --- Persist messages and preferences ---
  useEffect(() => {
    try {
      localStorage.setItem(messagesKey, JSON.stringify(state.messages));
    } catch (e) {
      console.warn("Failed to save messages to localStorage", e);
    }
  }, [state.messages, messagesKey]);

  useEffect(() => {
    try {
      localStorage.setItem(providerModeKey, state.providerMode);
    } catch (e) {
      console.warn("Failed to save provider mode", e);
    }
  }, [state.providerMode, providerModeKey]);

  useEffect(() => {
    try {
      localStorage.setItem(chatModeKey, state.chatMode);
    } catch (e) {
      console.warn("Failed to save chat mode", e);
    }
  }, [state.chatMode, chatModeKey]);

  useEffect(() => {
    try {
      localStorage.setItem(toolTypeKey, state.selectedToolType);
    } catch (e) {
      console.warn("Failed to save tool type", e);
    }
  }, [state.selectedToolType, toolTypeKey]);

  // --- WebSocket connection management (remote mode only) ---
  const connectWebSocket = useCallback(() => {
    if (state.providerMode !== "remote") return;
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    // Clean up previous
    if (socketRef.current) {
      socketRef.current.onclose = null;
      socketRef.current.onerror = null;
      socketRef.current.onmessage = null;
      socketRef.current.close();
    }

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      if (!isUnmounting.current) {
        dispatch({ type: "SET_SOCKET_READY", payload: true });
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Expected message format: { type: "message"|"partial"|"end"|"error", content: string, ... }
        switch (data.type) {
          case "message":
          case "partial": {
            // Update last message or add new
            if (data.content) {
              if (
                state.messages.length > 0 &&
                state.messages[state.messages.length - 1].role === "assistant"
              ) {
                dispatch({
                  type: "UPDATE_LAST_MESSAGE",
                  payload: { content: data.content },
                });
              } else {
                dispatch({
                  type: "ADD_MESSAGE",
                  payload: {
                    id: crypto.randomUUID?.(),
                    role: "assistant",
                    content: data.content,
                    timestamp: Date.now(),
                  },
                });
              }
            }
            break;
          }
          case "end": {
            dispatch({ type: "SET_WAITING", payload: false });
            break;
          }
          case "error": {
            if (onError) onError(data.message ?? "Socket error");
            dispatch({ type: "SET_WAITING", payload: false });
            break;
          }
          default:
            console.warn("Unknown socket message type", data);
        }
      } catch (e) {
        console.warn("Failed to parse socket message", e);
      }
    };

    ws.onerror = (ev) => {
      if (onError) onError(ev);
      dispatch({ type: "SET_SOCKET_READY", payload: false });
    };

    ws.onclose = () => {
      if (!isUnmounting.current) {
        dispatch({ type: "SET_SOCKET_READY", payload: false });
        // Attempt reconnect after delay if still remote
        if (state.providerMode === "remote") {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, 3000);
        }
      }
    };
  }, [wsUrl, onError, state.providerMode, state.messages]);

  // Connect when switching to remote
  useEffect(() => {
    if (state.providerMode === "remote") {
      connectWebSocket();
    } else {
      // Close existing connection if switching to local
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      dispatch({ type: "SET_SOCKET_READY", payload: false });
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    }

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [state.providerMode, connectWebSocket]);

  // Cleanup on unmount
  useEffect(() => {
    isUnmounting.current = false;
    return () => {
      isUnmounting.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.onerror = null;
        socketRef.current.onmessage = null;
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []);

  // --------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------

  const setInput = useCallback((v: string) => {
    dispatch({ type: "SET_INPUT", payload: v });
  }, []);

  const sendMessage = useCallback(async () => {
    const text = state.input.trim();
    if (!text || state.isWaitingForResponse) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: crypto.randomUUID?.(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    dispatch({ type: "ADD_MESSAGE", payload: userMsg });
    dispatch({ type: "SET_INPUT", payload: "" });
    dispatch({ type: "SET_WAITING", payload: true });

    if (state.providerMode === "remote") {
      // Send via WebSocket
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: "chat",
            message: text,
          })
        );
      } else {
        // Fallback: should not happen if socket is ready, but try reconnect
        connectWebSocket();
        // Optionally queue message
        console.warn("WebSocket not ready, message not sent");
        dispatch({ type: "SET_WAITING", payload: false });
      }
    } else {
      // Local mode: could use fetch or local logic (to be implemented)
      // For now, simulate a local response for demonstration
      setTimeout(() => {
        const reply: ChatMessage = {
          id: crypto.randomUUID?.(),
          role: "assistant",
          content: "สวัสดีครับ จากระบบ Local (จำลอง)",
          timestamp: Date.now(),
        };
        dispatch({ type: "ADD_MESSAGE", payload: reply });
        dispatch({ type: "SET_WAITING", payload: false });
      }, 500);
    }
  }, [state.input, state.isWaitingForResponse, state.providerMode, connectWebSocket]);

  const handleStop = useCallback(() => {
    if (state.providerMode === "remote" && socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "stop" }));
    }
    dispatch({ type: "SET_WAITING", payload: false });
  }, [state.providerMode]);

  const handleNewChat = useCallback(() => {
    dispatch({ type: "CLEAR_MESSAGES" });
    // Optional: send reset to server
    if (state.providerMode === "remote" && socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "reset" }));
    }
  }, [state.providerMode]);

  const toggleWorkspace = useCallback(() => {
    dispatch({ type: "TOGGLE_WORKSPACE" });
  }, []);

  const toggleModelSettings = useCallback(() => {
    dispatch({ type: "TOGGLE_MODEL_SETTINGS" });
  }, []);

  const toggleMultiAgent = useCallback(() => {
    dispatch({ type: "TOGGLE_MULTI_AGENT" });
  }, []);

  const setProviderMode = useCallback((mode: ProviderMode) => {
    dispatch({ type: "SET_PROVIDER_MODE", payload: mode });
  }, []);

  const addArtifact = useCallback((artifact: Artifact) => {
    dispatch({ type: "ADD_ARTIFACT", payload: artifact });
  }, []);

  const setActiveSummaryId = useCallback((id: string | null) => {
    dispatch({ type: "SET_ACTIVE_SUMMARY_ID", payload: id });
  }, []);

  const setChatMode = useCallback((mode: ChatMode) => {
    dispatch({ type: "SET_CHAT_MODE", payload: mode });
  }, []);

  const setSelectedToolType = useCallback((type: ToolType) => {
    dispatch({ type: "SET_SELECTED_TOOL_TYPE", payload: type });
  }, []);

  const actions: ChatActions = {
    setInput,
    sendMessage,
    handleStop,
    handleNewChat,
    toggleWorkspace,
    toggleModelSettings,
    toggleMultiAgent,
    setProviderMode,
    addArtifact,
    setActiveSummaryId,
    setChatMode,
    setSelectedToolType,
  };

  return { state, actions };
}