<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: UTIL-2 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":58,"completion_tokens":597,"total_tokens":655,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":340,"image_tokens":0},"cache_creation_input_tokens":0} | 7s
 generated: 2026-06-13T05:27:58.702Z -->
import { promises as fs } from 'fs';
import path from 'path';

export async function readJson<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listFiles(dir: string, ext?: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = entries
    .filter(entry => entry.isFile())
    .map(entry => entry.name);
  
  if (ext !== undefined) {
    return files.filter(name => name.endsWith(ext));
  }
  return files;
}
