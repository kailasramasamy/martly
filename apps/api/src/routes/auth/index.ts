import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { loginSchema, registerSchema } from "@martly/shared/schemas";
import type { ApiResponse, AuthTokens } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { email: string; password: string } }>("/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await app.prisma.user.findUnique({ where: { email: body.email } });

    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return reply.unauthorized("Invalid credentials");
    }

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
      const payload = app.jwt.verify<{ sub: string; email: string; role: string; type?: string }>(refreshToken);
      if (payload.type !== "refresh") {
        return reply.unauthorized("Invalid token type");
      }

      const accessToken = app.jwt.sign(
        { sub: payload.sub, email: payload.email, role: payload.role },
        { expiresIn: "15m" },
      );

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
    const { sub } = request.user as { sub: string };
    const user = await app.prisma.user.findUnique({ where: { id: sub } });

    if (!user) {
      return reply.notFound("User not found");
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _hash, ...safeUser } = user;
    const response: ApiResponse<typeof safeUser> = {
      success: true,
      data: safeUser,
    };
    return response;
  });
}
