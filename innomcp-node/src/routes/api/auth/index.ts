import { Router, Request, Response } from 'express';
import { withDbConnection } from '../../../utils/db';
import { hashPassword, comparePassword, validatePasswordStrength } from '../../../utils/password';
import { generateAccessToken, generateRefreshToken, setTokenCookie, clearTokenCookies } from '../../../utils/jwt';
import crypto from 'crypto';

const router = Router();

/**
 * POST /api/auth/register
 * Register new user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, displayName, nickname } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Password does not meet requirements',
        details: passwordValidation.errors
      });
    }

    // Check if user already exists
    const existingUsers = await withDbConnection(async (conn) => {
      const [rows] = await conn.query(
        'SELECT user_id FROM `user` WHERE user_email = ?',
        [email]
      );
      return rows;
    });

    if (Array.isArray(existingUsers) && existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered'
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Insert new user and create default workspace
    const userId = await withDbConnection(async (conn) => {
      const generatedUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 45);
      const [result] = await conn.query(
        `INSERT INTO \`user\` 
         (username, user_email, password, user_dispname, userrole_id, user_active) 
         VALUES (?, ?, ?, ?, ?, '1')`,
        [generatedUsername, email, hashedPassword, displayName || email.split('@')[0], 2] // userrole_id 2 = normal user
      );

      const newUserId = (result as any).insertId;

      // Create default workspace for user
      await conn.query(
        `INSERT INTO user_workspaces 
         (user_id, workspace_name, workspace_slug, is_default, created_at, updated_at) 
         VALUES (?, ?, ?, 1, NOW(), NOW())`,
        [newUserId, 'My Workspace', `workspace-${newUserId}`]
      );

      return newUserId;
    });

    // Generate tokens
    const tokenPayload = {
      userId,
      userEmail: email,
      userRoleId: 2,
      userDispName: displayName || email.split('@')[0]
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Set cookies
    setTokenCookie(res, accessToken, false);
    setTokenCookie(res, refreshToken, true);

    // Log registration
    await withDbConnection(async (conn) => {
      await conn.query(
        `INSERT INTO user_activity_log 
         (user_id, action_type, action_detail, ip_address, user_agent, status, created_at) 
         VALUES (?, 'register', 'User registered successfully', ?, ?, 'success', NOW())`,
        [userId, req.ip, req.headers['user-agent'] || 'unknown']
      );
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        userId,
        email,
        displayName: displayName || email.split('@')[0]
      }
    });

  } catch (error) {
    console.error('[Auth] Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      message: 'An error occurred during registration'
    });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    console.log('\n🔐 ========================================');
    console.log('🔐 LOGIN ATTEMPT');
    console.log('🔐 ========================================');
    console.log(`📧 Email: ${email}`);    console.log(`🔑 Password length: ${password?.length || 0} chars`);    console.log(`🌐 IP: ${req.ip}`);
    console.log(`🖥️  User-Agent: ${req.headers['user-agent']?.substring(0, 50)}...`);
    console.log('🔐 ========================================\n');

    // Validation
    if (!email || !password) {
      console.log('❌ LOGIN FAILED: Missing credentials');
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Find user by email
    const users = await withDbConnection(async (conn) => {
      const [rows] = await conn.query(
        'SELECT user_id, user_email, password, user_dispname, userrole_id FROM `user` WHERE user_email = ?',
        [email]
      );
      return rows;
    });

    if (!Array.isArray(users) || users.length === 0) {
      console.log(`❌ LOGIN FAILED: User not found (${email})`);
      
      // Log failed attempt (table may not exist)
      try {
        await withDbConnection(async (conn) => {
          await conn.query(
            `INSERT INTO user_activity_log 
             (action_type, action_detail, ip_address, user_agent, status, created_at) 
             VALUES ('login_failed', ?, ?, ?, 'failure', NOW())`,
            [`Failed login attempt for email: ${email}`, req.ip, req.headers['user-agent'] || 'unknown']
          );
        });
      } catch (_e) { /* table may not exist */ }

      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    const user = users[0] as any;
    
    console.log(`✅ User found: ${user.user_email} (ID: ${user.user_id}, Role: ${user.userrole_id})`);
    console.log(`🔑 Comparing password...`);

    // Compare password
    const isPasswordValid = await comparePassword(password, user.password);
    
    console.log(`🔑 Password valid: ${isPasswordValid}`);

    if (!isPasswordValid) {
      console.log(`❌ LOGIN FAILED: Invalid password for ${user.user_email}`);
      // Log failed attempt (table may not exist)
      try {
        await withDbConnection(async (conn) => {
          await conn.query(
            `INSERT INTO user_activity_log 
             (user_id, action_type, action_detail, ip_address, user_agent, status, created_at) 
             VALUES (?, 'login_failed', 'Invalid password', ?, ?, 'failure', NOW())`,
            [user.user_id, req.ip, req.headers['user-agent'] || 'unknown']
          );
        });
      } catch (_e) { /* table may not exist */ }

      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    console.log(`✅ LOGIN SUCCESS: ${user.user_email}`);
    console.log(`👤 User: ${user.user_dispname} (Role ID: ${user.userrole_id})`);
    console.log(`🎯 Capability Level: ${user.userrole_id !== null ? '100%' : '50% (Guest)'}`);
    
    // Generate tokens
    const tokenPayload = {
      userId: user.user_id,
      userEmail: user.user_email,
      userRoleId: user.userrole_id,
      userDispName: user.user_dispname
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    
    console.log(`🎫 Tokens generated (Access + Refresh)`);

    // Set cookies
    setTokenCookie(res, accessToken, false);
    setTokenCookie(res, refreshToken, true);
    
    console.log(`🍪 Cookies set successfully`);

    // Create session and log login (tables may not exist)
    try {
      await withDbConnection(async (conn) => {
        // Generate unique session ID using crypto
        const sessionId = crypto.randomUUID() + '_' + Date.now();
        
        await conn.query(
          `INSERT INTO user_sessions 
           (user_id, session_id, device_info, expires_at, created_at, last_activity) 
           VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY), NOW(), NOW())`,
          [
            user.user_id,
            sessionId,
            JSON.stringify({ 
              type: 'web', 
              platform: req.headers['user-agent'] || 'unknown',
              ip: req.ip
            })
          ]
        );

        // Log successful login
        await conn.query(
          `INSERT INTO user_activity_log 
           (user_id, action_type, action_detail, ip_address, user_agent, status, created_at) 
           VALUES (?, 'login', 'User logged in successfully', ?, ?, 'success', NOW())`,
          [user.user_id, req.ip, req.headers['user-agent'] || 'unknown']
        );
      });
    } catch (_e) { console.log('[Auth] Session/activity_log write skipped (tables may not exist)'); }

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        userId: user.user_id,
        email: user.user_email,
        displayName: user.user_dispname,
        roleId: user.userrole_id
      }
    });

  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      message: 'An error occurred during login'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout current user
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    // Clear cookies
    clearTokenCookies(res);

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('[Auth] Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Find user by email
    const users = await withDbConnection(async (conn) => {
      const [rows] = await conn.query(
        'SELECT user_id, user_email, user_disp_name FROM `user` WHERE user_email = ?',
        [email]
      );
      return rows;
    });

    // Always return success even if user not found (security best practice)
    if (!Array.isArray(users) || users.length === 0) {
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    }

    const user = users[0] as any;

    // Generate reset token (32 bytes = 64 hex characters)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpire = new Date(Date.now() + 3600000); // 1 hour from now

    // Save reset token to database
    await withDbConnection(async (conn) => {
      await conn.query(
        'UPDATE `user` SET reset_token = ?, reset_token_expire = ? WHERE user_id = ?',
        [resetToken, resetTokenExpire, user.user_id]
      );

      // Log activity
      await conn.query(
        `INSERT INTO user_activity_log 
         (user_id, action_type, action_detail, ip_address, user_agent, status, created_at) 
         VALUES (?, 'password_reset_request', 'Password reset requested', ?, ?, 'success', NOW())`,
        [user.user_id, req.ip, req.headers['user-agent'] || 'unknown']
      );
    });

    // TODO: Send email with reset link
    // For now, just log the reset link (in production, send via email service)
    const resetUrl = `http://localhost:3000/reset-password?token=${resetToken}`;
    console.log(`[Auth] Password reset link for ${email}: ${resetUrl}`);

    // In production, you would send an email here:
    // await sendPasswordResetEmail(user.user_email, user.user_disp_name, resetUrl);

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent',
      // Only include this in development mode
      ...(process.env.NODE_ENV === 'development' && { resetUrl })
    });

  } catch (error) {
    console.error('[Auth] Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process password reset request'
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password using token
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    // Validation
    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: 'Token and password are required'
      });
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Password does not meet requirements',
        details: passwordValidation.errors
      });
    }

    // Find user by reset token
    const users = await withDbConnection(async (conn) => {
      const [rows] = await conn.query(
        'SELECT user_id, user_email, user_disp_name, reset_token_expire FROM `user` WHERE reset_token = ?',
        [token]
      );
      return rows;
    });

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
    }

    const user = users[0] as any;

    // Check if token is expired
    const tokenExpire = new Date(user.reset_token_expire);
    if (tokenExpire < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Reset token has expired. Please request a new password reset'
      });
    }

    // Hash new password
    const hashedPassword = await hashPassword(password);

    // Update password and clear reset token
    await withDbConnection(async (conn) => {
      await conn.query(
        'UPDATE `user` SET user_pwd = ?, reset_token = NULL, reset_token_expire = NULL, updated_at = NOW() WHERE user_id = ?',
        [hashedPassword, user.user_id]
      );

      // Log activity
      await conn.query(
        `INSERT INTO user_activity_log 
         (user_id, action_type, action_detail, ip_address, user_agent, status, created_at) 
         VALUES (?, 'password_reset', 'Password reset successfully', ?, ?, 'success', NOW())`,
        [user.user_id, req.ip, req.headers['user-agent'] || 'unknown']
      );
    });

    res.json({
      success: true,
      message: 'Password has been reset successfully'
    });

  } catch (error) {
    console.error('[Auth] Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password'
    });
  }
});

export default router;
