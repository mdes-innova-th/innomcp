/**
 * Data Validation & Sanitization
 * à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¹à¸¥à¸°à¸—à¸³à¸„à¸§à¸²à¸¡à¸ªà¸°à¸­à¸²à¸”à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸­à¸´à¸™à¸žà¸¸à¸•
 * 
 * Features:
 * - Input validation
 * - Data sanitization
 * - Type checking
 * - Format validation
 * 
 * @module utils/validation
 */

import { logBoth } from '../mcpLogger';

/**
 * Validation Result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
  sanitized?: any;
}

/**
 * Field Validation Rule
 */
export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any) => boolean | string;
}

/**
 * Schema Definition
 */
export type ValidationSchema = Record<string, ValidationRule>;

/**
 * Data Validator
 */
class DataValidator {
  /**
   * Validate data against schema
   */
  validate(data: any, schema: ValidationSchema): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const sanitized: any = {};

    for (const [field, rule] of Object.entries(schema)) {
      const value = data[field];

      // Check required
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }

      // Skip validation if not required and value is empty
      if (!rule.required && (value === undefined || value === null || value === '')) {
        continue;
      }

      // Type validation
      if (rule.type) {
        const typeValid = this.validateType(value, rule.type);
        if (!typeValid) {
          errors.push(`${field} must be of type ${rule.type}`);
          continue;
        }
      }

      // String validations
      if (rule.type === 'string' && typeof value === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push(`${field} must be at least ${rule.minLength} characters`);
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push(`${field} must be at most ${rule.maxLength} characters`);
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(`${field} format is invalid`);
        }
      }

      // Number validations
      if (rule.type === 'number' && typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors.push(`${field} must be at least ${rule.min}`);
        }
        if (rule.max !== undefined && value > rule.max) {
          errors.push(`${field} must be at most ${rule.max}`);
        }
      }

      // Enum validation
      if (rule.enum && !rule.enum.includes(value)) {
        errors.push(`${field} must be one of: ${rule.enum.join(', ')}`);
      }

      // Custom validation
      if (rule.custom) {
        const customResult = rule.custom(value);
        if (typeof customResult === 'string') {
          errors.push(customResult);
        } else if (!customResult) {
          errors.push(`${field} failed custom validation`);
        }
      }

      // Add sanitized value
      sanitized[field] = value;
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
      sanitized
    };
  }

  /**
   * Validate type
   */
  private validateType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'date':
        return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
      default:
        return false;
    }
  }

  /**
   * Sanitize string (remove dangerous characters)
   */
  sanitizeString(input: string): string {
    if (typeof input !== 'string') return '';
    
    // Remove control characters
    let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    return sanitized;
  }

  /**
   * Sanitize HTML (basic protection)
   */
  sanitizeHTML(input: string): string {
    if (typeof input !== 'string') return '';
    
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Validate email
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate URL
   */
  isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate Thai phone number
   */
  isValidThaiPhone(phone: string): boolean {
    // à¸•à¸±à¸”à¸­à¸±à¸à¸‚à¸£à¸°à¸žà¸´à¹€à¸¨à¸©à¸­à¸­à¸
    const cleaned = phone.replace(/[\s\-()]/g, '');
    
    // à¸£à¸¹à¸›à¹à¸šà¸š: 0812345678 à¸«à¸£à¸·à¸­ +66812345678
    const thaiPhoneRegex = /^(\+66|0)[0-9]{9}$/;
    return thaiPhoneRegex.test(cleaned);
  }

  /**
   * Validate Thai ID card number (13 digits)
   */
  isValidThaiID(id: string): boolean {
    // Remove spaces/dashes
    const cleaned = id.replace(/[\s\-]/g, '');
    
    // Must be 13 digits
    if (!/^\d{13}$/.test(cleaned)) {
      return false;
    }

    // Checksum validation
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cleaned[i]) * (13 - i);
    }
    const checkDigit = (11 - (sum % 11)) % 10;
    
    return checkDigit === parseInt(cleaned[12]);
  }

  /**
   * Sanitize query parameters
   */
  sanitizeQueryParams(params: Record<string, any>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (value !== null && value !== undefined) {
        sanitized[key] = String(value);
      }
    }
    
    return sanitized;
  }

  /**
   * Validate and parse JSON
   */
  parseJSON(input: string): { valid: boolean; data?: any; error?: string } {
    try {
      const data = JSON.parse(input);
      return { valid: true, data };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Validate date range
   */
  isValidDateRange(startDate: Date, endDate: Date): boolean {
    return startDate <= endDate;
  }

  /**
   * Limit string length
   */
  truncate(text: string, maxLength: number, suffix: string = '...'): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - suffix.length) + suffix;
  }
}

// Export singleton instance
export const validator = new DataValidator();

/**
 * Helper: Validate data
 */
export function validateData(data: any, schema: ValidationSchema): ValidationResult {
  return validator.validate(data, schema);
}

/**
 * Helper: Sanitize string
 */
export function sanitizeString(input: string): string {
  return validator.sanitizeString(input);
}

/**
 * Helper: Sanitize HTML
 */
export function sanitizeHTML(input: string): string {
  return validator.sanitizeHTML(input);
}

/**
 * Helper: Validate email
 */
export function isValidEmail(email: string): boolean {
  return validator.isValidEmail(email);
}

/**
 * Helper: Validate URL
 */
export function isValidURL(url: string): boolean {
  return validator.isValidURL(url);
}

/**
 * Pre-defined schemas
 */
export const commonSchemas = {
  chatMessage: {
    message: {
      required: true,
      type: 'string' as const,
      minLength: 1,
      maxLength: 5000
    },
    sessionId: {
      type: 'string' as const,
      pattern: /^[a-zA-Z0-9-_]+$/
    }
  },
  
  userFeedback: {
    rating: {
      required: true,
      type: 'number' as const,
      min: 1,
      max: 5
    },
    category: {
      required: true,
      type: 'string' as const,
      enum: ['accuracy', 'speed', 'helpfulness', 'ui', 'other']
    },
    comment: {
      type: 'string' as const,
      maxLength: 1000
    }
  },
  
  searchQuery: {
    query: {
      required: true,
      type: 'string' as const,
      minLength: 1,
      maxLength: 500
    },
    topK: {
      type: 'number' as const,
      min: 1,
      max: 20
    }
  }
};
