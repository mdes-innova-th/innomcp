<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-06 role=doc model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":52,"completion_tokens":3000,"total_tokens":3052,"prompt_tokens_details":{"cached_tokens":4,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 57s
 generated: 2026-06-13T05:26:23.630Z -->
The user wants a `MONITORING.md` file for a project called `innomcp-node`. The requirements are:

1.  **Length:** 250-300 words (Thai + English mixed).
2.  **Content:** How to monitor health, what metrics to watch, alert thresholds, and the `health-monitor.js` script.
3.  **Format:** Output *only* markdown. No extra text before or after.

Let's break down the content needed:
- **How to monitor health:** Mention the `health-monitor.js` script, HTTP endpoint (`/health`), process uptime, memory, CPU.
- **Metrics to watch:** Memory usage (RSS/Heap), CPU load, event loop lag, response time, error rate.
- **Alert thresholds:** e.g., Memory > 80%, CPU > 70%, event loop lag > 100ms, error rate > 5%.
- **health-monitor.js script:** Provide a brief code snippet or description of what it does. Since it's a markdown file, a code block is appropriate.

Language constraint: Thai + English mixed. The word count is 250-300 words *total*. This is quite short. I need to be concise. I can write bilingual sentences or alternate sentences. Let's aim for a compact style where key terms are in English and explanations/descriptions are in Thai, or short paragraphs in both. Actually, "Thai+English" usually means a mixed document, often with Thai as primary and English terms, or side-by-side. Given the word count, a mixed paragraph style is best. Let's estimate words.

Drafting content:

Title: # MONITORING.md for innomcp-node

## Overview
`innomcp-node` ใช้ `health-monitor.js` เพื่อตรวจสอบสถานะระบบแบบ real-time. The script exposes a `/health` endpoint and logs vital metrics.

## Metrics to Watch
ควร monitor ค่าต่อไปนี้:
- **Memory Usage**: RSS แล�� Heap ห้ามเกิน threshold.
- **CPU Load**: ค่าเฉลี่ยต่ำกว่า 70%.
- **Event Loop Lag**: วัด latency ของ main thread.
- **Error Rate**: จำนวน exceptions ต่อนาที.
- **Response Time**: HTTP latency ของ MCP endpoints.

## Alert Thresholds
เกณฑ์แจ้งเตือนที่แนะนำ:
| Metric | Threshold | Action |
|---|---|---|
| Memory | > 80% | Warning |
| CPU | > 70% | Warning |
| Event Loop Lag | > 100 ms | Critical |
| Error Rate | > 5% | Critical |
| Uptime | < 60 s | Restart |

## health-monitor.js
Script นี้รันเป็น background worker หรือ middleware:
```javascript
// health-monitor.js
const os = require('os');
const v8 = require('v8');

module.exports = function healthMonitor(req, res) {
  const mem = process.memoryUsage();
  const cpu = os.loadavg()[0];
  const lag = measureEventLoopLag(); // custom fn
  
  const status = {
    status: lag > 100 || mem.heapUsed/mem.heapTotal > 0.8 ? 'unhealthy' : 'healthy',
    uptime: process.uptime(),
    memory: mem,
    cpu1m: cpu,
    eventLoopLag: lag
  };
  
  res.status(status.status === 'healthy' ? 200 : 503).json(status);
};
```
ตั้ง cron หรือ Docker HEALTHCHECK ให้เรียก `/health` ทุก 30 วินาที เพื่อตรวจจับปัญหาก่อนระบบล่ม.

Let's count words roughly.
"Overview" section: ~25 words.
"Metrics": ~35 words.
"Thresholds": Table words ~40.
"Script": Code block is tricky for word count. Usually code blocks count too. Let's make the code concise and the explanation around it brief.
"Conclusion": ~20 words.

Total text words maybe around 200. With code, it might look like more, but the user said "250-300 words". I should make sure the prose part is substantial enough but the total is within range. Let's expand the Thai explanation slightly to hit the count.

Revised Draft:

# MONITORING.md — innomcp-node

## 1. Health Monitoring Strategy
ใช้ `health-monitor.js` เป็น core monitoring script. It exposes a lightweight `/health` endpoint สำหรับ Docker, Kubernetes, และ load balancer health checks. ควรเรียก endpoint นี้ทุก 30 วินาที เพื่อตรวจสอบสถานะ real-time.

## 2. Key Metrics
ตัวชี้วัดหลักที่ต้อง watch ประกอบด้วย:
- **Memory (RSS/Heap)**: ตรวจจับ memory leak.
- **CPU Load Average**: ห้ามเกิน 70% ต่อ core.
- **Event Loop Lag**: วัดค��ามล่าช้าของ main thread.
- **HTTP Error Rate**: 5xx errors ต่อนาที.
- **Process Uptime**: ตรวจสอบ unexpected restarts.

## 3. Alert Thresholds
| Metric | Warning | Critical |
|---|---|---|
| Memory Usage | > 70% | > 85% |
| CPU Load | > 60% | > 80% |
| Event Loop Lag | > 50 ms | > 150 ms |
| Error Rate | > 1% | > 5% |

เมื่อถึง Critical ให้ส่ง alert ผ่าน Slack/PagerDuty และ trigger auto-restart.

## 4. health-monitor.js
```javascript
// health-monitor.js
const os = require('os');

module.exports = (req, res) => {
  const mem = process.memoryUsage();
  const heapPct = mem.heapUsed / mem.heapTotal;
  const cpu = os.loadavg()[0] / os.cpus().length;
  
  const healthy = heapPct < 0.85 && cpu < 0.8;
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    uptime: process.uptime(),
    memory: mem,
    cpuPercent: (cpu * 100).toFixed(1),
    timestamp: new Date().toISOString()
  });
};
```
Script นี้ควร mount ที่ `app.get('/health', require('./health-monitor.js'))` และบันทึก log ทุกครั้งที่ status เปลี่ยนเป็น unhealthy.

