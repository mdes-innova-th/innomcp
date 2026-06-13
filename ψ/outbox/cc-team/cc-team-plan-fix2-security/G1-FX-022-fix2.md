<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from security)
 member: FX-022 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1758,"completion_tokens":3249,"total_tokens":5007,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2842,"image_tokens":0},"cache_creation_input_tokens":0} | 35s
 generated: 2026-06-13T11:45:20.388Z -->
FILE: innomcp-node/src/services/thaiIntentRouter.ts
<<<<<<< SEARCH
    const intent = this.nlpService.detectIntent(text);
    const domain = intent.domain || 'general';
=======
    const sanitizedText = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, 2000);
    const intent = this.nlpService.detectIntent(sanitizedText);
    const domain = intent.domain || 'general';
>>>>>>> REPLACE

FILE: innomcp-node/src/services/thaiIntentRouter.ts
<<<<<<< SEARCH
    const reason = isPreferred
      ? `เลือกโมเดล "${chosenModel}" สำหรับโดเมน "${domain}" (ตรงตามค่ากำหนด) ความมั่นใจ: ${(confidence * 100).toFixed(0)}%`
      : `เลือกโมเดลสำรอง "${chosenModel}" สำหรับโดเมน "${domain}" เนื่องจากไม่มีโมเดลที่แนะนำพร้อมใช้งาน ความมั่นใจ: ${(confidence * 100).toFixed(0)}%`;
=======
    const safeDomain = domain.replace(/[\x00-\x1F\x7F]/g, '');
    const safeChosenModel = chosenModel.replace(/[\x00-\x1F\x7F]/g, '');
    const reason = isPreferred
      ? `เลือกโมเดล "${safeChosenModel}" สำหรับโดเมน "${safeDomain}" (ตรงตามค่ากำหนด) ความมั่นใจ: ${(confidence * 100).toFixed(0)}%`
      : `เลือกโมเดลสำรอง "${safeChosenModel}" สำหรับโดเมน "${safeDomain}" เนื่องจากไม่มีโมเดลที่แนะนำพร้อมใช้งาน ความมั่นใจ: ${(confidence * 100).toFixed(0)}%`;
>>>>>>> REPLACE
