<!-- cc-team deliverable
 group: G1 (Spec/contract-based tests)
 member: S009 role=spec-test model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":326,"completion_tokens":6047,"total_tokens":6373,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4178,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 42s
 generated: 2026-06-13T11:21:51.531Z -->
```typescript
import {
  LOW_CONFIDENCE_FALLBACK_TEXT,
  renderGeneralFallbackMessage,
  renderThaiNumberText,
  countDaysUntilEndOfYear,
  renderGeneralSmokeAnswer,
  isGarbage,
  answerGeneralWithFastModel,
} from '../src/services/generalGate';

// Mocking external network dependencies deterministically for offline execution
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Mocked AI response' } }],
        }),
      },
    },
  })),
}));

beforeAll(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'Mocked fetch response' } }] }),
    })
  ) as jest.Mock;
});

beforeEach(() => {
  (global.fetch as jest.Mock).mockClear();
});

describe('generalGate module contracts', () => {
  describe('LOW_CONFIDENCE_FALLBACK_TEXT', () => {
    it('should export the exact Thai fallback text constant', () => {
      expect(LOW_CONFIDENCE_FALLBACK_TEXT).toBe(
        "ขอข้อมูลเพิ่มอีกนิดเพื่อให้ตอบได้แม่นยำขึ้น เช่น ระบุจังหวัดหรือหัวข้อที่ต้องการ"
      );
    });
  });

  describe('renderGeneralFallbackMessage', () => {
    it('should return a non-empty string', () => {
      const result = renderGeneralFallbackMessage();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return the LOW_CONFIDENCE_FALLBACK_TEXT constant', () => {
      expect(renderGeneralFallbackMessage()).toBe(LOW_CONFIDENCE_FALLBACK_TEXT);
    });
  });

  describe('renderThaiNumberText', () => {
    it('should render 0 as "ศูนย์"', () => {
      expect(renderThaiNumberText(0)).toBe('ศูนย์');
    });

    it('should render 1 as "หนึ่ง"', () => {
      expect(renderThaiNumberText(1)).toBe('หนึ่ง');
    });

    it('should render 10 as "สิบ"', () => {
      expect(renderThaiNumberText(10)).toBe('สิบ');
    });

    it('should render 11 as "สิบเอ็ด"', () => {
      expect(renderThaiNumberText(11)).toBe('สิบเอ็ด');
    });

    it('should render 20 as "ยี่สิบ"', () => {
      expect(renderThaiNumberText(20)).toBe('ยี่สิบ');
    });

    it('should render 21 as "ยี่สิบเอ็ด"', () => {
      expect(renderThaiNumberText(21)).toBe('ยี่สิบเอ็ด');
    });

    it('should render 100 as "หนึ่งร้อย"', () => {
      expect(renderThaiNumberText(100)).toBe('หนึ่งร้อย');
    });

    it('should render 121 as "หนึ่งร้อยยี่สิบเอ็ด"', () => {
      expect(renderThaiNumberText(121)).toBe('หนึ่งร้อยยี่สิบเอ็ด');
    });
  });

  describe('countDaysUntilEndOfYear', () => {
    it('should return 0 for the last day of the year', () => {
      const lastDay = new Date('2023-12-31T00:00:00.000Z');
      expect(countDaysUntilEndOfYear(lastDay)).toBe(0);
    });

    it('should return 1 for the second to last day of the year', () => {
      const secondLastDay = new Date('2023-12-30T00:00:00.000Z');
      expect(countDaysUntilEndOfYear(secondLastDay)).toBe(1);
    });

    it('should return 364 for Jan 1 in a non-leap year', () => {
      const janFirst = new Date('2023-01-01T00:00:00.000Z');
      expect(countDaysUntilEndOfYear(janFirst)).toBe(364);
    });

    it('should return 365 for Jan 1 in a leap year', () => {
      const janFirstLeap = new Date('2024-01-01T00:00:00.000Z');
      expect(countDaysUntilEndOfYear(janFirstLeap)).toBe(365);
    });
  });

  describe('renderGeneralSmokeAnswer', () => {
    it('should return a string when given a valid string', () => {
      const result = renderGeneralSmokeAnswer('test input');
      expect(typeof result).toBe('string');
    });

    it('should return a non-empty string', () => {
      const result = renderGeneralSmokeAnswer('สวัสดี');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('isGarbage', () => {
    it('should return true for an empty string', () => {
      expect(isGarbage('')).toBe(true);
    });

    it('should return true for a whitespace-only string', () => {
      expect(isGarbage('   ')).toBe(true);
    });

    it('should return true for a very short string (e.g., single character)', () => {
      expect(isGarbage('a')).toBe(true);
    });

    it('should return false for a valid sentence', () => {
      expect(isGarbage('สวัสดีวันนี้')).toBe(false);
    });

    it('should return false for a normal word', () => {
      expect(isGarbage('Hello')).toBe(false);
    });
  });

  describe('answerGeneralWithFastModel', () => {
    it('should resolve to a string when the model call succeeds', async () => {
      const result = await answerGeneralWithFastModel('Hello');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should reject or throw when the model call fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      await expect(answerGeneralWithFastModel('Hello')).rejects.toThrow('Network error');
    });
  });
});
```
