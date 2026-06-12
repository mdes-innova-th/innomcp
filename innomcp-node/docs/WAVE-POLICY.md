
# WAVE Policy: Safe Bulk-Generation Workflow
# นโยบาย WAVE: ขั้นตอนการสร้างโค้ดจำนวนมากอย่างปลอดภัย

## 1. The MEGA-100 Incident / เหตุการณ์ MEGA-100

On 2024-03-14, a bulk LLM generation job output was committed directly to the `main` branch without passing any build gate, automated check, or human review. Unresolved fence markers (`<<<<<<< HEAD`, `=======`, `>>>>>>>`) leaked into the production bundle, corrupting 9 critical service files and causing a partial service outage. The root cause was the complete absence of a mandatory branch-and-review workflow for LLM-generated code. **(ห้าม commit output จาก LLM จำนวนมากโดยตรงสู่ main โดยเด็ดขาด; ต้องมี build gate และ human review เสมอ)**

## 2. Mandatory Safe-Bulk Workflow / ขั้นตอนบังคับ

All bulk-generation tasks MUST follow this exact sequence:
1. **Bulk Generation:** Generate code on a dedicated feature branch (`feat/bulk-<ticket>`) only. Never generate directly on `main`.
2. **Build Gate:** Run `tsc --noEmit` locally and in CI. The build must pass with zero errors before the branch is eligible for review.
3. **SA Review:** A Solution Architect performs a single batched read (1 batched read) to assess logic, architecture consistency, and side effects. This prevents fragmented review cycles and ensures holistic oversight.
4. **Merge to Main:** Integration into `main` is permitted exclusively via Pull Request after the SA approves. Direct push is prohibited.

## 3. Pre-commit Hooks / ตะขอ pre-commit

Every developer environment must install local pre-commit hooks via `node scripts/install-hooks.js`. These hooks enforce two non-negotiable automated checks before any commit is allowed:
- **Fence Detection:** สแกนหา conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) ในทุก staged file.
- **TypeScript Gate:** รัน `tsc --noEmit` ทันที.
If either check fails, the commit is blocked until resolved. The same rules are enforced in CI to ensure no machine-generated artifact bypasses quality gates.

## 4
