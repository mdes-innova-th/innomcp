/**
 * Configuration Management Module
 * à¸£à¸°à¸šà¸šà¸ˆà¸±à¸”à¸à¸²à¸£ config à¹à¸šà¸šà¸£à¸§à¸¡à¸¨à¸¹à¸™à¸¢à¹Œ
 * 
 * Features:
 * - Environment-based config
 * - Runtime config updates
 * - Config validation
 * - Config versioning
 * 
 * @module utils/config
 */

import { logBoth } from '../mcpLogger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Config Schema
 */
export interface AppConfig {
  app: {
    name: string;
    version: string;
    environment: 'development' | 'production' | 'test';
    port: number;
    host: string;
  };
  api: {
    timeout: number;
    retryAttempts: number;
    rateLimit: {
      windowMs: number;
      maxRequests: number;
    };
  };
  cache: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'text';
    filepath?: string;
  };
  ai: {
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
    topP: number;
  };
  security: {
    jwtSecret: string;
    jwtExpiry: string;
    corsOrigins: string[];
    csrfEnabled: boolean;
  };
  features: {
    weatherEnabled: boolean;
    searchEnabled: boolean;
    officeholderEnabled: boolean;
    analyticsEnabled: boolean;
  };
}

/**
 * Configuration Manager
 */
class ConfigManager {
  private config: AppConfig;
  private configPath: string;
  private watchers: Array<(config: AppConfig) => void> = [];

  constructor() {
    this.configPath = path.join(process.cwd(), 'config.json');
    this.config = this.loadDefaultConfig();
    this.loadConfig();
  }

