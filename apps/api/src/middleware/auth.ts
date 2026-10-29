import type { FastifyRequest, FastifyReply } from "fastify";

/** Access tokens carry no `type` claim, including every one issued before types were checked */
export function tokenKind(payload: { type?: string }): string {
  return payload.type ?? "access";
}

/** Verifies the bearer token and accepts it only when it is one of `kinds`; a refresh token is never a login */
async function verifyToken(request: FastifyRequest, reply: FastifyReply, kinds: string[]) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.unauthorized("Invalid or expired token");
  }
  if (!kinds.includes(tokenKind(request.user))) return reply.unauthorized("Invalid token type");
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  return verifyToken(request, reply, ["access"]);
}

/** For /auth/select-org: the short-lived org-select token from login, or an access token when switching orgs */
export async function authenticateOrgSelection(request: FastifyRequest, reply: FastifyReply) {
  return verifyToken(request, reply, ["org-select", "access"]);
}

/** A guest sends no token. A token that is sent must be valid: an expired one gets a 401 so the app refreshes it, instead
 *  of the shopper quietly seeing the guest version of the page */
export async function authenticateOptional(request: FastifyRequest, reply: FastifyReply) {
  if (request.headers.authorization) return authenticate(request, reply);
}
