import * as artifacts from '../utils/artifacts';

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
