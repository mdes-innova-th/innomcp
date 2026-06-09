/**
 * maskSecrets.ts
 *
 * Global utility for masking sensitive values before logging or display.
 * Both functions are pure — they never mutate input.
 */

/** Keys whose string values should be replaced with "***" */
const SECRET_KEY_RE = /api[_-]?key|token|password|secret|auth|bearer/i;

/**
 * Recursively walk `value` (object / array / primitive) and replace any
 * string value whose key matches SECRET_KEY_RE with "***".
 *
 * Rules:
 * - Objects are walked shallowly on the matched key (only the immediate
 *   string value is replaced; non-string values at a matching key still
 *   recurse so nested secrets inside them are also masked).
 * - Array indices are numeric — they never match the regex, so array
 *   elements are only recursed, never masked at the element level.
 * - Null is returned as-is (typeof null === 'object' guard).
 * - Input is never mutated; new objects/arrays are returned.
 */
export function maskSecrets(value: unknown): unknown {
  return _maskValue(value, null);
}

function _maskValue(value: unknown, key: string | null): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => _maskValue(item, null));
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_RE.test(k) && typeof v === "string") {
        result[k] = "***";
      } else {
        result[k] = _maskValue(v, k);
      }
    }
    return result;
  }

  // Primitive — only mask if the parent key matched (handled in object branch above)
  return value;
}

/**
 * Mask common secret patterns that appear inline in strings, e.g. in URLs
 * or Authorization headers:
 *   - Bearer <token>
 *   - sk-<alphanum>  (OpenAI-style keys)
 *   - api_key=<value>  /  apikey=<value>  in query strings
 */
export function maskSecretsInString(str: string): string {
  return str
    // Bearer tokens
    .replace(/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/g, "Bearer ***")
    // sk-xxx style keys (min 8 chars after the prefix to avoid over-masking)
    .replace(/\bsk-[A-Za-z0-9]{8,}/g, "sk-***")
    // api_key= / apikey= in query strings or JSON strings
    .replace(/(api[_-]?key\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s&"']+)/gi, "$1***");
}

// ---------------------------------------------------------------------------
// Inline dev assertions — run at module load in development only.
// Uses console.assert so a failing assertion logs a warning without throwing.
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV === "development") {
  // 1. Top-level api_key is masked
  const r1 = maskSecrets({ api_key: "super-secret-key-123", name: "test" }) as Record<string, unknown>;
  console.assert(r1.api_key === "***", "[maskSecrets] FAIL: api_key not masked");
  console.assert(r1.name === "test", "[maskSecrets] FAIL: non-secret key mutated");

  // 2. Nested token is masked
  const r2 = maskSecrets({ config: { token: "abc123", host: "localhost" } }) as Record<string, unknown>;
  const config = r2.config as Record<string, unknown>;
  console.assert(config.token === "***", "[maskSecrets] FAIL: nested token not masked");
  console.assert(config.host === "localhost", "[maskSecrets] FAIL: nested non-secret mutated");

  // 3. Input object is NOT mutated (purity check)
  const original = { password: "hunter2", user: "alice" };
  maskSecrets(original);
  console.assert(original.password === "hunter2", "[maskSecrets] FAIL: input was mutated");

  // 4. maskSecretsInString masks Bearer token
  const s1 = maskSecretsInString("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig");
  console.assert(s1 === "Authorization: Bearer ***", "[maskSecretsInString] FAIL: Bearer not masked");

  // 5. maskSecretsInString masks sk- style key
  const s2 = maskSecretsInString("key=sk-AbCdEfGhIjKlMnOp");
  console.assert(s2.includes("sk-***"), "[maskSecretsInString] FAIL: sk- key not masked");
}
