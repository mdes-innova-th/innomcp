// contextManager.ts — Conversation Context Window Manager for innomcp-node
// จัดการประวัติการสนทนาที่ส่งไปยังโมเดล AI (ตัดข้อความเมื่อยาวเกินกำหนด)

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens?: number;
}

class ContextManager {
  private sessions: Map<string, Message[]> = new Map();

  // จำนวนโทเค็นสูงสุดที่อนุญาตให้ส่งไปยัง API (สามารถปรับแต่งได้)
  public maxTokens: number = 8000;
  public readonly maxMessagesPerSession: number = 100;
  public readonly maxContentLength: number = 10000;
  public readonly summaryMaxTokens: number = 500;

  /**
   * เพิ่มข้อความเข้าไปในบริบทของเซสชัน
   * @param sessionId - ตัวระบุเซสชัน
   * @param message - ข้อความที่จะเพิ่ม (role, content)
   */
  addMessage(sessionId: string, message: Message): void {
    const current = this.sessions.get(sessionId);
    if (!current) {
      this.sessions.set(sessionId, [message]);
    } else {
      current.push(message);
    }
  }

  /**
   * ดึงบริบทสำหรับการเรียก API (ถูกตัดให้พอดีกับ maxTokens แล้ว)
   * @param sessionId - ตัวระบุเซสชัน
   * @returns อาร์เรย์ของข้อความที่ผ่านการตัดแต่งแล้ว
   */
  getContext(sessionId: string): Message[] {
    const messages = this.sessions.get(sessionId) || [];
    return this.trim(messages, this.maxTokens);
  }

  /**
   * นับจำนวนโทเค็นโดยประมาณ (ใช้การคำนวณแบบง่าย: จำนวนตัวอักษร / 4)
   * @param text - ข้อความที่ต้องการนับ
   * @returns จำนวนโทเค็นโดยประมาณ (ปัดขึ้น)
   */
  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

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
      (sum, msg) => sum + this.countTokens(msg.content),
      0,
    );

    // เริ่มลบข้อความเก่าที่สุด (ไม่รวม system) จนกว่าจะอยู่ในขีดจำกัด
    while (otherMessages.length > 0 && totalTokens > maxTokens) {
      const removed = otherMessages.shift()!;
      totalTokens -= this.countTokens(removed.content);
    }

    return [...systemMessages, ...otherMessages];
  }

  /**
   * สรุปเนื้อหาของข้อความทั้งหมด (placeholder – ใช้งานการย่อแบบง่าย)
   * @param messages - รายการข้อความที่ต้องการสรุป
   * @returns ข้อความระบบที่มีเนื้อหาสรุป
   */
  summarize(messages: Message[]): Message {
    const parts: string[] = [];
    for (const msg of messages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        // ตัดข้อความมาเฉพาะ 80 ตัวอักษรแรกเพื่อใช้เป็นสรุป
        parts.push(msg.content.slice(0, 80));
      }
    }

    const summaryContent =
      parts.length > 0
        ? `สรุปเนื้อหาการสนทนาก่อนหน้า:\n${parts.join('\n')}`
        : 'สรุป: ไม่มีเนื้อหาการสนทนา';

    return {
      role: 'system',
      content: summaryContent,
    };
  }

  /**
   * ล้างข้อมูลบริบทของเซสชันทั้งหมด
   * @param sessionId - ตัวระบุเซสชัน
   */
  clear(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * แสดงสถิติของเซสชัน ได้แก่ จำนวนข้อความ และจำนวนโทเค็นโดยประมาณ
   * @param sessionId - ตัวระบุเซสชัน
   * @returns object ที่มี messageCount และ estimatedTokens
   */
  stats(sessionId: string): { messageCount: number; estimatedTokens: number } {
    const messages = this.sessions.get(sessionId) || [];
    const estimatedTokens = messages.reduce(
      (sum, msg) => sum + this.countTokens(msg.content),
      0,
    );
    return {
      messageCount: messages.length,
      estimatedTokens,
    };
  }
}

export const contextManager = new ContextManager();