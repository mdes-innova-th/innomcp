# MONITORING.md — innomcp

## สิ่งที่ต้องเฝ้าระวัง

| รายการ | คำอธิบาย |
|--------|----------|
| **Health Endpoint** | สถานะ `degraded` หรือ `unhealthy` จาก `/health` |
| **Database Connection** | จำนวน connection pool พร้อมใช้งาน, query latency |
| **Redis** | Connection status, memory usage, hit rate |
| **WebSocket Connections** | จำนวน connection ที่ active, disconnect rate |
| **Provider Availability** | Provider endpoint จากการเรียก API หรือ WebSocket |
| **Error Rate** | 5xx, 4xx, exception count ต่อนาที |
| **Latency** | P95/P99 response time ของ API และ provider calls |

## วิธีการตรวจสอบ

### Health Endpoint Polling
- เรียก `/health` ทุก 30 วินาที
- สถานะ `healthy` = OK, `degraded` = warnings, `unhealthy` = critical

### Log Patterns
- ใช้ structured logging (JSON) + grep patterns:
  - `"level":"error"` หรือ `"level":"warn"`
  - คำว่า `timeout`, `connection refused`, `no healthy upstream`
  - `panic` หรือ `fatal`

### Metrics
- Prometheus metrics endpoints (ถ้ามี): `request_duration_seconds`, `db_connections_used`, `redis_up`

## Alert Thresholds

| Metric | Threshold | Severity |
|--------|-----------|----------|
| Health endpoint `unhealthy` | 2 consecutive polls | Critical |
| DB connection pool exhausted | < 5% available | Critical |
| Redis down | 1 failure | Critical |
| WS disconnect rate | > 10% of connections per minute | Warning |
| Provider unreachable | 3 retries failed within 5 min | Critical |
| Error rate (5xx) | > 1% of requests over 5 min | Warning |
| Latency P99 | > 500ms for API, > 2s for provider | Warning |

## Dashboard ที่ควรสร้าง

1. **Service Health Overview**
   - Cards for health status, DB, Redis, WS
   - Timeline of degraded/unhealthy events

2. **Provider Performance**
   - Latency heatmap per provider
   - Error rate per provider
   - Availability % (uptime over 1h/24h)

3. **Request & Error Rate**
   - Total requests, error rate (4xx vs 5xx)
   - Top failing endpoints

4. **WebSocket Monitoring**
   - Active connections, connect/disconnect rate, message throughput

## ที่อยู่ของ Logs

| Environment | Location |
|-------------|----------|
| Local dev | `./logs/` หรือ `stdout` |
| Staging | CloudWatch Log Group: `/innomcp/staging` |
| Production | CloudWatch Log Group: `/innomcp/production` |
| Container (K8s) | `kubectl logs -n innomcp <pod>` หรือ Fluentd → S3/Elasticsearch |

---

**หมายเหตุ:** อัปเดตไฟล์นี้ทุกครั้งที่มีการเปลี่ยนแปลง service หรือ provider ใหม่
