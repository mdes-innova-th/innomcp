/**
 * Ollama Connection Pool
 * Manages multiple Ollama connections for concurrent requests
 */

import { Ollama } from "ollama";
import logger from "../utils/logger";

interface OllamaConnection {
  client: Ollama;
  inUse: boolean;
  lastUsed: number;
}

export class OllamaPool {
  private connections: OllamaConnection[] = [];
  private host: string;
  private poolSize: number;

  constructor(host: string, poolSize = 3) {
    this.host = host;
    this.poolSize = poolSize;
    
    // Initialize pool
    for (let i = 0; i < poolSize; i++) {
      this.connections.push({
        client: new Ollama({ host }),
        inUse: false,
        lastUsed: Date.now(),
      });
    }

    logger.info(`[OllamaPool] Initialized with ${poolSize} connections to ${host}`);
  }

  async acquire(): Promise<Ollama> {
    // Try to find available connection
    for (const conn of this.connections) {
      if (!conn.inUse) {
        conn.inUse = true;
        conn.lastUsed = Date.now();
        logger.debug(`[OllamaPool] Acquired connection. In use: ${this.getInUseCount()}/${this.poolSize}`);
        return conn.client;
      }
    }

    // All connections busy, wait for one to become available
    logger.warn(`[OllamaPool] All connections busy. Waiting...`);
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        for (const conn of this.connections) {
          if (!conn.inUse) {
            clearInterval(checkInterval);
            conn.inUse = true;
            conn.lastUsed = Date.now();
            logger.debug(`[OllamaPool] Acquired connection after wait. In use: ${this.getInUseCount()}/${this.poolSize}`);
            resolve(conn.client);
            return;
          }
        }
      }, 100);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        logger.error(`[OllamaPool] Failed to acquire connection after 30s timeout`);
        // Return any connection as fallback
        const conn = this.connections[0];
        conn.inUse = true;
        resolve(conn.client);
      }, 30000);
    });
  }

  release(client: Ollama) {
    const conn = this.connections.find((c) => c.client === client);
    if (conn) {
      conn.inUse = false;
      logger.debug(`[OllamaPool] Released connection. In use: ${this.getInUseCount()}/${this.poolSize}`);
    }
  }

  private getInUseCount(): number {
    return this.connections.filter((c) => c.inUse).length;
  }

  getStats() {
    return {
      total: this.poolSize,
      inUse: this.getInUseCount(),
      available: this.poolSize - this.getInUseCount(),
    };
  }
}

// Create pools for local and remote Ollama
const localHost = process.env.LOCAL_OLLAMA_BASE_URL || process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || "http://172.22.64.1:11434";
const remoteHost = process.env.REMOTE_OLLAMA_BASE_URL;

export const localOllamaPool = new OllamaPool(localHost, 3);
export const remoteOllamaPool = remoteHost ? new OllamaPool(remoteHost, 3) : null;
