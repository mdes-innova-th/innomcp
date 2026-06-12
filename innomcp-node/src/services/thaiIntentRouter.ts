import { ThaiNLPService } from './thaiNLPService';

export interface RoutingDecision {
  model: string;
  reason: string;
  confidence: number;
  fallback?: string;
}

const MDES_OLLAMA_MODELS = [
  'gemma4:26b',
  'qwen2.5:7b',
  'deepseek-r1:32b',
  'qwen2.5-coder:7b',
  'llama3.2:3b',
];

export class ThaiIntentRouter {
  static readonly DOMAIN_MODEL_MAP: Record<string, string[]> = {
    weather: ['gemma4:26b', 'qwen2.5:7b'],
    code: ['deepseek-r1:32b', 'qwen2.5-coder:7b'],
    document: ['gemma4:26b'],
    reasoning: ['deepseek-r1:32b'],
    general: ['gemma4:26b', 'qwen2.5:7b'],
    thai: ['gemma4:26b'],
    healthcare: ['gemma4:26b'],
    legal: ['gemma4:26b', 'deepseek-r1:32b'],
    finance: ['gemma4:26b', 'deepseek-r1:32b'],
    education: ['gemma4:26b'],
    government: ['gemma4:26b', 'deepseek-r1:32b'],
  };

  private nlpService: ThaiNLPService;

  constructor() {
    this.nlpService = new ThaiNLPService();
  }

  selectModelForDomain(domain: string, models: string[]): string {
    const preferredModels = ThaiIntentRouter.DOMAIN_MODEL_MAP[domain] ?? ThaiIntentRouter.DOMAIN_MODEL_MAP.general;
    const availablePreferred = preferredModels.find((pm) => models.includes(pm));
    if (availablePreferred) return availablePreferred;

    // Fallback to first available model, give priority to known good defaults
    const fallbackOrder = [...MDES_OLLAMA_MODELS, ...models];
    const fallbackModel = fallbackOrder.find((fm) => models.includes(fm));
    return fallbackModel ?? '';
  }

  async route(text: string, availableModels: string[]): Promise<RoutingDecision> {
    if (availableModels.length === 0) {
      return {
        model: '',
        reason: 'ไม่มีโมเดลที่พร้อมใช้งาน (ไม่มีโมเดลในระบบ)',
        confidence: 0,
      };
    }

    const intent = this.nlpService.detectIntent(text);
    const domain = intent.domain || 'general';
    const nluConfidence = 0.7; // detectIntent is rule-based (no confidence score)

    const chosenModel = this.selectModelForDomain(domain, availableModels);

    if (!chosenModel) {
      // This should not happen because of fallback logic, but safeguard
      return {
        model: '',
        reason: 'ไม่สามารถเลือกโมเดลได้ - ระบบไม่มีโมเดลที่รองรับ',
        confidence: 0,
      };
    }

    const preferredModels = ThaiIntentRouter.DOMAIN_MODEL_MAP[domain] ?? ThaiIntentRouter.DOMAIN_MODEL_MAP.general;
    const isPreferred = preferredModels.includes(chosenModel);
    const confidence = isPreferred ? nluConfidence : nluConfidence * 0.8;

    const reason = isPreferred
      ? `เลือกโมเดล "${chosenModel}" สำหรับโดเมน "${domain}" (ตรงตามค่ากำหนด) ความมั่นใจ: ${(confidence * 100).toFixed(0)}%`
      : `เลือกโมเดลสำรอง "${chosenModel}" สำหรับโดเมน "${domain}" เนื่องจากไม่มีโมเดลที่แนะนำพร้อมใช้งาน ความมั่นใจ: ${(confidence * 100).toFixed(0)}%`;

    return {
      model: chosenModel,
      reason,
      confidence,
      fallback: isPreferred ? undefined : chosenModel,
    };
  }

  async routeToMDES(text: string): Promise<RoutingDecision> {
    return this.route(text, MDES_OLLAMA_MODELS);
  }
}

export const thaiIntentRouter = new ThaiIntentRouter();