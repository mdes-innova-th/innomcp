<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from security)
 member: FX-002 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":653,"completion_tokens":3966,"total_tokens":4619,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3548,"image_tokens":0},"cache_creation_input_tokens":0} | 43s
 generated: 2026-06-13T11:32:02.878Z -->
FILE: innomcp-node/src/services/artifactService.ts
<<<<<<< SEARCH
import * as artifacts from '../utils/artifacts';
=======
import * as artifacts from '../utils/artifacts';
import { validateTaskOwnership } from '../auth';
>>>>>>> REPLACE

FILE: innomcp-node/src/services/artifactService.ts
<<<<<<< SEARCH
export const artifactService = {
  async listArtifacts(taskId: string): Promise<string[]> {
    return artifacts.listArtifacts(taskId);
  },

  async getArtifact(taskId: string, name: string) {
    const artifact = await artifacts.getArtifact(taskId, name);

    // The router expects 'buffer', 'mimeType', and 'name'
    return {
      name: artifact.name,
      mimeType: artifact.mime,
      buffer: Buffer.from(artifact.content, 'utf-8'),
    };
  },
};
=======
export const artifactService = {
  async listArtifacts(taskId: string, userId: string): Promise<string[]> {
    await validateTaskOwnership(taskId, userId);
    sanitizeParam(taskId);
    return artifacts.listArtifacts(taskId);
  },

  async getArtifact(taskId: string, name: string, userId: string) {
    await validateTaskOwnership(taskId, userId);
    sanitizeParam(taskId);
    sanitizeParam(name);
    const artifact = await artifacts.getArtifact(taskId, name);

    // The router expects 'buffer', 'mimeType', and 'name'
    return {
      name: artifact.name,
      mimeType: artifact.mime,
      buffer: Buffer.from(artifact.content, 'utf-8'),
    };
  },
};

function sanitizeParam(param: string): void {
  if (param.includes('..') || param.includes('/') || param.includes('\\')) {
    throw new Error(`Invalid parameter: path traversal detected`);
  }
}
>>>>>>> REPLACE
