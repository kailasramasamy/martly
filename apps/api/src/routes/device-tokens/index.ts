import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";

export async function deviceTokenRoutes(app: FastifyInstance) {
  // Register device token (upsert)
  app.post("/", { preHandler: [authenticate] }, async (request) => {
    const { token, platform } = request.body as { token: string; platform?: string };
    const user = request.user as { sub: string };

    await app.prisma.deviceToken.upsert({
      where: { token },
      update: { userId: user.sub, platform: platform ?? "unknown", updatedAt: new Date() },
      create: { userId: user.sub, token, platform: platform ?? "unknown" },
    });

    const response: ApiResponse<{ registered: boolean }> = {
      success: true,
      data: { registered: true },
    };
    return response;
  });

  // Remove device token (on logout)
  app.delete("/", { preHandler: [authenticate] }, async (request) => {
    const { token } = request.body as { token: string };

    await app.prisma.deviceToken.deleteMany({ where: { token } });

    const response: ApiResponse<{ removed: boolean }> = {
      success: true,
      data: { removed: true },
    };
    return response;
  });
}
