/**
 * Emotion Detection System - วิเคราะห์อารมณ์จากข้อความ user
 * เพื่อส่งให้ AI model ปรับ tone การตอบ
 */

// Emotion keywords dictionary
const emotionPatterns = {
  happy: /😊|😄|😁|🥰|❤️|ดีใจ|มีความสุข|สุขใจ|ยินดี|เฮง|ได้|สำเร็จ|เยี่ยม|เจ๋ง|สุดยอด|ชอบ|โอเค|ขอบคุณ|ได้แล้ว/gi,
  sad: /😢|😭|😔|💔|เศร้า|ผิดหวัง|ไม่มีความสุข|เสียใจ|แย่|ไม่ดี|หดหู่|ท้อแท้|เหนื่อย|ล้า/gi,
  angry: /😡|😠|💢|โกรธ|ขัดเจ้า|แค้น|ไม่พอใจ|ระเป๋า|บ้า|เวร|โม้|ห่วย|ขยะ|ควาย|ไอ้|มึง|กู/gi,
  anxious: /😰|😨|😟|กังวล|ห่วง|เครียด|ตื่นเต้น|ทนไม่ไหว|กลัว|อาย|ไม่แน่ใจ|งง/gi,
  neutral: /ครับ|ค่ะ|คะ|นะ|เหรอ|อะไร|อย่างไร|ทำไม|เมื่อไหร่|ที่ไหน|ใคร/gi,
  excited: /🎉|🎊|✨|ตื่นเต้น|ว้าว|เด็ด|สนุก|ฮา|ฮี|เย้|โอ้โห|เจ๋ง|โคตร|สุด|มาก|เกิน/gi,
  confused: /❓|🤔|งง|สับสน|ไม่เข้าใจ|ไม่รู้|แปลก|อะไรน่ะ|เหรอ|จริง|ไหม/gi,
  frustrated: /😤|😫|💢|หงุดหงิด|อึดอัด|ลำบาก|ไม่ไหว|ยาก|ช้า|ผิดพลาด|error|bug|ไม่ทำงาน|crash/gi,
};

export interface EmotionResult {
  emotion: string;
  confidence: number;
  keywords: string[];
  tone: 'positive' | 'negative' | 'neutral';
}

/**
 * วิเคราะห์อารมณ์จากข้อความ
 */
export function detectEmotion(text: string): EmotionResult {
  const scores: Record<string, number> = {};
  const matchedKeywords: Record<string, string[]> = {};

  // คำนวณคะแนนแต่ละอารมณ์
  for (const [emotion, pattern] of Object.entries(emotionPatterns)) {
    const matches = text.match(pattern);
    if (matches) {
      scores[emotion] = matches.length;
      matchedKeywords[emotion] = matches;
    } else {
      scores[emotion] = 0;
      matchedKeywords[emotion] = [];
    }
  }

  // หาอารมณ์ที่มีคะแนนสูงสุด
  let maxEmotion = 'neutral';
  let maxScore = 0;
  
  for (const [emotion, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxEmotion = emotion;
    }
  }

  // ถ้าไม่มี keyword ตรงเลย ให้เป็น neutral
  if (maxScore === 0) {
    maxEmotion = 'neutral';
  }

  // กำหนด tone
  const positiveTones = ['happy', 'excited'];
  const negativeTones = ['sad', 'angry', 'anxious', 'frustrated'];
  let tone: 'positive' | 'negative' | 'neutral' = 'neutral';
  
  if (positiveTones.includes(maxEmotion)) {
    tone = 'positive';
  } else if (negativeTones.includes(maxEmotion)) {
    tone = 'negative';
  }

  // คำนวณความมั่นใจ (0-1)
  const totalMatches = Object.values(scores).reduce((sum, score) => sum + score, 0);
  const confidence = totalMatches > 0 ? maxScore / totalMatches : 0.5;

  return {
    emotion: maxEmotion,
    confidence: Math.min(confidence, 1.0),
    keywords: matchedKeywords[maxEmotion] || [],
    tone,
  };
}

/**
 * สร้าง system prompt เพิ่มเติมตาม emotion
 */
export function getEmotionPrompt(emotion: EmotionResult): string {
  const prompts: Record<string, string> = {
    happy: "ผู้ใช้กำลังมีความสุข ตอบด้วยโทนที่อบอุ่นและร่วมยินดีด้วย",
    sad: "ผู้ใช้กำลังเศร้า ตอบด้วยโทนที่เห็นอกเห็นใจและให้กำลังใจ",
    angry: "ผู้ใช้กำลังโกรธ ตอบด้วยโทนที่สงบและเข้าใจ พยายามแก้ปัญหา",
    anxious: "ผู้ใช้กำลังกังวล ตอบด้วยโทนที่ให้ความมั่นใจและช่วยลดความกังวล",
    excited: "ผู้ใช้กำลังตื่นเต้น ตอบด้วยโทนที่กระตือรือร้นและให้กำลังใจ",
    confused: "ผู้ใช้กำลังสับสน อธิบายให้ชัดเจนและง่ายต่อการเข้าใจ",
    frustrated: "ผู้ใช้กำลังหงุดหงิด ตอบด้วยโทนที่ใจเย็นและช่วยแก้ปัญหาอย่างมีประสิทธิภาพ",
    neutral: "ตอบด้วยโทนที่เป็นธรรมชาติและเป็นมิตร",
  };

  return prompts[emotion.emotion] || prompts.neutral;
}

/**
 * Log emotion สำหรับ analytics
 */
export function logEmotion(sessionId: string, userId: string | undefined, emotion: EmotionResult): void {
  console.log(`[Emotion] Session ${sessionId} | User ${userId || 'guest'} | ${emotion.emotion} (${(emotion.confidence * 100).toFixed(0)}% confidence) | Tone: ${emotion.tone}`);
  if (emotion.keywords.length > 0) {
    console.log(`[Emotion] Keywords: ${emotion.keywords.join(', ')}`);
  }
}
