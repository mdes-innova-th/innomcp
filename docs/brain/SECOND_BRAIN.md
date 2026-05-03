# Second Brain — Runtime Knowledge for Phase C

> What the system knows about itself when running. Sub-agents read this to pick the right model and tool for each role.

---

## Local Ollama models (port 11434)

Verified live on 2026-05-03 via `curl http://localhost:11434/api/tags`:

| Model | Family | Size | Role priority |
|---|---|---|---|
| `minimax-m2.5:cloud` | minimax | cloud-relay | **Primary Thai composer / Frontstage Concierge** |
| `gpt-oss:120b-cloud` | gptoss | 116.8 B (MXFP4 cloud) | Hard reasoning, synthesis, Grounding Critic |
| `kimi-k2.5:cloud` | kimi | cloud-relay | Alternative reasoning / long context |
| `qwen2.5-coder:7b` | qwen2 | 7.6 B Q4_K_M | Code/dev/test helper |
| `deepseek-r1:8b` | qwen3 | 8.2 B Q4_K_M | Local reasoning fallback when cloud unreachable |
| `qwen3-vl:4b` | qwen3vl | 4.4 B Q4_K_M | Vision/image |

Selection rules:
- Default Thai composer: `minimax-m2.5:cloud` → fallback `kimi-k2.5:cloud` → fallback `deepseek-r1:8b`
- Hard reasoning step: `gpt-oss:120b-cloud` → fallback `kimi-k2.5:cloud` → fallback `deepseek-r1:8b`
- Code work: `qwen2.5-coder:7b` (always local for code privacy)
- Vision: `qwen3-vl:4b`
- Critic: `gpt-oss:120b-cloud` (the model not used for the draft, to avoid self-bias)

## Remote provider

- **MDES Ollama:** `https://ollama.mdes-innova.online/`
  - Authoritative remote endpoint for Phase C
  - Probed via Provider Broker health check; route by latency, privacy, capability
  - Falls back to local on 5xx / timeout / cert error

## Provider registry shape (Phase C)

Each provider record:

```ts
type ProviderType =
  | "ollama-local"
  | "ollama-remote"
  | "openai-compatible"
  | "anthropic-compatible"
  | "custom";

interface ProviderRecord {
  id: string;                    // ULID
  displayName: string;
  type: ProviderType;
  baseUrl: string;               // never empty
  apiKeyRef?: string;            // env-var name (preferred)
  apiKeyEncrypted?: string;      // fallback if apiKeyRef not set
  model: string;                 // default model id used by this provider
  capabilities: Capability[];    // see below
  priority: number;              // higher = preferred when capability matches
  enabled: boolean;
  privacyLevel: "public" | "internal" | "confidential";
  timeoutMs: number;
  maxTokens?: number;
  temperature?: number;
  healthStatus: "unknown" | "healthy" | "degraded" | "down";
  lastHealthCheckAt?: string;    // ISO-8601
}

type Capability =
  | "thai-naturalness"
  | "code"
  | "vision"
  | "long-context"
  | "tool-use"
  | "fast-cheap"
  | "hard-reasoning"
  | "grounding-critic";
```

