```ts
/**
 * Thai NLP Enhancer for AI response post-processing.
 * ปรับแต่งข้อความภาษาไทยให้อ่านง่าย เหมาะสำหรับการตอบกลับในแพลตฟอร์ม INNOMCP
 */
class ThaiNLPEnhancer {
  /**
   * ปรับระยะห่างและวรรคตอนให้เหมาะสมกับภาษาไทย
   * - ลบช่องว่างก่อนเครื่องหมายวรรคตอน
   * - เพิ่มช่องว่างหลังเครื่องหมายถัดจากข้อความ
   * - ลบช่องว่างเกิน
   */
  normalizeSpacing(text: string): string {
    let result = text;
    // ลบช่องว่างก่อนเครื่องหมายวรรคตอน
    result = result.replace(/\s+([.,:;!?ๆฯ])/g, '$1');
    // เติมช่องว่างหลังเครื่องหมายหากตามด้วยตัวอักษร
    result = result.replace(/([.,:;!?ๆฯ])(\S)/g, '$1 $2');
    // ยุบช่องว่างซ้ำ
    result = result.replace(/\s+/g, ' ');
    // ตัดช่องว่างหัวท้าย
    return result.trim();
  }

  /**
   * แปลงตัวเลขฮินดูอารบิกเป็นเลขไทย (๐-๙)
   */
  enhanceNumbers(text: string): string {
    const thaiDigits = '๐๑๒๓๔๕๖๗๘๙';
    return text.replace(/[0-9]/g, (digit) => thaiDigits[parseInt(digit)]);
  }

  /**
   * เพิ่มคำลงท้ายสุภาพ (ครับ/ค่ะ) หากยังไม่มี
   * @param gender เพศผู้ใช้ (male, female)
   */
  addPoliteness(text: string,