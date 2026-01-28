import { Router, Request, Response } from 'express';
import { withDbConnection } from '../../../utils/db';
import { hashPassword } from '../../../utils/password';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../../uploads/profiles');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif)'));
    }
  }
});

/**
 * GET /api/user/profile
 * Get current user profile
 */
router.get('/profile', async (req: Request, res: Response) => {
  try {
    // Get user ID from JWT token (you should have middleware for this)
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const users = await withDbConnection(async (conn) => {
      const [rows] = await conn.query(
        `SELECT 
          user_id as userId,
          user_email as email,
          user_disp_name as displayName,
          user_nickname as nickname,
          user_phone as phone,
          user_profile_image as profileImage,
          user_role_id as roleId,
          created_at as createdAt
         FROM \`user\` 
         WHERE user_id = ?`,
        [userId]
      );
      return rows;
    });

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: users[0]
    });

  } catch (error) {
    console.error('[User] Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get profile'
    });
  }
});

/**
 * PUT /api/user/update-profile
 * Update current user profile
 */
router.put('/update-profile', upload.single('profileImage'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const { displayName, nickname, phone } = req.body;
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (displayName) {
      updateFields.push('user_disp_name = ?');
      updateValues.push(displayName);
    }

    if (nickname) {
      updateFields.push('user_nickname = ?');
      updateValues.push(nickname);
    }

    if (phone) {
      updateFields.push('user_phone = ?');
      updateValues.push(phone);
    }

    // Handle profile image upload
    if (req.file) {
      const imagePath = `/uploads/profiles/${req.file.filename}`;
      updateFields.push('user_profile_image = ?');
      updateValues.push(imagePath);

      // Delete old profile image if exists
      const oldImages = await withDbConnection(async (conn) => {
        const [rows] = await conn.query(
          'SELECT user_profile_image FROM `user` WHERE user_id = ?',
          [userId]
        );
        return rows;
      });

      if (Array.isArray(oldImages) && oldImages.length > 0) {
        const oldImage = (oldImages[0] as any).user_profile_image;
        if (oldImage) {
          const oldImagePath = path.join(__dirname, '../../../../', oldImage);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(userId);

    const sql = `UPDATE \`user\` SET ${updateFields.join(', ')} WHERE user_id = ?`;

    await withDbConnection(async (conn) => {
      await conn.query(sql, updateValues);

      // Log activity
      await conn.query(
        `INSERT INTO user_activity_log 
         (user_id, action_type, action_detail, ip_address, user_agent, status, created_at) 
         VALUES (?, 'profile_update', 'Profile updated', ?, ?, 'success', NOW())`,
        [userId, req.ip, req.headers['user-agent'] || 'unknown']
      );
    });

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('[User] Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

/**
 * DELETE /api/user/delete-account
 * Delete current user account
 */
router.delete('/delete-account', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required to delete account'
      });
    }

    // Verify password before deletion
    const users = await withDbConnection(async (conn) => {
      const [rows] = await conn.query(
        'SELECT user_pwd FROM `user` WHERE user_id = ?',
        [userId]
      );
      return rows;
    });

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // TODO: Verify password
    // const isPasswordValid = await comparePassword(password, users[0].user_pwd);
    // if (!isPasswordValid) {
    //   return res.status(401).json({
    //     success: false,
    //     error: 'Invalid password'
    //   });
    // }

    // Soft delete (set user_active = '0')
    await withDbConnection(async (conn) => {
      await conn.query(
        'UPDATE `user` SET user_active = ?, updated_at = NOW() WHERE user_id = ?',
        ['0', userId]
      );

      // Log activity
      await conn.query(
        `INSERT INTO user_activity_log 
         (user_id, action_type, action_detail, ip_address, user_agent, status, created_at) 
         VALUES (?, 'account_deleted', 'Account deleted by user', ?, ?, 'success', NOW())`,
        [userId, req.ip, req.headers['user-agent'] || 'unknown']
      );
    });

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error) {
    console.error('[User] Delete account error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete account'
    });
  }
});

export default router;
