import bcrypt from 'bcryptjs';

// Salt rounds for password hashing (10-12 recommended for security/performance balance)
const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 * @param password Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(password, salt);
    return hash;
  } catch (error) {
    console.error('[Password] Hashing error:', error);
    throw new Error('Failed to hash password');
  }
}

/**
 * Compare plain text password with hashed password
 * @param password Plain text password
 * @param hashedPassword Hashed password from database
 * @returns True if passwords match
 */
export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    const isMatch = await bcrypt.compare(password, hashedPassword);
    return isMatch;
  } catch (error) {
    console.error('[Password] Comparison error:', error);
    return false;
  }
}

/**
 * Validate password strength
 * Requirements:
 * - At least 8 characters
 * - Contains at least one uppercase letter
 * - Contains at least one lowercase letter
 * - Contains at least one number
 * - Contains at least one special character
 * 
 * @param password Plain text password
 * @returns Object with isValid flag and error message
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Generate a secure random token for password reset
 * @param length Token length (default 32)
 * @returns Random hex string
 */
export function generateResetToken(length: number = 32): string {
  const crypto = require('crypto');
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash reset token for storage in database
 * @param token Plain reset token
 * @returns Hashed token
 */
export async function hashResetToken(token: string): Promise<string> {
  return hashPassword(token);
}
