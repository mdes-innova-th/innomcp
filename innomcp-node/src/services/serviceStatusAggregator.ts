import { analyticsService } from './analyticsService';
import { mdesModelCache } from './mdesModelCache';
import { thaiNLPService } from './thaiNLPService';

export async function checkAllServices(): Promise<{
  analytics: boolean;
  mdesModels: boolean;
  thaiNlp: boolean;
}> {
  const results = await Promise.allSettled([
    Promise.resolve(analyticsService.getStats()),
    mdesModelCache.getModels(),
    Promise.resolve(thaiNLPService.isThai('test')),
  ]);

  return {
    analytics: results[0].status === 'fulfilled',
    mdesModels: results[1].status === 'fulfilled',
    thaiNlp: results[2].status === 'fulfilled',
  };
}
