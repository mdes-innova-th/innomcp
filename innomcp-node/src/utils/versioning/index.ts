/**
 * Versioning Module
 * à¹€à¸§à¸­à¸£à¹Œà¸Šà¸±à¸™ schema/intent à¹ƒà¸«à¹‰ frontend-backend à¸ªà¸­à¸”à¸„à¸¥à¹‰à¸­à¸‡
 * 
 * Features:
 * - API versioning
 * - Schema versioning
 * - Backward compatibility
 * - Version negotiation
 * 
 * @module utils/versioning
 */

import { logBoth } from '../mcpLogger';

/**
 * Version
 */
export interface Version {
  major: number;
  minor: number;
  patch: number;
}

/**
 * API Version
 */
export interface APIVersion extends Version {
  releaseDate: Date;
  deprecated?: boolean;
  deprecationDate?: Date;
  endOfLifeDate?: Date;
  changes: string[];
}

/**
 * Schema Version
 */
export interface SchemaVersion {
  version: Version;
  schema: Record<string, any>;
  releaseDate: Date;
  compatibleWith: Version[];
}

/**
 * Compatibility Check Result
 */
export interface CompatibilityResult {
  compatible: boolean;
  requiresUpgrade: boolean;
  warnings: string[];
  suggestedVersion?: Version;
}

/**
 * Version Manager
 */
class VersionManager {
  private currentVersion: Version = { major: 1, minor: 0, patch: 0 };
  private apiVersions: Map<string, APIVersion> = new Map();
  private schemaVersions: Map<string, SchemaVersion> = new Map();