Secrets handling:
- API keys MUST come from env vars referenced by `apiKeyRef`, OR encrypted via project KMS.
- The `/api/ai/providers/*` endpoints NEVER return raw `apiKey` — only `hasApiKey: boolean`.
- Logs redact `apiKeyEncrypted`, `apiKeyRef` is allowed (it's a name, not the secret).

## Agent role catalog (10 runtime roles)

The roles below are services/functions, not autonomous loops. The Conductor calls them in a deterministic graph. Each emits public `AgentEvent`s; private reasoning stays in the function call only.

| Role | Internal id | Default model | Provider preference |
|---|---|---|---|
| InnoConductor / Orachage (orchestrator) | `conductor` | gpt-oss:120b-cloud | local first |
| Frontstage Concierge (composer) | `concierge` | minimax-m2.5:cloud | local first |
| Tool Scout (tool selector + executor) | `tool-scout` | gpt-oss:120b-cloud | local first |
| Weather Analyst | `weather-analyst` | minimax-m2.5:cloud | local |
| Geo / Travel Planner | `geo-planner` | minimax-m2.5:cloud | local |
| Knowledge / RAG Agent | `rag-agent` | (no LLM, retrieval only) | — |
| Grounding Critic | `critic` | gpt-oss:120b-cloud | local |
| Thai Naturalness Stylist | `stylist` | minimax-m2.5:cloud | local |
| Provider Broker | `broker` | (no LLM, registry logic) | — |
| Memory Scribe | `scribe` | (no LLM, db writes) | — |

## Event flow for the seminar-planning vertical slice

```
1. agent_run_started     {runId, messageId, route: "planning-broad"}
2. route_selected        {publicSummary: "วางแผนแบบหลายปัจจัย: อากาศ + การเดินทาง"}
3. agent_started         {agentId: "weather-analyst", publicSummary: "วิเคราะห์ความเสี่ยงฝน"}
4. tool_call_started     {toolName: "weather_region_summary", publicSummary: "ดึงสรุปภาคตามฤดู"}
5. tool_call_finished    {toolName: "weather_region_summary", publicSummary: "ได้ค่าความเสี่ยงรายภาค", confidence: 0.7}
6. agent_started         {agentId: "geo-planner", publicSummary: "ประเมินการเดินทาง"}
7. fact_found            {publicSummary: "ภาคกลางและภาคใต้ตอนล่างมีฝนน้อยกว่าในฤดูฝน", confidence: 0.6}
8. agent_started         {agentId: "concierge", publicSummary: "เริ่มเรียบเรียงคำตอบ"}
9. draft_delta × N       {deltaText: "ขออนุญาตเสนอแนวทางก่อนครับ ..."}
10. critique             {publicSummary: "ตรวจว่าตอบครอบคลุมและมี follow-up หรือไม่", confidence: 0.85}
11. final_answer         {publicSummary: "พร้อมส่งคำตอบ", confidence: 0.78}
```

No event includes `privateThought` / `hiddenReasoning` / `chainOfThought` etc.

## Naturalness guard

A pure-function service that gets the candidate answer + the user query and returns either `pass` or `revise(reason)`.

Block patterns (pseudo-rules):
- Whole-answer equals (or near-matches) `กรุณาระบุจังหวัด...` and the user query was a broad planning question (intent classifier flags `planning-broad`)
- Contains `Weather Map Placeholder` / `Deterministic Local Static Tile` / `placeholder` / `ข้อมูลไม่ครบสำหรับการแสดงแผนที่` and intent ≠ `map`
- Starts with English regex `^[A-Za-z]` and contains zero Thai chars `[฀-๿]`
- Contains a top-level `{` or `[` followed by `"` (likely raw JSON leak)
- Equals `Used tools: none` and `expectedToolUsage = true`

On `revise`, the Conductor calls the Stylist with the original draft + the reason, and re-emits.

## Feedback store schema

```sql
CREATE TABLE response_feedback (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  message_id  CHAR(36) NOT NULL,
  user_id     CHAR(36) NULL,
  signal      ENUM('up','down','regenerate','more_natural','remember_style') NOT NULL,
  reason_tag  ENUM('robotic','wrong_route','too_short','too_long','missing_tools','not_grounded','confusing_language','other') NULL,
  reason_text TEXT NULL,
  route       VARCHAR(64) NULL,
  provider_id VARCHAR(40) NULL,
  model       VARCHAR(80) NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (message_id),
  INDEX (user_id),
  INDEX (signal, reason_tag)
);

CREATE TABLE preference_memory (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id     CHAR(36) NULL,
  key_name    VARCHAR(80) NOT NULL,
  key_value   VARCHAR(255) NOT NULL,
  weight      DECIMAL(4,2) DEFAULT 1.00,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY (user_id, key_name)
);

CREATE TABLE route_quality_signal (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  route       VARCHAR(64) NOT NULL,
  provider_id VARCHAR(40) NULL,
  model       VARCHAR(80) NULL,
  positive    INT DEFAULT 0,
  negative    INT DEFAULT 0,
  last_signal_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY (route, provider_id, model)
);
```

Migration not applied yet; lives in `mariadb/database_schema.sql` after Phase C lands.
