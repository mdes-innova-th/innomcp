# API Contract (innomcp-node)
**Version:** 2.2.2
**Status:** VERIFIED (Logical Design)
**Last Verified:** 2026-06-13
**Compliance:** REST / JSON-API / SSE

## Global Specifications
- **Base URL:** `/api`
- **Content-Type:** `application/json`
- **Auth Scheme:** Bearer Token (`Authorization: Bearer <accessToken>`)
- **Standard Error Response:**
  ```json
  {
    "error": {
      "code": "string (e.g., 'UNAUTHENTICATED', 'VALIDATION_FAILED', 'NOT_FOUND')",
      "message": "Human-readable error message",
      "details": { "field": "reason" },
      "traceId": "uuid (for server-side log correlation)"
    }
  }
  ```
- **Standard Pagination Wrapper:**
  ```json
  {
    "data": [ ... ],
    "meta": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
  ```

## 1. Authentication & Health

### GET /health
- **Auth required:** No
- **Response:** `200 OK`
  ```json
  { "status": "ok", "timestamp": "ISO-string", "version": "2.2.2", "uptime": 3600 }
  ```

### POST /auth/login
- **Auth required:** No
- **Request Body:** `{ "email": "string", "password": "string" }`
- **Response:** `200 OK`
  ```json
  {
    "accessToken": "jwt",
    "refreshToken": "string",
    "user": {
      "id": "uuid",
      "email": "string",
      "name": "string",
      "role": "admin|user",
      "avatarUrl": "url"
    }
  }
  ```
- **Status Codes:** `200`, `401 (INVALID_CREDENTIALS)`, `422 (VALIDATION_ERROR)`, `500`

### GET /auth/me
- **Auth required:** Yes
- **Response:** `200 OK`
  ```json
  { "user": { "id": "uuid", "email": "string", "name": "string", "role": "admin|user", "avatarUrl": "url" } }
  ```
- **Status Codes:** `200`, `401 (UNAUTHENTICATED)`, `500`

### POST /auth/refresh
- **Auth required:** No
- **Request Body:** `{ "refreshToken": "string" }`
- **Response:** `200 OK`
  ```json
  { "accessToken": "new-jwt", "refreshToken": "new-token" }
  ```
- **Status Codes:** `200`, `401 (INVALID_TOKEN)`, `422`, `500`

## 2. Projects Management

### GET /projects
- **Auth required:** Yes
- **Query Params:** `page=1`, `limit=20`, `search=string`, `sort=createdAt:desc`
- **Response:** `200 OK` (Standard Pagination Wrapper)
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "name": "string",
        "description": "string",
        "createdAt": "ISO-string",
        "updatedAt": "ISO-string",
        "memberCount": 5
      }
    ]
  }
  ```

### POST /projects
- **Auth required:** Yes
- **Request Body:** `{ "name": "string", "description": "string" }`
- **Response:** `201 Created`
  ```json
  { "project": { "id": "uuid", "name": "string", "description": "string", "createdAt": "ISO-string", "updatedAt": "ISO-string" } }
  ```

### GET /projects/{id}
- **Auth required:** Yes
- **Response:** `200 OK`
  ```json
  { "id": "uuid", "name": "string", "description": "string", "createdAt": "ISO-string", "updatedAt": "ISO-string", "status": "active|archived" }
  ```
- **Status Codes:** `200`, `401`, `404 (NOT_FOUND)`, `500`

### PATCH /projects/{id}
- **Auth required:** Yes
- **Request Body:** `{ "name?": "string", "description?": "string", "status?": "active|archived" }`
- **Response:** `200 OK`
  ```json
  { "project": { "id": "uuid", "updatedAt": "ISO-string", ... } }
  ```
- **Status Codes:** `200`, `400`, `401`, `403 (FORBIDDEN)`, `404`, `422`, `500`

### DELETE /projects/{id}
- **Auth required:** Yes
- **Response:** `204 No Content`
- **Status Codes:** `204`, `401`, `403`, `404`, `500`

## 3. Tasks Management

### GET /tasks
- **Auth required:** Yes
- **Query Params:** `projectId=uuid` (Required), `status=todo|in-progress|done`, `search=string`, `page=1`, `limit=20`
- **Response:** `200 OK` (Standard Pagination Wrapper)
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "title": "string",
        "description": "string",
        "status": "string",
        "projectId": "uuid",
        "priority": "low|medium|high",
        "createdAt": "ISO-string",
        "updatedAt": "ISO-string"
      }
    ]
  }
  ```

### POST /tasks
- **Auth required:** Yes
- **Request Body:** `{ "projectId": "uuid", "title": "string", "description?": "string", "priority?": "low|medium|high" }`
- **Response:** `201 Created`
  ```json
  { "task": { "id": "uuid", "title": "string", "projectId": "uuid", "createdAt": "ISO-string", "updatedAt": "ISO-string" } }
  ```

### PATCH /tasks/{id}
- **Auth required:** Yes
- **Request Body:** `{ "title?": "string", "description?": "string", "status?": "string", "priority?": "string" }`
- **Response:** `200 OK`
  ```json
  { "task": { "id": "uuid", "updatedAt": "ISO-string", ... } }
  ```

### DELETE /tasks/{id}
- **Auth required:** Yes
- **Response:** `204 No Content`

## 4. Intelligence & Orchestration

### GET /mdes/models
- **Auth required:** Yes
- **Response:** `200 OK` (Standard Pagination Wrapper)
  ```json
  {
    "data": [
      {
        "id": "gemma4:31b-cloud",
        "name": "Gemma 4 31B",
        "provider": "mdes-ollama",
        "contextWindow": 131072,
        "isActive": true,
        "supportsVision": false,
        "supportsStreaming": true
      }
    ]
  }
  ```

### POST /chat/stream
- **Auth required:** Yes
- **Request Body:**
  ```json
  {
    "messages": [
      { "role": "system|user|assistant", "content": "string" }
    ],
    "model": "string",
    "stream": true,
    "temperature?": 0.7,
    "maxTokens?": 4096
  }
  ```
- **Response:** `200 OK` (`text/event-stream`)
  - Event: `message` $\to$ `data: { "chunk": "...", "index": 0, "done": false }`
  - Event: `error` $\to$ `data: { "code": "...", "message": "..." }`
  - Event: `done` $\to$ `data: { "finishReason": "stop|length|content_filter", "totalTokens": 123 }`

### GET /memories
- **Auth required:** Yes
- **Query Params:** `q=keyword`, `startDate=ISO-string`, `endDate=ISO-string`, `page=1`, `limit=20`
- **Response:** `200 OK` (Standard Pagination Wrapper)
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "content": "string",
        "timestamp": "ISO-string",
        "tags": ["string"],
        "source": "system|user|automated"
      }
    ]
  }
  ```

## 5. Analytics

### GET /dashboard
- **Auth required:** Yes
- **Response:** `200 OK`
  ```json
  {
    "stats": {
      "totalProjects": 12,
      "activeTasks": 45,
      "completedTasks": 120,
      "lastSync": "ISO-string",
      "systemHealth": "healthy|degraded|critical"
    },
    "trends": {
      "weeklyCompletionRate": 0.85,
      "activeUsers": 10
    }
  }
  ```
