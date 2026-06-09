---
name: git-add-hygiene-check-ignore-first
description: Before any `git add -A` on a foreign working tree, run `git check-ignore -v` on secret-shaped filenames (.env, .env.local, *.pem, id_rsa*, credentials*). The gitignore rule being IN the file does not guarantee git will honor it for files with wrong case on Windows or files force-added in the past.
date: 2026-06-07
source: rrr: innomcp
concepts: [git, hygiene, secrets, gitignore, windows, case-sensitivity, force-add]
---

# Always `git check-ignore -v` Before `git add -A` on a Foreign Tree

The rule `.env` in `.gitignore` does not prove that the `.env` file in the working tree is actually being ignored. The rule *should* apply, but on Windows, case-sensitivity differences, prior `git add -f` invocations, or path-traversal edge cases can break the assumption.

**Rule**: Before any `git add -A` / `git add .` / `git add --all` on a working tree that was not built by you in this session, run:

```bash
git check-ignore -v .env .env.local credentials.json id_rsa 2>&1
```

If any file comes back as "NOT ignored" (empty output for that filename, or rule shows it being whitelisted via `!`), stop and decide what to do before `add`.

**Evidence from this session**: `innomcp` had `.env` and `.env.local` both containing real `OLLAMA_API_KEY` values (`9e34679b9d60d8b984005ec46508579c` and `b98bfe701d264a1ca9f9a44b17db69ee.zanQnQi2QlHqFlJhJHgkm5gC`). They were untracked (`??` in `git status`). The `.gitignore` had rules `.env` and `.env.*` — those rules *were* in effect (confirmed via `git check-ignore -v`), so `git add -A` would not have staged them. But I only knew that because I checked. A user directive of "commit ทั้งหมด" (commit everything) could have been read as "ignore gitignore," and that would have been a credential leak.

**Also relevant**: After `git check-ignore -v` confirms safety, run a deeper secret scan on the actual text content (regex for `api_key=`, `AKIA[0-9A-Z]{16}`, `sk-[A-Za-z0-9_-]{20,}`, `ghp_[A-Za-z0-9]{30,}`, `password =`, `-----BEGIN.*PRIVATE KEY-----`, `mysql://user:pass@`, etc.). The `CREDENTIALS_GUIDE.md` in this session was a false-positive on filename, but the scan forced me to read the file and confirm it was placeholder-only.

**Generalizes to**: any agent inheriting a working tree, any agent asked to "commit all," any agent working on Windows where case differences are silently tolerated.

See [[ollama-model-must-match-local-inventory]] for the related lesson on detecting upstream-model mismatch before "the system is broken" claims.
