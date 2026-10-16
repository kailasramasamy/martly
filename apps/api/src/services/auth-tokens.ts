import type { FastifyInstance } from "fastify";
import type { AuthTokens } from "@martly/shared/types";
import { resolvePermissions } from "./permissions.js";

interface TokenUser {
  id: string;
  email: string;
  role: string;
}

/** Short-lived access token carrying the member's effective permissions for the selected org */
export async function signAccessToken(app: FastifyInstance, user: TokenUser, organizationId?: string): Promise<string> {
  const permissions = await resolvePermissions(app.prisma, user, organizationId);
  return app.jwt.sign(
    { sub: user.id, email: user.email, role: user.role, organizationId, permissions },
    { expiresIn: "15m" },
  );
}

export async function issueSession(app: FastifyInstance, user: TokenUser, organizationId?: string): Promise<AuthTokens> {
  const accessToken = await signAccessToken(app, user, organizationId);
  const refreshToken = app.jwt.sign(
    { sub: user.id, email: user.email, role: user.role, organizationId, type: "refresh" },
    { expiresIn: "30d" },
  );
  return { accessToken, refreshToken };
}

/** 5-minute token that only allows picking an organization */
export function signOrgSelectToken(app: FastifyInstance, user: TokenUser): string {
  return app.jwt.sign({ sub: user.id, email: user.email, role: user.role, type: "org-select" }, { expiresIn: "5m" });
}
