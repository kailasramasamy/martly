import { timingSafeEqual } from "crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

/** Names the client a limit counts against, or null when the rule doesn't apply to this request */
export type RateKey = (request: FastifyRequest) => string | null;

interface RateRule {
  max: number;
  /** ms, or an `ms` string such as "10 minutes" */
  window: number | string;
  key: RateKey;
}

const sameSecret = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Every martlyshop.in visitor reaches the API from the site's server, so the site names the visitor and limits count
 * each one on their own. The site proves it is the site with WEB_API_SECRET; without one set, only outside production.
 * Null when the request can't be trusted.
 */
export function webVisitorKey(request: FastifyRequest) {
  const secret = process.env.WEB_API_SECRET;
  const sent = request.headers["x-martly-web-secret"];
  const trusted = secret ? typeof sent === "string" && sameSecret(sent, secret) : process.env.NODE_ENV !== "production";
  const visitor = request.headers["x-martly-visitor"];
  return trusted && typeof visitor === "string" && visitor ? `web:${visitor.slice(0, 64)}` : null;
}

export const byIp: RateKey = (request) => `ip:${request.ip}`;

/** A martlyshop.in visitor when the site vouches for one, else the caller's IP */
export const byVisitor: RateKey = (request) => webVisitorKey(request) ?? byIp(request);

/** The signed-in user, else as byVisitor; runs after authenticateOptional */
export const byClient: RateKey = (request) => (request.user?.sub ? `user:${request.user.sub}` : byVisitor(request));

/** A string field of the JSON body, e.g. the phone an OTP goes to, so one target can't be hit from many IPs */
export function byBodyField(field: string): RateKey {
  return (request) => {
    const value = (request.body as Record<string, unknown> | undefined)?.[field];
    return typeof value === "string" && value.trim() ? `${field}:${value.trim().toLowerCase().slice(0, 254)}` : null;
  };
}

/**
 * A preHandler enforcing every rule in turn; the first one over its limit answers 429. As a preHandler it sees the
 * parsed body and the verified user. Counters are in memory, per API instance.
 */
export function rateLimits(app: FastifyInstance, rules: RateRule[]) {
  const checks = rules.map((rule) => ({
    key: rule.key,
    check: app.createRateLimit({ max: rule.max, timeWindow: rule.window, keyGenerator: (request) => rule.key(request) ?? "" }),
  }));
  return async (request: FastifyRequest, reply: FastifyReply) => {
    for (const { key, check } of checks) {
      if (!key(request)) continue;
      const result = await check(request);
      if (!result.isAllowed && result.isExceeded) {
        reply.header("retry-after", result.ttlInSeconds);
        return reply.tooManyRequests("Too many requests. Please wait a few minutes and try again.");
      }
    }
  };
}