  /**
   * Load default configuration
   */
  private loadDefaultConfig(): AppConfig {
    return {
      app: {
        name: 'InnoMCP',
        version: '1.0.0',
        environment: (process.env.NODE_ENV as any) || 'development',
        port: parseInt(process.env.PORT || '3011'),
        host: process.env.HOST || 'localhost'
      },
      api: {
        timeout: 30000,
        retryAttempts: 3,
        rateLimit: {
          windowMs: 60000,
          maxRequests: 100
        }
      },
      cache: {
        enabled: true,
        ttl: 300,
        maxSize: 100
      },
      logging: {
        level: 'info',
        format: 'text'
      },
      ai: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        maxTokens: 4096,
        topP: 1.0
      },
      security: {
        jwtSecret: process.env.JWT_SECRET || 'default-secret-change-me',
        jwtExpiry: '24h',
        corsOrigins: ['http://localhost:3000'],
        csrfEnabled: true
      },
      features: {
        weatherEnabled: true,
        searchEnabled: true,
        officeholderEnabled: true,
        analyticsEnabled: true
      }
    };
  }

  /**
   * Load configuration from file
   */
  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const fileContent = fs.readFileSync(this.configPath, 'utf-8');
        const fileConfig = JSON.parse(fileContent);
        
        // Merge with defaults
        this.config = this.mergeConfig(this.config, fileConfig);
        
        logBoth('info', '[Config] Loaded configuration from file');
      } else {
        logBoth('info', '[Config] Using default configuration');
      }
    } catch (error) {
      logBoth('error', `[Config] Error loading config: ${error}`);
    }

    // Override with environment variables
    this.loadEnvOverrides();
  }

  /**
   * Load environment variable overrides
   */
  private loadEnvOverrides(): void {
    if (process.env.API_TIMEOUT) {
      this.config.api.timeout = parseInt(process.env.API_TIMEOUT);
    }
    if (process.env.CACHE_ENABLED) {
      this.config.cache.enabled = process.env.CACHE_ENABLED === 'true';
    }
    if (process.env.LOG_LEVEL) {
      this.config.logging.level = process.env.LOG_LEVEL as any;
    }
    if (process.env.AI_MODEL) {
      this.config.ai.model = process.env.AI_MODEL;
    }
    if (process.env.CORS_ORIGINS) {
      this.config.security.corsOrigins = process.env.CORS_ORIGINS.split(',');
    }
  }

  /**
   * Merge configurations
   */
  private mergeConfig(base: any, override: any): any {
    const result = { ...base };
    
    for (const key in override) {
      if (typeof override[key] === 'object' && !Array.isArray(override[key])) {
        result[key] = this.mergeConfig(base[key] || {}, override[key]);
      } else {
        result[key] = override[key];
      }
    }
    
    return result;
  }

  /**
   * Get configuration
   */
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  /**
   * Get nested configuration value
   */
  getValue(path: string): any {
    const keys = path.split('.');
    let value: any = this.config;
    
    for (const key of keys) {
      if (value === undefined) break;
      value = value[key];
    }
    
    return value;
  }

  /**
   * Set configuration value
   */
  setValue(path: string, value: any): void {
    const keys = path.split('.');
    let obj: any = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in obj)) {
        obj[keys[i]] = {};
      }
      obj = obj[keys[i]];
    }
    
    obj[keys[keys.length - 1]] = value;
    
    logBoth('info', `[Config] Updated ${path} = ${value}`);
    this.notifyWatchers();
  }

  /**
   * Get all configuration
   */
  getAll(): AppConfig {
    return { ...this.config };
  }

  /**
   * Save configuration to file
   */
  saveConfig(): void {
    try {
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf-8'
      );
      logBoth('info', '[Config] Configuration saved to file');
    } catch (error) {
      logBoth('error', `[Config] Error saving config: ${error}`);
    }
  }

  /**
   * Watch for configuration changes
   */
  watch(callback: (config: AppConfig) => void): void {
    this.watchers.push(callback);
  }

  /**
   * Notify watchers of changes
   */
  private notifyWatchers(): void {
    for (const watcher of this.watchers) {
      try {
        watcher(this.config);
      } catch (error) {
        logBoth('error', `[Config] Watcher error: ${error}`);
      }
    }
  }

  /**
   * Validate configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate port
    if (this.config.app.port < 1 || this.config.app.port > 65535) {
      errors.push('Invalid port number');
    }

    // Validate timeout
    if (this.config.api.timeout < 1000) {
      errors.push('API timeout too short (min 1000ms)');
    }

    // Validate JWT secret
    if (this.config.security.jwtSecret === 'default-secret-change-me') {
      errors.push('JWT secret not configured (using default)');
    }

    // Validate AI config
    if (this.config.ai.temperature < 0 || this.config.ai.temperature > 2) {
      errors.push('AI temperature must be between 0 and 2');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Reset to defaults
   */
  reset(): void {
    this.config = this.loadDefaultConfig();
    logBoth('info', '[Config] Configuration reset to defaults');
    this.notifyWatchers();
  }

  /**
   * Get configuration summary
   */
  getSummary(): string {
    const validation = this.validate();
    
    return `
Configuration Summary
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
App: ${this.config.app.name} v${this.config.app.version}
Environment: ${this.config.app.environment}
Port: ${this.config.app.port}

API Timeout: ${this.config.api.timeout}ms
Cache: ${this.config.cache.enabled ? 'Enabled' : 'Disabled'}
Log Level: ${this.config.logging.level}

AI Model: ${this.config.ai.model}
Temperature: ${this.config.ai.temperature}

Features:
  - Weather: ${this.config.features.weatherEnabled ? 'âœ“' : 'âœ—'}
  - Search: ${this.config.features.searchEnabled ? 'âœ“' : 'âœ—'}
  - Officeholder: ${this.config.features.officeholderEnabled ? 'âœ“' : 'âœ—'}
  - Analytics: ${this.config.features.analyticsEnabled ? 'âœ“' : 'âœ—'}

Validation: ${validation.valid ? 'âœ“ Valid' : 'âœ— Invalid'}
${validation.errors.length > 0 ? 'Errors:\n  - ' + validation.errors.join('\n  - ') : ''}
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
    `.trim();
  }
}

// Export singleton instance
export const config = new ConfigManager();

/**
 * Helper: Get config value
 */
export function getConfig<K extends keyof AppConfig>(key: K): AppConfig[K] {
  return config.get(key);
}

/**
 * Helper: Get nested value
 */
export function getConfigValue(path: string): any {
  return config.getValue(path);
}

/**
 * Helper: Set config value
 */
export function setConfigValue(path: string, value: any): void {
  config.setValue(path, value);
}

/**
 * Helper: Get all config
 */
export function getAllConfig(): AppConfig {
  return config.getAll();
}
