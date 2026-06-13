<!-- cc-team deliverable
 group: G2 (Generate jest unit tests for untested innomcp-node modules (batch 2))
 member: T034 role=test model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2714,"completion_tokens":5247,"total_tokens":7961,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4125,"image_tokens":0},"cache_creation_input_tokens":0} | 57s
 generated: 2026-06-13T10:58:54.259Z -->
```typescript
import { planToolCall } from '../src/agents/toolDispatch';

jest.mock('../src/agents/events', () => ({
  newEnvelope: jest.fn(),
}));

jest.mock('../src/agents/eventGuard', () => ({
  checkAgentEventSafe: jest.fn(),
}));

jest.mock('../src/middleware/guestLimiter', () => ({
  checkToolAccess: jest.fn(),
}));

describe('planToolCall', () => {
  // ---------- datetime intent ----------
  it('returns a datetime tool plan', () => {
    const plan = planToolCall('datetime' as any, 'ตอนนี้กี่โมง');
    expect(plan).not.toBeNull();
    expect(plan!.toolName).toBe('dateTimeTool');
    expect(plan!.args).toEqual({ format: 'thai' });
    expect(plan!.authoritative).toBe(true);
  });

  // ---------- calc intent ----------
  it('returns a calculator plan for a simple arithmetic query', () => {
    const plan = planToolCall('calc' as any, 'คำนวณ 2+3');
    expect(plan!.toolName).toBe('calculatorTool');
    expect(plan!.args.expression).toBe('2+3');
    expect(plan!.authoritative).toBe(true);
  });

  it('extracts the expression when the query has extra words', () => {
    const plan = planToolCall('calc' as any, 'ช่วยคำนวณ 10*5 หน่อย');
    expect(plan!.args.expression).toBe('10*5');
  });

  it('builds a mean expression when the query asks for an average', () => {
    const plan = planToolCall('calc' as any, 'หาค่าเฉลี่ยของ 10, 20, 30');
    expect(plan!.args.expression).toBe('mean([10,20,30])');
  });

  it('keeps parentheses and operators in the expression', () => {
    const plan = planToolCall('calc' as any, '(5+3)*2');
    expect(plan!.args.expression).toBe('(5+3)*2');
  });

  // ---------- evidence signal (any intent) ----------
  describe('when query contains evidence signals', () => {
    it('defaults to officer_summary action', () => {
      const plan = planToolCall('unknown' as any, 'หลักฐานล่าสุด');
      expect(plan!.toolName).toBe('evidenceTool');
      expect(plan!.args.action).toBe('officer_summary');
      expect(plan!.args.limit).toBe(5);
    });

    it('detects active_machines_offline_count', () => {
      const plan = planToolCall('unknown' as any, 'เครื่องออฟไลน์ทั้งหมด');
      expect(plan!.args.action).toBe('active_machines_offline_count');
    });

    it('detects machine_last_scan', () => {
      const plan = planToolCall('unknown' as any, 'เครื่องล่าสุดที่สแกน');
      expect(plan!.args.action).toBe('machine_last_scan');
    });

    it('detects active_machines_count', () => {
      const plan = planToolCall('unknown' as any, 'จำนวนเครื่องทั้งหมด');
      expect(plan!.args.action).toBe('active_machines_count');
    });

    it('detects evidence_records_last_7_days_trend', () => {
      const plan = planToolCall('unknown' as any, '7 day trend ของหลักฐาน');
      expect(plan!.args.action).toBe('evidence_records_last_7_days_trend');
    });

    it('detects evidence_records_yesterday_by_isp_top', () => {
      const plan = planToolCall('unknown' as any, 'เมื่อวาน isp top');
      expect(plan!.args.action).toBe('evidence_records_yesterday_by_isp_top');
    });

    it('detects evidence_records_yesterday_total', () => {
      const plan = planToolCall('unknown' as any, 'เมื่อวานทั้งหมด');
      expect(plan!.args.action).toBe('evidence_records_yesterday_total');
    });

    it('detects nip_top_isp_this_month', () => {
      const plan = planToolCall('unknown' as any, 'nip isp top this month');
      expect(plan!.args.action).toBe('nip_top_isp_this_month');
    });

    it('detects nip_latest', () => {
      const plan = planToolCall('unknown' as any, 'nip latest url');
      expect(plan!.args.action).toBe('nip_latest');
    });

    it('extracts an ISP filter from the query', () => {
      const plan = planToolCall('unknown' as any, 'nip top ISP ais');
      expect(plan!.args.ispFilter).toBe('ais');
    });

    it('does not add ispFilter when none is mentioned', () => {
      const plan = planToolCall('unknown' as any, 'nip latest');
      expect(plan!.args).not.toHaveProperty('ispFilter');
    });
  });
});
```
