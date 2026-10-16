import "@fastify/jwt";
import type { Permission } from "@martly/shared/constants";

/** Access-token claims; permissions are the member's effective set in the selected organization */
export interface JwtUser {
  sub: string;
  email: string;
  role: string;
  organizationId?: string;
  permissions?: Permission[];
  type?: "refresh" | "org-select";
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtUser;
    user: JwtUser;
  }
}
