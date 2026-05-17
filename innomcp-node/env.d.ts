declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SERVER_HOST: string;
      SERVER_PORT: string;

      // Database
      DB_HOST: string;
      DB_PORT: string;
      DB_USER: string;
      DB_PASSWORD: string;
      DB_NAME: string;

      // DASHB Database (for dashboard)
      DB_DASHB_HOST: string;
      DB_DASHB_PORT: string;
      DB_DASHB_USER: string;
      DB_DASHB_PASSWORD: string;
      DB_DASHB_NAME: string;

      // Authentication and Security
      JWT_SECRET: string;
      API_KEY_SECRET: string;
      API_KEY: string;

      // Environment
      NODE_ENV: "development" | "production" | "test";

      // Email
      EMAIL_HOST: string;
      EMAIL_PORT: string;
      EMAIL_USER: string;
      EMAIL_PASS: string;

      // AI Service
      AIHOST: string;
      AIPORT: string;

      // Whisper (Speech Recognition)
      WHISPER_HOST: string;
      WHISPER_PORT: string;

      // Redis
      REDIS_URL?: string;
      REDIS_HOST: string;
      REDIS_PORT: string;
      REDIS_PASSWORD: string;
      REDIS_CONNECT_TIMEOUT_MS?: string;
      REDIS_RETRY_COOLDOWN_MS?: string;
      REDIS_MAX_CONNECT_RETRIES?: string;

      // Application
      APPNAME: string;
      APPTITLE: string;

      // AI Models
      AIMODEL: string;
      AI_EMBED_MODEL: string;
      AI_EMBED_SIZE: string;

      // Qdrant (Vector DB)
      QDRANT_HOST: string;
      QDRANT_PORT: string;

      // Summary
      AIMODEL_SUM_MESSAGE: string;

      // Phase 10.15 — MDES multi-agent dispatch
      OLLAMA_URL?: string;
      OLLAMA_API_KEY?: string;
      OLLAMA_HOST?: string;
      OLLAMA_MODEL?: string;
      OLLAMA_STREAM?: string;
      PARALLEL_AGENTS?: string;
      LOCAL_OLLAMA_BASE_URL?: string;
      LOCAL_OLLAMA_TOKEN?: string;
      REMOTE_OLLAMA_BASE_URL?: string;
      REMOTE_OLLAMA_URL?: string;
      OLLAMA_REMOTE_BASE_URL?: string;
      OLLAMA_REMOTE_URL?: string;
      REMOTE_OLLAMA_TOKEN?: string;
      OLLAMA_REMOTE_API_KEY?: string;
      OLLAMA_REMOTE_DEFAULT_MODEL?: string;
      REMOTE_OLLAMA_MODEL?: string;
      MDES_PRIMARY_MODEL?: string;
      LOCAL_OLLAMA_MODEL?: string;
      OLLAMA_LOCAL_BASE_URL?: string;
      OLLAMA_LOCAL_API_KEY?: string;
      OLLAMA_LOCAL_DEFAULT_MODEL?: string;
      OLLAMA_REMOTE_API_KEY?: string;

      // Phase C.18 — MDES-only mode
      // "1" = skip localhost + GPT fallback; all agents use ollama.mdes only
      MDES_ONLY?: string;

      // OpenAI fallback (skipped when MDES_ONLY=1)
      OPENAI_API_KEY?: string;
      OPENAI_BASE_URL?: string;
      OPENAI_EMERGENCY_MODEL?: string;
      OPENAI_FALLBACK_ENABLED?: string;
      OPENAI_FALLBACK_MODELS?: string;
    }
  }
}

export {};
