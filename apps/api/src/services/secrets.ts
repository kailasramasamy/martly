const DEV_SECRET = "dev-secret-change-me";

/**
 * The key that signs JWTs, OTP hashes and signed document links. Production refuses to boot without a real one;
 * elsewhere a fixed dev key keeps local setups working.
 */
export function authSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.JWT_SECRET;
  if (env.NODE_ENV !== "production") return secret || DEV_SECRET;
  if (!secret || secret === DEV_SECRET) throw new Error("JWT_SECRET must be set to a real secret in production");
  return secret;
}

/** Fails fast at boot on missing production secrets, and warns about the ones that only degrade a feature */
export function checkSecrets(log: { warn: (msg: string) => void }, env: NodeJS.ProcessEnv = process.env) {
  authSecret(env);
  if (env.NODE_ENV === "production" && !env.WEB_API_SECRET) {
    log.warn("WEB_API_SECRET is not set: martlyshop.in visitors share one rate limit and web search logging is refused");
  }
}
