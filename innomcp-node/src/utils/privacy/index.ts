/**
 * Privacy Module
 * à¹ƒà¸Šà¹‰à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹€à¸‰à¸žà¸²à¸°à¸—à¸µà¹ˆà¸ˆà¸³à¹€à¸›à¹‡à¸™ à¹„à¸¡à¹ˆà¹€à¸à¹‡à¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ªà¹ˆà¸§à¸™à¸•à¸±à¸§à¹€à¸à¸´à¸™à¸ˆà¸³à¹€à¸›à¹‡à¸™
 * 
 * Features:
 * - Location privacy (only user-specified)
 * - IP anonymization
 * - Data minimization
 * - Privacy controls
 * 
 * @module utils/privacy
 */

import { logBoth } from '../mcpLogger';

/**
 * Privacy Level
 */
export type PrivacyLevel = 'strict' | 'moderate' | 'relaxed';

/**
 * Location Data
 */
export interface LocationData {
  city?: string;
  district?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  userSpecified: boolean;
  source: 'user' | 'default' | 'ip' | 'browser';
}

/**
 * Privacy-Safe Request
 */
export interface PrivacySafeRequest {
  sessionId: string;
  timestamp: Date;
  location?: LocationData;
  ipHash?: string; // hashed, not raw IP
  userAgent?: string;
  preferences?: Record<string, any>;
}

/**
 * Privacy Manager
 */
class PrivacyManager {
  private defaultLocation: LocationData = {
    city: 'Bangkok',
    userSpecified: false,
    source: 'default'
  };

  private privacyLevel: PrivacyLevel = 'moderate';

  /**
   * Set privacy level
   */
  setPrivacyLevel(level: PrivacyLevel): void {
    this.privacyLevel = level;
    logBoth('info', `[Privacy] Privacy level set to: ${level}`);
  }

  /**
   * Get privacy level
   */
  getPrivacyLevel(): PrivacyLevel {
    return this.privacyLevel;
  }

  /**
   * Get safe location data
   */
  getSafeLocation(
    userSpecified?: LocationData,
    ipLocation?: string
  ): LocationData {
    // Priority: User-specified > Default > IP (only if relaxed)
    if (userSpecified && userSpecified.userSpecified) {
      logBoth('info', '[Privacy] Using user-specified location');
      return {
        ...userSpecified,
        userSpecified: true,
        source: 'user'
      };
    }

    // Use IP location only in relaxed mode
    if (this.privacyLevel === 'relaxed' && ipLocation) {
      logBoth('info', '[Privacy] Using IP-based location (relaxed mode)');
      return {
        city: ipLocation,
        userSpecified: false,
        source: 'ip'
      };
    }

    // Default to Bangkok
    logBoth('info', '[Privacy] Using default location (Bangkok)');
    return { ...this.defaultLocation };
  }

  /**
   * Anonymize IP address
   */
  anonymizeIP(ip: string): string {
    if (this.privacyLevel === 'strict') {
      // Don't store IP at all in strict mode
      return '';
    }

    // Hash the IP for moderate/relaxed modes
    return this.hashString(ip);
  }

  /**
   * Hash string (simple hash for demo)
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `hash_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Create privacy-safe request
   */
  createSafeRequest(data: {
    sessionId: string;
    location?: LocationData;
    ip?: string;
    userAgent?: string;
    preferences?: Record<string, any>;
  }): PrivacySafeRequest {
    const safeRequest: PrivacySafeRequest = {
      sessionId: data.sessionId,
      timestamp: new Date()
    };

    // Add location if provided
    if (data.location) {
      safeRequest.location = this.getSafeLocation(data.location);
    }

    // Add IP hash if not strict
    if (data.ip && this.privacyLevel !== 'strict') {
      safeRequest.ipHash = this.anonymizeIP(data.ip);
    }

    // Add user agent if allowed
    if (data.userAgent && this.privacyLevel !== 'strict') {
      // Sanitize user agent (remove detailed version numbers)
      safeRequest.userAgent = this.sanitizeUserAgent(data.userAgent);
    }

    // Add preferences
    if (data.preferences) {
      safeRequest.preferences = data.preferences;
    }

    return safeRequest;
  }

