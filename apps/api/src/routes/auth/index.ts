import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { loginSchema, registerSchema, selectOrgSchema } from "@martly/shared/schemas";
import type { ApiResponse, AuthTokens, LoginResponse, OrgSummary } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";

/** Look up distinct organizations a user belongs to via UserStore → Store → Organization */
async function getUserOrgs(prisma: FastifyInstance["prisma"], userId: string): Promise<OrgSummary[]> {
  const userStores = await prisma.userStore.findMany({
    where: { userId },
    select: { store: { select: { organization: { select: { id: true, name: true, slug: true } } } } },
  });

  const orgMap = new Map<string, OrgSummary>();
  for (const us of userStores) {
    const org = us.store.organization;
    if (!orgMap.has(org.id)) {
      orgMap.set(org.id, { id: org.id, name: org.name, slug: org.slug });
    }
  }
  return Array.from(orgMap.values());
}

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { email: string; password: string } }>("/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await app.prisma.user.findUnique({ where: { email: body.email } });

    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return reply.unauthorized("Invalid credentials");
    }

    // SUPER_ADMIN and CUSTOMER don't need org context
    if (user.role === "SUPER_ADMIN" || user.role === "CUSTOMER") {
      const accessToken = app.jwt.sign(
        { sub: user.id, email: user.email, role: user.role },
        { expiresIn: "15m" },
      );
      const refreshToken = app.jwt.sign(
        { sub: user.id, email: user.email, role: user.role, type: "refresh" },
        { expiresIn: "7d" },
      );

      const response: ApiResponse<LoginResponse> = {
        success: true,
        data: { requiresOrgSelection: false, accessToken, refreshToken },
      };
      return response;
    }

    // Org-scoped roles: look up user's organizations
    const orgs = await getUserOrgs(app.prisma, user.id);

    if (orgs.length === 0) {
      return reply.forbidden("User is not assigned to any organization");
    }

    if (orgs.length === 1) {
      // Auto-select the single org
      const accessToken = app.jwt.sign(
        { sub: user.id, email: user.email, role: user.role, organizationId: orgs[0].id },
        { expiresIn: "15m" },
      );
      const refreshToken = app.jwt.sign(
        { sub: user.id, email: user.email, role: user.role, organizationId: orgs[0].id, type: "refresh" },
        { expiresIn: "7d" },
      );

      const response: ApiResponse<LoginResponse> = {
        success: true,
        data: { requiresOrgSelection: false, accessToken, refreshToken },
      };
      return response;
    }

    // Multiple orgs → require selection
    const temporaryToken = app.jwt.sign(
      { sub: user.id, email: user.email, role: user.role, type: "org-select" },
      { expiresIn: "5m" },
    );

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: { requiresOrgSelection: true, organizations: orgs, temporaryToken },
    };
    return response;
  });

  // Select organization (initial selection or org switching)
  app.post("/select-org", { preHandler: [authenticate] }, async (request, reply) => {
    const { organizationId } = selectOrgSchema.parse(request.body);
    const user = request.user as { sub: string; email: string; role: string };

    // SUPER_ADMIN can switch to any org (or set org context)
    if (user.role !== "SUPER_ADMIN") {
      // Verify user belongs to this org via UserStore
      const membership = await app.prisma.userStore.findFirst({
        where: { userId: user.sub, store: { organizationId } },
      });
      if (!membership) {
        return reply.forbidden("You do not belong to this organization");
      }
    }

    const accessToken = app.jwt.sign(
      { sub: user.sub, email: user.email, role: user.role, organizationId },
      { expiresIn: "15m" },
    );
    const refreshToken = app.jwt.sign(
      { sub: user.sub, email: user.email, role: user.role, organizationId, type: "refresh" },
      { expiresIn: "7d" },
    );

    const response: ApiResponse<AuthTokens> = {
      success: true,
      data: { accessToken, refreshToken },
    };
    return response;
  });

  app.post("/register", async (request) => {
    const body = registerSchema.parse(request.body);
    const passwordHash = await bcrypt.hash(body.password, 10);

    const user = await app.prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        passwordHash,
        phone: body.phone,
        role: "CUSTOMER",
      },
    });

    const accessToken = app.jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: "15m" },
    );
    const refreshToken = app.jwt.sign(
      { sub: user.id, email: user.email, role: user.role, type: "refresh" },
      { expiresIn: "7d" },
    );

    const response: ApiResponse<AuthTokens> = {
      success: true,
      data: { accessToken, refreshToken },
    };
    return response;
  });

  app.post("/refresh", async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken?: string };
    if (!refreshToken) {
      return reply.badRequest("Refresh token is required");
    }

    try {
      const payload = app.jwt.verify<{
        sub: string; email: string; role: string; organizationId?: string; type?: string;
      }>(refreshToken);
      if (payload.type !== "refresh") {
        return reply.unauthorized("Invalid token type");
      }

      const tokenPayload: Record<string, unknown> = {
        sub: payload.sub, email: payload.email, role: payload.role,
      };
      if (payload.organizationId) {
        tokenPayload.organizationId = payload.organizationId;
      }

      const accessToken = app.jwt.sign(tokenPayload, { expiresIn: "15m" });

      const response: ApiResponse<{ accessToken: string }> = {
        success: true,
        data: { accessToken },
      };
      return response;
    } catch {
      return reply.unauthorized("Invalid or expired refresh token");
    }
  });

  app.get("/me", { preHandler: [authenticate] }, async (request, reply) => {
    const { sub, organizationId } = request.user as { sub: string; organizationId?: string };
    const user = await app.prisma.user.findUnique({ where: { id: sub } });

    if (!user) {
      return reply.notFound("User not found");
    }

    // Look up user's organizations
    const organizations = user.role === "SUPER_ADMIN" || user.role === "CUSTOMER"
      ? []
      : await getUserOrgs(app.prisma, user.id);

    // Look up assigned stores for STORE_MANAGER / STAFF
    let stores: { id: string; name: string }[] = [];
    if ((user.role === "STORE_MANAGER" || user.role === "STAFF") && organizationId) {
      const userStores = await app.prisma.userStore.findMany({
        where: { userId: sub, store: { organizationId } },
        select: { store: { select: { id: true, name: true } } },
      });
      stores = userStores.map((us) => ({ id: us.store.id, name: us.store.name }));
    }

    const { passwordHash: _hash, ...safeUser } = user;
    const response: ApiResponse<typeof safeUser & { organizationId?: string; organizations: OrgSummary[]; stores: { id: string; name: string }[] }> = {
      success: true,
      data: { ...safeUser, organizationId, organizations, stores },
    };
    return response;
  });
}
