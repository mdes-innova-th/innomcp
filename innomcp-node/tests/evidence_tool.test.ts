
import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import { handleEvidenceTool, EVIDENCE_TOOL_NAME } from '../src/utils/mcp/tools/evidenceTool';

/**
 * evidenceTool is a THIN HTTP ADAPTER (Phase 19).
 * It calls detect-evidence-api via fetch(), not DB directly.
 * Tests mock global.fetch to isolate from the network.
 */

const originalFetch = global.fetch;

function mockFetchOnce(body: any, status = 200) {
    (global as any).fetch = jest.fn<any>().mockResolvedValueOnce({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
    });
}

function mockFetchError(errorMessage: string) {
    (global as any).fetch = jest.fn<any>().mockRejectedValueOnce(new Error(errorMessage));
}

describe('Evidence Tool (detect_evidence_stats) — HTTP adapter', () => {

    afterEach(() => {
        global.fetch = originalFetch;
    });

    test('should export correct tool name', () => {
        expect(EVIDENCE_TOOL_NAME).toBe('detect_evidence_stats');
    });

    test('should handle "machine_status" intent via HTTP', async () => {
        mockFetchOnce({ count: 4 });

        const result = await handleEvidenceTool({ intent: 'machine_status' });

        expect(global.fetch).toHaveBeenCalled();
        expect(result.ok).toBe(true);
        expect(result.intent).toBe('active_evidence_machines');
        expect(result.count).toBe(4);
    });

    test('should handle "pending_evidence" intent via HTTP', async () => {
        mockFetchOnce({ count: 3 });

        const result = await handleEvidenceTool({ intent: 'pending_evidence' });

        expect(global.fetch).toHaveBeenCalled();
        expect(result.ok).toBe(true);
        expect(result.intent).toBe('pending_evidence');
        expect(result.count).toBe(3);
    });

    test('should handle "recent_threats" intent via HTTP', async () => {
        mockFetchOnce({ count: 10 });

        const result = await handleEvidenceTool({ intent: 'recent_threats' });

        expect(global.fetch).toHaveBeenCalled();
        expect(result.ok).toBe(true);
        expect(result.intent).toBe('recent_threats');
        expect(result.count).toBe(10);
    });

    test('should return error for unknown intent', async () => {
        const result = await handleEvidenceTool({ intent: 'invalid_intent' });
        expect(result.ok).toBe(false);
        expect(result.code).toBe('UNKNOWN_INTENT');
        expect(result.message).toContain('Unknown intent');
    });

    test('should classify network failures as DETECT_API_UNAVAILABLE', async () => {
        // Connection refused, ENOTFOUND, ETIMEDOUT, "fetch failed", etc. mean the
        // detect-evidence-api on :3013 is down — surface as DETECT_API_UNAVAILABLE
        // so the chat renderer shows the friendly placeholder + triggers web fallback.
        mockFetchError('Connection refused');
        const result = await handleEvidenceTool({ intent: 'machine_status' });
        expect(result.ok).toBe(false);
        expect(result.code).toBe('DETECT_API_UNAVAILABLE');
    });

    test('should classify non-network errors as EVIDENCE_QUERY_FAILED', async () => {
        // Schema/parse failures or unrelated bugs surface as the generic code so
        // we can distinguish them from "API down" in the renderer.
        mockFetchError('Unexpected token in JSON at position 0');
        const result = await handleEvidenceTool({ intent: 'machine_status' });
        expect(result.ok).toBe(false);
        expect(result.code).toBe('EVIDENCE_QUERY_FAILED');
    });

    test('should return MISSING_INTENT when no intent provided', async () => {
        const result = await handleEvidenceTool({});
        expect(result.ok).toBe(false);
        expect(result.code).toBe('MISSING_INTENT');
    });

});
