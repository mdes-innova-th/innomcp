<!-- cc-team deliverable
 group: G4 (Spec/contract-based tests)
 member: S084 role=spec-test model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":180,"completion_tokens":3563,"total_tokens":3743,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2785,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 61s
 generated: 2026-06-13T11:49:00.148Z -->
```typescript
import express from 'express';
import request from 'supertest';
import { router } from '../src/routes/artifacts';
import { artifactService } from '../src/services/artifactService';

jest.mock('../src/services/artifactService');

const mockedGetAll = artifactService.getAll as jest.Mock;
const mockedGetById = artifactService.getById as jest.Mock;
const mockedCreate = artifactService.create as jest.Mock;

const app = express();
app.use(express.json());
app.use('/artifacts', router);

describe('Artifacts Router Contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /artifacts', () => {
    it('should return 200 and an array of artifacts when service succeeds', async () => {
      const expectedArtifacts = [
        { id: '1', name: 'Artifact A', type: 'document' },
        { id: '2', name: 'Artifact B', type: 'image' }
      ];
      mockedGetAll.mockResolvedValue(expectedArtifacts);

      const response = await request(app).get('/artifacts');

      expect(response.status).toEqual(200);
      expect(response.body).toEqual(expectedArtifacts);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toEqual(2);
    });

    it('should return 200 and an empty array when no artifacts exist', async () => {
      mockedGetAll.mockResolvedValue([]);

      const response = await request(app).get('/artifacts');

      expect(response.status).toEqual(200);
      expect(response.body).toEqual([]);
    });

    it('should return 500 when the service encounters an error', async () => {
      mockedGetAll.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app).get('/artifacts');

      expect(response.status).toEqual(500);
    });
  });

  describe('GET /artifacts/:id', () => {
    it('should return 200 and the specific artifact when ID exists', async () => {
      const expectedArtifact = { id: '1', name: 'Artifact A', type: 'document' };
      mockedGetById.mockResolvedValue(expectedArtifact);

      const response = await request(app).get('/artifacts/1');

      expect(response.status).toEqual(200);
      expect(response.body).toEqual(expectedArtifact);
      expect(response.body.id).toEqual('1');
    });

    it('should return 404 when the artifact ID does not exist', async () => {
      mockedGetById.mockResolvedValue(null);

      const response = await request(app).get('/artifacts/999');

      expect(response.status).toEqual(404);
      expect(response.body).toEqual({ error: 'Artifact not found' });
    });

    it('should return 500 when the service throws an unexpected error', async () => {
      mockedGetById.mockRejectedValue(new Error('Unexpected DB Error'));

      const response = await request(app).get('/artifacts/1');

      expect(response.status).toEqual(500);
    });
  });

  describe('POST /artifacts', () => {
    const validPayload = { name: 'New Artifact', type: 'video' };
    const createdArtifact = { id: '3', ...validPayload };

    it('should return 201 and the created artifact for valid input', async () => {
      mockedCreate.mockResolvedValue(createdArtifact);

      const response = await request(app)
        .post('/artifacts')
        .send(validPayload);

      expect(response.status).toEqual(201);
      expect(response.body).toEqual(createdArtifact);
      expect(response.body.id).toBeDefined();
      expect(response.body.name).toEqual(validPayload.name);
    });

    it('should return 400 when required fields are missing', async () => {
      const invalidPayload = { type: 'video' }; // missing name

      const response = await request(app)
        .post('/artifacts')
        .send(invalidPayload);

      expect(response.status).toEqual(400);
      expect(response.body).toEqual({ error: 'Missing required fields: name' });
    });

    it('should return 400 when payload is completely empty', async () => {
      const response = await request(app)
        .post('/artifacts')
        .send({});

      expect(response.status).toEqual(400);
    });

    it('should return 500 when creation fails at the service layer', async () => {
      mockedCreate.mockRejectedValue(new Error('DB Write Error'));

      const response = await request(app)
        .post('/artifacts')
        .send(validPayload);

      expect(response.status).toEqual(500);
    });
  });
});
```