  /**
   * Parse version string
   */
  parseVersion(versionString: string): Version {
    const parts = versionString.split('.').map(p => parseInt(p));
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0
    };
  }

  /**
   * Format version to string
   */
  formatVersion(version: Version): string {
    return `${version.major}.${version.minor}.${version.patch}`;
  }

  /**
   * Compare versions
   */
  compareVersions(v1: Version, v2: Version): number {
    if (v1.major !== v2.major) return v1.major - v2.major;
    if (v1.minor !== v2.minor) return v1.minor - v2.minor;
    return v1.patch - v2.patch;
  }

  /**
   * Check if version is compatible
   */
  isCompatible(clientVersion: Version, serverVersion: Version): CompatibilityResult {
    const warnings: string[] = [];
    let compatible = true;
    let requiresUpgrade = false;
    let suggestedVersion: Version | undefined;

    // Major version must match
    if (clientVersion.major !== serverVersion.major) {
      compatible = false;
      requiresUpgrade = true;
      suggestedVersion = serverVersion;
      warnings.push(`Major version mismatch: client ${clientVersion.major} vs server ${serverVersion.major}`);
    }
    // Minor version can differ, but warn if client is too old
    else if (clientVersion.minor < serverVersion.minor - 2) {
      warnings.push(`Client version is outdated. Consider upgrading to ${this.formatVersion(serverVersion)}`);
      requiresUpgrade = true;
      suggestedVersion = serverVersion;
    }
    // Patch version is always compatible
    else if (clientVersion.minor < serverVersion.minor) {
      warnings.push('Minor version difference detected. Some features may be unavailable.');
    }

    return {
      compatible,
      requiresUpgrade,
      warnings,
      suggestedVersion
    };
  }

  /**
   * Register API version
   */
  registerAPIVersion(version: APIVersion): void {
    const versionKey = this.formatVersion(version);
    this.apiVersions.set(versionKey, version);
    logBoth('info', `[Version] Registered API version: ${versionKey}`);
  }

  /**
   * Register schema version
   */
  registerSchemaVersion(schema: SchemaVersion): void {
    const versionKey = this.formatVersion(schema.version);
    this.schemaVersions.set(versionKey, schema);
    logBoth('info', `[Version] Registered schema version: ${versionKey}`);
  }

  /**
   * Get current version
   */
  getCurrentVersion(): Version {
    return { ...this.currentVersion };
  }

  /**
   * Set current version
   */
  setCurrentVersion(version: Version): void {
    this.currentVersion = version;
    logBoth('info', `[Version] Current version set to: ${this.formatVersion(version)}`);
  }

  /**
   * Get API version
   */
  getAPIVersion(versionString: string): APIVersion | undefined {
    return this.apiVersions.get(versionString);
  }

  /**
   * Get schema version
   */
  getSchemaVersion(versionString: string): SchemaVersion | undefined {
    return this.schemaVersions.get(versionString);
  }

  /**
   * Get all API versions
   */
  getAllAPIVersions(): APIVersion[] {
    return Array.from(this.apiVersions.values())
      .sort((a, b) => this.compareVersions(b, a)); // Newest first
  }

  /**
   * Check if API version is deprecated
   */
  isDeprecated(version: Version): boolean {
    const versionKey = this.formatVersion(version);
    const apiVersion = this.apiVersions.get(versionKey);
    
    if (!apiVersion) return false;
    
    if (apiVersion.deprecated) return true;
    
    if (apiVersion.deprecationDate) {
      return new Date() >= apiVersion.deprecationDate;
    }
    
    return false;
  }

  /**
   * Check if API version is end of life
   */
  isEndOfLife(version: Version): boolean {
    const versionKey = this.formatVersion(version);
    const apiVersion = this.apiVersions.get(versionKey);
    
    if (!apiVersion || !apiVersion.endOfLifeDate) return false;
    
    return new Date() >= apiVersion.endOfLifeDate;
  }

  /**
   * Get version info for client
   */
  getVersionInfo(clientVersionString?: string): {
    current: string;
    client?: string;
    compatible: boolean;
    deprecated: boolean;
    endOfLife: boolean;
    warnings: string[];
    suggestedVersion?: string;
  } {
    const current = this.formatVersion(this.currentVersion);
    
    if (!clientVersionString) {
      return {
        current,
        compatible: true,
        deprecated: false,
        endOfLife: false,
        warnings: []
      };
    }

    const clientVersion = this.parseVersion(clientVersionString);
    const compatibility = this.isCompatible(clientVersion, this.currentVersion);
    const deprecated = this.isDeprecated(clientVersion);
    const endOfLife = this.isEndOfLife(clientVersion);

    const warnings = [...compatibility.warnings];
    if (deprecated) {
      warnings.push('This API version is deprecated');
    }
    if (endOfLife) {
      warnings.push('This API version has reached end of life');
    }

    return {
      current,
      client: clientVersionString,
      compatible: compatibility.compatible && !endOfLife,
      deprecated,
      endOfLife,
      warnings,
      suggestedVersion: compatibility.suggestedVersion 
        ? this.formatVersion(compatibility.suggestedVersion) 
        : undefined
    };
  }

  /**
   * Get migration guide
   */
  getMigrationGuide(fromVersion: Version, toVersion: Version): string[] {
    const fromKey = this.formatVersion(fromVersion);
    const toKey = this.formatVersion(toVersion);
    
    const fromAPI = this.apiVersions.get(fromKey);
    const toAPI = this.apiVersions.get(toKey);
    
    if (!toAPI) {
      return ['Target version not found'];
    }

    const changes: string[] = [];
    
    // Collect all changes between versions
    for (const [versionKey, apiVersion] of this.apiVersions) {
      const version = this.parseVersion(versionKey);
      if (this.compareVersions(version, fromVersion) > 0 &&
          this.compareVersions(version, toVersion) <= 0) {
        changes.push(`\n${versionKey}:`);
        changes.push(...apiVersion.changes.map(c => `  - ${c}`));
      }
    }

    return changes;
  }

  /**
   * Initialize default versions
   */
  initializeDefaultVersions(): void {
    // Register v1.0.0
    this.registerAPIVersion({
      major: 1,
      minor: 0,
      patch: 0,
      releaseDate: new Date('2024-01-01'),
      changes: [
        'Initial release',
        'Basic weather queries',
        'Time queries',
        'Officeholder queries'
      ]
    });

    // Register v1.1.0
    this.registerAPIVersion({
      major: 1,
      minor: 1,
      patch: 0,
      releaseDate: new Date('2024-06-01'),
      changes: [
        'Added search functionality',
        'Improved weather data sources',
        'Added caching layer'
      ]
    });

    // Register v1.2.0 (current)
    this.registerAPIVersion({
      major: 1,
      minor: 2,
      patch: 0,
      releaseDate: new Date('2025-01-01'),
      changes: [
        'Added A/B testing',
        'Improved error handling',
        'Added explainability features',
        'Performance optimizations'
      ]
    });

    this.setCurrentVersion({ major: 1, minor: 2, patch: 0 });

    logBoth('info', '[Version] Initialized default versions');
  }

  /**
   * Get version summary
   */
  getSummary(): string {
    const allVersions = this.getAllAPIVersions();
    const current = this.formatVersion(this.currentVersion);

    let summary = `
Version Summary
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
Current Version: ${current}
Total Versions: ${allVersions.length}

Available Versions:
`;

    for (const version of allVersions) {
      const versionStr = this.formatVersion(version);
      const isCurrent = versionStr === current;
      const marker = isCurrent ? 'â†’' : ' ';
      
      summary += `${marker} ${versionStr} (${version.releaseDate.toLocaleDateString()})`;
      
      if (version.deprecated) {
        summary += ' [DEPRECATED]';
      }
      if (version.endOfLifeDate && new Date() >= version.endOfLifeDate) {
        summary += ' [EOL]';
      }
      summary += '\n';
      
      if (isCurrent) {
        summary += '   Changes:\n';
        for (const change of version.changes) {
          summary += `     - ${change}\n`;
        }
      }
    }

    summary += 'â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”';
    return summary.trim();
  }
}

// Export singleton instance
export const versionManager = new VersionManager();

/**
 * Helper: Check compatibility
 */
export function checkVersionCompatibility(clientVersion: string): CompatibilityResult {
  const version = versionManager.parseVersion(clientVersion);
  const current = versionManager.getCurrentVersion();
  return versionManager.isCompatible(version, current);
}

/**
 * Helper: Get version info
 */
export function getVersionInfo(clientVersion?: string) {
  return versionManager.getVersionInfo(clientVersion);
}

/**
 * Helper: Get current version
 */
export function getCurrentVersion(): string {
  return versionManager.formatVersion(versionManager.getCurrentVersion());
}

// Auto-initialize
versionManager.initializeDefaultVersions();
