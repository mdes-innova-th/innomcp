# Security Policy

## Supported versions

| Version | Supported          |
|---------|--------------------|
| latest  | ✅ Active          |
| < 0.40  | ❌ End of life     |

## Reporting a vulnerability

**Please do NOT open a public GitHub issue for security bugs.**

Send a private report to **mdes.innovation@gmail.com** with:

1. Subject: `[INNOMCP-SEC] <short-title>`
2. Description: attack vector + impact
3. Reproduction: minimal steps + payload
4. Affected version(s): commit hash or release tag

We acknowledge within **48 hours** and aim to ship a fix within **14 days**
for critical issues, **30 days** for high, **90 days** for medium.

## Scope

In-scope:

- Authentication / authorization bypass
- SQL / NoSQL / prompt injection
- SSRF, RCE, file traversal
- Secrets leakage in code, logs, or `.env.example`
- Provider API key abuse
- MCP tool sandbox escape

Out-of-scope (use a normal issue):

- Performance / scalability complaints
- UI / UX bugs without security impact
- Typos, missing translations

## Hall of fame

We credit reporters in the next release notes (unless anonymous requested).
