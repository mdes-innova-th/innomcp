
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const TEST_COMMAND_ARGS = ['test']; // "npm test" -> "npm" + ["test"]
const MAX_DURATION_MS = 6 * 3600 * 1000; // 6 Hours
const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 Minutes
const RETRY_DELAY_MS = 10 * 1000;       // 10 Seconds
const MAX_RETRIES = 3;                  // Max restarts

const LOG_FILE = 'antigravity_session.log';
const REPORT_FILE = 'summary_report.md';

// --- STATE ---
const startTime = Date.now();
let running = true;
let lastOutputTime = Date.now();
let passedSpecs = [];
let failedSpecs = [];
let stuckEvents = 0;
let restarts = 0;
let processRef = null;

function log(msg) {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const line = `[${timestamp}] ${msg}`;
    console.log(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
}

function rotateLog() {
    if (!fs.existsSync(LOG_FILE)) return;
    
    try {
        const data = fs.readFileSync(LOG_FILE, 'utf8');
        const lines = data.split('\n');
        
        if (lines.length > 10000) {
            console.log(`🧹 Log file exceeded 10,000 lines (${lines.length}). Truncating top 50%...`);
            // Keep last 5000 lines
            const newLines = lines.slice(lines.length - 5000);
            fs.writeFileSync(LOG_FILE, newLines.join('\n'));
            log(`✅ Log truncation complete. New size: ${newLines.length} lines.`);
        }
    } catch (err) {
        console.error(`⚠️ Log rotation failed: ${err.message}`);
    }
}

function generateReport() {
    const durationMs = Date.now() - startTime;
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);

    let content = `# 🛡️ Antigravity Watcher Report (Node.js Edition)\n\n`;
    content += `**Date:** ${new Date().toLocaleString()}\n`;
    content += `**Total Duration:** ${hours}h ${minutes}m\n\n`;
    content += `## 📊 Statistics\n`;
    content += `- **Passed Specs:** ${passedSpecs.length}\n`;
    content += `- **Failed Specs:** ${failedSpecs.length}\n`;
    content += `- **Stuck/Idle Events:** ${stuckEvents}\n`;
    content += `- **Runner Restarts:** ${restarts}\n\n`;

    content += `## ❌ Failed Specs\n`;
    if (failedSpecs.length === 0) content += `_No failures detected._\n`;
    else failedSpecs.forEach(spec => content += `- \`${spec}\`\n`);

    content += `\n## ✅ Passed Specs (Sample)\n`;
    passedSpecs.slice(-10).forEach(spec => content += `- \`${spec}\`\n`);

    fs.writeFileSync(REPORT_FILE, content);
    log(`Report generated: ${REPORT_FILE}`);
}

function startRunner() {
    if (!running) return;
    
    rotateLog(); // Check log size before starting

    if (Date.now() - startTime > MAX_DURATION_MS) {
        log("🛑 6-Hour Time Limit Reached. Stopping.");
        running = false;
        generateReport();
        process.exit(0);
        return;
    }

    log(`🚀 Starting Test Runner: npm ${TEST_COMMAND_ARGS.join(' ')}`);
    lastOutputTime = Date.now();

    const isWin = process.platform === 'win32';
    // On Windows, use npm.cmd
    const cmd = isWin ? 'npm.cmd' : 'npm';
    
    processRef = spawn(cmd, TEST_COMMAND_ARGS, { shell: true });

    // Stream monitoring
    const onData = (data, source) => {
        lastOutputTime = Date.now();
        const lines = data.toString().split('\n');
        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;
            
            // Detect Status
            if (trimmed.includes('PASS')) passedSpecs.push(trimmed);
            if (trimmed.includes('FAIL')) failedSpecs.push(trimmed);
            
            log(`[${source}] ${trimmed}`);
        });
    };

    processRef.stdout.on('data', d => onData(d, 'OUT'));
    processRef.stderr.on('data', d => onData(d, 'ERR'));

    processRef.on('close', (code) => {
        log(`🏁 Runner exited with code ${code}`);
        processRef = null;

        if (!running) return;

        if (code !== 0) {
            log(`⚠️ Failure detected. Waiting ${RETRY_DELAY_MS/1000}s...`);
            restarts++;
            if (restarts > MAX_RETRIES) {
                log("❌ Max retries reached. ABORTING.");
                running = false;
                generateReport();
                process.exit(1);
            } else {
                setTimeout(startRunner, RETRY_DELAY_MS);
            }
        } else {
            log("✅ Tests completed successfully.");
            log("🔄 Cycle complete. Restarting in 60s...");
            setTimeout(startRunner, 60000);
        }
    });

    processRef.on('error', (err) => {
        log(`❌ Spawn Error: ${err.message}`);
        setTimeout(startRunner, 30000);
    });
}

// Watchdog Loop
setInterval(() => {
    if (!running) return;
    
    // Check Global Timeout
    if (Date.now() - startTime > MAX_DURATION_MS) {
        log("🛑 Global Timeout. Killing process.");
        if (processRef) processRef.kill();
        running = false;
        generateReport();
        process.exit(0);
    }

    // Check Idle
    if (processRef && (Date.now() - lastOutputTime > IDLE_TIMEOUT_MS)) {
        log(`💤 Idle detected (> ${IDLE_TIMEOUT_MS/60000} mins). Restarting runner...`);
        stuckEvents++;
        processRef.kill(); 
        // 'close' handler will trigger restart
    }
}, 5000); // Check every 5s

// Cleanup
const cleanup = () => {
    if (running) {
        log("⚠️ Interrupt received. Shutting down...");
        running = false;
        if (processRef) processRef.kill();
        generateReport();
        process.exit(0);
    }
};
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

log("=== Antigravity Watcher (Node.js) Started ===");
startRunner();
