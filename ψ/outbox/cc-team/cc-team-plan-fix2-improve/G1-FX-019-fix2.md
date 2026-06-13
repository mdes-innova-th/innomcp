<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from improve)
 member: FX-019 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":2441,"completion_tokens":8000,"total_tokens":10441,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":7226,"image_tokens":0},"cache_creation_input_tokens":0} | 82s
 generated: 2026-06-13T11:40:22.028Z -->
FILE: innomcp-node/src/services/contextManager.ts
<<<<<<< SEARCH
  /**
   * นับจำนวนโทเค็นโดยประมาณ (ใช้การคำนวณแบบง่าย: จำนวนตัวอักษร / 4)
   * @param text - ข้อความที่ต้องการนับ
   * @returns จำนวนโทเค็นโดยประมาณ (ปัดขึ้น)
   */
  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
=======
  /**
   * นับจำนวนโทเค็นโดยประมาณ (ใช้การคำนวณแบบพิจารณาภาษา)
   * สำหรับข้อความ CJK/Thai/Hangul ให้นับ 1 ตัวอักษร = 1 token
   * สำหรับข้อความ ASCII/Latin ให้นับ 4 ตัวอักษร = ~1 token
   * @param text - ข้อความที่ต้องการนับ
   * @returns จำนวนโทเค็นโดยประมาณ (ปัดขึ้น)
   */
  countTokens(text: string): number {
    let total = 0;
    for (const char of text) {
      const code = char.codePointAt(0) ?? 0;
      if (
        (code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified
        (code >= 0x3400 && code <= 0x4DBF) || // CJK Extension A
        (code >= 0x20000 && code <= 0x2A6DF) || // CJK Extension B
        (code >= 0x0E00 && code <= 0x0E7F) || // Thai
        (code >= 0xAC00 && code <= 0xD7AF)    // Hangul
      ) {
        total += 1;
      } else {
        total += 0.25;
      }
    }
    return Math.ceil(total);
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/contextManager.ts
<<<<<<< SEARCH
  public maxTokens: number = 8000;
=======
  public maxTokens: number = 8000;
  public readonly maxMessagesPerSession: number = 100;
  public readonly maxContentLength: number = 10000;
  public readonly summaryMaxTokens: number = 500;
>>>>>>> REPLACE

FILE: innomcp-node/src/services/contextManager.ts
<<<<<<< SEARCH
  /**
   * ตัดข้อความเก่าออกจนกว่าจำนวนโทเค็นทั้งหมดจะไม่เกิน maxTokens
   * โดยจะเก็บข้อความระบบ (system) ตัวแรกไว้เสมอ (ถ้ามี)
   * @param messages - รายการข้อความทั้งหมด
   * @param maxTokens - จำนวนโทเค็นสูงสุดที่ต้องการ
   * @returns รายการข้อความที่ผ่านการตัดแล้ว
   */
  trim(messages: Message[], maxTokens: number): Message[] {
    if (messages.length === 0) return [];

    const hasSystem = messages[0].role === 'system';
    const systemMessages: Message[] = [];
    const otherMessages: Message[] = [];

    if (hasSystem) {
      systemMessages.push(messages[0]);
      for (let i = 1; i < messages.length; i++) {
        otherMessages.push(messages[i]);
      }
    } else {
      otherMessages.push(...messages);
    }

    let totalTokens = messages.reduce(
      (sum, msg) => sum + this.countTokens(msg.content
