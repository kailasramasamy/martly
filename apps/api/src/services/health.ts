export const READINESS_TIMEOUT_MS = 2_000;

export type Readiness = { statusCode: 200 | 503; body: { status: "ok" | "unavailable"; db: "ok" | "down" | "timeout" } };

/** Ready only when the database answers within the timeout; a hung pool counts as down instead of hanging the probe */
export async function checkReadiness(ping: () => Promise<unknown>, timeoutMs = READINESS_TIMEOUT_MS): Promise<Readiness> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });
  const db = await Promise.race([ping().then(() => "ok" as const, () => "down" as const), timeout]);
  clearTimeout(timer);
  return db === "ok"
    ? { statusCode: 200, body: { status: "ok", db } }
    : { statusCode: 503, body: { status: "unavailable", db } };
}