Let's count.
Section 1: ~35 words.
Section 2: ~40 words.
Section 3: Table ~30 words + intro ~10 = 40.
Section 4: Code ~40 words. Explanation ~30 words.
Total prose: ~145. Code: ~40 tokens/words. Total maybe ~185. This is a bit low. I need to expand to get closer to 250-300.

Let's add more detail.

Expanded Draft:

# MONITORING.md — innomcp-node

## 1. Health Monitoring Strategy
`innomcp-node` ใช้ `health-monitor.js` เป็น centralized health probe. The script exposes an HTTP `/health` endpoint ที่รายงานสถานะปัจจุบันของ Node.js process. แนะนำให้ตั้งค่า Docker `HEALTHCHECK` หรือ Kubernetes `livenessProbe` ให้เรียก endpoint นี้ทุก 30 วินาที เพื่อตรวจจับปัญหาก่อนระบบล่มอย่างรุนแรง.

## 2. Key Metrics to Watch
ตัวชี้วัดหลักที่ต้อง monitor อย่างต่อเนื่อง ได้แก่:
- **Memory (RSS & Heap)**: ใช้ตรวจจับ memory leak จาก MCP connections.
- **CPU Load Average**: ควรต่ำกว่า 70% ต่อ core เพื่อรักษา throughput.
- **Event Loop Lag**: วัดความล่าช้าของ main thread; ค่าสูงบ่งชี้ blocking operations.
- **HTTP Error Rate**: จำนวน 5xx responses ต่อนาที.
- **Process Uptime**: ตรวจสอบว่า service มีเสถียรภาพหรือ restart บ่อย.

## 3. Alert Thresholds
ตั้งค่าเกณฑ์แจ้งเตือนดังนี้:

| Metric | Warning | Critical | Action |
|---|---|---|---|
| Heap Memory | > 70% | > 85% | Restart / Scale |
| CPU Load | > 60% | > 80% | Alert + Investigate |
| Event Loop Lag | > 50 ms | > 150 ms | Immediate Restart |
| Error Rate | > 1% | > 5% | Page On-call |

เมื่อถึง Critical threshold ระบบควรส่ง alert ผ่าน Slack หรือ PagerDuty พร้อม trigger auto-restart ทันที.

## 4. health-monitor.js
ติดตั้ง script นี้เป็น middleware หรือ standalone route:

```javascript
// health-monitor.js
const os = require('os');

module.exports = function healthMonitor(req, res) {
  const mem = process.memoryUsage();
  const heapPct = mem.heapUsed / mem.heapTotal;
  const cpuLoad = os.loadavg()[0] / os.cpus().length;
  
  const isHealthy = heapPct < 0.85 && cpuLoad < 0.80;
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    uptime: process.uptime(),
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    cpuLoadPercent: (cpuLoad * 100).toFixed(1),
    timestamp: new Date().toISOString()
  });
};
```

Mount ด้วย `app.get('/health', require('./health-monitor.js'))` และบันทึก log ทุกครั้งที่ status เปลี่ยนเป็น unhealthy เพื่อช่วยวิเคราะห์สาเหตุภายหลัง.

Let's count again.
S1: ~45 words.
S2: ~55 words.
S3: ~50 words (table + text).
S4: Code ~45 words. Text ~35 words.
Total: ~230 words. This is close to 250. I can add a bit more to the intro or conclusion.

Let's add a small intro sentence.

Final Polish:

# MONITORING.md — innomcp-node

## 1. Health Monitoring Strategy
`innomcp-node` ใช้ `health-monitor.js` เป็น centralized health probe สำหรับตรวจสอบสถานะ Node.js process. The script exposes an HTTP `/health` endpoint ที่รายงาน metrics สำคัญแบบ real-time. แนะนำให้ตั้งค่า Docker `HEALTHCHECK` หรือ Kubernetes `livenessProbe` ให้เรียก endpoint นี้ทุก 30 วินาที เพื่อตรวจจับปัญหาก่อนระบบล่มอย่างรุนแรง.

## 2. Key Metrics to Watch
ตัวชี้วัดหลักที่ต้อง monitor อย่างต่อเนื่อง ได้แก่:
- **Memory (RSS & Heap)**: ใช้ตรวจจับ memory leak จาก MCP connections.
- **CPU Load Average**: ควรต่ำกว่า 70% ต่อ core เพื่อรักษา throughput.
- **Event Loop Lag**: วัดความล่าช้าของ main thread; ค่าสูงบ่งชี้ blocking operations.
- **HTTP Error Rate**: จำนวน 5xx responses ต่อนาที.
- **Process Uptime**: ตรวจสอบว่า service มีเสถียรภาพหรือ restart บ่อยเกินไป.

## 3. Alert Thresholds
ตั้งค่าเกณฑ์แจ้งเตือนดังนี้:

| Metric | Warning | Critical | Action |
|---|---|---|---|
| Heap Memory | > 70% | > 85% | Restart / Scale |
| CPU Load | > 60% | > 80% | Alert + Investigate |
| Event Loop Lag | > 50 ms | > 150 ms | Immediate Restart |
| Error Rate | > 1% | > 5% | Page On-call |

เมื่อถึง Critical threshold ระบบควรส่ง alert ผ่าน Slack หรือ PagerDuty พร้อม trigger auto-restart ทันที.

## 4. health-monitor.js
ติดตั้ง script นี้เป็น middleware หรือ standalone route:

```javascript
// health-monitor.js
const os = require('os');

module.exports = function
