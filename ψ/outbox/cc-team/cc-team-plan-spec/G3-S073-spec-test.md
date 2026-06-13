<!-- cc-team deliverable
 group: G3 (Spec/contract-based tests)
 member: S073 role=spec-test model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":196,"completion_tokens":5706,"total_tokens":5902,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3403,"image_tokens":0},"cache_creation_input_tokens":0} | 59s
 generated: 2026-06-13T11:42:43.867Z -->
```typescript
import express from 'express';
import request from 'supertest';
import router from '../src/routes/api/providers';

// ---------------------------------------------------------------------------
// MOCK external dependencies – the provider service layer (database/network)
// We define its contract exactly as the router is expected to consume it.
// ---------------------------------------------------------------------------
jest.mock('../src/services/providerService', () => ({
  getAllProviders: jest.fn(),
  getProviderById: jest.fn(),
  createProvider: jest.fn(),
  updateProvider: jest.fn(),
  deleteProvider: jest.fn(),
}));

import * as providerService from '../src/services/providerService';

// Helper to access mocked functions with strong typing
const mockGetAll = providerService.getAllProviders as jest.Mock;
const mockGetById = providerService.getProviderById as jest.Mock;
const mockCreate = providerService.createProvider as jest.Mock;
const mockUpdate = providerService.updateProvider as jest.Mock;
const mockDelete = providerService.deleteProvider as jest.Mock;

// Sample data shapes (the contract does not prescribe a specific shape,
// but they illustrate expected request/response bodies).
const sampleProvider = { id: 'prov-1', name: 'Acme Health' };
const sampleProvider2 = { id: 'prov-2', name: 'Beta Care' };
const sampleList = [sampleProvider, sampleProvider2];

// ---------------------------------------------------------------------------
// Mount the router on a fresh Express app for each test.
// ---------------------------------------------------------------------------
describe('providers router contract', () => {
  let app: express.Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    // Typical mount-point – the router itself handles sub-paths relative to its own root.
    app.use('/api/providers', router);
  });

  // -----------------------------------------------------------------------
  // GET / (list providers)
  // -----------------------------------------------------------------------
  describe('GET /api/providers', () => {
    it('returns 200 with a list of providers', async () => {
      mockGetAll.mockResolvedValue(sampleList);

      const res = await request(app).get('/api/providers');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(sampleList);
      expect(mockGetAll).toHaveBeenCalledTimes(1);
    });

    it('returns 200 with an empty array when no providers exist', async () => {
      mockGetAll.mockResolvedValue([]);

      const res = await request(app).get('/api/providers');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('passes query parameters to the service layer (if supported)', async () => {
      mockGetAll.mockResolvedValue([]);

      await request(app).get('/api/providers?name=Acme');
      // Contract: the service should receive the query object or parsed filters.
      // We cannot assert internals, but the mock being called demonstrates
      // that the router delegates appropriately.
      expect(mockGetAll).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Acme' }) // probable contract
      );
    });

    it('returns 500 if the service throws an unexpected error', async () => {
      mockGetAll.mockRejectedValue(new Error('DB connection lost'));

      const res = await request(app).get('/api/providers');
      expect(res.status).toBe(500);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });
  });

  // -----------------------------------------------------------------------
  // GET /:id (single provider)
  // -----------------------------------------------------------------------
  describe('GET /api/providers/:id', () => {
    it('returns 200 with the provider when found', async () => {
      mockGetById.mockResolvedValue(sampleProvider);

      const res = await request(app).get('/api/providers/prov-1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(sampleProvider);
      expect(mockGetById).toHaveBeenCalledWith('prov-1');
    });

    it('returns 404 when the provider does not exist', async () => {
      mockGetById.mockResolvedValue(null);

      const res = await request(app).get('/api/providers/non-existent');
      expect(res.status).toBe(404);
    });

    it('returns 400 for a malformed ID (if the contract enforces a format)', async () => {
      // The implementation may choose to return 404 as well; both are valid
      // contracts. We test the boundary – the router must not crash.
      mockGetById.mockResolvedValue(null);

      const res = await request(app).get('/api/providers/../../etc');
      expect([400, 404, 404]).toContain(res.status); // safety net
    });
  });

  // -----------------------------------------------------------------------
  // POST / (create provider)
  // -----------------------------------------------------------------------
  describe('POST /api/providers', () => {
    it('returns 201 with the created provider on valid input', async () => {
      const newProvider = { name: 'NewCo' };
      const created = { id: 'prov-3', name: 'NewCo' };
      mockCreate.mockResolvedValue(created);

      const res = await request(app)
        .post('/api/providers')
        .send(newProvider);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(created);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'NewCo' })
      );
    });

    it('returns 400 if required fields are missing (e.g. no name)', async () => {
      const res = await request(app)
        .post('/api/providers')
        .send({});

      expect(res.status).toBe(400);
      // Contract: response body should explain the validation error
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 400 if the body contains extra read-only fields (e.g. id)', async () => {
      const res = await request(app)
        .post('/api/providers')
        .send({ id: 'prov-999', name: 'Hack' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for non‑JSON body', async () => {
      const res = await request(app)
        .post('/api/providers')
        .set('Content-Type', 'application/xml')
        .send('<provider><name>X</name></provider>');

      expect(res.status).toBe(400);
    });

    it('returns 500 if creation service fails', async () => {
      mockCreate.mockRejectedValue(new Error('Constraint violation'));

      const res = await request(app)
        .post('/api/providers')
        .send({ name: 'FailCo' });

      expect(res.status).toBe(500);
    });
  });

  // -----------------------------------------------------------------------
  // PUT /:id (update provider)
  // -----------------------------------------------------------------------
  describe('PUT /api/providers/:id', () => {
    const updates = { name: 'Renamed' };

    it('returns 200 with the updated provider on success', async () => {
      const updated = { id: 'prov-1', name: 'Renamed' };
      mockUpdate.mockResolvedValue(updated);

      const res = await request(app)
        .put('/api/providers/prov-1')
        .send(updates);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(updated);
      expect(mockUpdate).toHaveBeenCalledWith(
        'prov-1',
        expect.objectContaining({ name: 'Renamed' })
      );
    });

    it('returns 404 if the provider does not exist', async () => {
      mockUpdate.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/providers/prov-unknown')
        .send(updates);

      expect(res.status).toBe(404);
    });

    it('returns 400 if the update body contains invalid fields', async () => {
      const res = await request(app)
        .put('/api/providers/prov-1')
        .send({ id: 'prov-2' }); // trying to change id

      expect(res.status).toBe(400);
    });

    it('returns 400 for an empty body (no fields to update)', async () => {
      const res = await request(app)
        .put('/api/providers/prov-1')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // DELETE /:id
  // -----------------------------------------------------------------------
  describe('DELETE /api/providers/:id', () => {
    it('returns 204 No Content when deletion succeeds', async () => {
      mockDelete.mockResolvedValue(true);

      const res = await request(app).delete('/api/providers/prov-1');
      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
      expect(mockDelete).toHaveBeenCalledWith('prov-1');
    });

    it('returns 404 if the provider does not exist', async () => {
      mockDelete.mockResolvedValue(false);

      const res = await request(app).delete('/api/providers/nonexistent');
      expect(res.status).toBe(404);
    });

    it('returns 500 if the deletion service throws', async () => {
      mockDelete.mockRejectedValue(new Error('Cannot delete referenced resource'));

      const res = await request(app).delete('/api/providers/prov-1');
      expect(res.status).toBe(500);
    });
  });

  // -----------------------------------------------------------------------
  // Unsupported methods (boundary)
  // -----------------------------------------------------------------------
  it('returns 405 Method Not Allowed for unsupported HTTP methods (e.g. PATCH)', async () => {
    const res = await request(app).patch('/api/providers/prov-1');
    expect([405, 404]).toContain(res.status);
  });

  // -----------------------------------------------------------------------
  // Input size boundaries
  // -----------------------------------------------------------------------
  it('handles a very large request body gracefully', async () => {
    const largeBody = { name: 'X'.repeat(1_000_000) };
    mockCreate.mockResolvedValue({ id: 'large', name: largeBody.name });

    const res = await request(app)
      .post('/api/providers')
      .send(largeBody);

    // The router may pass it through or reject; contract should not explode
    expect([201, 400, 413]).toContain(res.status);
  });
});
```
