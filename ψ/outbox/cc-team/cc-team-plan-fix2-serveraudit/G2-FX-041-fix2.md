<!-- cc-team deliverable
 group: G2 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-041 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1614,"completion_tokens":2786,"total_tokens":4400,"prompt_tokens_details":{"cached_tokens":1536,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2052,"image_tokens":0},"cache_creation_input_tokens":0} | 29s
 generated: 2026-06-13T12:10:56.373Z -->
FILE: innomcp-server-node/src/utils/mcpLogger.ts
<<<<<<< SEARCH
import fs from 'fs';
import path from 'path';
=======
import fs from 'fs';
import path from 'path';
import os from 'os';
>>>>>>> REPLACE

FILE: innomcp-server-node/src/utils/mcpLogger.ts
<<<<<<< SEARCH
// Project-specific logs directory
const PROJECT_LOG_DIR = path.join(__dirname, '..', '..', 'logs');

// Root aggregated logs directory
const ROOT_LOG_DIR = path.join(__dirname, '..', '..', '..', 'logs');
=======
// Use LOG_DIR env var or system temp directory to avoid writing inside node_modules
const BASE_LOG_DIR = process.env.LOG_DIR || path.join(os.tmpdir(), 'innomcp-logs');

// Project-specific logs directory
const PROJECT_LOG_DIR = path.join(BASE_LOG_DIR, 'project');

// Root aggregated logs directory
const ROOT_LOG_DIR = path.join(BASE_LOG_DIR, 'root');
>>>>>>> REPLACE

FILE: innomcp-server-node/src/utils/mcpLogger.ts
<<<<<<< SEARCH
// Create both directories
[PROJECT_LOG_DIR, ROOT_LOG_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});
=======
// Create both directories
[PROJECT_LOG_DIR, ROOT_LOG_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (error) {
      console.warn(`[WARN] Failed to create log directory ${dir}:`, error);
    }
  }
});
>>>>>>> REPLACE

FILE: innomcp-server-node/src/utils/mcpLogger.ts
<<<<<<< SEARCH
        } else if (typeof data === 'object') {
            logMessage += `\n  Data: ${JSON.stringify(data, null, 2)}`;
        } else {
=======
        } else if (typeof data === 'object') {
            try {
                logMessage += `\n  Data: ${JSON.stringify(data, null, 2)}`;
            } catch {
                logMessage += `\n  Data: ${String(data)}`;
            }
        } else {
>>>>>>> REPLACE

FILE: innomcp-server-node/src/utils/mcpLogger.ts
<<<<<<< SEARCH
    // Write to project log file
    try {
        fs.appendFileSync(PROJECT_LOG_FILE, logMessage);
    } catch (error) {
        console.error('[ERROR] Failed to write to project log file:', error);
    }

    // Write to root aggregated log file
    try {
        fs.appendFileSync(ROOT_LOG_FILE, logMessage);
    } catch (error) {
        console.error('[ERROR] Failed to write to root log file:', error);
    }
=======
    // Write to project log file asynchronously
    fs.promises.appendFile(PROJECT_LOG_FILE, logMessage).catch(error => {
        console.error('[ERROR] Failed to write to project log file:', error);
    });

    // Write to root aggregated log file asynchronously
    fs.promises.appendFile(ROOT_LOG_FILE, logMessage).catch(error => {
        console.error('[ERROR] Failed to write to root log file:', error);
    });
>>>>>>> REPLACE
