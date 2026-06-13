<!-- cc-team deliverable
 group: G3 (Spec/contract-based tests)
 member: S069 role=spec-test model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":184,"completion_tokens":4649,"total_tokens":4833,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4332,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 47s
 generated: 2026-06-13T11:41:10.030Z -->
```typescript
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import preferencesRouter from '../src/routes/api/preferences';

// Mocking the external dependency deterministically
jest.mock('../src/services/preferencesService', () => ({
  getPreferencesByUserId: jest.fn(),
  updatePreferencesByUserId: jest.fn(),
  deletePreferencesByUserId: jest.fn(),
}));

import * as preferencesService from '../src/services/preferencesService';

const mockedService = preferencesService as jest.Mocked<typeof preferencesService>;

// Extend Express Request type for authenticated routes
declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

const app = express();
app.use(express.json());

// Mock authentication middleware to inject user context required by preferences routes
app.use((req: Request, res: Response, next: NextFunction) => {
  req.user = { id: 'test-user-123' };
  next();
});

// Mount the router under test
app.use('/preferences', preferencesRouter);

// Contract definition based on the implied UserPreferences interface
interface UserPreferences {
  theme: 'light' | 'dark';
  notifications: boolean;
  language: string;
}

describe('Preferences Router Contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /preferences', () => {
    it('should return 200 and user preferences if they exist', async () => {
      const mockPrefs: UserPreferences = {
        theme: 'dark',
        notifications: true,
        language: 'en',
      };
      mockedService.getPreferencesByUserId.mockResolvedValue(mockPrefs);

      const response = await request(app).get('/preferences');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockPrefs);
    });

    it('should return 404 if user preferences are not found', async () => {
      mockedService.getPreferencesByUserId.mockResolvedValue(null);

      const response = await request(app).get('/preferences');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Preferences not found' });
    });

    it('should return 500 if the service throws an unexpected error', async () => {
      mockedService.getPreferencesByUserId.mockRejectedValue(new Error('DB connection failed'));

      const response = await request(app).get('/preferences');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal Server Error' });
    });
  });

  describe('PUT /preferences', () => {
    it('should return 200 and updated preferences for valid partial input', async () => {
      const updatePayload = { theme: 'light' as const };
      const updatedPrefs: UserPreferences = {
        theme: 'light',
        notifications: true,
        language: 'en',
      };
      mockedService.updatePreferencesByUserId.mockResolvedValue(updatedPrefs);

      const response = await request(app).put('/preferences').send(updatePayload);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedPrefs);
    });

    it('should return 400 for invalid theme value outside contract enum', async () => {
      const invalidPayload = { theme: 'neon' };

      const response = await request(app).put('/preferences').send(invalidPayload);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid notifications type violating contract', async () => {
      const invalidPayload = { notifications: 'yes' };

      const response = await request(app).put('/preferences').send(invalidPayload);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /preferences', () => {
    it('should return 204 when preferences are successfully deleted', async () => {
      mockedService.deletePreferencesByUserId.mockResolvedValue(undefined);

      const response = await request(app).delete('/preferences');

      expect(response.status).toBe(204);
    });

    it('should return 404 if trying to delete non-existent preferences', async () => {
      mockedService.deletePreferencesByUserId.mockResolvedValue(null);

      const response = await request(app).delete('/preferences');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Preferences not found' });
    });
  });
});
```
