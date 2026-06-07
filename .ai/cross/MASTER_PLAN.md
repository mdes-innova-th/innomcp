# CROSS (AI-4) — Master Plan Board

## Rules

- ใช้เป็นบอร์ดวางแผน/ไล่สถานะเท่านั้น (ไม่ใช่ spec)
- ทุกงานต้องผูกกับ: Phase / Tests / Changelog entry
- งานที่ยังไม่ผ่าน Phase ห้ามข้ามไป Phase ต่อไป

## Current Phase

- Phase 1: GEO (Weather tool selection & resilience)

## Pipeline

1. Spec locked (docs/architecture/GEO_CORE_SPEC.md)
2. Implement (innomcp-node/src/geo)
3. Unit tests (Vitest)
4. E2E tests (Playwright)
5. Perf checks (latency, timeout fallback)
6. Release notes (CHANGELOG)
7. Docs update (docs/phases)

## Phase 1 GEO — Checklist

- [ ] Files in correct place (innomcp-node/src/geo)
- [ ] Router tool names match registry
- [ ] Guard: 10s timeout + retry + fallback packet
- [ ] Aggregator: stable WeatherPacket
- [ ] Unit tests: 8 scenarios PASS
- [ ] E2E: nwp-tools-quick-test PASS
- [ ] Log: dev-log shows no fatal errors
- [ ] CHANGELOG entry created
- [ ] docs/phases/phase1-geo updated

## Next Phases (locked)

- Phase 2: Evidence/DB query tuning + tests
- Phase 3: UI/UX + RBAC
- Phase 4: Refactor mcpClient
- Phase 5: Training/keyword/LLMOps
