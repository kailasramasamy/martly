import type { FastifyInstance } from "fastify";
import { loginSchema, registerSchema } from "@martly/shared/schemas";
import type { ApiResponse, AuthTokens } from "@martly/shared/types";

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { email: string; password: string } }>("/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await app.prisma.user.findUnique({ where: { email: body.email } });

    if (!user) {
      return reply.unauthorized("Invalid credentials");
    }

    // TODO: verify password with bcrypt
    const token = app.jwt.sign({ sub: user.id, email: user.email, role: user.role });

    const response: ApiResponse<AuthTokens> = {
      success: true,
      data: { accessToken: token, refreshToken: token },
    };
    return response;
  });

  app.post("/register", async (request) => {
    const body = registerSchema.parse(request.body);

    // TODO: hash password with bcrypt
    const user = await app.prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        passwordHash: body.password, // TODO: hash this
        phone: body.phone,
        role: "CUSTOMER",
      },
    });

    const token = app.jwt.sign({ sub: user.id, email: user.email, role: user.role });

    const response: ApiResponse<AuthTokens> = {
      success: true,
      data: { accessToken: token, refreshToken: token },
    };
    return response;
  });
}
