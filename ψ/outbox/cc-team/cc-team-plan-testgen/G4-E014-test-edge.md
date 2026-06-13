<!-- cc-team deliverable
 group: G4 (Generate jest unit tests for untested innomcp-node modules (batch 4))
 member: E014 role=test-edge model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2743,"completion_tokens":4887,"total_tokens":7630,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2577,"image_tokens":0},"cache_creation_input_tokens":0} | 57s
 generated: 2026-06-13T11:14:00.712Z -->
```typescript
import { planToolCall } from '../src/agents/toolDispatch';

// Mock external dependencies used by the module under test so that the
// module can be imported without hitting missing implementations.
jest.mock('../src/agents/events', () => ({
  newEnvelope: jest.fn(),
}));
jest.mock('../src/agents/eventGuard', () => ({
  checkAgentEventSafe: jest.fn(),
}));
jest.mock('../src/services/intentClassifier', () => ({}));
jest.mock('../src/middleware/guestLimiter', () => ({
  checkToolAccess: jest.fn(),
  GuestLimits: {},
}));

// The module reads MCPSERVER_URL from process.env. Set a dummy value.
process.env.MCPSERVER_URL = 'http://localhost:3012/mcp';

describe('toolDispatch', () => {
  describe('planToolCall – edge cases and error paths', () => {
    // ---------------------------------------------------------------
    // datetime intent
    // ---------------------------------------------------------------
    test('datetime intent returns dateTimeTool plan', () => {
      const plan = planToolCall('datetime', 'วันนี้นานเท่าไหร่');
      expect(plan).not.toBeNull();
      expect(plan!.toolName).toBe('dateTimeTool');
      expect(plan!.args).toEqual({ format: 'thai' });
      expect(plan!.authoritative).toBe(true);
    });

    // ---------------------------------------------------------------
    // calc intent – various mathematical expressions
    // ---------------------------------------------------------------
    test('calc intent with normal Thai arithmetic', () => {
      const plan = planToolCall('calc', 'คำนวณ 2 บวก 3');
      expect(plan).not.toBeNull();
      expect(plan!.toolName).toBe('calculatorTool');
      expect(plan!.args.expression).toMatch(/\d/);
    });

    test('calc intent with numbers and operators only', () => {
      const plan = planToolCall('calc', '5+3*2');
      expect(plan).not.toBeNull();
      expect(plan!.args.expression).toBe('5+3*2');
    });

    test('calc intent strips thousands separators from expression', () => {
      // "1,000 + 2,500" → "1000 + 2500"
      const plan = planToolCall('calc', '1,000 + 2,500');
      expect(plan!.args.expression).toBe('1000 + 2500');
    });

    test('calc intent with comma that is not a thousands separator remains', () => {
      // Comma after digits without 3 digits before space is not removed
      const plan = planToolCall('calc', '12,34 + 56');
      // The regex only removes commas before 3 digits and a non-digit or end.
      // This leaves the comma.
      expect(plan!.args.expression).toContain('12,34');
    });

    test('calc intent with no digits still produces a plan', () => {
      // extractMathExpression may return the original query if safe lacks digits
      const plan = planToolCall('calc', 'hello world');
      expect(plan).not.toBeNull();
      expect(plan!.toolName).toBe('calculatorTool');
      expect(plan!.args.expression).toBe('hello world');
    });

    test('calc intent with empty query', () => {
      const plan = planToolCall('calc', '');
      expect(plan).not.toBeNull();
      expect(plan!.args.expression).toBe('');
    });

    test('calc intent with only special characters', () => {
      const plan = planToolCall('calc', '!@#$%');
      expect(plan).not.toBeNull();
      expect(plan!.args.expression).toBe('!@#$%');
    });

    test('calc intent with mean expression', () => {
      const plan = planToolCall('calc', 'ค่าเฉลี่ย 10 20 30');
      expect(plan).not.toBeNull();
      expect(plan!.args.expression).toBe('mean([10,20,30])');
    });

    test('calc intent with average keyword and one number', () => {
      const plan = planToolCall('calc', 'average 7');
      expect(plan).not.toBeNull();
      expect(plan!.args.expression).toBe('mean([7])');
    });

    test('calc intent with percent keyword', () => {
      const plan = planToolCall('calc', '10 percent of 200');
      expect(plan!.args.expression).toContain('%');
    });

    // ---------------------------------------------------------------
    // weather intent
    // ---------------------------------------------------------------
    test('weather intent defaults to daily plan for generic query', () => {
      const plan = planToolCall('weather', 'อากาศวันนี้เป็นยังไง');
      expect(plan).not.toBeNull();
      expect(plan!.toolName).toBe('nwp_daily_by_place');
      expect(plan!.args).toHaveProperty('province', 'กรุงเทพมหานคร');
      expect(plan!.args).toHaveProperty('duration', 2);
    });

    test('weather intent triggers hourly when query contains รายชั่วโมง', () => {
      const plan = planToolCall('weather', 'อากาศรายชั่วโมงวันนี้');
      expect(plan).not.toBeNull();
      expect(plan!.toolName).toBe('nwp_hourly_by_place');
      expect(plan!.args).toHaveProperty('duration', 24);
      expect(plan!.reason).toBe('current weather intent');
    });

    test('weather intent with English hourly keyword', () => {
      const plan = planToolCall('weather', 'hourly weather today');
      expect(plan).not.toBeNull();
      expect(plan!.toolName).toBe('nwp_hourly_by_place');
    });

    test('weather intent with keyword "ชั่วโมง" but no "วันนี้" still daily', () => {
      // needsHourlyWeather requires either รายชั่วโมง or both วันนี้+ชั่วโมง,
      // so just "ชั่วโมง" alone is false.
      const plan = planToolCall('weather', 'พยากรณ์ชั่วโมง');
      expect(plan!.toolName).toBe('nwp_daily_by_place');
    });

    test('weather intent when province name is present in query', () => {
      // extractThaiProvince exists in the full source; if it's missing test will
      // error, but the source is assumed complete.
      const plan = planToolCall('weather', 'อากาศเชียงใหม่');
      expect(plan).not.toBeNull();
      // province should be extracted, not the default.
      expect(plan!.args.province).toBe('เชียงใหม่');
    });

    // ---------------------------------------------------------------
    // evidence signals (keyword driven, independent of intent)
    // ---------------------------------------------------------------
    test('evidence tool triggered by hasEvidenceSignal even with general intent', () => {
      const plan = planToolCall('general', 'มีเครื่องไหนออฟไลน์บ้าง');
      expect(plan).not.toBeNull();
      expect(plan!.toolName).toBe('evidenceTool');
      expect(plan!.args.action).toBe('active_machines_offline_count');
      expect(plan!.args.limit).toBe(5);
    });

    test('evidence tool not triggered when earlier intent matches', () => {
      // With datetime intent, returns datetime plan immediately.
      const plan = planToolCall('datetime', 'offline machines count');
      expect(plan).not.toBeNull();
      expect(plan!.toolName).toBe('dateTimeTool');
    });

    test('evidence with nip/url and ISP filter', () => {
      const plan = planToolCall('general', 'nip top isp this month AIS');
      expect(plan).not.toBeNull();
      expect(plan!.toolName).toBe('evidenceTool');
      expect(plan!.args.action).toBe('nip_top_isp_this_month');
      expect(plan!.args.ispFilter).toBe('ais');
    });

    test('evidence with isp filter detection case-insensitive', () => {
      const plan = planToolCall('general', 'DTAC evidence yesterday');
      expect(plan!.args.ispFilter).toBe('dtac');
    });

    test('evidence fallback action when no keyword matched', () => {
      const plan = planToolCall('general', 'สรุปเจ้าหน้าที่');
      expect(plan!.args.action).toBe('officer_summary');
    });

    test('evidence with 7 day trend keyword', () => {
      const plan = planToolCall('general', 'trend 7 วันล่าสุด');
      expect(plan!.args.action).toBe('evidence_records_last_7_days_trend');
    });

    test('evidence with yesterday and ISP keywords', () => {
      const plan = planToolCall('general', 'เมื่อวาน isp true');
      expect(plan!.args.action).toBe('evidence_records_yesterday_by_isp_top');
      expect(plan!.args.ispFilter).toBe('true');
    });

    test('evidence without ISP filter does not include ispFilter property', () => {
      const plan = planToolCall('general', 'เมื่อวานหลักฐาน');
      expect(plan!.args).not.toHaveProperty('ispFilter');
    });

    // ---------------------------------------------------------------
    // null / undefined / unexpected intent types (runtime edge)
    // ---------------------------------------------------------------
    test('returns null for intent that has no matching branch and no evidence signal', () => {
      const plan = planToolCall('unknown_intent' as any, 'hello world');
      expect(plan).toBeNull();
    });

    test('handles null-like intent at runtime (type override)', () => {
      // Ensure it does not throw and returns null or a plan from evidence
      const plan = planToolCall(null as any, 'machine offline');
      // evidence signal exists, so it may pick evidence tool, or if hasEvidenceSignal returns true
      // plan should be an evidence plan
      expect(plan).not.toBeNull();
      expect(plan!.toolName).toBe('evidenceTool');
    });

    test('handles undefined intent with evidence keywords', () => {
      const plan = planToolCall(undefined as any, 'offline machines');
      expect(plan).not.toBeNull();
      expect(plan!.toolName).toBe('evidenceTool');
    });

    test('handles undefined intent with no evidence keywords returns null', () => {
      const plan = planToolCall(undefined as any, 'just a greeting');
      // No branch matches, falls through to null
      expect(plan).toBeNull();
    });
  });
});
```
