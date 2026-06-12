<!-- cc-team deliverable
 group: INT (Integration utilities, docs, quality tools)
 member: INT-1 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":57,"completion_tokens":1181,"total_tokens":1238,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1053,"image_tokens":0},"cache_creation_input_tokens":0} | 20s
 generated: 2026-06-12T03:48:27.799Z -->
import analyticsService from './analyticsService';
import mdesModelsService from './mdesModelsService';
import thaiNlpService from './thaiNlpService';

export async function checkAllServices(): Promise<{
  analytics: boolean;
  mdesModels: boolean;
  thaiNlp: boolean;
}> {
  const [analytics, mdesModels, thaiNlp] = await Promise.all([
    analyticsService.isAvailable(),
    mdesModelsService.isAvailable(),
    thaiNlpService.isAvailable(),
  ]);
  return { analytics, mdesModels, thaiNlp };
}
