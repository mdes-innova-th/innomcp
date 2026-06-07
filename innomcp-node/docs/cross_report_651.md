# Cross Report: Phase 6.5.1 Regression Fixes & Optimization

**Status**: APPLIED & VERIFIED (Pending final CI run)
**Date**: 2026-02-16

## 1. Critical Bug: TypeScript Type Mismatch

- **Issue**: `nationwide` mode caused server crash due to type incompatibility in `weatherPipeline.ts`.
- **Fix**: Updated `detectMode` return signature in `src/utils/weather/weatherPipeline.ts` to explicitly include `"nationwide"`.
- **Impact**: Server stable; strict type checking satisfied.

## 2. Logic Defect: Location Resolver (Rangsit)

- **Issue**: "Rangsit" returned `PROVINCE_MISSING` because it lacks a mapping to "Pathum Thani".
- **Fix**: Added entries to `PROVINCE_MAP` in `src/utils/locationResolver.ts`:
  - "รังสิต" -> "ปทุมธานี"
  - "ลำลูกกา" -> "ปทุมธานี"
  - "คลองหลวง" -> "ปทุมธานี"
  - "ธัญบุรี" -> "ปทุมธานี"
- **Impact**: Correctly resolves distinct queries to their parent province.

## 3. Performance Warning: Local LLM Slowness

- **Issue**: Local Gemma3:4b response times > 3 minutes.
- **Fix**: Injected `num_gpu_layers: 99` (via `CONFIG.GPU_LAYERS`) into `godTierRouter.ts` for both `embeddings` and `chat` calls.
- **Impact**: Forces Ollama to offload fully to GPU (if available/supported by driver), significantly reducing latency.
- **Note**: Requires valid GPU drivers on host.

## Verification

- **Scripts**: `scripts/verify_fixes.ts` checks:
  1. `resolveProvinces("รังสิต")` includes "ปทุมธานี".
  2. `pipeline.resolveTarget("...ในไทย...")` sets mode="nationwide".
- **Regression**: `tests/weather_regression.test.ts` Case G (National Query) now passes.
