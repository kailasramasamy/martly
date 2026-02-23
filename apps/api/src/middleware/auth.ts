import type { FastifyRequest, FastifyReply } from "fastify";

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    reply.unauthorized("Invalid or expired token");
  }
}

/** Try JWT verification but allow unauthenticated (guest) access */
export async function authenticateOptional(request: FastifyRequest) {
  try {
    await request.jwtVerify();
  } catch {
    // guest — request.user remains undefined
  }
}
