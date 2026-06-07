## Summary

<!-- 1-3 sentences. What does this PR do and why? -->

## Type of change

- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to change)
- [ ] 📚 Documentation only
- [ ] 🎨 Style / UX polish (no functional change)
- [ ] ♻️ Refactor (no functional change, no test change)
- [ ] ⚡ Performance
- [ ] ✅ Test

## How was it verified?

<!--
Check all that apply.
Tests run locally before opening the PR — see docs/MASTER_REVIEW.md.
-->

- [ ] `pnpm test` passes locally
- [ ] `pnpm run full-system` (59/59) passes locally
- [ ] `pnpm run signoff` (61/61 Playwright) passes locally
- [ ] Manual browser test on `pnpm dev`
- [ ] Manual test on Thai query (if UI/Thai-touching)
- [ ] Mobile responsive sweep (375 / 414 / 768 / 1024) — if UI

## Screenshots / recordings

<!-- Drag-drop screenshots or paste image URLs here. For UI changes, before+after. -->

## Related issues

<!-- Link issues: Fixes #123, Closes #456, Related to #789 -->

## Checklist

- [ ] My code follows the project style (`pnpm run lint` clean)
- [ ] I have added tests that prove my fix / feature works
- [ ] New and existing unit tests pass locally
- [ ] I have updated relevant documentation (README, AGENTS.md, MASTER_REVIEW.md)
- [ ] I have read [CONTRIBUTING.md](CONTRIBUTING.md)
- [ ] This PR is not a duplicate of an existing PR
- [ ] I have used **Thai-first** strings in user-facing copy (or flagged for a Thai reviewer)
