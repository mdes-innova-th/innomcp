export function sanitizeForTraceV3(input: string, max = 220): string {
  // Phase 7.2.5: Trace v3 sanitizer.
  // One-line, no quotes/backticks/braces/brackets inside q/a, redact email+IPv4, truncate.
  let s = String(input || "");
  s = s.replace(/\r?\n/g, " ");
  s = s.replace(/`/g, "");
  s = s.replace(/[{}\[\]]/g, "");
  s = s.replace(/[\"']/g, "");
  s = s.replace(/\s+/g, " ").trim();

  // JSON-ish redaction heuristics (avoid braces/brackets in replacement)
  if (/\b(ok|error|code|message)\b\s*:/i.test(s) && /\b(true|false|null)\b/i.test(s)) {
    s = "JSON_REDACTED";
  }

  // Credentials (avoid brackets)
  s = s.replace(
    /(api[_-]?key|token|bearer|authorization|password)\s*[:=]\s*([^,\s;]+)/gi,
    (_m, k) => `${k}=REDACTED`
  );
  s = s.replace(/\bauthorization\s*:\s*bearer\s+[^,\s;]+/gi, "authorization: bearer REDACTED");

  // PII-ish
  s = s.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "EMAIL_REDACTED");
  s = s.replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "IP_REDACTED");

  if (s.length > max) s = s.slice(0, max - 1) + "…";
  return s;
}

export function normalizeTraceAnswerV3(ans: string): string {
  const a = String(ans || "").trim();
  if (/^\d+$/.test(a)) return a;
  if (/^ERR:[A-Z0-9_]+$/i.test(a)) return a.toUpperCase();
  if (!a || a === "-") return "ERR:EMPTY";
  // No sentences / JSON / fragments in trace answer
  return "ERR:NON_NUMERIC";
}
