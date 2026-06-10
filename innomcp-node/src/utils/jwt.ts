import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import * as sessionRegistry from '../services/sessionRegistry';

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'innomcp-secret-key-change-in-production';

// Validate secret strength at startup
if (JWT_SECRET === 'innomcp-secret-key-change-in-production' || JWT_SECRET.length < 32) {
  console.error(
    'FATAL: JWT_SECRET is insecure. Set a strong secret (≥ 32 chars) via JWT_SECRET environment variable.'
  );
  process.exit(1);
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // 7 days
const REFRESH_TOKEN_EXPIRES_IN = '30d'; // 30 days

export interface JWTPayload {
  userId: number;
  userEmail: string;
  userRoleId: number;
  userDispName: string;
  /** JWT ID — unique per token, used for session tracking and revocation */
  jti?: string;
  scope?: string[];
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: JWTPayload;
}

/**
 * Generate access token.
 * Embeds a unique `jti` (JWT ID) for session tracking and force-logout support.
 * @param payload User data to encode in token
 * @returns JWT token string
 */
export function generateAccessToken(
  payload: Omit<JWTPayload, 'iat' | 'exp' | 'scope'>,
  scope?: string[]
): string {
  const jti = payload.jti ?? crypto.randomUUID();
  return jwt.sign(
    { ...payload, jti, ...(scope ? { scope } : {}) },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN as string,
      issuer: 'innomcp',
      audience: 'innomcp-client',
    } as jwt.SignOptions
  );
}

/**
 * Generate refresh token (longer expiry)
 * @param payload User data to encode in token
 * @returns JWT refresh token string
 */
export function generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    issuer: 'innomcp',
    audience: 'innomcp-client'
  });
}

/**
 * Verify and decode JWT token
 * @param token JWT token string
 * @returns Decoded payload or null if invalid
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'innomcp',
      audience: 'innomcp-client'
    }) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.warn('[JWT] Token expired:', error.message);
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.warn('[JWT] Invalid token:', error.message);
    } else {
      console.error('[JWT] Verification error:', error);
    }
    return null;
  }
}

/**
 * Extract token from request (cookie or auth header)
 * @param req Express request object
 * @returns Token string or null
 */
export function extractToken(req: Request): string | null {
  // 1. Check httpOnly cookie (preferred for security)
  if (req.cookies?.token) {
    return req.cookies.token;
  }

  // 2. Check auth header (token-scheme)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Middleware to protect routes requiring authentication.
 * Attaches user data to req.user if token is valid.
 * Also checks the session registry for revoked tokens (force-logout support)
 * and updates lastSeen on every authenticated request.
 */
export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'No token provided'
    });
    return;
  }

  const user = verifyToken(token);

  if (!user) {
    res.status(403).json({
      success: false,
      error: 'Invalid or expired token',
      message: 'Please login again'
    });
    return;
  }

  // Check if this session has been force-revoked
  if (user.jti && sessionRegistry.isRevoked(user.jti)) {
    res.status(401).json({
      success: false,
      error: 'Session revoked',
      message: 'Your session has been terminated. Please login again'
    });
    return;
  }

  // Update lastSeen for active session tracking
  if (user.jti) {
    sessionRegistry.touch(user.jti);
  }

  // Attach user data to request
  req.user = user;
  next();
}

/**
 * Optional authentication middleware
 * Attaches user data if token exists, but doesn't block request
 */
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (token) {
    const user = verifyToken(token);
    if (user) {
      req.user = user;
    }
  }

  next();
}

/**
 * Middleware to check if user has specific role
 * Must be used after authenticateToken
 */
export function requireRole(...allowedRoles: number[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    if (!allowedRoles.includes(req.user.userRoleId)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: `This action requires role: ${allowedRoles.join(' or ')}`
      });
      return;
    }

    next();
  };
}

/**
 * Set JWT token in httpOnly cookie
 * @param res Express response object
 * @param token JWT token string
 * @param isRefreshToken Whether this is a refresh token (longer expiry)
 */
export function setTokenCookie(res: Response, token: string, isRefreshToken = false): void {
  const cookieName = isRefreshToken ? 'refreshToken' : 'token';
  const maxAge = isRefreshToken ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000; // 30 days or 7 days

  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'lax',
    maxAge,
    path: '/'
  });
}

/**
 * Clear authentication cookies
 * @param res Express response object
 */
export function clearTokenCookies(res: Response): void {
  res.clearCookie('token', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
}

/**
 * Middleware to require specific scope(s) for a route.
 * Must be used after `authenticateToken`.
 */
export function requireScope(...requiredScopes: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user || !user.scope) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: 'No scopes available for this user',
      });
      return;
    }

    const hasAll = requiredScopes.every(s => user.scope!.includes(s));
    if (!hasAll) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: `Required scopes: ${requiredScopes.join(', ')}`,
      });
      return;
    }

    next();
  };
}
