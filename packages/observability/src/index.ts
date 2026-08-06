const sensitiveKey = /authorization|cookie|token|secret|password|api[-_]?key|email/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    sensitiveKey.test(key) ? "[REDACTED]" : redact(entry),
  ]));
}

export interface LogContext {
  requestId?: string;
  module?: string;
  operation?: string;
  durationMs?: number;
  [key: string]: unknown;
}

export function logEvent(
  level: "debug" | "info" | "warn" | "error",
  message: string,
  context: LogContext = {},
) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...redact(context) as Record<string, unknown>,
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.log(entry);
}
