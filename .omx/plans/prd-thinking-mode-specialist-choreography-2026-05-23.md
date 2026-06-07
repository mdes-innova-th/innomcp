# Plan - Thinking Mode Specialist Choreography and Safe Artifact Previews

Created: 2026-05-23T00:40:00+07:00
Mode: $plan direct
Suggested follow-up roles: $architect, $executor, $verifier

## Requirements Summary

- The right-side workbench already exposes a run brief, phase rail, public-safe activity, and artifact cards in [innomcp-next/src/app/components/chat/AgentWorkspacePanel.tsx:216](C:/Users/USER-NT/DEV/innomcp/innomcp-next/src/app/components/chat/AgentWorkspacePanel.tsx:216) and [innomcp-next/src/app/components/chat/AgentWorkspacePanel.tsx:420](C:/Users/USER-NT/DEV/innomcp/innomcp-next/src/app/components/chat/AgentWorkspacePanel.tsx:420).
- The workbench snapshot already derives a public-safe brief, recent activity, and artifacts from SSE events in [innomcp-next/src/app/components/chat/agentWorkspaceModel.ts:387](C:/Users/USER-NT/DEV/innomcp/innomcp-next/src/app/components/chat/agentWorkspaceModel.ts:387), [innomcp-next/src/app/components/chat/agentWorkspaceModel.ts:313](C:/Users/USER-NT/DEV/innomcp/innomcp-next/src/app/components/chat/agentWorkspaceModel.ts:313), and [innomcp-next/src/app/components/chat/agentWorkspaceModel.ts:219](C:/Users/USER-NT/DEV/innomcp/innomcp-next/src/app/components/chat/agentWorkspaceModel.ts:219).
- The mother loop now writes an active plan and per-run focus before dispatching children in [../innova-bot-template/scripts/innomcp-mdes-loop.ps1:92](C:/Users/USER-NT/DEV/innova-bot-template/scripts/innomcp-mdes-loop.ps1:92) and [../innova-bot-template/scripts/innomcp-mdes-loop.ps1:433](C:/Users/USER-NT/DEV/innova-bot-template/scripts/innomcp-mdes-loop.ps1:433).
- The next gap is not generic layout polish. It is the feeling that Thinking Mode specialists are coordinating distinct responsibilities with visible cadence, while the main answer remains one stream. Current specialist visibility is still mostly inferred from flat activity rows in [innomcp-next/src/app/components/chat/AgentWorkspacePanel.tsx:255](C:/Users/USER-NT/DEV/innomcp/innomcp-next/src/app/components/chat/AgentWorkspacePanel.tsx:255) and agent logs in [innomcp-next/src/app/components/chat/AgentWorkspacePanel.tsx:90](C:/Users/USER-NT/DEV/innomcp/innomcp-next/src/app/components/chat/AgentWorkspacePanel.tsx:90).
- Artifact previews are present, but they do not yet distinguish specialist output types strongly enough for a Manus-like “team did real work” feeling; they currently normalize event metadata into a shared card model in [innomcp-next/src/app/components/chat/agentWorkspaceModel.ts:219](C:/Users/USER-NT/DEV/innomcp/innomcp-next/src/app/components/chat/agentWorkspaceModel.ts:219).

## Acceptance Criteria

1. In Thinking Mode, the workbench shows at least one specialist-focused coordination surface beyond the flat activity list, and that surface is absent or simplified in Normal Mode.
2. The user can tell which specialist is gathering facts, which one is checking quality, and which one is shaping the final answer, without exposing raw reasoning or hidden fields.
3. Artifact previews clearly distinguish at least three categories of output in Thinking Mode, such as source evidence, tool result, and draft/final deliverable, using only public-safe event data.
4. Mobile and desktop both preserve one unified answer stream while the workbench and mobile sheet surface specialist coordination.
5. Existing privacy guardrails remain intact: no `privateThought`, `chainOfThought`, `hiddenReasoning`, `rawThought`, or `innerMonologue` content is rendered into the workbench or artifacts.
6. The mother loop continues to run at 300 seconds, writes `active-plan.md` and `focus.md`, and records the current/next slice in per-loop summaries.

## Implementation Steps

1. Extend the snapshot model for specialist coordination.
   - Add a derived “specialist lanes” structure in [innomcp-next/src/app/components/chat/agentWorkspaceModel.ts](C:/Users/USER-NT/DEV/innomcp/innomcp-next/src/app/components/chat/agentWorkspaceModel.ts) near the existing `buildRecentActivity` and `buildRunBrief` logic.
   - Group public-safe events by responsibility: concierge synthesis, retrieval/tools, specialist review, and final answer assembly.
   - Keep the grouping driven only by existing safe event fields (`type`, `agentId`, `toolName`, `publicSummary`, `provider`, `model`) as defined in [innomcp-next/src/app/components/chat/useAgentEventStream.ts:20](C:/Users/USER-NT/DEV/innomcp/innomcp-next/src/app/components/chat/useAgentEventStream.ts:20).

2. Add a specialist coordination section to the workbench.
   - In [innomcp-next/src/app/components/chat/AgentWorkspacePanel.tsx](C:/Users/USER-NT/DEV/innomcp/innomcp-next/src/app/components/chat/AgentWorkspacePanel.tsx), insert a section between the run brief and activity digest or between activity and agents, depending on density.
   - Represent each lane with a compact label, status, latest safe note, and small counts for tools, sources, and artifacts.
   - In Normal Mode, render a reduced two-lane version only for concierge and retriever so the surface does not feel overbuilt.

