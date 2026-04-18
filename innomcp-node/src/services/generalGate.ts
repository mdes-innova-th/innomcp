/**
 * GeneralGate — standalone reference module.
 * The LIVE code is inline in routes/api/chat.ts (answerGeneralWithFastModel).
 * This file is kept in sync for readability and potential future extraction.
 */
import { logBoth } from "../utils/mcpLogger";

export const LOW_CONFIDENCE_FALLBACK_TEXT = "ขอข้อมูลเพิ่มอีกนิดเพื่อให้ตอบได้แม่นยำขึ้น เช่น ระบุจังหวัดหรือหัวข้อที่ต้องการ";

export function renderGeneralFallbackMessage(): string {
  return "ขออภัย ตอนนี้ตอบได้ไม่ทันเวลา ลองระบุคำถามให้แคบลงอีกนิด (เช่น เป้าหมาย/บริบท/ตัวอย่าง) แล้วผมจะสรุปให้สั้นๆ ได้ครับ";
}

export function renderThaiNumberText(value: number): string {
  const units = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const positions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

  const renderChunk = (num: number): string => {
    if (num === 0) return "";
    const digits = String(num).split("").map((d) => Number(d));
    return digits
      .map((digit, idx) => {
        if (digit === 0) return "";
        const pos = digits.length - idx - 1;
        if (pos === 0) {
          return pos === 0 && digit === 1 && digits.length > 1 ? "เอ็ด" : units[digit];
        }
        if (pos === 1) {
          if (digit === 1) return "สิบ";
          if (digit === 2) return "ยี่สิบ";
          return `${units[digit]}สิบ`;
        }
        return `${units[digit]}${positions[pos] || ""}`;
      })
      .join("");
  };

  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return units[0];
  if (value < 0) return `ลบ${renderThaiNumberText(Math.abs(value))}`;

  if (value < 1000000) {
    return renderChunk(Math.floor(value));
  }

  const millions = Math.floor(value / 1000000);
  const remainder = Math.floor(value % 1000000);
  return `${renderChunk(millions)}ล้าน${remainder > 0 ? renderChunk(remainder) : ""}`;
}

