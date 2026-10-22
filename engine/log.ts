// One JSON object per line. Cloud Run reads `severity` and `message`.
export type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR";

export function log(
  severity: Severity,
  message: string,
  fields: Record<string, unknown> = {},
): void {
  if (severity === "DEBUG" && process.env.LOG_LEVEL !== "debug") return;
  const line = JSON.stringify({ severity, message, time: new Date().toISOString(), ...fields });
  if (severity === "ERROR" || severity === "WARNING") console.error(line);
  else console.log(line);
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String(e.message);
  return String(e);
}
