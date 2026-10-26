import type { FastifyRequest, FastifyReply } from "fastify";

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    reply.unauthorized("Invalid or expired token");
  }
}

/** A guest sends no token. A token that is sent must be valid: an expired one gets a 401 so the app refreshes it, instead
 *  of the shopper quietly seeing the guest version of the page */
export async function authenticateOptional(request: FastifyRequest, reply: FastifyReply) {
  if (request.headers.authorization) await authenticate(request, reply);
}