3. Improve artifact semantics without changing the one-stream chat contract.
   - Expand artifact classification in [innomcp-next/src/app/components/chat/agentWorkspaceModel.ts:219](C:/Users/USER-NT/DEV/innomcp/innomcp-next/src/app/components/chat/agentWorkspaceModel.ts:219) so Thinking Mode cards can identify evidence, analysis output, and final deliverables more clearly.
   - Update [innomcp-next/src/app/components/chat/AgentWorkspacePanel.tsx:312](C:/Users/USER-NT/DEV/innomcp/innomcp-next/src/app/components/chat/AgentWorkspacePanel.tsx:312) to visually separate those categories while preserving the current card density.

4. Align the mobile sheet with the richer Thinking Mode surfaces.
   - Verify the mobile workbench flow in [innomcp-next/src/app/components/chat/ChatPage.tsx](C:/Users/USER-NT/DEV/innomcp/innomcp-next/src/app/components/chat/ChatPage.tsx) still opens quickly and keeps the answer area primary.
   - Do not introduce multi-panel answer fragmentation; only enrich the workbench sheet.

5. Refresh the mother loop’s steering text for this slice.
   - Update [../innova-bot-template/scripts/innomcp-mdes-loop.ps1:92](C:/Users/USER-NT/DEV/innova-bot-template/scripts/innomcp-mdes-loop.ps1:92) so `Get-LoopPlan` points the current slice at specialist choreography once the run-brief slice is shipped.
   - Keep [../innova-bot-template/docs/innomcp-mdes-loop/README.md](C:/Users/USER-NT/DEV/innova-bot-template/docs/innomcp-mdes-loop/README.md) in sync if the loop contract wording changes.

6. Lock behavior with tests before claiming completion.
   - Extend [innomcp-node/tests/unit/agentWorkspaceModel.test.ts](C:/Users/USER-NT/DEV/innomcp/innomcp-node/tests/unit/agentWorkspaceModel.test.ts) to prove specialist lanes and artifact categories are derived from public-safe fields only.
   - Extend [innomcp-next/e2e/multiagent-panel.spec.ts](C:/Users/USER-NT/DEV/innomcp/innomcp-next/e2e/multiagent-panel.spec.ts) for desktop and mobile visibility of the new coordination surface.
   - Keep the existing no-reasoning-leak smoke path in the broader Playwright suite green.

## Risks and Mitigations

- Risk: We overfit the UI to a Manus-like appearance instead of preserving InnoMCP’s own chat-first flow.
  - Mitigation: Keep the answer stream centered and unchanged; only enrich workbench semantics and plan surfaces.

- Risk: Specialist coordination becomes performative rather than grounded in real events.
  - Mitigation: Derive every lane, count, and card from the SSE event stream and existing loop artifacts, not hardcoded UI copy.

- Risk: Richer artifact taxonomy leaks internal reasoning through event summaries.
  - Mitigation: Reuse the existing text scrubbing and forbidden-key discipline in [innomcp-next/src/app/components/chat/agentWorkspaceModel.ts:124](C:/Users/USER-NT/DEV/innomcp/innomcp-next/src/app/components/chat/agentWorkspaceModel.ts:124) and [innomcp-next/src/app/components/chat/useAgentEventStream.ts:13](C:/Users/USER-NT/DEV/innomcp/innomcp-next/src/app/components/chat/useAgentEventStream.ts:13).

- Risk: The loop plan drifts from the actual implementation slice.
  - Mitigation: Update `Get-LoopPlan` in the same commit as the UI slice and prove the new wording through a one-shot `/loop` run.

## Verification Steps

1. `npx.cmd jest tests/unit/agentWorkspaceModel.test.ts --runInBand`
2. `npx.cmd tsc --noEmit --pretty false` in `innomcp-next`
3. `npx.cmd playwright test e2e/multiagent-panel.spec.ts --reporter=line`
4. `npx.cmd playwright test e2e/living-agent-chat.spec.ts --project=chromium --reporter=line`
5. `powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\USER-NT\DEV\innova-bot-template\scripts\innomcp-mdes-loop.ps1 -Mode thinking -Query "<current slice text>"`
6. Inspect [../innova-bot-template/docs/innomcp-mdes-loop/active-plan.md](C:/Users/USER-NT/DEV/innova-bot-template/docs/innomcp-mdes-loop/active-plan.md) and the newest `loop-*/summary.md` to confirm the steering text matches the shipped slice.

## Recommended Execution Handoff

- $architect
  - Guard the boundary between “helpful visible coordination” and “fake second answer panel”.
  - Review whether specialist lanes should be derived purely from `agentId` categories or partially from `event.type` and `toolName`.

- $executor
  - Implement the snapshot and workbench UI changes in `agentWorkspaceModel.ts` and `AgentWorkspacePanel.tsx`.
  - Keep changes scoped; do not reshape the main chat stream.

- $verifier
  - Run the focused unit/e2e/loop checks and confirm no raw reasoning fields surface.

## Stop Condition

Stop this slice when specialist choreography is legible in Thinking Mode, subdued in Normal Mode, privacy checks stay intact, and the 5-minute mother loop steers toward the new slice with fresh evidence.
