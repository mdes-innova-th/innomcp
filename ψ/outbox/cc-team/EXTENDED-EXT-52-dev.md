<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-52 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":62,"completion_tokens":1007,"total_tokens":1069,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":718,"image_tokens":0},"cache_creation_input_tokens":0} | 11s
 generated: 2026-06-13T05:27:26.943Z -->
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// workspace is assumed to be a sibling directory to scripts
const workspaceDir = resolve(__dirname, '..', 'workspace');
const testDir = resolve(workspaceDir, 'test');

mkdirSync(testDir, { recursive: true });

const sampleMd = `# Sample Test File

This is a sample markdown file used for testing file operations.

- Item 1
- Item 2
- Item 3
`;

const data = {
  name: 'Test Data',
  version: '1.0.0',
  items: [
    { id: 1, value: 'alpha' },
    { id: 2, value: 'beta' },
    { id: 3, value: 'gamma' }
  ],
  metadata: {
    created: new Date().toISOString(),
    environment: 'test'
  }
};

writeFileSync(resolve(testDir, 'sample.md'), sampleMd);
writeFileSync(resolve(testDir, 'data.json'), JSON.stringify(data, null, 2));

console.log('Test data seeded successfully.');
