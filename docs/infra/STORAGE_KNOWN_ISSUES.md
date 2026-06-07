# Workspace Storage – Known Issues

- Container: workspace-storage
- Container ID: cd3e8fceb7fdd8235e550a68e059f6f37c67c7b03c942a733b2a221cfea019e4
- Status: Fails to start

Observed error:

- Mount error (file vs directory mismatch)
- nginx.conf bind mount issue

Decision:

- Skipped for Phase 5
- Will be addressed in Infra Phase (Phase 5.5 / 6)

Impact:

- No blocking for MCP tools, Law, Religion