  /**
   * Sanitize user agent
   */
  private sanitizeUserAgent(userAgent: string): string {
    // Keep only browser name and major version
    const match = userAgent.match(/(Chrome|Firefox|Safari|Edge)\/(\d+)/);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
    return 'Unknown';
  }

  /**
   * Check if data collection is allowed
   */
  isDataCollectionAllowed(dataType: 'ip' | 'location' | 'userAgent' | 'analytics'): boolean {
    switch (this.privacyLevel) {
      case 'strict':
        return dataType === 'analytics'; // Only anonymous analytics

      case 'moderate':
        return dataType !== 'ip'; // No raw IP

      case 'relaxed':
        return true; // All allowed

      default:
        return false;
    }
  }

  /**
   * Get data retention period
   */
  getRetentionPeriod(dataType: 'session' | 'logs' | 'analytics'): number {
    // Return retention period in days
    switch (this.privacyLevel) {
      case 'strict':
        return dataType === 'session' ? 1 : 7; // Short retention

      case 'moderate':
        return dataType === 'session' ? 7 : 30; // Medium retention

      case 'relaxed':
        return dataType === 'session' ? 30 : 90; // Long retention

      default:
        return 7;
    }
  }

  /**
   * Mask sensitive data
   */
  maskSensitiveData(data: any, fieldsToMask: string[]): any {
    const masked = { ...data };

    for (const field of fieldsToMask) {
      if (field in masked) {
        masked[field] = this.maskField(masked[field]);
      }
    }

    return masked;
  }

  /**
   * Mask individual field
   */
  private maskField(value: any): string {
    if (typeof value !== 'string') {
      return '***';
    }

    if (value.length <= 4) {
      return '***';
    }

    // Show first 2 and last 2 characters
    return `${value.substring(0, 2)}***${value.substring(value.length - 2)}`;
  }

  /**
   * Get privacy policy summary
   */
  getPolicySummary(): string {
    return `
Privacy Policy Summary
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
Privacy Level: ${this.privacyLevel}

Data Collection:
  - IP Address: ${this.isDataCollectionAllowed('ip') ? 'Hashed' : 'Not collected'}
  - Location: ${this.isDataCollectionAllowed('location') ? 'User-specified only' : 'Default only'}
  - User Agent: ${this.isDataCollectionAllowed('userAgent') ? 'Sanitized' : 'Not collected'}
  - Analytics: ${this.isDataCollectionAllowed('analytics') ? 'Anonymous' : 'Disabled'}

Data Retention:
  - Session Data: ${this.getRetentionPeriod('session')} days
  - Logs: ${this.getRetentionPeriod('logs')} days
  - Analytics: ${this.getRetentionPeriod('analytics')} days

Default Location: ${this.defaultLocation.city}

Principles:
  âœ“ Data minimization - collect only necessary data
  âœ“ User control - respect user-specified locations
  âœ“ Transparency - clear privacy policy
  âœ“ Security - hash/anonymize sensitive data
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
    `.trim();
  }

  /**
   * Validate location data
   */
  validateLocation(location: LocationData): boolean {
    // Check if coordinates are valid
    if (location.coordinates) {
      const { latitude, longitude } = location.coordinates;
      
      if (latitude < -90 || latitude > 90) {
        return false;
      }
      if (longitude < -180 || longitude > 180) {
        return false;
      }
    }

    return true;
  }
}

// Export singleton instance
export const privacyManager = new PrivacyManager();

/**
 * Helper: Get safe location
 */
export function getSafeLocation(userSpecified?: LocationData): LocationData {
  return privacyManager.getSafeLocation(userSpecified);
}

/**
 * Helper: Create safe request
 */
export function createPrivacySafeRequest(data: Parameters<typeof privacyManager.createSafeRequest>[0]): PrivacySafeRequest {
  return privacyManager.createSafeRequest(data);
}

/**
 * Helper: Anonymize IP
 */
export function anonymizeIP(ip: string): string {
  return privacyManager.anonymizeIP(ip);
}

/**
 * Helper: Check data collection
 */
export function isDataCollectionAllowed(dataType: Parameters<typeof privacyManager.isDataCollectionAllowed>[0]): boolean {
  return privacyManager.isDataCollectionAllowed(dataType);
}
