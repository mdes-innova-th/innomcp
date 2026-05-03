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
    }
  }
}

export {};
