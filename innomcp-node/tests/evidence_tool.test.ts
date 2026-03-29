
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { handleEvidenceTool, EVIDENCE_TOOL_NAME } from '../src/utils/mcp/tools/evidenceTool';
import * as db from '../src/utils/db/evidenceConnection';

// Mock the DB connection module
jest.mock('../src/utils/db/evidenceConnection');

const queryEvidenceMock = db.queryEvidence as unknown as jest.MockedFunction<(...args: any[]) => Promise<any[]>>;

describe('Evidence Tool (detect_evidence_stats)', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should handle "machine_status" intent', async () => {
        queryEvidenceMock.mockResolvedValueOnce([{ c: 1 }] as never);

        const result = await handleEvidenceTool({ intent: 'machine_status' });

        expect(db.queryEvidence).toHaveBeenCalled();
        expect(result.ok).toBe(true);
        expect(result.intent).toBe('active_evidence_machines');
        expect(result.count).toBe(1);
    });

    test('should handle "pending_evidence" intent', async () => {
        queryEvidenceMock
            .mockResolvedValueOnce([{ Field: 'create_date' }, { Field: 'nip_no' }] as never)
            .mockResolvedValueOnce([{ c: 3 }] as never);

        const result = await handleEvidenceTool({ intent: 'pending_evidence' });

        expect(db.queryEvidence).toHaveBeenCalled();
        expect(result.ok).toBe(true);
        expect(result.intent).toBe('pending_evidence');
        expect(result.count).toBe(3);
    });

    test('should handle "recent_threats" intent with default limit', async () => {
        queryEvidenceMock
            .mockResolvedValueOnce([{ Field: 'create_date' }] as never)
            .mockResolvedValueOnce([{ c: 10 }] as never);

        const result = await handleEvidenceTool({ intent: 'recent_threats' });

        expect(db.queryEvidence).toHaveBeenCalled();
        expect(result.ok).toBe(true);
        expect(result.intent).toBe('recent_threats');
        expect(result.count).toBe(10);
    });

    test('should handle "recent_threats" intent with custom limit', async () => {
        queryEvidenceMock
            .mockResolvedValueOnce([{ Field: 'create_date' }] as never)
            .mockResolvedValueOnce([{ c: 5 }] as never);

        const result = await handleEvidenceTool({ intent: 'recent_threats', limit: 5 });

        expect(result.ok).toBe(true);
        expect(result.count).toBe(5);
    });

    test('should return error for unknown intent', async () => {
        const result = await handleEvidenceTool({ intent: 'invalid_intent' });
        expect(result.ok).toBe(false);
        expect(result.code).toBe('UNKNOWN_INTENT');
        expect(result.message).toContain('Unknown intent');
    });

    test('should handle DB errors gracefully', async () => {
        queryEvidenceMock.mockImplementationOnce(async () => {
            throw new Error('Connection failed');
        });

        const result = await handleEvidenceTool({ intent: 'machine_status' });

        expect(result.ok).toBe(false);
        expect(result.code).toBe('EVIDENCE_QUERY_FAILED');
    });

});
