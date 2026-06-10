# INNOMCP Security Guide

## Overview

INNOMCP is Thailand’s premier government AI platform, designed and operated by the Ministry of Digital Economy and Society (MDES). It serves as the central Model Context Protocol (MCP) Hub for public-sector AI services. The platform is built with Next.js 14 App Router, TypeScript in strict mode, and a security-by-default architecture that keeps sensitive logic and keys on the server side. All components are hosted on MDES-managed infrastructure, adhering to the highest government cybersecurity standards.

The following sections detail the technical and organisational measures protecting INNOMCP, its data, and its users.

## Authentication & Authorization

- **JWT Tokens** – All API operations require a valid JSON Web Token issued by the system’s identity provider. Tokens are signed and verified server-side; they are short-lived with refresh token rotation.
- **Session Management** – Tokens are stored in `httpOnly`, `Secure`, and `SameSite=Strict` cookies to prevent XSS and CSRF attacks. Session expiration and automatic logout after inactivity are enforced.
- **Role-Based Access (Future)** – The platform is designed to support role-based access control (RBAC). Currently, a flat permission model is used, but granular roles (administrator, developer, regular user) will be implemented in upcoming releases to restrict access to sensitive MCP tools and workspaces.

## API Security

- **Rate Limiting** – A Next.js middleware (`middleware.ts`) implements token-bucket rate limiting on all API routes. Limits are configurable per endpoint and are monitored to prevent abuse.
- **Input Validation** – Every API route uses Zod schemas to validate request bodies, query parameters, and headers. Invalid input is rejected with a 400 response before any business logic executes.
- **Path Traversal Prevention** – Workspace file operations (upload, download, listing) strictly validate and sanitise user-supplied paths. All file access is confined to a dedicated, sandboxed directory with alias resolution and canonicalisation.
- **API Key Management** – External service credentials (e.g., MDES Ollama) are stored exclusively in environment variables on the server. They are never exposed to the browser; all third‑party calls are proxied through secure Next.js API routes.

## Data Privacy

- **No PII in Logs** – Logging libraries are configured to redact and exclude any personally identifiable information. Structured logs contain only request metadata (timestamp, route, status code) and error IDs without user context.
- **Telemetry Opt-Out** – Usage and performance telemetry is disabled by default. Individual users can opt out via organisational settings; no personal data is ever sent.
- **Message Encryption (Future)** – End-to-end encryption of user prompts and model responses is on the roadmap, using modern cryptographic standards.
- **Feedback Data** – Submitted feedback is encrypted at rest using AES‑256. Access is limited to authorised personnel through audit‑logged interfaces, and retention periods align with PDPA requirements.

## Network Security

- **HTTPS Only** – All traffic is served over TLS 1.3 with HSTS preload enabled. Plain HTTP requests are automatically upgraded.
- **Content Security Policy (CSP)** – A strict CSP header is applied: scripts and styles are limited to self and approved CDNs; connections are restricted to the platform’s own domain and the MDES Ollama endpoint; inline scripts are forbidden.
- **CORS Configuration** – The server responds only to requests originating from the INNOMCP frontend and a whitelist of government subdomains (`*.go.th`). Cross-origin requests from unexpected origins are blocked.
- **Allowed Origins** – The origin allowlist is maintained as a configuration array and reviewed during each release.

## MDES Ollama Security

- **API Key Protection** – MDES Ollama API keys are stored server-side. Every AI inference request is proxied through a dedicated Next.js API route, so keys never leave the server environment.
- **Request Proxying** – The proxy performs additional validation and sanitisation of prompts before forwarding them. Response streaming is handled server-side, further insulating the client from direct model access.
- **Model Access Control** – As the platform evolves, access to individual Ollama models will be restricted based on user roles and department policies, preventing unauthorised use of restricted models.

## Incident Response

- **Error Logging** – Centralised structured logs capture all exceptions with unique correlation IDs. In production, stack traces are omitted to avoid information leakage; detailed stacks are available only in development.
- **Alert Procedures** – Monitoring tools watch for patterns like repeated authentication failures, sudden traffic spikes, and elevated error rates. Alerts are dispatched to the engineering team via government-approved channels (email, LINE Notify) for immediate triage.
- **Data Breach Protocol** – In the event of a breach, the MDES incident response plan is activated: containment, forensic preservation, impact assessment. Affected individuals are notified within 72 hours in compliance with PDPA; CERT Thailand (ThaiCERT) is engaged as appropriate.

## Thai Government Compliance

- **พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)** – INNOMCP implements data subject rights, lawful bases for processing, data protection officer oversight, and data processing agreements where required. Personal data is collected minimally and deleted according to retention schedules.
- **ระเบียบสำนักนายกรัฐมนตรี ว่าด้วยการรักษาความปลอดภัยแห่งชาติ** – The platform’s security controls align with the Prime Minister’s Office Regulation on National Security Preservation, including data classification, physical security of infrastructure, and access vetting for government personnel.
- **NIST Guidelines** – The cybersecurity framework from the National Institute of Standards and Technology (NIST) is used as a baseline: Identify, Protect, Detect, Respond, and Recover functions are mapped to internal procedures, ensuring continuous improvement and resilience.

---

*This guide is reviewed quarterly and updated as new threats, regulations, or platform features emerge. All INNOMCP operators and developers are required to read and acknowledge this document.*