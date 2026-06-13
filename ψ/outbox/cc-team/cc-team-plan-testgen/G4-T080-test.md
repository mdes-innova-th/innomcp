<!-- cc-team deliverable
 group: G4 (Generate jest unit tests for untested innomcp-node modules (batch 4))
 member: T080 role=test model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":2304,"completion_tokens":3690,"total_tokens":5994,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 47s
 generated: 2026-06-13T11:08:18.598Z -->
```typescript
import express from 'express';
import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';

// Mock dependencies BEFORE importing the module under test
jest.mock('../../../utils/db', () => ({
  withDbConnection: jest.fn(),
}));

jest.mock('../../../utils/password', () => ({
  hashPassword: jest.fn(),
}));

jest.mock('multer', () => {
  const mockUploadSingle = jest.fn();
  const multerFn: any = jest.fn(() => ({
    single: mockUploadSingle,
  }));
  multerFn.diskStorage = jest.fn(() => ({}));
  return multerFn;
});

import { withDbConnection } from '../../../utils/db';
import { hashPassword } from '../../../utils/password';
import multer from 'multer';

// Import module under test
import profileRouter from '../src/routes/api/user/profile';

const mockedWithDbConnection = withDbConnection as jest.MockedFunction<typeof withDbConnection>;
const mockedHashPassword = hashPassword as jest.MockedFunction<typeof hashPassword>;
const mockedMulter = multer as jest.MockedFunction<typeof multer>;

// Helper to create mock request/response
const createMockReq = (overrides: Partial<Request> = {}): Request => {
  return {
    body: {},
    headers: {},
    ip: '127.0.0.1',
    file: undefined,
    ...overrides,
  } as Request;
};

const createMockRes = (): Response => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

const createMockNext = (): NextFunction => jest.fn();

describe('Profile Router', () => {
  let app: express.Application;
  let mockConn: any;
  let router: express.Router;

  beforeAll(() => {
    app = express();
    app.use(express.json());
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockConn = {
      query: jest.fn(),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Module exports', () => {
    test('should export a router', () => {
      expect(profileRouter).toBeDefined();
      expect(typeof profileRouter).toBe('function');
    });
  });

  describe('GET /profile', () => {
    let routeLayer: any;
    let getHandler: any;

    beforeEach(() => {
      router = profileRouter;
      const stack = (router as any).stack;
      const route = stack.find((layer: any) => layer.route && layer.route.path === '/profile' && layer.route.methods.get);
      routeLayer = route;
      getHandler = route.route.stack[0].handle;
    });

    test('should return 401 when user is not authenticated', async () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      await getHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
      });
    });

    test('should return user profile when authenticated', async () => {
      const userId = 123;
      const mockUser = {
        userId: 123,
        email: 'test@example.com',
        displayName: 'Test User',
        nickname: 'tester',
        phone: '1234567890',
        profileImage: '/uploads/profiles/test.jpg',
        roleId: 1,
        createdAt: new Date(),
      };

      mockedWithDbConnection.mockResolvedValueOnce([mockUser]);

      const req = createMockReq();
      (req as any).user = { userId };
      const res = createMockRes();
      const next = createMockNext();

      await getHandler(req, res, next);

      expect(mockedWithDbConnection).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUser,
      });
    });

    test('should return 404 when user not found', async () => {
      const userId = 999;
      mockedWithDbConnection.mockResolvedValueOnce([]);

      const req = createMockReq();
      (req as any).user = { userId };
      const res = createMockRes();
      const next = createMockNext();

      await getHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
      });
    });

    test('should return 404 when result is not an array', async () => {
      const userId = 123;
      mockedWithDbConnection.mockResolvedValueOnce(null);

      const req = createMockReq();
      (req as any).user = { userId };
      const res = createMockRes();
      const next = createMockNext();

      await getHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('should return 500 on database error', async () => {
      const userId = 123;
      mockedWithDbConnection.mockRejectedValueOnce(new Error('DB error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const req = createMockReq();
      (req as any).user = { userId };
      const res = createMockRes();
      const next = createMockNext();

      await getHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get profile',
      });

      consoleSpy.mockRestore();
    });
  });

  describe('PUT /update-profile', () => {
    let putHandler: any;
    let mockUploadMiddleware: any;

    beforeEach(() => {
      // Reset multer single middleware
      mockUploadMiddleware = jest.fn((req: any, res: any, next: any) => {
        // Apply multer single behavior - no file by default
        if (req._file) {
          req.file = req._file;
        }
        next();
      });
      
      (mockedMulter as any).mockReturnValue({
        single: jest.fn(() => mockUploadMiddleware),
      });

      router = profileRouter;
      const stack = (router as any).stack;
      const route = stack.find((layer: any) => layer.route && layer.route.path === '/update-profile' && layer.route.methods.put);
      
      // The route has middleware + handler, so stack has 2 items
      // First is multer upload, second is the actual handler
      const handlerIndex = route.route.stack.length - 1;
      putHandler = route.route.stack[handlerIndex].handle;
    });

    test('should return 401 when user is not authenticated', async () => {
      const req = createMockReq({
        body: { displayName: 'New Name' },
      });
      const res = createMockRes();
      const next = createMockNext();

      // Apply multer middleware first
      await new Promise<void>((resolve) => {
        mockUploadMiddleware(req, res, () => resolve());
      });

      await putHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
      });
    });

    test('should return 400 when no fields to update', async () => {
      const userId = 123;
      const req = createMockReq({
        body: {},
      });
      (req as any).user = { userId };
      const res = createMockRes();
      const next = createMockNext();

      await new Promise<void>((resolve) => {
        mockUploadMiddleware(req, res, () => resolve());
      });

      await putHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No fields to update',
      });
    });

    test('should update profile with displayName', async () => {
      const userId = 123;
      const req = createMockReq({
        body: { displayName: 'New Name' },
      });
      (req as any).user = { userId };
      (req as any).ip = '127.0.0.1';
      const res = createMockRes();
      const next = createMockNext();

      mockedWithDbConnection.mockResolvedValueOnce(undefined);

      await new Promise<void>((resolve) => {
        mockUploadMiddleware(req, res, () => resolve());
      });

      await putHandler(req, res, next);

      expect(mockedWithDbConnection).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Profile updated successfully',
      });
    });

    test('should update profile with multiple fields', async () => {
      const userId = 123;
      const req = createMockReq({
        body: { 
          displayName: 'New Name',
          nickname: 'newnick',
          phone: '9876543210',
        },
      });
      (req as any).user = { userId };
      const res = createMockRes();
      const next = createMockNext();

      mockedWithDbConnection.mockResolvedValueOnce(undefined);

      await new Promise<void>((resolve) => {
        mockUploadMiddleware(req, res, () => resolve());
      });

      await putHandler(req, res, next);

      expect(mockedWithDbConnection).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Profile updated successfully',
      });
    });

    test('should handle profile image upload', async () => {
      const userId = 123;
      const req = createMockReq({
        body: { displayName: 'New Name' },
      });
      (req as any).user = { userId };
      
      // Mock file
      const mockFile = {
        filename: 'profile-123.jpg',
        originalname: 'test.jpg',
      };
      
      const res = createMockRes();
      const next = createMockNext();

      // Simulate multer setting req.file
      const customUploadMiddleware = (req: any, _res: any, cb: any) => {
        req.file = mockFile;
        cb();
      };

      // First call for old image lookup, then for update
      mockedWithDbConnection
        .mockResolvedValueOnce([]) // old images lookup
        .mockResolvedValueOnce(undefined); // update

      await new Promise<void>((resolve) => {
        customUploadMiddleware(req, res, () => resolve());
      });

      await putHandler(req, res, next);

      expect(mockedWithDbConnection).toHaveBeenCalledTimes(2);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Profile updated successfully',
      });
    });

    test('should delete old profile image if exists', async () => {
      const userId = 123;
      const req = createMockReq({
        body: { displayName: 'New Name' },
      });
      (req as any).user = { userId };

      const mockFile = {
        filename: 'profile-new.jpg',
        originalname: 'new.jpg',
      };

      const res = createMockRes();
      const next = createMockNext();

      // Mock old image
      const oldImageData = [{ user_profile_image: '/uploads/profiles/old-image.jpg' }];

      const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const unlinkSyncSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation();

      mockedWithDbConnection
        .mockResolvedValueOnce(oldImageData) // old images lookup
        .mockResolvedValueOnce(undefined); // update

      const customUploadMiddleware = (req: any, _res: any, cb: any) => {
        req.file = mockFile;
        cb();
      };

      await new Promise<void>((resolve) => {
        customUploadMiddleware(req, res, () => resolve());
      });

      await putHandler(req, res, next);

      expect(existsSyncSpy).toHaveBeenCalled();
      expect(unlinkSyncSpy).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Profile updated successfully',
      });

      existsSyncSpy.mockRestore();
      unlinkSyncSpy.mockRestore();
    });

    test('should return 500 on update error', async () => {
      const userId = 123;
      const req = createMockReq({
        body: { displayName: 'New Name' },
      });
      (req as any).user = { userId };
      const res = createMockRes();
      const next = createMockNext();

      mockedWithDbConnection.mockRejectedValueOnce(new Error('DB error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await new Promise<void>((resolve) => {
        mockUploadMiddleware(req, res, () => resolve());
      });

      await putHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to update profile',
      });

      consoleSpy.mockRestore();
    });
  });

  describe('DELETE /delete-account', () => {
    let deleteHandler: any;

    beforeEach(() => {
      router = profileRouter;
      const stack = (router as any).stack;
      const route = stack.find((layer: any) => layer.route && layer.route.path === '/delete-account' && layer.route.methods.delete);
      deleteHandler = route.route.stack[0].handle;
    });

    test('should return 401 when user is not authenticated', async () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      await deleteHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
      });
    });

    test('should return 400 when password is missing', async () => {
      const userId = 123;
      const req = createMockReq({
        body: {},
      });
      (req as any).user = { userId };
      const res = createMockRes();
      const next = createMockNext();

      await deleteHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Password is required to delete account',
      });
    });

    test('should return 404 when user not found', async () => {
      const userId = 999;
      const req = createMockReq({
        body: { password: 'testpass' },
      });
      (req as any).user = { userId };
      const res = createMockRes();
      const next = createMockNext();

      mockedWithDbConnection.mockResolvedValueOnce([]);

      await deleteHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
      });
    });

    test('should soft delete user account', async () => {
      const userId = 123;
      const req = createMockReq({
        body: { password: 'testpass' },
      });
      (req as any).user = { userId };
      const res = createMockRes();
      const next = createMockNext();

      const mockUser = [{ user_pwd: 'hashedpassword' }];
      
      mockedWithDbConnection
        .mockResolvedValueOnce(mockUser) // password lookup
        .mockResolvedValueOnce(undefined); // delete update

      await deleteHandler(req, res, next);

      expect(mockedWithDbConnection).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    test('should return 500 on delete error', async () => {
      const userId = 123;
      const req = createMockReq({
        body: { password: 'testpass' },
      });
      (req as any).user = { userId };
      const res = createMockRes();
      const next = createMockNext();

      mockedWithDbConnection.mockRejectedValueOnce(new Error('DB error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await deleteHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);

      consoleSpy.mockRestore();
    });
  });

  describe('Password utility integration', () => {
    test('hashPassword mock should be available', () => {
      mockedHashPassword.mockResolvedValue('hashedvalue');
      expect(mockedHashPassword).toBeDefined();
    });
  });
});
```