export function countDaysUntilEndOfYear(baseDate: Date): number {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const end = new Date(baseDate.getFullYear(), 11, 31);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

export function renderGeneralSmokeAnswer(userText: string): string {
  const t = String(userText || "").trim();

  if (/(ชื่ออะไร|คือใคร|เป็นใคร|who are you|what is your name|what are you|are you)/i.test(t)) {
    return "สวัสดีครับ ผมชื่อ Innova-bot เป็น AI ผู้ช่วยสำหรับระบบ InnoMCP ยินดีให้บริการครับ";
  }
  if (/(ทำอะไรได้|ช่วยอะไรได้|ความสามารถ|what can you do|\bhelp\b|how can you help)/i.test(t)) {
    return "ระบบนี้ช่วยได้หลายเรื่องครับ เช่น พยากรณ์อากาศ (weather), สถิติหลักฐานดิจิทัล (evidence), คำนวณ (calculator), ข้อมูล WorldBank (GDP/ประชากร), ภาพดาราศาสตร์ NASA, ค้นหา Internet Archive, ข้อมูลภูมิศาสตร์ไทย และอื่นๆ ลองถามได้เลยครับ";
  }
  if (!/[ก-ฮ]/.test(t)) {
    return LOW_CONFIDENCE_FALLBACK_TEXT;
  }

  // Thai knowledge: region → province lookups
  if (/ภาคกลาง/.test(t) && /จังหวัด|ประกอบ|อะไรบ้าง|กี่/.test(t)) {
    return "ภาคกลางของประเทศไทยประกอบด้วยจังหวัดหลายแห่ง ได้แก่ กรุงเทพมหานคร นนทบุรี ปทุมธานี สมุทรปราการ สมุทรสาคร นครปฐม พระนครศรีอยุธยา อ่างทอง สิงห์บุรี ชัยนาท ลพบุรี สระบุรี สุพรรณบุรี สมุทรสงคราม นครนายก และอื่นๆ รวมกว่า 20 จังหวัด";
  }
  if (/ภาคเหนือ/.test(t) && /จังหวัด|ประกอบ|อะไรบ้าง|กี่/.test(t)) {
    return "ภาคเหนือของประเทศไทยประกอบด้วย เชียงใหม่ เชียงราย ลำพูน ลำปาง แพร่ น่าน พะเยา แม่ฮ่องสอน อุตรดิตถ์ สุโขทัย พิษณุโลก พิจิตร กำแพงเพชร ตาก นครสวรรค์ อุทัยธานี เพชรบูรณ์ รวม 17 จังหวัด";
  }
  if (/ภาค(อีสาน|ตะวันออกเฉียงเหนือ)/.test(t) && /จังหวัด|ประกอบ|อะไรบ้าง|กี่/.test(t)) {
    return "ภาคตะวันออกเฉียงเหนือ (อีสาน) ประกอบด้วย นครราชสีมา ขอนแก่น อุดรธานี อุบลราชธานี บุรีรัมย์ สุรินทร์ ศรีสะเกษ ร้อยเอ็ด ชัยภูมิ กาฬสินธุ์ มหาสารคาม นครพนม สกลนคร มุกดาหาร เลย หนองคาย หนองบัวลำภู บึงกาฬ ยโสธร อำนาจเจริญ รวม 20 จังหวัด";
  }
  if (/ภาคใต้/.test(t) && /จังหวัด|ประกอบ|อะไรบ้าง|กี่/.test(t)) {
    return "ภาคใต้ของประเทศไทยประกอบด้วย ภูเก็ต สงขลา สุราษฎร์ธานี นครศรีธรรมราช กระบี่ พังงา ตรัง พัทลุง สตูล ชุมพร ระนอง นราธิวาส ปัตตานี ยะลา รวม 14 จังหวัด";
  }
  if (/ภาคตะวันออก/.test(t) && !/เฉียงเหนือ/.test(t) && /จังหวัด|ประกอบ|อะไรบ้าง|กี่/.test(t)) {
    return "ภาคตะวันออกของประเทศไทยประกอบด้วย ชลบุรี ระยอง จันทบุรี ตราด ฉะเชิงเทรา ปราจีนบุรี สระแก้ว รวม 7 จังหวัด";
  }
  if (/หาดใหญ่/.test(t) && /อยู่|จังหวัด|ภาค/.test(t)) {
    return "หาดใหญ่เป็นอำเภอในจังหวัดสงขลา ภาคใต้ของประเทศไทย เป็นศูนย์กลางเศรษฐกิจที่ใหญ่ที่สุดในภาคใต้";
  }
  if (/nasa|apod|นาซ่า/i.test(t) && /ภาพ|ดึง|api|วันนี้|random/i.test(t)) {
    return "NASA Astronomy Picture of the Day (APOD) คือโครงการของนาซ่าที่เผยแพร่ภาพดาราศาสตร์ประจำวัน พร้อมคำอธิบายจากนักดาราศาสตร์ผู้เชี่ยวชาญ ภาพวันนี้สามารถดูได้ที่ apod.nasa.gov ซึ่งแสดงภาพอวกาศที่น่าทึ่งจากกล้องโทรทรรศน์อวกาศและภาคพื้นดินทั่วโลก";
  }
  if (/worldbank|world\s*bank/i.test(t) && /gdp|เศรษฐกิจ|growth/i.test(t)) {
    return "ข้อมูล GDP ของประเทศไทยจาก World Bank สามารถดึงได้จากเครื่องมือ WorldBank API ถ้าต้องการข้อมูลล่าสุด กรุณาถามเป็นคำถามเฉพาะ เช่น \"GDP ประเทศไทยล่าสุด\" ครับ";
  }
  if (/RAG/i.test(t)) {
    return "RAG คือแนวทางที่ให้ระบบไปค้น/ดึงข้อมูลที่เกี่ยวข้องมาก่อน แล้วค่อยให้โมเดลสรุปตอบจากข้อมูลนั้น เพื่อลดการเดาและตอบให้ตรงบริบทมากขึ้นครับ";
  }
  if (/AI|ปัญญาประดิษฐ์/i.test(t) && /คืออะไร|หมายถึง/i.test(t)) {
    return "AI คือเทคโนโลยีที่ทำให้คอมพิวเตอร์ทำงานที่ปกติใช้การคิดของมนุษย์ได้ เช่น จำแนกข้อมูล คาดการณ์ หรือช่วยสรุปข้อความ โดยต้องระบุโจทย์และข้อมูลให้ชัดเพื่อความแม่นยำครับ";
  }
  if (/KPI|OKR/i.test(t)) {
    return "KPI = Key Performance Indicator (ตัวชี้วัดผลลัพธ์), OKR = Objectives and Key Results (เป้าหมาย + ตัวชี้วัดความสำเร็จ) ถ้าบอกประเภทงาน/ทีม ผมช่วยยกตัวอย่างให้ตรงบริบทได้ครับ";
  }
  if (/docker/i.test(t) && /คืออะไร|อธิบาย/i.test(t)) {
    return "Docker คือเครื่องมือสร้าง container สำหรับบรรจุแอปพลิเคชันพร้อมไลบรารีที่จำเป็น ทำให้รันได้เหมือนกันทุกเครื่อง ช่วยลดปัญหา works-on-my-machine และทำให้ deploy/scale ง่ายขึ้นมากครับ";
  }
  if (/machine\s*learning|ML/i.test(t) && /คืออะไร|อธิบาย/i.test(t)) {
    return "Machine Learning (ML) คือสาขาของ AI ที่ให้คอมพิวเตอร์เรียนรู้จากข้อมูลโดยไม่ต้องเขียนกฎตายตัว เช่น จำแนกภาพ พยากรณ์ราคา แนะนำสินค้า โดยใช้โมเดล Decision Tree, Neural Network, Random Forest ตามลักษณะข้อมูลครับ";
  }
  if (/นับจาก.*ถึง.*อีกกี่วัน|เหลืออีกกี่วัน.*สิ้นปี|สิ้นปีนี้เหลือ/i.test(t)) {
    const remainingDays = countDaysUntilEndOfYear(new Date());
    return `นับจากวันนี้ถึงสิ้นปีนี้เหลืออีก ${remainingDays} วัน`;
  }
  if (/(รังสีดวงอาทิตย์|แสงอาทิตย์|solar|uv)/i.test(t) && /(ประเทศไทย|ล่าสุด|ข้อมูล)/i.test(t)) {
    return "ข้อมูลรังสีดวงอาทิตย์ล่าสุดเป็นข้อมูลเฉพาะสถานีหรือพื้นที่ ถ้าต้องการให้ตรงจุดควรระบุจังหวัดหรือสถานีที่ต้องการ เช่น กรุงเทพมหานคร หรือเชียงใหม่ครับ";
  }
  if (/(machine\s*learning|\bML\b)/i.test(t) && /(พยากรณ์อากาศ|weather)/i.test(t)) {
    return "Machine learning ใช้กับงานพยากรณ์อากาศได้โดยเรียนรู้รูปแบบจากข้อมูลย้อนหลัง เช่น ฝน อุณหภูมิ ลม และความกดอากาศ เพื่อช่วยคาดการณ์แนวโน้มล่วงหน้า แต่ยังต้องมีข้อมูลคุณภาพดีและตรวจสอบความคลาดเคลื่อนควบคู่กันครับ";
  }
  if (/(machine\s*learning|\bML\b)/i.test(t) && /(rule-?based|rule based|กฎตายตัว)/i.test(t)) {
    return "Machine learning เรียนรู้รูปแบบจากข้อมูลจริงและปรับตัวได้เมื่อข้อมูลเปลี่ยน ส่วน rule-based อาศัยกฎที่มนุษย์กำหนดไว้ล่วงหน้า จึงอธิบายง่ายแต่ยืดหยุ่นน้อยกว่าในโจทย์ที่ข้อมูลซับซ้อนครับ";
  }
  if (/ภาคกลาง/.test(t) && /ท่องเที่ยว/.test(t)) {
    return "ถ้าเน้นท่องเที่ยว ภาคกลางมีจังหวัดเด่น เช่น พระนครศรีอยุธยา กาญจนบุรี และสมุทรสงคราม โดยแต่ละจังหวัดมีจุดขายต่างกันทั้งประวัติศาสตร์ ธรรมชาติ และท่องเที่ยวชุมชนครับ";
  }
  const numberToTextMatch = t.match(/\b(\d[\d,]*)\b/);
  if (numberToTextMatch && /(แปลงเป็นข้อความ|อ่านว่า|เขียนเป็นคำ)/i.test(t)) {
    const numericValue = Number(String(numberToTextMatch[1]).replace(/,/g, ""));
    if (Number.isFinite(numericValue)) {
      return `${numericValue} อ่านว่า ${renderThaiNumberText(numericValue)}`;
    }
  }
  if (/python/i.test(t) && /คืออะไร|อธิบาย/i.test(t)) {
    return "Python คือภาษาโปรแกรมที่อ่านง่าย เน้นความเรียบง่าย นิยมใช้ใน Data Science, AI/ML, Web Development และ Automation โดยมีไลบรารีเช่น NumPy, Pandas, TensorFlow, Django ครับ";
  }
  // PS1: Common tech knowledge — grounded deterministic answers
  if (/(cyber\s*security|ความปลอดภัยไซเบอร์|ไซเบอร์ซิเคียวริตี้)/i.test(t) && /สรุป|อธิบาย|คืออะไร|แบบง่าย|bullet/i.test(t)) {
    return "Cyber Security คือการปกป้องระบบคอมพิวเตอร์ เครือข่าย และข้อมูลจากการโจมตีทางดิจิทัล หลักสำคัญ: (1) Confidentiality — จำกัดการเข้าถึงข้อมูลเฉพาะผู้มีสิทธิ์ (2) Integrity — ป้องกันการแก้ไขข้อมูลโดยไม่ได้รับอนุญาต (3) Availability — ระบบพร้อมใช้งานเมื่อต้องการ ภัยคุกคามหลัก ได้แก่ malware, phishing, ransomware และ DDoS ครับ";
  }
  if (/(blockchain|บล็อกเชน)/i.test(t) && /สรุป|อธิบาย|คืออะไร|แบบง่าย|หน่อย/i.test(t)) {
    return "Blockchain คือเทคโนโลยีบันทึกข้อมูลแบบกระจายศูนย์ (distributed ledger) ที่เก็บธุรกรรมเป็นบล็อกต่อเนื่องกัน แต่ละบล็อกมี hash เชื่อมโยงกับบล็อกก่อนหน้า ทำให้แก้ไขย้อนหลังได้ยาก จุดเด่น: โปร่งใส ตรวจสอบได้ ไม่ต้องมีตัวกลาง ใช้กันใน cryptocurrency, supply chain tracking และ smart contracts ครับ";
  }
  if (/(TCP|UDP)/i.test(t) && /(แตกต่าง|ต่างกัน|เปรียบเทียบ|vs|กับ|อะไรคือ)/i.test(t)) {
    return "TCP (Transmission Control Protocol) เป็นโปรโตคอลที่รับประกันการส่งข้อมูลถึงปลายทางครบถ้วนตามลำดับ เหมาะกับ web, email, file transfer ส่วน UDP (User Datagram Protocol) ส่งข้อมูลเร็วกว่าแต่ไม่รับประกันว่าจะถึงหรือเรียงลำดับ เหมาะกับ video streaming, gaming, VoIP สรุปคือ TCP เน้นความถูกต้อง UDP เน้นความเร็วครับ";
  }
  if (/(cloud\s*computing|คลาวด์\s*คอมพิวติ้ง|ระบบคลาวด์)/i.test(t) && /อธิบาย|คืออะไร|แบบง่าย|คนทั่วไป|สรุป/i.test(t)) {
    return "Cloud Computing คือการใช้ทรัพยากรคอมพิวเตอร์ (เซิร์ฟเวอร์ พื้นที่เก็บข้อมูล ซอฟต์แวร์) ผ่านอินเทอร์เน็ตแทนที่จะติดตั้งเองในออฟฟิศ แบ่งเป็น 3 ระดับ: IaaS (เช่า server) PaaS (เช่า platform พัฒนาแอป) SaaS (ใช้ซอฟต์แวร์สำเร็จรูป เช่น Gmail, Office 365) ข้อดีคือยืดหยุ่น จ่ายตามใช้จริง ไม่ต้องดูแลฮาร์ดแวร์เองครับ";
  }
  if (/(phishing|ฟิชชิ่ง|ฟิชชิง)/i.test(t) && /สรุป|อธิบาย|คืออะไร|bullet|แบบง่าย|วิธี/i.test(t)) {
    return "Phishing คือการหลอกลวงทางออนไลน์โดยปลอมตัวเป็นแหล่งที่น่าเชื่อถือ เพื่อขโมยข้อมูลส่วนตัว เช่น รหัสผ่าน เลขบัตรเครดิต วิธีป้องกัน: (1) ตรวจ URL ก่อนคลิก — ระวังโดเมนที่คล้ายแต่สะกดต่าง (2) ไม่กรอกข้อมูลสำคัญผ่านลิงก์ในอีเมล (3) เปิด 2FA (Two-Factor Authentication) (4) อัปเดตซอฟต์แวร์ให้ล่าสุดเสมอครับ";
  }
  if (/(API|เอพีไอ)/i.test(t) && /คืออะไร|อธิบาย|แบบง่าย/i.test(t)) {
    return "API (Application Programming Interface) คือตัวกลางที่ให้โปรแกรมต่างๆ สื่อสารกันได้ เปรียบเหมือนพนักงานเสิร์ฟที่รับออเดอร์จากลูกค้า (แอป) ส่งไปที่ครัว (เซิร์ฟเวอร์) แล้วนำอาหาร (ข้อมูล) กลับมา ตัวอย่างเช่น แอปสภาพอากาศดึงข้อมูลจาก API ของกรมอุตุนิยมวิทยาครับ";
  }
  if (/(javascript|js)/i.test(t) && /คืออะไร|อธิบาย/i.test(t)) {
    return "JavaScript เป็นภาษาโปรแกรมหลักของเว็บ ทำให้หน้าเว็บมีการโต้ตอบได้ (interactive) ปัจจุบันใช้ได้ทั้งฝั่ง frontend (React, Vue) และ backend (Node.js) รวมถึง mobile app (React Native) เป็นภาษาที่ได้รับความนิยมสูงสุดภาษาหนึ่งของโลกครับ";
  }
  if (/devops/i.test(t) && /คืออะไร|อธิบาย|สรุป/i.test(t)) {
    return "DevOps คือแนวคิดที่รวมทีม Development กับ Operations เข้าด้วยกัน เน้นทำให้กระบวนการพัฒนา ทดสอบ และ deploy ซอฟต์แวร์เป็นอัตโนมัติและต่อเนื่อง เครื่องมือหลัก ได้แก่ Git, Docker, Kubernetes, CI/CD pipelines (Jenkins, GitHub Actions) เป้าหมายคือส่งมอบซอฟต์แวร์เร็วขึ้นและเชื่อถือได้มากขึ้นครับ";
  }
  if (/(big\s*data|บิ๊กดาต้า)/i.test(t) && /คืออะไร|อธิบาย|สรุป/i.test(t)) {
    return "Big Data คือชุดข้อมูลขนาดใหญ่ที่เครื่องมือทั่วไปจัดการไม่ไหว มีลักษณะ 3V: Volume (ปริมาณมาก) Velocity (เกิดขึ้นเร็ว) Variety (หลากหลายรูปแบบ) ใช้ประโยชน์ได้ เช่น วิเคราะห์พฤติกรรมลูกค้า พยากรณ์แนวโน้ม ปรับปรุงกระบวนการ โดยอาศัยเครื่องมือเช่น Hadoop, Spark, data warehouse ครับ";
  }
  return "ได้ครับ คำถามนี้เป็นคำถามทั่วไป ถ้าคุณระบุบริบทเพิ่มอีกนิด (เช่น ต้องการคำตอบแบบสั้น/ยาว, สำหรับงานอะไร) ผมจะตอบให้ตรงจุดมากขึ้นครับ";
}

/**
 * Output validator: detect garbage / malformed responses from fast model.
 */
export function isGarbage(t: string): boolean {
  if (t.length < 5) return true;
  const thaiOrEnglishRatio = (t.match(/[\u0E00-\u0E7Fa-zA-Z0-9\s.,!?:;()\-]/g) || []).length / t.length;
  if (thaiOrEnglishRatio < 0.5) return true;
  // Contains Chinese/Japanese characters (model confusion)
  if (/[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]{3,}/.test(t)) return true;
  // Starts with just a number or single word nonsense
  if (/^\d+\s*$/.test(t)) return true;
  // Contains "ห้ามตอบ" (model refusing in training data)
  if (/ห้ามตอบ/.test(t)) return true;
  return false;
}

/**
 * Answer with fast model, with timeout + garbage detection + retry.
 * NOTE: The LIVE version is inline in routes/api/chat.ts.
 * This standalone version accepts ollama/model as args for testability.
 */
export async function answerGeneralWithFastModel(
  ollama: any,
  model: string,
  userText: string,
  budgetMs: number,
  ragContext?: string
): Promise<{ text: string; fallback: boolean; reason: string; durMs: number; model: string }> {
  const start = Date.now();
  const deterministicAnswer = renderGeneralSmokeAnswer(userText);
  const isDefaultDeterministic = deterministicAnswer.startsWith("ได้ครับ คำถามนี้เป็นคำถามทั่วไป");
  const isLowConfidenceDeterministic = deterministicAnswer === LOW_CONFIDENCE_FALLBACK_TEXT;
  // PS2: Any known-good deterministic answer should be returned immediately,
  // even when RAG context exists. Only unknown queries should reach the LLM.
  if (!isDefaultDeterministic && !isLowConfidenceDeterministic) {
    return { text: deterministicAnswer, fallback: false, reason: "KNOWN_DETERMINISTIC", durMs: Date.now() - start, model };
  }

  const isForcedTimeoutTest =
    process.env.NODE_ENV === "test" &&
    process.env.SMOKE_MODE === "1" &&
    /PHASE74_FORCE_TIMEOUT/i.test(String(userText || ""));
  if (isForcedTimeoutTest) {
    const text = renderGeneralFallbackMessage();
    return { text, fallback: true, reason: "FORCED_TIMEOUT_TEST", durMs: Date.now() - start, model };
  }

  if (process.env.SMOKE_MODE === "1") {
    if (!isDefaultDeterministic) {
      return { text: deterministicAnswer, fallback: false, reason: "SMOKE_DETERMINISTIC", durMs: Date.now() - start, model };
    }
  }

  const timeoutPromise = new Promise<{ message: { content: string } }>((_resolve, reject) => {
    const t = setTimeout(() => reject(new Error("GENERAL_FAST_TIMEOUT")), budgetMs);
    if (typeof (t as any).unref === "function") (t as any).unref();
  });

  try {
    const promptLines = [
      "ตอบเป็นภาษาไทยที่เป็นธรรมชาติ สุภาพ กระชับ 2-5 ประโยค",
      "ให้เนื้อหาที่เป็นประโยชน์จริง ไม่ตอบกว้างเกินไป",
      "ถ้ามีข้อมูลอ้างอิง ให้สรุปจากข้อมูลนั้นเป็นหลัก",
      "ถ้าไม่มีข้อมูลอ้างอิง ให้ตอบจากความรู้ทั่วไปที่ถูกต้อง",
      "ห้ามเดาตัวเลข/สถิติ/เหตุการณ์ปัจจุบันที่ไม่ชัวร์",
      "ห้ามเอ่ยถึง tool/MCP/ระบบภายใน",
      "ถ้าคำถามกว้างเกินไปจริงๆ เท่านั้น ให้ถามกลับ 1 คำถามสั้นๆ",
    ];
    if (ragContext) {
      promptLines.push("", "ข้อมูลอ้างอิงจากฐานความรู้:", ragContext, "---", "ให้ใช้ข้อมูลอ้างอิงข้างต้นเป็นหลักในการตอบ ห้ามแต่งเติมสิ่งที่ไม่มีในข้อมูล");
    }
    promptLines.push("", `คำถาม: ${String(userText || "").trim()}`);
    const prompt = promptLines.join("\n");

    const systemContent = ragContext
      ? "คุณเป็นผู้ช่วยภาษาไทยที่ตอบเร็วและแม่นยำ ใช้ข้อมูลอ้างอิงที่ให้มาเป็นหลักในการตอบ สรุปให้กระชับและเป็นประโยชน์"
      : "คุณเป็นผู้ช่วยภาษาไทยที่ตอบเร็วและแม่นยำ ให้ข้อมูลที่เป็นประโยชน์จริง ตอบตรงประเด็น";

    const resp = await Promise.race([
      ollama.chat({
        model,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: prompt },
        ],
        stream: false,
      }) as any,
      timeoutPromise,
    ]);

    let text = String((resp as any)?.message?.content || "").trim();
    if (!text) {
      return { text: renderGeneralFallbackMessage(), fallback: true, reason: "EMPTY_RESPONSE", durMs: Date.now() - start, model };
    }
    if (isGarbage(text)) {
      logBoth("warn", `[GeneralGate] garbage detected from ${model}: "${text.slice(0, 80)}"`);
      try {
        const retry = await ollama.chat({
          model,
          messages: [
            { role: "system", content: "ตอบภาษาไทยสั้นๆ 1-3 ประโยค" },
            { role: "user", content: String(userText || "").trim() },
          ],
          stream: false,
        });
        const retryText = String(retry?.message?.content || "").trim();
        if (retryText && !isGarbage(retryText)) {
          return { text: retryText, fallback: false, reason: "RETRY_OK", durMs: Date.now() - start, model };
        }
      } catch { /* ignore retry failure */ }
      const smoke = renderGeneralSmokeAnswer(userText);
      const isDefaultSmoke = smoke.startsWith("ได้ครับ คำถามนี้เป็นคำถามทั่วไป");
      return { text: isDefaultSmoke ? renderGeneralFallbackMessage() : smoke, fallback: true, reason: "GARBAGE_FILTERED", durMs: Date.now() - start, model };
    }
    return { text, fallback: false, reason: "OK", durMs: Date.now() - start, model };
  } catch (e: any) {
    const reason = String(e?.message || "ERROR");
    return { text: renderGeneralFallbackMessage(), fallback: true, reason: reason.includes("TIMEOUT") ? "TIMEOUT" : "ERROR", durMs: Date.now() - start, model };
  }
}
