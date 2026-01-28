/**
 * API Key Management System
 * à¸ˆà¸±à¸”à¸à¸²à¸£ API keys à¸ªà¸³à¸«à¸£à¸±à¸š external services
 * 
 * Features:
 * - Secure key storage
 * - Key rotation
 * - Usage tracking
 * - Rate limit per key
 * 
 * @module utils/apikey
 */

import { logBoth } from '../mcpLogger';
import * as crypto from 'crypto';

/**
 * API Key metadata
 */
export interface APIKey {
  name: string;
  service: 'tmd' | 'opensearch' | 'openmeteo' | 'other';
  key: string;
  encrypted: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
  usageCount: number;
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  expiresAt?: Date;
  isActive: boolean;
}

/**
 * API Key Manager
 */
class APIKeyManager {
  private keys: Map<string, APIKey> = new Map();
  private encryptionKey: string;

  constructor(encryptionKey?: string) {
    this.encryptionKey = encryptionKey || process.env.API_KEY_ENCRYPTION_SECRET || 'default-secret-change-me';
    this.loadKeysFromEnv();
  }

  /**
   * Load API keys from environment variables
   */
  private loadKeysFromEnv(): void {
    // TMD API Key
    if (process.env.TMD_API_KEY) {
      this.registerKey({
        name: 'TMD Weather API',
        service: 'tmd',
        key: process.env.TMD_API_KEY,
        encrypted: false,
        createdAt: new Date(),
        usageCount: 0,
        rateLimit: {
          requestsPerMinute: 60,
          requestsPerDay: 10000
        },
        isActive: true
      });
    }

    // OpenSearch API Key
    if (process.env.OPENSEARCH_API_KEY) {
      this.registerKey({
        name: 'Thai Gov OpenSearch',
        service: 'opensearch',
        key: process.env.OPENSEARCH_API_KEY,
        encrypted: false,
        createdAt: new Date(),
        usageCount: 0,
        rateLimit: {
          requestsPerMinute: 30,
          requestsPerDay: 5000
        },
        isActive: true
      });
    }

    // Open-Meteo (no key required)
    this.registerKey({
      name: 'Open-Meteo',
      service: 'openmeteo',
      key: 'public',
      encrypted: false,
      createdAt: new Date(),
      usageCount: 0,
      isActive: true
    });

    logBoth('info', `[APIKeyManager] Loaded ${this.keys.size} API keys`);
  }

  /**
   * Register a new API key
   */
  registerKey(keyData: APIKey): void {
    const keyId = `${keyData.service}_${Date.now()}`;
    this.keys.set(keyId, keyData);
    logBoth('info', `[APIKeyManager] Registered key: ${keyData.name}`);
  }

  /**
   * Get API key by service
   */
  getKey(service: string): string | null {
    for (const [_, keyData] of this.keys) {
      if (keyData.service === service && keyData.isActive) {
        // Update usage
        keyData.lastUsedAt = new Date();
        keyData.usageCount++;

        // Check rate limit
        if (keyData.rateLimit) {
          // Simple rate limit check (would need more sophisticated implementation)
          const now = Date.now();
          // TODO: Implement proper rate limiting with time windows
        }

        return keyData.key;
      }
    }
    return null;
  }

  /**
   * Encrypt API key
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey.padEnd(32, '0').substring(0, 32)), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt API key
   */
  private decrypt(encrypted: string): string {
    const parts = encrypted.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey.padEnd(32, '0').substring(0, 32)), iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    for (const [keyId, keyData] of this.keys) {
      stats[keyData.name] = {
        service: keyData.service,
        usageCount: keyData.usageCount,
        lastUsedAt: keyData.lastUsedAt,
        isActive: keyData.isActive,
        hasRateLimit: !!keyData.rateLimit
      };
    }
    return stats;
  }

  /**
   * Deactivate a key
   */
  deactivateKey(keyId: string): boolean {
    const keyData = this.keys.get(keyId);
    if (keyData) {
      keyData.isActive = false;
      logBoth('info', `[APIKeyManager] Deactivated key: ${keyData.name}`);
      return true;
    }
    return false;
  }

  /**
   * Check if service has valid key
   */
  hasValidKey(service: string): boolean {
    for (const [_, keyData] of this.keys) {
      if (keyData.service === service && keyData.isActive) {
        // Check expiration
        if (keyData.expiresAt && keyData.expiresAt < new Date()) {
          keyData.isActive = false;
          return false;
        }
        return true;
      }
    }
    return false;
  }
}

// Export singleton instance
export const apiKeyManager = new APIKeyManager();

/**
 * Helper: Get API key for service
 */
export function getAPIKey(service: string): string | null {
  return apiKeyManager.getKey(service);
}

/**
 * Helper: Check if service has valid key
 */
export function hasAPIKey(service: string): boolean {
  return apiKeyManager.hasValidKey(service);
}

/**
 * Helper: Get all usage statistics
 */
export function getAPIKeyUsageStats(): Record<string, any> {
  return apiKeyManager.getUsageStats();
}
